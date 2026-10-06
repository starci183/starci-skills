/**
 * The app tokens of a repository, read from the repository instead of chosen in its stylelint config.
 *
 * A token an app's `globals.css` declares is an alias of grammar tokens (`starci/globals-shape` refuses anything else there),
 * and other CSS of that repository may reference it (`starci/token-only`, `starci/no-apply-raw`). The managed
 * `stylelint.config.mjs` is exactly
 *
 *     import { loadAppTokens, starciStylelintConfig } from "@starci/stylelint-canon"
 *     export default starciStylelintConfig({ appTokens: loadAppTokens(import.meta.url) })
 *
 * so the list is derived from the stylesheets and there is no repository choice in the file.
 */
import { readdirSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { isGrammarToken } from "./vocabulary.mjs"
import { byCodeUnit } from "./order.mjs"

/** The trees whose `globals.css` files declare app tokens: every app and every workspace package (slots fe.route, fe.package.*). */
const CONTAINERS = ["apps", "packages"]
const SKIPPED = new Set(["node_modules", ".next", "dist", "coverage", "__generated__"])
const DECLARATION = /(?<![\w-])(--[A-Za-z0-9_-]+)\s*:/g
const COMMENT = /\/\*[\s\S]*?\*\//g

const directoriesOf = (dir) => {
  try {
    return readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isDirectory() && !SKIPPED.has(entry.name))
  } catch {
    return []
  }
}

const globalsUnder = (dir) =>
  directoriesOf(dir).flatMap((entry) => globalsUnder(join(dir, entry.name))).concat(
    (() => {
      try {
        return readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isFile() && entry.name === "globals.css").map((entry) => join(dir, entry.name))
      } catch {
        return []
      }
    })(),
  )

/**
 * The custom properties declared by every `globals.css` under `apps/<name>/src` and `packages/<name>/src` of the repository
 * whose config file is `metaUrl` (`import.meta.url`), sorted and without duplicates. A name the grammar publishes is left out:
 * declaring one is `starci/no-token-redefinition`'s finding, and it must not also hide behind the allowance.
 */
export function loadAppTokens(metaUrl) {
  const root = dirname(fileURLToPath(metaUrl))
  const names = new Set()
  for (const container of CONTAINERS) {
    for (const unit of directoriesOf(join(root, container))) {
      for (const file of globalsUnder(join(root, container, unit.name, "src"))) {
        const text = readFileSync(file, "utf8").replace(COMMENT, "")
        for (const [, name] of text.matchAll(DECLARATION)) if (!isGrammarToken(name)) names.add(name)
      }
    }
  }
  return [...names].sort(byCodeUnit)
}
