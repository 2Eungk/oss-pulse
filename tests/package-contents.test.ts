import { strict as assert } from "node:assert"
import { execFile } from "node:child_process"
import { rm } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)

test("packed package contains only the intended public documentation", async () => {
  const root = projectRoot()
  const { stdout } = await execFileAsync("npm", ["pack", "--json"], { cwd: root })
  const packed = JSON.parse(stdout) as readonly { filename: string; files: { path: string }[] }[]
  const archive = packed[0]
  assert.ok(archive)

  try {
    const contents = archive.files.map((file) => file.path)
    for (const required of [
      "dist/cli.js",
      "README.md",
      "CHANGELOG.md",
      "LICENSE",
      "action.yml",
      "docs/REPORT_SCHEMA.md",
      "docs/report.schema.json",
      "package.json",
    ]) {
      assert.equal(contents.includes(required), true, `expected ${required} in npm package`)
    }

    for (const forbidden of [
      "docs/plans/2026-07-08-post-release-growth.md",
      "docs/CLAUDE_FOR_OSS_PLAYBOOK.md",
      "docs/CONTRIBUTOR_BACKLOG.md",
      "docs/ROADMAP.md",
      "docs/examples/README.md",
    ]) {
      assert.equal(
        contents.includes(forbidden),
        false,
        `did not expect ${forbidden} in npm package`,
      )
    }
  } finally {
    await rm(resolve(root, archive.filename), { force: true })
  }
})

function projectRoot(): string {
  const currentFile = fileURLToPath(import.meta.url)
  return resolve(dirname(currentFile), "../../..")
}
