import { strict as assert } from "node:assert"
import { execFile } from "node:child_process"
import { mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"
import { formatGithubAnnotations } from "../src/github-annotations.js"
import type { PulseReport } from "../src/types.js"

const execFileAsync = promisify(execFile)

test("CLI emits GitHub annotations when github-annotations format is selected", async () => {
  // Given: a sparse repository with high-priority maintainer actions.
  const repositoryRoot = await createSparseRepository()

  // When: the CLI scans with GitHub annotations output.
  const result = await execFileAsync(process.execPath, [
    cliPath(),
    "scan",
    repositoryRoot,
    "--format",
    "github-annotations",
  ])

  // Then: missing maintainer surfaces are emitted as workflow annotations.
  assert.match(
    result.stdout,
    /::error file=LICENSE,line=1,title=Add LICENSE::Add LICENSE: Add an OSI-approved license/,
  )
  assert.match(
    result.stdout,
    /::warning file=.github\/workflows\/ci.yml,line=1,title=Add CI workflow::Add CI workflow:/,
  )
  assert.equal(result.stderr, "")
})

test("formatGithubAnnotations escapes workflow command data", () => {
  // Given: an action whose title and detail include workflow-command separators.
  const report: PulseReport = {
    actions: [
      {
        detail: "Line 1\nLine 2%",
        id: "add-license",
        priority: "high",
        title: "Add: LICENSE, now%",
      },
    ],
    branch: "main",
    checks: [],
    generatedAtIso: "2026-07-08T00:00:00.000Z",
    latestCommitIso: null,
    root: "/tmp/repo",
    score: 0,
    status: "needs-work",
  }

  // When: the report is rendered as GitHub workflow annotations.
  const output = formatGithubAnnotations(report)

  // Then: command properties and message data are escaped for the runner parser.
  assert.equal(
    output,
    "::error file=LICENSE,line=1,title=Add%3A LICENSE%2C now%25::Add: LICENSE, now%25: Line 1%0ALine 2%25\n",
  )
})

async function createSparseRepository(): Promise<string> {
  const repositoryRoot = await mkdtemp(join(tmpdir(), "oss-pulse-annotations-"))
  await git(repositoryRoot, ["init"])
  await git(repositoryRoot, ["config", "user.email", "maintainer@example.com"])
  await git(repositoryRoot, ["config", "user.name", "Maintainer"])
  await writeFile(join(repositoryRoot, "README.md"), "# Demo\n", "utf8")
  await git(repositoryRoot, ["add", "."])
  await git(repositoryRoot, ["commit", "-m", "Add README"])
  return repositoryRoot
}

async function git(cwd: string, args: readonly string[]): Promise<void> {
  await execFileAsync("git", ["-C", cwd, ...args])
}

function cliPath(): string {
  const currentFile = fileURLToPath(import.meta.url)
  return resolve(dirname(currentFile), "../src/cli.js")
}
