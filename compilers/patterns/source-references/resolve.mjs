import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const sourceRoot = resolve(here, "../../../..")
const workspaceRoot = resolve(sourceRoot, ".workspace")
const catalog = JSON.parse(readFileSync(resolve(here, "references.json"), "utf8"))
const args = process.argv.slice(2)
const roleIndex = args.indexOf("--role")
const role = roleIndex < 0 ? undefined : args[roleIndex + 1]

if (role !== "fe" && role !== "be") {
  throw new Error("Usage: resolve.mjs --role <fe|be>")
}

const entry = catalog.references.find((candidate) => candidate.role === role)
if (entry === undefined) throw new Error(`No source reference declared for role ${role}`)
if (!/^[a-f0-9]{40}$/.test(entry.commit)) throw new Error(`Reference ${entry.id} is not commit-pinned`)
if (entry.ref !== `git+${entry.repository}@${entry.commit}:${entry.path}`) {
  throw new Error(`Reference ${entry.id} has a mismatched immutable ref`)
}

const managedWorkspacePath = `references/${entry.id}`
const managed = resolve(workspaceRoot, managedWorkspacePath)
const registryPath = resolve(workspaceRoot, "pattern-references.json")
const registry = existsSync(registryPath)
  ? JSON.parse(readFileSync(registryPath, "utf8"))
  : { references: [] }
const declared = registry.references.find((candidate) => candidate.id === entry.id)

const git = (path, command) => execFileSync("git", ["-C", path, ...command], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
}).trim()

const verify = (path) => {
  if (typeof path !== "string" || !existsSync(resolve(path, ".git"))) return false
  try {
    const remote = git(path, ["remote", "get-url", "origin"]).replace(/\.git$/, "")
    const expected = entry.repository.replace(/\.git$/, "")
    git(path, ["cat-file", "-e", `${entry.commit}^{commit}`])
    return remote === expected
  } catch {
    return false
  }
}

const checkout = declared?.immutableRef === entry.ref
  && declared.workspacePath === managedWorkspacePath
  && verify(managed)
  ? managed
  : undefined

if (checkout === undefined) {
  process.stdout.write(`${JSON.stringify({
    status: "needs-init",
    id: entry.id,
    role,
    immutableRef: entry.ref,
    init: "starci-init",
    managedFallback: managed,
  })}\n`)
  process.exitCode = 2
} else {
  const result = { status: "ready", id: entry.id, role, immutableRef: entry.ref, checkout }
  process.stdout.write(`${JSON.stringify(result)}\n`)
}
