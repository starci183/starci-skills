import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const sourceRoot = resolve(here, "../../../..")
const workspaceRoot = resolve(sourceRoot, ".workspace")
const catalog = JSON.parse(readFileSync(resolve(here, "references.json"), "utf8"))
const args = process.argv.slice(2)
const roleIndex = args.indexOf("--role")
const role = roleIndex < 0 ? undefined : args[roleIndex + 1]
const materialize = args.includes("--materialize")

if (role !== "fe" && role !== "be") {
  throw new Error("Usage: resolve.mjs --role <fe|be> [--materialize]")
}

const entry = catalog.references.find((candidate) => candidate.role === role)
if (entry === undefined) throw new Error(`No source reference declared for role ${role}`)
if (!/^[a-f0-9]{40}$/.test(entry.commit)) throw new Error(`Reference ${entry.id} is not commit-pinned`)
if (entry.ref !== `git+${entry.repository}@${entry.commit}:${entry.path}`) {
  throw new Error(`Reference ${entry.id} has a mismatched immutable ref`)
}

const localRegistryPath = resolve(workspaceRoot, "pattern-references.json")
const localRegistry = existsSync(localRegistryPath)
  ? JSON.parse(readFileSync(localRegistryPath, "utf8"))
  : { version: 1, references: [] }
const declared = localRegistry.references.find((candidate) => candidate.id === entry.id)?.diskPath
const managed = resolve(workspaceRoot, "cache", "pattern-references", entry.id)

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

let checkout = verify(declared) ? declared : verify(managed) ? managed : undefined
if (checkout === undefined && materialize) {
  mkdirSync(dirname(managed), { recursive: true })
  if (!existsSync(resolve(managed, ".git"))) {
    mkdirSync(managed, { recursive: true })
    execFileSync("git", ["init", managed], { stdio: "ignore" })
    git(managed, ["remote", "add", "origin", entry.repository])
  }
  git(managed, ["fetch", "--depth=1", "origin", entry.commit])
  git(managed, ["checkout", "--detach", entry.commit])
  checkout = managed
}

if (checkout === undefined) {
  process.stdout.write(`${JSON.stringify({ status: "missing", id: entry.id, role, immutableRef: entry.ref })}\n`)
  process.exitCode = 2
} else {
  const result = { status: "ready", id: entry.id, role, immutableRef: entry.ref, checkout }
  process.stdout.write(`${JSON.stringify(result)}\n`)
  if (!existsSync(localRegistryPath) && checkout === managed) {
    writeFileSync(localRegistryPath, `${JSON.stringify({ version: 1, references: [{ id: entry.id, diskPath: checkout }] }, null, 2)}\n`)
  }
}
