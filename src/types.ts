export const REPORT_STATUSES = ["ready", "needs-work"] as const
export type ReportStatus = (typeof REPORT_STATUSES)[number]

export const OUTPUT_FORMATS = [
  "json",
  "markdown",
  "release-notes",
  "action-summary",
  "launch-post",
  "contributor-onboarding",
  "triage-suggestions",
  "sarif",
  "github-annotations",
] as const
export type OutputFormat = (typeof OUTPUT_FORMATS)[number]

export type MaintainerFiles = {
  readonly changelog: boolean
  readonly codeowners: boolean
  readonly codeOfConduct: boolean
  readonly contributing: boolean
  readonly funding: boolean
  readonly goodFirstIssueTemplate: boolean
  readonly issueTemplate: boolean
  readonly license: boolean
  readonly pullRequestTemplate: boolean
  readonly readme: boolean
  readonly releaseWorkflow: boolean
  readonly security: boolean
  readonly workflowCount: number
}

export type RepositorySignals = {
  readonly branch: string
  readonly commitsLast30Days: number
  readonly contributorsLast90Days: number
  readonly files: MaintainerFiles
  readonly latestCommitIso: string | null
  readonly root: string
}

export type CheckId =
  | "readme"
  | "license"
  | "contributing"
  | "issue-template"
  | "good-first-issue-template"
  | "pull-request-template"
  | "security"
  | "ci-workflow"
  | "release-workflow"
  | "changelog"
  | "codeowners"
  | "funding"
  | "external-contributors"
  | "code-of-conduct"
  | "recent-activity"

export type ActionId =
  | "add-readme"
  | "add-license"
  | "add-contributing-guide"
  | "add-issue-template"
  | "add-good-first-issue-template"
  | "add-pull-request-template"
  | "add-security-policy"
  | "add-ci-workflow"
  | "add-release-workflow"
  | "add-changelog"
  | "add-codeowners"
  | "add-funding"
  | "invite-contributors"
  | "add-code-of-conduct"
  | "resume-maintenance"

export type PulseCheck = {
  readonly detail: string
  readonly id: CheckId
  readonly label: string
  readonly passed: boolean
  readonly points: number
}

export type PulseAction = {
  readonly detail: string
  readonly id: ActionId
  readonly priority: "high" | "medium" | "low"
  readonly title: string
}

export type PulseReport = {
  readonly actions: readonly PulseAction[]
  readonly branch: string
  readonly checks: readonly PulseCheck[]
  readonly generatedAtIso: string
  readonly latestCommitIso: string | null
  readonly root: string
  readonly score: number
  readonly status: ReportStatus
}
