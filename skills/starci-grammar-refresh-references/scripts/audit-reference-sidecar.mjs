import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

const grammarRoot = process.argv[2]
if (grammarRoot === undefined) throw new Error("Usage: audit-reference-sidecar.mjs <grammar-root>")

const root = resolve(grammarRoot)
const referencesFile = resolve(root, "references.json")
if (!existsSync(referencesFile)) {
  process.stdout.write(`${JSON.stringify({ status: "none", references: [] })}\n`)
  process.exit(0)
}

const capsules = JSON.parse(readFileSync(resolve(root, "capsules.json"), "utf8"))
const catalog = JSON.parse(readFileSync(referencesFile, "utf8"))
const capsuleIds = new Set(capsules.capsules.map((capsule) => capsule.id))
const immutableRef = /^git\+https:\/\/[^@\s]+@[a-f0-9]{40}:.+$/
const ids = new Set()
const errors = []

for (const entry of catalog.references ?? []) {
  if (ids.has(entry.id)) errors.push(`duplicate reference id: ${entry.id}`)
  ids.add(entry.id)
  if (!capsuleIds.has(entry.capsuleId)) errors.push(`unknown capsule: ${entry.capsuleId}`)
  if (!immutableRef.test(entry.ref ?? "")) errors.push(`reference is not immutable: ${entry.id}`)
}

if (errors.length > 0) throw new Error(errors.join("; "))
process.stdout.write(`${JSON.stringify({ status: "valid", references: catalog.references.length })}\n`)
