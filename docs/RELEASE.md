# Release

This project publishes two surfaces:

- npm package: `oss-pulse`
- GitHub composite Action: immutable commits referenced by annotated release tags such as `v0.1.5`

The automated workflow is intentionally manual (`workflow_dispatch`) and publishes only from `main`. It requires an npm trusted-publishing setup or an `NPM_TOKEN`; it never creates tags or GitHub Releases.

## Prerequisites

- The npm package name is available or owned by the maintainer.
- The maintainer is logged in with the npm CLI for a manual release:

  ```bash
  npm whoami
  ```

- npm two-factor authentication is available for publish OTP prompts.
- The release commit is on `main`, clean, reviewed, and passes `npm run check`.
- `package.json` contains the exact strict SemVer release version and `CHANGELOG.md` has a matching version heading. Keep candidate changes under `## Unreleased` until this promotion step.

## Local preflight

From the repository root, replace `X.Y.Z` with the intended version.

```bash
npm ci --ignore-scripts
npm run check
npm run build
npm pack --dry-run --json
git diff --check
git diff --exit-code
```

`npm pack --dry-run --json` only reports the prospective package contents; it does **not** create a tarball. Confirm it includes `dist`, `README.md`, `CHANGELOG.md`, `LICENSE`, `action.yml`, `docs/REPORT_SCHEMA.md`, `docs/report.schema.json`, and `package.json`, while excluding internal plans, playbooks, backlog, roadmap, and example documents.

Create the actual tarball only after the dry run passes. The JSON output supplies the tarball path. Install it into an isolated directory and exercise the packaged bin before publishing:

```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
TARBALL=$(npm pack --json | node -e 'let data=""; process.stdin.on("data", (chunk) => data += chunk); process.stdin.on("end", () => process.stdout.write(JSON.parse(data)[0].filename))')
TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR" "$REPO_ROOT/$TARBALL"' EXIT
cd "$TMPDIR"
npm install "$REPO_ROOT/$TARBALL"
node_modules/.bin/oss-pulse scan "$REPO_ROOT" --format markdown --summary-only
cd "$REPO_ROOT"
```

## Manual npm publish with OTP

Use this path when no trusted-publishing workflow is configured.

1. Promote the intended changes from `## Unreleased` to `## X.Y.Z - YYYY-MM-DD` in `CHANGELOG.md`, and set `package.json` to exactly `X.Y.Z`.
2. Commit and push that release commit to `main`; do not release an uncommitted working tree.
3. Run the local preflight and the clean tarball install above from that exact commit.
4. Record the verified commit before publishing:

   ```bash
   RELEASE_COMMIT=$(git rev-parse HEAD)
   ```

5. Publish from the repository root:

   ```bash
   npm publish --access public
   ```

   Enter the current npm OTP when prompted.

6. Verify the registry version and execute the registry package, rather than local files:

   ```bash
   npm view oss-pulse version dist-tags.latest
   TMPDIR=$(mktemp -d)
   (
     cd "$TMPDIR"
     npx --yes oss-pulse@X.Y.Z scan /path/to/repo --format markdown --summary-only
   )
   rm -rf "$TMPDIR"
   ```

7. Only after registry and `npx` verification pass, confirm the checked-out commit is still the verified one, create an immutable annotated tag at that commit, and push it:

   ```bash
   test "$(git rev-parse HEAD)" = "$RELEASE_COMMIT"
   git tag -a "vX.Y.Z" "$RELEASE_COMMIT" -m "oss-pulse vX.Y.Z"
   git push origin "vX.Y.Z"
   ```

8. Create the GitHub Release from the already-pushed tag. `--verify-tag` prevents `gh` from silently creating a tag at another commit:

   ```bash
   gh release create "vX.Y.Z" --verify-tag --title "oss-pulse vX.Y.Z" --notes-file /path/to/notes.md
   ```

## Automated publish path

The `Release` workflow is manual-only and accepts a required `version` input. It runs only when dispatched from `refs/heads/main`, rejects non-SemVer input, mismatched `package.json` versions, absent changelog headings, and versions already in npm. It then uses `npm ci --ignore-scripts`, runs check/build/package gates, and publishes with npm provenance.

The workflow deliberately does not tag commits or create GitHub Releases. After its npm and `npx` verification, use the immutable-tag and `gh release create --verify-tag` steps above from the verified release commit.

## After publish

- Check `npm view oss-pulse version dist-tags.latest`.
- Run `npx --yes oss-pulse@X.Y.Z scan . --format markdown` from a clean directory.
- Confirm the immutable annotated tag resolves to the verified release commit.
- Check the latest GitHub Actions CI run.
- Add one real scan example to the README or `docs/examples/` when the release changes user-visible behavior.
