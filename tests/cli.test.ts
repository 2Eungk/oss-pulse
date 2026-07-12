import { strict as assert } from "node:assert"
import { execFile } from "node:child_process"
import { chmod, mkdir, mkdtemp, readFile, realpath, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)

test("CLI --version matches package.json", async () => {
  // Given: the package version is the source of truth for publish/install UX.
  const packageJson = JSON.parse(await readFile(resolve(projectRoot(), "package.json"), "utf8"))

  // When: the compiled CLI prints its version.
  const result = await execFileAsync(process.execPath, [cliPath(), "--version"])

  // Then: users and npm smoke tests see the same version that will be packed.
  assert.equal(result.stdout.trim(), packageJson.version)
  assert.equal(result.stderr, "")
})

test("CLI emits JSON pulse when scanning a real git repository", async () => {
  // Given: a real git repository with a README, license, and CI workflow.
  const repositoryRoot = await mkdtemp(join(tmpdir(), "oss-pulse-repo-"))
  await git(repositoryRoot, ["init"])
  await git(repositoryRoot, ["config", "user.email", "maintainer@example.com"])
  await git(repositoryRoot, ["config", "user.name", "Maintainer"])
  await mkdir(join(repositoryRoot, ".github/workflows"), { recursive: true })
  await writeFile(join(repositoryRoot, "README.md"), "# Demo\n", "utf8")
  await writeFile(join(repositoryRoot, "LICENSE"), "MIT\n", "utf8")
  await writeFile(
    join(repositoryRoot, ".github/workflows/ci.yml"),
    "name: CI\non: push\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - run: npm test\n",
    "utf8",
  )
  await git(repositoryRoot, ["add", "."])
  await git(repositoryRoot, ["commit", "-m", "Initial maintenance surface"])

  // When: the compiled CLI scans the repository.
  const result = await execFileAsync(process.execPath, [
    cliPath(),
    "scan",
    repositoryRoot,
    "--format",
    "json",
  ])
  const report = JSON.parse(result.stdout)

  // Then: the observable JSON output contains the computed maintainer score.
  assert.equal(report.score, 35)
  assert.equal(report.status, "needs-work")
  assert.equal(report.actions.length, 11)
})

test("CLI counts CODEOWNERS review-routing signals", async () => {
  // Given: a real git repository with ownership routing declared.
  const repositoryRoot = await createMinimalRepository()
  await mkdir(join(repositoryRoot, ".github"), { recursive: true })
  await writeFile(join(repositoryRoot, ".github/CODEOWNERS"), "* @maintainer\n", "utf8")
  await git(repositoryRoot, ["add", "."])
  await git(repositoryRoot, ["commit", "-m", "Add CODEOWNERS"])

  // When: the compiled CLI scans the repository.
  const result = await execFileAsync(process.execPath, [
    cliPath(),
    "scan",
    repositoryRoot,
    "--format",
    "json",
  ])
  const report = JSON.parse(result.stdout)

  // Then: the CODEOWNERS check passes and its remediation action is cleared.
  assert.equal(
    report.checks.find((check: { readonly id: string }) => check.id === "codeowners")?.passed,
    true,
  )
  assert.equal(
    report.actions.some((action: { readonly id: string }) => action.id === "add-codeowners"),
    false,
  )
})

test("CLI counts changelog, funding, and release workflow signals", async () => {
  // Given: a real git repository with release sustainability files.
  const repositoryRoot = await createMinimalRepository()
  await mkdir(join(repositoryRoot, ".github/workflows"), { recursive: true })
  await mkdir(join(repositoryRoot, ".github"), { recursive: true })
  await writeFile(join(repositoryRoot, "CHANGELOG.md"), "# Changelog\n", "utf8")
  await writeFile(join(repositoryRoot, ".github/FUNDING.yml"), "github: maintainer\n", "utf8")
  await writeFile(
    join(repositoryRoot, ".github/workflows/ci.yml"),
    "name: CI\non: push\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - run: npm test\n",
    "utf8",
  )
  await writeFile(
    join(repositoryRoot, ".github/workflows/release.yml"),
    "name: Release\non: push\njobs:\n  publish:\n    runs-on: ubuntu-latest\n    steps:\n      - run: npm publish --dry-run\n",
    "utf8",
  )
  await git(repositoryRoot, ["add", "."])
  await git(repositoryRoot, ["commit", "-m", "Add release signals"])

  // When: the compiled CLI scans the repository.
  const result = await execFileAsync(process.execPath, [
    cliPath(),
    "scan",
    repositoryRoot,
    "--format",
    "json",
  ])
  const report = JSON.parse(result.stdout)

  // Then: the newly supported maintainer signals add to the score and clear their actions.
  assert.equal(report.score, 35)
  assert.equal(
    report.actions.some((action: { readonly id: string }) => action.id === "add-changelog"),
    false,
  )
  assert.equal(
    report.actions.some((action: { readonly id: string }) => action.id === "add-funding"),
    false,
  )
  assert.equal(
    report.actions.some((action: { readonly id: string }) => action.id === "add-release-workflow"),
    false,
  )
})

test("CLI ignores non-runnable workflow YAML and distinguishes CI from release behavior", async () => {
  // Given: empty, malformed, and unrelated workflow files, including one named release.
  const repositoryRoot = await createMinimalRepository()
  const workflowsRoot = join(repositoryRoot, ".github/workflows")
  await mkdir(workflowsRoot, { recursive: true })
  await writeFile(join(workflowsRoot, "empty.yml"), "name: CI\n", "utf8")
  await writeFile(join(workflowsRoot, "malformed.yaml"), "jobs: [not a mapping\n", "utf8")
  await writeFile(join(workflowsRoot, "release.yml"), "name: Release\n", "utf8")

  // When: the CLI scans the non-runnable workflow fixtures.
  let result = await execFileAsync(process.execPath, [
    cliPath(),
    "scan",
    repositoryRoot,
    "--format",
    "json",
  ])
  let report = JSON.parse(result.stdout)

  // Then: YAML files alone do not satisfy either workflow signal.
  assert.equal(checkPassed(report, "ci-workflow"), false)
  assert.equal(checkPassed(report, "release-workflow"), false)

  // When: a runnable publish job is added without a CI workflow.
  await writeFile(
    join(workflowsRoot, "publish.yaml"),
    "name: Publish\non: push\njobs:\n  publish:\n    runs-on: ubuntu-latest\n    steps:\n      - run: npm publish --dry-run\n",
    "utf8",
  )
  result = await execFileAsync(process.execPath, [
    cliPath(),
    "scan",
    repositoryRoot,
    "--format",
    "json",
  ])
  report = JSON.parse(result.stdout)

  // Then: publish behavior satisfies release readiness, not CI readiness.
  assert.equal(checkPassed(report, "ci-workflow"), false)
  assert.equal(checkPassed(report, "release-workflow"), true)

  // When: a separate runnable test workflow is added.
  await writeFile(
    join(workflowsRoot, "quality.yml"),
    "name: Quality\non: push\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - run: npm test\n",
    "utf8",
  )
  result = await execFileAsync(process.execPath, [
    cliPath(),
    "scan",
    repositoryRoot,
    "--format",
    "json",
  ])
  report = JSON.parse(result.stdout)

  // Then: CI and release checks are both satisfied by their respective runnable behavior.
  assert.equal(checkPassed(report, "ci-workflow"), true)
  assert.equal(checkPassed(report, "release-workflow"), true)
})

test("CLI requires a valid top-level GitHub Actions trigger", async () => {
  // Given: runnable-looking jobs with missing, empty, null, and invalid `on` values.
  const repositoryRoot = await createMinimalRepository()
  const workflowsRoot = join(repositoryRoot, ".github/workflows")
  await mkdir(workflowsRoot, { recursive: true })
  const runnableJob =
    "jobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - run: npm test\n"
  await writeFile(join(workflowsRoot, "missing-on.yml"), runnableJob, "utf8")
  await writeFile(join(workflowsRoot, "empty-sequence.yml"), `on: []\n${runnableJob}`, "utf8")
  await writeFile(join(workflowsRoot, "empty-map.yml"), `on: {}\n${runnableJob}`, "utf8")
  await writeFile(join(workflowsRoot, "null.yml"), `on:\n${runnableJob}`, "utf8")
  await writeFile(join(workflowsRoot, "invalid.yml"), `on: false\n${runnableJob}`, "utf8")
  await writeFile(
    join(workflowsRoot, "invalid-mapping.yml"),
    `on:\n  schedule: {}\n  push: false\n${runnableJob}`,
    "utf8",
  )
  await writeFile(
    join(workflowsRoot, "unknown-event.yml"),
    `on: publish_everything\n${runnableJob}`,
    "utf8",
  )

  // When: the CLI evaluates top-level workflow eligibility.
  let report = await scanCliJson(repositoryRoot)

  // Then: no missing or invalid trigger earns CI credit.
  assert.equal(checkPassed(report, "ci-workflow"), false)
  assert.equal(checkPassed(report, "release-workflow"), false)

  // When: valid sequence and minimally valid schedule/push mapping triggers are added.
  await writeFile(join(workflowsRoot, "sequence.yml"), `on: [push]\n${runnableJob}`, "utf8")
  await writeFile(
    join(workflowsRoot, "mapping.yml"),
    "on:\n  schedule:\n    - cron: '0 0 * * *'\n  push:\n    branches: [main]\njobs:\n  publish:\n    runs-on: ubuntu-latest\n    steps:\n      - run: npm publish --dry-run\n",
    "utf8",
  )
  report = await scanCliJson(repositoryRoot)

  // Then: standard YAML 1.2 `on` keys and both supported collection forms are eligible.
  assert.equal(checkPassed(report, "ci-workflow"), true)
  assert.equal(checkPassed(report, "release-workflow"), true)
})

test("CLI rejects malformed event configuration and accepts bounded common trigger shapes", async () => {
  // Given: runnable jobs behind invalid event configurations and whitespace-padded event names.
  const repositoryRoot = await createMinimalRepository()
  const workflowsRoot = join(repositoryRoot, ".github/workflows")
  await mkdir(workflowsRoot, { recursive: true })
  const runnableJob =
    "jobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - run: npm test\n"
  const invalidTriggers = {
    "push-branches-false.yml": `on:\n  push:\n    branches: false\n${runnableJob}`,
    "workflow-dispatch-inputs-false.yml": `on:\n  workflow_dispatch:\n    inputs: false\n${runnableJob}`,
    "pull-request-types-false.yml": `on:\n  pull_request:\n    types: false\n${runnableJob}`,
    "scalar-whitespace.yml": `on: " push "\n${runnableJob}`,
    "sequence-whitespace.yml": `on: [" push "]\n${runnableJob}`,
    "mapping-whitespace.yml": `on:\n  " push ":\n${runnableJob}`,
  }
  await Promise.all(
    Object.entries(invalidTriggers).map(([name, contents]) =>
      writeFile(join(workflowsRoot, name), contents, "utf8"),
    ),
  )

  // When: the scanner evaluates only malformed trigger shapes.
  let report = await scanCliJson(repositoryRoot)

  // Then: neither CI nor release credit is granted by a false scalar, unknown shape, or padded name.
  assert.equal(checkPassed(report, "ci-workflow"), false)
  assert.equal(checkPassed(report, "release-workflow"), false)

  // When: a release-dispatch configuration matching this repository's release workflow is added.
  await writeFile(
    join(workflowsRoot, "release-dispatch.yml"),
    "on:\n  workflow_dispatch:\n    inputs:\n      version:\n        description: Exact semantic version to publish.\n        required: true\n        type: string\njobs:\n  publish:\n    runs-on: ubuntu-latest\n    steps:\n      - run: npm publish --dry-run\n",
    "utf8",
  )
  report = await scanCliJson(repositoryRoot)

  // Then: the supported workflow_dispatch input schema earns release credit.
  assert.equal(checkPassed(report, "release-workflow"), true)

  // When: a common, configured push and pull-request workflow is added.
  await writeFile(
    join(workflowsRoot, "common-push-pr.yml"),
    "on:\n  push:\n    branches: [main]\n    paths: [src/**]\n  pull_request:\n    branches: [main]\n    paths-ignore: [docs/**]\n    types: [opened, synchronize]\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - run: npm test\n",
    "utf8",
  )
  report = await scanCliJson(repositoryRoot)

  // Then: bounded string-sequence filters remain eligible for normal CI workflows.
  assert.equal(checkPassed(report, "ci-workflow"), true)
})

test("CLI rejects a workflow with an invalid YAML suffix", async () => {
  // Given: a seemingly runnable workflow followed by invalid YAML.
  const repositoryRoot = await createMinimalRepository()
  const workflowsRoot = join(repositoryRoot, ".github/workflows")
  await mkdir(workflowsRoot, { recursive: true })
  await writeFile(
    join(workflowsRoot, "invalid-suffix.yml"),
    "on: push\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - run: npm test\ninvalid: [suffix\n",
    "utf8",
  )

  // When: the CLI scans it.
  const report = await scanCliJson(repositoryRoot)

  // Then: parsing failure prevents the file from satisfying CI or release readiness.
  assert.equal(checkPassed(report, "ci-workflow"), false)
  assert.equal(checkPassed(report, "release-workflow"), false)
})

test("CLI ignores release commands outside executable workflow steps", async () => {
  // Given: a runnable test job whose comments, names, and environment mention publishing.
  const repositoryRoot = await createMinimalRepository()
  const workflowsRoot = join(repositoryRoot, ".github/workflows")
  await mkdir(workflowsRoot, { recursive: true })
  await writeFile(
    join(workflowsRoot, "comment.yml"),
    "name: npm publish\n# npm publish only happens from the release workflow\nenv:\n  RELEASE_COMMAND: npm publish\non: push\njobs:\n  test:\n    name: npm publish\n    runs-on: ubuntu-latest\n    env:\n      RELEASE_COMMAND: npm publish\n    steps:\n      - name: npm publish\n        run: npm test\n",
    "utf8",
  )

  // When: the CLI inspects parsed executable steps.
  const report = await scanCliJson(repositoryRoot)

  // Then: the test job is CI, not a release workflow.
  assert.equal(checkPassed(report, "ci-workflow"), true)
  assert.equal(checkPassed(report, "release-workflow"), false)
})

test("CLI ignores commented and echoed release commands in runnable shell steps", async () => {
  // Given: a multiline command where publishing is commented out before a real test command.
  const repositoryRoot = await createMinimalRepository()
  const workflowsRoot = join(repositoryRoot, ".github/workflows")
  await mkdir(workflowsRoot, { recursive: true })
  await writeFile(
    join(workflowsRoot, "commented.yml"),
    "on: push\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - run: |\n          # npm publish disabled\n          npm test\n",
    "utf8",
  )

  // When: the CLI evaluates the executable commands.
  let report = await scanCliJson(repositoryRoot)

  // Then: only the test command satisfies CI readiness.
  assert.equal(checkPassed(report, "ci-workflow"), true)
  assert.equal(checkPassed(report, "release-workflow"), false)

  // When: a simple output command mentions publishing before a real test command.
  await writeFile(
    join(workflowsRoot, "echoed.yml"),
    'on: push\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - run: |\n          echo "npm publish disabled"\n          npm test\n',
    "utf8",
  )
  report = await scanCliJson(repositoryRoot)

  // Then: echoed text likewise does not satisfy release readiness.
  assert.equal(checkPassed(report, "ci-workflow"), true)
  assert.equal(checkPassed(report, "release-workflow"), false)
})

test("CLI credits only absent or literal-true job conditions", async () => {
  // Given: jobs with literal false and unverified expression conditions.
  const repositoryRoot = await createMinimalRepository()
  const workflowsRoot = join(repositoryRoot, ".github/workflows")
  await mkdir(workflowsRoot, { recursive: true })
  await writeFile(
    join(workflowsRoot, "disabled.yml"),
    "on: push\njobs:\n  literal-false:\n    if: false\n    runs-on: ubuntu-latest\n    steps:\n      - run: npm test\n  quoted-false:\n    if: ' FALSE '\n    runs-on: ubuntu-latest\n    steps:\n      - run: npm publish\n  quoted-zero:\n    if: \"0\"\n    runs-on: ubuntu-latest\n    steps:\n      - run: npm test\n  expression-constant-false:\n    if: ${{ 1 == 2 }}\n    runs-on: ubuntu-latest\n    steps:\n      - run: npm publish\n  expression-dynamic:\n    if: ${{ github.ref == 'refs/heads/main' }}\n    runs-on: ubuntu-latest\n    steps:\n      - run: npm test\n",
    "utf8",
  )

  // When: the CLI scans the disabled workflow.
  let report = await scanCliJson(repositoryRoot)

  // Then: neither false nor unverified conditions earn CI or release credit.
  assert.equal(checkPassed(report, "ci-workflow"), false)
  assert.equal(checkPassed(report, "release-workflow"), false)

  // When: a YAML boolean true condition guards a supported command.
  await writeFile(
    join(workflowsRoot, "literal-true.yml"),
    "on: push\njobs:\n  literal-true:\n    if: true\n    runs-on: ubuntu-latest\n    steps:\n      - run: npm test\n",
    "utf8",
  )
  report = await scanCliJson(repositoryRoot)

  // Then: the explicitly enabled job receives CI credit.
  assert.equal(checkPassed(report, "ci-workflow"), true)
  assert.equal(checkPassed(report, "release-workflow"), false)
})

test("CLI credits only absent or literal-true step conditions", async () => {
  // Given: a runnable job whose otherwise qualifying steps are false or unverified.
  const repositoryRoot = await createMinimalRepository()
  const workflowsRoot = join(repositoryRoot, ".github/workflows")
  await mkdir(workflowsRoot, { recursive: true })
  await writeFile(
    join(workflowsRoot, "disabled-steps.yml"),
    "on: push\njobs:\n  verify:\n    runs-on: ubuntu-latest\n    steps:\n      - if: false\n        run: npm test\n      - if: 'false'\n        run: npm publish --dry-run\n      - if: \"0\"\n        run: npm test\n      - if: ${{ 1 == 2 }}\n        run: npm publish --dry-run\n      - if: ${{ github.ref == 'refs/heads/main' }}\n        run: npm test\n",
    "utf8",
  )

  // When: the CLI evaluates executable step behavior.
  const report = await scanCliJson(repositoryRoot)

  // Then: false and unverified steps cannot satisfy either workflow signal.
  assert.equal(checkPassed(report, "ci-workflow"), false)
  assert.equal(checkPassed(report, "release-workflow"), false)
})

test("CLI ignores output wrappers instead of treating their printed tokens as commands", async () => {
  // Given: simple output wrappers that print CI and release-looking text.
  const repositoryRoot = await createMinimalRepository()
  const workflowsRoot = join(repositoryRoot, ".github/workflows")
  await mkdir(workflowsRoot, { recursive: true })
  await writeFile(
    join(workflowsRoot, "output.yml"),
    "on: push\njobs:\n  output-only:\n    runs-on: ubuntu-latest\n    steps:\n      - run: env echo npm test\n      - run: env printf 'npm publish\\n'\n      - run: command echo npm publish\n      - run: MESSAGE=ignored env printf '%s\\n' npm test\n",
    "utf8",
  )

  // When: the CLI tokenizes the shell commands.
  const report = await scanCliJson(repositoryRoot)

  // Then: printed text never earns CI or release credit.
  assert.equal(checkPassed(report, "ci-workflow"), false)
  assert.equal(checkPassed(report, "release-workflow"), false)
})

test("CLI gives no credit to remote reusable workflows but scans local workflow_call contents", async () => {
  // Given: a remote reusable workflow whose filename sounds like a release workflow.
  const repositoryRoot = await createMinimalRepository()
  const workflowsRoot = join(repositoryRoot, ".github/workflows")
  await mkdir(workflowsRoot, { recursive: true })
  await writeFile(
    join(workflowsRoot, "caller.yml"),
    "on: push\njobs:\n  remote:\n    uses: acme/shared/.github/workflows/npm-publish.yml@v1\n",
    "utf8",
  )

  // Then: names and remote implementations are never credited.
  let report = await scanCliJson(repositoryRoot)
  assert.equal(checkPassed(report, "ci-workflow"), false)
  assert.equal(checkPassed(report, "release-workflow"), false)

  // When: a local reusable workflow explicitly declares workflow_call and contains
  // a supported release command, it is independently scanned as a local file.
  await writeFile(
    join(workflowsRoot, "local-release.yml"),
    "on: workflow_call\njobs:\n  publish:\n    runs-on: ubuntu-latest\n    steps:\n      - run: npm publish\n",
    "utf8",
  )
  await writeFile(
    join(workflowsRoot, "caller.yml"),
    "on: push\njobs:\n  local:\n    uses: ./.github/workflows/local-release.yml\n",
    "utf8",
  )
  report = await scanCliJson(repositoryRoot)

  // Then: the actual local behavior, not the caller or filename, earns release credit.
  assert.equal(checkPassed(report, "release-workflow"), true)
})

test("CLI accepts nonempty runs-on label sequences", async () => {
  // Given: a runnable job whose labels are a static label and an expression.
  const repositoryRoot = await createMinimalRepository()
  const workflowsRoot = join(repositoryRoot, ".github/workflows")
  await mkdir(workflowsRoot, { recursive: true })
  await writeFile(
    join(workflowsRoot, "matrix-runner.yml"),
    "on: push\njobs:\n  test:\n    runs-on: [ubuntu-latest, '${{ matrix.runner }}']\n    steps:\n      - run: npm test\n",
    "utf8",
  )

  // When: the workflow is scanned.
  const report = await scanCliJson(repositoryRoot)

  // Then: nonempty runner-label sequences are recognized as runnable.
  assert.equal(checkPassed(report, "ci-workflow"), true)
})

test("CLI rejects dynamic and complex shell instead of scanning embedded commands", async () => {
  // Given: every apparent behavior is embedded behind unsupported shell syntax.
  const repositoryRoot = await createMinimalRepository()
  const workflowsRoot = join(repositoryRoot, ".github/workflows")
  await mkdir(workflowsRoot, { recursive: true })
  await writeFile(
    join(workflowsRoot, "complex.yml"),
    "on: push\njobs:\n  complex:\n    runs-on: ubuntu-latest\n    steps:\n      - run: false && npm test\n      - run: if true; then npm publish; fi\n      - run: bash -c 'npm publish'\n      - run: eval npm test\n      - run: npm test | tee results.txt\n      - run: gh release create v1 > output.txt\n      - run: COMMAND='npm publish'\n",
    "utf8",
  )

  // Then: no control branch, shell wrapper, pipe, redirection, or variable construction is interpreted.
  const report = await scanCliJson(repositoryRoot)
  assert.equal(checkPassed(report, "ci-workflow"), false)
  assert.equal(checkPassed(report, "release-workflow"), false)
})

test("CLI recognizes the bounded supported CI and release command vocabulary", async () => {
  // Given: direct, plain invocations of each supported common command form.
  const repositoryRoot = await createMinimalRepository()
  const workflowsRoot = join(repositoryRoot, ".github/workflows")
  await mkdir(workflowsRoot, { recursive: true })
  await writeFile(
    join(workflowsRoot, "supported.yml"),
    "on: [push, workflow_dispatch]\njobs:\n  verify-and-release:\n    runs-on: ubuntu-latest\n    steps:\n      - run: npm test\n      - run: pnpm run lint\n      - run: yarn run build\n      - run: bun run typecheck\n      - run: node --test\n      - run: npx vitest\n      - run: jest\n      - run: pytest\n      - run: python -m pytest\n      - run: uv run pytest\n      - run: go test ./...\n      - run: cargo test\n      - run: deno test\n      - run: tsc --noEmit\n      - run: biome check\n      - run: yarn npm publish\n      - run: gh release create v1.2.3\n      - run: npx semantic-release\n      - run: npm exec semantic-release\n      - run: pnpm dlx semantic-release\n      - run: yarn exec semantic-release\n      - run: bunx semantic-release\n",
    "utf8",
  )

  // Then: standard, locally verifiable commands earn their matching readiness signals.
  const report = await scanCliJson(repositoryRoot)
  assert.equal(checkPassed(report, "ci-workflow"), true)
  assert.equal(checkPassed(report, "release-workflow"), true)
})

test("CLI distinguishes read-only gh release commands from release creation and allowlisted actions", async () => {
  // Given: read-only GitHub CLI commands that mention releases.
  const repositoryRoot = await createMinimalRepository()
  const workflowsRoot = join(repositoryRoot, ".github/workflows")
  await mkdir(workflowsRoot, { recursive: true })
  const workflowPath = join(workflowsRoot, "release.yml")
  await writeFile(
    workflowPath,
    "on: push\njobs:\n  inspect:\n    runs-on: ubuntu-latest\n    steps:\n      - run: gh release view v1\n      - run: gh release list\n      - run: gh release download v1\n      - run: gh release delete v1\n",
    "utf8",
  )

  // Then: read, list, download, and delete operations do not imply release readiness.
  let report = await scanCliJson(repositoryRoot)
  assert.equal(checkPassed(report, "release-workflow"), false)

  // When: each explicitly supported release action is used in a runnable local job.
  for (const action of [
    "softprops/action-gh-release@v2",
    "changesets/action@v1",
    "google-github-actions/release-please-action@v4",
  ]) {
    await writeFile(
      workflowPath,
      `on: push\njobs:\n  release:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: ${action}\n`,
      "utf8",
    )
    report = await scanCliJson(repositoryRoot)
    assert.equal(checkPassed(report, "release-workflow"), true, action)
  }
})

test("CLI requires an executable gh release create command with a tag", async () => {
  // Given: help, version, and tagless invocations that cannot create a release.
  const repositoryRoot = await createMinimalRepository()
  const workflowsRoot = join(repositoryRoot, ".github/workflows")
  await mkdir(workflowsRoot, { recursive: true })
  const workflowPath = join(workflowsRoot, "release.yml")
  await writeFile(
    workflowPath,
    "on: push\njobs:\n  release:\n    runs-on: ubuntu-latest\n    steps:\n      - run: gh release create --help\n      - run: gh release create -h\n      - run: gh release create --version\n      - run: gh release create\n",
    "utf8",
  )

  // Then: command help, version output, and tagless creation do not earn credit.
  let report = await scanCliJson(repositoryRoot)
  assert.equal(checkPassed(report, "release-workflow"), false)

  // When: a direct creation command supplies a non-option tag.
  await writeFile(
    workflowPath,
    "on: push\njobs:\n  release:\n    runs-on: ubuntu-latest\n    steps:\n      - run: gh release create v1.2.3\n",
    "utf8",
  )
  report = await scanCliJson(repositoryRoot)

  // Then: the actual release command earns release-workflow credit.
  assert.equal(checkPassed(report, "release-workflow"), true)
})

test("CLI recognizes test and publish behavior in the same runnable job", async () => {
  // Given: a single job that validates before publishing.
  const repositoryRoot = await createMinimalRepository()
  const workflowsRoot = join(repositoryRoot, ".github/workflows")
  await mkdir(workflowsRoot, { recursive: true })
  await writeFile(
    join(workflowsRoot, "mixed.yml"),
    "on: push\njobs:\n  verify-and-publish:\n    runs-on: ubuntu-latest\n    steps:\n      - run: npm test\n      - run: npm publish --dry-run\n",
    "utf8",
  )

  // When: the CLI inspects the job's independent behaviors.
  const report = await scanCliJson(repositoryRoot)

  // Then: the same job satisfies both readiness signals.
  assert.equal(checkPassed(report, "ci-workflow"), true)
  assert.equal(checkPassed(report, "release-workflow"), true)
})

test("CLI accepts valid workflows indented with four spaces", async () => {
  // Given: valid YAML that uses four-space indentation below `jobs`.
  const repositoryRoot = await createMinimalRepository()
  const workflowsRoot = join(repositoryRoot, ".github/workflows")
  await mkdir(workflowsRoot, { recursive: true })
  await writeFile(
    join(workflowsRoot, "four-spaces.yml"),
    "on: push\njobs:\n    test:\n        runs-on: ubuntu-latest\n        steps:\n            - run: npm test\n",
    "utf8",
  )

  // When: the CLI parses the workflow rather than assuming a two-space layout.
  const report = await scanCliJson(repositoryRoot)

  // Then: the runnable test job satisfies CI readiness.
  assert.equal(checkPassed(report, "ci-workflow"), true)
  assert.equal(checkPassed(report, "release-workflow"), false)
})

test("CLI returns a user-facing error when the path cannot be scanned", async () => {
  // Given: a path that does not exist.
  const missingPath = join(tmpdir(), "oss-pulse-missing-path")

  // When: the CLI scans the missing path.
  const result = await captureFailure([cliPath(), "scan", missingPath, "--format", "json"])

  // Then: the process exits with a command error and explains the bad input.
  assert.equal(result.code, 2)
  assert.match(result.stderr, /path does not exist/)
})

test("CLI returns a concise repository error for inaccessible scan paths", async () => {
  // Given: a valid repository whose workflows directory cannot be read.
  const repositoryRoot = await createMinimalRepository()
  const workflowsRoot = join(repositoryRoot, ".github/workflows")
  await mkdir(workflowsRoot, { recursive: true })
  await writeFile(join(workflowsRoot, "ci.yml"), "name: CI\n", "utf8")
  await chmod(workflowsRoot, 0o000)

  try {
    // When: the CLI scans the inaccessible path.
    const result = await captureFailure([cliPath(), "scan", repositoryRoot, "--format", "json"])

    // Then: it maps EACCES/EPERM to a controlled command error without a stack trace.
    assert.equal(result.code, 2)
    assert.match(result.stderr, /cannot scan .*path is not accessible/)
    assert.doesNotMatch(result.stderr, /EACCES|EPERM|node:internal|at async/)
  } finally {
    await chmod(workflowsRoot, 0o755)
  }
})

test("CLI maps a permission-denied Git ref to a concise command error", async () => {
  // Given: a valid repository whose current branch ref cannot be read by Git.
  const repositoryRoot = await createMinimalRepository()
  const refsRoot = join(repositoryRoot, ".git/refs/heads")
  await chmod(refsRoot, 0o000)

  try {
    // When: the CLI reaches a Git command that reads the current branch ref.
    const result = await captureFailure([cliPath(), "scan", repositoryRoot, "--format", "json"])

    // Then: the inaccessible Git ref becomes a controlled repository error, not a stack.
    assert.equal(result.code, 2)
    assert.match(result.stderr, /cannot scan .*git metadata cannot be read/)
    assert.doesNotMatch(result.stderr, /EACCES|EPERM|node:internal|at async/)
    assert.doesNotMatch(result.stderr, new RegExp(escapeRegExp(cliPath())))
  } finally {
    await chmod(refsRoot, 0o755)
  }
})

test("CLI returns a concise validation error when the format is unsupported", async () => {
  // Given: a real git repository and an unsupported output format.
  const repositoryRoot = await createMinimalRepository()

  // When: the CLI parses the invalid format option.
  const result = await captureFailure([cliPath(), "scan", repositoryRoot, "--format", "xml"])

  // Then: the process exits with a concise validation message.
  assert.equal(result.code, 2)
  assert.match(result.stderr, /invalid options/)
  assert.match(
    result.stderr,
    /format: expected one of json, markdown, release-notes, action-summary, launch-post, contributor-onboarding, triage-suggestions, sarif, github-annotations/,
  )
  assert.doesNotMatch(result.stderr, /invalid_enum_value/)
})

test("CLI returns a concise error when the output file cannot be written", async () => {
  // Given: a valid repository and an output path whose parent does not exist.
  const repositoryRoot = await createMinimalRepository()
  const outputPath = join(repositoryRoot, "missing-parent/report.md")

  // When: the CLI tries to write the report.
  const result = await captureFailure([cliPath(), "scan", repositoryRoot, "--output", outputPath])

  // Then: it reports a controlled command error without exposing a Node stack trace.
  assert.equal(result.code, 2)
  assert.match(result.stderr, /cannot write report/)
  assert.doesNotMatch(result.stderr, /node:internal|at async|ENOENT.*open/)
})

test("CLI scans from the git top-level when invoked inside a repository subdirectory", async () => {
  // Given: a repository whose maintainer files live at the git root.
  const repositoryRoot = await createMinimalRepository()
  const packageDir = join(repositoryRoot, "packages/core")
  await mkdir(packageDir, { recursive: true })
  await writeFile(join(repositoryRoot, "LICENSE"), "MIT\n", "utf8")
  await git(repositoryRoot, ["add", "."])
  await git(repositoryRoot, ["commit", "-m", "Add nested package"])

  // When: the CLI scans a subdirectory inside that repository.
  const result = await execFileAsync(process.execPath, [
    cliPath(),
    "scan",
    packageDir,
    "--format",
    "json",
  ])
  const report = JSON.parse(result.stdout)

  // Then: maintainer-file checks are evaluated from the repository root.
  assert.equal(report.root, await realpath(repositoryRoot))
  assert.equal(report.score, 30)
})

test("CLI treats a path after option terminator as positional input", async () => {
  // Given: an action-style invocation whose repository path looks like a CLI option.
  const workingDirectory = await mkdtemp(join(tmpdir(), "oss-pulse-action-"))
  const injectedOutputPath = join(workingDirectory, "injected-output.md")

  // When: the path is passed after `--`.
  const result = await captureFailureWithCwd(
    [cliPath(), "scan", "--format", "markdown", "--", "--output=injected-output.md"],
    workingDirectory,
  )

  // Then: it is rejected as a missing path and does not create an output file.
  assert.equal(result.code, 2)
  assert.match(result.stderr, /path does not exist/)
  await assert.rejects(realpath(injectedOutputPath), { code: "ENOENT" })
})

test("CLI exits 1 when fail-under is above the repository score", async () => {
  // Given: a sparse repository below the requested score threshold.
  const repositoryRoot = await createMinimalRepository()

  // When: the CLI scans with a fail-under gate above that score.
  const result = await captureFailure([
    cliPath(),
    "scan",
    repositoryRoot,
    "--format",
    "json",
    "--fail-under",
    "50",
  ])
  const report = JSON.parse(result.stdout)

  // Then: the report is still emitted and the process fails for CI.
  assert.equal(result.code, 1)
  assert.equal(report.score, 15)
  assert.equal(report.status, "needs-work")
  assert.equal(result.stderr, "")
})

test("CLI exits 0 when fail-under is met", async () => {
  // Given: a sparse repository above a low score threshold.
  const repositoryRoot = await createMinimalRepository()

  // When: the CLI scans with a fail-under gate below that score.
  const result = await execFileAsync(process.execPath, [
    cliPath(),
    "scan",
    repositoryRoot,
    "--format",
    "json",
    "--fail-under",
    "10",
  ])
  const report = JSON.parse(result.stdout)

  // Then: the report is emitted and the process succeeds.
  assert.equal(report.score, 15)
  assert.equal(report.status, "needs-work")
  assert.equal(result.stderr, "")
})

test("CLI emits compact Markdown when summary-only is enabled", async () => {
  // Given: a sparse repository with next actions.
  const repositoryRoot = await createMinimalRepository()

  // When: the CLI scans with compact Markdown output.
  const result = await execFileAsync(process.execPath, [
    cliPath(),
    "scan",
    repositoryRoot,
    "--format",
    "markdown",
    "--summary-only",
  ])

  // Then: the output keeps the score and actions without the full checks table.
  assert.match(result.stdout, /# OSS Pulse/)
  assert.match(result.stdout, /Score: 15\/100/)
  assert.match(result.stdout, /## Next Actions/)
  assert.doesNotMatch(result.stdout, /## Checks/)
  assert.doesNotMatch(result.stdout, /\| State \| Check \| Points \| Detail \|/)
  assert.equal(result.stderr, "")
})

async function git(cwd: string, args: readonly string[]): Promise<void> {
  await execFileAsync("git", ["-C", cwd, ...args])
}

async function createMinimalRepository(): Promise<string> {
  const repositoryRoot = await mkdtemp(join(tmpdir(), "oss-pulse-repo-"))
  await git(repositoryRoot, ["init"])
  await git(repositoryRoot, ["config", "user.email", "maintainer@example.com"])
  await git(repositoryRoot, ["config", "user.name", "Maintainer"])
  await writeFile(join(repositoryRoot, "README.md"), "# Demo\n", "utf8")
  await git(repositoryRoot, ["add", "."])
  await git(repositoryRoot, ["commit", "-m", "Initial maintenance surface"])
  return repositoryRoot
}

async function scanCliJson(repositoryRoot: string): Promise<unknown> {
  const result = await execFileAsync(process.execPath, [
    cliPath(),
    "scan",
    repositoryRoot,
    "--format",
    "json",
  ])
  return JSON.parse(result.stdout)
}

async function captureFailure(args: readonly string[]): Promise<{
  readonly code: number
  readonly stderr: string
  readonly stdout: string
}> {
  return captureFailureWithCwd(args, process.cwd())
}

async function captureFailureWithCwd(
  args: readonly string[],
  cwd: string,
): Promise<{
  readonly code: number
  readonly stderr: string
  readonly stdout: string
}> {
  try {
    await execFileAsync(process.execPath, [...args], { cwd })
  } catch (error) {
    if (isExecFailure(error)) {
      return { code: error.code, stderr: error.stderr, stdout: error.stdout }
    }
    throw error
  }

  assert.fail("expected command to fail")
}

function cliPath(): string {
  const currentFile = fileURLToPath(import.meta.url)
  return resolve(dirname(currentFile), "../src/cli.js")
}

function projectRoot(): string {
  const currentFile = fileURLToPath(import.meta.url)
  return resolve(dirname(currentFile), "../../..")
}

function isExecFailure(error: unknown): error is {
  readonly code: number
  readonly stderr: string
  readonly stdout: string
} {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "number" &&
    "stderr" in error &&
    typeof error.stderr === "string" &&
    "stdout" in error &&
    typeof error.stdout === "string"
  )
}

function checkPassed(report: unknown, id: string): boolean | undefined {
  const checks = (
    report as { readonly checks: readonly { readonly id: string; readonly passed: boolean }[] }
  ).checks
  return checks.find((check) => check.id === id)?.passed
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
