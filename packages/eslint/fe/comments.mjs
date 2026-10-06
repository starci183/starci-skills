/**
 * The rules that hold `comments.md`.
 *
 * Both reach further than their names suggest, and deliberately. An emoji rule that read only JSX
 * would miss the one in a log message, so it walks comments, identifiers, string literals, template
 * chunks and JSX text alike - everywhere prose can hide in a source file.
 *
 * `no-vietnamese-in-source` holds the English-only law: identifiers, string literals, template text, JSX text,
 * comments and test titles carry no Vietnamese letter. The old `vn-ok: <reason>` pragma is gone (it was used 490
 * times in one repository, and one escape is enough to turn a rule into a comment convention). Detection is
 * structural on characters (`scripts/lib/language.mjs`, folded to NFC), never a word list.
 *
 * The exceptions that remain are placements, not judgements, and that is on purpose: a locale dictionary
 * IS the other language, and a fixture reproducing a real string has to reproduce it exactly. A
 * judgement-based exception would be argued per file forever. The Vietnamese rule has no placement exemption at all.
 */

import { hasSecondLanguage } from "./runtime/scripts/lib/language.mjs"
import { jsdocBefore } from "./runtime/scripts/lib/jsdoc.mjs"
import { fileOf, inSlot } from "./lib/scope.mjs"

/**
 * Extended pictographs, or a regional-indicator pair.
 *
 * Two tests rather than one character class, so the class stays free of joiners and combining marks
 * - a single class covering both trips the misleading-character-class rule, and a rule that has to
 * be silenced to exist is one nobody trusts.
 */
const hasEmoji = (text) =>
  typeof text === "string" &&
  (/\p{Extended_Pictographic}/u.test(text) || /[\u{1F1E6}-\u{1F1FF}]{2}/u.test(text))

/**
 * Files whose second-language text or emoji is CONTENT rather than authoring, decided by what the file IS.
 *
 * One kind only: the locale dictionaries (a `.json` file of an i18n slot, `fe.modules.i18n` or `fe.package.i18n`),
 * which are the product's other language. There is no "copy module": a `resources/` folder of strings is copy that
 * skipped the catalogue.
 *
 * @param {object} context - The ESLint rule context.
 * @returns {boolean} True when the linted file holds content rather than authoring.
 */
export const isContentFile = (context) => {
  const file = fileOf(context)
  return inSlot(context, "fe.modules.i18n", "fe.package.i18n") && file.endsWith(".json")
}

/** Walk every place prose can hide, and hand each to one check. */
const proseVisitors = (context, report) => {
  const source = context.sourceCode || context.getSourceCode()
  return {
    Program() {
      for (const comment of source.getAllComments()) report(comment, comment.value)
    },
    Identifier(node) {
      report(node, node.name)
    },
    JSXIdentifier(node) {
      report(node, node.name)
    },
    PrivateIdentifier(node) {
      report(node, node.name)
    },
    Literal(node) {
      if (typeof node.value === "string") report(node, node.value)
    },
    TemplateElement(node) {
      report(node, node.value?.cooked)
    },
    JSXText(node) {
      report(node, node.value)
    },
  }
}

// -- COMMENTS-1 ------------------------------------------------------------------------------------

/** Every export opens with a documentation block. */
export const requireExportJsdoc = {
  meta: {
    type: "suggestion",
    docs: { description: "Exported declarations open with a documentation block." },
    schema: [],
    messages: {
      jsdoc:
        "`{{name}}` is exported without an adjacent JSDoc description. An export is read far more often than it is written, and by people who never open the body - name the ROLE it plays, not the signature, which the signature already states.",
    },
  },
  create(context) {
    const source = context.sourceCode || context.getSourceCode()
    const hasBlock = (node) => jsdocBefore(source, node) !== null
    const check = (node) => {
      const declaration = node.declaration
      if (!declaration) return
      const kinds = ["VariableDeclaration", "TSInterfaceDeclaration", "FunctionDeclaration", "TSTypeAliasDeclaration"]
      if (!kinds.includes(declaration.type) || hasBlock(node)) return
      const id =
        declaration.id || declaration.declarations?.[0]?.id
      context.report({ node: id || declaration, messageId: "jsdoc", data: { name: id?.name || "this export" } })
    }
    return { ExportNamedDeclaration: check, ExportDefaultDeclaration: check }
  },
}

// -- COMMENTS-4 ------------------------------------------------------------------------------------

/** No Unicode emoji in source: stable product reactions use attributed checked-in SVG artwork. */
export const noEmojiInSource = {
  meta: {
    type: "problem",
    docs: { description: "No emoji in source authoring." },
    schema: [],
    messages: {
      emoji:
        "Unicode emoji in source authoring. It renders differently on every platform, sorts unpredictably, breaks a terminal that is not expecting it, and does not mean the same thing in two countries. Generic marks belong to the icon vocabulary; product reactions use the attributed checked-in SVG artwork through the reaction leaf.",
    },
  },
  create(context) {
    if (isContentFile(context)) return {}
    return proseVisitors(context, (node, text) => {
      if (hasEmoji(text)) context.report({ node, messageId: "emoji" })
    })
  },
}

// -- COMMENTS-5 ------------------------------------------------------------------------------------

/** Source prose is English: no Vietnamese letter in an identifier, string, comment, JSX text or test title. */
export const noVietnameseInSource = {
  meta: {
    type: "problem",
    docs: { description: "No Vietnamese in source authoring, specs included." },
    schema: [],
    messages: {
      vietnamese:
        "A Vietnamese letter in source. Every reader has to be able to read all of the code, its comments and its test titles, and half of a two-language file is unavailable to somebody. Write it in English; product copy lives in the `messages/<locale>.json` catalogue behind `t()`; there is no pragma.",
    },
  },
  create(context) {
    return proseVisitors(context, (node, text) => {
      if (hasSecondLanguage(text)) context.report({ node, messageId: "vietnamese" })
    })
  },
}

/** The rules this law contributes to the plugin. */
export const rules = {
  "require-export-jsdoc": requireExportJsdoc,
  "no-emoji-in-source": noEmojiInSource,
  "no-vietnamese-in-source": noVietnameseInSource,
}

/**
 * The level this law asks for, as the plugin's own opinion.
 *
 * `require-export-jsdoc` is the one a repository adopting this with history should expect a count
 * from - every undocumented export in the tree reports at once. The other two are usually already
 * at zero, because a second language in source is noticed by readers long before a rule arrives.
 */
export const recommended = Object.fromEntries(Object.keys(rules).map((name) => [`starci-fe/${name}`, "error"]))
