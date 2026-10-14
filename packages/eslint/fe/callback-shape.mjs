/**
 * R287 FE_CALLBACK_SHAPE: the Supabase callback only reads the PKCE code, exchanges it through the auth owner, and redirects.
 * Cookie configuration and writes belong in the Supabase helper in fe.modules.auth; application data belongs in the back end.
 * This syntax check follows lexical bindings and local aliases rather than trusting a method's spelling.
 */
import { stringOf, walk } from "./lib/ast.mjs"
import { classifyImport, inSlot } from "./lib/scope.mjs"

/** Runtime expression wrappers that preserve the value's source. */
const unwrap = (node) => {
  while (node && ["AwaitExpression", "ChainExpression", "TSAsExpression", "TSTypeAssertion", "TSNonNullExpression", "TSInstantiationExpression"].includes(node.type)) node = node.expression ?? node.argument
  return node
}

/** A member's static key, including a bracketed string spelling. */
const memberName = (node) => node.computed ? stringOf(node.property) : node.property.name

/** The lexical binding of an identifier, including shadowing inside the handler. */
const bindingOf = (sourceCode, node) => {
  for (let scope = sourceCode.getScope(node); scope; scope = scope.upper) {
    const variable = scope.set.get(node.name)
    if (variable) return variable
  }
  return null
}

/** Whether an identifier refers to the actual unshadowed platform global. */
const isGlobal = (sourceCode, node, name) => node?.type === "Identifier" && node.name === name && !(bindingOf(sourceCode, node)?.defs.length)

/** The property path that a destructured binding selects from its initializer. */
const patternPath = (pattern, name) => {
  if (pattern.type === "Identifier") return pattern.name === name ? [] : null
  if (pattern.type === "AssignmentPattern") return patternPath(pattern.left, name)
  if (pattern.type !== "ObjectPattern") return null
  for (const property of pattern.properties) {
    if (property.type !== "Property") continue
    const nested = patternPath(property.value, name)
    if (nested !== null) return [property.computed ? stringOf(property.key) : property.key.name ?? property.key.value, ...nested]
  }
  return null
}

/** Route configuration is inert; a second HTTP door or an exported helper is not. */
const CONFIG_EXPORTS = new Set(["runtime", "dynamic", "revalidate", "fetchCache", "preferredRegion", "maxDuration"])
const FUNCTIONS = new Set(["FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression"])
const FORBIDDEN = new Set(["AssignmentExpression", "UpdateExpression", "ImportExpression", "TaggedTemplateExpression", "ClassDeclaration", "ClassExpression", "ForStatement", "ForInStatement", "ForOfStatement", "WhileStatement", "DoWhileStatement", "ThrowStatement", "YieldExpression", "SpreadElement", "ArrayPattern", "JSXElement", "JSXFragment"])
const TEXT = new Set(["text", "code"])

/** Find the one locally implemented GET export, refusing reexports and additional runtime exports. */
const handlerOf = (program, sourceCode) => {
  const exported = []
  for (const statement of program.body) {
    if (statement.type === "ExportDefaultDeclaration" || statement.type === "ExportAllDeclaration") return null
    if (statement.type !== "ExportNamedDeclaration" || statement.exportKind === "type") continue
    if (statement.source) return null
    const declaration = statement.declaration
    if (declaration?.type === "FunctionDeclaration") exported.push({ name: declaration.id.name, value: declaration })
    else if (declaration?.type === "VariableDeclaration") {
      for (const entry of declaration.declarations) {
        if (entry.id.type !== "Identifier") return null
        exported.push({ name: entry.id.name, value: unwrap(entry.init) })
      }
    } else if (!declaration) {
      for (const entry of statement.specifiers) {
        if (entry.exportKind === "type") continue
        const definition = bindingOf(sourceCode, entry.local)?.defs[0]
        exported.push({ name: entry.exported.name ?? entry.exported.value, value: unwrap(definition?.node.type === "VariableDeclarator" ? definition.node.init : definition?.node) })
      }
    }
  }
  const handlers = exported.filter((entry) => entry.name === "GET")
  if (handlers.length !== 1 || exported.some((entry) => entry.name !== "GET" && !CONFIG_EXPORTS.has(entry.name))) return null
  const handler = handlers[0].value
  return handler && FUNCTIONS.has(handler.type) && handler.async && !handler.generator && handler.params.length === 1 && handler.params[0].type === "Identifier" ? handler : null
}

/** The only executable callback operations, with provenance for requests, query values, auth clients and redirects. */
const callbackVerdict = (context, program) => {
  const sourceCode = context.sourceCode ?? context.getSourceCode()
  const handler = handlerOf(program, sourceCode)
  if (!handler) return false
  const imports = new Map()
  for (const statement of program.body) {
    if (statement.type !== "ImportDeclaration" || statement.importKind === "type") continue
    const source = String(statement.source.value)
    if (source === "server-only" && statement.specifiers.length === 0) continue
    const authOwner = classifyImport(context, source)?.slot === "fe.modules.auth"
    if (statement.specifiers.length === 0) return false
    for (const specifier of statement.specifiers) {
      if (specifier.importKind === "type") continue
      const name = specifier.imported?.name ?? specifier.imported?.value
      let kind = null
      if (source === "next/server" && name === "NextResponse") kind = "next-response"
      else if (source === "next/server" && name === "NextRequest") kind = "request-type"
      else if (source === "next/navigation" && name === "redirect") kind = "redirect"
      else if (authOwner && /^(?:create|get)\w*Client$/.test(name ?? "")) kind = "factory"
      else if (authOwner && name === "exchangeCodeForSession") kind = "exchange"
      else if (authOwner && /^(?:supabase|supabaseClient|authClient)$/.test(name ?? "")) kind = "client"
      if (!kind) return false
      const variable = sourceCode.getDeclaredVariables(statement).find((entry) => entry.name === specifier.local.name)
      imports.set(variable, kind)
    }
  }
  const memberKind = (kind, key) => {
    if (kind === "request" && key === "nextUrl") return "url"
    if (kind === "request" && key === "url") return "text"
    if (kind === "url" && key === "searchParams") return "params"
    if (kind === "url" && ["origin", "href", "pathname", "search", "hash", "host", "hostname", "protocol"].includes(key)) return "text"
    if (kind === "params" && ["get", "has"].includes(key)) return `params-${key}`
    if (kind === "client" && key === "auth") return "auth"
    if (kind === "auth" && key === "exchangeCodeForSession") return "exchange"
    if (kind === "next-response" && key === "redirect") return "redirect"
    if (kind === "exchange-result" && key === "error") return "exchange-error"
    if (TEXT.has(kind) && ["startsWith", "endsWith", "includes"].includes(key)) return "text-guard"
    return null
  }
  const origin = (input, seen = new Set()) => {
    const node = unwrap(input)
    if (!node) return null
    if (node.type === "Identifier") {
      const variable = bindingOf(sourceCode, node)
      if (imports.has(variable)) return imports.get(variable)
      if (!variable || seen.has(variable) || variable.defs.length !== 1) return null
      const definition = variable.defs[0]
      if (definition.type === "Parameter" && definition.node === handler) return "request"
      if (definition.node.type !== "VariableDeclarator") return null
      const path = patternPath(definition.node.id, node.name)
      const nextSeen = new Set([...seen, variable])
      return path?.reduce((kind, key) => memberKind(kind, key), origin(definition.node.init, nextSeen)) ?? null
    }
    if (node.type === "Literal") return typeof node.value === "string" ? "text" : "scalar"
    if (node.type === "TemplateLiteral") return node.expressions.every((expression) => TEXT.has(origin(expression, seen)) || origin(expression, seen) === "scalar") ? "text" : null
    if (node.type === "MemberExpression") return memberKind(origin(node.object, seen), memberName(node))
    if (node.type === "NewExpression" && isGlobal(sourceCode, node.callee, "URL")) return "url"
    if (node.type === "LogicalExpression" || node.type === "BinaryExpression") {
      const kinds = [origin(node.left, seen), origin(node.right, seen)]
      return kinds.every((kind) => TEXT.has(kind)) ? "text" : kinds.every((kind) => TEXT.has(kind) || kind === "scalar") ? "scalar" : null
    }
    if (node.type === "ConditionalExpression") {
      const kinds = [origin(node.consequent, seen), origin(node.alternate, seen)]
      return kinds[0] === kinds[1] ? kinds[0] : kinds.every((kind) => TEXT.has(kind)) ? "text" : null
    }
    if (node.type === "CallExpression") {
      const kind = origin(node.callee, seen)
      if (kind === "factory") return "client"
      if (kind === "exchange") return "exchange-result"
      if (kind === "redirect") return "redirect-result"
      if (kind === "params-get") return stringOf(node.arguments[0]) === "code" ? "code" : "text"
      if (kind === "params-has" || kind === "text-guard") return "scalar"
    }
    return null
  }
  const insideHandler = (node) => {
    for (let parent = node.parent; parent; parent = parent.parent) if (FUNCTIONS.has(parent.type)) return parent === handler
    return false
  }
  let valid = true
  let exchanges = 0
  let redirects = 0
  let factories = 0
  walk(sourceCode, program, (node) => {
    if (!valid) return false
    if (FORBIDDEN.has(node.type) || (FUNCTIONS.has(node.type) && node !== handler) || (node.type === "UnaryExpression" && node.operator === "delete")) valid = false
    if (node.type === "MemberExpression" && !origin(node)) valid = false
    // An arbitrary object can invoke a getter or a supplied toString implicitly during coercion. Only static redirect options belong here.
    if (node.type === "ObjectExpression" && !(node.parent.type === "CallExpression" && origin(node.parent.callee) === "redirect" && node.parent.arguments[1] === node && node.properties.every((property) => property.type === "Property" && !property.computed && !property.method && property.kind === "init" && (property.key.name ?? property.key.value) === "status" && property.value.type === "Literal" && [301, 302, 303, 307, 308].includes(property.value.value)))) valid = false
    if (node.type === "VariableDeclarator" && node.id.type === "ObjectPattern" && sourceCode.getDeclaredVariables(node).some((variable) => !origin(variable.identifiers[0]))) valid = false
    if (node.type === "NewExpression" && (!isGlobal(sourceCode, node.callee, "URL") || node.arguments.length < 1 || node.arguments.length > 2 || !node.arguments.every((argument) => TEXT.has(origin(argument))))) valid = false
    if (node.type === "ReturnStatement" && (!insideHandler(node) || origin(node.argument) !== "redirect-result")) valid = false
    if (node === handler && node.body.type !== "BlockStatement" && origin(node.body) !== "redirect-result") valid = false
    if (node.type !== "CallExpression") return undefined
    const kind = origin(node.callee)
    if (!insideHandler(node) || !["factory", "exchange", "redirect", "params-get", "params-has", "text-guard"].includes(kind) || node.arguments.some((argument) => argument.type === "SpreadElement")) valid = false
    else if (kind === "exchange") {
      let awaited = false
      for (let parent = node.parent; parent && parent !== handler; parent = parent.parent) {
        if (parent.type === "AwaitExpression") awaited = true
        if (parent.type.endsWith("Statement")) break
      }
      if (!awaited || node.arguments.length !== 1 || origin(node.arguments[0]) !== "code") valid = false
      exchanges += 1
    } else if (kind === "redirect") {
      if (node.arguments.length < 1 || node.arguments.length > 2 || !["text", "url"].includes(origin(node.arguments[0]))) valid = false
      redirects += 1
    } else if (kind === "factory") {
      if (node.arguments.length > 1 || node.arguments.some((argument) => origin(argument) !== "request")) valid = false
      factories += 1
    } else if (node.arguments.length !== 1 || !TEXT.has(origin(node.arguments[0]))) valid = false
    return undefined
  })
  return valid && exchanges === 1 && factories <= 1 && redirects > 0
}

/** A callback stays a PKCE exchange and redirect, with every side effect owned by the auth helper. */
export const callbackShape = {
  meta: {
    type: "problem",
    docs: { description: "R287 FE_CALLBACK_SHAPE: the Supabase callback reads the PKCE code, exchanges it through modules/auth, and redirects only." },
    schema: [],
    messages: {
      shape: "FE_CALLBACK_SHAPE: the auth callback must export an async GET that reads the query code, awaits one auth.exchangeCodeForSession(code), and redirects with NextResponse.redirect or next/navigation redirect. Create the client in modules/auth; keep data access, cookie writes, other calls and additional HTTP handlers outside the callback.",
    },
  },
  create(context) {
    if (!inSlot(context, "fe.route.callback")) return {}
    return {
      "Program:exit"(program) {
        if (!callbackVerdict(context, program)) context.report({ node: program, messageId: "shape" })
      },
    }
  },
}

/** The rule R287 contributes to the front-end plugin. */
export const rules = { "callback-shape": callbackShape }

/** Every callback shape violation is an error. */
export const recommended = { "starci-fe/callback-shape": "error" }
