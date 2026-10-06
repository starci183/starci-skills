/**
 * Reading CSS values for the token rules: which properties are colour, spacing, radius or typography, what
 * counts as a token reference, and what is neither a token nor owned by `raw-brand-value`.
 */
import valueParser from "postcss-value-parser"
import { COLOR_FUNCTION, HEX_COLOR, PIXEL_LENGTH } from "./brand-value.mjs"
import { isKnownToken } from "./vocabulary.mjs"

/** Keywords that carry no value of their own: they neither hold a colour nor a length. */
const NEUTRAL = new Set([
  "inherit",
  "initial",
  "unset",
  "revert",
  "revert-layer",
  "currentcolor",
  "transparent",
  "none",
  "auto",
  "normal",
  "0",
])

/** Functions that only combine token values. */
const MATH = new Set(["calc", "min", "max", "clamp"])

/** CSS named colours: a word here is a colour that skipped the token scale. */
const NAMED_COLORS = new Set(
  (
    "aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood " +
    "cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray " +
    "darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen " +
    "darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue " +
    "firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew " +
    "hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan " +
    "lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray " +
    "lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue " +
    "mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred " +
    "midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid " +
    "palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple " +
    "rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue " +
    "slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white " +
    "whitesmoke yellow yellowgreen"
  ).split(" "),
)

const sides = "(?:top|right|bottom|left|block|inline|block-start|block-end|inline-start|inline-end)"

/** Properties that take exactly a token (or a neutral keyword). */
const STRICT = [
  {
    role: "colour",
    test: new RegExp(
      `^(?:color|background-color|border-color|border-${sides}-color|outline-color|fill|stroke|caret-color|accent-color|text-decoration-color|text-emphasis-color|column-rule-color|scrollbar-color|stop-color|flood-color|lighting-color)$`,
    ),
  },
  {
    role: "spacing",
    test: new RegExp(
      `^(?:margin|margin-${sides}|padding|padding-${sides}|gap|row-gap|column-gap|grid-gap|grid-row-gap|grid-column-gap|inset|inset-${sides}|top|right|bottom|left|scroll-margin(?:-${sides})?|scroll-padding(?:-${sides})?)$`,
    ),
  },
  { role: "radius", test: /^border(?:-(?:top|bottom|start|end)-(?:left|right|start|end))?-radius$/ },
  {
    role: "typography",
    test: /^(?:font|font-size|font-family|font-weight|line-height|letter-spacing|word-spacing)$/,
  },
]

/** Shorthands that carry a colour among other parts: only a named colour is judged. */
const SHORTHAND_COLOUR =
  /^(?:background|background-image|border|border-(?:top|right|bottom|left|block|inline)(?:-start|-end)?|outline|box-shadow|text-shadow|text-decoration|column-rule)$/

/** The role a property is held to strictly, or null. */
export function strictRole(prop) {
  const name = prop.toLowerCase()
  return STRICT.find((entry) => entry.test.test(name))?.role ?? null
}

/** True for a shorthand whose colour part is judged. */
export const isShorthandColour = (prop) => SHORTHAND_COLOUR.test(prop.toLowerCase())

/** Owned by `raw-brand-value`, so a token rule never reports it twice. */
const isRawBrand = (node) => {
  if (node.type === "function") return COLOR_FUNCTION.test(`${node.value}(`)
  return node.type === "word" && (HEX_COLOR.test(node.value) || PIXEL_LENGTH.test(node.value))
}

/** Every `var()` in a value, recursively, as `{ name, node }`. */
function varReferences(value) {
  const found = []
  const walk = (nodes) => {
    for (const node of nodes) {
      if (node.type !== "function") continue
      if (node.value.toLowerCase() === "var") {
        const first = node.nodes.find((child) => child.type === "word")
        if (first?.value.startsWith("--")) found.push({ name: first.value, node })
      }
      walk(node.nodes)
    }
  }
  walk(valueParser(value).nodes)
  return found
}

/** The first `var()` naming a custom property outside the vocabulary, or null. */
export function unknownVar(value, appTokens) {
  return varReferences(value).find((entry) => !isKnownToken(entry.name, appTokens)) ?? null
}

/**
 * The first part of a value that is not a token, for a property held strictly: a bare length, number, named
 * colour or foreign function. A `var()` fallback is judged the same way. Raw hex, colour functions and pixel
 * lengths are left to `raw-brand-value`. Returns the offending text, or null.
 */
export function strictProblem(value) {
  const check = (nodes, inMath) => {
    for (const node of nodes) {
      if (node.type === "space" || node.type === "div" || node.type === "comment") continue
      if (isRawBrand(node)) continue
      if (node.type === "word") {
        const word = node.value.toLowerCase()
        if (NEUTRAL.has(word)) continue
        if (inMath && (/^[+*/-]$/.test(word) || /^-?(?:\d+\.?\d*|\.\d+)$/.test(word))) continue
        return node.value
      }
      if (node.type === "function") {
        const name = node.value.toLowerCase()
        if (name === "var") {
          const rest = node.nodes.findIndex((child) => child.type === "div" && child.value === ",")
          if (rest >= 0) {
            const problem = check(node.nodes.slice(rest + 1), inMath)
            if (problem) return problem
          }
          continue
        }
        if (MATH.has(name)) {
          const problem = check(node.nodes, true)
          if (problem) return problem
          continue
        }
        return valueParser.stringify(node)
      }
      return valueParser.stringify(node)
    }
    return null
  }
  return check(valueParser(value).nodes, false)
}

/** The first named colour in a shorthand's value (functions searched, `var()` skipped), or null. */
export function namedColour(value) {
  const walk = (nodes) => {
    for (const node of nodes) {
      if (node.type === "word" && NAMED_COLORS.has(node.value.toLowerCase())) return node.value
      if (node.type === "function") {
        const name = node.value.toLowerCase()
        if (name === "var" || name === "url") continue
        const inner = walk(node.nodes)
        if (inner) return inner
      }
    }
    return null
  }
  return walk(valueParser(value).nodes)
}

/** True when a value is made only of `var()` references (and math over them): the shape of an alias token. */
export function isAliasValue(value) {
  const nodes = valueParser(value).nodes.filter((node) => node.type !== "space" && node.type !== "comment")
  if (nodes.length === 0) return false
  const ok = (list, inMath) =>
    list.every((node) => {
      if (node.type === "space" || node.type === "comment" || node.type === "div") return true
      if (node.type === "word") return inMath && (/^[+*/-]$/.test(node.value) || /^-?(?:\d+\.?\d*|\.\d+)$/.test(node.value))
      if (node.type !== "function") return false
      const name = node.value.toLowerCase()
      if (name === "var") return true
      return MATH.has(name) && ok(node.nodes, true)
    })
  return ok(nodes, false)
}
