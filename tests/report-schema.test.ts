import { strict as assert } from "node:assert"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { test } from "node:test"
import { CHECK_RULES } from "../src/report-rules.js"
import { REPORT_STATUSES } from "../src/types.js"

const schemaPath = resolve("docs/report.schema.json")

function readSchema(): unknown {
  return JSON.parse(readFileSync(schemaPath, "utf8"))
}

function field(object: unknown, key: string): unknown {
  assert.equal(typeof object, "object")
  assert.notEqual(object, null)
  const descriptor = Object.getOwnPropertyDescriptor(object, key)
  assert.notEqual(descriptor, undefined, `missing field ${key}`)
  return descriptor?.value
}

function enumValues(schema: unknown, defName: string): readonly unknown[] {
  const defs = field(schema, "$defs")
  const definition = field(defs, defName)
  const values = field(definition, "enum")
  if (!Array.isArray(values)) {
    throw new TypeError(`${defName} enum must be an array`)
  }
  return values
}

test("report JSON schema keeps status and check ids aligned with code", () => {
  // Given: the published machine-readable schema.
  const schema = readSchema()

  // When: the schema enums are compared with the runtime report constants.
  const checkIds = CHECK_RULES.map((rule) => rule.id)

  // Then: consumers can trust the JSON schema to match CLI output.
  assert.deepEqual(enumValues(schema, "ReportStatus"), REPORT_STATUSES)
  assert.deepEqual(enumValues(schema, "CheckId"), checkIds)
})

test("report JSON schema keeps action ids aligned with code", () => {
  // Given: every remediation action currently emitted by the rules engine.
  const schema = readSchema()

  // When: action ids are collected in their stable display order.
  const actionIds = CHECK_RULES.flatMap((rule): readonly string[] =>
    rule.action === null ? [] : [rule.action.id],
  )

  // Then: automation consumers get a complete action id enum.
  assert.deepEqual(enumValues(schema, "ActionId"), actionIds)
})
