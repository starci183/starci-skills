import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { DatabaseSync } from "node:sqlite"

const HASH = /^[a-f0-9]{64}$/

/** RFC 8785-compatible canonical JSON for JSON-domain values. */
export function canonicalize(value) {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value)
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("JCS refuses non-finite numbers")
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`
  if (typeof value === "object") {
    const entries = Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`)
    return `{${entries.join(",")}}`
  }
  throw new TypeError(`JCS refuses ${typeof value}`)
}

export const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex")
export const hashJson = (value) => sha256(Buffer.from(canonicalize(value), "utf8"))

export function objectPath(root, hash, extension = "json") {
  if (!HASH.test(hash)) throw new Error(`invalid sha256: ${hash}`)
  return join(resolve(root), "objects", "sha256", hash.slice(0, 2), `${hash}.${extension}`)
}

export function putJson(root, value) {
  const bytes = canonicalize(value)
  const hash = sha256(Buffer.from(bytes, "utf8"))
  const path = objectPath(root, hash)
  mkdirSync(dirname(path), { recursive: true })
  if (existsSync(path) && readFileSync(path, "utf8") !== bytes) throw new Error(`hash collision at ${path}`)
  if (!existsSync(path)) writeFileSync(path, bytes)
  return { hash, path }
}

export function putMarkdown(root, markdown) {
  const normalized = markdown.replace(/\r\n/g, "\n")
  const hash = sha256(Buffer.from(normalized, "utf8"))
  const path = objectPath(root, hash, "md")
  mkdirSync(dirname(path), { recursive: true })
  if (!existsSync(path)) writeFileSync(path, normalized)
  return { hash, path }
}

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"))
const writeJson = (path, value) => {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

export function statusRefPath(root, gate, status, project, surfaceId, blockId) {
  if (!['layouts', 'blocks'].includes(gate)) throw new Error(`invalid gate: ${gate}`)
  if (!['queued', 'rejected', 'approved'].includes(status)) throw new Error(`invalid status: ${status}`)
  const parts = [resolve(root), gate, status, project, surfaceId]
  if (gate === "blocks") parts.push(blockId)
  return join(...parts) + ".ref.json"
}

/** Move meaning by writing a small ref; immutable objects are never moved. */
export function updateStatusRef(root, gate, project, surfaceId, blockId, ref) {
  const currentPath = statusRefPath(root, gate, "queued", project, surfaceId, blockId)
  const current = existsSync(currentPath) ? readJson(currentPath) : null
  if (current && ref.basedOnHash !== current.objectHash) {
    throw new Error(`stale basedOnHash for ${ref.unitId}: expected ${current.objectHash}`)
  }
  if (!HASH.test(ref.objectHash)) throw new Error("ref objectHash is not sha256")
  if (!existsSync(objectPath(root, ref.objectHash))) throw new Error(`missing object ${ref.objectHash}`)
  const target = statusRefPath(root, gate, ref.status, project, surfaceId, blockId)
  writeJson(target, ref)
  return target
}

const walkFiles = (directory) => {
  if (!existsSync(directory)) return []
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? walkFiles(path) : [path]
  })
}

export function buildMemoryPack({ current, ancestors = [], contracts = [], intent = [], rejections = [], unresolved = [], tokenBudget = 6000 }) {
  if (!current?.objectHash) throw new Error("memory pack requires current head")
  return {
    current,
    approvedAncestors: ancestors,
    contracts,
    intent,
    relevantRejections: rejections.slice(0, 8),
    unresolved,
    tokenBudget,
    omitted: { transcript: true, recoverByHashes: true },
  }
}

export function integrity(root) {
  const errors = []
  const refs = ["layouts", "blocks"].flatMap((gate) =>
    ["queued", "rejected", "approved"].flatMap((status) => walkFiles(join(root, gate, status)).filter((path) => path.endsWith(".ref.json"))),
  )
  for (const path of refs) {
    try {
      const ref = readJson(path)
      if (!HASH.test(ref.objectHash) || !existsSync(objectPath(root, ref.objectHash))) errors.push(`${path}: missing object ${ref.objectHash}`)
      if (ref.decisionHash && !HASH.test(ref.decisionHash)) errors.push(`${path}: invalid decisionHash`)
    } catch (error) { errors.push(`${path}: ${error.message}`) }
  }
  return { ok: errors.length === 0, refs: refs.length, errors }
}

export function rebuildIndex(root, databasePath) {
  mkdirSync(dirname(databasePath), { recursive: true })
  const db = new DatabaseSync(databasePath)
  db.exec(`
    PRAGMA journal_mode=WAL;
    DROP TABLE IF EXISTS artifacts;
    DROP TABLE IF EXISTS units;
    DROP TABLE IF EXISTS documents_fts;
    CREATE TABLE artifacts(hash TEXT PRIMARY KEY, kind TEXT, path TEXT, bytes INTEGER);
    CREATE TABLE units(unit_id TEXT, status TEXT, object_hash TEXT, path TEXT, PRIMARY KEY(unit_id, status));
    CREATE VIRTUAL TABLE documents_fts USING fts5(hash UNINDEXED, text);
  `)
  const insertArtifact = db.prepare("INSERT INTO artifacts VALUES (?, ?, ?, ?)")
  const insertDocument = db.prepare("INSERT INTO documents_fts VALUES (?, ?)")
  for (const path of walkFiles(join(root, "objects", "sha256"))) {
    if (!/\.(?:json|md)$/.test(path)) continue
    const text = readFileSync(path, "utf8")
    const hash = path.match(/([a-f0-9]{64})\.(?:json|md)$/)?.[1]
    if (!hash) continue
    insertArtifact.run(hash, path.endsWith(".json") ? "json" : "markdown", path, statSync(path).size)
    insertDocument.run(hash, text)
  }
  const insertUnit = db.prepare("INSERT OR REPLACE INTO units VALUES (?, ?, ?, ?)")
  for (const gate of ["layouts", "blocks"]) for (const status of ["queued", "rejected", "approved"]) {
    for (const path of walkFiles(join(root, gate, status)).filter((item) => item.endsWith(".ref.json"))) {
      const ref = readJson(path)
      insertUnit.run(ref.unitId, status, ref.objectHash, path)
    }
  }
  const counts = {
    artifacts: db.prepare("SELECT count(*) count FROM artifacts").get().count,
    units: db.prepare("SELECT count(*) count FROM units").get().count,
  }
  db.close()
  return counts
}

export function initialize(root) {
  for (const gate of ["layouts", "blocks"]) for (const status of ["queued", "rejected", "approved", "map"]) mkdirSync(join(root, gate, status), { recursive: true })
  mkdirSync(join(root, "objects", "sha256"), { recursive: true })
  const manifest = join(root, "registry.json")
  if (!existsSync(manifest)) writeJson(manifest, { schemaVersion: 1, hashAlgorithm: "sha256", canonicalization: "RFC8785-JCS", head: "0".repeat(64), lastSequence: 0 })
  return manifest
}

const parseArgs = (args) => Object.fromEntries(args.map((value) => value.split("=", 2)).filter((pair) => pair.length === 2))

async function main() {
  const [command, ...raw] = process.argv.slice(2)
  const args = parseArgs(raw)
  const root = resolve(args.root ?? ".worktrees/registries")
  if (command === "init") console.log(initialize(root))
  else if (command === "hash") console.log(hashJson(JSON.parse(readFileSync(resolve(args.file), "utf8"))))
  else if (command === "put") console.log(JSON.stringify(putJson(root, JSON.parse(readFileSync(resolve(args.file), "utf8")))))
  else if (command === "integrity") { const result = integrity(root); console.log(JSON.stringify(result)); if (!result.ok) process.exitCode = 1 }
  else if (command === "rebuild-index") console.log(JSON.stringify(rebuildIndex(root, resolve(args.database))))
  else if (command === "memory-pack") console.log(JSON.stringify(buildMemoryPack(JSON.parse(readFileSync(resolve(args.file), "utf8"))), null, 2))
  else throw new Error("usage: init|hash|put|integrity|rebuild-index|memory-pack root=<path> [file=<path>] [database=<path>]")
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(error.message); process.exitCode = 1 })
