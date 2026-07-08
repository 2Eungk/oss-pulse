#!/usr/bin/env node
import { writeFile } from "node:fs/promises"
import { pathToFileURL } from "node:url"
import { Command } from "commander"
import { z } from "zod"
import { RepositoryPathError, UnexpectedOutputFormatError } from "./errors.js"
import {
  formatContributorOnboarding,
  formatJson,
  formatMarkdown,
  formatMarkdownSummary,
  formatReleaseNotes,
  formatTriageSuggestions,
} from "./format.js"
import { scanRepository } from "./git.js"
import { formatGithubAnnotations } from "./github-annotations.js"
import { buildReport } from "./report.js"
import { formatSarif } from "./sarif.js"
import { OUTPUT_FORMATS } from "./types.js"

const ScanOptionsSchema = z.object({
  failUnder: z.coerce.number().int().min(0).max(100).optional(),
  format: z.enum(OUTPUT_FORMATS).default("markdown"),
  output: z.string().min(1).optional(),
  summaryOnly: z.boolean().default(false),
})

type ScanOptions = z.infer<typeof ScanOptionsSchema>

type ScanResult = {
  readonly failedThreshold: boolean
  readonly output: string
  readonly score: number
}

export async function runScan(targetPath: string, rawOptions: unknown): Promise<string> {
  const options = ScanOptionsSchema.parse(rawOptions)
  return (await runScanWithOptions(targetPath, options)).output
}

async function runScanWithOptions(targetPath: string, options: ScanOptions): Promise<ScanResult> {
  const signals = await scanRepository(targetPath)
  const report = buildReport(signals)
  const output = formatReport(report, options)

  if (options.output !== undefined) {
    await writeFile(options.output, output, "utf8")
  }

  return {
    failedThreshold: options.failUnder !== undefined && report.score < options.failUnder,
    output,
    score: report.score,
  }
}

export async function main(argv: readonly string[]): Promise<void> {
  const program = new Command()

  program
    .name("oss-pulse")
    .description("Turn repository maintenance signals into an actionable OSS health report.")
    .version("0.1.0")

  program
    .command("scan")
    .argument("[path]", "repository path", ".")
    .option("--fail-under <score>", "exit 1 when score is below this threshold")
    .option(
      "-f, --format <format>",
      "output format: markdown, json, release-notes, contributor-onboarding, triage-suggestions, sarif, or github-annotations",
      "markdown",
    )
    .option("-o, --output <path>", "write report to a file")
    .option("--summary-only", "emit compact Markdown with score and next actions")
    .action(async (targetPath: string, options: unknown) => {
      const scanOptions = ScanOptionsSchema.parse(options)
      const result = await runScanWithOptions(targetPath, scanOptions)
      if (scanOptions.output === undefined) {
        process.stdout.write(result.output)
      }
      if (result.failedThreshold) {
        process.exitCode = 1
      }
    })

  await program.parseAsync([...argv], { from: "node" })
}

function formatReport(report: ReturnType<typeof buildReport>, options: ScanOptions): string {
  switch (options.format) {
    case "json":
      return formatJson(report)
    case "markdown":
      return options.summaryOnly ? formatMarkdownSummary(report) : formatMarkdown(report)
    case "release-notes":
      return formatReleaseNotes(report)
    case "contributor-onboarding":
      return formatContributorOnboarding(report)
    case "triage-suggestions":
      return formatTriageSuggestions(report)
    case "sarif":
      return formatSarif(report)
    case "github-annotations":
      return formatGithubAnnotations(report)
    default:
      return assertNever(options.format)
  }
}

function assertNever(value: never): never {
  throw new UnexpectedOutputFormatError(value)
}

function isCliEntrypoint(argv: readonly string[]): boolean {
  const scriptPath = argv[1]
  return scriptPath !== undefined && import.meta.url === pathToFileURL(scriptPath).href
}

if (isCliEntrypoint(process.argv)) {
  main(process.argv).catch(handleCliFailure)
}

function handleCliFailure(error: unknown): void {
  if (error instanceof RepositoryPathError) {
    process.stderr.write(`${error.message}\n`)
    process.exitCode = 2
    return
  }

  if (error instanceof z.ZodError) {
    process.stderr.write(formatZodError(error))
    process.exitCode = 2
    return
  }

  throw error
}

function formatZodError(error: z.ZodError): string {
  const messages = error.issues.map(formatZodIssue)

  return `invalid options: ${messages.join("; ")}\n`
}

function formatZodIssue(issue: z.ZodIssue): string {
  const path = issue.path.map(String).join(".") || "options"

  switch (issue.code) {
    case z.ZodIssueCode.invalid_enum_value:
      return `${path}: expected one of ${issue.options.join(", ")}`
    default:
      return `${path}: ${issue.message}`
  }
}
