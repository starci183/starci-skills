/**
 * The rule that holds `client-boundary.md` (HFS R55, `FE_CLIENT_BOUNDARY`).
 *
 * SERVER FIRST. A route file is a server component; `"use client"` is a cost the app pays where a
 * reader interacts, and it is paid once, at the top of the interactive subtree, not sprinkled
 * wherever a hook happened to be needed. The measured alternative: 155 client files in one app,
 * a client layout that shipped a 132 KB message catalog to every page, against 3 client files in a
 * sibling app that did the same job server-first.
 *
 * The directive is allowed in exactly the places the framework or the interaction requires:
 *   - the `index.tsx` of an interactive block (or overlay), which is the connected half;
 *   - a leaf, whose interactivity is intrinsic (a menu, a tooltip trigger);
 *   - `error.tsx` and `global-error.tsx`, which Next requires to be client components.
 * Everything below a client block is already on the client and needs no directive; everything
 * above it is a server component and must not have one.
 */

import { ROUTE_SLOTS, isSpecFile, stem } from "./lib/scope.mjs"
import { normalizePath } from "./lib/path.mjs"

/** The framework's own client-only files. */
const FRAMEWORK_CLIENT = new Set(["error", "global-error"])

/** True when the program opens with the `"use client"` directive. */
const clientDirective = (program) =>
  program.body.find(
    (statement) => statement.type === "ExpressionStatement" && statement.directive === "use client",
  ) ?? null

/** Where the directive is a legitimate boundary. */
const isBoundary = (file) =>
  FRAMEWORK_CLIENT.has(stem(file)) ||
  (/\/components\/blocks\//.test(file) && stem(file) === "index") ||
  (/\/features\/overlays\//.test(file) && stem(file) === "index") ||
  /\/components\/leaves\//.test(file)

/** The slot a file fills in the route tree, when it fills one. */
const slotOf = (file) => {
  const name = stem(file)
  if (/\/app\//.test(file) && ROUTE_SLOTS.includes(name)) return name
  if (/\/features\/pages\//.test(file)) return "page owner"
  if (/\/features\/layouts\//.test(file)) return "layout owner"
  return null
}

/** `"use client"` only at an interaction boundary; pages and layouts stay server components. */
export const useClientOnlyAtBoundary = {
  meta: {
    type: "problem",
    docs: { description: "`\"use client\"` appears only at a block index, a leaf, or a Next error boundary." },
    schema: [],
    messages: {
      slot:
        "`\"use client\"` on a {{slot}}. Routes, pages and layouts are server components: making one a client component ships its whole subtree, including the message catalog, to every reader and stops it reading data on the server. Move the interaction into a block below it and put the directive on that block's `index.tsx`.",
      elsewhere:
        "`\"use client\"` here is not at an interaction boundary. The directive belongs on the `index.tsx` of the interactive block (or overlay), on a leaf whose interaction is intrinsic, or on `error.tsx`/`global-error.tsx`. Below a client block the file is already client; above one it must stay a server component.",
    },
  },
  create(context) {
    const filename = normalizePath(context.filename || context.getFilename())
    if (isSpecFile(filename) || isBoundary(filename)) return {}
    const slot = slotOf(filename)
    return {
      Program(program) {
        const directive = clientDirective(program)
        if (!directive) return
        if (slot) context.report({ node: directive, messageId: "slot", data: { slot } })
        else context.report({ node: directive, messageId: "elsewhere" })
      },
    }
  },
}

/** The rules this law contributes to the plugin. */
export const rules = {
  "use-client-only-at-boundary": useClientOnlyAtBoundary,
}

/** Every rule is an error. */
export const recommended = Object.fromEntries(Object.keys(rules).map((name) => [`starci-fe/${name}`, "error"]))
