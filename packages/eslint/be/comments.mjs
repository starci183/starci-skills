/**
 * The rules that hold `comments.md`.
 *
 * Five rules, and each is careful about a different false positive:
 *
 *   - `require-export-jsdoc` skips plain data constants. `export const MAX_ATTEMPTS = 3` is already
 *     fully described by its own name, and demanding a sentence there produces sentences that
 *     restate the name - which COMMENT-3 forbids. Only declarations with a surface get the check.
 *   - `require-enum-member-jsdoc` can check that a doc EXISTS and never that it states a
 *     consequence. That half is read by a person, and the rule says so rather than pretending.
 *   - `no-non-ascii-source` takes no exemption marker: HFS removed `vn-ok`, so text a program depends on
 *     lives in a message catalog (slot be.domain.messages or be.feature.messages), the only place Vietnamese may appear. Specs
 *     and fixtures get no exemption.
 *   - `no-restated-name-jsdoc` (law 7) holds the decidable slice of law 3 - a doc block whose only
 *     content is the declared name re-spelled in words teaches nothing beyond the import line, so it
 *     is COMMENT-3's violation wearing COMMENT-1's shape. It fires only on an exact match between the
 *     doc's content words and the name's own words, so a doc that adds any real information is left
 *     alone - the rest of law 3 (whether a sentence explains something outside the line) is not
 *     decidable and stays a human read.
 */

import { hfsOf } from "./lib/hfs.mjs"

/** The slots of the per-owner message catalogs: the only source files that may hold Vietnamese. */
const CATALOG_SLOTS = new Set(["be.domain.messages", "be.feature.messages"])

/**
 * The character classes this refuses, and why it is NOT simply "ASCII only".
 *
 * A first cut of this rule banned every non-ASCII codepoint. Measured against the reference
 * repository it reported 857 offenders -- and every one was an em dash, a box-drawing run in a
 * comment banner, or a middle dot. The code has used those freely and deliberately for its whole
 * life, so "ASCII only" was not the law being recorded; it was a stricter law being invented, which
 * is the one thing canon must not do.
 *
 * What the law actually refuses is three things, for three different reasons:
 *
 *   - VIETNAMESE letters, because a reader who does not share the author's first language loses
 *     exactly the half of the reasoning that explains the surprising parts. Matched precisely, so a
 *     European loanword (`naive`, `facade`, `Muller`) is never a false positive.
 *   - EMOJI, because they carry tone rather than information, and tone reads differently to
 *     everybody.
 *   - DECORATIVE symbols -- check marks, crosses, arrows used as ornament -- for the same reason.
 *
 * Typographic punctuation is none of those and stays.
 */
const VIETNAMESE_LETTER = /[À-ÃÈ-ÊÌÍÒ-ÕÙÚÝà-ãè-êìíò-õùúýĂăĐđĨĩŨũƠơƯưẠ-ỿ]/

/** Emoji and pictographs. */
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{1F000}-\u{1F0FF}\u{2600}-\u{27BF}\u{FE0F}\u{1F1E6}-\u{1F1FF}]/u

/** Ornamental marks that stand in for a word. */
const ORNAMENT = /[✅❌✔✖✗✘⭐⬆⬇➡⬅]/

/** The Vietnamese language's own name, which is a label rather than prose. */
const ENDONYM = /Tiếng Việt/

/** Declarations whose surface other files depend on. */
const DOCUMENTED_KINDS = new Set([
  "TSInterfaceDeclaration",
  "TSTypeAliasDeclaration",
  "TSEnumDeclaration",
  "ClassDeclaration",
  "FunctionDeclaration",
])

/** What a line offends with, or null. */
const offenceIn = (line) => {
  const withoutEndonym = line.replace(ENDONYM, "")
  if (VIETNAMESE_LETTER.test(withoutEndonym)) return "a Vietnamese letter"
  if (EMOJI.test(withoutEndonym)) return "an emoji"
  if (ORNAMENT.test(withoutEndonym)) return "an ornamental symbol"
  return null
}

/** Whether a JSDoc block sits immediately before a node. */
const hasJsdocBefore = (sourceCode, node) =>
  sourceCode
    .getCommentsBefore(node)
    .some((comment) => comment.type === "Block" && comment.value.startsWith("*"))

/** The declared name, for the message. */
const nameOf = (declaration) => {
  if (declaration.id) return declaration.id.name
  const first = declaration.declarations && declaration.declarations[0]
  return (first && first.id && first.id.name) || "this export"
}

// -- COMMENT-1 -------------------------------------------------------------------------------------

/** Every export with a surface opens with a doc block. */
export const requireExportJsdoc = {
  meta: {
    type: "suggestion",
    docs: { description: "An exported class/interface/type/enum/function opens with JSDoc." },
    schema: [],
    messages: {
      jsdoc:
        "`{{name}}` is exported with no doc block. This is surface other files depend on, and a name plus a signature says what it TAKES - never what it is for, or when to reach for it rather than the thing beside it.",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode || context.getSourceCode()
    const check = (node) => {
      const declaration = node.declaration
      // a re-export has nothing here to attach a doc to
      if (!declaration) return
      if (declaration.type === "VariableDeclaration") {
        // only a const bound to a function has a surface; a data constant is already described
        const first = declaration.declarations[0]
        const init = first && first.init
        const isFunction = init
          && (init.type === "ArrowFunctionExpression" || init.type === "FunctionExpression")
        if (!isFunction) return
      } else if (!DOCUMENTED_KINDS.has(declaration.type)) {
        return
      }
      if (hasJsdocBefore(sourceCode, node)) return
      context.report({
        node: declaration.id || declaration,
        messageId: "jsdoc",
        data: { name: nameOf(declaration) },
      })
    }
    return {
      ExportNamedDeclaration: check,
      ExportDefaultDeclaration: check,
    }
  },
}

// -- COMMENT-2 -------------------------------------------------------------------------------------

/** Every member of an exported enum carries its own doc. */
export const requireEnumMemberJsdoc = {
  meta: {
    type: "suggestion",
    docs: { description: "Every member of an exported enum carries its own JSDoc." },
    schema: [],
    messages: {
      jsdoc:
        "Enum member `{{name}}` has no doc. State what CHOOSING it causes, not what it is called - a member is picked at a call site far from the switch that gives it meaning. (A rule can only see that a doc exists; whether it states a consequence is read by a person.)",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode || context.getSourceCode()
    return {
      TSEnumDeclaration(node) {
        if (!node.parent || node.parent.type !== "ExportNamedDeclaration") return
        for (const member of node.members || []) {
          if (hasJsdocBefore(sourceCode, member)) continue
          const name = member.id && (member.id.name || member.id.value)
          context.report({ node: member, messageId: "jsdoc", data: { name: name || "?" } })
        }
      },
    }
  },
}

// -- COMMENT-4 -------------------------------------------------------------------------------------

/** Source prose is English; there is no exemption marker. */
export const noNonAsciiSource = {
  meta: {
    type: "problem",
    docs: { description: "Source stays English; no exemption marker." },
    schema: [],
    messages: {
      nonAscii:
        "This line carries {{offence}}. The bar is a reader who does not share the author's first language: a codebase with two languages in it has somebody for whom half the reasoning is unavailable, and it is the half explaining the surprising parts - and an emoji or an ornament carries tone rather than information, which reads differently to everybody. There is no exemption marker: write the text in English, or keep product copy in a locale or data file.",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode || context.getSourceCode()
    // a message catalog is product copy in two languages; every other file is prose for the next reader
    if (CATALOG_SLOTS.has(hfsOf(context).slotOf(context.filename))) return {}

    return {
      "Program:exit"(node) {
        const lines = sourceCode.getLines()
        for (let index = 0; index < lines.length; index += 1) {
          const line = lines[index]
          const offence = offenceIn(line)
          if (offence === null) continue
          context.report({
            node,
            loc: {
              line: index + 1,
              column: 0,
            },
            messageId: "nonAscii",
            data: {
              offence,
            },
          })
        }
      },
    }
  },
}

// -- law 7 -------------------------------------------------------------------------------------

/** Splits a declared name into its lowercase words, so `readUser` compares against "read user". */
const wordsOf = (name) =>
  (String(name || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .match(/[a-z0-9]+/g) || [])

/**
 * Filler a doc contributes no information by using: articles and linking words, plus the two generic
 * nouns the law's own anchor examples restate with ("the pending state", "the read user function").
 * Nothing here strips a word that could carry real content, so a doc that explains anything beyond
 * the name keeps enough leftover words to fail the equality check below.
 */
const RESTATEMENT_FILLER = new Set(["a", "an", "the", "is", "of", "for", "to", "this", "that", "function", "state"])

/** The content words a doc comment contributes once filler is stripped out. */
const docContentWords = (comment) =>
  (comment.value.match(/[A-Za-z]+/g) || [])
    .map((word) => word.toLowerCase())
    .filter((word) => !RESTATEMENT_FILLER.has(word))

/** Whether a doc's leftover content words are exactly the declared name's own words - nothing added. */
const isPureRestatement = (comment, declaredName) => {
  const content = docContentWords(comment)
  const identifier = wordsOf(declaredName)
  if (content.length === 0 || identifier.length === 0) return false
  const contentSet = new Set(content)
  const identifierSet = new Set(identifier)
  if (contentSet.size !== identifierSet.size) return false
  for (const word of contentSet) if (!identifierSet.has(word)) return false
  return true
}

/** The doc block immediately before a node, or null. */
const jsdocBefore = (sourceCode, node) =>
  sourceCode.getCommentsBefore(node).find((comment) => comment.type === "Block" && comment.value.startsWith("*"))
    || null

/** A doc block that only re-spells the declared name is COMMENT-3's violation wearing COMMENT-1's shape. */
export const noRestatedNameJsdoc = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "COMMENT-3, law 7: a doc block that restates the declared name is a COMMENT-3 violation wearing a COMMENT-1 shape, even while the lint gate that checks a doc EXISTS stays green.",
    },
    schema: [],
    messages: {
      restated:
        "This doc block only re-spells `{{name}}` in words. A name plus a signature already says what it TAKES; the doc has to say what it is FOR, or what choosing it causes, or it is a COMMENT-3 violation wearing a COMMENT-1 shape. Delete the restatement and write the reason instead.",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode || context.getSourceCode()
    const checkExport = (node) => {
      const declaration = node.declaration
      // a re-export has nothing here to attach a doc to
      if (!declaration) return
      if (declaration.type === "VariableDeclaration") {
        // only a const bound to a function has a surface; a data constant is already described
        const first = declaration.declarations[0]
        const init = first && first.init
        const isFunction = init
          && (init.type === "ArrowFunctionExpression" || init.type === "FunctionExpression")
        if (!isFunction) return
      } else if (!DOCUMENTED_KINDS.has(declaration.type)) {
        return
      }
      const doc = jsdocBefore(sourceCode, node)
      if (!doc) return
      const name = nameOf(declaration)
      if (!isPureRestatement(doc, name)) return
      context.report({ node: declaration.id || declaration, messageId: "restated", data: { name } })
    }
    return {
      ExportNamedDeclaration: checkExport,
      ExportDefaultDeclaration: checkExport,
      TSEnumDeclaration(node) {
        if (!node.parent || node.parent.type !== "ExportNamedDeclaration") return
        for (const member of node.members || []) {
          const doc = jsdocBefore(sourceCode, member)
          if (!doc) continue
          const name = member.id && (member.id.name || member.id.value)
          if (!name || !isPureRestatement(doc, name)) continue
          context.report({ node: member, messageId: "restated", data: { name } })
        }
      },
    }
  },
}

/** The rules this law contributes to the plugin. */
export const rules = {
  "require-export-jsdoc": requireExportJsdoc,
  "require-enum-member-jsdoc": requireEnumMemberJsdoc,
  "no-non-ascii-source": noNonAsciiSource,
  "no-restated-name-jsdoc": noRestatedNameJsdoc,
}

/**
 * The level this law asks for, as the plugin's own opinion.
 *
 * `no-non-ascii-source` replaces three separate rules in the reference plugin - one for Vietnamese,
 * one for emoji, one for decorative symbols. They were three character classes answering one
 * question, and a reader who hit the emoji rule learned nothing about the other two. One rule with
 * one reason is easier to obey, and impossible to satisfy by switching alphabets.
 */
export const recommended = {
  "starci-be/require-export-jsdoc": "error",
  "starci-be/require-enum-member-jsdoc": "error",
  "starci-be/no-non-ascii-source": "error",
  "starci-be/no-restated-name-jsdoc": "error",
}
