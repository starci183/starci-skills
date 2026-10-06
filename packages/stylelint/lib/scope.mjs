/**
 * Which kind of stylesheet a file is. Every rule reads the kind from the path, so one flat config governs a
 * whole repository and no per-file override can exist to turn a rule off.
 */

/** The single file that may hold raw brand values, relative to any app or package root. */
export const BRAND_FILE = "modules/brand/brand.css"

const normalize = (file) => String(file || "").replaceAll("\\", "/")

/** `"brand" | "globals" | "module" | "css"` for a stylesheet path. */
export function fileKind(file) {
  const path = normalize(file)
  if (path === BRAND_FILE || path.endsWith(`/${BRAND_FILE}`)) return "brand"
  const base = path.slice(path.lastIndexOf("/") + 1)
  if (base === "globals.css") return "globals"
  if (base.endsWith(".module.css")) return "module"
  return "css"
}

/** The file of a postcss root, or "" for code linted without a name. */
export const fileOf = (root) => root.source?.input?.file ?? ""

// -- the two themes of the brand layer -------------------------------------------------------------------------

const quoted = `["']?`
const LIGHT = new RegExp(String.raw`^(?::root|html|\.light|\[data-theme=${quoted}light${quoted}\]|:root\[data-theme=${quoted}light${quoted}\]|:root\.light)$`)
const DARK = new RegExp(String.raw`^(?:\.dark|\[data-theme=${quoted}dark${quoted}\]|:root\[data-theme=${quoted}dark${quoted}\]|:root\.dark|html\.dark)$`)
/** The grammar's family root: the element that re-declares the family tokens on itself. */
const FAMILY_ROOT = String.raw`\.grammar-common-root\[data-grammar-family=${quoted}[a-z][a-z0-9-]*${quoted}\]`
const theme = (name) => String.raw`\[data-grammar-theme=${quoted}${name}${quoted}\]`
const FAMILY_LIGHT = new RegExp(`^${FAMILY_ROOT}(?:${theme("light")})?$`)
const FAMILY_DARK = new RegExp(String.raw`^(?:\.dark\s+${FAMILY_ROOT}|${FAMILY_ROOT}(?:\.dark|${theme("dark")}))$`)
const FAMILY_SYSTEM = new RegExp(`^${FAMILY_ROOT}(?:${theme("system")})?$`)
/** The selectors that match the document root whatever the theme is. */
const ALWAYS = /^(?::root|html)$/
const DARK_MEDIA = /^\(\s*prefers-color-scheme\s*:\s*dark\s*\)$/

/** `"light"`, `"dark"` or null for one selector of a brand-layer rule (`:root`, `.light`, `.dark`, the family root...). */
export function themeOfSelector(selector) {
  const text = selector.trim()
  if (LIGHT.test(text) || FAMILY_LIGHT.test(text)) return "light"
  if (DARK.test(text) || FAMILY_DARK.test(text)) return "dark"
  return null
}

/** True for the selector of the follow-the-system block inside `@media (prefers-color-scheme: dark)`. */
export const isSystemSelector = (selector) => ALWAYS.test(selector.trim()) || FAMILY_SYSTEM.test(selector.trim())

/** True for the prelude of the dark media query. */
export const isDarkMedia = (params) => DARK_MEDIA.test(params.trim())

/** True when the selector matches the document root in every theme, so a dark theme still inherits it. */
export const isAlwaysSelector = (selector) => ALWAYS.test(selector.trim())
