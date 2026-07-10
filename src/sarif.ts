import { pathToFileURL } from "node:url"
import { artifactUriForAction } from "./action-artifacts.js"
import { getPackageVersion } from "./package-info.js"
import type { ActionId, PulseAction, PulseReport } from "./types.js"

type SarifLevel = "error" | "warning" | "note"

type SarifMessage = {
  readonly text: string
}

type SarifArtifactLocation = {
  readonly uri: string
  readonly uriBaseId?: string
}

type SarifResult = {
  readonly level: SarifLevel
  readonly locations: readonly {
    readonly physicalLocation: {
      readonly artifactLocation: SarifArtifactLocation
      readonly region: {
        readonly startLine: number
      }
    }
  }[]
  readonly message: SarifMessage
  readonly ruleId: ActionId
}

type SarifRule = {
  readonly fullDescription: SarifMessage
  readonly help: SarifMessage
  readonly id: ActionId
  readonly name: string
  readonly shortDescription: SarifMessage
}

type SarifRun = {
  readonly originalUriBaseIds: Record<string, SarifArtifactLocation>
  readonly results: readonly SarifResult[]
  readonly tool: {
    readonly driver: {
      readonly name: "oss-pulse"
      readonly rules: readonly SarifRule[]
      readonly semanticVersion: string
    }
  }
}

type SarifLog = {
  readonly $schema: string
  readonly runs: readonly SarifRun[]
  readonly version: "2.1.0"
}

const SOURCE_ROOT_URI_BASE_ID = "%SRCROOT%"

export function formatSarif(report: PulseReport): string {
  const log: SarifLog = {
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    runs: [
      {
        originalUriBaseIds: {
          [SOURCE_ROOT_URI_BASE_ID]: { uri: rootUri(report.root) },
        },
        results: report.actions.map(formatResult),
        tool: {
          driver: {
            name: "oss-pulse",
            rules: report.actions.map(formatRule),
            semanticVersion: getPackageVersion(),
          },
        },
      },
    ],
    version: "2.1.0",
  }

  return `${JSON.stringify(log, null, 2)}\n`
}

function formatRule(action: PulseAction): SarifRule {
  return {
    fullDescription: { text: action.detail },
    help: { text: action.detail },
    id: action.id,
    name: action.title,
    shortDescription: { text: action.title },
  }
}

function formatResult(action: PulseAction): SarifResult {
  return {
    level: sarifLevel(action.priority),
    locations: [
      {
        physicalLocation: {
          artifactLocation: {
            uri: artifactUriForAction(action.id),
            uriBaseId: SOURCE_ROOT_URI_BASE_ID,
          },
          region: {
            startLine: 1,
          },
        },
      },
    ],
    message: { text: `${action.title}: ${action.detail}` },
    ruleId: action.id,
  }
}

function sarifLevel(priority: PulseAction["priority"]): SarifLevel {
  switch (priority) {
    case "high":
      return "error"
    case "medium":
      return "warning"
    case "low":
      return "note"
    default:
      return assertNever(priority)
  }
}

function rootUri(root: string): string {
  const uri = pathToFileURL(root).href
  return uri.endsWith("/") ? uri : `${uri}/`
}

function assertNever(value: never): never {
  throw new Error(`unexpected SARIF value: ${value}`)
}
