/**
 * Reads the token vocabulary out of the grammar package's own CSS, so the list the rules judge against is
 * derived from what the grammar ships and never typed by hand. `vocabulary.generated.mjs` is this function's
 * output; the twin test recomputes it and fails when the two differ.
 *
 * A family token is any custom property under a family prefix (`--grammar-`, `--starci-core-`, `--heritage-`,
 * `--offset-pop-`): the grammar sets some of them from TypeScript, so a prefix is the honest boundary. The
 * un-prefixed tokens are the semantic layer the grammar declares (`--accent`, `--surface`, ...) plus the vendor
 * tokens it reads but does not declare (`--radius-md`, `--font-mono`).
 */
import fs from "node:fs"
import path from "node:path"

/** The four namespaces the grammar owns. */
export const FAMILY_PREFIXES = ["--grammar-", "--starci-core-", "--heritage-", "--offset-pop-"]

/** The grammar CSS the vocabulary is read from, relative to the grammar package. */
export const GRAMMAR_CSS = [
  "common/styles.css",
  "common/components-forms.css",
  "common/components-navigation.css",
  "common/components-overlays.css",
  "core/styles.css",
  "heritage/styles.css",
  "offset-pop/styles.css",
  "offset-pop/components-navigation.css",
]

const inFamily = (name) => FAMILY_PREFIXES.some((prefix) => name.startsWith(prefix))

/** `{ declared, vendor }`: sorted un-prefixed names the grammar declares, and reads without declaring. */
export function extractVocabulary(grammarSrcDir) {
  const declared = new Set()
  const referenced = new Set()
  for (const file of GRAMMAR_CSS) {
    const text = fs.readFileSync(path.join(grammarSrcDir, file), "utf8").replace(/\/\*[\s\S]*?\*\//g, "")
    for (const match of text.matchAll(/(?:^|[;{\s])(--[\w-]+)\s*:/g)) declared.add(match[1])
    for (const match of text.matchAll(/var\(\s*(--[\w-]+)/g)) referenced.add(match[1])
  }
  const own = [...declared].filter((name) => !inFamily(name)).sort()
  const vendor = [...referenced].filter((name) => !declared.has(name) && !inFamily(name)).sort()
  return { declared: own, vendor }
}
