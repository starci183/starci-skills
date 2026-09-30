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

import { hfsOf } from "./lib/hfs.mjs"
import { ROUTE_SLOTS, isSpecFile, stem } from "./lib/scope.mjs"
import { normalizePath } from "./lib/path.mjs"

/** The framework's own client-only files. */
const FRAMEWORK_CLIENT = new Set(["error", "global-error"])

/** True when the program opens with the `"use client"` directive. */
const clientDirective = (program) =>
  program.body.find(
    (statement) => statement.type === "ExpressionStatement" && statement.directive === "use client",
  ) ?? null

/**
 * The component tiers of a workspace package sit directly under `src/` of the package slot `fe.package.ui`
 * (grammar tier names: composites, branches, leaves), with no `components/` folder above them. A package has no data
 * layer, so its interactive tiers, branches and leaves, are where the directive is legitimate; a composite is
 * presentation and stays a server-safe component.
 */
const PACKAGE_CLIENT_TIERS = ["branches", "leaves"]

/** True for a file in an interactive tier of the `fe.package.ui` slot: the slot says whose package it is, the tier says where. */
const isPackageClientTier = (context, file) => {
  const hfs = hfsOf(context)
  if (hfs.slotOf(file) !== "fe.package.ui") return false
  const root = hfs.ownerOf(file)
  const inside = root === null ? "" : hfs.relative(file).slice(root.length + 1)
  return PACKAGE_CLIENT_TIERS.some((tier) => inside.startsWith(`src/${tier}/`))
}

/** Where the directive is a legitimate boundary. */
const isBoundary = (context, file) =>
  FRAMEWORK_CLIENT.has(stem(file)) ||
  (/\/components\/blocks\//.test(file) && stem(file) === "index") ||
  (/\/features\/overlays\//.test(file) && stem(file) === "index") ||
  /\/components\/leaves\//.test(file) ||
  isPackageClientTier(context, file)

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
    if (isSpecFile(filename) || isBoundary(context, filename)) return {}
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

// -- FE-CLIENT-2 -----------------------------------------------------------------------------------

/** Node built-ins a browser bundle cannot carry. */
const NODE_BUILTINS = /^(?:node:.+|fs|fs\/promises|path|os|net|tls|http|https|http2|child_process|cluster|crypto|stream|zlib|dns|worker_threads)$/

/** A server-only source: the marker package, the request-scoped Next APIs, a Node built-in, a server reader. */
const serverOnlyReason = (source) => {
  if (source === "server-only") return "`server-only`"
  if (source === "next/headers") return "`next/headers`"
  if (source === "next/server") return "`next/server`"
  if (NODE_BUILTINS.test(source)) return `\`${source}\``
  if (/(?:^|\/)modules\/api\/(?:.+\/)?read-[^/]+$/.test(source)) return `the server reader \`${source}\``
  return null
}

/** A client component imports nothing that only exists on the server. */
export const clientNoServerImport = {
  meta: {
    type: "problem",
    docs: { description: "A `\"use client\"` file does not import `server-only`, `next/headers`, a Node built-in or a server reader." },
    schema: [],
    messages: {
      server:
        "This client component imports {{what}}, which exists only on the server. The build either fails or, worse, pulls server code and its secrets toward the browser bundle. Read the data in a server component or a server reader and pass the result down as props, or call the app client through SWR.",
    },
  },
  create(context) {
    const file = normalizePath(context.filename || context.getFilename())
    if (isSpecFile(file)) return {}
    let client = false
    return {
      Program(program) {
        client = clientDirective(program) !== null
      },
      ImportDeclaration(node) {
        if (!client || node.importKind === "type") return
        const what = serverOnlyReason(String(node.source.value))
        if (what) context.report({ node, messageId: "server", data: { what } })
      },
    }
  },
}

// -- FE-CLIENT-3 -----------------------------------------------------------------------------------

/** Web storage exists only in the browser and only under `modules/`, which guards it. */
const STORAGE = new Set(["localStorage", "sessionStorage"])

/** Web storage is read and written only inside `modules/`. */
export const webStorageOnlyInModules = {
  meta: {
    type: "problem",
    docs: { description: "`localStorage` and `sessionStorage` are touched only inside `modules/`." },
    schema: [],
    messages: {
      storage:
        "`{{name}}` here, outside `modules/`. Storage does not exist on the server and throws in private windows and when the quota is full, so a block that reads it during render breaks server rendering and hydrates differently from the HTML it received. Put the read and write behind a hook or a module that guards both (`typeof window`, try/catch) and let the block call that.",
    },
  },
  create(context) {
    const file = normalizePath(context.filename || context.getFilename())
    if (isSpecFile(file) || !file.includes("/src/") || /\/modules\//.test(file)) return {}
    return {
      MemberExpression(node) {
        if (node.computed || node.property.type !== "Identifier" || !STORAGE.has(node.property.name)) return
        if (node.object.type !== "Identifier" || (node.object.name !== "window" && node.object.name !== "globalThis")) return
        context.report({ node, messageId: "storage", data: { name: node.property.name } })
      },
      Identifier(node) {
        if (!STORAGE.has(node.name)) return
        const parent = node.parent
        if (parent.type === "MemberExpression" && parent.property === node) return
        if (parent.type === "Property" && parent.key === node && !parent.shorthand) return
        if (parent.type === "TSPropertySignature" || parent.type === "TSTypeAnnotation") return
        context.report({ node, messageId: "storage", data: { name: node.name } })
      },
    }
  },
}

// -- FE-CLIENT-4 -----------------------------------------------------------------------------------

/** Raw HTML is set only on a `<script>`, where the framework has no other way to inline JSON-LD or the theme bootstrap. */
export const noDangerousHtml = {
  meta: {
    type: "problem",
    docs: { description: "`dangerouslySetInnerHTML` only on `<script>`; never on a visible element." },
    schema: [],
    messages: {
      html:
        "`dangerouslySetInnerHTML` on `<{{tag}}>` writes a string into the page as markup, so any text from a user, a provider or a message catalogue becomes script. Render the content as elements. The one legitimate use is a `<script>` carrying JSON-LD or the theme bootstrap, from a constant this app wrote.",
    },
  },
  create(context) {
    if (isSpecFile(context.filename || context.getFilename())) return {}
    return {
      JSXAttribute(node) {
        if (node.name.type !== "JSXIdentifier" || node.name.name !== "dangerouslySetInnerHTML") return
        const opening = node.parent
        const tag = opening.name.type === "JSXIdentifier" ? opening.name.name : "element"
        if (tag !== "script") context.report({ node, messageId: "html", data: { tag } })
      },
    }
  },
}

/** The rules this law contributes to the plugin. */
export const rules = {
  "use-client-only-at-boundary": useClientOnlyAtBoundary,
  "client-no-server-import": clientNoServerImport,
  "web-storage-only-in-modules": webStorageOnlyInModules,
  "no-dangerous-html": noDangerousHtml,
}

/** Every rule is an error. */
export const recommended = Object.fromEntries(Object.keys(rules).map((name) => [`starci-fe/${name}`, "error"]))
