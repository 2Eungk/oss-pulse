# oss-pulse Post-Release Growth Implementation Plan

> **For Hermes:** Use this as the autonomous execution contract for low-risk code/docs iterations. Continue in verified batches; stop before destructive/account/security-sensitive steps.

**Goal:** Turn the freshly published `oss-pulse@0.1.2` into a more credible OSS maintainer tool by improving checks, docs, contributor surfaces, and release automation safety.

**Architecture:** Keep the CLI small and rule-driven. New readiness signals should flow through `src/git.ts` signals, `src/report-rules.ts` scoring/actions, `src/report.ts` report assembly, and existing formatters/schema/tests without adding dependencies.

**Tech Stack:** TypeScript, Node >=20, commander, zod, node:test, Biome, GitHub Actions, npm.

---

## Dated Handoff Snapshot — 2026-07-08

Re-check before using this snapshot:

```bash
git status --short --branch
git log --oneline -5
npm view oss-pulse version dist-tags.latest
```

Known at plan creation:

- GitHub repo: `https://github.com/2Eungk/oss-pulse`
- Latest npm version: `oss-pulse@0.1.2`
- CI on `main`: passing
- Self-scan score: `95/100`, remaining next action is external contributor growth
- Starter issues exist: #1 CODEOWNERS check, #2 docs-ready fixture, #3 output format docs

## Autonomous Permission Boundary

Hermes may proceed without asking for:

- Local source, test, and docs edits inside this repo
- Deterministic lint/type/test/build/package checks
- Git commits and pushes to `main` for small reversible batches
- GitHub issue updates/comments that document completed work
- npm patch publishes when the version bump is necessary to fix a verified published-package bug or ship a completed small feature
- GitHub releases that match an already published npm patch version

Hermes must stop and ask before:

- Adding or exposing secrets/tokens
- Changing npm/GitHub account security settings
- Deleting packages, repos, tags, or releases
- Paid services, new external integrations, or irreversible deploys
- Major product-direction changes or legal/security claims

## Phase 1 — Credibility Checks

### Task 1: Add CODEOWNERS readiness signal

**Objective:** Close issue #1 by detecting `.github/CODEOWNERS`, `CODEOWNERS`, or `docs/CODEOWNERS` and adding a stable `codeowners` check/action.

**Files:**
- Modify: `src/git.ts`
- Modify: `src/types.ts`
- Modify: `src/report-rules.ts`
- Modify: `src/report.ts` if needed
- Modify: `docs/report.schema.json`
- Modify: `docs/REPORT_SCHEMA.md`
- Test: existing CLI/report fixture tests plus schema test

**Steps:**
1. Add a failing fixture test for present/missing CODEOWNERS.
2. Add `hasCodeowners` or equivalent repository signal.
3. Add `codeowners` check id and `add-codeowners` action id.
4. Update schema enum and docs.
5. Run `npm run check && npm run build && npm pack --dry-run && git diff --check`.
6. Commit and push.

### Task 2: Add docs-ready but CI-missing fixture

**Objective:** Close issue #2 by documenting score/action behavior for repositories with docs but no workflows.

**Files:**
- Modify: `tests/report.test.ts` or relevant fixture tests

**Steps:**
1. Add fixture for docs surfaces present but CI/release missing.
2. Assert score and next actions.
3. Run targeted test then full check.
4. Commit and push.

### Task 3: Improve output-format README table

**Objective:** Close issue #3 by adding a concise format chooser table.

**Files:**
- Modify: `README.md`

**Steps:**
1. Add table mapping each output format to use case.
2. Keep examples concise.
3. Run docs-inclusive checks.
4. Commit and push.

## Phase 2 — Adoption Proof

### Task 4: Add example reports for well-known public repos

**Objective:** Show real usage output without claiming endorsement.

**Files:**
- Create/modify: `docs/examples/`
- Modify: `README.md`

**Steps:**
1. Generate or refresh examples using public repositories.
2. Mark examples as illustrative snapshots.
3. Link them from README.
4. Verify docs and package contents.

### Task 5: Add GitHub Action marketplace polish

**Objective:** Make `action.yml` and README clearer for users installing via Actions.

**Files:**
- Modify: `action.yml`
- Modify: `README.md`

**Steps:**
1. Check `action.yml` branding, inputs, outputs.
2. Add minimal copy for PR summary gates.
3. Verify action metadata tests still pass.

## Phase 3 — Release Hygiene

### Task 6: Decide automated publish route

**Objective:** Keep release safe while preparing future automation.

**Files:**
- Modify: `.github/workflows/release.yml`
- Possibly: docs release notes

**Steps:**
1. Keep workflow manual until `NPM_TOKEN` is installed.
2. Document manual publish commands.
3. Only enable release-triggered publish after token secret exists and a dry run path is verified.

## Quality Gates

Run before reporting a batch as complete:

```bash
npm run check
npm run build
npm pack --dry-run
git diff --check
```

For published patches, additionally verify:

```bash
npm view oss-pulse version dist-tags.latest
TMPDIR=$(mktemp -d)
cd "$TMPDIR"
npx --yes oss-pulse@<version> scan <repo-path> --format markdown --summary-only
```
