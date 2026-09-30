/**
 * The values of one theme, the way the browser would settle them on the grammar root: the grammar's own declarations
 * (`grammar-values.generated.mjs`: the common root, then the family root, then the dark root for the dark theme) with
 * the brand layer's declarations over them (the brand is unlayered and the grammar sits in a layer, so the brand
 * wins), and `var()` resolved through the result.
 */
import { GRAMMAR_VALUES } from "./grammar-values.generated.mjs"
import { parseColor } from "./color.mjs"

/**
 * @param {"light" | "dark"} theme
 * @param {string} family `common`, or a family the grammar declares values for
 * @param {Map<string, import("postcss").Declaration>} brand the brand layer's winning declarations of this theme
 * @returns {Map<string, { value: string, decl: import("postcss").Declaration | null }>}
 */
export function themeEnvironment(theme, family, brand) {
  const env = new Map()
  const layers = [GRAMMAR_VALUES.light.common, GRAMMAR_VALUES.light[family]]
  if (theme === "dark") layers.push(GRAMMAR_VALUES.dark.common, GRAMMAR_VALUES.dark[family])
  for (const layer of layers) for (const [name, value] of Object.entries(layer ?? {})) env.set(name, { value, decl: null })
  for (const [name, decl] of brand) env.set(name, { value: decl.value.trim(), decl })
  return env
}

/** The index just past the `)` that closes the `(` at `open`, or -1. */
function closing(text, open) {
  let depth = 0
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === "(") depth += 1
    else if (text[i] === ")" && (depth -= 1) === 0) return i + 1
  }
  return -1
}

/**
 * `value` with every `var(--x[, fallback])` replaced by what it resolves to, or `{ missing }` naming the first custom
 * property that has no value (and no fallback) or that refers to itself.
 */
export function expand(env, value, seen = []) {
  let out = ""
  let cursor = 0
  for (let at = value.indexOf("var(", cursor); at !== -1; at = value.indexOf("var(", cursor)) {
    const end = closing(value, at + 3)
    if (end === -1) return { missing: value }
    const [name, ...rest] = splitTopLevelComma(value.slice(at + 4, end - 1))
    const token = name.trim()
    let inner
    if (seen.includes(token)) inner = { missing: token }
    else if (env.has(token)) inner = expand(env, env.get(token).value, [...seen, token])
    else if (rest.length > 0) inner = expand(env, rest.join(",").trim(), seen)
    else inner = { missing: token }
    if (inner.missing !== undefined) return inner
    out += value.slice(cursor, at) + inner.text
    cursor = end
  }
  return { text: out + value.slice(cursor) }
}

function splitTopLevelComma(text) {
  const parts = []
  let depth = 0
  let from = 0
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === "(") depth += 1
    else if (text[i] === ")") depth -= 1
    else if (text[i] === "," && depth === 0) {
      parts.push(text.slice(from, i))
      from = i + 1
    }
  }
  parts.push(text.slice(from))
  return parts
}

/**
 * The colour a custom property settles on: `{ color }`, or `{ unresolved }` with the reason: the token, or the
 * property it needs, has no value; or the value is not a colour this module reads.
 */
export function resolveColor(env, name) {
  if (!env.has(name)) return { unresolved: `\`${name}\` has no value` }
  const expanded = expand(env, env.get(name).value, [name])
  if (expanded.missing !== undefined) return { unresolved: `\`${name}\` needs \`${expanded.missing}\`, which has no value` }
  const color = parseColor(expanded.text)
  return color === null ? { unresolved: `\`${name}\` is \`${expanded.text}\`, which is not a colour this check reads (hex, rgb, hsl, oklab, oklch, color-mix)` } : { color }
}
