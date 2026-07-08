# Release

This project publishes two surfaces:

- npm package: `oss-pulse`
- GitHub composite Action: pinned repository tags such as `v0.1.3`

The default release path is intentionally manual until a maintainer configures a publish token. Manual publishing keeps first releases simple and avoids requiring secrets before the project needs automation.

## Prerequisites

- npm package name is available or owned by the maintainer.
- The maintainer is logged in with the npm CLI:

  ```bash
  npm whoami
  ```

- npm two-factor authentication is available for publish OTP prompts.
- The release branch passes `npm run check`.
- Optional automation path only: GitHub repository has `NPM_TOKEN` configured as an Actions secret.

## Local Preflight

```bash
npm ci
npm run check
npm run build
npm pack --dry-run
git diff --check
```

Confirm the dry-run includes `dist`, `README.md`, `CHANGELOG.md`, `LICENSE`, `action.yml`, and `package.json`.

For CLI packages, also verify the installed bin path from a clean temporary directory before treating a release as done. This catches bugs where `node dist/cli.js` works but `npx oss-pulse` does not.

```bash
TMPDIR=$(mktemp -d)
cd "$TMPDIR"
npm install /path/to/oss-pulse/oss-pulse-X.Y.Z.tgz
node_modules/.bin/oss-pulse scan /path/to/repo --format markdown --summary-only
```

## Manual npm Publish With OTP

Use this path when `NPM_TOKEN` is not configured.

1. Update `CHANGELOG.md`.
2. Update `package.json` version.
3. Run the local preflight.
4. Commit and push the release change.
5. Publish from the repository root:

   ```bash
   npm publish --access public
   ```

6. When npm asks for the one-time password, enter the current 2FA code.
7. Verify the registry has the expected version:

   ```bash
   npm view oss-pulse version dist-tags.latest
   ```

8. Verify the published package through the registry, not local files:

   ```bash
   TMPDIR=$(mktemp -d)
   cd "$TMPDIR"
   npx --yes oss-pulse@X.Y.Z scan /path/to/repo --format markdown --summary-only
   ```

9. Create the GitHub Release only after npm and `npx` verification pass:

   ```bash
   gh release create vX.Y.Z --target main --title "oss-pulse vX.Y.Z" --notes-file /path/to/notes.md
   ```

10. Confirm CI on `main` is green.

## Automated Publish Path

The repository includes a manual-only release workflow. Keep it manual until `NPM_TOKEN` exists and a maintainer has tested the workflow on a patch release.

When automation is ready:

1. Create an npm granular access token with publish permissions and 2FA bypass enabled.
2. Add it to GitHub Actions secrets as `NPM_TOKEN`.
3. Run the `Release` workflow manually for a patch version.
4. Verify npm registry, `npx`, GitHub release notes, and CI.
5. Only then consider adding release-triggered publish automation.

## After Publish

- Run `npx --yes oss-pulse@X.Y.Z scan . --format markdown`.
- Check `npm view oss-pulse version dist-tags.latest`.
- Check the latest GitHub Actions CI run.
- Create or update the GitHub Release for `vX.Y.Z`.
- Add one real scan example to the README or `docs/examples/` when the release changes user-visible behavior.
