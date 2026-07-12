import { execFile } from "node:child_process"
import { access, readFile, readdir, stat } from "node:fs/promises"
import { resolve } from "node:path"
import { promisify } from "node:util"
import { isMap, isScalar, isSeq, parseDocument } from "yaml"
import { GitCommandError, RepositoryPathError } from "./errors.js"
import type { MaintainerFiles, RepositorySignals } from "./types.js"

const execFileAsync = promisify(execFile)

type WorkflowSignals = {
  readonly ciWorkflowCount: number
  readonly releaseWorkflow: boolean
}

type WorkflowBehavior = {
  readonly ci: boolean
  readonly release: boolean
}

const NO_WORKFLOW_BEHAVIOR: WorkflowBehavior = { ci: false, release: false }

export async function scanRepository(inputPath: string): Promise<RepositorySignals> {
  const inputRoot = resolve(inputPath)

  try {
    await ensureDirectory(inputRoot)
    await ensureGitRepository(inputRoot)
    const root = await gitTopLevel(inputRoot)

    const [branch, latestCommitIso, commitsLast30Days, contributorsLast90Days, files] =
      await Promise.all([
        git(root, ["branch", "--show-current"]),
        optionalGit(root, ["log", "-1", "--format=%cI"]),
        countGitLines(root, ["log", "--since=30 days ago", "--format=%H"]),
        countGitLines(root, ["shortlog", "-sne", "--since=90 days ago", "HEAD"]),
        scanMaintainerFiles(root),
      ])

    return {
      branch: branch.trim() || "detached",
      commitsLast30Days,
      contributorsLast90Days,
      files,
      latestCommitIso: latestCommitIso.trim() || null,
      root,
    }
  } catch (error) {
    if (error instanceof RepositoryPathError) {
      throw error
    }
    if (isAccessError(error)) {
      throw new RepositoryPathError(inputRoot, "path is not accessible")
    }
    if (error instanceof GitCommandError) {
      throw new RepositoryPathError(inputRoot, "git metadata cannot be read")
    }
    throw error
  }
}

async function ensureDirectory(root: string): Promise<void> {
  try {
    const rootStat = await stat(root)
    if (!rootStat.isDirectory()) {
      throw new RepositoryPathError(root, "path is not a directory")
    }
  } catch (error) {
    if (error instanceof RepositoryPathError) {
      throw error
    }
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      throw new RepositoryPathError(root, "path does not exist")
    }
    throw error
  }
}

async function ensureGitRepository(root: string): Promise<void> {
  try {
    const result = await git(root, ["rev-parse", "--is-inside-work-tree"])
    if (result.trim() !== "true") {
      throw new RepositoryPathError(root, "path is not inside a git repository")
    }
  } catch (error) {
    if (error instanceof GitCommandError) {
      if (isAccessError(error)) {
        throw error
      }
      throw new RepositoryPathError(root, "path is not inside a git repository")
    }
    throw error
  }
}

async function gitTopLevel(root: string): Promise<string> {
  return (await git(root, ["rev-parse", "--show-toplevel"])).trim()
}

async function scanMaintainerFiles(root: string): Promise<MaintainerFiles> {
  const [
    changelog,
    codeowners,
    codeOfConduct,
    contributing,
    funding,
    goodFirstIssueTemplate,
    issueTemplate,
    license,
    pullRequestTemplate,
    readme,
    security,
    workflows,
  ] = await Promise.all([
    existsAny(root, ["CHANGELOG.md", "CHANGELOG"]),
    existsAny(root, ["CODEOWNERS", ".github/CODEOWNERS", "docs/CODEOWNERS"]),
    existsAny(root, ["CODE_OF_CONDUCT.md", ".github/CODE_OF_CONDUCT.md"]),
    existsAny(root, ["CONTRIBUTING.md", ".github/CONTRIBUTING.md"]),
    existsAny(root, [".github/FUNDING.yml", ".github/FUNDING.yaml"]),
    existsAny(root, [
      ".github/ISSUE_TEMPLATE/good_first_issue.md",
      ".github/ISSUE_TEMPLATE/good_first_issue.yml",
      ".github/ISSUE_TEMPLATE/good_first_issue.yaml",
      ".github/ISSUE_TEMPLATE/good-first-issue.md",
      ".github/ISSUE_TEMPLATE/good-first-issue.yml",
      ".github/ISSUE_TEMPLATE/good-first-issue.yaml",
    ]),
    hasIssueTemplate(root),
    existsAny(root, ["LICENSE", "LICENSE.md"]),
    existsAny(root, [".github/PULL_REQUEST_TEMPLATE.md", ".github/pull_request_template.md"]),
    existsAny(root, ["README.md", "README"]),
    existsAny(root, ["SECURITY.md", ".github/SECURITY.md"]),
    scanWorkflows(root),
  ])

  return {
    changelog,
    codeowners,
    codeOfConduct,
    contributing,
    funding,
    goodFirstIssueTemplate,
    issueTemplate,
    license,
    pullRequestTemplate,
    readme,
    releaseWorkflow: workflows.releaseWorkflow,
    security,
    workflowCount: workflows.ciWorkflowCount,
  }
}

async function hasIssueTemplate(root: string): Promise<boolean> {
  if (await existsAny(root, [".github/ISSUE_TEMPLATE.md"])) {
    return true
  }

  const templatesRoot = resolve(root, ".github/ISSUE_TEMPLATE")

  try {
    const entries = await readdir(templatesRoot, { withFileTypes: true })
    return entries.some((entry) => {
      if (!entry.isFile()) {
        return false
      }

      const normalizedName = entry.name.toLowerCase()
      return (
        normalizedName !== "config.yml" &&
        normalizedName !== "config.yaml" &&
        (normalizedName.endsWith(".md") ||
          normalizedName.endsWith(".yml") ||
          normalizedName.endsWith(".yaml"))
      )
    })
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return false
    }
    throw error
  }
}

async function existsAny(root: string, relativePaths: readonly string[]): Promise<boolean> {
  for (const relativePath of relativePaths) {
    try {
      await access(resolve(root, relativePath))
      return true
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        continue
      }
      throw error
    }
  }

  return false
}

/**
 * This intentionally recognizes only locally verifiable, bounded workflow shapes.
 * It does not execute or interpret shell, resolve remote reusable workflows, or infer
 * behavior from workflow names. A local workflow_call file is scanned like every
 * other file, so its own runnable jobs must independently demonstrate a supported
 * behavior.
 */
async function scanWorkflows(root: string): Promise<WorkflowSignals> {
  const workflowsRoot = resolve(root, ".github/workflows")

  try {
    const entries = await readdir(workflowsRoot, { withFileTypes: true })
    const workflows = await Promise.all(
      entries
        .filter(
          (entry) =>
            entry.isFile() &&
            (entry.name.toLowerCase().endsWith(".yml") ||
              entry.name.toLowerCase().endsWith(".yaml")),
        )
        .map(async (entry) =>
          inspectWorkflow(await readFile(resolve(workflowsRoot, entry.name), "utf8")),
        ),
    )

    return {
      ciWorkflowCount: workflows.filter((workflow) => workflow.ci).length,
      releaseWorkflow: workflows.some((workflow) => workflow.release),
    }
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return { ciWorkflowCount: 0, releaseWorkflow: false }
    }
    throw error
  }
}

function inspectWorkflow(contents: string): WorkflowBehavior {
  try {
    const document = parseDocument(contents, { prettyErrors: false, strict: true })
    if (document.errors.length > 0 || !hasRecognizedTrigger(document.get("on", true))) {
      return NO_WORKFLOW_BEHAVIOR
    }

    const jobs = document.get("jobs", true)
    if (!isMap(jobs)) {
      return NO_WORKFLOW_BEHAVIOR
    }

    let ci = false
    let release = false
    for (const job of jobs.items) {
      const behavior = inspectJob(job.value)
      ci ||= behavior.ci
      release ||= behavior.release
    }
    return { ci, release }
  } catch {
    return NO_WORKFLOW_BEHAVIOR
  }
}

function inspectJob(job: unknown): WorkflowBehavior {
  if (!isMap(job) || !conditionAllowsCredit(job.has("if"), job.get("if", true))) {
    return NO_WORKFLOW_BEHAVIOR
  }

  // Reusable jobs, especially remote ones, do not expose locally verifiable behavior.
  // Local workflow_call files are separately discovered by scanWorkflows().
  if (job.has("uses")) {
    return NO_WORKFLOW_BEHAVIOR
  }

  const steps = job.get("steps", true)
  if (!isValidRunsOn(job.get("runs-on", true)) || !isSeq(steps) || steps.items.length === 0) {
    return NO_WORKFLOW_BEHAVIOR
  }

  let ci = false
  let release = false
  for (const step of steps.items) {
    if (!isMap(step) || !conditionAllowsCredit(step.has("if"), step.get("if", true))) {
      continue
    }

    if (hasReleaseAction(step.get("uses", true))) {
      release = true
    }

    const commandBehavior = inspectRunScript(step.get("run", true))
    ci ||= commandBehavior.ci
    release ||= commandBehavior.release
  }
  return { ci, release }
}

function isValidRunsOn(value: unknown): boolean {
  return (
    isNonEmptyString(value) ||
    (isSeq(value) && value.items.length > 0 && value.items.every(isNonEmptyString))
  )
}

function isNonEmptyString(value: unknown): value is { readonly value: string } {
  return isScalar(value) && typeof value.value === "string" && value.value.trim().length > 0
}

/**
 * Conditions are deliberately not interpreted: only an absent condition or the
 * YAML boolean literal `true` can establish locally verifiable behavior. This
 * rejects static false values and all strings, including GitHub expressions.
 */
function conditionAllowsCredit(isPresent: boolean, value: unknown): boolean {
  return !isPresent || (isScalar(value) && value.value === true)
}

function hasRecognizedTrigger(value: unknown): boolean {
  if (isNonEmptyString(value)) {
    return RECOGNIZED_GITHUB_EVENTS.has(value.value)
  }
  if (isSeq(value)) {
    return (
      value.items.length > 0 &&
      value.items.every(
        (item) => isNonEmptyString(item) && RECOGNIZED_GITHUB_EVENTS.has(item.value),
      )
    )
  }
  if (!isMap(value) || value.items.length === 0) {
    return false
  }

  return value.items.every((pair) => {
    if (!isNonEmptyString(pair.key)) {
      return false
    }

    const event = pair.key.value
    return RECOGNIZED_GITHUB_EVENTS.has(event) && isTriggerConfiguration(event, pair.value)
  })
}

function isTriggerConfiguration(event: string, value: unknown): boolean {
  if (event === "schedule") {
    return (
      isSeq(value) &&
      value.items.length > 0 &&
      value.items.every(
        (schedule) =>
          isMap(schedule) &&
          hasOnlyAllowedMapKeys(schedule, SCHEDULE_CONFIGURATION_KEYS) &&
          isNonEmptyString(schedule.get("cron", true)),
      )
    )
  }

  if (GITHUB_EVENTS_WITHOUT_CONFIGURATION.has(event)) {
    return value === null
  }

  if (value === null) {
    return true
  }

  if (event === "push") {
    return hasOnlyStringSequenceConfiguration(value, PUSH_CONFIGURATION_KEYS)
  }

  if (event === "pull_request" || event === "pull_request_target") {
    return hasOnlyStringSequenceConfiguration(value, PULL_REQUEST_CONFIGURATION_KEYS)
  }

  if (event === "workflow_run") {
    return hasOnlyStringSequenceConfiguration(value, WORKFLOW_RUN_CONFIGURATION_KEYS)
  }

  if (event === "repository_dispatch") {
    return hasOnlyRequiredStringSequenceConfiguration(value, "types")
  }

  if (event === "workflow_dispatch") {
    return isWorkflowDispatchConfiguration(value)
  }

  if (event === "workflow_call") {
    return isWorkflowCallConfiguration(value)
  }

  return hasOnlyRequiredStringSequenceConfiguration(value, "types")
}

function hasOnlyStringSequenceConfiguration(
  value: unknown,
  allowedKeys: ReadonlySet<string>,
): boolean {
  return (
    isMap(value) &&
    hasOnlyAllowedMapKeys(value, allowedKeys) &&
    value.items.every((pair) => isNonEmptyStringSequence(pair.value))
  )
}

function hasOnlyRequiredStringSequenceConfiguration(value: unknown, key: string): boolean {
  return (
    isMap(value) &&
    hasOnlyAllowedMapKeys(value, new Set([key])) &&
    value.items.length === 1 &&
    isNonEmptyStringSequence(value.get(key, true))
  )
}

function isWorkflowDispatchConfiguration(value: unknown): boolean {
  if (!isMap(value) || !hasOnlyAllowedMapKeys(value, WORKFLOW_DISPATCH_CONFIGURATION_KEYS)) {
    return false
  }

  if (!value.has("inputs")) {
    return true
  }

  const inputs = value.get("inputs", true)
  return (
    isMap(inputs) &&
    inputs.items.every(
      (input) => isNonEmptyString(input.key) && isWorkflowDispatchInputDefinition(input.value),
    )
  )
}

function isWorkflowDispatchInputDefinition(value: unknown): boolean {
  if (!isMap(value) || !hasOnlyAllowedMapKeys(value, WORKFLOW_DISPATCH_INPUT_CONFIGURATION_KEYS)) {
    return false
  }

  if (!value.has("description") || !isStringScalar(value.get("description", true))) {
    return false
  }

  return value.items.every((pair) => {
    if (!isNonEmptyString(pair.key)) {
      return false
    }
    if (pair.key.value === "description") {
      return isStringScalar(pair.value)
    }
    if (pair.key.value === "required") {
      return isBooleanScalar(pair.value)
    }
    if (pair.key.value === "default") {
      return isScalar(pair.value)
    }
    if (pair.key.value === "type") {
      return isWorkflowDispatchInputType(pair.value)
    }
    return pair.key.value === "options" && isNonEmptyScalarSequence(pair.value)
  })
}

function isWorkflowCallConfiguration(value: unknown): boolean {
  return (
    isMap(value) &&
    hasOnlyAllowedMapKeys(value, WORKFLOW_CALL_CONFIGURATION_KEYS) &&
    value.items.every(
      (section) =>
        isMap(section.value) &&
        section.value.items.every((entry) => isNonEmptyString(entry.key) && isMap(entry.value)),
    )
  )
}

function hasOnlyAllowedMapKeys(value: unknown, allowedKeys: ReadonlySet<string>): boolean {
  if (!isMap(value)) {
    return false
  }

  const seenKeys = new Set<string>()
  return value.items.every((pair) => {
    if (
      !isNonEmptyString(pair.key) ||
      !allowedKeys.has(pair.key.value) ||
      seenKeys.has(pair.key.value)
    ) {
      return false
    }
    seenKeys.add(pair.key.value)
    return true
  })
}

function isNonEmptyStringSequence(value: unknown): boolean {
  return isSeq(value) && value.items.length > 0 && value.items.every(isNonEmptyString)
}

function isNonEmptyScalarSequence(value: unknown): boolean {
  return isSeq(value) && value.items.length > 0 && value.items.every(isScalar)
}

function isStringScalar(value: unknown): value is { readonly value: string } {
  return isScalar(value) && typeof value.value === "string"
}

function isBooleanScalar(value: unknown): boolean {
  return isScalar(value) && typeof value.value === "boolean"
}

function isWorkflowDispatchInputType(value: unknown): boolean {
  return (
    isStringScalar(value) &&
    (value.value === "boolean" ||
      value.value === "choice" ||
      value.value === "number" ||
      value.value === "string" ||
      value.value === "environment")
  )
}

/**
 * A script is inspectable only when every nonblank, noncomment line is one exact,
 * simple command from the supported vocabulary. Any shell syntax outside that
 * vocabulary makes the whole script ineligible for behavioral credit.
 */
function inspectRunScript(value: unknown): WorkflowBehavior {
  if (!isNonEmptyString(value)) {
    return NO_WORKFLOW_BEHAVIOR
  }

  const lines = value.value
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))

  if (lines.length === 0 || lines.some((line) => hasUnsupportedShellSyntax(line))) {
    return NO_WORKFLOW_BEHAVIOR
  }

  const commands = lines.map(parseSupportedCommand)
  if (commands.some((command) => command === null)) {
    return NO_WORKFLOW_BEHAVIOR
  }

  return {
    ci: commands.some((command) => command?.ci === true),
    release: commands.some((command) => command?.release === true),
  }
}

function hasUnsupportedShellSyntax(line: string): boolean {
  return (
    /(?:&&|\|\||[;|&`]|\$\(|\$\{|<<|>>|[<>]|[(){}])/.test(line) ||
    /(?:^|\s)(?:if|case|for|while|until|then|do|done|fi|esac|function|eval|source|\.|bash|sh|zsh)(?:\s|$)/i.test(
      line,
    ) ||
    /(?:^|\s)[A-Za-z_][A-Za-z0-9_]*=/.test(line) ||
    /\$[A-Za-z_]/.test(line) ||
    /['"\\]/.test(line)
  )
}

function parseSupportedCommand(line: string): WorkflowBehavior | null {
  const words = line.split(/\s+/)
  if (words.some((word) => !/^[A-Za-z0-9@._/=-]+$/.test(word))) {
    return null
  }

  const normalized = words.map((word) => word.toLowerCase())
  const ci = isCiCommand(normalized)
  const release = isReleaseCommand(normalized)
  return ci || release ? { ci, release } : null
}

function isCiCommand(words: readonly string[]): boolean {
  const [command, subcommand, next] = words
  const packageManager =
    command === "npm" || command === "pnpm" || command === "yarn" || command === "bun"
  const ciTask = (task: string | undefined): boolean =>
    task === "test" ||
    task === "lint" ||
    task === "build" ||
    task === "check" ||
    task === "typecheck"

  return (
    (packageManager && (ciTask(subcommand) || (subcommand === "run" && ciTask(next)))) ||
    (command === "node" && subcommand === "--test") ||
    ((command === "npx" || command === "vitest" || command === "jest") &&
      (command !== "npx" || next === undefined || next === "vitest" || next === "jest") &&
      (command === "vitest" ||
        command === "jest" ||
        subcommand === "vitest" ||
        subcommand === "jest")) ||
    command === "pytest" ||
    (command === "python" && subcommand === "-m" && next === "pytest") ||
    (command === "uv" && subcommand === "run" && next === "pytest") ||
    (command === "go" && subcommand === "test") ||
    (command === "cargo" && subcommand === "test") ||
    (command === "deno" && subcommand === "test") ||
    (command === "tsc" && subcommand === "--noemit") ||
    (command === "biome" && subcommand === "check")
  )
}

function isReleaseCommand(words: readonly string[]): boolean {
  const [command, subcommand, next] = words
  const packageManager = command === "npm" || command === "pnpm"
  const semanticReleaseInvocation =
    command === "semantic-release" ||
    ((command === "npx" ||
      command === "npm" ||
      command === "pnpm" ||
      command === "yarn" ||
      command === "bunx") &&
      (command === "npm" || command === "pnpm" || command === "yarn"
        ? (subcommand === "exec" || subcommand === "dlx") && next === "semantic-release"
        : subcommand === "semantic-release"))

  return (
    (packageManager && subcommand === "publish") ||
    (command === "yarn" && subcommand === "npm" && next === "publish") ||
    (command === "gh" &&
      subcommand === "release" &&
      next === "create" &&
      isGhReleaseCreate(words)) ||
    semanticReleaseInvocation
  )
}

function isGhReleaseCreate(words: readonly string[]): boolean {
  const tag = words[3]
  return (
    tag !== undefined &&
    !tag.startsWith("-") &&
    !words.some((word) => word === "-h" || word === "--help" || word === "--version")
  )
}

function hasReleaseAction(value: unknown): boolean {
  return isNonEmptyString(value) && RELEASE_ACTIONS.test(value.value.trim())
}

const RECOGNIZED_GITHUB_EVENTS = new Set([
  "branch_protection_rule",
  "check_run",
  "check_suite",
  "create",
  "delete",
  "deployment",
  "deployment_status",
  "discussion",
  "discussion_comment",
  "fork",
  "gollum",
  "issue_comment",
  "issues",
  "label",
  "merge_group",
  "milestone",
  "page_build",
  "project",
  "project_card",
  "project_column",
  "public",
  "pull_request",
  "pull_request_comment",
  "pull_request_review",
  "pull_request_review_comment",
  "pull_request_target",
  "push",
  "registry_package",
  "release",
  "repository_dispatch",
  "schedule",
  "status",
  "watch",
  "workflow_call",
  "workflow_dispatch",
  "workflow_run",
])

const GITHUB_EVENTS_WITHOUT_CONFIGURATION = new Set([
  "create",
  "delete",
  "fork",
  "gollum",
  "page_build",
  "public",
  "status",
  "watch",
])

const SCHEDULE_CONFIGURATION_KEYS = new Set(["cron"])

const PUSH_CONFIGURATION_KEYS = new Set([
  "branches",
  "branches-ignore",
  "tags",
  "tags-ignore",
  "paths",
  "paths-ignore",
])

const PULL_REQUEST_CONFIGURATION_KEYS = new Set([
  "branches",
  "branches-ignore",
  "paths",
  "paths-ignore",
  "types",
])

const WORKFLOW_RUN_CONFIGURATION_KEYS = new Set([
  "workflows",
  "types",
  "branches",
  "branches-ignore",
])

const WORKFLOW_DISPATCH_CONFIGURATION_KEYS = new Set(["inputs"])

const WORKFLOW_DISPATCH_INPUT_CONFIGURATION_KEYS = new Set([
  "description",
  "required",
  "default",
  "type",
  "options",
])

const WORKFLOW_CALL_CONFIGURATION_KEYS = new Set(["inputs", "secrets", "outputs"])

const RELEASE_ACTIONS =
  /^(?:softprops\/action-gh-release|changesets\/action|(?:google-github-actions\/)?release-please-action)@[^\s@]+$/i

async function countGitLines(root: string, args: readonly string[]): Promise<number> {
  const output = await optionalGit(root, args)
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0).length
}

async function optionalGit(root: string, args: readonly string[]): Promise<string> {
  try {
    return await git(root, args)
  } catch (error) {
    if (error instanceof GitCommandError) {
      if (isAccessError(error)) {
        throw error
      }
      return ""
    }
    throw error
  }
}

async function git(root: string, args: readonly string[]): Promise<string> {
  try {
    const result = await execFileAsync("git", ["-C", root, ...args])
    return result.stdout
  } catch (error) {
    if (isExecError(error)) {
      throw new GitCommandError(args, root, error.stderr ?? "", error.code, error)
    }
    throw error
  }
}

function isExecError(error: unknown): error is {
  readonly code: string | undefined
  readonly stderr: string | undefined
} {
  return (
    typeof error === "object" &&
    error !== null &&
    (("stderr" in error && typeof error.stderr === "string") ||
      ("code" in error && typeof error.code === "string"))
  )
}

function isAccessError(error: unknown): boolean {
  return (
    error instanceof Error && "code" in error && (error.code === "EACCES" || error.code === "EPERM")
  )
}
