import { strict as assert } from "node:assert"
import { execFile } from "node:child_process"
import { mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"
import { z } from "zod"

const execFileAsync = promisify(execFile)

const SarifSchema = z.object({
  $schema: z.string().url(),
  runs: z.array(
    z.object({
      results: z.array(
        z.object({
          level: z.enum(["error", "warning", "note"]),
          locations: z.array(
            z.object({
              physicalLocation: z.object({
                artifactLocation: z.object({ uri: z.string() }),
              }),
            }),
          ),
          message: z.object({ text: z.string() }),
          ruleId: z.string(),
        }),
      ),
      tool: z.object({
        driver: z.object({
          name: z.literal("oss-pulse"),
          rules: z.array(z.object({ id: z.string() })),
          semanticVersion: z.string().min(1),
        }),
      }),
    }),
  ),
  version: z.literal("2.1.0"),
})

test("CLI emits SARIF when sarif format is selected", async () => {
  // Given: a sparse repository with missing maintainer surfaces.
  const repositoryRoot = await createSparseRepository()

  // When: the CLI scans with SARIF output.
  const result = await execFileAsync(process.execPath, [
    cliPath(),
    "scan",
    repositoryRoot,
    "--format",
    "sarif",
  ])
  const sarif = SarifSchema.parse(JSON.parse(result.stdout))
  const [run] = sarif.runs
  assert.ok(run)

  // Then: missing high-priority actions become code scanning results.
  const packageJson = JSON.parse(await readFile(resolve(projectRoot(), "package.json"), "utf8"))
  assert.equal(run.tool.driver.semanticVersion, packageJson.version)
  assert.equal(run.results[0]?.ruleId, "add-license")
  assert.equal(run.results[0]?.level, "error")
  assert.equal(run.results[0]?.locations[0]?.physicalLocation.artifactLocation.uri, "LICENSE")
  assert.equal(
    run.tool.driver.rules.some((rule) => rule.id === "add-license"),
    true,
  )
  assert.equal(result.stderr, "")
})

async function createSparseRepository(): Promise<string> {
  const repositoryRoot = await mkdtemp(join(tmpdir(), "oss-pulse-sarif-"))
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

function projectRoot(): string {
  const currentFile = fileURLToPath(import.meta.url)
  return resolve(dirname(currentFile), "../../..")
}
