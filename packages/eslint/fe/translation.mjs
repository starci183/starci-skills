/**
 * The rules that hold `translation.md` (HFS R58, `FE_I18N_LITERAL`).
 *
 * TWO RULES. The first forbids a translation call below a block - easy and mostly redundant, since
 * the split rule already stops the drawing half reaching for the runtime. The second is the law:
 * NO LITERAL COPY AT ANY TIER, IN ANY LANGUAGE, AND NO PRAGMA.
 *
 * WHAT CHANGED, AND WHY. The previous rule scanned only the vocabulary tiers (leaves,
 * composites, branches), so a block or a page holding every word of a screen was exempt, and the
 * companion language rule carried a `vn-ok: <reason>` pragma that was used 490 times in one
 * repository. One escape is enough to turn a rule into a comment convention. There is now no tier
 * exemption and no pragma: a word a reader can see or hear comes from `t()` over a `next-intl`
 * catalogue, and the catalogue (`messages/<locale>.json`) is the only place a second language is
 * content.
 *
 * THE ATTRIBUTES MATTER MORE THAN THE MARKUP. Copy hides in `aria-label`, `placeholder`, `title`
 * and `alt` precisely because none of them reads as a sentence when you scan the file - and an
 * `aria-label` is not a small case: a screen reader treats it as the primary text, so an English
 * one on a translated surface is the loudest defect on the page for the reader least able to work
 * around it. It also hides in object copy (`{ title: "..." }`), which is how a page's metadata
 * ends up in one language regardless of the URL.
 *
 * TWO STRENGTHS OF TEST, ON PURPOSE. JSX text and the attributes a reader hears (`label`, `title`,
 * `alt`, `placeholder`, the `aria-*` set) are copy whatever they say, so ANY word reports: `Save` is
 * copy, `logo` is copy. An object property or a generic prop (`description`, `hint`) may carry a
 * token (`{ title: "sm" }`), so those need to look like prose - a space, a non-ASCII letter or a
 * leading capital. A crude test that fires on real copy
 * and spares tokens is worth more than a clever one nobody trusts.
 */

import { isContentFile } from "./comments.mjs"
import { isComponentFile, kindOfFile } from "./lib/scope.mjs"

/** True when a file sits in a component layer that must not resolve copy: every layer but `blocks` receives every word it renders, so it can know no domain and no sentence. */
const isVocabularyFile = (context) => isComponentFile(context) && kindOfFile(context) !== "blocks"

/** Attributes a reader sees or hears: any word in them is copy. */
const STRICT_ATTRS = new Set([
  "label",
  "aria-label",
  "aria-description",
  "aria-roledescription",
  "aria-valuetext",
  "aria-placeholder",
  "placeholder",
  "title",
  "alt",
])

/** Props that usually carry a sentence but may carry a token (a variant, an id). */
const PROSE_ATTRS = new Set([
  "description",
  "helperText",
  "hint",
  "tooltip",
  "caption",
  "heading",
  "subtitle",
  "errorMessage",
  "emptyText",
  "loadingText",
  "confirmLabel",
  "cancelLabel",
])

/** Object keys whose value is shown to a reader. */
const COPY_KEYS = new Set([
  "title",
  "label",
  "description",
  "placeholder",
  "message",
  "heading",
  "subtitle",
  "caption",
  "tooltip",
  "hint",
  "cta",
  "text",
  "alt",
  "ariaLabel",
  "helperText",
  "emptyText",
  "errorMessage",
  "successMessage",
])

/** Calls that resolve a word at render time. */
const RESOLVES_COPY = /^(?:useTranslations|useLocale|useFormatter|getTranslations)$/

/**
 * True when the text contains a word: two or more letters in any script.
 *
 * TWO LETTERS, NOT ONE, AND THE SAME AS THE REPOSITORY GATE. A lone letter is a unit, a separator or a
 * key cap (`x`, `k`, `A`); a word is where copy starts. The repository's i18n catalog check
 * draws the line at two letters for JSX text and copy attributes, and this rule draws it in the same
 * place so the lint and the gate never disagree about what a literal is. Neither has a suppression
 * marker.
 */
const hasLetter = (text) => typeof text === "string" && /\p{L}{2,}/u.test(text)

/** Prose rather than a token: it has a space, a non-ASCII letter, or it starts like a sentence. */
const looksLikeProse = (text) =>
  hasLetter(text) && (/\s/.test(text) || /[^\x00-\x7F]/.test(text) || /^[A-Z]/.test(text))

/** Static string carried by a literal or an expression-free template, else null. */
const staticString = (node) => {
  if (!node) return null
  if (node.type === "Literal" && typeof node.value === "string") return node.value
  if (node.type === "TemplateLiteral" && node.expressions.length === 0) {
    return node.quasis.map((quasi) => quasi.value.cooked ?? "").join("")
  }
  return null
}

/**
 * The static text of a template literal that has substitutions, each substitution standing as `#`
 * (a template of "the count, then installed" reads "# installed"); null for anything that is not such a template.
 */
const templateText = (node) => {
  if (!node || node.type !== "TemplateLiteral" || node.expressions.length === 0) return null
  return node.quasis.map((quasi) => quasi.value.cooked ?? "").join("#")
}

/** True when the static parts of a template with substitutions contain a word (a count then "installed", not two ids joined by a dash). */
const templateHasWord = (node) => {
  const text = templateText(node)
  return text !== null && hasLetter(text.replaceAll("#", " "))
}

/**
 * A sentence rather than a token, for a property whose key does not say it is copy: two or more words made of
 * letters and sentence punctuation only (so a class list, a URL, a media type or an id never qualifies), and it starts
 * like a sentence, ends like one, or carries a non-ASCII letter.
 */
const looksLikeSentence = (text) => {
  const tokens = text.trim().split(/\s+/)
  if (tokens.length < 2) return false
  // a word has punctuation only at its edges or as a hyphen between letters; an all-capitals hyphen chain (YYYY-MM-DD) is a format
  const isWord = (token) => /^["'(]*[\p{L}\p{N}#'’]+(?:-[\p{L}\p{N}#]+)*[.,!?:;")]*$/u.test(token) && !/^\p{Lu}{2,}(?:-\p{Lu}{2,})+$/u.test(token)
  if (!tokens.every(isWord)) return false
  if (tokens.filter((token) => /\p{L}{2,}/u.test(token)).length < 2) return false
  return /^\p{Lu}/u.test(text.trim()) || /[^\x00-\x7F]/.test(text) || /[.!?]$/.test(text.trim())
}

/** Static string carried by a JSX attribute value, else null. */
const attributeText = (node) => {
  const value = node && node.value
  if (!value) return null
  if (value.type === "JSXExpressionContainer") return staticString(value.expression)
  return staticString(value)
}

/** The value node behind a JSX attribute, for de-duplication against the second-language walk. */
const attributeValueNode = (node) =>
  node.value && node.value.type === "JSXExpressionContainer" ? node.value.expression : node.value

/** The name of an object property key, else null. */
const keyName = (property) => {
  if (property.computed) return null
  if (property.key.type === "Identifier") return property.key.name
  if (property.key.type === "Literal" && typeof property.key.value === "string") return property.key.value
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
    if (!isVocabularyFile(context)) return {}
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

/** No literal copy at any tier, in any language, and no pragma to allow one. */
export const noHardcodedCopy = {
  meta: {
    type: "problem",
    docs: { description: "User-facing text comes from a `next-intl` catalogue through `t()`, at every tier." },
    schema: [],
    messages: {
      text:
        "`{{text}}` is copy written into source. A reader in another language sees it exactly as written, and there is no tier or comment that makes that acceptable: take the sentence from the catalogue with `t(\"key\")`.",
      attribute:
        "`{{attr}}=\"{{text}}\"` is copy, hardcoded. One reader in another language sees it verbatim - and `{{attr}}` is where copy hides, because it does not read as a sentence when scanning the file. Use `t(\"key\")`.",
      property:
        "`{{key}}: \"{{text}}\"` is copy in an object, so whatever displays this object (a page title, an empty state, a toast) shows it in one language. Use `t(\"key\")`, or build the object where `t` is in scope.",
    },
  },
  create(context) {
    if (isContentFile(context)) return {}
    const source = context.sourceCode || context.getSourceCode()
    return {
      JSXText(node) {
        const text = String(node.value || "").trim()
        if (hasLetter(text)) context.report({ node, messageId: "text", data: { text } })
      },
      JSXExpressionContainer(node) {
        // `<p>{"Hello"}</p>`: a literal in child position is JSX text with braces around it.
        const parent = node.parent
        if (!parent || (parent.type !== "JSXElement" && parent.type !== "JSXFragment")) return
        if (templateHasWord(node.expression)) {
          return context.report({ node, messageId: "text", data: { text: source.getText(node.expression) } })
        }
        const text = staticString(node.expression)
        if (text === null || !hasLetter(text.trim())) return
        context.report({ node, messageId: "text", data: { text: text.trim() } })
      },
      JSXAttribute(node) {
        const attr = node.name && node.name.type === "JSXIdentifier" ? node.name.name : null
        if (!attr) return
        const strict = STRICT_ATTRS.has(attr)
        if (!strict && !PROSE_ATTRS.has(attr)) return
        const value = attributeValueNode(node)
        const template = templateText(value)
        const text = template ?? attributeText(node)
        if (text === null) return
        if (strict ? !hasLetter(text.replaceAll("#", " ")) : !looksLikeProse(text)) return
        context.report({ node, messageId: "attribute", data: { attr, text: template === null ? text : source.getText(value) } })
      },
      Property(node) {
        const key = keyName(node)
        if (!key || node.parent.type !== "ObjectExpression") return
        const template = templateText(node.value)
        const text = template ?? staticString(node.value)
        if (text === null) return
        // a copy key needs prose; any other key needs a whole sentence: { ready: "Your course is ready" } in a hook is copy
        if (!(COPY_KEYS.has(key) ? looksLikeProse(text) : looksLikeSentence(text))) return
        context.report({ node, messageId: "property", data: { key, text: template === null ? text : source.getText(node.value) } })
      },
    }
  },
}

/** The rules this law contributes to the plugin. */
export const rules = {
  "no-copy-resolution-below-block": noCopyResolutionBelowBlock,
  "no-hardcoded-copy": noHardcodedCopy,
}

/**
 * The level this law asks for, as the plugin's own opinion.
 *
 * `no-hardcoded-copy` is the one a repository with history should expect a large count from, and
 * every report is a real move: the string has to be lifted into a catalogue key and read through
 * `t()`, which is work rather than a deletion. That is the reason there is no `warn` rollout and no
 * pragma - a repository burns the count down before it adopts, it does not live beside it.
 */
export const recommended = Object.fromEntries(Object.keys(rules).map((name) => [`starci-fe/${name}`, "error"]))
