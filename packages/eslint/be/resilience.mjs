/**
 * The rules that keep one slow or malformed dependency from taking a process down.
 *
 * - `http-needs-timeout` (R70 `BE_HTTP_TIMEOUT`): an outbound HTTP call states how long it may take. A socket
 *   with no deadline holds a request, a connection and a worker slot for as long as the far side sleeps.
 * - `json-parse-needs-guard` (R76 `BE_JSON_PARSE_UNGUARDED`): `JSON.parse` of text that came from outside the
 *   function sits inside a `try`. A corrupt row or a hostile payload then becomes a typed outcome instead of a 500.
 * - `no-hand-rolled-retry` (R81 `BE_HAND_ROLLED_RETRY`): a loop that catches an error and waits before trying
 *   again re-implements retry by hand, outside `platform/retry`'s bounded, jittered, abortable helper.
 *
 * A call whose options are not an object literal cannot be judged from syntax, so it is left alone.
 */
import ts from "typescript"
import { keyName, walk } from "./lib/ast.mjs"
import { hfsOf } from "./lib/hfs.mjs"
import { isOwnedBy } from "./lib/ports.mjs"
import { isPackageType, isTypeNamed, typed } from "./lib/types.mjs"
import { isDeclarationFile } from "./lib/path.mjs"

const HTTP_METHODS = new Set(["get", "post", "put", "patch", "delete", "head", "request"])

/** The outbound HTTP client types a call may be made on, by the package that declares each. */
const HTTP_CLIENT_TYPES = Object.freeze([["AxiosInstance", "axios"], ["AxiosStatic", "axios"], ["HttpService", "@nestjs/axios"]])

/** Whether the node's TYPE is an outbound HTTP client (an axios instance or the Nest `HttpService`), whatever it is called. */
const isHttpClient = (context, node) => HTTP_CLIENT_TYPES.some(([name, pkg]) => isPackageType(context, node, name, pkg))

const hasKey = (objectNode, names) =>
  objectNode.properties.some((property) => property.type === "Property" && names.includes(keyName(property.key)))

const hasSpread = (objectNode) => objectNode.properties.some((property) => property.type === "SpreadElement")

/** Every outbound HTTP call carries a deadline. */
export const httpNeedsTimeout = {
  meta: {
    type: "problem",
    docs: { description: "`fetch`, axios and HttpService calls state a `timeout` or an abort `signal`." },
    schema: [],
    messages: {
      fetchNoSignal:
        "`fetch` without a `signal`. A peer that accepts the connection and then goes quiet holds this request for as long as it likes. Pass `{ signal: AbortSignal.timeout(<named ms>) }`.",
      clientNoTimeout:
        "`{{call}}` states no `timeout` or `signal`. A peer that goes quiet holds this request, its socket and a worker slot indefinitely. Pass `{ timeout: <named ms> }` (or an abort `signal`) in the request config, or set it once on `axios.create({ timeout })`.",
      createNoTimeout:
        "`axios.create` without a `timeout`. Every call through this instance inherits no deadline. Set `timeout: <named ms>` here.",
    },
  },
  create(context) {
    const filename = context.filename || context.getFilename()
    if (isDeclarationFile(filename)) return {}
    return {
      CallExpression(node) {
        const { callee } = node
        if (callee.type === "Identifier" && callee.name === "fetch") {
          const init = node.arguments[1]
          if (!init) {
            context.report({ node, messageId: "fetchNoSignal" })
          } else if (init.type === "ObjectExpression" && !hasSpread(init) && !hasKey(init, ["signal"])) {
            context.report({ node, messageId: "fetchNoSignal" })
          }
          return
        }
        if (callee.type !== "MemberExpression" || callee.computed || callee.property.type !== "Identifier") return
        const method = callee.property.name
        if (!isHttpClient(context, callee.object)) return
        const receiver = callee.object.type === "Identifier" ? callee.object.name : "client"
        if (method === "create" && isPackageType(context, callee.object, "AxiosStatic", "axios")) {
          const config = node.arguments[0]
          if (!config || (config.type === "ObjectExpression" && !hasSpread(config) && !hasKey(config, ["timeout", "signal"]))) {
            context.report({ node, messageId: "createNoTimeout" })
          }
          return
        }
        if (!HTTP_METHODS.has(method)) return
        const configAt = method === "request" ? 0 : ["post", "put", "patch"].includes(method) ? 2 : 1
        const config = node.arguments[configAt]
        if (config === undefined) {
          context.report({ node, messageId: "clientNoTimeout", data: { call: `${receiver}.${method}` } })
        } else if (config.type === "ObjectExpression" && !hasSpread(config) && !hasKey(config, ["timeout", "signal"])) {
          context.report({ node, messageId: "clientNoTimeout", data: { call: `${receiver}.${method}` } })
        }
      },
    }
  },
}

/** Whether `node` sits inside a `try` block of its own function. */
const insideTry = (node) => {
  let child = node
  let current = node.parent
  while (current) {
    if (current.type === "TryStatement" && current.block === child) return true
    if (current.type === "FunctionDeclaration" || current.type === "FunctionExpression" || current.type === "ArrowFunctionExpression") return false
    child = current
    current = current.parent
  }
  return false
}

/** `JSON.parse` of outside text fails inside a guard. */
export const jsonParseNeedsGuard = {
  meta: {
    type: "problem",
    docs: { description: "`JSON.parse` sits inside a `try` in its own function." },
    schema: [],
    messages: {
      unguarded:
        "`JSON.parse` outside a `try`. Stored text, a webhook body and a provider reply can all be malformed, and the throw surfaces far from here as an unmasked 500. Wrap it and return a typed outcome (or a `DomainError`) naming what was being parsed.",
    },
  },
  create(context) {
    const filename = context.filename || context.getFilename()
    if (isDeclarationFile(filename)) return {}
    return {
      CallExpression(node) {
        const { callee } = node
        if (callee.type !== "MemberExpression" || callee.computed) return
        if (callee.object.type !== "Identifier" || callee.object.name !== "JSON") return
        if (callee.property.type !== "Identifier" || callee.property.name !== "parse") return
        if (insideTry(node)) return
        context.report({ node, messageId: "unguarded" })
      },
    }
  },
}

/** Modules whose functions wait: `node:timers/promises` `setTimeout` and `scheduler.wait`, and the callback timers. */
const TIMER_MODULES = new Set(["node:timers/promises", "timers/promises", "node:timers", "timers"])
const LOOP_TYPES = ["ForStatement", "WhileStatement", "DoWhileStatement", "ForOfStatement", "ForInStatement"]

/** The variable a name resolves to from `node`'s scope, or null when it is a global. */
const variableOf = (context, node, name) => {
  let scope = (context.sourceCode || context.getSourceCode()).getScope(node)
  while (scope) {
    const found = scope.set.get(name)
    if (found) return found
    scope = scope.upper
  }
  return null
}

/** Whether an identifier is the global timer function of that name, not a local one. */
const isGlobalTimer = (context, identifier) => identifier.name === "setTimeout" && (variableOf(context, identifier, identifier.name)?.defs.length ?? 0) === 0

/** Whether an identifier is bound by an import of a timers module (`import { setTimeout as pause } from "node:timers/promises"`). */
const isTimerImport = (context, identifier) =>
  variableOf(context, identifier, identifier.name)?.defs.some((def) => def.type === "ImportBinding" && TIMER_MODULES.has(def.parent.source.value)) ?? false

/** The leftmost identifier of `a.b.c`, else null. */
const rootOf = (node) => {
  let current = node
  while (current.type === "MemberExpression") current = current.object
  return current.type === "Identifier" ? current : null
}

/** The import a TypeScript identifier resolves to, when it is an import of a timers module. */
const isTimerImportTs = (checker, identifier) => {
  const declarations = checker.getSymbolAtLocation(identifier)?.declarations ?? []
  return declarations.some((declaration) => {
    const importDeclaration = ts.findAncestor(declaration, ts.isImportDeclaration)
    return Boolean(importDeclaration) && ts.isStringLiteral(importDeclaration.moduleSpecifier) && TIMER_MODULES.has(importDeclaration.moduleSpecifier.text)
  })
}

/** Whether a TypeScript identifier named `setTimeout` is the ambient timer (declared by a `.d.ts`, or by nothing), not a function of the repository. */
const isGlobalTimerTs = (checker, identifier) =>
  (checker.getSymbolAtLocation(identifier)?.declarations ?? []).every((declaration) => declaration.getSourceFile().isDeclarationFile)

/** The functions a TypeScript declaration is or holds (`function f`, `const f = () => ...`, a method, a property arrow). */
const bodiesOf = (declaration) => {
  if (ts.isFunctionLike(declaration) && declaration.body) return [declaration.body]
  if ((ts.isVariableDeclaration(declaration) || ts.isPropertyDeclaration(declaration) || ts.isPropertyAssignment(declaration)) && declaration.initializer) {
    return ts.isFunctionLike(declaration.initializer) && declaration.initializer.body ? [declaration.initializer.body] : []
  }
  return []
}

/**
 * Whether calling the function a TypeScript call resolves to WAITS: its body calls the global `setTimeout`, a
 * `node:timers` function, or another function that does (followed up to three levels deep). A function declared by
 * the `platform/retry` owner is the sanctioned helper and never counts. A function whose body is not in the program
 * (a package declaration file) cannot be judged and does not count; the timer-import ban (R90) closes that door.
 */
const waitsThrough = (context, checker, call, depth, seen) => {
  const hfs = hfsOf(context)
  const target = ts.isPropertyAccessExpression(call.expression) ? call.expression.name : call.expression
  let symbol = checker.getSymbolAtLocation(target)
  if (symbol && symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol)
  for (const declaration of symbol?.declarations ?? []) {
    if (seen.has(declaration)) continue
    seen.add(declaration)
    if (isOwnedBy(hfs, declaration.getSourceFile().fileName, "platform", "retry")) continue
    for (const body of bodiesOf(declaration)) if (waitsIn(context, checker, body, depth, seen)) return true
  }
  return false
}

/** Whether a TypeScript subtree waits: it calls a timer, or a function that waits. */
const waitsIn = (context, checker, root, depth, seen) => {
  let found = false
  const visit = (node) => {
    if (found) return
    if (ts.isCallExpression(node)) {
      let base = node.expression
      while (ts.isPropertyAccessExpression(base)) base = base.expression
      if (ts.isIdentifier(base) && ((base.text === "setTimeout" && isGlobalTimerTs(checker, base)) || isTimerImportTs(checker, base))) found = true
      else if (depth > 0 && waitsThrough(context, checker, node, depth - 1, seen)) found = true
    }
    if (!found) ts.forEachChild(node, visit)
  }
  visit(root)
  return found
}

/** Whether an ESTree call waits: a global or imported timer, or a function declared outside `platform/retry` whose body waits. */
const isWaitCall = (context, node) => {
  const { callee } = node
  const root = rootOf(callee)
  if (root && (isGlobalTimer(context, root) || isTimerImport(context, root))) return true
  const { checker, toTs } = typed(context)
  const tsCall = toTs(node)
  return Boolean(tsCall) && waitsThrough(context, checker, tsCall, 3, new Set())
}

/** Whether a call catches: a `.catch(...)` on a Promise. */
const isPromiseCatch = (context, node) =>
  node.type === "CallExpression" && node.callee.type === "MemberExpression" && !node.callee.computed && node.callee.property.type === "Identifier"
  && node.callee.property.name === "catch" && isTypeNamed(context, node.callee.object, "Promise")

/** A loop that both catches an error and waits is retrying by hand. */
export const noHandRolledRetry = {
  meta: {
    type: "problem",
    docs: { description: "A loop that catches an error and waits before trying again goes through `platform/retry`, not a hand-written loop." },
    schema: [],
    messages: {
      handRolled:
        "This loop catches an error and waits before trying again - a hand-rolled retry with no attempt bound visible here, no jitter and no way to honor an abort signal. Retry through `retry(work, { maxAttempts, baseDelayMs, maxDelayMs, signal })` from `platform/retry` (or the queue's declared `attempts`/`backoff`) instead of a loop written at the call site.",
    },
  },
  create(context) {
    const filename = context.filename || context.getFilename()
    if (isDeclarationFile(filename) || isOwnedBy(hfsOf(context), filename, "platform", "retry")) return {}
    const check = (node) => {
      let hasCatch = false
      walk(node.body, (child) => {
        if (child.type === "CatchClause" || isPromiseCatch(context, child)) hasCatch = true
      }, { intoFunctions: false })
      if (!hasCatch) return
      // a wait is often a `new Promise((resolve) => setTimeout(resolve, ms))` executor, so the wait search enters functions
      let hasWait = false
      walk(node.body, (child) => {
        if (!hasWait && child.type === "CallExpression" && isWaitCall(context, child)) hasWait = true
      })
      if (hasWait) context.report({ node, messageId: "handRolled" })
    }
    return Object.fromEntries(LOOP_TYPES.map((type) => [type, check]))
  },
}

/** The rules this law contributes to the plugin. */
export const rules = {
  "http-needs-timeout": httpNeedsTimeout,
  "json-parse-needs-guard": jsonParseNeedsGuard,
  "no-hand-rolled-retry": noHandRolledRetry,
}

/** All three start at error: no baseline exists, and the repositories' fix lanes clear the debt. */
export const recommended = {
  "starci-be/http-needs-timeout": "error",
  "starci-be/json-parse-needs-guard": "error",
  "starci-be/no-hand-rolled-retry": "error",
}
