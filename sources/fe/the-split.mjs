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

/** The rules this law contributes to the plugin. */
export const rules = {
  "presentational-purity": presentationalPurity,
}

/**
 * The level this law asks for, as the plugin's own opinion.
 *
 * Exact: it fires on a call by name, in one file by name. A repository adopting it with history
 * should expect each report to be a real move rather than a deletion - the call has to go
 * somewhere, and where it goes is the other half.
 */
export const recommended = Object.fromEntries(Object.keys(rules).map((name) => [`starci-fe/${name}`, "error"]))
