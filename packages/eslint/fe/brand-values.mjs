/**
 * The rule that holds `brand-values.md` (HFS R61 `FE_STYLE_TOKEN_ONLY`, the TypeScript half; the CSS
 * half belongs to `@starci/stylelint-canon`).
 *
 * ONE PLACE FOR A COLOUR. Colour values exist in `modules/brand/brand.css`, set only on the tokens
 * the grammar declares, with a light and a dark value, and checked against the brand record. A hex
 * in a component is a colour that has no dark value, cannot be re-branded, and drifts from the
 * record: one repository carried three different ways to override the brand, and another 4.3k lines
 * of hand-made CSS with a private token namespace.
 *
 * LENGTHS FOLLOW. A pixel length in TypeScript (`"12px"`, `{ width: 12 }` in a `style` prop) is a
 * spacing decision that skipped the grammar's scale, so it does not move with density, zoom or a
 * breakpoint. Spacing and sizing come from the grammar's utility tokens.
 *
 * WHAT IT DELIBERATELY LEAVES ALONE: a fragment identifier (`href="#top"`, `id`, `htmlFor`), a
 * `data:` URI, a component's `color="primary"` prop (that is a variant name, not a colour), and
 * Tailwind arbitrary values (`w-[12px]`), which `no-arbitrary-value` already reports - two rules
 * for one span would be two findings for one fix.
 */

import { isSpecFile } from "./lib/scope.mjs"
import { isContentFile } from "./comments.mjs"

/** A hex colour: 3, 4, 6 or 8 digits, not a longer word and not part of an identifier. */
const HEX_COLOR = /(?<![\w&])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])/

/** A functional colour notation. */
const COLOR_FUNCTION = /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color-mix)\(/i

/** A pixel length, not inside an arbitrary-value bracket and not part of a longer number or word. */
const PIXEL_LENGTH = /(?<![\w.#[-])-?(?:\d+\.?\d*|\.\d+)px\b/

/** Attributes whose value is a fragment or an id, where a `#abc` is not a colour. */
const NON_COLOR_ATTRS = new Set(["href", "id", "htmlFor", "to", "name", "aria-controls", "aria-labelledby", "aria-describedby"])

/** SVG paint attributes: a named colour here is a raw brand value. */
const PAINT_ATTRS = new Set(["fill", "stroke", "stopColor", "floodColor", "lightingColor"])

/** Style properties that take a colour. */
const COLOR_KEYS = new Set([
  "color",
  "background",
  "backgroundColor",
  "borderColor",
  "outlineColor",
  "fill",
  "stroke",
  "caretColor",
  "accentColor",
  "textDecorationColor",
])

/** Style properties that take a length. */
const LENGTH_KEYS = new Set([
  "width",
  "height",
  "minWidth",
  "maxWidth",
  "minHeight",
  "maxHeight",
  "top",
  "right",
  "bottom",
  "left",
  "gap",
  "margin",
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
  "padding",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "fontSize",
  "borderRadius",
  "letterSpacing",
])

/** Values that carry no raw colour: a token reference or a keyword. */
const NEUTRAL_COLOR = /^(?:var\(|inherit$|initial$|unset$|revert$|currentcolor$|transparent$|none$)/i

/** Static string of a literal or an expression-free template, else null. */
const staticString = (node) => {
  if (!node) return null
  if (node.type === "Literal" && typeof node.value === "string") return node.value
  if (node.type === "TemplateLiteral" && node.expressions.length === 0) return node.quasis[0]?.value.cooked ?? ""
  return null
}

/** No raw colour, hex or pixel value outside `brand.css`. */
export const noRawBrandValue = {
  meta: {
    type: "problem",
    docs: { description: "No hex, colour function, named paint colour or px length in TypeScript; tokens only." },
    schema: [],
    messages: {
      color:
        "A raw colour value (`{{value}}`). Colour values exist only in `modules/brand/brand.css`, on the tokens the grammar declares, with a light and a dark value. Here it has no dark value, cannot be re-branded and drifts from the brand record. Use a grammar token class or variable.",
      length:
        "A raw pixel length (`{{value}}`). Spacing and size come from the grammar's scale so they move with density, zoom and breakpoint. Use a grammar utility token.",
      named:
        "`{{key}}: {{value}}` puts a named colour in a style. Colour is a token, not a word: use a grammar token (`var(--...)` or a token class).",
    },
  },
  create(context) {
    const filename = context.filename || context.getFilename()
    if (isSpecFile(filename) || isContentFile(filename)) return {}
    const source = context.sourceCode || context.getSourceCode()
    /** Values already reported through an owner, so a string reports once. */
    const claimed = new WeakSet()

    /** True when a node sits inside a JSX `style={...}` attribute. */
    const inStyleAttribute = (node) =>
      source
        .getAncestors(node)
        .some((ancestor) => ancestor.type === "JSXAttribute" && ancestor.name.type === "JSXIdentifier" && ancestor.name.name === "style")

    /** Reports the first raw value in a string, once. */
    const scan = (node, text) => {
      if (claimed.has(node) || typeof text !== "string" || text.startsWith("data:")) return
      const parent = node.parent
      if (parent && parent.type === "JSXAttribute" && NON_COLOR_ATTRS.has(parent.name.name)) return
      if (parent && parent.type === "JSXExpressionContainer" && parent.parent.type === "JSXAttribute") {
        if (NON_COLOR_ATTRS.has(parent.parent.name.name)) return
      }
      if (parent && (parent.type === "ImportDeclaration" || parent.type === "ExportAllDeclaration" || parent.type === "ExportNamedDeclaration")) return
      const color = HEX_COLOR.exec(text) || COLOR_FUNCTION.exec(text)
      if (color) return context.report({ node, messageId: "color", data: { value: color[0].replace(/\($/, "(...)") } })
      const length = PIXEL_LENGTH.exec(text)
      if (length) context.report({ node, messageId: "length", data: { value: length[0] } })
    }

    return {
      Literal(node) {
        scan(node, node.value)
      },
      TemplateElement(node) {
        scan(node, node.value && node.value.cooked)
      },
      JSXAttribute(node) {
        if (node.name.type !== "JSXIdentifier" || !PAINT_ATTRS.has(node.name.name)) return
        const value = node.value && node.value.type === "JSXExpressionContainer" ? node.value.expression : node.value
        const text = staticString(value)
        if (text === null || NEUTRAL_COLOR.test(text) || HEX_COLOR.test(text) || COLOR_FUNCTION.test(text)) return
        claimed.add(value)
        context.report({ node, messageId: "named", data: { key: node.name.name, value: text } })
      },
      Property(node) {
        if (node.computed || node.key.type !== "Identifier" || !inStyleAttribute(node)) return
        const key = node.key.name
        if (COLOR_KEYS.has(key)) {
          const text = staticString(node.value)
          if (text === null || NEUTRAL_COLOR.test(text) || HEX_COLOR.test(text) || COLOR_FUNCTION.test(text)) return
          claimed.add(node.value)
          context.report({ node, messageId: "named", data: { key, value: text } })
        } else if (LENGTH_KEYS.has(key) && node.value.type === "Literal" && typeof node.value.value === "number") {
          if (node.value.value === 0) return
          claimed.add(node.value)
          context.report({ node: node.value, messageId: "length", data: { value: `${key}: ${node.value.value}` } })
        }
      },
    }
  },
}

/** The rules this law contributes to the plugin. */
export const rules = {
  "no-raw-brand-value": noRawBrandValue,
}

/** Every rule is an error. */
export const recommended = Object.fromEntries(Object.keys(rules).map((name) => [`starci-fe/${name}`, "error"]))
