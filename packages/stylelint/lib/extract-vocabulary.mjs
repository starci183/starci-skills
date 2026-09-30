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

/**
 * The status tones: the HeroUI status vocabulary (owner 2026-09-30). Each one is a solid tone (`--<tone>`, ink
 * `--<tone>-foreground`) and a SOFT PAIR, `--<tone>-soft` (the tint) and `--<tone>-soft-foreground` (the ink a status
 * shown as text, an icon or a dot uses), in light and in dark. The grammar derives the soft pair for success, warning
 * and danger; HeroUI has none for info, so the vocabulary adds it here: this list is the one soft-pair extension, and
 * `extractVocabulary` refuses a tone whose solid pair the grammar does not declare.
 */
export const STATUS_TONES = ["success", "warning", "danger", "info"]

/** The soft-pair tokens of one tone. */
export const softPairOf = (tone) => [`--${tone}-soft`, `--${tone}-soft-foreground`, `--${tone}-soft-hover`]

const inFamily = (name) => FAMILY_PREFIXES.some((prefix) => name.startsWith(prefix))

/** The width breakpoints (as `<n>rem`, ascending) the grammar's media queries use: the one scale app CSS may cite. */
function extractBreakpoints(texts) {
  const found = new Set()
  for (const text of texts) {
    for (const media of text.matchAll(/@media([^{]*)\{/g)) {
      for (const width of media[1].matchAll(/(?:min|max)-width\s*:\s*([\d.]+)(?:rem|em)/g)) found.add(Number(width[1]))
    }
  }
  return [...found].sort((a, b) => a - b).map((value) => `${value}rem`)
}

/** `{ declared, vendor, breakpoints, statusTones }`: sorted un-prefixed names the grammar declares, and reads without declaring. */
export function extractVocabulary(grammarSrcDir) {
  const declared = new Set()
  const referenced = new Set()
  const texts = []
  for (const file of GRAMMAR_CSS) {
    const text = fs.readFileSync(path.join(grammarSrcDir, file), "utf8").replace(/\/\*[\s\S]*?\*\//g, "")
    texts.push(text)
    for (const match of text.matchAll(/(?:^|[;{\s])(--[\w-]+)\s*:/g)) declared.add(match[1])
    for (const match of text.matchAll(/var\(\s*(--[\w-]+)/g)) referenced.add(match[1])
  }
  for (const tone of STATUS_TONES) {
    for (const name of [`--${tone}`, `--${tone}-foreground`]) {
      if (!declared.has(name)) throw new Error(`STATUS_TONES lists ${tone}, but the grammar CSS does not declare ${name}`)
    }
    for (const name of softPairOf(tone)) declared.add(name)
  }
  const own = [...declared].filter((name) => !inFamily(name)).sort()
  const vendor = [...referenced].filter((name) => !declared.has(name) && !inFamily(name)).sort()
  return { declared: own, vendor, breakpoints: extractBreakpoints(texts), statusTones: [...STATUS_TONES] }
}
