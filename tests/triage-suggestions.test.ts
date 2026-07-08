import { strict as assert } from "node:assert"
import { execFile } from "node:child_process"
import { mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)

test("CLI emits triage suggestions when triage-suggestions format is selected", async () => {
  // Given: a sparse repository with maintainer gaps to triage.
  const repositoryRoot = await createSparseRepository()

  // When: the CLI scans with the triage suggestions format.
  const result = await execFileAsync(process.execPath, [
    cliPath(),
    "scan",
    repositoryRoot,
    "--format",
    "triage-suggestions",
  ])

  // Then: the output gives issue and pull request triage guidance.
  assert.match(result.stdout, /# Triage Suggestions/)
  assert.match(result.stdout, /OSS Pulse score: 15\/100/)
  assert.match(result.stdout, /## Issue Triage/)
  assert.match(result.stdout, /Open high-priority issue: Add LICENSE/)
  assert.match(result.stdout, /## Pull Request Triage/)
  assert.match(result.stdout, /Ask contributors to include the command they ran./)
  assert.equal(result.stderr, "")
})

async function createSparseRepository(): Promise<string> {
  const repositoryRoot = await mkdtemp(join(tmpdir(), "oss-pulse-triage-"))
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
