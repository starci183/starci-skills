/**
 * The rules that hold `naming.md`.
 *
 * Two spellings, both of which work, which is exactly why they are rules: nothing corrects the
 * second one, so a file written on a Tuesday reads differently from its neighbour and every diff
 * afterwards carries noise that has nothing to do with the change.
 *
 * Neither rule can see intent, and both are deliberately narrow because of it. NAMING-1 fires on
 * shape alone - a module-level `function` - which is exact. NAMING-2 fires on the `handle` prefix
 * alone, which catches the rename-at-the-boundary case and nothing else; a name that merely
 * describes an action is not its business.
 */

/** Parents that make a function declaration module-level rather than nested. */
const MODULE_LEVEL_PARENTS = new Set(["Program", "ExportNamedDeclaration", "ExportDefaultDeclaration"])

// -- NAMING-1 --------------------------------------------------------------------------------------

/** A module-level function is an arrow const, so nothing exists before the line that declares it. */
export const preferArrowExport = {
  meta: {
    type: "suggestion",
    docs: { description: "Module-level functions use an arrow const, not a `function` declaration." },
    schema: [],
    messages: {
      fn: "`function {{name}}` is hoisted, so it exists before the line that declares it and the order of this file stops promising anything about what is defined when. Write `const {{name}} = (...) => {...}` - a const cannot be used before it exists, so the file reads in the order it runs.",
    },
  },
  create(context) {
    return {
      FunctionDeclaration(node) {
        const parent = node.parent && node.parent.type
        if (!MODULE_LEVEL_PARENTS.has(parent)) return
        context.report({
          node: node.id || node,
          messageId: "fn",
          data: { name: (node.id && node.id.name) || "default" },
        })
      },
    }
  },
}

// -- NAMING-2 --------------------------------------------------------------------------------------

/** Something a reader triggers is named `onX`, so the name survives being passed. */
export const handlerOnPrefix = {
  meta: {
    type: "suggestion",
    docs: { description: "Handlers are named `onX`, not `handleX`." },
    schema: [],
    messages: {
      handle: "`{{name}}` is renamed at every boundary it crosses - the slot is `on`, the DOM attribute is `onClick`, and the props type says `on{{rest}}`. Call it `on{{rest}}` at birth and the name is the same at the declaration, at the call site and in the type.",
    },
  },
  create(context) {
    const flag = (node, name) => {
      if (!name || !/^handle[A-Z]/.test(name)) return
      context.report({ node, messageId: "handle", data: { name, rest: name.slice("handle".length) } })
    }
    return {
      VariableDeclarator(node) {
        if (node.id && node.id.type === "Identifier") flag(node.id, node.id.name)
      },
      JSXAttribute(node) {
        if (node.name) flag(node.name, node.name.name)
      },
      TSPropertySignature(node) {
        if (node.key && node.key.type === "Identifier") flag(node.key, node.key.name)
      },
    }
  },
}

// -- machine-only identity -------------------------------------------------------------------------

/** A const introduces a value; it does not merely give an existing identifier a second name. */
export const noDirectConstAlias = {
  meta: {
    type: "problem",
    docs: { description: "A const must not be a direct identifier-to-identifier alias." },
    schema: [],
    messages: {
      alias:
        "`const {{alias}} = {{original}}` gives one value two names without adding behavior. Use `{{original}}` directly, or make `{{alias}}` the result of the transformation it claims to represent.",
    },
  },
  create(context) {
    return {
      VariableDeclarator(node) {
        if (node.parent?.kind !== "const") return
        if (node.id?.type !== "Identifier" || node.init?.type !== "Identifier") return
        context.report({
          node: node.id,
          messageId: "alias",
          data: { alias: node.id.name, original: node.init.name },
        })
      },
    }
  },
}

/** The rules this law contributes to the plugin. */
// -- NAMING-3 --------------------------------------------------------------------------------------

/** Letters that exist in Vietnamese and not in English, in the forms a path can carry. */
const SECOND_LANGUAGE_PATH = /[àáâãèéêìíòóôõùúýăđĩũơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i

/**
 * Second-language words spelled in ASCII, as a route or folder segment writes them.
 *
 * A path cannot carry diacritics, so `cấp phát` reaches the filesystem as `cap-phat` and every
 * accent-based check passes it. The segments below are the ones this product actually produced.
 * A list is the honest instrument here: guessing at Vietnamese-shaped ASCII would refuse `dang`
 * in `dangerous` and `cap` in `capacity`, and a rule that fires on English words is one a
 * repository turns off.
 */
const ROMANISED = [
  "dang-nhap", "dang-ky", "dang-xuat", "cap-phat", "khoa-hoc", "hoc-vien", "gioi-thieu",
  "lien-he", "tai-khoan", "thanh-toan", "gio-hang", "tin-tuc", "san-pham", "bang-gia",
  "dieu-khoan", "chinh-sach", "trang-chu", "quan-ly", "cai-dat", "ho-so",
]

/** A route segment or folder name, lowercased, from a normalized path. */
const segmentsOf = (filename) =>
  String(filename || "").replace(/\\/g, "/").toLowerCase().split("/").filter(Boolean)

/**
 * A path names things in one language: the one every reader of this repository shares.
 *
 * WHY A PATH AND NOT ONLY THE SOURCE. `no-second-language-in-source` reads identifiers, comments
 * and strings, and cannot see the file it is reading. So a route could be `app/cap-phat/page.tsx`
 * with every identifier inside it in English, and nothing said a word - while the URL, the import
 * specifier, the folder in every editor sidebar and the path in every stack trace stayed in a
 * language half the readers do not have.
 *
 * A ROUTE SEGMENT IS ALSO A PUBLIC NAME. It is the address a customer sees and a support ticket
 * quotes, so this is not only an authoring question: the product's own URLs stop being readable to
 * anybody outside one language.
 */
export const noSecondLanguageInPath = {
  meta: {
    type: "problem",
    docs: { description: "File and route names are written in the repository's one shared language." },
    schema: [],
    messages: {
      path:
        "`{{segment}}` names this file in a second language. A path is read by more people than the code inside it - it is the URL a customer quotes, the folder every editor shows, and the specifier every import repeats - and unlike a comment it cannot be skimmed past. Rename the segment; the words a person READS belong in the locale catalogue, never in the address.",
    },
  },
  create(context) {
    const filename = context.filename || context.getFilename()
    const offending = segmentsOf(filename).find(
      (segment) => SECOND_LANGUAGE_PATH.test(segment) || ROMANISED.includes(segment.replace(/[()[\]]/g, "")),
    )
    if (!offending) return {}
    return {
      Program(node) {
        context.report({ node, messageId: "path", data: { segment: offending } })
      },
    }
  },
}

export const rules = {
  "prefer-arrow-export": preferArrowExport,
  "handler-on-prefix": handlerOnPrefix,
  "no-second-language-in-path": noSecondLanguageInPath,
  "no-direct-const-alias": noDirectConstAlias,
}

/**
 * The level this law asks for, as the plugin's own opinion.
 *
 * A consuming repository's `eslint.config.mjs` stays the authority on what is actually switched on.
 * Both rules here are mechanical and auto-correctable by hand in seconds, so a repository adopting
 * them with existing debt should burn the count down rather than live at `warn`.
 */
export const recommended = Object.fromEntries(Object.keys(rules).map((name) => [`starci-fe/${name}`, "error"]))
