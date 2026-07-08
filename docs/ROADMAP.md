# Roadmap

`oss-pulse` should stay small enough for maintainers to trust, but useful enough that real projects run it in CI.

## 0.1.x

- keep the repository health report stable
- ship and harden `--fail-under <score>` for CI gates
- ship and harden `--summary-only` for compact GitHub summaries
- ship and harden detector coverage for funding, changelog, and release workflow files
- ship and harden good-first-issue template detection
- ship and harden release notes draft output
- ship and harden contributor onboarding output
- ship and harden issue and pull request triage suggestions
- ship and harden SARIF output for code scanning integrations
- ship and harden GitHub workflow annotations for CI surfaces
- ship and harden error messages and GitHub Action documentation
- ship and harden JSON Schema documentation for report consumers
- add examples from real open source repositories
- keep contributor-facing issues small and reviewable

## 0.2.0

- publish a repository Action tag after npm publication

## Later

- support hosted GitHub repository scans
- provide a web report renderer
- collect anonymized benchmark examples only with explicit opt-in
