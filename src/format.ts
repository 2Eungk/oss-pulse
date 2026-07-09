import type { PulseReport } from "./types.js"

export function formatJson(report: PulseReport): string {
  return `${JSON.stringify(report, null, 2)}\n`
}

export function formatMarkdown(report: PulseReport): string {
  const checkRows = report.checks
    .map(
      (check) =>
        `| ${check.passed ? "pass" : "fix"} | ${escapeCell(check.label)} | ${check.points} | ${escapeCell(check.detail)} |`,
    )
    .join("\n")
  const actions = report.actions.length === 0 ? "No next actions." : formatActions(report)

  return [
    "# OSS Pulse",
    "",
    `Score: ${report.score}/100`,
    `Status: ${report.status}`,
    `Branch: ${report.branch}`,
    `Latest commit: ${report.latestCommitIso ?? "unknown"}`,
    "",
    "## Checks",
    "",
    "| State | Check | Points | Detail |",
    "| --- | --- | ---: | --- |",
    checkRows,
    "",
    "## Next Actions",
    "",
    actions,
    "",
  ].join("\n")
}

export function formatMarkdownSummary(report: PulseReport): string {
  const actions = report.actions.length === 0 ? "No next actions." : formatActions(report)

  return [
    "# OSS Pulse",
    "",
    `Score: ${report.score}/100`,
    `Status: ${report.status}`,
    "",
    "## Next Actions",
    "",
    actions,
    "",
  ].join("\n")
}

export function formatActionSummary(report: PulseReport): string {
  const actions =
    report.actions.length === 0
      ? "No next actions."
      : report.actions
          .slice(0, 3)
          .map(
            (action, index) =>
              `${index + 1}. **${escapeText(action.title)}** (${action.priority}) - ${escapeText(action.detail)}`,
          )
          .join("\n")

  return [
    "# OSS Pulse Action Summary",
    "",
    `Score: ${report.score}/100`,
    `Status: ${report.status}`,
    "",
    "## Top Actions",
    "",
    actions,
    "",
  ].join("\n")
}

export function formatLaunchPost(report: PulseReport): string {
  const readyChecks = report.checks
    .filter((check) => check.passed)
    .slice(0, 6)
    .map((check) => `- ${escapeText(check.label)}`)
    .join("\n")
  const tightening =
    report.actions.length === 0
      ? "- Nothing obvious. The repo looks ready to share."
      : report.actions
          .slice(0, 3)
          .map((action) => `- ${escapeText(action.title)} — ${escapeText(action.detail)}`)
          .join("\n")

  return [
    "# Launch Post Draft",
    "",
    "I vibe-coded a small open source tool and ran `oss-pulse` before sharing the repo.",
    "",
    `Readiness score: ${report.score}/100 (${report.status})`,
    "",
    "Run it on your repo:",
    "",
    "```bash",
    "npx --yes oss-pulse@latest scan . --format launch-post",
    "```",
    "",
    "## What looks ready",
    "",
    readyChecks || "- No maintainer surfaces are ready yet.",
    "",
    "## Still tightening",
    "",
    tightening,
    "",
    "Feedback welcome from maintainers: what would you check before inviting outside contributors?",
    "",
  ].join("\n")
}

export function formatReleaseNotes(report: PulseReport): string {
  const verifiedChecks = report.checks
    .filter((check) => check.passed)
    .map((check) => `- ${escapeText(check.label)}`)
    .join("\n")
  const actions = report.actions.length === 0 ? "No follow-up actions." : formatActions(report)

  return [
    "# Release Notes Draft",
    "",
    "## Maintenance",
    "",
    `OSS Pulse score: ${report.score}/100 (${report.status})`,
    "",
    "## Verified Maintainer Surfaces",
    "",
    verifiedChecks || "No verified surfaces yet.",
    "",
    "## Follow-Up Actions",
    "",
    actions,
    "",
  ].join("\n")
}

export function formatContributorOnboarding(report: PulseReport): string {
  const availableSurfaces = report.checks
    .filter((check) => check.passed)
    .map((check) => `- ${escapeText(check.label)}`)
    .join("\n")
  const actions =
    report.actions.length === 0 ? "No maintainer follow-up actions." : formatActions(report)

  return [
    "# Contributor Onboarding Report",
    "",
    `OSS Pulse score: ${report.score}/100 (${report.status})`,
    "",
    "## Available Now",
    "",
    availableSurfaces || "No contributor surfaces are ready yet.",
    "",
    "## Maintainer Follow-Up",
    "",
    actions,
    "",
    "## First PR Checklist",
    "",
    "- Read the available project documentation.",
    "- Pick a small issue or ask for a starter task.",
    "- Include the command you ran when opening a pull request.",
    "",
  ].join("\n")
}

export function formatTriageSuggestions(report: PulseReport): string {
  const issueSuggestions =
    report.actions.length === 0
      ? "No issue triage suggestions."
      : report.actions
          .map(
            (action) =>
              `- Open ${action.priority}-priority issue: ${escapeText(action.title)} - ${escapeText(action.detail)}`,
          )
          .join("\n")

  return [
    "# Triage Suggestions",
    "",
    `OSS Pulse score: ${report.score}/100 (${report.status})`,
    "",
    "## Issue Triage",
    "",
    issueSuggestions,
    "",
    "## Pull Request Triage",
    "",
    "- Prioritize pull requests that close high-priority maintainer readiness gaps.",
    "- Ask contributors to include the command they ran.",
    "- Keep review scope tied to one OSS Pulse action or one small documentation surface.",
    "",
  ].join("\n")
}

function formatActions(report: PulseReport): string {
  return report.actions
    .map(
      (action, index) =>
        `${index + 1}. **${escapeText(action.title)}** (${action.priority}) - ${escapeText(action.detail)}`,
    )
    .join("\n")
}

function escapeCell(value: string): string {
  return escapeText(value).replaceAll("|", "\\|")
}

function escapeText(value: string): string {
  return value.replaceAll("\n", " ")
}
