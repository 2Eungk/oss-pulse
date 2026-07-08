import { strict as assert } from "node:assert"
import { execFile } from "node:child_process"
import { mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)

test("CLI emits an Action-focused summary with the top three actions", async () => {
  // Given: a sparse repository with many possible remediation actions.
  const repositoryRoot = await createSparseRepository()

  // When: the CLI scans with the Action summary format.
  const result = await execFileAsync(process.execPath, [
    cliPath(),
    "scan",
    repositoryRoot,
    "--format",
    "action-summary",
  ])

  // Then: the output is compact Markdown optimized for step summaries.
  assert.match(result.stdout, /# OSS Pulse Action Summary/)
  assert.match(result.stdout, /Score: 15\/100/)
  assert.match(result.stdout, /Status: needs-work/)
  assert.match(result.stdout, /## Top Actions/)
  assert.match(result.stdout, /1\. \*\*Add LICENSE\*\*/)
  assert.match(result.stdout, /2\. \*\*Add CONTRIBUTING guide\*\*/)
  assert.match(result.stdout, /3\. \*\*Add issue template\*\*/)
  assert.doesNotMatch(result.stdout, /4\. \*\*Add good first issue template\*\*/)
  assert.doesNotMatch(result.stdout, /## Checks/)
  assert.doesNotMatch(result.stdout, /\| State \| Check \| Points \| Detail \|/)
  assert.equal(result.stderr, "")
})

async function createSparseRepository(): Promise<string> {
  const repositoryRoot = await mkdtemp(join(tmpdir(), "oss-pulse-action-summary-"))
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
