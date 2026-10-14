/** R285: API operations are wrapped by the SWR family before product code calls them. */
import { hfsOf } from "./lib/hfs.mjs"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { stringOf, walk } from "./lib/ast.mjs"
import { classOf, fileOf, globalReferences, isApiLayer, isProductSource, resolveImport } from "./lib/scope.mjs"
import { why } from "./lib/why.mjs"

/** The SWR family names its wrapper files; entries and side-effect components are not wrappers. */
const isSwrHook = (context) => {
  const found = classOf(context)
  return found.slot === "fe.hooks.swr" && !found.role && hfsOf(context).allows(fileOf(context))?.allowed === true
}

/** Cache providers and revalidation may be used by consumers; only request hooks own operations. */
const isRequestHook = (name) => /^useSWR(?:Immutable|Infinite|Mutation)?$/.test(name) || name === "default"
const swrSource = (value) => value === "swr" || value.startsWith("swr/")
const propertyName = (node) => node.computed ? node.property.value : node.property.name

/** Runtime imports of the request hooks (including aliases) are confined to named SWR wrappers. */
export const swrOnlyInFamily = {
  meta: {
    type: "problem",
    docs: { description: "FE_SWR_OUTSIDE_FAMILY: request hooks belong to fe.hooks.swr." },
    schema: [],
    messages: { outside: "FE_SWR_OUTSIDE_FAMILY: SWR request hooks belong in hooks/swr/. Call the operation's wrapper hook here; cache providers and revalidation remain available to consumers." },
  },
  create(context) {
    if (!isProductSource(context) || isSwrHook(context)) return {}
    const namespaces = new Set()
    const report = (node) => context.report({ node, messageId: "outside" })
    return {
      ImportDeclaration(node) {
        if (node.importKind === "type" || !swrSource(String(node.source.value))) return
        const runtime = node.specifiers.filter((s) => s.importKind !== "type")
        if (runtime.some((s) => s.type === "ImportDefaultSpecifier" ||
          (s.type === "ImportSpecifier" && isRequestHook(s.imported.name ?? s.imported.value)))) report(node)
        for (const specifier of runtime) if (specifier.type === "ImportNamespaceSpecifier") namespaces.add(specifier)
      },
      ExportNamedDeclaration(node) {
        if (!node.source || node.exportKind === "type" || !swrSource(String(node.source.value))) return
        if (node.specifiers.some((s) => s.exportKind !== "type" && isRequestHook(s.local.name ?? s.local.value))) report(node)
      },
      ExportAllDeclaration(node) {
        if (node.exportKind !== "type" && swrSource(String(node.source.value))) report(node)
      },
      ImportExpression(node) {
        if (node.source.type === "Literal" && swrSource(String(node.source.value))) report(node)
      },
      CallExpression(node) {
        if (node.callee.type === "Identifier" && node.callee.name === "require" && node.arguments[0]?.type === "Literal" &&
          swrSource(String(node.arguments[0].value)) && globalReferences(context, new Set(["require"])).includes(node.callee)) report(node)
      },
      "Program:exit"() {
        const source = context.sourceCode ?? context.getSourceCode()
        for (const specifier of namespaces) {
          const variable = source.getDeclaredVariables(specifier.parent).find((v) => v.name === specifier.local.name)
          for (const reference of variable?.references ?? []) {
            const id = reference.identifier
            const member = id.parent
            // Passing or destructuring the namespace also makes its request hooks available outside the family.
            if (member.type !== "MemberExpression" || member.object !== id || member.computed && member.property.type !== "Literal" ||
              isRequestHook(propertyName(member))) report(id)
          }
        }
      },
    }
  },
}

/** Type imports stay available; the API layer may compose its own operations and helpers. */
const isOperationSource = (context, value) => {
  if (typeof value !== "string") return false
  const hfs = hfsOf(context)
  let target = resolveImport(context, value)
  if (target === null) {
    // Workspace package names are read from their actual manifests, never inferred from a suffix.
    let folders
    try { folders = readdirSync(join(hfs.repoRoot, "packages"), { withFileTypes: true }) } catch { return false }
    for (const folder of folders) {
      if (!folder.isDirectory()) continue
      const root = join(hfs.repoRoot, "packages", folder.name)
      if (hfs.slotOf(join(root, "src", "index.ts")) !== "fe.package.api") continue
      let name
      try { name = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).name } catch { continue }
      if (typeof name !== "string" || !(value === name || value.startsWith(`${name}/`))) continue
      target = value === name ? join(root, "src", "index.ts") : join(root, "src", value.slice(name.length + 1))
      break
    }
    if (target === null) return false
  }
  // Prefer the actual file before a hypothetical barrel: outcome types have a more specific slot.
  const candidates = /\.[cm]?[jt]sx?$/.test(target) ? [target] : [`${target}.ts`, `${target}.tsx`, `${target}/index.ts`, `${target}/index.tsx`, target]
  const found = candidates.map((file) => hfs.classify(file)).filter((entry) => entry.status === "owned")
  if (found.some((entry) => ["fe.transport.outcome", "fe.package.api.outcome"].includes(entry.slot))) return false
  return found.some((entry) => ["fe.modules.api", "fe.package.api", "fe.transport.client", "fe.package.api.client"].includes(entry.slot))
}

const unwrap = (node) => {
  while (node && ["ChainExpression", "TSAsExpression", "TSNonNullExpression", "TSInstantiationExpression"].includes(node.type)) node = node.expression
  return node
}

/** Resolve lexical bindings so renamed imports and constant aliases keep their provenance. */
const bindingOf = (source, node) => {
  for (let scope = source.getScope(node); scope; scope = scope.upper) {
    if (scope.set.has(node.name)) return scope.set.get(node.name)
  }
  return null
}

const requestOrigin = (source, input, seen = new Set()) => {
  const node = unwrap(input)
  if (node?.type === "MemberExpression") return isRequestHook(propertyName(node)) && requestOrigin(source, node.object, seen) === "namespace" ? "request" : null
  if (node?.type !== "Identifier") return null
  const variable = bindingOf(source, node)
  if (!variable || seen.has(variable) || variable.defs.length !== 1) return null
  const definition = variable.defs[0]
  if (definition.type === "ImportBinding" && definition.parent.importKind !== "type" && swrSource(String(definition.parent.source.value))) {
    const specifier = definition.node
    if (specifier.importKind === "type") return null
    if (specifier.type === "ImportNamespaceSpecifier") return "namespace"
    return specifier.type === "ImportDefaultSpecifier" || isRequestHook(specifier.imported?.name ?? specifier.imported?.value ?? "") ? "request" : null
  }
  if (definition.node.type !== "VariableDeclarator" || definition.parent.kind !== "const") return null
  return requestOrigin(source, definition.node.init, new Set([...seen, variable]))
}

/** Every value reference to the operation must belong to an SWR fetcher, including a named local fetcher. */
const wrappedOperations = (context, program, imports) => {
  const source = context.sourceCode ?? context.getSourceCode()
  const fetchers = []
  walk(source, program, (node) => {
    if (node.type !== "CallExpression" || requestOrigin(source, node.callee) !== "request" || !node.arguments[1]) return
    let fetcher = unwrap(node.arguments[1])
    if (fetcher.type === "Identifier") {
      const definition = bindingOf(source, fetcher)?.defs[0]
      if (definition?.node.type === "VariableDeclarator" && definition.parent.kind === "const") fetcher = unwrap(definition.node.init) ?? fetcher
      else if (definition?.node.type === "FunctionDeclaration") fetcher = definition.node
    }
    fetchers.push(fetcher)
  })
  const inFetcher = (node) => fetchers.some((fetcher) => fetcher.range[0] <= node.range[0] && fetcher.range[1] >= node.range[1])
  return new Set(imports.filter(({ node }) => {
    if (node.type !== "ImportDeclaration") return inFetcher(node)
    const runtimeNames = new Set(node.specifiers.filter((s) => s.importKind !== "type").map((s) => s.local.name))
    const references = source.getDeclaredVariables(node).filter((v) => runtimeNames.has(v.name))
      .flatMap((v) => v.references.filter((r) => r.isValueReference !== false).map((r) => r.identifier))
    return references.length > 0 && references.every(inFetcher)
  }).map(({ node }) => node))
}

/** Direct operation access from domain hooks, features and components skips the request lifecycle. */
export const operationsOnlyInSwrHooks = {
  meta: {
    type: "problem",
    docs: { description: "FE_OP_OUTSIDE_SWR_HOOK: runtime API operations are consumed only by SWR wrappers." },
    schema: [],
    messages: { outside: "FE_OP_OUTSIDE_SWR_HOOK: `{{source}}` exposes API operations outside an SWR wrapper. Wrap the operation in hooks/swr/ and call that hook; type-only imports remain available." },
  },
  create(context) {
    if (!isProductSource(context) || isApiLayer(context)) return {}
    const imports = []
    const inspect = (node, value) => {
      if (isOperationSource(context, value)) imports.push({ node, value })
    }
    return {
      ImportDeclaration(node) {
        if (node.importKind !== "type" && (!node.specifiers.length || node.specifiers.some((s) => s.importKind !== "type"))) inspect(node, node.source.value)
      },
      ExportNamedDeclaration(node) {
        if (node.source && node.exportKind !== "type" && node.specifiers.some((s) => s.exportKind !== "type")) inspect(node, node.source.value)
      },
      ExportAllDeclaration(node) { if (node.exportKind !== "type") inspect(node, node.source.value) },
      ImportExpression(node) { inspect(node, stringOf(node.source)) },
      CallExpression(node) {
        if (node.callee.type === "Identifier" && node.callee.name === "require" && node.arguments[0]?.type === "Literal" &&
          globalReferences(context, new Set(["require"])).includes(node.callee)) inspect(node, node.arguments[0].value)
      },
      "Program:exit"(program) {
        if (!imports.length) return
        const wrapped = isSwrHook(context) ? wrappedOperations(context, program, imports) : new Set()
        for (const { node, value } of imports) if (!wrapped.has(node)) context.report({ node, messageId: "outside", data: { source: value } })
      },
    }
  },
}

/** Code metadata is registered on the shared object without changing the shared catalog module. */
Object.assign(why, {
  "swr-only-in-family": { code: "FE_SWR_OUTSIDE_FAMILY", en: "A request hook is used outside the SWR family.", fix: "Call the operation's SWR wrapper hook." },
  "operations-only-in-swr-hooks": { code: "FE_OP_OUTSIDE_SWR_HOOK", en: "An API operation is consumed outside an SWR wrapper.", fix: "Wrap the operation in hooks/swr/." },
})

/** R285's published lint enforcers. */
export const rules = { "swr-only-in-family": swrOnlyInFamily, "operations-only-in-swr-hooks": operationsOnlyInSwrHooks }
export const recommended = Object.fromEntries(Object.keys(rules).map((name) => [`starci-fe/${name}`, "error"]))
