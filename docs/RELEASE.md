# Release

This project publishes two surfaces:

- npm package: `oss-pulse`
- GitHub composite Action: pinned repository tags such as `v0.1.0`

## Prerequisites

- npm package name is available or owned by the maintainer.
- GitHub repository has `NPM_TOKEN` configured as an Actions secret.
- The release branch passes `npm run check`.

## Local Preflight

```bash
npm ci
npm run check
npm run build
npm pack --dry-run
```

Confirm the dry-run includes `dist`, `README.md`, `CHANGELOG.md`, `LICENSE`, `action.yml`, and `package.json`.

## Publish

1. Update `CHANGELOG.md`.
2. Update `package.json` version.
3. Run the local preflight.
4. Create and push a tag named `vX.Y.Z`.
5. Create a GitHub Release from that tag.
6. The `Release` workflow publishes to npm with provenance.

## After Publish

- Run `npx --yes oss-pulse@X.Y.Z scan . --format markdown`.
- Open a pull request that uses the pinned Action tag.
- Add one real scan example to the README or `docs/examples/`.
