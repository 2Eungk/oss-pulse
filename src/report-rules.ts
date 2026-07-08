import type { ActionId, CheckId, PulseAction, RepositorySignals } from "./types.js"

type CheckRule = {
  readonly action: PulseAction | null
  readonly detail: (signals: RepositorySignals) => string
  readonly id: CheckId
  readonly label: string
  readonly passed: (signals: RepositorySignals) => boolean
  readonly points: number
}

const ACTIONS: Record<ActionId, PulseAction> = {
  "add-ci-workflow": {
    detail: "Add a minimal CI workflow so contributors can trust the project gate.",
    id: "add-ci-workflow",
    priority: "medium",
    title: "Add CI workflow",
  },
  "add-changelog": {
    detail: "Add CHANGELOG.md so users and contributors can follow release impact.",
    id: "add-changelog",
    priority: "medium",
    title: "Add CHANGELOG",
  },
  "add-code-of-conduct": {
    detail: "Add a code of conduct so contribution norms are explicit before growth.",
    id: "add-code-of-conduct",
    priority: "low",
    title: "Add CODE_OF_CONDUCT",
  },
  "add-codeowners": {
    detail: "Add CODEOWNERS so review routing is explicit before contributor volume grows.",
    id: "add-codeowners",
    priority: "low",
    title: "Add CODEOWNERS",
  },
  "add-contributing-guide": {
    detail: "Explain setup, test commands, PR expectations, and good first issue flow.",
    id: "add-contributing-guide",
    priority: "high",
    title: "Add CONTRIBUTING guide",
  },
  "add-funding": {
    detail: "Add .github/FUNDING.yml so sponsor paths are discoverable from GitHub.",
    id: "add-funding",
    priority: "low",
    title: "Add funding metadata",
  },
  "add-good-first-issue-template": {
    detail: "Add a good first issue template so maintainers can publish starter work quickly.",
    id: "add-good-first-issue-template",
    priority: "medium",
    title: "Add good first issue template",
  },
  "add-issue-template": {
    detail: "Add an issue template that asks for reproduction steps and expected behavior.",
    id: "add-issue-template",
    priority: "high",
    title: "Add issue template",
  },
  "add-license": {
    detail: "Add an OSI-approved license so downstream users can legally adopt the project.",
    id: "add-license",
    priority: "high",
    title: "Add LICENSE",
  },
  "add-pull-request-template": {
    detail: "Add a PR template covering intent, tests, and release-note impact.",
    id: "add-pull-request-template",
    priority: "high",
    title: "Add pull request template",
  },
  "add-readme": {
    detail: "Add a README with install, quick start, and contribution links.",
    id: "add-readme",
    priority: "high",
    title: "Add README",
  },
  "add-release-workflow": {
    detail: "Add a release or publish workflow so tagged releases are repeatable.",
    id: "add-release-workflow",
    priority: "medium",
    title: "Add release workflow",
  },
  "add-security-policy": {
    detail: "Add SECURITY.md so vulnerability reports have a private intake path.",
    id: "add-security-policy",
    priority: "high",
    title: "Add SECURITY policy",
  },
  "invite-contributors": {
    detail: "Create starter issues and invite external contributors into small, reviewable work.",
    id: "invite-contributors",
    priority: "medium",
    title: "Grow external contributors",
  },
  "resume-maintenance": {
    detail: "Land a small maintenance commit so visitors can see active stewardship.",
    id: "resume-maintenance",
    priority: "medium",
    title: "Resume visible maintenance",
  },
}

export const CHECK_RULES: readonly CheckRule[] = [
  {
    action: ACTIONS["add-readme"],
    detail: (signals) => (signals.files.readme ? "README found" : "README missing"),
    id: "readme",
    label: "README",
    passed: (signals) => signals.files.readme,
    points: 10,
  },
  {
    action: ACTIONS["add-license"],
    detail: (signals) => (signals.files.license ? "LICENSE found" : "LICENSE missing"),
    id: "license",
    label: "License",
    passed: (signals) => signals.files.license,
    points: 15,
  },
  {
    action: ACTIONS["add-contributing-guide"],
    detail: (signals) =>
      signals.files.contributing ? "CONTRIBUTING guide found" : "CONTRIBUTING guide missing",
    id: "contributing",
    label: "Contribution guide",
    passed: (signals) => signals.files.contributing,
    points: 10,
  },
  {
    action: ACTIONS["add-issue-template"],
    detail: (signals) =>
      signals.files.issueTemplate ? "Issue template found" : "No issue template",
    id: "issue-template",
    label: "Issue template",
    passed: (signals) => signals.files.issueTemplate,
    points: 5,
  },
  {
    action: ACTIONS["add-good-first-issue-template"],
    detail: (signals) =>
      signals.files.goodFirstIssueTemplate
        ? "Good first issue template found"
        : "No good first issue template",
    id: "good-first-issue-template",
    label: "Good first issue template",
    passed: (signals) => signals.files.goodFirstIssueTemplate,
    points: 5,
  },
  {
    action: ACTIONS["add-pull-request-template"],
    detail: (signals) =>
      signals.files.pullRequestTemplate
        ? "Pull request template found"
        : "No pull request template",
    id: "pull-request-template",
    label: "Pull request template",
    passed: (signals) => signals.files.pullRequestTemplate,
    points: 10,
  },
  {
    action: ACTIONS["add-security-policy"],
    detail: (signals) =>
      signals.files.security ? "SECURITY policy found" : "SECURITY policy missing",
    id: "security",
    label: "Security policy",
    passed: (signals) => signals.files.security,
    points: 10,
  },
  {
    action: ACTIONS["add-ci-workflow"],
    detail: (signals) =>
      signals.files.workflowCount > 0
        ? `${signals.files.workflowCount} workflow file(s) found`
        : "No workflow files found",
    id: "ci-workflow",
    label: "CI workflow",
    passed: (signals) => signals.files.workflowCount > 0,
    points: 5,
  },
  {
    action: ACTIONS["add-release-workflow"],
    detail: (signals) =>
      signals.files.releaseWorkflow ? "Release workflow found" : "No release workflow",
    id: "release-workflow",
    label: "Release workflow",
    passed: (signals) => signals.files.releaseWorkflow,
    points: 5,
  },
  {
    action: ACTIONS["add-changelog"],
    detail: (signals) => (signals.files.changelog ? "CHANGELOG found" : "CHANGELOG missing"),
    id: "changelog",
    label: "Changelog",
    passed: (signals) => signals.files.changelog,
    points: 5,
  },
  {
    action: ACTIONS["add-codeowners"],
    detail: (signals) => (signals.files.codeowners ? "CODEOWNERS found" : "CODEOWNERS missing"),
    id: "codeowners",
    label: "CODEOWNERS",
    passed: (signals) => signals.files.codeowners,
    points: 0,
  },
  {
    action: ACTIONS["add-funding"],
    detail: (signals) => (signals.files.funding ? "Funding metadata found" : "No funding metadata"),
    id: "funding",
    label: "Funding metadata",
    passed: (signals) => signals.files.funding,
    points: 5,
  },
  {
    action: ACTIONS["invite-contributors"],
    detail: (signals) => `${signals.contributorsLast90Days} contributor(s) in the last 90 days`,
    id: "external-contributors",
    label: "Contributor activity",
    passed: (signals) => signals.contributorsLast90Days >= 2,
    points: 5,
  },
  {
    action: ACTIONS["add-code-of-conduct"],
    detail: (signals) =>
      signals.files.codeOfConduct ? "Code of conduct found" : "Code of conduct missing",
    id: "code-of-conduct",
    label: "Code of conduct",
    passed: (signals) => signals.files.codeOfConduct,
    points: 5,
  },
  {
    action: ACTIONS["resume-maintenance"],
    detail: (signals) => `${signals.commitsLast30Days} commit(s) in the last 30 days`,
    id: "recent-activity",
    label: "Recent activity",
    passed: (signals) => signals.commitsLast30Days > 0,
    points: 5,
  },
]
