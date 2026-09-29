/**
 * `starci/raw-brand-value` (HFS R61 `FE_STYLE_TOKEN_ONLY`, the CSS half; the TypeScript half is
 * `@starci/eslint-canon-fe` `no-raw-brand-value`, and both use `lib/brand-value.mjs`'s one definition).
 *
 * A hex colour, a colour function (`rgb`, `hsl`, `oklch`, `color-mix`, ...) or a pixel length is a raw brand
 * value. It may be written only in `modules/brand/brand.css`, on the tokens the grammar declares, with a light and
 * a dark value. Anywhere else it has no dark value, cannot be re-branded and drifts from the brand record.
 */
import { findRawBrandValue } from "./lib/brand-value.mjs"
import { makeRule } from "./lib/make-rule.mjs"
import { fileKind, fileOf } from "./lib/scope.mjs"

export const rawBrandValue = makeRule(
  "raw-brand-value",
  {
    color: (value, prop) =>
      `A raw colour value (\`${value}\`) in \`${prop}\`. Colour values exist only in \`modules/brand/brand.css\`, on the tokens the grammar declares, with a light and a dark value. Use a grammar token: \`var(--...)\`.`,
    length: (value, prop) =>
      `A raw pixel length (\`${value}\`) in \`${prop}\`. Pixel values exist only in \`modules/brand/brand.css\`; spacing and size come from the grammar's scale so they move with density, zoom and breakpoint.`,
  },
  ({ root, report }) => {
    if (fileKind(fileOf(root)) === "brand") return
    root.walkDecls((decl) => {
      const raw = findRawBrandValue(decl.value)
      if (raw) report(decl, raw.kind, [raw.value, decl.prop], { word: raw.value.replace(/\(\.\.\.\)$/, "(") })
    })
  },
)
