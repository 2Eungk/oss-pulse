import { strict as assert } from "node:assert"
import { readFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

test("release workflow is manual, main-only, version-gated, and provenance-enabled", async () => {
  const workflow = await readProjectFile(".github/workflows/release.yml")

  assert.match(workflow, /^on:\n {2}workflow_dispatch:\n {4}inputs:\n {6}version:/m)
  assert.match(workflow, /version:\n {8}description:.*\n {8}required: true\n {8}type: string/)
  assert.doesNotMatch(workflow, /^ {2}(push|pull_request|release):/m)
  assert.match(workflow, /if: github\.ref == 'refs\/heads\/main'/)
  assert.match(workflow, /semver='/)
  assert.match(workflow, /package\.json version .*does not match requested version/)
  assert.match(workflow, /CHANGELOG\.md must contain a heading/)
  assert.match(workflow, /npm view "oss-pulse@\$RELEASE_VERSION" version --json/)
  assert.match(workflow, /npm ci --ignore-scripts/)
  assert.match(workflow, /npm run check/)
  assert.match(workflow, /npm run build/)
  assert.match(workflow, /npm pack --dry-run --json/)
  assert.match(workflow, /npm publish --provenance --access public/)
  assert.doesNotMatch(workflow, /git tag|gh release create/)
})

test("release guide distinguishes dry-run from pack and tags only after registry verification", async () => {
  const guide = await readProjectFile("docs/RELEASE.md")
  const dryRun = guide.indexOf("npm pack --dry-run --json")
  const pack = guide.indexOf("TARBALL=$(npm pack --json")
  const publish = guide.indexOf("npm publish --access public")
  const registryVerification = guide.indexOf("npm view oss-pulse version dist-tags.latest")
  const tag = guide.indexOf('git tag -a "vX.Y.Z" "$RELEASE_COMMIT"')
  const release = guide.indexOf('gh release create "vX.Y.Z" --verify-tag')

  assert.ok(dryRun >= 0)
  assert.ok(pack > dryRun)
  assert.ok(publish > pack)
  assert.ok(registryVerification > publish)
  assert.ok(tag > registryVerification)
  assert.ok(release > tag)
  assert.match(guide, /npm install "\$REPO_ROOT\/\$TARBALL"/)
  assert.match(guide, /npx --yes oss-pulse@X\.Y\.Z/)
  assert.doesNotMatch(guide, /npm pack --dry-run[^\n]*\.tgz/)
  assert.doesNotMatch(guide, /--target main/)
})

test("unpublished release candidate remains under Unreleased", async () => {
  const changelog = await readProjectFile("CHANGELOG.md")
  assert.match(changelog, /^## Unreleased$/m)
  assert.doesNotMatch(changelog, /^## 0\.1\.5(?:\s|-)/m)
})

function readProjectFile(path: string): Promise<string> {
  return readFile(resolve(projectRoot(), path), "utf8")
}

function projectRoot(): string {
  const currentFile = fileURLToPath(import.meta.url)
  return resolve(dirname(currentFile), "../../..")
}
