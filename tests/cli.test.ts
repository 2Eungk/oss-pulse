import { strict as assert } from "node:assert"
import { execFile } from "node:child_process"
import { mkdir, mkdtemp, realpath, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)

test("CLI emits JSON pulse when scanning a real git repository", async () => {
  // Given: a real git repository with a README, license, and CI workflow.
  const repositoryRoot = await mkdtemp(join(tmpdir(), "oss-pulse-repo-"))
  await git(repositoryRoot, ["init"])
  await git(repositoryRoot, ["config", "user.email", "maintainer@example.com"])
  await git(repositoryRoot, ["config", "user.name", "Maintainer"])
  await mkdir(join(repositoryRoot, ".github/workflows"), { recursive: true })
  await writeFile(join(repositoryRoot, "README.md"), "# Demo\n", "utf8")
  await writeFile(join(repositoryRoot, "LICENSE"), "MIT\n", "utf8")
  await writeFile(join(repositoryRoot, ".github/workflows/ci.yml"), "name: CI\n", "utf8")
  await git(repositoryRoot, ["add", "."])
  await git(repositoryRoot, ["commit", "-m", "Initial maintenance surface"])

  // When: the compiled CLI scans the repository.
  const result = await execFileAsync(process.execPath, [
    cliPath(),
    "scan",
    repositoryRoot,
    "--format",
    "json",
  ])
  const report = JSON.parse(result.stdout)

  // Then: the observable JSON output contains the computed maintainer score.
  assert.equal(report.score, 35)
  assert.equal(report.status, "needs-work")
  assert.equal(report.actions.length, 11)
})

test("CLI counts CODEOWNERS review-routing signals", async () => {
  // Given: a real git repository with ownership routing declared.
  const repositoryRoot = await createMinimalRepository()
  await mkdir(join(repositoryRoot, ".github"), { recursive: true })
  await writeFile(join(repositoryRoot, ".github/CODEOWNERS"), "* @maintainer\n", "utf8")
  await git(repositoryRoot, ["add", "."])
  await git(repositoryRoot, ["commit", "-m", "Add CODEOWNERS"])

  // When: the compiled CLI scans the repository.
  const result = await execFileAsync(process.execPath, [
    cliPath(),
    "scan",
    repositoryRoot,
    "--format",
    "json",
  ])
  const report = JSON.parse(result.stdout)

  // Then: the CODEOWNERS check passes and its remediation action is cleared.
  assert.equal(
    report.checks.find((check: { readonly id: string }) => check.id === "codeowners")?.passed,
    true,
  )
  assert.equal(
    report.actions.some((action: { readonly id: string }) => action.id === "add-codeowners"),
    false,
  )
})

test("CLI counts changelog, funding, and release workflow signals", async () => {
  // Given: a real git repository with release sustainability files.
  const repositoryRoot = await createMinimalRepository()
  await mkdir(join(repositoryRoot, ".github/workflows"), { recursive: true })
  await mkdir(join(repositoryRoot, ".github"), { recursive: true })
  await writeFile(join(repositoryRoot, "CHANGELOG.md"), "# Changelog\n", "utf8")
  await writeFile(join(repositoryRoot, ".github/FUNDING.yml"), "github: maintainer\n", "utf8")
  await writeFile(join(repositoryRoot, ".github/workflows/release.yml"), "name: Release\n", "utf8")
  await git(repositoryRoot, ["add", "."])
  await git(repositoryRoot, ["commit", "-m", "Add release signals"])

  // When: the compiled CLI scans the repository.
  const result = await execFileAsync(process.execPath, [
    cliPath(),
    "scan",
    repositoryRoot,
    "--format",
    "json",
  ])
  const report = JSON.parse(result.stdout)

  // Then: the newly supported maintainer signals add to the score and clear their actions.
  assert.equal(report.score, 35)
  assert.equal(
    report.actions.some((action: { readonly id: string }) => action.id === "add-changelog"),
    false,
  )
  assert.equal(
    report.actions.some((action: { readonly id: string }) => action.id === "add-funding"),
    false,
  )
  assert.equal(
    report.actions.some((action: { readonly id: string }) => action.id === "add-release-workflow"),
    false,
  )
})

test("CLI returns a user-facing error when the path cannot be scanned", async () => {
  // Given: a path that does not exist.
  const missingPath = join(tmpdir(), "oss-pulse-missing-path")

  // When: the CLI scans the missing path.
  const result = await captureFailure([cliPath(), "scan", missingPath, "--format", "json"])

  // Then: the process exits with a command error and explains the bad input.
  assert.equal(result.code, 2)
  assert.match(result.stderr, /path does not exist/)
})

test("CLI returns a concise validation error when the format is unsupported", async () => {
  // Given: a real git repository and an unsupported output format.
  const repositoryRoot = await createMinimalRepository()

  // When: the CLI parses the invalid format option.
  const result = await captureFailure([cliPath(), "scan", repositoryRoot, "--format", "xml"])

  // Then: the process exits with a concise validation message.
  assert.equal(result.code, 2)
  assert.match(result.stderr, /invalid options/)
  assert.match(
    result.stderr,
    /format: expected one of json, markdown, release-notes, action-summary, contributor-onboarding, triage-suggestions, sarif, github-annotations/,
  )
  assert.doesNotMatch(result.stderr, /invalid_enum_value/)
})

test("CLI scans from the git top-level when invoked inside a repository subdirectory", async () => {
  // Given: a repository whose maintainer files live at the git root.
  const repositoryRoot = await createMinimalRepository()
  const packageDir = join(repositoryRoot, "packages/core")
  await mkdir(packageDir, { recursive: true })
  await writeFile(join(repositoryRoot, "LICENSE"), "MIT\n", "utf8")
  await git(repositoryRoot, ["add", "."])
  await git(repositoryRoot, ["commit", "-m", "Add nested package"])

  // When: the CLI scans a subdirectory inside that repository.
  const result = await execFileAsync(process.execPath, [
    cliPath(),
    "scan",
    packageDir,
    "--format",
    "json",
  ])
  const report = JSON.parse(result.stdout)

  // Then: maintainer-file checks are evaluated from the repository root.
  assert.equal(report.root, await realpath(repositoryRoot))
  assert.equal(report.score, 30)
})

test("CLI treats a path after option terminator as positional input", async () => {
  // Given: an action-style invocation whose repository path looks like a CLI option.
  const workingDirectory = await mkdtemp(join(tmpdir(), "oss-pulse-action-"))
  const injectedOutputPath = join(workingDirectory, "injected-output.md")

  // When: the path is passed after `--`.
  const result = await captureFailureWithCwd(
    [cliPath(), "scan", "--format", "markdown", "--", "--output=injected-output.md"],
    workingDirectory,
  )

  // Then: it is rejected as a missing path and does not create an output file.
  assert.equal(result.code, 2)
  assert.match(result.stderr, /path does not exist/)
  await assert.rejects(realpath(injectedOutputPath), { code: "ENOENT" })
})

test("CLI exits 1 when fail-under is above the repository score", async () => {
  // Given: a sparse repository below the requested score threshold.
  const repositoryRoot = await createMinimalRepository()

  // When: the CLI scans with a fail-under gate above that score.
  const result = await captureFailure([
    cliPath(),
    "scan",
    repositoryRoot,
    "--format",
    "json",
    "--fail-under",
    "50",
  ])
  const report = JSON.parse(result.stdout)

  // Then: the report is still emitted and the process fails for CI.
  assert.equal(result.code, 1)
  assert.equal(report.score, 15)
  assert.equal(report.status, "needs-work")
  assert.equal(result.stderr, "")
})

test("CLI exits 0 when fail-under is met", async () => {
  // Given: a sparse repository above a low score threshold.
  const repositoryRoot = await createMinimalRepository()

  // When: the CLI scans with a fail-under gate below that score.
  const result = await execFileAsync(process.execPath, [
    cliPath(),
    "scan",
    repositoryRoot,
    "--format",
    "json",
    "--fail-under",
    "10",
  ])
  const report = JSON.parse(result.stdout)

  // Then: the report is emitted and the process succeeds.
  assert.equal(report.score, 15)
  assert.equal(report.status, "needs-work")
  assert.equal(result.stderr, "")
})

test("CLI emits compact Markdown when summary-only is enabled", async () => {
  // Given: a sparse repository with next actions.
  const repositoryRoot = await createMinimalRepository()

  // When: the CLI scans with compact Markdown output.
  const result = await execFileAsync(process.execPath, [
    cliPath(),
    "scan",
    repositoryRoot,
    "--format",
    "markdown",
    "--summary-only",
  ])

  // Then: the output keeps the score and actions without the full checks table.
  assert.match(result.stdout, /# OSS Pulse/)
  assert.match(result.stdout, /Score: 15\/100/)
  assert.match(result.stdout, /## Next Actions/)
  assert.doesNotMatch(result.stdout, /## Checks/)
  assert.doesNotMatch(result.stdout, /\| State \| Check \| Points \| Detail \|/)
  assert.equal(result.stderr, "")
})

async function git(cwd: string, args: readonly string[]): Promise<void> {
  await execFileAsync("git", ["-C", cwd, ...args])
}

async function createMinimalRepository(): Promise<string> {
  const repositoryRoot = await mkdtemp(join(tmpdir(), "oss-pulse-repo-"))
  await git(repositoryRoot, ["init"])
  await git(repositoryRoot, ["config", "user.email", "maintainer@example.com"])
  await git(repositoryRoot, ["config", "user.name", "Maintainer"])
  await writeFile(join(repositoryRoot, "README.md"), "# Demo\n", "utf8")
  await git(repositoryRoot, ["add", "."])
  await git(repositoryRoot, ["commit", "-m", "Initial maintenance surface"])
  return repositoryRoot
}

async function captureFailure(args: readonly string[]): Promise<{
  readonly code: number
  readonly stderr: string
  readonly stdout: string
}> {
  return captureFailureWithCwd(args, process.cwd())
}

async function captureFailureWithCwd(
  args: readonly string[],
  cwd: string,
): Promise<{
  readonly code: number
  readonly stderr: string
  readonly stdout: string
}> {
  try {
    await execFileAsync(process.execPath, [...args], { cwd })
  } catch (error) {
    if (isExecFailure(error)) {
      return { code: error.code, stderr: error.stderr, stdout: error.stdout }
    }
    throw error
  }

  assert.fail("expected command to fail")
}

function cliPath(): string {
  const currentFile = fileURLToPath(import.meta.url)
  return resolve(dirname(currentFile), "../src/cli.js")
}

function isExecFailure(error: unknown): error is {
  readonly code: number
  readonly stderr: string
  readonly stdout: string
} {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "number" &&
    "stderr" in error &&
    typeof error.stderr === "string" &&
    "stdout" in error &&
    typeof error.stdout === "string"
  )
}
