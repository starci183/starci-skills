/**
 * The rules that hold `comments.md`.
 *
 * Six rules, and each is careful about a different false positive:
 *
 *   - `require-export-jsdoc` skips plain data constants. `export const MAX_ATTEMPTS = 3` is already
 *     fully described by its own name, and demanding a sentence there produces sentences that
 *     restate the name - which COMMENT-3 forbids. Only declarations with a surface get the check.
 *   - `require-public-member-jsdoc` (R109) judges only what a caller reaches: a private, protected or `#` member, the
 *     constructor and an index signature are not surface, overload signatures of one name share one doc, and a property
 *     set to a literal or a named constant is a data constant (COMMENT-1's reason). Product source only: the test tiers
 *     (`e2e`, `fixtures` of the slot manifest) document their spec-read shapes at the type.
 *   - `require-enum-member-jsdoc` can check that a doc EXISTS and never that it states a
 *     consequence. That half is read by a person, and the rule says so rather than pretending.
 *   - `no-non-ascii-source` takes no exemption marker: HFS removed `vn-ok`, so text a program depends on
 *     lives in a message catalog (slot be.domain.messages, of any module tier, or be.feature.messages), the only place Vietnamese may appear. Specs
 *     and fixtures get no exemption.
 *   - `no-restated-name-jsdoc` (law 7) holds the decidable slice of law 3 - a doc block whose only
 *     content is the declared name re-spelled in words teaches nothing beyond the import line, so it
 *     is COMMENT-3's violation wearing COMMENT-1's shape. It fires only on an exact match between the
 *     doc's content words and the name's own words, so a doc that adds any real information is left
 *     alone - the rest of law 3 (whether a sentence explains something outside the line) is not
 *     decidable and stays a human read.
 */

import { hfsOf } from "./lib/hfs.mjs"
import { normalizePath } from "./lib/path.mjs"
import { hasSecondLanguage } from "./runtime/scripts/lib/language.mjs"

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
const VIETNAMESE_LETTER_NOTE = "detected by scripts/lib/language.mjs (`hasSecondLanguage`), structural on characters and folded to NFC so a decomposed spelling is caught too"

/** Emoji and pictographs. */
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{1F000}-\u{1F0FF}\u{2600}-\u{27BF}\u{FE0F}\u{1F1E6}-\u{1F1FF}]/u

/** Ornamental marks that stand in for a word. */
const ORNAMENT = /[✅❌✔✖✗✘⭐⬆⬇➡⬅]/

/**
 * The fixtures slot that may carry localized text: a test data file that reproduces a real localized string. Placement is
 * the whole marker (there is no pragma), and specs never live there, so a test title is never exempt.
 */
const FIXTURE_SLOTS = new Set(["be.tests.fixtures.i18n"])

/** The Vietnamese language's own name, which is a label rather than prose. */
const ENDONYM = /Ti\u1ebfng Vi\u1ec7t/

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
  const withoutEndonym = line.normalize("NFC").replace(ENDONYM, "")
  if (hasSecondLanguage(withoutEndonym)) return "a Vietnamese letter"
  if (EMOJI.test(withoutEndonym)) return "an emoji"
  if (ORNAMENT.test(withoutEndonym)) return "an ornamental symbol"
  return null
}

/**
 * Whether an exported declaration has a surface a caller documents: a data constant is already described by its name,
 * and a kind outside DOCUMENTED_KINDS has no surface at all.
 */
const hasDocumentedSurface = (declaration) => {
  if (declaration.type === "VariableDeclaration") {
    // only a const bound to a function has a surface; a data constant is already described
    const first = declaration.declarations[0]
    const init = first && first.init
    return Boolean(init)
      && (init.type === "ArrowFunctionExpression" || init.type === "FunctionExpression")
  }
  return DOCUMENTED_KINDS.has(declaration.type)
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
      if (!hasDocumentedSurface(declaration)) return
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

// -- COMMENT-3 (R109) -----------------------------------------------------------------------------

/** Class members a caller reaches: everything but the constructor, static blocks and index signatures. */
const CLASS_MEMBER_KINDS = new Set([
  "MethodDefinition",
  "PropertyDefinition",
  "AccessorProperty",
  "TSAbstractMethodDefinition",
  "TSAbstractPropertyDefinition",
  "TSAbstractAccessorProperty",
])

/** Interface and type-literal members a caller reaches; call, construct and index signatures have no name to document. */
const SIGNATURE_MEMBER_KINDS = new Set(["TSPropertySignature", "TSMethodSignature"])

/**
 * A property set to a literal or a named constant (`name = "CreatePlans1758"`, `readonly queue = PLAN_QUEUE`) is already
 * described by its own name and value, the same reason COMMENT-1 leaves a data constant alone.
 */
const isDataProperty = (member) => {
  if (member.type !== "PropertyDefinition" || !member.value) return false
  const value = member.value
  if (value.type === "Literal" || value.type === "Identifier") return true
  if (value.type === "TemplateLiteral") return value.expressions.length === 0
  return value.type === "MemberExpression" && !value.computed && value.object.type === "Identifier"
}

/** The test tiers of the slot manifest: spec-read shapes there are documented at the type, not field by field. */
const TEST_TIERS = new Set(["e2e", "fixtures"])

/** The members of an exported class, interface or object type alias that are its public surface. */
const publicMembersOf = (declaration) => {
  if (declaration.type === "ClassDeclaration") {
    return declaration.body.body.filter((member) =>
      CLASS_MEMBER_KINDS.has(member.type)
      && member.kind !== "constructor"
      && !isDataProperty(member)
      && member.key?.type !== "PrivateIdentifier"
      && member.accessibility !== "private"
      && member.accessibility !== "protected")
  }
  if (declaration.type === "TSInterfaceDeclaration") return declaration.body.body.filter((member) => SIGNATURE_MEMBER_KINDS.has(member.type))
  if (declaration.type === "TSTypeAliasDeclaration") {
    const type = declaration.typeAnnotation
    const literals = type.type === "TSTypeLiteral" ? [type]
      : type.type === "TSIntersectionType" ? type.types.filter((part) => part.type === "TSTypeLiteral") : []
    return literals.flatMap((literal) => literal.members.filter((member) => SIGNATURE_MEMBER_KINDS.has(member.type)))
  }
  return []
}

/** The name a member is reached by, with its static side kept apart; null for a computed key the rule cannot name. */
const memberKey = (member) => {
  if (member.computed) return null
  const key = member.key
  const name = key?.type === "Identifier" ? key.name : key?.type === "Literal" ? String(key.value) : null
  return name === null ? null : `${member.static ? "static " : ""}${name}`
}

/** Every public member of an exported class, interface or object type opens with a doc block (BE-COMMENT-3). */
export const requirePublicMemberJsdoc = {
  meta: {
    type: "suggestion",
    docs: { description: "Every public member of an exported class, interface or object type alias opens with JSDoc." },
    schema: [],
    messages: {
      jsdoc:
        "`{{owner}}.{{name}}` is public surface with no doc block. A caller reaches the member, not the type's doc: say what it is for, what calling or reading it causes, or what it holds.",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode || context.getSourceCode()
    if (TEST_TIERS.has(hfsOf(context).tierOf(normalizePath(context.filename)))) return {}
    const check = (node) => {
      const declaration = node.declaration
      if (!declaration || !declaration.id) return
      // overload signatures share one name; a doc on any of them documents the member
      const groups = new Map()
      for (const member of publicMembersOf(declaration)) {
        const key = memberKey(member)
        if (key === null) continue
        if (!groups.has(key)) groups.set(key, [])
        groups.get(key).push(member)
      }
      for (const [key, members] of groups) {
        if (members.some((member) => hasJsdocBefore(sourceCode, member))) continue
        context.report({ node: members[0].key, messageId: "jsdoc", data: { owner: declaration.id.name, name: key.replace(/^static /, "") } })
      }
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
    const slot = hfsOf(context).slotOf(context.filename)
    if (CATALOG_SLOTS.has(slot) || FIXTURE_SLOTS.has(slot)) return {}

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
      if (!hasDocumentedSurface(declaration)) return
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
  "require-public-member-jsdoc": requirePublicMemberJsdoc,
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
  "starci-be/require-public-member-jsdoc": "error",
  "starci-be/no-non-ascii-source": "error",
  "starci-be/no-restated-name-jsdoc": "error",
}
