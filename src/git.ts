import { execFile } from "node:child_process"
import { access, readdir, stat } from "node:fs/promises"
import { resolve } from "node:path"
import { promisify } from "node:util"
import { GitCommandError, RepositoryPathError } from "./errors.js"
import type { MaintainerFiles, RepositorySignals } from "./types.js"

const execFileAsync = promisify(execFile)

export async function scanRepository(inputPath: string): Promise<RepositorySignals> {
  const inputRoot = resolve(inputPath)
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
    codeOfConduct,
    contributing,
    funding,
    goodFirstIssueTemplate,
    issueTemplate,
    license,
    pullRequestTemplate,
    readme,
    releaseWorkflow,
    security,
    workflowCount,
  ] = await Promise.all([
    existsAny(root, ["CHANGELOG.md", "CHANGELOG"]),
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
    existsAny(root, [".github/ISSUE_TEMPLATE.md", ".github/ISSUE_TEMPLATE"]),
    existsAny(root, ["LICENSE", "LICENSE.md"]),
    existsAny(root, [".github/PULL_REQUEST_TEMPLATE.md", ".github/pull_request_template.md"]),
    existsAny(root, ["README.md", "README"]),
    existsAny(root, [
      ".github/workflows/release.yml",
      ".github/workflows/release.yaml",
      ".github/workflows/publish.yml",
      ".github/workflows/publish.yaml",
    ]),
    existsAny(root, ["SECURITY.md", ".github/SECURITY.md"]),
    countWorkflowFiles(root),
  ])

  return {
    changelog,
    codeOfConduct,
    contributing,
    funding,
    goodFirstIssueTemplate,
    issueTemplate,
    license,
    pullRequestTemplate,
    readme,
    releaseWorkflow,
    security,
    workflowCount,
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

async function countWorkflowFiles(root: string): Promise<number> {
  const workflowsRoot = resolve(root, ".github/workflows")

  try {
    const entries = await readdir(workflowsRoot, { withFileTypes: true })
    return entries.filter(
      (entry) => entry.isFile() && (entry.name.endsWith(".yml") || entry.name.endsWith(".yaml")),
    ).length
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return 0
    }
    throw error
  }
}

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
      throw new GitCommandError(args, root, error.stderr)
    }
    throw error
  }
}

function isExecError(error: unknown): error is { readonly stderr: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "stderr" in error &&
    typeof error.stderr === "string"
  )
}
