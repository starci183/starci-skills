/**
 * The rule that holds `hooks-folder.md` (HFS R56 `FE_HOOKS_ARE_HOOKS`, lint half).
 *
 * `hooks/` MEANS REACT HOOKS. One app kept its server readers there - fetch, map, no React - and
 * had a single real hook; another had a filename-equals-export rule that gave a helper shared by
 * sixteen hooks nowhere to live, so it was copied sixteen times. Both came from the standard not
 * saying where the non-hook code goes. It now does:
 *
 *   hooks/<domain>/use<Name>.ts      one hook per file
 *   hooks/<domain>/<domain>.shared.ts one file for the domain's non-hook helpers (key builders...)
 *   modules/api/<domain>/read-*.ts    server readers (wrapped in `cache()`)
 *
 * The rule holds the shape of one file at a time. Whether a folder holds exactly one `.shared.ts`
 * and whether a helper name repeats across files is a repository fact, and belongs to the
 * architecture machine that sees the whole tree.
 */

import { baseName, isSpecFile } from "./lib/scope.mjs"
import { normalizePath } from "./lib/path.mjs"

/** The path below the first `hooks/` folder, as segments, or null when the file is not in one. */
const belowHooks = (file) => {
  const match = /\/src\/hooks\/(.+)$/.exec(file) || /\/hooks\/(.+)$/.exec(file)
  return match ? match[1].split("/") : null
}

/** Names that mark a hook. */
const isHookName = (name) => /^use[A-Z0-9]/.test(name)

/** Modules that only run on the server: a reader, not a hook. */
const SERVER_ONLY = /^(?:server-only|next\/headers)$/

/** The exported names a declaration introduces. */
const exportedNames = (node) => {
  if (node.type === "ExportDefaultDeclaration") {
    const declaration = node.declaration
    return [declaration && declaration.id ? declaration.id.name : "default"]
  }
  const declaration = node.declaration
  if (!declaration) return node.specifiers.map((specifier) => specifier.exported.name)
  if (declaration.type === "FunctionDeclaration" && declaration.id) return [declaration.id.name]
  if (declaration.type === "VariableDeclaration") {
    return declaration.declarations.filter((d) => d.id.type === "Identifier").map((d) => d.id.name)
  }
  return []
}

/** `hooks/` holds React hooks and one shared helper file per domain. */
export const hooksFolderHoldsHooksOnly = {
  meta: {
    type: "problem",
    docs: { description: "`hooks/<domain>/` holds `use*.ts` hooks and one `<domain>.shared.ts`; nothing else." },
    schema: [],
    messages: {
      domain:
        "A file directly in `hooks/`. Hooks live in `hooks/<domain>/use<Name>.ts`; the domain folder is what keeps a shared helper next to the hooks that use it.",
      notHook:
        "`{{name}}` is in `hooks/` but is not a React hook. Hooks are `use<Name>.ts`; the domain's non-hook helpers go in `<domain>.shared.ts`; a server reader goes in `modules/api/<domain>/read-*.ts`.",
      export:
        "`{{name}}` is exported from a hook file but is not a hook. A hook file exports the hook (a function named `use...`); a helper belongs in `<domain>.shared.ts`.",
      many:
        "This file exports {{count}} hooks. One hook per file keeps a hook findable by its name and keeps a change to one from re-running the tests of the others.",
      sharedHook:
        "`{{name}}` is a hook exported from the shared helper file. That file holds non-hook helpers; a hook there is a hook nobody will find. Give it its own `use<Name>.ts`.",
      server:
        "`{{source}}` marks server-only code, which is a reader, not a hook. Server readers live in `modules/api/<domain>/read-*.ts`, wrapped in React's `cache()`.",
    },
  },
  create(context) {
    const file = normalizePath(context.filename || context.getFilename())
    const segments = belowHooks(file)
    if (!segments) return {}
    const name = baseName(file)
    const spec = isSpecFile(file)
    const subject = spec ? name.replace(/\.(?:test|spec)\.(?:ts|tsx)$/, ".ts") : name
    const domain = segments.length >= 2 ? segments[segments.length - 2] : null
    const isHookFile = /^use[A-Z0-9]\w*\.ts$/.test(subject)
    const isSharedFile = domain !== null && subject === `${domain}.shared.ts`

    return {
      Program(program) {
        if (segments.length < 2) return context.report({ node: program, messageId: "domain" })
        if (!isHookFile && !isSharedFile) context.report({ node: program, messageId: "notHook", data: { name } })
      },
      ImportDeclaration(node) {
        if (SERVER_ONLY.test(String(node.source.value)) && !spec) {
          context.report({ node, messageId: "server", data: { source: node.source.value } })
        }
      },
      "Program:exit"(program) {
        if (spec || (!isHookFile && !isSharedFile)) return
        const exported = program.body
          .filter((node) => node.type === "ExportNamedDeclaration" || node.type === "ExportDefaultDeclaration")
          .flatMap((node) => exportedNames(node).map((exportedName) => ({ node, name: exportedName })))
        if (isSharedFile) {
          for (const item of exported) {
            if (isHookName(item.name)) context.report({ node: item.node, messageId: "sharedHook", data: { name: item.name } })
          }
          return
        }
        const hooks = exported.filter((item) => isHookName(item.name))
        for (const item of exported) {
          if (!isHookName(item.name) && item.name !== "default") {
            context.report({ node: item.node, messageId: "export", data: { name: item.name } })
          }
        }
        if (hooks.length > 1) context.report({ node: hooks[1].node, messageId: "many", data: { count: hooks.length } })
      },
    }
  },
}

/** The rules this law contributes to the plugin. */
export const rules = {
  "hooks-folder-holds-hooks-only": hooksFolderHoldsHooksOnly,
}

/** Every rule is an error. */
export const recommended = Object.fromEntries(Object.keys(rules).map((name) => [`starci-fe/${name}`, "error"]))
