import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { z } from "zod"

const PackageJsonSchema = z.object({
  version: z.string().min(1),
})

export function getPackageVersion(): string {
  const packageJsonPath = findPackageJson(dirname(fileURLToPath(import.meta.url)))
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"))
  return PackageJsonSchema.parse(packageJson).version
}

function findPackageJson(startDirectory: string): string {
  let currentDirectory = startDirectory

  while (true) {
    const candidate = join(currentDirectory, "package.json")
    if (existsSync(candidate)) {
      return candidate
    }

    const parentDirectory = dirname(currentDirectory)
    if (parentDirectory === currentDirectory) {
      throw new Error("oss-pulse package.json was not found")
    }

    currentDirectory = parentDirectory
  }
}
