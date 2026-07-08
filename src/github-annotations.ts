import { artifactUriForAction } from "./action-artifacts.js"
import type { PulseAction, PulseReport } from "./types.js"

type GithubAnnotationLevel = "error" | "warning" | "notice"

export function formatGithubAnnotations(report: PulseReport): string {
  const annotations = report.actions.map(formatAnnotation)
  return annotations.length === 0 ? "" : `${annotations.join("\n")}\n`
}

function formatAnnotation(action: PulseAction): string {
  const properties = [
    `file=${escapeProperty(artifactUriForAction(action.id))}`,
    "line=1",
    `title=${escapeProperty(action.title)}`,
  ].join(",")
  const message = escapeData(`${action.title}: ${action.detail}`)
  return `::${annotationLevel(action.priority)} ${properties}::${message}`
}

function annotationLevel(priority: PulseAction["priority"]): GithubAnnotationLevel {
  switch (priority) {
    case "high":
      return "error"
    case "medium":
      return "warning"
    case "low":
      return "notice"
    default:
      return assertNever(priority)
  }
}

function escapeData(value: string): string {
  return value.replaceAll("%", "%25").replaceAll("\r", "%0D").replaceAll("\n", "%0A")
}

function escapeProperty(value: string): string {
  return escapeData(value).replaceAll(":", "%3A").replaceAll(",", "%2C")
}

function assertNever(value: never): never {
  throw new Error(`unexpected annotation priority: ${value}`)
}
