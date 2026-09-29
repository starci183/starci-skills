/**
 * Path predicates shared by the laws that scope themselves by where a file sits.
 *
 * ONE PLACE, because a scope written twice drifts: a rule that thinks `modules/config` is one
 * spelling and a sibling that thinks it is another disagree about which file may read the
 * environment, and the disagreement shows up as a finding nobody can satisfy.
 */

import { normalizePath } from "./path.mjs"

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

/** The one place that may read the environment. */
export const isConfigModule = (filename) => /\/modules\/config\//.test(normalizePath(filename))

/** The one place that may call `fetch`. */
export const isApiClient = (filename) => /\/modules\/api\/client\.[cm]?tsx?$/.test(normalizePath(filename))

/** The route files Next mounts as a segment slot. */
export const ROUTE_SLOTS = ["page", "layout", "template", "loading", "not-found", "default", "route"]

/** The basename of a path without directories. */
export const baseName = (filename) => normalizePath(filename).split("/").pop() ?? ""

/** The file name with its extension removed. */
export const stem = (filename) => baseName(filename).replace(/\.[cm]?[jt]sx?$/, "")
