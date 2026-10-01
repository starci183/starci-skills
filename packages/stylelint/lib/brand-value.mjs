/**
 * The one notion of a "raw brand value" in the StarCi lint canon.
 *
 * `@starci/eslint-canon-fe` `no-raw-brand-value` (brand-values.mjs) judges TypeScript with these exact three
 * patterns; this package judges CSS with them. They are copied, not imported, because the two packages are
 * published apart; `brand-value.spec.mjs` reads eslint-canon-fe's source and fails when a pattern differs, so the
 * two cannot drift. A change to a pattern is made in both files in one commit.
 *
 * A raw brand value is a colour written as a value (hex, or a colour function) or a length written in pixels.
 * Both belong only in `modules/brand/brand.css`, on the tokens the grammar declares.
 */

/** A hex colour: 3, 4, 6 or 8 digits, not a longer word and not part of an identifier. */
export const HEX_COLOR = /(?<![\w&])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])/

/** A functional colour notation. */
export const COLOR_FUNCTION = /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color-mix)\(/i

/** A pixel length, not inside an arbitrary-value bracket and not part of a longer number or word. */
export const PIXEL_LENGTH = /(?<![\w.#[-])-?(?:\d+\.?\d*|\.\d+)px\b/

/** A `url(...)` reference: a fragment such as `url(#add)` is an address, not a colour. */
const URL_REFERENCE = /url\(\s*(?:"[^"]*"|'[^']*'|[^)]*)\)/gi

/**
 * The first raw brand value in a CSS value, or null: `{ kind: "color" | "length", value }`.
 * A colour wins over a length, as in the TypeScript rule.
 */
export function findRawBrandValue(text) {
  if (typeof text !== "string") return null
  const cleaned = text.replace(URL_REFERENCE, "url()")
  const color = HEX_COLOR.exec(cleaned) || COLOR_FUNCTION.exec(cleaned)
  if (color) return { kind: "color", value: color[0].replace(/\($/, "(...)") }
  const length = PIXEL_LENGTH.exec(cleaned)
  if (length) return { kind: "length", value: length[0] }
  return null
}
