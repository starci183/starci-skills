import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"

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

/**
 * The class families whose names are PROMISES about a theme token, and the variable each needs.
 *
 * Tailwind resolves `max-w-app-lg` by looking for `--container-app-lg`. Nothing warns when that
 * variable does not exist: the class is emitted, the element gets no width, and the type system
 * is satisfied because the name IS in the union. That is the failure this rule exists for - a
 * class can be typesafe and mean nothing at the same time, and the union is exactly what makes
 * it look settled.
 *
 * Only families whose token name is DERIVABLE from the class name are listed. A colour or a
 * spacing step resolves through Tailwind's own scale as well as the theme, so a rule guessing at
 * those would report classes that work.
 */
/**
 * Names Tailwind resolves ITSELF, which therefore promise nothing about this theme.
 *
 * `min-h-screen` is the viewport, not a variable; so are `full`, `fit`, `auto` and the viewport
 * units. Reported as unresolved tokens they would send an author to define `--min-height-screen`,
 * which is a variable nothing reads - the rule would have invented work and broken a working class.
 * Measured on both repositories the first time this ran: two findings, both wrong, both this list.
 */
const TAILWIND_OWN_NAMES = new Set([
  "screen", "full", "fit", "auto", "none", "min", "max", "prose",
  "dvh", "svh", "lvh", "dvw", "svw", "lvw", "px",
])
const TOKEN_CLASS_FAMILIES = [
  { pattern: /^max-w-app-([a-z0-9]+)$/, variable: (name) => `--container-app-${name}` },
  { pattern: /^max-h-([a-z][a-z0-9-]*)$/, variable: (name) => `--max-height-${name}` },
  { pattern: /^min-h-([a-z][a-z0-9-]*)$/, variable: (name) => `--min-height-${name}` },
]

/** Stylesheets a repository may declare its theme in, relative to the repository root. */
const STYLESHEET_CANDIDATES = [
  "src/app/globals.css",
  "apps/app/src/app/globals.css",
  "apps/expert/src/app/globals.css",
  "apps/landing/src/app/globals.css",
  "packages/ui/src/styles/globals.css",
]

/** Every stylesheet found above the linted file, read once and cached for the run. */
const themeCache = new Map()
const themeTextFor = (filename) => {
  let directory = dirname(normalizePath(filename))
  for (let depth = 0; depth < 12 && directory !== "/" && directory !== ""; depth += 1) {
    if (themeCache.has(directory)) return themeCache.get(directory)
    const found = STYLESHEET_CANDIDATES
      .map((relative) => join(directory, relative))
      .filter((candidate) => existsSync(candidate))
      .map((candidate) => readFileSync(candidate, "utf8"))
    if (found.length > 0) {
      const text = found.join("\n")
      themeCache.set(directory, text)
      return text
    }
    directory = dirname(directory)
  }
  return null
}

/** A class naming a token the theme never defines is a class that draws nothing. */
export const noUnresolvedTokenClass = {
  meta: {
    type: "problem",
    docs: { description: "A class naming a theme token resolves only when the theme defines it." },
    schema: [],
    messages: {
      unresolved:
        "`{{value}}` reads as a token this theme defines, and `{{variable}}` is defined nowhere in it. Tailwind emits the class, the element gets nothing, and both the union and the compiler stay happy - which is why this is the one dead class no type can catch. Define `{{variable}}` in the stylesheet, or name a token that exists.",
    },
  },
  create(context) {
    const file = normalizePath(context.filename || context.getFilename())
    if (!isSourceFile(file)) return {}
    const theme = themeTextFor(file)
    // A reader that cannot find the stylesheet stays quiet rather than calling every token dead.
    if (theme === null) return {}
    // The visitor hands (node, text) in that order; reversing them here is how a rule reports the
    // node as its message and the message as its node, and neither complains.
    const check = (node, value) => {
      for (const raw of String(value).split(/\s+/)) {
        const bare = raw.replace(/^[a-z-]+:/, "").replace(/^!/, "")
        for (const family of TOKEN_CLASS_FAMILIES) {
          const match = family.pattern.exec(bare)
          if (match === null) continue
          if (TAILWIND_OWN_NAMES.has(match[1])) continue
          const variable = family.variable(match[1])
          if (theme.includes(variable)) continue
          context.report({ node, messageId: "unresolved", data: { value: bare, variable } })
        }
      }
    }
    return classTextVisitors(context, check)
  },
}

/** The rules this law contributes to the plugin. */
export const rules = {
  "no-fractional-step": noFractionalStep,
  "no-arbitrary-value": noArbitraryValue,
  "no-hand-rolled-heading": noHandRolledHeading,
  "no-unresolved-token-class": noUnresolvedTokenClass,
}

/**
 * The level this law asks for, as the plugin's own opinion.
 *
 * All three match on shape rather than judgement, so none carries the false-positive risk that
 * would justify adopting it at `warn`. A repository with history should expect the arbitrary-value
 * rule to report most: a bracketed length is the usual shape of a one-off fix.
 */
export const recommended = Object.fromEntries(Object.keys(rules).map((name) => [`starci-fe/${name}`, "error"]))
