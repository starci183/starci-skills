/**
 * The rule that holds `hooks-folder.md` (HFS R56 `FE_HOOKS_ARE_HOOKS`, lint half).
 *
 * `hooks/` MEANS REACT HOOKS. One app kept its server readers there - fetch, map, no React - and
 * had a single real hook; another had a filename-equals-export rule that gave a helper shared by
 * sixteen hooks nowhere to live, so it was copied sixteen times. Both came from the standard not
 * saying where the non-hook code goes. It now does, per family of the front-end stack (each its own slot):
 *
 *   hooks/swr/api/{graphql,rest}/{queries,mutations}/use{Query,Mutate,Get,Post,Put,Patch,Delete}<X>Swr.ts
 *                                     one SWR hook per modules/api operation (fe.hooks.swr), plus SwrSideEffects.tsx
 *   hooks/rhf/use<X>Form.ts           one form (fe.hooks.rhf)
 *   hooks/zustand/<store>/store.ts    one local store and its use*.ts selectors (fe.hooks.zustand)
 *   hooks/socketio/                   sockets.ts, SocketIoSideEffects.tsx, enums/, types/, use*.ts (fe.hooks.socketio)
 *   hooks/effects/use<X>.ts           app-wide side effects (fe.hooks.effects)
 *   hooks/reuseables/use<X>.ts        generic reusable hooks (fe.hooks.reuseables)
 *   hooks/<domain>/use<Name>.ts       one hook per file (fe.hooks)
 *   hooks/<domain>/<domain>.shared.ts one file for the domain's non-hook helpers (key builders...)
 *
 * A call to the back end is never a hook's own code: it is an operation of `modules/api`, which an SWR hook wraps. The two
 * `.tsx` files a family names (`SwrSideEffects.tsx`, `SocketIoSideEffects.tsx`, role `effects`) are the components a provider
 * mounts once; every other file of a family carries the name its slot gives it.
 *
 * The rule holds the shape of one file at a time. Whether a folder holds exactly one `.shared.ts`
 * and whether a helper name repeats across files is a repository fact, and belongs to the
 * architecture machine that sees the whole tree.
 */

import { importedReduxHook } from "./lib/redux-hook-origin.mjs"
import { hfsOf } from "./lib/hfs.mjs"
import { walk } from "./lib/ast.mjs"
import { functionOf, isFn, unwrap, variableOf } from "./lib/bindings.mjs"
import { baseName, classOf, fileOf, inSlot } from "./lib/scope.mjs"
import { rules as swrFamilyRules } from "./swr-family.mjs"

/** Names that mark a hook. */
const isHookName = (name) => /^use[A-Z0-9]/.test(name)

/**
 * The SWR key of a hook (`QUERY_<X>_SWR_KEY`, `MUTATE_<X>_SWR_KEY`, fe-stack data): the one constant a hook file exports beside its
 * hook, so a mutation or a socket message revalidates exactly that cache entry.
 */
const isSwrKeyName = (name) => /^[A-Z][A-Z0-9_]*_SWR_KEY$/.test(name)

/** A hook file name: `use<Name>.ts`. */
const HOOK_FILE = new RegExp(String.raw`^use[A-Z0-9]\w*\.ts$`)
const isHookFileName = (name) => HOOK_FILE.test(name)

/** Modules that only run on the server: server code, not a hook. */
const SERVER_ONLY = new Set(["server-only", "next/headers"])

/** The hooks families of the front-end stack: each slot names its files (`allows`) and its non-hook files (roles). */
const FAMILY_SLOTS = ["fe.hooks.swr", "fe.hooks.rhf", "fe.hooks.zustand", "fe.hooks.socketio", "fe.hooks.effects", "fe.hooks.reuseables"]

/** Runtime exports and their local values; type exports do not introduce hooks or helpers. */
const exportedEntries = (node) => {
  if (node.type === "ExportDefaultDeclaration") {
    const declaration = node.declaration
    return [{ node, name: declaration.id?.name ?? "default", local: declaration, default: true }]
  }
  if (node.exportKind === "type") return []
  if (node.type === "ExportAllDeclaration") return [{ node, name: "*", local: null }]
  const declaration = node.declaration
  if (!declaration) {
    return node.specifiers.filter((specifier) => specifier.exportKind !== "type").map((specifier) => ({
      node, name: specifier.exported.name ?? specifier.exported.value, local: node.source ? null : specifier.local,
      default: (specifier.exported.name ?? specifier.exported.value) === "default",
    }))
  }
  if (declaration.type === "FunctionDeclaration" && declaration.id) return [{ node, name: declaration.id.name, local: declaration }]
  if (declaration.type === "VariableDeclaration") {
    return declaration.declarations.filter((d) => d.id.type === "Identifier").map((d) => ({ node, name: d.id.name, local: d.id }))
  }
  return []
}

/** Actual React hook APIs and SWR public entry points, rather than an arbitrary `use*` spelling. */
const REACT_HOOKS = new Set([
  "use", "useState", "useReducer", "useEffect", "useLayoutEffect", "useInsertionEffect", "useRef", "useImperativeHandle",
  "useMemo", "useCallback", "useContext", "useDebugValue", "useDeferredValue", "useTransition", "useId",
  "useSyncExternalStore", "useActionState", "useOptimistic",
])
const SWR_HOOKS = new Map([
  ["swr", new Set(["useSWR", "useSWRConfig"])],
  ["swr/immutable", new Set(["useSWRImmutable"])],
  ["swr/infinite", new Set(["useSWRInfinite"])],
  ["swr/mutation", new Set(["useSWRMutation"])],
])
const SWR_DEFAULTS = new Map([["swr", "useSWR"], ["swr/immutable", "useSWRImmutable"], ["swr/infinite", "useSWRInfinite"], ["swr/mutation", "useSWRMutation"]])
const builtinHook = (origin) => origin?.source === "react-redux" || (origin?.source === "react" ? REACT_HOOKS.has(origin.name) : Boolean(SWR_HOOKS.get(origin?.source)?.has(origin.name)))
const propertyName = (node) => {
  if (!node.computed && node.property.type === "Identifier") return node.property.name
  return node.property.type === "Literal" ? node.property.value : null
}

/** SWR request hooks are default exports; its root also names useSWRConfig. */
const namedOrigin = (source, name) => {
  if (source === "react") return { source, name }
  if (name === "default" && SWR_DEFAULTS.has(source)) return { source, name: SWR_DEFAULTS.get(source) }
  return source === "swr" && name === "useSWRConfig" ? { source, name } : null
}

/** A runtime import records whether its value is a hook or its module namespace. */
const importOrigin = (definition) => {
  const specifier = definition.node
  const source = String(definition.parent.source.value)
  if (definition.parent.importKind === "type" || specifier.importKind === "type") return null
  if (source !== "react" && !SWR_HOOKS.has(source)) return null
  if (specifier.type === "ImportSpecifier") return namedOrigin(source, specifier.imported.name ?? specifier.imported.value)
  if (specifier.type === "ImportDefaultSpecifier" && SWR_DEFAULTS.has(source)) return { source, name: SWR_DEFAULTS.get(source) }
  return { source, name: null }
}

/** Resolve a constant alias, including destructuring a React/SWR namespace. */
const constantOrigin = (context, definition, variable, seen) => {
  const declaration = definition.node
  if (declaration.type !== "VariableDeclarator" || definition.parent.kind !== "const") return null
  const origin = hookOrigin(context, declaration.init, seen)
  if (declaration.id.type === "Identifier") return origin
  if (declaration.id.type !== "ObjectPattern" || !origin || origin.name !== null) return null
  const property = declaration.id.properties.find((entry) => entry.type === "Property" && entry.value.type === "Identifier" && entry.value.name === variable.name)
  if (!property) return null
  const name = property.computed || property.key.type === "Literal" ? property.key.value : property.key.name
  return namedOrigin(origin.source, name)
}

/** Follow lexical bindings so shadowed, reassigned and unrelated `use*` values cannot prove a hook. */
const hookOrigin = (context, input, seen = new Set()) => {
  const node = unwrap(input)
  if (node?.type === "MemberExpression") {
    const origin = hookOrigin(context, node.object, seen)
    if (origin?.name !== null) return null
    const name = propertyName(node)
    return namedOrigin(origin.source, name)
  }
  if (node?.type !== "Identifier") return null
  const variable = variableOf(context, node)
  if (!variable || seen.has(variable) || variable.defs.length !== 1) return null
  if (variable.references.some((reference) => reference.isWrite() && !reference.init)) return null
  const definition = variable.defs[0]
  if (definition.type === "ImportBinding") {
    const origin = importOrigin(definition)
    if (origin) return origin
    return importedReduxHook(context, definition) ? { source: "react-redux", name: "hook" } : null
  }
  return constantOrigin(context, definition, variable, new Set([...seen, variable]))
}

/** The exported function itself must call the hook; an unused nested callback is not evidence. */
const callsBuiltinHook = (context, local) => {
  const hook = functionOf(context, local)
  if (!hook) return false
  let found = false
  walk(context.sourceCode, hook.body, (node) => {
    if (found || isFn(node)) return false
    if (node.type === "CallExpression" && builtinHook(hookOrigin(context, node.callee))) found = true
    return undefined
  })
  return found
}

/** Exactly one named, locally implemented hook; optional SWR key and type exports remain available. */
const checkHookExports = (context, program, exported) => {
  const hooks = exported.filter((item) => !item.default && isHookName(item.name))
  const defaults = exported.filter((item) => item.default)
  for (const item of defaults) context.report({ node: item.node, messageId: "defaultExport" })
  for (const item of exported) {
    if (!item.default && !isHookName(item.name) && !isSwrKeyName(item.name)) {
      context.report({ node: item.node, messageId: "export", data: { name: item.name } })
    }
  }
  if (hooks.length === 0 && defaults.length === 0) context.report({ node: program, messageId: "missing" })
  if (hooks.length > 1) context.report({ node: hooks[1].node, messageId: "many", data: { count: hooks.length } })
  for (const item of hooks) {
    if (!callsBuiltinHook(context, item.local)) context.report({ node: item.node, messageId: "fake", data: { name: item.name } })
  }
}

/**
 * What the linted file is inside `hooks/`, or null when no hooks slot owns it: `stray` is a file its slot does not name
 * (directly in `hooks/`, a non-hook name in a domain, a name outside a family's `allows`); `hookFile` a `use<Name>.ts` hook
 * file; `sharedFile` a domain's `<domain>.shared.ts`.
 */
const hookFileOf = (context) => {
  const hfs = hfsOf(context)
  const file = fileOf(context)
  const found = classOf(context)
  const name = baseName(file)
  if (inSlot(context, ...FAMILY_SLOTS)) {
    const verdict = hfs.allows(file)
    const stray = Boolean(verdict) && !verdict.allowed
    const allows = (verdict?.allows ?? hfs.slot(found.slot)?.allows ?? []).join("`, `")
    // A role the slot names (`entry`, `effects`, `store`) or a non-hook file it allows (sockets.ts, enums/, types/, barrels) is no hook file.
    return { stray, directlyInHooks: false, hookFile: !stray && !found.role && isHookFileName(name), sharedFile: false, family: found.slot, allows }
  }
  if (!inSlot(context, "fe.hooks")) return null
  // A file directly in `hooks/` is its own root: the slot binds the file name as the `domain`.
  const directlyInHooks = hfs.relative(file) === found.root
  // The slot names the domain's entry (`index.ts`, role `entry`) and its shared helper file (`<domain>.shared.ts`, role `shared`).
  // Both sit directly in the domain folder: a nested `x/index.ts` is a file the slot does not name.
  const directlyInDomain = hfs.relative(file) === `${found.root}/${name}`
  const entryFile = directlyInDomain && found.role === "entry"
  const sharedFile = directlyInDomain && found.role === "shared"
  const hookFile = isHookFileName(name)
  return { stray: !hookFile && !sharedFile && !entryFile, directlyInHooks, hookFile, sharedFile, family: null, allows: "" }
}

/** `hooks/` holds React hooks, each under the name its family or domain gives it, and one shared helper file per domain. */
export const hooksFolderHoldsHooksOnly = {
  meta: {
    type: "problem",
    docs: { description: "`hooks/` holds `use*.ts` hooks under the names their family slot gives (`hooks/swr`, `hooks/rhf`, `hooks/zustand`, `hooks/socketio`, `hooks/effects`, `hooks/reuseables`) and, per domain, one `<domain>.shared.ts`; nothing else." },
    schema: [],
    messages: {
      domain:
        "A file directly in `hooks/`. Hooks live in a family folder (`hooks/swr/`, `hooks/rhf/`, `hooks/zustand/<store>/`, `hooks/socketio/`, `hooks/effects/`, `hooks/reuseables/`) or in `hooks/<domain>/use<Name>.ts`; the folder is what keeps a hook findable and a shared helper next to the hooks that use it.",
      notHook:
        "`{{name}}` is in `hooks/` but is not a React hook. Hooks are `use<Name>.ts`; the domain's non-hook helpers go in `<domain>.shared.ts`; a call to the back end is an operation of `modules/api`, wrapped by an SWR hook in `hooks/swr/`.",
      family:
        "`{{name}}` is not a file `{{family}}` names. This family holds `{{allows}}`: an SWR hook is `use{Query,Mutate}<X>Swr.ts` (GraphQL) or `use{Get,Post,Put,Patch,Delete}<X>Swr.ts` (REST) in its `api/<protocol>/<queries|mutations>/` folder, a form is `use<X>Form.ts`. A name outside the list is a hook nobody finds by its family, or code that is not a hook.",
      export:
        "`{{name}}` is exported from a hook file but is not a hook. A hook file exports the hook (a function named `use...`) and at most its SWR key (`QUERY_<X>_SWR_KEY`, `MUTATE_<X>_SWR_KEY`); a helper belongs in `<domain>.shared.ts`.",
      many:
        "This file exports {{count}} hooks. One hook per file keeps a hook findable by its name and keeps a change to one from re-running the tests of the others.",
      missing:
        "FE_HOOKS_ARE_HOOKS: a hook file exports exactly one named use* function that calls a React, Redux or SWR hook. Non-hook helpers belong in the domain's shared helper file.",
      defaultExport:
        "FE_HOOKS_ARE_HOOKS: export the hook as a named use* function. A default export does not identify the hook this file owns.",
      fake:
        "FE_HOOKS_ARE_HOOKS: `{{name}}` must be a function that calls a real React, Redux or SWR hook; a use* name alone does not make a reader or helper a hook.",
      sharedHook:
        "`{{name}}` is a hook exported from the shared helper file. That file holds non-hook helpers; a hook there is a hook nobody will find. Give it its own `use<Name>.ts`.",
      server:
        "`{{source}}` marks server-only code, which is not a hook. The front end reads its back end through the operations of `modules/api`, wrapped by the SWR hooks of `hooks/swr/`; request-scoped server APIs stay in server components.",
    },
  },
  create(context) {
    const judged = hookFileOf(context)
    if (judged === null) return {}
    const name = baseName(fileOf(context))
    return {
      Program(program) {
        if (judged.directlyInHooks) return context.report({ node: program, messageId: "domain" })
        if (!judged.stray) return
        if (judged.family) context.report({ node: program, messageId: "family", data: { name, family: judged.family, allows: judged.allows } })
        else context.report({ node: program, messageId: "notHook", data: { name } })
      },
      ImportDeclaration(node) {
        if (SERVER_ONLY.has(String(node.source.value))) {
          context.report({ node, messageId: "server", data: { source: node.source.value } })
        }
      },
      "Program:exit"(program) {
        if (judged.directlyInHooks || judged.stray || (!judged.hookFile && !judged.sharedFile)) return
        const exported = program.body
          .filter((node) => ["ExportNamedDeclaration", "ExportDefaultDeclaration", "ExportAllDeclaration"].includes(node.type))
          .flatMap(exportedEntries)
        if (judged.sharedFile) {
          for (const item of exported) {
            if (isHookName(item.name)) context.report({ node: item.node, messageId: "sharedHook", data: { name: item.name } })
          }
          return
        }
        checkHookExports(context, program, exported)
      },
    }
  },
}

/** The rules this law contributes to the plugin. */
export const rules = {
  "hooks-folder-holds-hooks-only": hooksFolderHoldsHooksOnly,
  // Forward the family enforcers for the catalog's source-only CONTRIBUTIONS discovery.
  ...swrFamilyRules,
}

/** Every rule is an error. */
export const recommended = Object.fromEntries(Object.keys(rules).map((name) => [`starci-fe/${name}`, "error"]))
