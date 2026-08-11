/**
 * The rule that holds `the-split.md`.
 *
 * ONE RULE, AND IT WATCHES ONE HALF. The drawing half's purity is checkable: a file that fetches,
 * reads a store or resolves a word is visible in what it calls. The connected half's discipline is
 * not - a file that draws badly, or settles the wrong situation, looks exactly like one that does
 * neither. So this rule guards the boundary from the side where a machine can see it, and the other
 * side stays a matter for review.
 *
 * The scope is the filename. `component.tsx` is the drawing half by convention across every tier
 * that splits, so the convention does the scoping and the rule needs no configuration.
 */

/** Forward-slash form of a filename, so Windows paths compare like every other path. */
const normalizePath = (filename) => String(filename || "").replace(/\\/g, "/")

/** The drawing half, named by the convention every split surface follows. */
const isDrawingHalf = (filename) => /(?:^|\/)component\.tsx$/.test(normalizePath(filename))

/** A connected block entrypoint and the public name its folder fixes. */
const connectedBlock = (filename) => {
  const match = normalizePath(filename).match(
    /\/src\/components\/blocks\/(?:[^/]+\/)*([A-Z][A-Za-z0-9]*)\/index\.tsx$/,
  )
  return match ? match[1] : null
}

/**
 * Calls that reach for the world instead of receiving it.
 *
 * Four families: a request, a store, the translation runtime, and a direct query. Each is a
 * dependency the drawing half cannot be rendered from a fixture without.
 */
const REACHES_FOR_THE_WORLD =
  /^(?:useSWR|useSWRMutation|use[A-Za-z0-9]*Swr|useAppSelector|useDispatch|use[A-Za-z0-9]*Store|useTranslations|useLocale|useFormatter|query[A-Z][A-Za-z0-9]*|mutation[A-Z][A-Za-z0-9]*)$/

// -- SPLIT-1 ---------------------------------------------------------------------------------------

/** The drawing half receives everything and asks for nothing. */
export const presentationalPurity = {
  meta: {
    type: "problem",
    docs: { description: "The drawing half takes resolved props: no request, no store, no translation." },
    schema: [],
    messages: {
      reaches:
        "`{{name}}(...)` reaches for the world from the drawing half. This file must be renderable from a fixture - that is what makes it testable without standing the world up first, and it is the whole reason the split exists. Move the call to `index.tsx` and pass the result down as a settled situation.",
    },
  },
  create(context) {
    if (!isDrawingHalf(context.filename || context.getFilename())) return {}
    return {
      CallExpression(node) {
        const callee = node.callee
        if (!callee || callee.type !== "Identifier") return
        if (!REACHES_FOR_THE_WORLD.test(callee.name)) return
        context.report({ node, messageId: "reaches", data: { name: callee.name } })
      },
    }
  },
}

// -- SPLIT-5 ---------------------------------------------------------------------------------------

/** A connected block delegates every render path to its exact pure twin. */
export const connectedBlockHasPresentationalTwin = {
  meta: {
    type: "problem",
    docs: { description: "A connected block index renders only its exact `_X` twin from component.tsx." },
    schema: [],
    messages: {
      missing:
        "`{{block}}` reads the world, so it must import exact `{{twin}}` from `./component`. A single leaf, one tree, or no local state is not an exception.",
      bypass:
        "Connected `{{block}}` renders `<{{rendered}}>` directly. Resolve the world here, then render only `<{{twin}}>`; component.tsx owns the complete presentation.",
      unused:
        "Connected `{{block}}` imports `{{twin}}` but never renders it. Every connected render path must cross the pure twin.",
    },
  },
  create(context) {
    const block = connectedBlock(context.filename || context.getFilename())
    if (!block) return {}

    const twin = `_${block}`
    const worldBindings = new Set()
    const rendered = []
    let importsTwin = false
    let readsWorld = false
    let rendersTwin = false

    return {
      ImportDeclaration(node) {
        const source = typeof node.source?.value === "string" ? node.source.value : ""
        for (const specifier of node.specifiers || []) {
          const imported = specifier.imported?.name
          const local = specifier.local?.name
          if (source === "./component" && imported === twin && local === twin) importsTwin = true
          if (imported && local && REACHES_FOR_THE_WORLD.test(imported)) worldBindings.add(local)
        }
      },
      CallExpression(node) {
        if (node.callee?.type !== "Identifier") return
        if (worldBindings.has(node.callee.name) || REACHES_FOR_THE_WORLD.test(node.callee.name)) {
          readsWorld = true
        }
      },
      JSXOpeningElement(node) {
        if (node.name?.type !== "JSXIdentifier") return
        rendered.push({ name: node.name.name, node })
        if (node.name.name === twin) rendersTwin = true
      },
      "Program:exit"(node) {
        if (!readsWorld) return
        if (!importsTwin) {
          context.report({ node, messageId: "missing", data: { block, twin } })
          return
        }
        for (const entry of rendered) {
          if (entry.name !== twin) {
            context.report({
              node: entry.node,
              messageId: "bypass",
              data: { block, rendered: entry.name, twin },
            })
          }
        }
        if (!rendersTwin) context.report({ node, messageId: "unused", data: { block, twin } })
      },
    }
  },
}

/** The rules this law contributes to the plugin. */
export const rules = {
  "presentational-purity": presentationalPurity,
  "connected-block-has-presentational-twin": connectedBlockHasPresentationalTwin,
}

/**
 * The level this law asks for, as the plugin's own opinion.
 *
 * Exact: it fires on a call by name, in one file by name. A repository adopting it with history
 * should expect each report to be a real move rather than a deletion - the call has to go
 * somewhere, and where it goes is the other half.
 */
export const recommended = Object.fromEntries(Object.keys(rules).map((name) => [`starci-fe/${name}`, "error"]))
