export class RepositoryPathError extends Error {
  readonly name = "RepositoryPathError"

  constructor(
    readonly path: string,
    readonly reason: string,
  ) {
    super(`cannot scan ${path}: ${reason}`)
  }
}

export class GitCommandError extends Error {
  readonly name = "GitCommandError"

  constructor(
    readonly command: readonly string[],
    readonly cwd: string,
    readonly stderr: string,
  ) {
    super(`git ${command.join(" ")} failed in ${cwd}`)
  }
}

export class ReportWriteError extends Error {
  readonly name = "ReportWriteError"

  constructor(readonly path: string) {
    super(`cannot write report to ${path}`)
  }
}

export class UnexpectedOutputFormatError extends Error {
  readonly name = "UnexpectedOutputFormatError"

  constructor(readonly format: never) {
    super(`unexpected output format: ${format}`)
  }
}
