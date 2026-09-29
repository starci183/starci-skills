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
