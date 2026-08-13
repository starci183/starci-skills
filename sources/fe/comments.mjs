/**
 * The rules that hold `comments.md`.
 *
 * All three reach further than their names suggest, and deliberately. A language rule that read
 * only comments would leave the same sentence legal one line lower as an identifier or a diagnostic
 * string; an emoji rule that read only JSX would miss the one in a log message. So each walks
 * comments, identifiers, string literals, template chunks and JSX text alike - everywhere prose can
 * hide in a source file.
 *
 * The exceptions are paths, not judgements, and that is on purpose: a locale dictionary IS the other
 * language, and a fixture reproducing a real string has to reproduce it exactly. A judgement-based
 * exception would be argued per file forever.
 */

/** Forward-slash form of a filename, so Windows paths compare like every other path. */
const normalizePath = (filename) => String(filename || "").replace(/\\/g, "/")

/** The letters that mark the second language this source is kept free of. */
export const SECOND_LANGUAGE_LETTER = /[À-ÃÈ-ÊÌÍÒ-ÕÙÚÝà-ãè-êìíò-õùúýĂăĐđĨĩŨũƠơƯưẠ-ỿ]/

/** The endonym a language picker must be able to render in its own script. */
const ENDONYM = /Tiếng Việt/

/** A functional literal, marked with the reason it stays. */
const OK_PRAGMA = /\bvn-ok:/

/**
 * Extended pictographs, or a regional-indicator pair.
 *
 * Two tests rather than one character class, so the class stays free of joiners and combining marks
 * - a single class covering both trips the misleading-character-class rule, and a rule that has to
 * be silenced to exist is one nobody trusts.
 */
export const hasEmoji = (text) =>
  typeof text === "string" &&
  (/\p{Extended_Pictographic}/u.test(text) || /[\u{1F1E6}-\u{1F1FF}]{2}/u.test(text))

/**
 * Paths whose second-language text or emoji is CONTENT rather than authoring.
 *
 * Two kinds only: the locale dictionaries, which are the product's other language, and fixtures,
 * which reproduce real strings and would be testing something else if they translated them.
 */
export const CONTENT_PATHS = [
  /\/messages\/[a-z-]+\.json$/i,
  /\/src\/resources\//,
  /\/__fixtures?__\//,
  /\/fixtures?\//,
  /\.fixture\.(ts|tsx|js|mjs|cjs)$/i,
  /\.test\.(ts|tsx|js|mjs|cjs)$/i,
  /\.spec\.(ts|tsx|js|mjs|cjs)$/i,
]

/** True when a file holds content rather than authoring. */
export const isContentFile = (filename) => {
  const file = normalizePath(filename)
  return CONTENT_PATHS.some((pattern) => pattern.test(file))
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
    Literal(node) {
      if (typeof node.value === "string") report(node, node.value)
    },
    TemplateElement(node) {
      report(node, node.value && node.value.cooked)
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
        "`{{name}}` is exported with no documentation block. An export is read far more often than it is written, and by people who never open the body - name the ROLE it plays, not the signature, which the signature already states.",
    },
  },
  create(context) {
    const source = context.sourceCode || context.getSourceCode()
    const hasBlock = (node) =>
      source.getCommentsBefore(node).some((comment) => comment.type === "Block" && comment.value.startsWith("*"))
    const check = (node) => {
      const declaration = node.declaration
      if (!declaration) return
      const kinds = ["VariableDeclaration", "TSInterfaceDeclaration", "FunctionDeclaration", "TSTypeAliasDeclaration"]
      if (!kinds.includes(declaration.type) || hasBlock(node)) return
      const id =
        declaration.id || (declaration.declarations && declaration.declarations[0] && declaration.declarations[0].id)
      context.report({ node: id || declaration, messageId: "jsdoc", data: { name: (id && id.name) || "this export" } })
    }
    return { ExportNamedDeclaration: check, ExportDefaultDeclaration: check }
  },
}

// -- COMMENTS-2 · COMMENTS-3 -----------------------------------------------------------------------

/** The source is English, and the exceptions are paths plus one marked pragma. */
export const noSecondLanguageInSource = {
  meta: {
    type: "problem",
    docs: { description: "Source authoring is English; locale content and marked literals are exempt." },
    schema: [],
    messages: {
      second:
        "Second-language prose in source authoring. The bar is a stranger who joins in a year and does not share the first language of whoever wrote this line - a codebase with two languages has two populations of readers, and the smaller one stops reading the parts it cannot. If this is a literal the running program matches on or emits, keep it and mark the line with `vn-ok: <reason>`.",
    },
  },
  create(context) {
    if (isContentFile(context.filename || context.getFilename())) return {}
    const source = context.sourceCode || context.getSourceCode()
    /*
     * Lines carrying the pragma, gathered once.
     *
     * The message tells the author to "mark the LINE", and until this existed
     * that was not true of a literal: the exemption tested the node's OWN text,
     * which for a string is its value, so `"Học viện Mộc" // vn-ok: ...` still
     * reported and no phrasing could satisfy it. The rule's own valid fixture
     * only passed because its string carried no diacritics at all.
     *
     * A marked line exempts the node ON it and the statement BELOW it, which are
     * the two placements the message's wording admits.
     */
    const marked = new Set()
    for (const comment of source.getAllComments()) {
      if (!OK_PRAGMA.test(comment.value)) continue
      marked.add(comment.loc.start.line)
      marked.add(comment.loc.end.line + 1)
    }
    return proseVisitors(context, (node, text) => {
      if (!text || !SECOND_LANGUAGE_LETTER.test(text)) return
      if (ENDONYM.test(text) || OK_PRAGMA.test(text)) return
      if (marked.has(node.loc.start.line)) return
      context.report({ node, messageId: "second" })
    })
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
    if (isContentFile(context.filename || context.getFilename())) return {}
    return proseVisitors(context, (node, text) => {
      if (hasEmoji(text)) context.report({ node, messageId: "emoji" })
    })
  },
}

/** The rules this law contributes to the plugin. */
export const rules = {
  "require-export-jsdoc": requireExportJsdoc,
  "no-second-language-in-source": noSecondLanguageInSource,
  "no-emoji-in-source": noEmojiInSource,
}

/**
 * The level this law asks for, as the plugin's own opinion.
 *
 * `require-export-jsdoc` is the one a repository adopting this with history should expect a count
 * from - every undocumented export in the tree reports at once. The other two are usually already
 * at zero, because a second language in source is noticed by readers long before a rule arrives.
 */
export const recommended = Object.fromEntries(Object.keys(rules).map((name) => [`starci-fe/${name}`, "error"]))
