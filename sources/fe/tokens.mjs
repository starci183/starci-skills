/**
 * The rules that hold `tokens.md`.
 *
 * THE UNION DOES MOST OF THIS, AND THESE RULES COVER WHAT IT CANNOT SEE. Every tier above the
 * leaves takes its classes from a typed entry, so an off-scale value there does not fail review -
 * it fails to compile, and there is nothing left to patrol. The leaf folder writes its own classes
 * and is exempt from the entry rules by policy, which makes it the one place a fractional step or a
 * bracketed length can still be typed. That folder is what these rules are for.
 *
 * THEY READ CONSTANTS AS WELL AS MARKUP. The last off-scale value in the source these were written
 * for lived in a module constant - `size-3.5` in one leaf, and a `py-1.5` in another - where every
 * rule that only walked JSX attributes looked straight past it. Hoisting hides a value; it does not
 * license one.
 */

/** Forward-slash form of a filename, so Windows paths compare like every other path. */
const normalizePath = (filename) => String(filename || "").replace(/\\/g, "/")

/** Product source lives under `src/`; tooling and config are out of scope. */
const isSourceFile = (filename) => normalizePath(filename).includes("/src/")

/**
 * A fractional step, in any family that measures.
 *
 * The rungs are whole and unevenly spaced, so half of one is not "between two rungs" - it is off
 * the ladder, and it will match nothing else on any screen.
 */
const FRACTIONAL =
  /\b(?:gap|gap-x|gap-y|p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|space-x|space-y|inset|top|bottom|left|right|size|w|h)-\d+\.\d+\b/

/** A bracketed length: a value chosen once, for one screen, findable by nobody. */
const ARBITRARY_LENGTH =
  /\b(?:gap|gap-x|gap-y|p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|space-x|space-y|size|w|h|min-w|min-h|max-w|max-h)-\[[^\]]+\]/

/** A raw colour, which escapes the semantic palette even when it matches it today. */
const RAW_COLOUR = /\b(?:text|bg|border|ring|from|to|via|fill|stroke|shadow|decoration)-\[#[0-9a-fA-F]/

/** Large text. Paired with a heavy weight it is a heading, whatever element carries it. */
const LARGE_TEXT = /\btext-(?:xl|2xl|3xl|4xl|5xl)\b/

/** A heavy weight. */
const HEAVY_WEIGHT = /\bfont-(?:bold|extrabold|black)\b/

/** True for a `className` / `class` JSX attribute. */
const isClassAttribute = (node) =>
  node.type === "JSXAttribute" && node.name && (node.name.name === "className" || node.name.name === "class")

/** Static string carried by a JSX attribute, a module constant, or an array member. */
const staticText = (value) => {
  if (!value) return null
  if (value.type === "Literal" && typeof value.value === "string") return value.value
  if (value.type === "TemplateLiteral" && value.expressions.length === 0) {
    return value.quasis.map((quasi) => quasi.value.cooked).join(" ")
  }
  if (value.type === "JSXExpressionContainer") return staticText(value.expression)
  if (value.type === "ArrayExpression") {
    const members = value.elements.map((element) => staticText(element)).filter(Boolean)
    return members.length > 0 ? members.join(" ") : null
  }
  return null
}

/** Walk every place a class string can be written: markup, a constant, or an entry's array. */
const classTextVisitors = (context, report) => {
  if (!isSourceFile(context.filename || context.getFilename())) return {}
  return {
    JSXAttribute(node) {
      if (!isClassAttribute(node)) return
      report(node, staticText(node.value))
    },
    VariableDeclarator(node) {
      report(node, staticText(node.init))
    },
    Property(node) {
      if (node.computed) return
      const key = node.key.type === "Identifier" ? node.key.name : null
      if (key !== "classes") return
      report(node, staticText(node.value))
    },
  }
}

// -- TOKEN-3 ---------------------------------------------------------------------------------------

/** A fractional step is off the ladder, not between two rungs. */
export const noFractionalStep = {
  meta: {
    type: "problem",
    docs: { description: "A measurement takes a whole rung; a fractional step is off the scale." },
    schema: [],
    messages: {
      fractional:
        "`{{cls}}` is half a rung. The scale is whole steps, unevenly spaced, so this is not between two rungs - it is off the ladder, and it will match nothing else on any screen. Use the nearest rung; there is no case where the right answer is half of one.",
    },
  },
  create(context) {
    return classTextVisitors(context, (node, text) => {
      if (!text) return
      const hit = text.match(FRACTIONAL)
      if (hit) context.report({ node, messageId: "fractional", data: { cls: hit[0] } })
    })
  },
}

// -- TOKEN-4 ---------------------------------------------------------------------------------------

/** An arbitrary value escapes the system, whatever it happens to evaluate to. */
export const noArbitraryValue = {
  meta: {
    type: "problem",
    docs: { description: "Bracketed lengths and raw colours escape the closed vocabulary." },
    schema: [],
    messages: {
      length:
        "`{{cls}}` is a value chosen once, for one screen. Even where it happens to equal a rung, nobody searching the scale can find it and it does not move when the scale moves. Use a member of the vocabulary, or add one deliberately.",
      colour:
        "`{{cls}}` is a raw colour, outside the semantic palette. A colour named for what it MEANS follows the theme; one named for what it is stays the same in a theme where it is wrong.",
    },
  },
  create(context) {
    return classTextVisitors(context, (node, text) => {
      if (!text) return
      const length = text.match(ARBITRARY_LENGTH)
      if (length) context.report({ node, messageId: "length", data: { cls: length[0] } })
      const colour = text.match(RAW_COLOUR)
      if (colour) context.report({ node, messageId: "colour", data: { cls: colour[0] } })
    })
  },
}

// -- TOKEN-5 ---------------------------------------------------------------------------------------

/** Large text plus a heavy weight is a heading, and headings come from the component that owns both. */
export const noHandRolledHeading = {
  meta: {
    type: "problem",
    docs: { description: "A heading comes from the heading component, not from raw type classes." },
    schema: [],
    messages: {
      heading:
        "Large text and a heavy weight together are a heading, whatever element carries them - and assembled here it is a heading nothing else knows about: the outline a screen reader builds does not contain it, and it stays behind the day the type scale changes. Render the heading component, which owns the tag and the size as one decision.",
    },
  },
  create(context) {
    return classTextVisitors(context, (node, text) => {
      if (!text) return
      if (LARGE_TEXT.test(text) && HEAVY_WEIGHT.test(text)) {
        context.report({ node, messageId: "heading" })
      }
    })
  },
}

/** The rules this law contributes to the plugin. */
export const rules = {
  "no-fractional-step": noFractionalStep,
  "no-arbitrary-value": noArbitraryValue,
  "no-hand-rolled-heading": noHandRolledHeading,
}

/**
 * The level this law asks for, as the plugin's own opinion.
 *
 * All three match on shape rather than judgement, so none carries the false-positive risk that
 * would justify adopting it at `warn`. A repository with history should expect the arbitrary-value
 * rule to report most: a bracketed length is the usual shape of a one-off fix.
 */
export const recommended = Object.fromEntries(Object.keys(rules).map((name) => [`starci-fe/${name}`, "error"]))
