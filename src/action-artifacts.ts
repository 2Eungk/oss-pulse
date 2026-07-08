import type { ActionId } from "./types.js"

export function artifactUriForAction(actionId: ActionId): string {
  switch (actionId) {
    case "add-readme":
      return "README.md"
    case "add-license":
      return "LICENSE"
    case "add-contributing-guide":
      return "CONTRIBUTING.md"
    case "add-issue-template":
      return ".github/ISSUE_TEMPLATE/bug_report.md"
    case "add-good-first-issue-template":
      return ".github/ISSUE_TEMPLATE/good_first_issue.md"
    case "add-pull-request-template":
      return ".github/PULL_REQUEST_TEMPLATE.md"
    case "add-security-policy":
      return "SECURITY.md"
    case "add-ci-workflow":
      return ".github/workflows/ci.yml"
    case "add-release-workflow":
      return ".github/workflows/release.yml"
    case "add-changelog":
      return "CHANGELOG.md"
    case "add-codeowners":
      return ".github/CODEOWNERS"
    case "add-funding":
      return ".github/FUNDING.yml"
    case "invite-contributors":
      return ".github/ISSUE_TEMPLATE/good_first_issue.md"
    case "add-code-of-conduct":
      return "CODE_OF_CONDUCT.md"
    case "resume-maintenance":
      return "README.md"
    default:
      return assertNever(actionId)
  }
}

function assertNever(value: never): never {
  throw new Error(`unexpected action id: ${value}`)
}
