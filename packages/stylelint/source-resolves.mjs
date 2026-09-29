/**
 * `starci/source-resolves` (HFS R61, finding `FE_STYLE_SOURCE_UNRESOLVED`): every `@source` path exists.
 *
 * Tailwind scans the paths an `@source` names for class names. A path that points at nothing (a `node_modules`
 * copy that is not there, a folder that moved) scans nothing and no error is raised: the utilities the grammar's
 * components use silently go missing from the build. The path is resolved against the stylesheet's own folder; for a
 * glob, the folder in front of the first wildcard must exist. `inline(...)` sources name no path and are skipped.
 */
import fs from "node:fs"
import path from "node:path"
import { makeRule } from "./lib/make-rule.mjs"
import { fileOf } from "./lib/scope.mjs"

export const sourceResolves = makeRule(
  "source-resolves",
  {
    missing: (source, folder) =>
      `\`@source ${source}\` resolves to nothing (${folder} does not exist). Tailwind scans no files there and drops the utilities they use silently. Fix the path.`,
  },
  ({ root, report }) => {
    const file = fileOf(root)
    if (!file) return
    root.walkAtRules("source", (rule) => {
      const match = /^\s*(?:not\s+)?(["'])(.*?)\1\s*$/.exec(rule.params)
      if (!match) return
      const spec = match[2]
      const wildcard = spec.search(/[*?[{]/)
      const stem = wildcard < 0 ? spec : spec.slice(0, spec.lastIndexOf("/", wildcard) + 1)
      const target = path.resolve(path.dirname(file), stem === "" ? "." : stem)
      if (!fs.existsSync(target)) report(rule, "missing", [rule.params.trim(), target.replaceAll("\\", "/")], { word: spec })
    })
  },
)
