import { strict as assert } from "node:assert"
import { execFile } from "node:child_process"
import { mkdir, mkdtemp, realpath, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"
import { z } from "zod"

const execFileAsync = promisify(execFile)

const ReportSchema = z.object({
  actions: z.array(z.object({ id: z.string() })),
  root: z.string(),
  score: z.number(),
  status: z.enum(["ready", "needs-work"]),
})

type GitAuthor = {
  readonly email: string
  readonly name: string
}

const MAINTAINER: GitAuthor = {
  email: "maintainer@example.com",
  name: "Maintainer",
}

const CONTRIBUTOR: GitAuthor = {
  email: "contributor@example.com",
  name: "Contributor",
}

test("fixture scenario reports ready when a repository has every maintained surface", async () => {
  // Given: a complete repository fixture with release, funding, and two contributors.
  const repositoryRoot = await createCompleteRepository()

  // When: the CLI scans the fixture as JSON.
  const report = await scanJson(repositoryRoot)

  // Then: the repository receives the full maintainer-readiness score.
  assert.equal(report.score, 100)
  assert.equal(report.status, "ready")
  assert.deepEqual(report.actions, [])
})

test("fixture scenario reports sparse repositories as actionable", async () => {
  // Given: a sparse repository fixture with only a README and one recent commit.
  const repositoryRoot = await createSparseRepository()

  // When: the CLI scans the fixture as JSON.
  const report = await scanJson(repositoryRoot)

  // Then: the score and first actions reflect the missing maintainer surfaces.
  assert.equal(report.score, 15)
  assert.equal(report.status, "needs-work")
  assert.deepEqual(
    report.actions.slice(0, 3).map((action) => action.id),
    ["add-license", "add-contributing-guide", "add-issue-template"],
  )
})

test("fixture scenario reports docs-ready repositories without workflows as release-blocked", async () => {
  // Given: a repository with strong documentation and contributor surfaces but no automation.
  const repositoryRoot = await createDocsReadyRepositoryWithoutWorkflows()

  // When: the CLI scans the fixture as JSON.
  const report = await scanJson(repositoryRoot)

  // Then: the score preserves the docs credit while CI and release automation stay actionable.
  assert.equal(report.score, 90)
  assert.equal(report.status, "needs-work")
  assert.deepEqual(
    report.actions.map((action) => action.id),
    ["add-ci-workflow", "add-release-workflow"],
  )
})

test("fixture scenario rejects configuration-only issue template directories", async () => {
  // Given: GitHub issue-template configuration exists without an actual issue template.
  const repositoryRoot = await createSparseRepository()
  await writeRepoFile(
    repositoryRoot,
    ".github/ISSUE_TEMPLATE/config.yml",
    "blank_issues_enabled: false\n",
  )
  await commitAll(repositoryRoot, "Configure issue chooser", MAINTAINER)

  // When: the repository is scanned.
  const report = await scanJson(repositoryRoot)

  // Then: configuration alone does not earn issue-template readiness credit.
  assert.equal(report.score, 15)
  assert.equal(
    report.actions.some((action) => action.id === "add-issue-template"),
    true,
  )
})

test("fixture scenario scans from the repository root for nested package paths", async () => {
  // Given: a nested package path inside a repository fixture.
  const repositoryRoot = await createSparseRepository()
  const packageRoot = join(repositoryRoot, "packages/core")
  await mkdir(packageRoot, { recursive: true })
  await writeRepoFile(repositoryRoot, "LICENSE", "MIT\n")
  await commitAll(repositoryRoot, "Add nested package license", MAINTAINER)

  // When: the CLI scans the nested package path.
  const report = await scanJson(packageRoot)

  // Then: scoring uses maintainer files from the git top-level.
  assert.equal(report.root, await realpath(repositoryRoot))
  assert.equal(report.score, 30)
})

async function createCompleteRepository(): Promise<string> {
  const repositoryRoot = await createRepository()

  await writeRepoFile(repositoryRoot, "README.md", "# Complete\n")
  await writeRepoFile(repositoryRoot, "LICENSE", "MIT\n")
  await writeRepoFile(repositoryRoot, "CONTRIBUTING.md", "# Contributing\n")
  await writeRepoFile(repositoryRoot, "SECURITY.md", "# Security\n")
  await writeRepoFile(repositoryRoot, "CODE_OF_CONDUCT.md", "# Code of Conduct\n")
  await writeRepoFile(repositoryRoot, "CHANGELOG.md", "# Changelog\n")
  await writeRepoFile(repositoryRoot, ".github/CODEOWNERS", "* @maintainer\n")
  await writeRepoFile(repositoryRoot, ".github/FUNDING.yml", "github: maintainer\n")
  await writeRepoFile(repositoryRoot, ".github/ISSUE_TEMPLATE/bug_report.md", "name: Bug\n")
  await writeRepoFile(
    repositoryRoot,
    ".github/ISSUE_TEMPLATE/good_first_issue.md",
    "name: Good first issue\nlabels: good first issue\n",
  )
  await writeRepoFile(repositoryRoot, ".github/PULL_REQUEST_TEMPLATE.md", "## Summary\n")
  await writeRepoFile(repositoryRoot, ".github/workflows/ci.yml", "name: CI\n")
  await writeRepoFile(repositoryRoot, ".github/workflows/release.yml", "name: Release\n")
  await commitAll(repositoryRoot, "Add maintainer surfaces", MAINTAINER)

  await writeRepoFile(repositoryRoot, "docs/contributor-note.md", "Thanks\n")
  await commitAll(repositoryRoot, "Add contributor note", CONTRIBUTOR)

  return repositoryRoot
}

async function createDocsReadyRepositoryWithoutWorkflows(): Promise<string> {
  const repositoryRoot = await createRepository()

  await writeRepoFile(repositoryRoot, "README.md", "# Docs Ready\n")
  await writeRepoFile(repositoryRoot, "LICENSE", "MIT\n")
  await writeRepoFile(repositoryRoot, "CONTRIBUTING.md", "# Contributing\n")
  await writeRepoFile(repositoryRoot, "SECURITY.md", "# Security\n")
  await writeRepoFile(repositoryRoot, "CODE_OF_CONDUCT.md", "# Code of Conduct\n")
  await writeRepoFile(repositoryRoot, "CHANGELOG.md", "# Changelog\n")
  await writeRepoFile(repositoryRoot, ".github/CODEOWNERS", "* @maintainer\n")
  await writeRepoFile(repositoryRoot, ".github/FUNDING.yml", "github: maintainer\n")
  await writeRepoFile(repositoryRoot, ".github/ISSUE_TEMPLATE/bug_report.md", "name: Bug\n")
  await writeRepoFile(
    repositoryRoot,
    ".github/ISSUE_TEMPLATE/good_first_issue.md",
    "name: Good first issue\nlabels: good first issue\n",
  )
  await writeRepoFile(repositoryRoot, ".github/PULL_REQUEST_TEMPLATE.md", "## Summary\n")
  await commitAll(repositoryRoot, "Add docs-ready surfaces", MAINTAINER)

  await writeRepoFile(repositoryRoot, "docs/contributor-note.md", "Thanks\n")
  await commitAll(repositoryRoot, "Add contributor note", CONTRIBUTOR)

  return repositoryRoot
}

async function createSparseRepository(): Promise<string> {
  const repositoryRoot = await createRepository()
  await writeRepoFile(repositoryRoot, "README.md", "# Sparse\n")
  await commitAll(repositoryRoot, "Add README", MAINTAINER)
  return repositoryRoot
}

async function createRepository(): Promise<string> {
  const repositoryRoot = await mkdtemp(join(tmpdir(), "oss-pulse-fixture-"))
  await git(repositoryRoot, ["init"])
  return repositoryRoot
}

async function writeRepoFile(root: string, relativePath: string, contents: string): Promise<void> {
  const filePath = join(root, relativePath)
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, contents, "utf8")
}

async function commitAll(root: string, message: string, author: GitAuthor): Promise<void> {
  await git(root, ["add", "."])
  await git(root, [
    "-c",
    `user.name=${author.name}`,
    "-c",
    `user.email=${author.email}`,
    "commit",
    "-m",
    message,
  ])
}

async function scanJson(path: string): Promise<z.infer<typeof ReportSchema>> {
  const result = await execFileAsync(process.execPath, [
    cliPath(),
    "scan",
    path,
    "--format",
    "json",
  ])
  return ReportSchema.parse(JSON.parse(result.stdout))
}

async function git(cwd: string, args: readonly string[]): Promise<void> {
  await execFileAsync("git", ["-C", cwd, ...args])
}

function cliPath(): string {
  const currentFile = fileURLToPath(import.meta.url)
  return resolve(dirname(currentFile), "../src/cli.js")
}
