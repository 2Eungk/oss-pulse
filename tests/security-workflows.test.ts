import { strict as assert } from "node:assert"
import { readFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const CHECKOUT_SHA = "93cb6efe18208431cddfb8368fd83d5badbf9bfd"
const SETUP_NODE_SHA = "a0853c24544627f65ddf259abe73b1d18a591444"
const CODEQL_SHA = "99df26d4f13ea111d4ec1a7dddef6063f76b97e9"

test("workflows pin third-party Actions to immutable commit SHAs", async () => {
  const workflows = await Promise.all([
    readWorkflow("ci.yml"),
    readWorkflow("release.yml"),
    readWorkflow("codeql.yml"),
  ])
  const combined = workflows.join("\n")

  assert.match(combined, new RegExp(`actions/checkout@${CHECKOUT_SHA}`))
  assert.match(combined, new RegExp(`actions/setup-node@${SETUP_NODE_SHA}`))
  assert.match(combined, new RegExp(`github/codeql-action/init@${CODEQL_SHA}`))
  assert.match(combined, new RegExp(`github/codeql-action/analyze@${CODEQL_SHA}`))
  assert.doesNotMatch(combined, /uses:\s+[^\s]+@v\d+(?:\s|$)/)
})

test("CodeQL uses exactly the permissions required for analysis and SARIF upload", async () => {
  const workflow = await readWorkflow("codeql.yml")

  const permissions = workflow.match(/permissions:\n((?: {2}[^\n]+\n)+)\n/)?.[1]
  assert.equal(permissions, "  contents: read\n  security-events: write\n")
  assert.match(workflow, /languages: javascript-typescript/)
})

async function readWorkflow(name: string): Promise<string> {
  return readFile(resolve(projectRoot(), ".github/workflows", name), "utf8")
}

function projectRoot(): string {
  const currentFile = fileURLToPath(import.meta.url)
  return resolve(dirname(currentFile), "../../..")
}
