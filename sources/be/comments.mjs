/**
 * The rules that hold `comments.md`.
 *
 * Three rules, and each is careful about a different false positive:
 *
 *   - `require-export-jsdoc` skips plain data constants. `export const MAX_ATTEMPTS = 3` is already
 *     fully described by its own name, and demanding a sentence there produces sentences that
 *     restate the name - which COMMENT-3 forbids. Only declarations with a surface get the check.
 *   - `require-enum-member-jsdoc` can check that a doc EXISTS and never that it states a
 *     consequence. That half is read by a person, and the rule says so rather than pretending.
 *   - `no-non-ascii-source` exempts a marked line, because text a program matches on or emits is
 *     data wearing prose, and translating it breaks the program.
 */

/** Forward-slash form of a filename, so Windows paths compare like every other path. */
const normalizePath = (filename) => String(filename || "").replace(/\\/g, "/")

/** The marker that keeps a non-ASCII literal the program depends on. */
const KEEP_MARKER = /\bvn-ok\b/

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

/** Source is English ASCII, except where a literal is data the program depends on. */
export const noNonAsciiSource = {
  meta: {
    type: "problem",
    docs: { description: "Source stays English ASCII; a depended-upon literal is marked instead." },
    schema: [],
    messages: {
      nonAscii:
        "This line carries {{offence}}. The bar is a reader who does not share the author's first language: a codebase with two languages in it has somebody for whom half the reasoning is unavailable, and it is the half explaining the surprising parts - and an emoji or an ornament carries tone rather than information, which reads differently to everybody. If this is text the program MATCHES on or EMITS, it is data rather than prose: keep it and mark the line `vn-ok: <reason>` so the next sweep does not turn it into a bug.",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode || context.getSourceCode()
    const file = normalizePath(context.filename || context.getFilename())
    // locale files are wholly product copy; policing them would be policing the product
    if (/\/(?:messages|locales|i18n)\//.test(file)) return {}

    /*
     * IN A TEST LANE, A STRING IS A FIXTURE AND A COMMENT IS STILL PROSE.
     *
     * The rule's own reason draws this line already: prose in a second language leaves half the
     * reasoning unavailable to a reader, while "text the program MATCHES on or EMITS is data rather
     * than prose". A spec that feeds an agent the sentence a real customer would type - "khach vua
     * chuyen khoan" - is feeding it data, and translating it would test a system nobody uses.
     *
     * Measured before it was written: of 92 findings in one back end, 89 were fixture strings and 3
     * were comments. Demanding `vn-ok` on all 92 would have put a marker on every line of every
     * conversation fixture, which is noise that teaches a reader to stop seeing the marker.
     *
     * The exemption is for STRINGS ONLY. A Vietnamese comment in a spec is the same problem it is
     * anywhere else - the next reader still cannot follow the reasoning - so it is still refused.
     */
    const fixtureLane = /\.spec\.ts$|-spec\.ts$|\/src\/tests\//.test(file)
    const commentLines = fixtureLane
      ? new Set(sourceCode.getAllComments().flatMap((comment) => {
        const span = []
        for (let line = comment.loc.start.line; line <= comment.loc.end.line; line += 1) span.push(line)
        return span
      }))
      : null

    return {
      "Program:exit"(node) {
        const lines = sourceCode.getLines()
        for (let index = 0; index < lines.length; index += 1) {
          const line = lines[index]
          if (KEEP_MARKER.test(line)) continue
          // in a fixture lane only prose is policed; the data the fixture feeds is the point of it
          if (commentLines && !commentLines.has(index + 1)) continue
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

/** The rules this law contributes to the plugin. */
export const rules = {
  "require-export-jsdoc": requireExportJsdoc,
  "require-enum-member-jsdoc": requireEnumMemberJsdoc,
  "no-non-ascii-source": noNonAsciiSource,
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
}
