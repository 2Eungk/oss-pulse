# Report Schema

`oss-pulse scan --format json` emits one JSON object followed by a newline.

The schema is intended for CI jobs, dashboards, and repository automation that need a stable maintainer-readiness signal.

The machine-readable JSON Schema lives at [`docs/report.schema.json`](./report.schema.json). It is tested against the runtime check and action identifiers so automation consumers do not drift from CLI output.

For code scanning consumers, `oss-pulse scan --format sarif` emits a SARIF 2.1.0 log where each remediation action is represented as a SARIF result.

For GitHub Actions consumers, `oss-pulse scan --format github-annotations` emits workflow commands where high-priority actions become errors, medium-priority actions become warnings, and low-priority actions become notices.

## Top-Level Object

| Field | Type | Description |
| --- | --- | --- |
| `actions` | `PulseAction[]` | Ranked remediation actions for failed checks. Empty when `status` is `ready`. |
| `branch` | `string` | Current git branch, or `detached` when no branch name is available. |
| `checks` | `PulseCheck[]` | Every scored maintainer-readiness check in display order. |
| `generatedAtIso` | `string` | ISO timestamp for when the report was generated. |
| `latestCommitIso` | `string \| null` | ISO timestamp for the latest commit, or `null` when unavailable. |
| `root` | `string` | Absolute path to the scanned git repository root. |
| `score` | `number` | Integer score from `0` to `100`. |
| `status` | `"ready" \| "needs-work"` | `ready` only when every remediation action is cleared. |

## PulseCheck

| Field | Type | Description |
| --- | --- | --- |
| `detail` | `string` | Human-readable check detail. |
| `id` | `CheckId` | Stable machine-readable check id. |
| `label` | `string` | Short display label. |
| `passed` | `boolean` | Whether the check passed. |
| `points` | `number` | Awarded points. Failed checks always emit `0`. |

## CheckId Values

| ID | Max Points |
| --- | ---: |
| `readme` | 10 |
| `license` | 15 |
| `contributing` | 10 |
| `issue-template` | 5 |
| `good-first-issue-template` | 5 |
| `pull-request-template` | 10 |
| `security` | 10 |
| `ci-workflow` | 5 |
| `release-workflow` | 5 |
| `changelog` | 5 |
| `codeowners` | 0 |
| `funding` | 5 |
| `external-contributors` | 5 |
| `code-of-conduct` | 5 |
| `recent-activity` | 5 |

## PulseAction

| Field | Type | Description |
| --- | --- | --- |
| `detail` | `string` | Human-readable remediation detail. |
| `id` | `ActionId` | Stable machine-readable action id. |
| `priority` | `"high" \| "medium" \| "low"` | Suggested action priority. |
| `title` | `string` | Short display title. |

## ActionId Values

- `add-readme`
- `add-license`
- `add-contributing-guide`
- `add-issue-template`
- `add-good-first-issue-template`
- `add-pull-request-template`
- `add-security-policy`
- `add-ci-workflow`
- `add-release-workflow`
- `add-changelog`
- `add-codeowners`
- `add-funding`
- `invite-contributors`
- `add-code-of-conduct`
- `resume-maintenance`

## Example

```json
{
  "actions": [
    {
      "detail": "Add .github/FUNDING.yml so sponsor paths are discoverable from GitHub.",
      "id": "add-funding",
      "priority": "low",
      "title": "Add funding metadata"
    }
  ],
  "branch": "main",
  "checks": [
    {
      "detail": "README found",
      "id": "readme",
      "label": "README",
      "passed": true,
      "points": 10
    },
    {
      "detail": "No funding metadata",
      "id": "funding",
      "label": "Funding metadata",
      "passed": false,
      "points": 0
    }
  ],
  "generatedAtIso": "2026-07-08T06:30:37.183Z",
  "latestCommitIso": null,
  "root": "/path/to/repository",
  "score": 85,
  "status": "needs-work"
}
```
