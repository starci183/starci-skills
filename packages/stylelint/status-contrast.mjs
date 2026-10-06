/**
 * `starci/status-contrast` (HFS R61 `FE_STYLE_TOKEN_ONLY`): the brand layer's status colours follow HeroUI's soft pairs
 * and reach a readable contrast, in light and in dark.
 *
 * THE PATTERN (owner 2026-09-30). Every status tone (`success`, `warning`, `danger`, `info`, the grammar's
 * `STATUS_TONES`) has a solid pair and a SOFT PAIR: `--<tone>-soft` (the tint) and `--<tone>-soft-foreground` (the
 * ink of a status shown as text, an icon or a dot). The soft foreground reaches 3:1 on the soft tint and on the page
 * background (a bare glyph has only the page under it), body text (`--foreground`) reaches 4.5:1 on the background, and
 * the solid tone is never the text colour: as `--<tone>-soft-foreground` it must clear 4.5:1 or it is refused. No
 * extreme contrast is asked for.
 *
 * HOW IT JUDGES. It settles each theme's values the way the browser does (`lib/theme-values.mjs`: the grammar's own
 * declarations, then the brand layer's, with `var()` resolved), so a soft pair the brand does not write is judged as the
 * grammar derives it from the brand's tones. A value it cannot resolve is a finding, never a pass. A soft token that
 * one theme declares and the other does not is a finding: a compound `:root, .light, .dark` block declares for all three.
 */
import { contrast, composite, sameColor } from "./lib/color.mjs"
import { GRAMMAR_VALUES } from "./lib/grammar-values.generated.mjs"
import { declarationsFor, declaredIn, readBrandBlocks } from "./lib/brand-blocks.mjs"
import { makeRule } from "./lib/make-rule.mjs"
import { fileKind, fileOf } from "./lib/scope.mjs"
import { resolveColor, themeEnvironment } from "./lib/theme-values.mjs"
import { STATUS_TONES } from "./lib/vocabulary.generated.mjs"
import { FAMILY_PREFIXES } from "./lib/vocabulary.mjs"
import { byCodeUnit } from "./lib/order.mjs"

/** The lowest contrast of a soft foreground on its tint and on the page, of a solid tone as text, and of body text. */
const MIN_SOFT = 3
const MIN_TEXT = 4.5

const THEMES = ["light", "dark"]
const ratio = (value) => value.toFixed(2)

/** The families the brand writes tokens of, from the family prefixes the grammar publishes (`--starci-core-` is `core`). */
function familiesIn(blocks) {
  const found = new Set()
  for (const block of blocks) {
    block.node.each((child) => {
      if (child.type !== "decl") return
      for (const family of Object.keys(GRAMMAR_VALUES.light)) {
        if (FAMILY_PREFIXES.some((prefix) => prefix.endsWith(`${family}-`) && child.prop.startsWith(prefix))) found.add(family)
      }
    })
  }
  return [...found].sort(byCodeUnit)
}

export const statusContrast = makeRule(
  "status-contrast",
  {
    softContrast: (tone, theme, value) =>
      `\`--${tone}-soft-foreground\` on \`--${tone}-soft\` is ${value}:1 in ${theme}, under ${MIN_SOFT}:1. A status tint carries its ink at ${MIN_SOFT}:1 or better; mix the ink further toward \`--foreground\`.`,
    glyph: (tone, theme, value) =>
      `\`--${tone}-soft-foreground\` on \`--background\` is ${value}:1 in ${theme}, under ${MIN_SOFT}:1. A bare status icon or dot has only the page under it and takes the soft foreground; it needs ${MIN_SOFT}:1 there.`,
    body: (theme, value) => `\`--foreground\` on \`--background\` is ${value}:1 in ${theme}, under ${MIN_TEXT}:1. Body text needs ${MIN_TEXT}:1 on the page.`,
    solidText: (tone, theme, value) =>
      `\`--${tone}-soft-foreground\` is the solid \`--${tone}\` in ${theme} and reads ${value}:1, under ${MIN_TEXT}:1. A solid status tone is a fill; text and icons take the soft foreground, mixed toward \`--foreground\` until it reads.`,
    incomplete: (name, has, lacks) => `\`${name}\` is declared for ${has} and not for ${lacks}. Every status soft token has a value in both themes.`,
    unresolved: (theme, reason) => `Cannot judge the ${theme} status contrast: ${reason}. A value the check cannot settle is not a pass.`,
    family: (names) => `brand.css writes tokens of more than one grammar family (${names}). The status contrast is judged for one family; a brand layer belongs to one.`,
  },
  ({ root, report }) => {
    if (fileKind(fileOf(root)) !== "brand") return
    const blocks = readBrandBlocks(root)
    const families = familiesIn(blocks)
    if (families.length > 1) return report(root.first ?? root, "family", [families.join(", ")])
    const family = families[0] ?? "common"
    const anchor = root.first ?? root

    // A soft token declared for one theme only.
    const declared = Object.fromEntries(THEMES.map((theme) => [theme, declaredIn(blocks, theme)]))
    for (const tone of STATUS_TONES) {
      for (const name of [`--${tone}-soft`, `--${tone}-soft-foreground`]) {
        const [has, lacks] = declared.light.has(name) ? ["light", "dark"] : ["dark", "light"]
        if (declared.light.has(name) === declared.dark.has(name)) continue
        const decl = declarationsFor(blocks, has).get(name)
        report(decl ?? anchor, "incomplete", [name, has, lacks], decl ? { word: name } : {})
      }
    }

    for (const theme of THEMES) {
      const brand = declarationsFor(blocks, theme)
      const env = themeEnvironment(theme, family, brand)
      const at = (name) => env.get(name)?.decl ?? anchor
      const unresolved = (name, reason) => report(at(name), "unresolved", [theme, reason])
      const page = resolveColor(env, "--background")
      const ink = resolveColor(env, "--foreground")
      if (page.unresolved) return unresolved("--background", page.unresolved)
      if (page.color.alpha < 1) return unresolved("--background", "`--background` is not opaque, so nothing can be composited on it")
      if (ink.unresolved) unresolved("--foreground", ink.unresolved)
      else if (contrast(ink.color, page.color) < MIN_TEXT) report(at("--foreground"), "body", [theme, ratio(contrast(ink.color, page.color))])

      for (const tone of STATUS_TONES) {
        const [soft, softInk, solid] = [`--${tone}-soft`, `--${tone}-soft-foreground`, `--${tone}`].map((name) => resolveColor(env, name))
        const failed = [soft, softInk].map((entry, index) => (entry.unresolved ? [[`--${tone}-soft`, `--${tone}-soft-foreground`][index], entry.unresolved] : null)).find(Boolean)
        if (failed) {
          unresolved(failed[0], `${failed[1]}; the ${tone} tone has no soft pair in ${theme}`)
          continue
        }
        const tint = composite(soft.color, page.color)
        const onTint = contrast(softInk.color, tint)
        const onPage = contrast(softInk.color, page.color)
        if (!solid.unresolved && sameColor(softInk.color, solid.color)) {
          const weakest = Math.min(onTint, onPage)
          if (weakest < MIN_TEXT) report(at(`--${tone}-soft-foreground`), "solidText", [tone, theme, ratio(weakest)])
          continue
        }
        if (onTint < MIN_SOFT) report(at(`--${tone}-soft-foreground`), "softContrast", [tone, theme, ratio(onTint)])
        if (onPage < MIN_SOFT) report(at(`--${tone}-soft-foreground`), "glyph", [tone, theme, ratio(onPage)])
      }
    }
  },
)
