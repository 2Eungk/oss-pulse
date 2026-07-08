# oss-pulse

`oss-pulse` turns local repository maintenance signals into a small health report that works in a terminal, CI job, or GitHub step summary.

The first release is intentionally narrow: it checks whether a repository has the surfaces that help outside contributors succeed.

## Install

```bash
npm install
npm run build
node dist/cli.js scan . --format markdown
```

After the package is published:

```bash
npx --yes oss-pulse@0.1.0 scan . --format markdown
```

## CLI

```bash
oss-pulse scan [path] --format markdown
oss-pulse scan [path] --format json
oss-pulse scan [path] --format release-notes
oss-pulse scan [path] --format contributor-onboarding
oss-pulse scan [path] --format triage-suggestions
oss-pulse scan [path] --format sarif
oss-pulse scan [path] --format github-annotations
oss-pulse scan [path] --format markdown --output pulse.md
oss-pulse scan [path] --format markdown --fail-under 80
oss-pulse scan [path] --format markdown --summary-only
```

### Choose an output format

| Format | Use it when |
| --- | --- |
| `markdown` | You want a human-readable report for local review or a CI job summary. |
| `json` | Another tool needs to consume the full report programmatically. |
| `release-notes` | You want a maintainer-facing draft of recent readiness changes. |
| `contributor-onboarding` | First-time contributors need a concise map of project health and next steps. |
| `triage-suggestions` | Maintainers need prioritized issue and pull request follow-up ideas. |
| `sarif` | GitHub code scanning or another SARIF consumer should ingest the findings. |
| `github-annotations` | A GitHub Actions run should show inline warning and error annotations. |

The report includes:

- maintainer readiness score
- README, license, contribution guide, issue templates, good first issue template, security policy, CI, release workflow, changelog, funding, and activity checks
- ranked next actions
- JSON output for automation
- JSON Schema for automation consumers at `docs/report.schema.json`
- Markdown output for GitHub summaries
- release notes draft output for maintainer updates
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
npx --yes oss-pulse@0.1.0 scan . --format markdown --summary-only --fail-under 80 >> "$GITHUB_STEP_SUMMARY"
```

Release notes draft:

```bash
npx --yes oss-pulse@0.1.0 scan . --format release-notes
```

Contributor onboarding report:

```bash
npx --yes oss-pulse@0.1.0 scan . --format contributor-onboarding
```

Issue and pull request triage:

```bash
npx --yes oss-pulse@0.1.0 scan . --format triage-suggestions
```

SARIF for code scanning:

```bash
npx --yes oss-pulse@0.1.0 scan . --format sarif --output oss-pulse.sarif
```

GitHub workflow annotations:

```bash
npx --yes oss-pulse@0.1.0 scan . --format github-annotations
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
      - run: npx --yes oss-pulse@0.1.0 scan . --format markdown --summary-only --fail-under 80 >> "$GITHUB_STEP_SUMMARY"
```

Repository Action usage after publishing:

```yaml
- uses: your-org/oss-pulse@v0.1.0
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
| `format` | `markdown` | One of `markdown`, `json`, `release-notes`, `contributor-onboarding`, `triage-suggestions`, `sarif`, or `github-annotations`. |
| `fail-under` | `0` | Exit 1 when the score is below this threshold. |
| `summary-only` | `false` | Emit compact Markdown with score and next actions. |

After publishing the GitHub repository, prefer a pinned release tag for the repository Action instead of a branch name.

When `format` is `github-annotations`, the Action prints workflow commands to stdout so GitHub can render annotations in the checks UI.

## Why

Most maintainer tools wait until a project is already busy. `oss-pulse` starts earlier: it makes missing contribution paths visible before a community arrives.

This project is built for maintainers who want a practical route toward a healthier open source project and measurable public contribution history.

## Roadmap

See [ROADMAP.md](docs/ROADMAP.md) for the product path and [CONTRIBUTOR_BACKLOG.md](docs/CONTRIBUTOR_BACKLOG.md) for issues designed for first-time contributors.

For automation consumers, see [REPORT_SCHEMA.md](docs/REPORT_SCHEMA.md). For real repository examples, see [docs/examples](docs/examples/README.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Release

See [RELEASE.md](docs/RELEASE.md) for the npm and GitHub release path.
