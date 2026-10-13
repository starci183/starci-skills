/**
 * The one door between the front-end lint rules and the fe-stack catalog (`knowledge/hfs/fe-stack.yaml`): for each common
 * front-end concern the ONE canonical library, its HFS home and the alternatives a front end never imports.
 *
 * The catalog is read from this package's `runtime/` copy, the same way the slot manifest and the canon pins are (a byte copy
 * of the runtime's knowledge file, refreshed by `scripts/hfs/sync-runtime.mjs`), so a rule in a product repository judges
 * against the catalog of the canon version it installed. A rule that needs the catalog and finds none stops the lint run
 * with an error naming the fix: a rule must not guess which libraries are forbidden.
 */
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { parseYaml } from "../runtime/engine/yaml.mjs"

const CATALOG = join(dirname(fileURLToPath(import.meta.url)), "..", "runtime", "knowledge", "hfs", "fe-stack.yaml")

/** @type {{ concerns: ReadonlyArray<object>, forbidden: ReadonlyMap<string, object> } | null} */
let loaded = null

/**
 * The parsed catalog: its concerns, and every forbidden package mapped to the concern that forbids it.
 *
 * @returns {{ concerns: ReadonlyArray<object>, forbidden: ReadonlyMap<string, object> }} The catalog.
 */
export const feStack = () => {
  if (loaded) return loaded
  let text
  try {
    text = readFileSync(CATALOG, "utf8")
  } catch (error) {
    throw new Error(`@starci/eslint-canon-fe reads the fe-stack catalog from runtime/knowledge/hfs/fe-stack.yaml and it is missing (${error.code ?? error.message}): regenerate the runtime copy (scripts/hfs/sync-runtime.mjs)`)
  }
  const concerns = parseYaml(text)?.concerns
  if (!Array.isArray(concerns) || concerns.length === 0) throw new Error("runtime/knowledge/hfs/fe-stack.yaml declares no concerns: the fe-stack catalog is malformed")
  const forbidden = new Map()
  for (const concern of concerns) for (const name of concern.forbids ?? []) forbidden.set(String(name), concern)
  loaded = Object.freeze({ concerns: Object.freeze(concerns), forbidden })
  return loaded
}

/**
 * The package a module specifier names (`@scope/name` or `name`, its subpath dropped), or null for a relative, aliased,
 * node-builtin or empty specifier.
 *
 * @param {unknown} specifier - The module specifier.
 * @returns {string | null} The package name.
 */
export const packageNameOf = (specifier) => {
  const text = typeof specifier === "string" ? specifier : ""
  if (text === "" || text.startsWith(".") || text.startsWith("/") || text.startsWith("@/") || text.startsWith("~/") || text.startsWith("node:")) return null
  const parts = text.split("/")
  if (text.startsWith("@")) return parts.length >= 2 && parts[1] !== "" ? `${parts[0]}/${parts[1]}` : null
  return parts[0]
}

/**
 * The concern whose `forbids` lists the package a specifier names, else null.
 *
 * @param {unknown} specifier - The module specifier.
 * @returns {object | null} The concern (`{ id, packages, home, pattern, forbids, why }`).
 */
export const forbiddingConcern = (specifier) => {
  const name = packageNameOf(specifier)
  return name === null ? null : feStack().forbidden.get(name) ?? null
}

/**
 * The canonical packages of a concern.
 *
 * @param {string} id - The concern id (`icons`, `graphql`, ...).
 * @returns {ReadonlyArray<string>} Its packages; empty for an unknown concern.
 */
export const canonicalPackages = (id) => feStack().concerns.find((concern) => concern.id === id)?.packages ?? []
