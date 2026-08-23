import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const defaultSource = resolve(here, "../../../..")
const args = process.argv.slice(2)
const sourceIndex = args.indexOf("--source")
const sourceRoot = resolve(sourceIndex < 0 ? defaultSource : args[sourceIndex + 1])
const apply = args.includes("--apply")
const plan = args.includes("--plan")
if (apply === plan) throw new Error("Use exactly one of --plan or --apply")

const trustRoot = resolve(sourceRoot, ".claude")
const workspaceRoot = resolve(sourceRoot, ".workspaces", "local")
const routeRoot = resolve(workspaceRoot, "routes")
const catalog = JSON.parse(readFileSync(
  resolve(trustRoot, "compilers", "patterns", "source-references", "references.json"),
  "utf8",
))
const registryPath = resolve(workspaceRoot, "pattern-references.json")
const current = existsSync(registryPath)
  ? JSON.parse(readFileSync(registryPath, "utf8"))
  : { version: 1, references: [] }

const normalizeRemote = (value) => value.replace(/\.git$/, "")
const git = (path, command) => execFileSync("git", ["-C", path, ...command], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
}).trim()
const verify = (path, entry) => {
  if (typeof path !== "string" || !existsSync(resolve(path, ".git"))) return false
  try {
    const remote = normalizeRemote(git(path, ["remote", "get-url", "origin"]))
    git(path, ["cat-file", "-e", `${entry.commit}^{commit}`])
    return remote === normalizeRemote(entry.repository)
  } catch {
    return false
  }
}

const routeCandidates = []
if (existsSync(routeRoot)) {
  for (const project of readdirSync(routeRoot, { withFileTypes: true })) {
    if (!project.isDirectory()) continue
    const projectRoot = resolve(routeRoot, project.name)
    for (const role of readdirSync(projectRoot, { withFileTypes: true })) {
      const routePath = resolve(projectRoot, role.name, "config.json")
      if (!role.isDirectory() || !existsSync(routePath)) continue
      try {
        const route = JSON.parse(readFileSync(routePath, "utf8"))
        routeCandidates.push(route.repository?.diskPath)
      } catch {
        // Invalid product routes remain owned by the normal workspace initializer.
      }
    }
  }
}

const receipts = []
const nextReferences = []
for (const entry of catalog.references) {
  const declared = current.references.find((candidate) => candidate.id === entry.id)
  const routed = routeCandidates.find((candidate) => verify(candidate, entry))
  const workspacePath = `references/${entry.id}`
  const managed = resolve(workspaceRoot, workspacePath)
  let ready = declared?.immutableRef === entry.ref
    && declared.workspacePath === workspacePath
    && verify(managed, entry)
  let action = ready ? "reuse" : routed === undefined ? "install-git" : "install-local"

  if (!ready && apply) {
    mkdirSync(dirname(managed), { recursive: true })
    if (!existsSync(resolve(managed, ".git"))) {
      if (routed === undefined) {
        mkdirSync(managed, { recursive: true })
        execFileSync("git", ["init", managed], { stdio: "ignore" })
        git(managed, ["remote", "add", "origin", entry.repository])
      } else {
        execFileSync("git", ["clone", "--no-hardlinks", "--no-checkout", routed, managed], { stdio: "ignore" })
        git(managed, ["remote", "set-url", "origin", entry.repository])
      }
    }
    if (!verify(managed, entry)) git(managed, ["fetch", "--depth=1", "origin", entry.commit])
    git(managed, ["checkout", "--detach", entry.commit])
    ready = verify(managed, entry)
    action = routed === undefined ? "installed-git" : "installed-local"
  }

  receipts.push({ action, id: entry.id, immutableRef: entry.ref, workspacePath })
  if (ready) nextReferences.push({ id: entry.id, immutableRef: entry.ref, workspacePath })
}

if (apply) {
  mkdirSync(workspaceRoot, { recursive: true })
  writeFileSync(registryPath, `${JSON.stringify({ version: 1, references: nextReferences }, null, 2)}\n`)
}

process.stdout.write(`${JSON.stringify({
  status: apply ? "applied" : "planned",
  registryPath,
  references: receipts,
})}\n`)
