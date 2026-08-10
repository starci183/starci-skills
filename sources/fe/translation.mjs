/**
 * The rules that hold `translation.md`.
 *
 * TWO RULES, AND THE SECOND ONE IS THE INTERESTING ONE. Forbidding a translation call below a block
 * is easy and mostly redundant - the split rule already stops the drawing half reaching for the
 * runtime. What nothing else catches is a literal that a reader can SEE, sitting in a tier that is
 * supposed to receive every word it renders.
 *
 * THE ATTRIBUTES MATTER MORE THAN THE MARKUP. Copy hides in `aria-label`, `placeholder`, `title`
 * and `alt` precisely because none of them reads as a sentence when you scan the file - and an
 * `aria-label` is not a small case: a screen reader treats it as the primary text, so an English
 * one on a translated surface is the loudest defect on the page for the reader least able to work
 * around it.
 *
 * The prose test is deliberately crude - a space and a leading capital - because the alternative is
 * a rule that argues about whether a given string is a sentence. A crude test that fires on real
 * copy and spares tokens is worth more than a clever one nobody trusts.
 */

/** Forward-slash form of a filename, so Windows paths compare like every other path. */
const normalizePath = (filename) => String(filename || "").replace(/\\/g, "/")

/** Tiers that receive every word they render: they know no domain, so they can know no sentence. */
const VOCABULARY_DIRS = ["leaves", "shells", "composites", "branches"]

/** True when a file sits in a tier that must not hold copy. */
const isVocabularyFile = (filename) => {
  const file = normalizePath(filename)
  return VOCABULARY_DIRS.some((dir) => file.includes(`/src/components/${dir}/`))
}

/** Attributes a reader sees or hears, none of which looks like a sentence in the markup. */
const VISIBLE_ATTRS = new Set(["aria-label", "placeholder", "title", "alt", "aria-description"])

/** Calls that resolve a word at render time. */
const RESOLVES_COPY = /^(?:useTranslations|useLocale|useFormatter|getTranslations)$/

/** Prose rather than a token: it has a space and it starts like a sentence. */
const looksLikeProse = (text) => typeof text === "string" && /\s/.test(text) && /^[A-Z]/.test(text)

/** Static string carried by a JSX attribute. */
const attributeText = (node) => {
  const value = node && node.value
  if (!value) return null
  if (value.type === "Literal" && typeof value.value === "string") return value.value
  if (value.type === "JSXExpressionContainer" && value.expression.type === "Literal") {
    return typeof value.expression.value === "string" ? value.expression.value : null
  }
  return null
}

// -- COPY-1 ----------------------------------------------------------------------------------------

/** A component below a block never resolves a word. */
export const noCopyResolutionBelowBlock = {
  meta: {
    type: "problem",
    docs: { description: "The vocabulary tiers receive resolved strings; they never resolve one." },
    schema: [],
    messages: {
      resolves:
        "`{{name}}(...)` resolves a word in a tier that receives every word it renders. This component would then need the translation runtime to be rendered from a fixture, and it would have to know which situation the reader is in to pick the right sentence - which is the connected half's job, one file away.",
    },
  },
  create(context) {
    if (!isVocabularyFile(context.filename || context.getFilename())) return {}
    return {
      CallExpression(node) {
        const callee = node.callee
        if (!callee || callee.type !== "Identifier" || !RESOLVES_COPY.test(callee.name)) return
        context.report({ node, messageId: "resolves", data: { name: callee.name } })
      },
    }
  },
}

// -- COPY-2 ----------------------------------------------------------------------------------------

/** A component below a block holds no literal a reader can see or hear. */
export const noHardcodedCopyInVocabulary = {
  meta: {
    type: "problem",
    docs: { description: "No visible or spoken literal in a tier that receives its words." },
    schema: [],
    messages: {
      hardcoded:
        "`{{attr}}=\"{{text}}\"` is copy, hardcoded in a tier that receives every word it renders - so one reader in another language sees English here. It also does not read as a sentence when scanning this file, which is why this attribute is where copy hides. Take a resolved string through `props`.",
      text:
        "`{{text}}` is copy written into a tier that receives its words. A reader in another language sees this exactly as written. Take a resolved string through `props`.",
    },
  },
  create(context) {
    if (!isVocabularyFile(context.filename || context.getFilename())) return {}
    return {
      JSXAttribute(node) {
        const attr = node.name && node.name.type === "JSXIdentifier" ? node.name.name : null
        if (!attr || !VISIBLE_ATTRS.has(attr)) return
        const text = attributeText(node)
        if (looksLikeProse(text)) context.report({ node, messageId: "hardcoded", data: { attr, text } })
      },
      JSXText(node) {
        const text = String(node.value || "").trim()
        if (looksLikeProse(text)) context.report({ node, messageId: "text", data: { text } })
      },
    }
  },
}

/** The rules this law contributes to the plugin. */
export const rules = {
  "no-copy-resolution-below-block": noCopyResolutionBelowBlock,
  "no-hardcoded-copy-in-vocabulary": noHardcodedCopyInVocabulary,
}

/**
 * The level this law asks for, as the plugin's own opinion.
 *
 * The second rule is the one a repository with history should expect a count from, and every report
 * is a real move: the string has to be lifted to a connected half and given a key, which is work
 * rather than a deletion.
 */
export const recommended = Object.fromEntries(Object.keys(rules).map((name) => [`starci-fe/${name}`, "error"]))
