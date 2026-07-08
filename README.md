# oss-pulse

You vibe-coded a repo. Before you drop the GitHub link, run one command:

```bash
npx --yes oss-pulse@0.1.4 scan . --format action-summary
```

`oss-pulse` checks whether your project looks ready for real outside contributors: license, contributing guide, issue templates, security policy, CI, changelog, release workflow, and clear next actions.

It is not a giant code-quality scanner. It is a small preflight check for the awkward moment after “it works on my machine” and before “please star my repo.”

```txt
# OSS Pulse Action Summary

Score: 95/100
Status: needs-work

## Top Actions

1. **Grow external contributors** (medium) - Create starter issues and invite external contributors into small, reviewable work.
```

## Quick start

```bash
npx --yes oss-pulse@0.1.4 scan . --format markdown
```

Local development:

```bash
npm install
npm run build
node dist/cli.js scan . --format markdown
```

## CLI

```bash
oss-pulse scan [path] --format markdown
oss-pulse scan [path] --format json
oss-pulse scan [path] --format release-notes
oss-pulse scan [path] --format action-summary
oss-pulse scan [path] --format launch-post
oss-pulse scan [path] --format contributor-onboarding
oss-pulse scan [path] --format triage-suggestions
oss-pulse scan [path] --format sarif
oss-pulse scan [path] --format github-annotations
oss-pulse scan [path] --format markdown --output pulse.md
oss-pulse scan [path] --format markdown --fail-under 80
oss-pulse scan [path] --format markdown --summary-only
```

Choose the output format by audience:

| Format | Use it when you need |
| --- | --- |
| `markdown` | A readable maintainer report for terminals, PR summaries, or `GITHUB_STEP_SUMMARY`. |
| `json` | Stable machine-readable output for dashboards, scripts, or repository automation. |
| `release-notes` | A first draft of release notes from current readiness signals. |
| `action-summary` | Compact Markdown for GitHub step summaries with score, status, and the top three actions. |
| `launch-post` | Paste-ready launch post for vibe-coded projects that need maintainer feedback. |
| `contributor-onboarding` | A contributor-facing checklist for setup and first contribution paths. |
| `triage-suggestions` | Maintainer prompts for turning missing surfaces into issues or review tasks. |
| `sarif` | GitHub code scanning or security dashboard ingestion. |
| `github-annotations` | CI annotations that surface high/medium/low remediation actions directly in checks. |

The report includes:

- maintainer readiness score
- README, license, contribution guide, issue templates, good first issue template, security policy, CI, release workflow, changelog, funding, and activity checks
- ranked next actions
- JSON output for automation
- JSON Schema for automation consumers at `docs/report.schema.json`
- Markdown output for GitHub summaries
- release notes draft output for maintainer updates
- Action-focused summary output for compact GitHub step summaries
- contributor onboarding output for first-time contributors
- triage suggestions for issue queues and pull request review
- SARIF output for GitHub code scanning and security dashboards
- GitHub workflow annotations for visible CI warnings and errors
- optional CI failure when score is below `--fail-under`
- compact Markdown output with `--summary-only`

## Examples

Local pre-release audit:

```bash
npm run build
node dist/cli.js scan . --format markdown --fail-under 80
```

Pull request summary gate:

```bash
npx --yes oss-pulse@0.1.4 scan . --format markdown --summary-only --fail-under 80 >> "$GITHUB_STEP_SUMMARY"
```

Release notes draft:

```bash
npx --yes oss-pulse@0.1.4 scan . --format release-notes
```

Action-focused summary:

```bash
npx --yes oss-pulse@0.1.4 scan . --format action-summary
```

Launch post draft:

```bash
npx --yes oss-pulse@0.1.4 scan . --format launch-post
```

Contributor onboarding report:

```bash
npx --yes oss-pulse@0.1.4 scan . --format contributor-onboarding
```

Issue and pull request triage:

```bash
npx --yes oss-pulse@0.1.4 scan . --format triage-suggestions
```

SARIF for code scanning:

```bash
npx --yes oss-pulse@0.1.4 scan . --format sarif --output oss-pulse.sarif
```

GitHub workflow annotations:

```bash
npx --yes oss-pulse@0.1.4 scan . --format github-annotations
```

## GitHub Actions

```yaml
name: OSS Pulse

on:
  pull_request:
  workflow_dispatch:

jobs:
  pulse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
        with:
          fetch-depth: 0
      - run: npx --yes oss-pulse@0.1.4 scan . --format markdown --summary-only --fail-under 80 >> "$GITHUB_STEP_SUMMARY"
```

Repository Action usage with a pinned release tag:

```yaml
- uses: 2Eungk/oss-pulse@v0.1.4
  with:
    path: "."
    format: markdown
    fail-under: "80"
    summary-only: "true"
```

Action inputs:

| Input | Default | Description |
| --- | --- | --- |
| `path` | `.` | Repository path to scan. |
| `format` | `markdown` | One of `markdown`, `json`, `release-notes`, `action-summary`, `launch-post`, `contributor-onboarding`, `triage-suggestions`, `sarif`, or `github-annotations`. |
| `fail-under` | `0` | Exit 1 when the score is below this threshold. |
| `summary-only` | `false` | Emit compact Markdown with score and next actions. |

Prefer a pinned release tag for the repository Action instead of a branch name.

When `format` is `github-annotations`, the Action prints workflow commands to stdout so GitHub can render annotations in the checks UI.

## Why

A lot of small OSS launches fail in the same boring way: the code is there, but a stranger cannot tell how to help.

`oss-pulse` checks that boring layer before you promote the repo. It nudges you toward the files and workflows people expect when they open a first PR: license, contribution path, issue templates, security contact, CI, changelog, release workflow, and starter issues.

Use it when you just turned a vibe-coded prototype into a public project and want the repo to feel maintained, not abandoned five minutes after launch.

## Roadmap

See [ROADMAP.md](docs/ROADMAP.md) for the product path, [CONTRIBUTOR_BACKLOG.md](docs/CONTRIBUTOR_BACKLOG.md) for issues designed for first-time contributors, and [VIBE_CODER_LAUNCH_COPY.md](docs/VIBE_CODER_LAUNCH_COPY.md) for launch copy.

For automation consumers, see [REPORT_SCHEMA.md](docs/REPORT_SCHEMA.md). For real repository examples, see [docs/examples](docs/examples/README.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Release

See [RELEASE.md](docs/RELEASE.md) for the npm and GitHub release path.
