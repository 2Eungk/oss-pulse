import { strict as assert } from "node:assert"
import { readFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import { OUTPUT_FORMATS } from "../src/types.js"

test("GitHub Action metadata documents supported formats and safe path forwarding", async () => {
  // Given: the repository Action metadata is the public GitHub Action contract.
  const metadata = await readFile(actionPath(), "utf8")

  // When: supported output formats are exposed through the composite Action.
  const missingFormats = OUTPUT_FORMATS.filter((format) => !metadata.includes(format))

  // Then: every CLI format is documented and the path input is passed after `--`.
  assert.deepEqual(missingFormats, [])
  assert.equal(metadata.includes("  path:\n    description: Repository path to scan."), true)
  assert.match(metadata, /args\+=\(-- "\$OSS_PULSE_PATH"\)/)
  assert.match(metadata, /if \[ "\$OSS_PULSE_FORMAT" = "github-annotations" \]/)
  assert.match(metadata, /node "\$OSS_PULSE_ACTION_PATH\/dist\/cli\.js" "\$\{args\[@\]\}"/)
})

function actionPath(): string {
  const currentFile = fileURLToPath(import.meta.url)
  return resolve(dirname(currentFile), "../../../action.yml")
}
