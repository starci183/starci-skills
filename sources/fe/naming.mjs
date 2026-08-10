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

/** The rules this law contributes to the plugin. */
export const rules = {
  "prefer-arrow-export": preferArrowExport,
  "handler-on-prefix": handlerOnPrefix,
}

/**
 * The level this law asks for, as the plugin's own opinion.
 *
 * A consuming repository's `eslint.config.mjs` stays the authority on what is actually switched on.
 * Both rules here are mechanical and auto-correctable by hand in seconds, so a repository adopting
 * them with existing debt should burn the count down rather than live at `warn`.
 */
export const recommended = Object.fromEntries(Object.keys(rules).map((name) => [`starci-fe/${name}`, "error"]))
