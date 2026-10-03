/**
 * Path predicates shared by the laws that scope themselves by where a file sits.
 *
 * ONE PLACE, because a scope written twice drifts: a rule that thinks `modules/config` is one
 * spelling and a sibling that thinks it is another disagree about which file may read the
 * environment, and the disagreement shows up as a finding nobody can satisfy.
 */

import { dirname, join, resolve } from "node:path"
import { hfsOf } from "./hfs.mjs"
import { normalizePath } from "./path.mjs"

/**
 * The HFS slot id of the file being linted, read from the slot view (`settings.starci.hfs`).
 *
 * @param {object} context - The ESLint rule context.
 * @returns {string | null} The slot id, or null when no slot owns the file.
 */
export const slotOfFile = (context) => hfsOf(context).slotOf(context.filename || context.getFilename())

/**
 * True when the file being linted sits in one of the given slots.
 *
 * @param {object} context - The ESLint rule context.
 * @param {...string} ids - Slot ids.
 * @returns {boolean} Whether the file's slot is one of them.
 */
export const inSlot = (context, ...ids) => ids.includes(slotOfFile(context))

/** The filename a rule is linting. */
export const fileOf = (context) => context.filename || context.getFilename()

/** The classification of the linted file from the slot view: `{ slot, root, bindings, kind?, role? }` or a no-slot status. */
export const classOf = (context) => hfsOf(context).classify(fileOf(context))

/** The tier of the linted file in the import direction matrix (`route`, `feature`, `components`, `hooks`, `foundation`, `modules`, `transport`, `package`, `none`), or null when no slot owns it. */
export const tierOfFile = (context) => hfsOf(context).tierOf(fileOf(context))

/** The folder kind the slot reports for the linted file (a component layer, a feature kind), or null. */
export const kindOfFile = (context) => classOf(context).kind ?? null

/** The role the slot reports for the linted file (`entry`, `drawing`, `styles`, `shared`, `page`, `layout`, ...), or null. */
export const roleOfFile = (context) => classOf(context).role ?? null

/** The tiers of product source: everything a slot places in an app's route, feature, component, hook or module tiers and in a shared package. */
const PRODUCT_TIERS = new Set(["route", "feature", "components", "hooks", "foundation", "modules", "transport", "package"])

/** Product source: a file of a product tier. */
export const isProductSource = (context) => PRODUCT_TIERS.has(tierOfFile(context))

/** A file of a component tier: slot `fe.components` or `fe.package.ui`, inside one of its layer folders (blocks, composites, branches, leaves). */
export const isComponentFile = (context) => inSlot(context, "fe.components", "fe.package.ui") && kindOfFile(context) !== null

/** True when the given file (an absolute or repo-relative name, e.g. where an import resolves to) sits in a component layer of slot `fe.components` or `fe.package.ui`. */
export const isComponentPath = (context, file) => {
  const found = hfsOf(context).classify(file)
  return (found.slot === "fe.components" || found.slot === "fe.package.ui") && found.kind !== undefined
}

/** The one place that may read the environment: slot `fe.modules.config`. */
export const isConfigModule = (context) => inSlot(context, "fe.modules.config")

/** The one place that may call `fetch`: slot `fe.transport.client` (one-app repository) or `fe.package.api.client` (shared package). */
export const isApiClient = (context) => inSlot(context, "fe.transport.client", "fe.package.api.client")

/** The file that may declare the one Outcome union: the file of the slot the manifest marks `outcomeHome`. */
export const isOutcomeModule = (context) => {
  const hfs = hfsOf(context)
  const slot = slotOfFile(context)
  return slot !== null && hfs.slot(slot)?.outcomeHome === true
}

/** The basename of a path without directories. */
export const baseName = (filename) => normalizePath(filename).split("/").pop() ?? ""

/** The file name with its extension removed. */
export const stem = (filename) => baseName(filename).replace(/\.[cm]?[jt]sx?$/, "")

/**
 * The references in the file that resolve to no declaration of the file, i.e. to a global (`fetch`, `Request`, `window`).
 * An import, a parameter, a local `const fetch` binds the name and is not one; a type-position use is not a value reference.
 *
 * @param {object} context - The ESLint rule context.
 * @param {Set<string>} names - The global names to look for.
 * @returns {Array<object>} The ESTree identifiers that reference such a global as a value.
 */
export const globalReferences = (context, names) => {
  const sourceCode = context.sourceCode ?? context.getSourceCode()
  const found = []
  const visit = (scope) => {
    for (const reference of scope.references) {
      if (!names.has(reference.identifier.name) || reference.isValueReference === false) continue
      if (!reference.resolved || reference.resolved.defs.length === 0) found.push(reference.identifier)
    }
    scope.childScopes.forEach(visit)
  }
  visit(sourceCode.scopeManager.globalScope)
  return found
}

/**
 * Where an import specifier of the linted file points, as an absolute path without an extension: a relative specifier, or `@/`
 * from the owning app's `src/` (the app directory is the directory part of slot `fe.app.next`). Null for a package or a file no app owns.
 *
 * @param {object} context - The ESLint rule context.
 * @param {string} specifier - The module specifier.
 * @returns {string | null} The absolute path, or null.
 */
export const resolveImport = (context, specifier) => {
  const hfs = hfsOf(context)
  const file = fileOf(context)
  if (specifier.startsWith(".")) return resolve(dirname(file), specifier)
  if (!specifier.startsWith("@/")) return null
  const app = hfs.classify(file).bindings?.app
  if (app === undefined) return null
  const appDirectory = hfs.slot("fe.app.next").path.split("/{")[0].replace("<app>", app)
  return join(hfs.repoRoot, appDirectory, "src", specifier.slice(2))
}

/**
 * The classification of the file an import specifier resolves to, trying the extensions a module file has. Null when the
 * specifier resolves to no path.
 *
 * @param {object} context - The ESLint rule context.
 * @param {string} specifier - The module specifier.
 * @returns {object | null} The slot classification (`{ slot, root, role, ... }`) of the first candidate a slot owns.
 */
export const classifyImport = (context, specifier) => {
  const target = resolveImport(context, specifier)
  if (target === null) return null
  const hfs = hfsOf(context)
  // The specifier names no extension: try the ones a module file has and take the candidate a slot gives a role, else the first a slot owns.
  const owned = [`${target}.ts`, `${target}.tsx`, `${target}/index.ts`, `${target}/index.tsx`, target]
    .map((candidate) => hfs.classify(candidate))
    .filter((found) => found.slot && found.status === "owned")
  return owned.find((found) => found.role) ?? owned[0] ?? null
}
