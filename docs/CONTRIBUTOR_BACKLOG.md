# Contributor Backlog

This backlog is designed to help outside contributors land small pull requests quickly.

## Good First Issues

Starter issues are clear for the current release. Add the next batch from the roadmap.

## Shipped

1. Add `--fail-under <score>` for CI.
   - Shipped in `0.1.0`.
   - The CLI exits `1` when score is below the threshold and `0` otherwise.

2. Add `--summary-only` Markdown output.
   - Shipped in `0.1.0`.
   - The output includes score and next actions without the full checks table.

3. Add `CHANGELOG.md` detection to the maintainer file checks.
   - Shipped in `0.1.0`.
   - A repository with `CHANGELOG.md` gets a passing changelog check.

4. Add `FUNDING.yml` detection.
   - Shipped in `0.1.0`.
   - `.github/FUNDING.yml` appears in the JSON checks.

5. Add release workflow detection.
   - Shipped in `0.1.0`.
   - Acceptance: repositories with `.github/workflows/release.yml` receive a release-readiness check.

6. Improve unsupported format errors.
   - Shipped in `0.1.0`.
   - `--format xml` suggests the accepted output formats.

7. Add feature request examples to the README.
   - Shipped in `0.1.0`.
   - README shows one CLI use case and one GitHub Action use case.

8. Add JSON schema documentation.
   - Shipped in `0.1.0`.
   - `docs/REPORT_SCHEMA.md` describes every report field and example values.

9. Add fixture-based integration tests.
   - Shipped in `0.1.0`.
   - Test fixtures cover a complete repo, a sparse repo, and a nested package path.

10. Add real repository case studies.
    - Shipped in `0.1.0`.
    - `docs/examples/` contains before-after reports for two public repos.

11. Add good first issue template detection.
    - Shipped in `0.1.0`.
    - Repositories with `.github/ISSUE_TEMPLATE/good_first_issue.md` receive starter contribution readiness points.

12. Add release notes draft output.
    - Shipped in `0.1.0`.
    - `--format release-notes` emits a paste-ready Markdown draft with score, verified surfaces, and follow-up actions.

13. Add contributor onboarding report.
    - Shipped in `0.1.0`.
    - `--format contributor-onboarding` emits available surfaces, maintainer follow-up actions, and a first PR checklist.

14. Add issue and pull request triage suggestions.
    - Shipped in `0.1.0`.
    - `--format triage-suggestions` emits issue triage and pull request review guidance.

15. Harden GitHub Action metadata and README usage.
    - Shipped in `0.1.0`.
    - `action.yml` documents every supported output format and README lists Action inputs.

16. Add SARIF output.
    - Shipped in `0.1.0`.
    - `--format sarif` emits SARIF 2.1.0 results for missing maintainer surfaces.

17. Add GitHub workflow annotations.
    - Shipped in `0.1.0`.
    - `--format github-annotations` emits `::error`, `::warning`, and `::notice` commands for GitHub Actions.

18. Add machine-readable JSON Schema documentation.
    - Shipped in `0.1.0`.
    - `docs/report.schema.json` describes `--format json` output and is tested against runtime ids.

## Help Wanted

Help wanted issues are clear for the current release. Add the next batch from the roadmap.

## Maintainer Routine

- Keep issues under one focused behavior.
- Label starter issues with `good first issue`.
- Ask contributors to include the command they ran.
- Prefer small pull requests over broad refactors.
- Close stale ideas gently and point to the roadmap.
