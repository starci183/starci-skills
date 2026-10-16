/**
 * R287 FE_CALLBACK_SHAPE: the Supabase callback only reads the PKCE code (or the email-link `token_hash` and `type`), exchanges it
 * through the auth owner with exactly one `exchangeAuthCode(code)` or one `verifyOtp({ token_hash, type })`, and redirects. It may read
 * the exchange result's `success` or `ok` flag and call PURE text helpers of `modules/routes` or `modules/auth` (`requestOrigin`,
 * `safeNextPath`), found by symbol resolution in lib/pure-owner-helper.mjs, so open-redirect protection stays in the app's owner modules.
 * Cookie configuration and writes belong in the Supabase helper in fe.modules.auth; application data belongs in the back end.
 * This syntax check follows lexical bindings and local aliases rather than trusting a method's spelling.
 */
import { stringOf, walk } from "./lib/ast.mjs"
import { normalizePath } from "./lib/path.mjs"
import { ownerExportKind } from "./lib/pure-owner-helper.mjs"
import { classifyImport, inSlot, resolveImport } from "./lib/scope.mjs"

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
const TEXT = new Set(["text", "code", "otp-type"])
const CALLS = new Set(["factory", "exchange", "verify-otp", "pure", "redirect", "params-get", "params-has", "text-guard"])
/** What a pure owner helper may be given: query text, the page URL or request, and plain values; never the credential itself. */
const PURE_ARGUMENTS = new Set(["text", "otp-type", "scalar", "url", "request"])
const URL_TEXT = new Set(["origin", "href", "pathname", "search", "hash", "host", "hostname", "protocol"])
const CALL_RESULTS = new Map([["factory", "client"], ["exchange", "exchange-result"], ["verify-otp", "exchange-result"], ["pure", "text"], ["redirect", "redirect-result"], ["params-has", "scalar"], ["text-guard", "scalar"]])
const MEMBERS = new Map([
  ["request", new Map([["nextUrl", "url"], ["url", "text"]])],
  ["url", new Map([["searchParams", "params"], ...[...URL_TEXT].map((key) => [key, "text"])])],
  ["params", new Map([["get", "params-get"], ["has", "params-has"]])],
  ["client", new Map([["auth", "auth"]])],
  ["auth", new Map([["exchangeCodeForSession", "exchange"], ["verifyOtp", "verify-otp"]])],
  ["next-response", new Map([["redirect", "redirect"]])],
  ["exchange-result", new Map([["error", "exchange-error"], ["success", "scalar"], ["ok", "scalar"]])],
])

/** The query parameters whose provenance an exchange requires: the PKCE code, and the email link's token hash and type. */
const PARAM_ORIGINS = new Map([["code", "code"], ["token_hash", "token-hash"], ["type", "otp-type"]])

/** A locally exported binding's implementation. */
const exportValue = (sourceCode, entry) => {
  const definition = bindingOf(sourceCode, entry.local)?.defs[0]?.node
  return unwrap(definition?.type === "VariableDeclarator" ? definition.init : definition)
}

/** The runtime names introduced by one local named export. */
const namedExports = (statement, sourceCode) => {
  const declaration = statement.declaration
  if (declaration?.type === "FunctionDeclaration") return [{ name: declaration.id.name, value: declaration }]
  if (declaration?.type === "VariableDeclaration") {
    if (declaration.declarations.some((entry) => entry.id.type !== "Identifier")) return null
    return declaration.declarations.map((entry) => ({ name: entry.id.name, value: unwrap(entry.init) }))
  }
  if (declaration) return []
  return statement.specifiers.filter((entry) => entry.exportKind !== "type")
    .map((entry) => ({ name: entry.exported.name ?? entry.exported.value, value: exportValue(sourceCode, entry) }))
}

/** Collect runtime exports, refusing reexports and default exports. */
const exportsOf = (program, sourceCode) => {
  const exported = []
  for (const statement of program.body) {
    if (statement.type === "ExportDefaultDeclaration" || statement.type === "ExportAllDeclaration") return null
    if (statement.type !== "ExportNamedDeclaration" || statement.exportKind === "type") continue
    if (statement.source) return null
    const entries = namedExports(statement, sourceCode)
    if (!entries) return null
    exported.push(...entries)
  }
  return exported
}

/** Find the one locally implemented GET export and its single request parameter. */
const handlerOf = (program, sourceCode) => {
  const exported = exportsOf(program, sourceCode)
  if (!exported || exported.some((entry) => entry.name !== "GET" && !CONFIG_EXPORTS.has(entry.name))) return null
  const handlers = exported.filter((entry) => entry.name === "GET")
  if (handlers.length !== 1) return null
  const handler = handlers[0].value
  if (!handler || !FUNCTIONS.has(handler.type) || !handler.async || handler.generator) return null
  return handler.params.length === 1 && handler.params[0].type === "Identifier" ? handler : null
}

/** Framework imports retain their actual owner even under a local alias. */
const frameworkImportKind = (source, name) => {
  if (source === "next/server" && name === "NextResponse") return "next-response"
  if (source === "next/server" && name === "NextRequest") return "request-type"
  if (source === "next/navigation" && name === "redirect") return "redirect"
  return null
}

/** Only the server auth entry exposes the cookie-owning exchangeAuthCode helper. */
const isServerAuthImport = (context, source) => {
  const target = normalizePath(resolveImport(context, source))
  return target.endsWith("/modules/auth/server") || target.endsWith("/modules/auth/server.ts")
}

/** A directory import resolves to its index, before the generic modules slot's hypothetical routes.ts. */
const isRoutesImport = (context, source, slot) => slot === "fe.modules.routes" || classifyImport(context, `${source}/index`)?.slot === "fe.modules.routes"

/** The exchange, client and factory names of the auth owner. */
const authImportKind = (context, source, name) => {
  if (name === "exchangeAuthCode" && isServerAuthImport(context, source)) return "exchange"
  if (name === "verifyOtp" && isServerAuthImport(context, source)) return "verify-otp"
  if (name === "exchangeCodeForSession") return "exchange"
  if (/^(?:create|get)\w*Client$/.test(name ?? "")) return "factory"
  if (["supabase", "supabaseClient", "authClient"].includes(name)) return "client"
  return null
}

/** Auth helpers and static route values must come from their declared HFS owners; any other export of `modules/routes` or `modules/auth` counts only as a pure helper or a static table. */
const ownerImportKind = (context, source, name) => {
  const slot = classifyImport(context, source)?.slot
  if (name === "APP_ROUTES" && isRoutesImport(context, source, slot)) return "routes"
  const authKind = slot === "fe.modules.auth" ? authImportKind(context, source, name) : null
  if (authKind || !(slot === "fe.modules.auth" || isRoutesImport(context, source, slot))) return authKind
  return ownerExportKind(context, source, name)
}

/** Register the allowed bindings in a single import statement. */
const addImportBindings = (context, sourceCode, statement, imports) => {
  const source = String(statement.source.value)
  if (source === "server-only" && statement.specifiers.length === 0) return true
  if (statement.specifiers.length === 0) return false
  const variables = sourceCode.getDeclaredVariables(statement)
  for (const specifier of statement.specifiers) {
    if (specifier.importKind === "type") continue
    const name = specifier.imported?.name ?? specifier.imported?.value
    const kind = frameworkImportKind(source, name) ?? ownerImportKind(context, source, name)
    if (!kind) return false
    imports.set(variables.find((entry) => entry.name === specifier.local.name), kind)
  }
  return true
}

/** Every runtime import is restricted, even if it is unused in the handler. */
const importsOf = (context, program, sourceCode) => {
  const imports = new Map()
  for (const statement of program.body) {
    if (statement.type !== "ImportDeclaration" || statement.importKind === "type") continue
    if (!addImportBindings(context, sourceCode, statement, imports)) return null
  }
  return imports
}

/** Select a known property without granting arbitrary methods on the selected value. */
const memberKind = (kind, key) => {
  if (kind === "routes" && typeof key === "string" && !["__proto__", "constructor", "prototype"].includes(key)) return "text"
  if (TEXT.has(kind) && ["startsWith", "endsWith", "includes"].includes(key)) return "text-guard"
  return MEMBERS.get(kind)?.get(key) ?? null
}

/** An identifier keeps the provenance of its one initializer or the GET request parameter. */
const identifierOrigin = (node, seen, env, origin) => {
  const variable = bindingOf(env.sourceCode, node)
  if (env.imports.has(variable)) return env.imports.get(variable)
  if (!variable || seen.has(variable) || variable.defs.length !== 1) return null
  const definition = variable.defs[0]
  if (definition.type === "Parameter" && definition.node === env.handler) return "request"
  if (definition.node.type !== "VariableDeclarator") return null
  const path = patternPath(definition.node.id, node.name)
  const nextSeen = new Set([...seen, variable])
  return path?.reduce((kind, key) => memberKind(kind, key), origin(definition.node.init, nextSeen)) ?? null
}

/** Combining known primitive values cannot introduce user-defined coercion. */
const combinedOrigin = (kinds, conditional = false) => {
  if (conditional && kinds[0] === kinds[1]) return kinds[0]
  if (kinds.every((kind) => TEXT.has(kind))) return "text"
  if (!conditional && kinds.every((kind) => TEXT.has(kind) || kind === "scalar")) return "scalar"
  return null
}

/** The source of a call's return value, independent of argument validation. */
const callOrigin = (node, seen, origin) => {
  const kind = origin(node.callee, seen)
  if (kind === "params-get") return PARAM_ORIGINS.get(stringOf(node.arguments[0])) ?? "text"
  return CALL_RESULTS.get(kind) ?? null
}

/** Composite expressions retain provenance only for supported primitive operations. */
const expressionOrigin = (node, seen, env, origin) => {
  if (node.type === "TemplateLiteral") return node.expressions.every((expression) => TEXT.has(origin(expression, seen)) || origin(expression, seen) === "scalar") ? "text" : null
  if (node.type === "MemberExpression") return memberKind(origin(node.object, seen), memberName(node))
  if (node.type === "NewExpression" && isGlobal(env.sourceCode, node.callee, "URL")) return "url"
  if (node.type === "LogicalExpression" || node.type === "BinaryExpression") return combinedOrigin([origin(node.left, seen), origin(node.right, seen)])
  if (node.type === "ConditionalExpression") return combinedOrigin([origin(node.consequent, seen), origin(node.alternate, seen)], true)
  if (node.type === "CallExpression") return callOrigin(node, seen, origin)
  return null
}

/** Follow lexical aliases rather than trusting the spelling of an identifier. */
const originOf = (env) => {
  const origin = (input, seen = new Set()) => {
    const node = unwrap(input)
    if (!node) return null
    if (node.type === "Identifier") return identifierOrigin(node, seen, env, origin)
    if (node.type === "Literal") return typeof node.value === "string" || node.value === null ? "text" : "scalar"
    return expressionOrigin(node, seen, env, origin)
  }
  return origin
}

/** The closest enclosing function must be the GET handler. */
const insideHandler = (node, handler) => {
  for (let parent = node.parent; parent; parent = parent.parent) if (FUNCTIONS.has(parent.type)) return parent === handler
  return false
}

/** Await must wrap the actual exchange call before its enclosing statement ends. */
const isAwaited = (node, handler) => {
  for (let parent = node.parent; parent && parent !== handler; parent = parent.parent) {
    if (parent.type === "AwaitExpression") return true
    if (parent.type.endsWith("Statement")) return false
  }
  return false
}

/** Only a literal redirect status is allowed in an options object. */
const isRedirectStatus = (property) => {
  if (property.type !== "Property" || property.computed || property.method || property.kind !== "init") return false
  return (property.key.name ?? property.key.value) === "status" && property.value.type === "Literal" && [301, 302, 303, 307, 308].includes(property.value.value)
}

/** Arbitrary objects can invoke getters or toString during coercion; only redirect options belong here. */
const isRedirectOptions = (node, origin) => node.parent.type === "CallExpression" && origin(node.parent.callee) === "redirect" && node.parent.arguments[1] === node && node.properties.every(isRedirectStatus)

/** The one object `verifyOtp` takes: exactly `token_hash` read from the query `token_hash` and `type` read from the query `type`. */
const isOtpArguments = (node, origin) => {
  if (node.parent.type !== "CallExpression" || origin(node.parent.callee) !== "verify-otp" || node.parent.arguments[0] !== node) return false
  const keyOf = (property) => property.type === "Property" && !property.computed && !property.method && property.kind === "init" ? property.key.name ?? property.key.value : null
  const expected = new Map([["token_hash", "token-hash"], ["type", "otp-type"]])
  return node.properties.length === expected.size && node.properties.every((property) => expected.get(keyOf(property)) === origin(property.value))
    && new Set(node.properties.map(keyOf)).size === expected.size
}

/** Non-call expressions must preserve the callback's narrow set of values and effects. */
const validExpression = (node, env, origin) => {
  if (node.type === "MemberExpression") return Boolean(origin(node))
  if (node.type === "ObjectExpression") return isRedirectOptions(node, origin) || isOtpArguments(node, origin)
  if (node.type === "VariableDeclarator" && node.id.type === "ObjectPattern") return env.sourceCode.getDeclaredVariables(node).every((variable) => origin(variable.identifiers[0]))
  if (node.type === "NewExpression") return isGlobal(env.sourceCode, node.callee, "URL") && node.arguments.length >= 1 && node.arguments.length <= 2 && node.arguments.every((argument) => TEXT.has(origin(argument)))
  if (node.type === "ReturnStatement") return insideHandler(node, env.handler) && origin(node.argument) === "redirect-result"
  if (node === env.handler && node.body.type !== "BlockStatement") return origin(node.body) === "redirect-result"
  return true
}

/** Validate arguments to each permitted operation. */
const validCall = (node, kind, env, origin) => {
  if (!insideHandler(node, env.handler) || !CALLS.has(kind) || node.arguments.some((argument) => argument.type === "SpreadElement")) return false
  if (kind === "exchange") return isAwaited(node, env.handler) && node.arguments.length === 1 && origin(node.arguments[0]) === "code"
  if (kind === "verify-otp") return isAwaited(node, env.handler) && node.arguments.length === 1 && node.arguments[0].type === "ObjectExpression"
  if (kind === "pure") return node.arguments.length <= 4 && node.arguments.every((argument) => PURE_ARGUMENTS.has(origin(argument)))
  if (kind === "redirect") return node.arguments.length >= 1 && node.arguments.length <= 2 && ["text", "url"].includes(origin(node.arguments[0]))
  if (kind === "factory") return node.arguments.length <= 1 && node.arguments.every((argument) => origin(argument) === "request")
  return node.arguments.length === 1 && TEXT.has(origin(node.arguments[0]))
}

/** Syntactic forms that add work beyond the one handler are refused outright. */
const forbiddenNode = (node, handler) => FORBIDDEN.has(node.type) || (FUNCTIONS.has(node.type) && node !== handler) || (node.type === "UnaryExpression" && node.operator === "delete")

/** Walk all runtime syntax, counting the single exchange and permitted redirects. */
const validOperations = (program, env) => {
  const origin = originOf(env)
  const counts = new Map()
  let valid = true
  walk(env.sourceCode, program, (node) => {
    if (!valid) return false
    valid = !forbiddenNode(node, env.handler) && validExpression(node, env, origin)
    if (!valid || node.type !== "CallExpression") return undefined
    const kind = origin(node.callee)
    valid = validCall(node, kind, env, origin)
    counts.set(kind, (counts.get(kind) ?? 0) + 1)
    return undefined
  })
  const exchanges = (counts.get("exchange") ?? 0) + (counts.get("verify-otp") ?? 0)
  return valid && exchanges >= 1 && (counts.get("exchange") ?? 0) <= 1 && (counts.get("verify-otp") ?? 0) <= 1 && (counts.get("factory") ?? 0) <= 1 && counts.get("redirect") > 0
}

/** The callback's request, imports and operations must all have known owners. */
const callbackVerdict = (context, program) => {
  const sourceCode = context.sourceCode ?? context.getSourceCode()
  const handler = handlerOf(program, sourceCode)
  if (!handler) return false
  const imports = importsOf(context, program, sourceCode)
  return imports !== null && validOperations(program, { sourceCode, handler, imports })
}

/** A callback stays a PKCE exchange and redirect, with every side effect owned by the auth helper. */
export const callbackShape = {
  meta: {
    type: "problem",
    docs: { description: "R287 FE_CALLBACK_SHAPE: the Supabase callback reads the PKCE code or the email-link token_hash and type, exchanges it through modules/auth (exchangeAuthCode or verifyOtp), and redirects only." },
    schema: [],
    messages: {
      shape: "FE_CALLBACK_SHAPE: the auth callback must export an async GET that reads the query code (or the email-link token_hash and type), awaits one exchangeAuthCode(code) from modules/auth/server or auth.exchangeCodeForSession(code) and, for an email link, one verifyOtp({ token_hash, type }) built from exactly those two query values, may call pure text helpers of modules/routes or modules/auth (no I/O, no await) to compute the target and validate next, and redirects with NextResponse.redirect or next/navigation redirect. Create the client in modules/auth; keep data access, cookie writes, other calls and additional HTTP handlers outside the callback.",
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
