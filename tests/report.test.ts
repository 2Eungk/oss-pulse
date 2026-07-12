import { strict as assert } from "node:assert"
import { test } from "node:test"
import { formatMarkdown } from "../src/format.js"
import { buildReport } from "../src/report.js"
import type { RepositorySignals } from "../src/types.js"

const healthySignals: RepositorySignals = {
  branch: "main",
  commitsLast30Days: 9,
  contributorsLast90Days: 3,
  files: {
    changelog: true,
    codeowners: true,
    codeOfConduct: true,
    contributing: true,
    funding: true,
    goodFirstIssueTemplate: true,
    issueTemplate: true,
    license: true,
    pullRequestTemplate: true,
    readme: true,
    releaseWorkflow: true,
    security: true,
    workflowCount: 2,
  },
  latestCommitIso: "2026-07-08T01:00:00.000Z",
  root: "/tmp/healthy",
}

test("buildReport returns a complete pulse when every maintainer signal is present", () => {
  // Given: a repository with the core files, recent activity, and multiple Git author identities.
  const signals = healthySignals

  // When: the report is built.
  const report = buildReport(signals)

  // Then: the score is full and no corrective action is needed.
  assert.equal(report.score, 100)
  assert.deepEqual(report.actions, [])
  assert.equal(report.status, "ready")
})

test("buildReport prioritizes missing maintainer surfaces when repository hygiene is thin", () => {
  // Given: an active repository that has not yet made contribution paths explicit.
  const signals: RepositorySignals = {
    ...healthySignals,
    contributorsLast90Days: 1,
    files: {
      changelog: false,
      codeowners: false,
      codeOfConduct: false,
      contributing: false,
      funding: false,
      goodFirstIssueTemplate: false,
      issueTemplate: false,
      license: false,
      pullRequestTemplate: false,
      readme: true,
      releaseWorkflow: false,
      security: false,
      workflowCount: 0,
    },
  }

  // When: the report is built.
  const report = buildReport(signals)

  // Then: the score reflects the missing surfaces and actions are ranked by maintainer impact.
  assert.equal(report.score, 15)
  assert.deepEqual(
    report.actions.map((action) => action.id),
    [
      "add-license",
      "add-contributing-guide",
      "add-issue-template",
      "add-pull-request-template",
      "add-security-policy",
      "add-good-first-issue-template",
      "add-ci-workflow",
      "add-release-workflow",
      "add-changelog",
      "invite-contributors",
      "add-codeowners",
      "add-funding",
      "add-code-of-conduct",
    ],
  )
  assert.equal(report.status, "needs-work")
  assert.equal(
    report.checks.find((check) => check.id === "external-contributors")?.label,
    "Distinct Git author identities",
  )
  assert.equal(
    report.actions.find((action) => action.id === "invite-contributors")?.title,
    "Invite contributors",
  )
})

test("buildReport flags missing CODEOWNERS without changing the score budget", () => {
  // Given: a healthy repository that has not yet declared ownership routing.
  const signals: RepositorySignals = {
    ...healthySignals,
    files: {
      ...healthySignals.files,
      codeowners: false,
    },
  }

  // When: the report is built.
  const report = buildReport(signals)

  // Then: maintainers get a CODEOWNERS action while the 100-point score stays stable.
  assert.equal(report.score, 100)
  assert.equal(report.status, "needs-work")
  assert.deepEqual(
    report.actions.map((action) => action.id),
    ["add-codeowners"],
  )
})

test("formatMarkdown renders score, checks, and next actions for GitHub summaries", () => {
  // Given: a report with missing maintainer files.
  const report = buildReport({
    ...healthySignals,
    files: {
      ...healthySignals.files,
      contributing: false,
      security: false,
    },
  })

  // When: it is formatted for a GitHub step summary.
  const markdown = formatMarkdown(report)

  // Then: maintainers can scan the outcome without reading JSON.
  assert.match(markdown, /# OSS Pulse/)
  assert.match(markdown, /Score: 80\/100/)
  assert.match(markdown, /CONTRIBUTING/)
  assert.match(markdown, /SECURITY/)
})
