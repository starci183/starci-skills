/**
 * Path predicates shared by the laws that scope themselves by where a file sits.
 *
 * ONE PLACE, because a scope written twice drifts: a rule that thinks `modules/config` is one
 * spelling and a sibling that thinks it is another disagree about which file may read the
 * environment, and the disagreement shows up as a finding nobody can satisfy.
 */

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

/** A spec or test file - it asserts about production shapes rather than being one. */
export const isSpecFile = (filename) => /\.(?:test|spec)\.(?:ts|tsx|mts|cts)$/.test(normalizePath(filename))

/** Product source: under `src/`, and not a spec. */
export const isProductFile = (filename) => {
  const file = normalizePath(filename)
  return file.includes("/src/") && !isSpecFile(file)
}

/** The e2e tree: `e2e/**` and the Playwright config beside it. */
export const isE2eFile = (filename) => {
  const file = normalizePath(filename)
  return /(?:^|\/)e2e\//.test(file) || /(?:^|\/)playwright\.config\.[cm]?[jt]s$/.test(file)
}

/** The one place that may read the environment: slot `fe.modules.config`. */
export const isConfigModule = (context) => inSlot(context, "fe.modules.config")

/** The one place that may call `fetch`: slot `fe.transport.client` (one-app repository) or `fe.package.api.client` (shared package). */
export const isApiClient = (context) => inSlot(context, "fe.transport.client", "fe.package.api.client")

/** The file that may declare the one Outcome union: slot `fe.transport.outcome` or `fe.package.api.outcome`. */
export const isOutcomeModule = (context) => inSlot(context, "fe.transport.outcome", "fe.package.api.outcome")

/** The route files Next mounts as a segment slot. */
export const ROUTE_SLOTS = ["page", "layout", "template", "loading", "not-found", "default", "route"]

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
