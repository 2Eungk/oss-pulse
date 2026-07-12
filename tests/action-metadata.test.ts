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
  assert.match(metadata, /run: npm ci --ignore-scripts/)
  assert.match(metadata, /run: \.\/node_modules\/\.bin\/tsc -p tsconfig\.build\.json/)
  assert.doesNotMatch(metadata, /npm ci\s*&&/)
  assert.doesNotMatch(metadata, /npm run build/)
})

test("README Action examples use immutable commit pins with version comments", async () => {
  const readme = await readFile(resolve(projectRoot(), "README.md"), "utf8")
  const actionExample = readme.slice(
    readme.indexOf("Repository Action usage"),
    readme.indexOf("Action inputs:"),
  )

  assert.match(
    actionExample,
    /uses: actions\/checkout@93cb6efe18208431cddfb8368fd83d5badbf9bfd # v5/,
  )
  assert.match(actionExample, /fetch-depth: 0/)
  assert.match(
    actionExample,
    /uses: 2Eungk\/oss-pulse@2a896480d335697a77bb27c48298878d4dfb638e # v0\.1\.4/,
  )
  assert.doesNotMatch(actionExample, /uses: [^\s]+@v\d+/)
})

function actionPath(): string {
  return resolve(projectRoot(), "action.yml")
}

function projectRoot(): string {
  const currentFile = fileURLToPath(import.meta.url)
  return resolve(dirname(currentFile), "../../..")
}
