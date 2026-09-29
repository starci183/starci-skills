/**
 * `starci/globals-import-order` (HFS R61 `FE_STYLE_TOKEN_ONLY`): `globals.css` imports in one order.
 *
 *   1. `tailwindcss`
 *   2. `@heroui/styles/css`
 *   3. the grammar family stylesheet: `@starci/grammar/<common|core|heritage|offset-pop>.css`
 *   4. `modules/brand/brand.css`
 *
 * then every `@source`, then the token blocks `globals-shape` allows. The order is the cascade: the brand layer sets
 * the tokens the family declared, which the vendor styles read, which Tailwind's utilities sit on. Repeating a step
 * (`common.css` then `core.css`) is fine; going back is not. An import that is none of the four is refused: another
 * stylesheet in the global sheet is a second design system loaded before the first.
 */
import { makeRule } from "./lib/make-rule.mjs"
import { fileKind, fileOf } from "./lib/scope.mjs"

const STEPS = ["tailwindcss", "@heroui/styles/css", "a grammar family stylesheet", "modules/brand/brand.css"]

/** The step of an import specifier, or -1 when it is none of the four. */
const stepOf = (specifier) => {
  if (specifier === "tailwindcss") return 0
  if (specifier === "@heroui/styles/css") return 1
  if (/^@starci\/grammar\/(?:common|core|heritage|offset-pop)(?:\.css|\/styles\.css)$/.test(specifier)) return 2
  if (/(?:^|\/)modules\/brand\/brand\.css$/.test(specifier)) return 3
  return -1
}

export const globalsImportOrder = makeRule(
  "globals-import-order",
  {
    unknown: (specifier) =>
      `\`@import ${specifier}\` is not one of the standard imports (${STEPS.join(", ")}). The global sheet imports only those, in that order.`,
    order: (specifier, step, previous) =>
      `\`@import ${specifier}\` (${STEPS[step]}) comes after ${STEPS[previous]}. Import in the order ${STEPS.join(", ")}.`,
    late: (specifier) => `\`@import ${specifier}\` comes after an \`@source\`. Imports first, then \`@source\`.`,
  },
  ({ root, report }) => {
    if (fileKind(fileOf(root)) !== "globals") return
    let highest = -1
    let sawSource = false
    root.each((node) => {
      if (node.type !== "atrule") return
      const name = node.name.toLowerCase()
      if (name === "source") sawSource = true
      if (name !== "import") return
      const specifier = /^\s*(?:url\(\s*)?(["']?)([^"')\s]+)\1/.exec(node.params)?.[2] ?? node.params.trim()
      const step = stepOf(specifier)
      if (step < 0) return report(node, "unknown", [specifier], { word: specifier })
      if (sawSource) return report(node, "late", [specifier], { word: specifier })
      if (step < highest) return report(node, "order", [specifier, step, highest], { word: specifier })
      highest = step
    })
  },
)
