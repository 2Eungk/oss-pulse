import { strict as assert } from "node:assert"
import { execFile } from "node:child_process"
import { mkdir, mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)

test("CLI emits a vibe-coder launch post with command and next actions", async () => {
  // Given: a mostly launch-ready repository with one remaining contributor-growth gap.
  const repositoryRoot = await createLaunchReadyRepository()

  // When: the CLI scans with the launch-post format.
  const result = await execFileAsync(process.execPath, [
    cliPath(),
    "scan",
    repositoryRoot,
    "--format",
    "launch-post",
  ])

  // Then: the output is ready to paste into social/community launch channels.
  assert.match(result.stdout, /# Launch Post Draft/)
  assert.match(
    result.stdout,
    /I vibe-coded a small open source tool and ran `oss-pulse` before sharing the repo\./,
  )
  assert.match(result.stdout, /Readiness score: 95\/100 \(needs-work\)/)
  assert.match(result.stdout, /npx --yes oss-pulse@latest scan \. --format launch-post/)
  assert.match(result.stdout, /## What looks ready/)
  assert.match(result.stdout, /- README/)
  assert.match(result.stdout, /- License/)
  assert.match(result.stdout, /## Still tightening/)
  assert.match(result.stdout, /Grow external contributors/)
  assert.match(result.stdout, /Feedback welcome from maintainers/)
  assert.doesNotMatch(result.stdout, /## Checks/)
  assert.equal(result.stderr, "")
})

async function createLaunchReadyRepository(): Promise<string> {
  const repositoryRoot = await mkdtemp(join(tmpdir(), "oss-pulse-launch-post-"))
  await mkdir(join(repositoryRoot, ".github", "ISSUE_TEMPLATE"), { recursive: true })
  await mkdir(join(repositoryRoot, ".github", "workflows"), { recursive: true })
  await git(repositoryRoot, ["init"])
  await git(repositoryRoot, ["config", "user.email", "maintainer@example.com"])
  await git(repositoryRoot, ["config", "user.name", "Maintainer"])
  await writeFile(join(repositoryRoot, "README.md"), "# Demo\n", "utf8")
  await writeFile(join(repositoryRoot, "LICENSE"), "MIT\n", "utf8")
  await writeFile(join(repositoryRoot, "CONTRIBUTING.md"), "# Contributing\n", "utf8")
  await writeFile(join(repositoryRoot, "SECURITY.md"), "# Security\n", "utf8")
  await writeFile(join(repositoryRoot, "CHANGELOG.md"), "# Changelog\n", "utf8")
  await writeFile(join(repositoryRoot, "CODE_OF_CONDUCT.md"), "# Code of Conduct\n", "utf8")
  await writeFile(join(repositoryRoot, ".github", "CODEOWNERS"), "* @maintainer\n", "utf8")
  await writeFile(join(repositoryRoot, ".github", "FUNDING.yml"), "github: maintainer\n", "utf8")
  await writeFile(
    join(repositoryRoot, ".github", "PULL_REQUEST_TEMPLATE.md"),
    "## What changed\n",
    "utf8",
  )
  await writeFile(
    join(repositoryRoot, ".github", "ISSUE_TEMPLATE", "bug_report.md"),
    "---\nname: Bug report\n---\n",
    "utf8",
  )
  await writeFile(
    join(repositoryRoot, ".github", "ISSUE_TEMPLATE", "good_first_issue.md"),
    "---\nname: Good first issue\n---\n",
    "utf8",
  )
  await writeFile(join(repositoryRoot, ".github", "workflows", "ci.yml"), "name: CI\n", "utf8")
  await writeFile(
    join(repositoryRoot, ".github", "workflows", "release.yml"),
    "name: Release\n",
    "utf8",
  )
  await git(repositoryRoot, ["add", "."])
  await git(repositoryRoot, ["commit", "-m", "Prepare launch surfaces"])
  return repositoryRoot
}

async function git(cwd: string, args: readonly string[]): Promise<void> {
  await execFileAsync("git", ["-C", cwd, ...args])
}

function cliPath(): string {
  const currentFile = fileURLToPath(import.meta.url)
  return resolve(dirname(currentFile), "../src/cli.js")
}
