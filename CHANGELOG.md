# Changelog

## Unreleased

- Fixed CLI and SARIF version reporting so both read from `package.json` instead of stale hardcoded values.
- Updated paste-ready README and launch-copy examples to use `oss-pulse@latest`.
- Ranked remediation actions by priority while preserving rule order within each priority.
- Rejected configuration-only issue-template directories and added controlled output-file errors.
- Renamed contributor activity copy so distinct git authors are not misreported as verified external contributors.
- Fixed the composite Action example to check out the target repository and pin an existing release tag.
- Added least-privilege CodeQL analysis and pinned workflow Actions to immutable commit SHAs.

## 0.1.5 - 2026-07-09

- Added `--format launch-post` for paste-ready vibe-coder launch posts.
- Sharpened README and launch-copy docs around the vibe-coder preflight use case.

## 0.1.0 - 2026-07-08

Initial public release.

- Added `oss-pulse scan` for local git repository health reports.
- Added Markdown and JSON output formats.
- Added maintainer readiness checks for README, license, contribution guide, issue and pull request templates, security policy, CI workflow, release workflow, changelog, funding metadata, contributor activity, code of conduct, and recent commits.
- Added `--fail-under <score>` for CI score gates.
- Added `--summary-only` for compact Markdown summaries.
- Added GitHub Actions usage docs and composite action metadata.
- Added strict TypeScript checks, Biome linting, and Node CLI tests.
- Improved unsupported format errors with the accepted `json` and `markdown` values.
- Added README examples for local audits and GitHub pull request summaries.
- Added JSON report schema documentation for automation consumers.
- Added fixture-based integration tests for complete, sparse, and nested repository scans.
- Added public repository case studies for `octocat/Hello-World` and `sindresorhus/is`.
- Added good first issue template detection for starter contribution readiness.
- Split report scoring rules out of the report builder to keep the core report assembly small.
- Added `--format release-notes` for paste-ready maintainer release note drafts.
- Added `--format contributor-onboarding` for first-time contributor guidance.
- Added `--format triage-suggestions` for issue and pull request triage guidance.
- Hardened GitHub Action metadata and README input documentation.
- Added `--format sarif` for GitHub code scanning and security dashboard integrations.
- Added `--format github-annotations` for GitHub workflow annotations in CI logs.
