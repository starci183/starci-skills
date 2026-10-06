/**
 * The rule that holds `status-colors.md` (HFS R61 `FE_STYLE_TOKEN_ONLY`, the class-name half of the soft-pair contrast
 * obligation; the brand layer's own contrast belongs to `@starci/stylelint-canon` `starci/status-contrast`).
 *
 * A STATUS TONE HAS TWO FACES. The SOLID tone (`--success`) is a fill: a button, a bar, a badge dot's disc, with
 * `--success-foreground` ink on it. A status shown as TEXT or as an ICON uses the SOFT pair, the way a HeroUI flat Chip
 * does: `--success-soft-foreground` ink, on `--success-soft` when it sits on a tint. The brand layer is checked to
 * make that ink readable (3:1 on the tint and on the page); the solid tone is only the mid-luminance hue of the brand
 * and reads 3.8:1 or worse on white, so as a text colour it fails the contrast the soft pair was built to give.
 *
 * WHAT IT READS. Every static class string a component writes: the `className` / `class` attribute of an element (through
 * `cn()`, `clsx()`, conditionals, arrays, template text), and a string in a constant or in a `classes` entry. The tones
 * are the grammar's `STATUS_TONES` (`lib/status-tones.generated.mjs`, generated from the grammar with the stylelint
 * vocabulary), never a list typed here. A class is a finding when it paints text, an icon or a text decoration with a solid
 * tone (`text-success`, `fill-danger`, `stroke-warning`, `decoration-info`, with any variant and opacity).
 *
 * WHAT IT LEAVES ALONE: the soft pair (`text-success-soft-foreground`, `bg-success-soft`), a solid fill with its own ink
 * (`bg-success text-success-foreground`), a solid border, ring or outline (`border-danger`, `ring-warning`: a
 * boundary is not text), and a class that only shares a prefix (`text-successful`).
 */

import { attributeValue } from "./lib/ast.mjs"
import { STATUS_TONES } from "./lib/status-tones.generated.mjs"

/** The utility families that paint text, an icon or a text decoration. */
const TEXT_PAINT = ["text", "fill", "stroke", "decoration"]

/** `text-success`, `text-success/60`, `text-success-hover`, with an optional `!` and any variants before it. */
const SOLID_TEXT = new RegExp(`^!?(${TEXT_PAINT.join("|")})-(${STATUS_TONES.join("|")})(?:-hover)?(?:/(?:\\d+|\\[[^\\]]*\\]))?$`)

/** The class after its variants: `md:hover:text-success` and `[&>svg]:text-success` both end at `text-success`. */
const utilityOf = (token) => {
  let depth = 0
  let cut = -1
  for (let i = 0; i < token.length; i += 1) {
    if (token[i] === "[") depth += 1
    else if (token[i] === "]") depth -= 1
    else if (token[i] === ":" && depth === 0) cut = i
  }
  return token.slice(cut + 1)
}

/** Every solid-tone text class in one class string, as `{ token, family, tone }`. */
export const solidTextClasses = (text) =>
  text
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((token) => {
      const match = SOLID_TEXT.exec(utilityOf(token))
      return match ? [{ token, family: match[1], tone: match[2] }] : []
    })

/** The string nodes inside an expression that builds a class string: literals, template text, keys, and everything a call, array or condition carries. */
function* stringNodes(node) {
  if (!node || typeof node.type !== "string") return
  switch (node.type) {
    case "Literal":
      if (typeof node.value === "string") yield { node, text: node.value }
      return
    case "TemplateLiteral":
      yield { node, text: node.quasis.map((quasi) => quasi.value.cooked ?? "").join(" ") }
      return
    case "JSXExpressionContainer":
      yield* stringNodes(node.expression)
      return
    case "ConditionalExpression":
      yield* stringNodes(node.consequent)
      yield* stringNodes(node.alternate)
      return
    case "LogicalExpression":
      yield* stringNodes(node.left)
      yield* stringNodes(node.right)
      return
    case "TSAsExpression":
    case "TSSatisfiesExpression":
    case "TSNonNullExpression":
      yield* stringNodes(node.expression)
      return
    case "ArrayExpression":
      for (const element of node.elements) yield* stringNodes(element)
      return
    case "CallExpression":
      for (const argument of node.arguments) yield* stringNodes(argument)
      return
    case "ObjectExpression":
      for (const property of node.properties) {
        if (property.type !== "Property") continue
        if (!property.computed && property.key.type === "Literal") yield* stringNodes(property.key)
        yield* stringNodes(property.value)
      }
      return
    default:
  }
}

/** Text or an icon painted with a solid status tone is not readable at the contrast the soft pair was built for. */
export const statusTextUsesSoftForeground = {
  meta: {
    type: "problem",
    docs: { description: "Status text and icons take the soft foreground of the tone, never the solid tone." },
    schema: [],
    messages: {
      solid:
        "`{{token}}` paints text or an icon with the solid `{{tone}}` tone, which is a fill and reads under 4.5:1 on the page (3.8:1 on white for a mid-luminance brand). A status shown as text or an icon takes the soft pair: `{{family}}-{{tone}}-soft-foreground`, on `bg-{{tone}}-soft` when it sits on a tint. The solid tone is for a fill with `text-{{tone}}-foreground` on it.",
    },
  },
  create(context) {
    // A `classes` entry inside a constant is reached twice (as part of the constant, and as the entry): one finding per string.
    const seen = new Set()
    const check = (root) => {
      for (const { node, text } of stringNodes(root)) {
        if (seen.has(node)) continue
        seen.add(node)
        for (const { token, family, tone } of solidTextClasses(text)) context.report({ node, messageId: "solid", data: { token, family, tone } })
      }
    }
    return {
      JSXAttribute(node) {
        if (node.name.type === "JSXIdentifier" && (node.name.name === "className" || node.name.name === "class")) check(attributeValue(node))
      },
      VariableDeclarator(node) {
        check(node.init)
      },
      Property(node) {
        if (!node.computed && node.key.type === "Identifier" && node.key.name === "classes") check(node.value)
      },
    }
  },
}

/** The rules this law contributes to the plugin. */
export const rules = {
  "status-text-uses-soft-foreground": statusTextUsesSoftForeground,
}

/** Every rule of this law is an error. */
export const recommended = Object.fromEntries(Object.keys(rules).map((name) => [`starci-fe/${name}`, "error"]))
