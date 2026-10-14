/**
 * The rules that hold `transport.md` (HFS R50 `FE_TRANSPORT_OWNER`, R51 `FE_HTTP_STATUS_COLLAPSE`,
 * R52 `FE_WIRE_GENERATED`).
 *
 * ONE WIRE, ONE VOCABULARY. A front end talks to its back end only through its API layer, `modules/api` (HFS slot
 * `fe.modules.api`, or the shared api package `fe.package.api`): the auth and no-auth Apollo clients with their link chain are
 * the transport owner (slot `fe.transport.client`: `modules/api/graphql/clients/`, or `fe.package.api.client`), one file per
 * GraphQL operation runs on them, and the few REST calls (uploads, presigned URLs, auth endpoints) are axios calls in
 * `modules/api/rest/`. The layer answers in exactly one vocabulary, `GraphQLResponse` (slot `fe.transport.outcome`:
 * `modules/api/graphql/types.ts`, or `fe.package.api.outcome`). The defects the three halves prevent were measured on real
 * apps: seven transports and six result shapes in one repository, and in another a client that folded every non-2xx into
 * "could not read", so the state a real backend produces for a signed-out reader - 401, which must become `refused` and
 * send the reader to sign in - was unreachable, while a test double hid it by answering 200.
 *
 * WHAT THESE RULES CANNOT SEE. They read one file at a time, so they cannot tell that a client's
 * timeout is long enough or that a `refused` outcome is routed to the sign-in page - the module's
 * spec proves that. They hold the shapes that make it provable: the HTTP libraries and `fetch` only in the API layer, an
 * abort signal on every `fetch`, no shared mutable state, a 401/403 branch where a raw `fetch` is answered, and no null
 * standing in for a status.
 */

import ts from "typescript"
import { rules as callbackShapeRules } from "./callback-shape.mjs"
import { hfsOf } from "./lib/hfs.mjs"
import { forbiddingConcern, packageNameOf } from "./lib/fe-stack.mjs"
import { globalReferences, inSlot, isApiClient, isApiLayer, isApiRest, isOutcomeModule } from "./lib/scope.mjs"
import { typed } from "./lib/types.mjs"

/**
 * The canonical transport libraries and the one place each may be imported (fe-stack graphql, rest and realtime): Apollo in
 * the API layer, axios in its REST calls, socket.io-client in `hooks/socketio`. Matched on the package a specifier names.
 */
const PLACED_TRANSPORTS = new Map([
  ["@apollo/client", { where: "the API layer (`modules/api`)", allowed: (context) => isApiLayer(context) }],
  ["axios", { where: "the REST calls of the API layer (`modules/api/rest/`)", allowed: (context) => isApiRest(context) }],
  ["socket.io-client", { where: "`hooks/socketio/`", allowed: (context) => inSlot(context, "fe.hooks.socketio") }],
])

/**
 * Packages that send an HTTP request or open a channel of their own and are no canonical transport: a second transport is a
 * second owner. A package the fe-stack catalog forbids is refused by `fe-stack-import`, so it is not reported twice here.
 */
const TRANSPORT_PACKAGES = new Set([
  "ky", "ky-universal", "got", "node-fetch", "undici", "cross-fetch", "isomorphic-fetch", "superagent", "ofetch",
  "whatwg-fetch", "graphql-request", "urql", "next-urql", "apollo-client",
])

/** Package scopes and prefixes whose every package is a GraphQL/HTTP client of its own (`@urql/core`, `apollo-link-http`); `@apollo/client` is placed, the rest of `@apollo/` is not a front-end transport. */
const TRANSPORT_SCOPES = ["@apollo/", "@urql/", "apollo-"]

/** True when a package name is an HTTP client library no canonical slot owns. */
const isStrayTransport = (name) =>
  !PLACED_TRANSPORTS.has(name) && (TRANSPORT_PACKAGES.has(name) || TRANSPORT_SCOPES.some((prefix) => name.startsWith(prefix)))

/** The global objects that carry the same globals as the bare names. */
const GLOBAL_OBJECTS = new Set(["globalThis", "window", "self", "global"])

/** The bare globals that open a connection. */
const TRANSPORT_GLOBALS = new Set(["fetch", "Request", "EventSource", "WebSocket", "XMLHttpRequest", "navigator"])

/** The static name of a member's property, else null. */
const propertyName = (member) => {
  if (!member.computed) return member.property.type === "Identifier" ? member.property.name : null
  return member.property.type === "Literal" && typeof member.property.value === "string" ? member.property.value : null
}

/** The call of a value used directly as a callee, else null. */
const calledBy = (node) => (node.parent?.type === "CallExpression" && node.parent.callee === node ? node.parent : null)

/** True when a value is used directly as a constructor. */
const constructedBy = (node) => node.parent?.type === "NewExpression" && node.parent.callee === node

/** A use of one global transport, or null when the value does not open a connection. */
const transportUse = (node, name) => {
  if (name === "fetch") return { node, kind: "fetch", name, call: calledBy(node) }
  // A reference may save the constructor for a later call. Native realtime has no FE owner, even in the API layer.
  if (name === "WebSocket") return { node, kind: "websocket", name, call: null }
  if ((name === "Request" || name === "EventSource") && constructedBy(node)) return { node, kind: "channel", name, call: null }
  if (name === "XMLHttpRequest" && constructedBy(node)) return { node, kind: "xhr", name, call: null }
  if (name !== "navigator") return null
  const parent = node.parent
  if (parent?.type !== "MemberExpression" || parent.object !== node || propertyName(parent) !== "sendBeacon") return null
  return { node: parent, kind: "channel", name: "navigator.sendBeacon", call: calledBy(parent) }
}

/** References obtained by destructuring a global object; aliasing keeps the same transport ownership. */
const destructuredTransports = (pattern) => {
  const uses = []
  for (const property of pattern.properties) {
    if (property.type !== "Property") continue
    let name = null
    if (!property.computed && property.key.type === "Identifier") name = property.key.name
    else if (property.key.type === "Literal") name = property.key.value
    if (name !== "fetch" && name !== "WebSocket") continue
    if (name === "fetch" && (property.computed || property.key.type !== "Identifier")) continue
    uses.push(transportUse(property, name))
  }
  return uses
}

/** References reached through a global object, including static element access and destructuring. */
const globalObjectTransports = (id) => {
  const parent = id.parent
  if (parent?.type === "MemberExpression" && parent.object === id) {
    const use = transportUse(parent, propertyName(parent))
    return use ? [use] : []
  }
  if (parent?.type === "VariableDeclarator" && parent.init === id && parent.id.type === "ObjectPattern") {
    return destructuredTransports(parent.id)
  }
  return []
}

/**
 * Every use of a global transport in the file, found by scope resolution (an imported, declared or parameter `fetch` is not
 * one): `fetch` however it is reached (`fetch(...)`, `globalThis.fetch`, `window.fetch`, `const f = fetch`,
 * `const { fetch } = globalThis`), `new Request`, `new EventSource`, `navigator.sendBeacon`, `new XMLHttpRequest`,
 * and a native `WebSocket` constructor reached directly or saved under another name.
 *
 * @param {object} context - The ESLint rule context.
 * @returns {Array<{ node: object, kind: "fetch" | "channel" | "websocket" | "xhr", name: string, call: object | null }>} The uses; `call` is the call of `fetch` when it is called there.
 */
const transportUses = (context) => {
  const uses = []
  for (const id of globalReferences(context, new Set([...TRANSPORT_GLOBALS, ...GLOBAL_OBJECTS]))) {
    // `typeof fetch` names the type of the function; it does not call it.
    if (id.parent?.type === "TSTypeQuery") continue
    if (GLOBAL_OBJECTS.has(id.name)) uses.push(...globalObjectTransports(id))
    else {
      const use = transportUse(id, id.name)
      if (use) uses.push(use)
    }
  }
  return uses
}

// -- FE-TRANSPORT-1 --------------------------------------------------------------------------------

/**
 * `fetch` is reached only in the API layer, each canonical transport library only in its home, and no other HTTP library exists.
 *
 * The API layer is every file of the slots `fe.modules.api`, `fe.transport.client`, `fe.transport.outcome` (an app's
 * `modules/api/`) and `fe.package.api*` (the shared api package): the Apollo clients and their links, the operations and the
 * REST calls. `@apollo/client` is imported there and nowhere else, `axios` only by its REST calls (`modules/api/rest/`),
 * `socket.io-client` only by `hooks/socketio/`. Native `WebSocket` is refused everywhere, including the API layer.
 * Every other file reaches the back end through an SWR hook over an operation.
 */
export const fetchOnlyInApiClient = {
  meta: {
    type: "problem",
    docs: { description: "`fetch` (and `Request`, `EventSource`, `sendBeacon`) lives in the API layer (`modules/api`); native WebSocket is refused; Apollo, axios and socket.io-client are imported only in their homes; no other HTTP library exists." },
    schema: [],
    messages: {
      outside:
        "`fetch` outside the API layer (`modules/api`, or the shared api package). The front end reaches its back end through one layer: the Apollo clients in `modules/api/graphql/clients/` carry every GraphQL operation and the axios calls in `modules/api/rest/` the few REST ones; a second path is a second place that must remember the timeout, the credential and the status mapping, and it will forget one. Call an operation of `modules/api` through its SWR hook (`hooks/swr/`).",
      channel:
        "`{{name}}` opens a connection outside the API layer. `Request`, `EventSource` and `navigator.sendBeacon` are transports of their own; the API layer (`modules/api`) owns every request, and realtime is the socket.io client of `hooks/socketio/`. Call an operation of `modules/api` through its SWR hook.",
      library:
        "`{{name}}` is a second HTTP transport. The front end talks to its back end through Apollo (`modules/api/graphql`) and the axios REST calls (`modules/api/rest`); another library is another set of timeout, retry and error rules. Use an operation of `modules/api`.",
      placed:
        "`{{name}}` is imported outside {{where}}, the one place the front-end stack gives it. A component or hook that holds the transport itself skips the link chain (token, locale, retry, timeout) and the one result vocabulary. Call an operation of `modules/api` through its SWR hook (`hooks/swr/`), or listen through `hooks/socketio/`.",
      xhr: "`XMLHttpRequest` is a second transport. Use an operation of the API layer (`modules/api`).",
      websocket: "Native `WebSocket` is a second realtime transport. Use socket.io-client in `hooks/socketio/`, the front end's realtime owner.",
    },
  },
  create(context) {
    const layer = isApiLayer(context)
    const library = (node, source) => {
      const name = packageNameOf(source)
      if (name === null || forbiddingConcern(source)) return
      const placed = PLACED_TRANSPORTS.get(name)
      if (placed) {
        if (!placed.allowed(context)) context.report({ node, messageId: "placed", data: { name, where: placed.where } })
      } else if (isStrayTransport(name)) context.report({ node, messageId: "library", data: { name: source } })
    }
    return {
      "Program:exit"() {
        for (const use of transportUses(context)) {
          if (use.kind === "xhr") context.report({ node: use.node, messageId: "xhr" })
          else if (use.kind === "websocket") context.report({ node: use.node, messageId: "websocket" })
          else if (layer) continue
          else if (use.kind === "fetch") context.report({ node: use.node, messageId: "outside" })
          else context.report({ node: use.node, messageId: "channel", data: { name: use.name } })
        }
      },
      ImportDeclaration(node) {
        if (node.importKind !== "type") library(node, node.source.value)
      },
      ExportNamedDeclaration(node) {
        if (node.source && node.exportKind !== "type") library(node, node.source.value)
      },
      ExportAllDeclaration(node) {
        if (node.exportKind !== "type") library(node, node.source.value)
      },
      ImportExpression(node) {
        if (node.source.type === "Literal") library(node, node.source.value)
      },
      CallExpression(node) {
        // `require("axios")` where `require` is the CommonJS global.
        if (node.callee.type !== "Identifier" || node.callee.name !== "require" || node.arguments[0]?.type !== "Literal") return
        if (globalReferences(context, new Set(["require"])).includes(node.callee)) library(node, node.arguments[0].value)
      },
    }
  },
}

// -- FE-TRANSPORT-2 --------------------------------------------------------------------------------

/** Every `fetch` of the API layer (a custom fetch handed to the Apollo http link, a raw call) carries an abort signal, so a hung backend cannot hang a reader. */
export const clientFetchHasSignal = {
  meta: {
    type: "problem",
    docs: { description: "Every `fetch` in the API layer (`modules/api`) passes an AbortSignal (timeout or caller)." },
    schema: [],
    messages: {
      signal:
        "This `fetch` carries no `signal`. A request with no abort signal waits as long as the backend does, and the reader waits with it. Pass `signal` (an `AbortSignal.timeout(...)` combined with the caller's).",
    },
  },
  create(context) {
    if (!isApiLayer(context)) return {}
    return {
      "Program:exit"() {
        // The global `fetch` however it is reached; a request built as `new Request(url, init)` carries its signal in `init`.
        for (const { call } of transportUses(context)) {
          if (!call) continue
          const options = call.arguments[1]
          if (!options) {
            context.report({ node: call, messageId: "signal" })
            continue
          }
          // A spread or a computed value may carry it; only a literal object that plainly lacks it is wrong.
          if (options.type !== "ObjectExpression") continue
          const carries = options.properties.some(
            (property) =>
              property.type === "SpreadElement" ||
              (property.type === "Property" && property.key.type === "Identifier" && property.key.name === "signal"),
          )
          if (!carries) context.report({ node: call, messageId: "signal" })
        }
      },
    }
  },
}

/**
 * True for a file of the API layer, except the generated wire types (`graphql/__generated__/`: types generated from the be
 * contract snapshots are data, not code the wire law governs).
 */
const isTransportFile = (context) => isApiLayer(context) && !hfsOf(context).relative(context.filename || context.getFilename()).split("/").includes("__generated__")

// -- FE-TRANSPORT-3 --------------------------------------------------------------------------------

/** No module-level mutable state in the API layer: a token or locale in a `let` leaks across requests. */
export const noSharedTransportState = {
  meta: {
    type: "problem",
    docs: { description: "The API layer (`modules/api/**`) holds no module-level `let`/`var`." },
    schema: [],
    messages: {
      shared:
        "A module-level `{{kind}}` in the API layer. A token or locale kept there is shared by every request on the server and by every reader in one tab, so one reader's credential can answer another's request. Pass the credential as a parameter or read it from context.",
    },
  },
  create(context) {
    if (!isTransportFile(context)) return {}
    const check = (node) => {
      const declaration = node.type === "VariableDeclaration" ? node : node.declaration
      if (!declaration || declaration.type !== "VariableDeclaration" || declaration.kind === "const") return
      context.report({ node: declaration, messageId: "shared", data: { kind: declaration.kind } })
    }
    return {
      "Program > VariableDeclaration": check,
      "Program > ExportNamedDeclaration": check,
    }
  },
}

// -- FE-TRANSPORT-4 --------------------------------------------------------------------------------

/** Removes the wrappers that do not change what an expression is. */
const unwrap = (node) => {
  let current = node
  while (
    current &&
    (current.type === "TSAsExpression" || current.type === "TSNonNullExpression" || current.type === "TSSatisfiesExpression" || current.type === "ChainExpression")
  ) {
    current = current.expression
  }
  return current
}

/** The variable a name binds to, walking up from the scope of a node. */
const variableOf = (context, identifier) => {
  let scope = (context.sourceCode ?? context.getSourceCode()).getScope(identifier)
  while (scope) {
    const variable = scope.set.get(identifier.name)
    if (variable) return variable
    scope = scope.upper
  }
  return null
}

/** True when the type of an expression is a fetch `Response`: it has `ok`, `status` and `headers`. */
const isResponseLike = (context, node) => {
  const { checker, toTs } = typed(context)
  const tsNode = toTs(node)
  if (!tsNode) return false
  const type = checker.getTypeAtLocation(tsNode)
  const parts = type.isUnion?.() ? type.types : [type]
  return parts.some((part) => ["ok", "status", "headers"].every((name) => part.getProperty?.(name)))
}

/**
 * True when an expression is the HTTP status of a fetch response: `response.status` where the object's type is a Response, or a
 * local bound to one (`const status = response.status`, `const { status } = response`). A parameter that is only typed `number` is
 * not: the rule does not guess what a bare number means.
 */
/**
 * A parameter stands for the response status when its function is called in this file, and every call passes a response status in
 * that position: `const failureForResponse = (status: number) => ...` called as `failureForResponse(response.status)`.
 */
const functionBinding = (fn) => {
  if (fn.type === "FunctionDeclaration") return fn.id
  if (fn.parent?.type === "VariableDeclarator" && fn.parent.init === fn) return fn.parent.id
  return null
}

const isStatusParameter = (context, definition, depth) => {
  const fn = definition.node
  const index = fn.params?.findIndex((param) => param === definition.name || (param.type === "AssignmentPattern" && param.left === definition.name))
  if (index === undefined || index < 0) return false
  const binding = functionBinding(fn)
  if (!binding || binding.type !== "Identifier") return false
  const variable = variableOf(context, binding)
  const calls = (variable?.references ?? []).map((reference) => reference.identifier.parent).filter((parent) => parent?.type === "CallExpression" && parent.callee.type === "Identifier" && parent.callee.name === binding.name)
  return calls.length > 0 && calls.every((call) => call.arguments[index] !== undefined && isResponseStatus(context, call.arguments[index], depth + 1))
}

/** The static name or value of an object property key. */
const keyValue = (key) => {
  if (key?.type === "Identifier") return key.name
  if (key?.type === "Literal") return key.value
  return null
}

const isResponseStatus = (context, node, depth = 0) => {
  const expression = unwrap(node)
  if (!expression || depth > 4) return false
  if (expression.type === "MemberExpression") return propertyName(expression) === "status" && isResponseLike(context, unwrap(expression.object))
  if (expression.type !== "Identifier") return false
  const definition = variableOf(context, expression)?.defs[0]
  if (definition?.type === "Parameter") return isStatusParameter(context, definition, depth)
  if (definition?.type !== "Variable") return false
  const declarator = definition.node
  if (declarator.id === definition.name) return declarator.init ? isResponseStatus(context, declarator.init, depth + 1) : false
  if (declarator.id.type !== "ObjectPattern" || !declarator.init) return false
  const bound = declarator.id.properties.find(
    (property) => property.type === "Property" && (property.value === definition.name || (property.value.type === "AssignmentPattern" && property.value.left === definition.name)),
  )
  const keyName = keyValue(bound?.key)
  return keyName === "status" && isResponseLike(context, unwrap(declarator.init.type === "AwaitExpression" ? declarator.init.argument : declarator.init))
}

/** The numbers a literal list stands for (`[401, 403]`, `new Set([401, 403])`, or a const bound to one), else null. */
const numbersOf = (context, node, depth = 0) => {
  const expression = unwrap(node)
  if (!expression || depth > 3) return null
  if (expression.type === "ArrayExpression") {
    const values = expression.elements.map((element) => (element && element.type === "Literal" && typeof element.value === "number" ? element.value : null))
    return values.includes(null) ? null : new Set(values)
  }
  if (expression.type === "NewExpression" && expression.callee.type === "Identifier" && expression.callee.name === "Set" && expression.arguments.length === 1) {
    return numbersOf(context, expression.arguments[0], depth + 1)
  }
  if (expression.type === "Identifier") {
    const declarator = variableOf(context, expression)?.defs[0]?.node
    return declarator?.type === "VariableDeclarator" && declarator.init ? numbersOf(context, declarator.init, depth + 1) : null
  }
  return null
}

/**
 * The status codes a test is true for, when it is a plain status comparison: `status === 401`, `a || b` of such, or a literal list
 * containing the status (`[401, 403].includes(status)`, `new Set([401, 403]).has(status)`). Null for anything else.
 */
const comparedCodes = (context, expression) => {
  for (const [side, other] of [[expression.left, expression.right], [expression.right, expression.left]]) {
    const literal = unwrap(other)
    if (literal?.type === "Literal" && typeof literal.value === "number" && isResponseStatus(context, side)) return new Set([literal.value])
  }
  return null
}

const includedCodes = (context, expression) => {
  if (expression.callee.type !== "MemberExpression" || expression.arguments.length !== 1) return null
  const method = propertyName(expression.callee)
  if ((method === "includes" || method === "has") && isResponseStatus(context, expression.arguments[0])) return numbersOf(context, expression.callee.object)
  return null
}

const codesOf = (context, test) => {
  const expression = unwrap(test)
  if (!expression) return null
  if (expression.type === "LogicalExpression" && expression.operator === "||") {
    const left = codesOf(context, expression.left)
    const right = codesOf(context, expression.right)
    return left && right ? new Set([...left, ...right]) : null
  }
  if (expression.type === "BinaryExpression" && (expression.operator === "===" || expression.operator === "==")) {
    return comparedCodes(context, expression)
  }
  if (expression.type === "CallExpression") return includedCodes(context, expression)
  return null
}

/** A single node that spells the refused kind in an outcome property or constructor call. */
const namesRefused = (node) => {
  if (node.type === "Property" && !node.computed) {
    const value = unwrap(node.value)
    return keyValue(node.key) === "kind" && value?.type === "Literal" && value.value === "refused"
  }
  return node.type === "CallExpression" && node.arguments[0]?.type === "Literal" && node.arguments[0].value === "refused"
}

/** True when a subtree builds an outcome of kind `"refused"`: an object whose `kind` is that literal, or a call whose first argument is it. */
const buildsRefused = (node) => {
  let found = false
  const visit = (current) => {
    if (found || !current || typeof current.type !== "string") return
    // A constructor of the Outcome vocabulary named by its kind: `failed("refused", { ... })`.
    if (namesRefused(current)) found = true
    for (const [name, child] of Object.entries(current)) {
      if (name === "parent") continue
      if (Array.isArray(child)) child.forEach(visit)
      else if (typeof child?.type === "string") visit(child)
    }
  }
  visit(node)
  return found
}

/**
 * A raw `fetch` answered in the transport owner maps 401 and 403 to `refused`, so "sign in" is a state a reader can reach.
 *
 * The Apollo clients reach the network through the http link and map an unauthenticated answer in the error link; the rule
 * speaks only when a file of the clients folder (`fe.transport.client`, `fe.package.api.client`) calls `fetch` itself. It judges
 * a real branch in that file: a comparison of the fetch response's status (typed as a `Response`) with 401 and with
 * 403 (`===`, `||`, a literal list, a `switch` with both cases), whose consequent builds an object with `kind: "refused"`. The three
 * literals lying anywhere in the file do not pass. A mapping delegated to a function in another file is not visible here and does
 * not pass either: the client is the one file that owns the status meaning.
 */
export const clientMapsAuthToRefused = {
  meta: {
    type: "problem",
    docs: { description: "A file of the Apollo clients folder that calls `fetch` itself branches on the response status 401 and 403 and builds a `refused` outcome there." },
    schema: [],
    messages: {
      refused:
        "This client calls `fetch` but has no branch that turns a 401 and a 403 status of the response into an outcome of kind `refused`. Without that branch a signed-out reader is reported as \"could not load\" and never reaches the sign-in state. Compare `response.status` with 401 and 403 and return `{ ok: false, kind: \"refused\" }` there.",
    },
  },
  create(context) {
    if (!isApiClient(context)) return {}
    const covered = new Set()
    const cover = (test, consequent) => {
      const codes = codesOf(context, test)
      if (codes && buildsRefused(consequent)) codes.forEach((code) => covered.add(code))
    }
    return {
      IfStatement: (node) => cover(node.test, node.consequent),
      ConditionalExpression: (node) => cover(node.test, node.consequent),
      SwitchStatement(node) {
        if (!isResponseStatus(context, node.discriminant)) return
        let pending = new Set()
        for (const entry of node.cases) {
          const label = unwrap(entry.test)
          if (label?.type === "Literal" && typeof label.value === "number") pending.add(label.value)
          if (entry.consequent.length === 0) continue
          if (entry.consequent.some(buildsRefused)) pending.forEach((code) => covered.add(code))
          pending = new Set()
        }
      },
      "Program:exit"(program) {
        const fetches = transportUses(context).some((use) => use.kind === "fetch")
        if (fetches && !(covered.has(401) && covered.has(403))) context.report({ node: program, messageId: "refused" })
      },
    }
  },
}

// -- FE-STATUS-1 -----------------------------------------------------------------------------------

/** The object of `x.ok`, else null. */
const okSubject = (node) => {
  if (!node || node.type !== "MemberExpression" || node.computed || node.property.name !== "ok") return null
  return node.object
}

/** True when a value carries nothing: `null`, `undefined`, `void 0`, nothing, `[]`, `{}`, `false`. */
const isEmptyValue = (node) => {
  if (!node) return true
  if (node.type === "Literal") return node.value === null || node.value === false
  if (node.type === "Identifier") return node.name === "undefined"
  if (node.type === "UnaryExpression") return node.operator === "void"
  if (node.type === "ArrayExpression") return node.elements.length === 0
  if (node.type === "ObjectExpression") return node.properties.length === 0
  return false
}

/**
 * The response a "not ok" test is about, else null.
 *
 * `!res.ok`, `res.ok === false`, `res.ok !== true` and, since a status compare is the same collapse
 * spelled with a number, `res.status !== 200`, `res.status >= 400` or `res.status === 404`.
 */
const booleanFailureSubject = (side, other, operator) => {
  const subject = okSubject(side)
  if (!subject || other.type !== "Literal") return null
  if ((operator === "===" || operator === "==") && other.value === false) return subject
  if ((operator === "!==" || operator === "!=") && other.value === true) return subject
  return null
}

const statusFailureSubject = (side, other) => {
  const isStatus = side.type === "MemberExpression" && !side.computed && side.property.name === "status"
  return isStatus && other.type === "Literal" && typeof other.value === "number" ? side.object : null
}

const failureSubject = (test) => {
  if (test.type === "UnaryExpression" && test.operator === "!") return okSubject(test.argument)
  if (test.type !== "BinaryExpression") return null
  for (const [side, other] of [
    [test.left, test.right],
    [test.right, test.left],
  ]) {
    const subject = booleanFailureSubject(side, other, test.operator)
    if (subject) return subject
    if (side === test.left) {
      const status = statusFailureSubject(side, other)
      if (status) return status
    }
  }
  return null
}

/** Statements of a branch body. */
const bodyStatements = (node) => (node.type === "BlockStatement" ? node.body : [node])

/** True when a subtree mentions a status, an Outcome reason or kind, or the tested value itself, so it can tell the failures apart. */
const inspectsResponse = (text, subjectName) =>
  /\bstatus\b|\.(?:reason|kind)\b/.test(text) || (subjectName !== null && new RegExp(String.raw`\b${subjectName}\b`).test(text))

/** A failure (a non-ok HTTP response or a failed `Outcome`) is not one branch, and never `null`: its reason survives to the screen. */
export const noFailureCollapse = {
  meta: {
    type: "problem",
    docs: { description: "A failure, a non-ok HTTP response or a failed `Outcome`, is not folded into one branch or into an empty value; its reason is read and kept." },
    schema: [],
    messages: {
      empty:
        "A failure becomes an empty value here (`null`, `undefined`, an empty list or object). An empty value says nothing about WHY: a refused, not-found, invalid and unavailable result all look the same, so the screen can show only one message. Keep the reason: pass the `Outcome` (or its reason code) on and let the screen choose the translated message. A raw HTTP response is first mapped to an `Outcome` by status: 401/403 `refused`, 404 `not-found`, 422 `invalid`, the rest `unavailable`.",
      collapse:
        "Every failure takes this one branch and its reason is never read. For an `Outcome`, branch on its reason code (`refused`, `not-found`, `invalid`, `unavailable`); for an HTTP response, map `status` to that reason first (401/403 `refused`, 404 `not-found`, 422 `invalid`, the rest `unavailable`).",
      raw: "The server's own text is used as the reason. That text is written for a developer, may leak internals, and is in the wrong language. Keep the reason code (from the `Outcome`, or mapped from the HTTP status) and let the screen translate it.",
    },
  },
  create(context) {
    const source = context.sourceCode || context.getSourceCode()
    return {
      IfStatement(node) {
        const subject = failureSubject(node.test)
        if (!subject) return
        const subjectName = subject.type === "Identifier" ? subject.name : null
        const statements = bodyStatements(node.consequent)
        const returns = statements.filter((statement) => statement.type === "ReturnStatement")
        if (returns.some((statement) => isEmptyValue(statement.argument))) {
          context.report({ node, messageId: "empty" })
          return
        }
        // A branch on one named code (`status === 404`) is already inspecting the response.
        const test = node.test
        const general =
          test.type !== "BinaryExpression" || !/\.status\b/.test(source.getText(test)) || !/^={2,3}$/.test(test.operator)
        const jumps = statements.filter((s) => s.type === "ReturnStatement" || s.type === "ThrowStatement")
        if (general && jumps.length > 0 && !jumps.some((s) => inspectsResponse(source.getText(s), subjectName))) {
          context.report({ node, messageId: "collapse" })
        }
      },
      ConditionalExpression(node) {
        if (okSubject(node.test) && isEmptyValue(node.alternate)) return context.report({ node, messageId: "empty" })
        if (failureSubject(node.test) && isEmptyValue(node.consequent)) context.report({ node, messageId: "empty" })
      },
      Property(node) {
        if (node.computed || node.key.type !== "Identifier" || !["reason", "message"].includes(node.key.name)) return
        const text = source.getText(node.value)
        const rawText =
          /\.statusText\b/.test(text) || (node.value.type === "AwaitExpression" && /\.(?:text|json)\(\)/.test(text))
        if (rawText) context.report({ node: node.value, messageId: "raw" })
      },
    }
  },
}

// -- FE-WIRE-1 -------------------------------------------------------------------------------------

/** `x.json()`, possibly awaited. */
const isJsonRead = (node) => {
  let current = node
  while (current && (current.type === "AwaitExpression" || current.type === "TSNonNullExpression")) {
    current = current.argument || current.expression
  }
  return Boolean(
    current &&
      current.type === "CallExpression" &&
      current.callee.type === "MemberExpression" &&
      !current.callee.computed &&
      current.callee.property.name === "json",
  )
}

/** A GraphQL operation written as text. */
const GRAPHQL_TEXT = /^\s*(?:query|mutation|subscription|fragment)\b[^{]*\{/

/** The leftmost identifier of a type name: `Course` in `Course`, `Gql` in `Gql.CourseQuery`. */
const typeRoot = (name) => (name.type === "TSQualifiedName" ? typeRoot(name.left) : name)

/** The value an identifier is initialised with when it is a `const` of this file's scope chain, else null. */
const constInit = (scope, identifier) => {
  for (let current = scope; current; current = current.upper) {
    const variable = current.set.get(identifier.name)
    if (!variable) continue
    const definition = variable.defs[0]
    return definition?.type === "Variable" && definition.parent?.kind === "const" && definition.node.id.type === "Identifier" ? definition.node.init : null
  }
  return null
}

/**
 * Wire types are generated from the contract; nobody types the wire by hand, and a GraphQL document is written only in the API
 * layer (one file per operation, `modules/api/graphql/{queries,mutations}/`), where codegen reads it.
 */
export const noHandTypedWire = {
  meta: {
    type: "problem",
    docs: { description: "A transport response body is narrowed from `unknown` or typed by a generated wire type, never by a hand-written one." },
    schema: [],
    messages: {
      cast:
        "A response body is typed by hand here. An assertion or annotation is a claim nobody checks: when the backend changes the shape this still compiles and fails at a reader's screen. Narrow the body from `unknown` (`(await response.json()) as unknown`, then a check), or use the type generated from the be contract snapshot (`be/contracts/`, imported from `__generated__/`), and validate at the client.",
      document:
        "A GraphQL document written outside the API layer. Each operation has one file in `modules/api/graphql/queries/` or `modules/api/graphql/mutations/` (`query-<x>.ts`, `mutation-<x>.ts`), where codegen generates its types and the contract check reads it; a component or hook calls that operation through its SWR hook.",
    },
  },
  create(context) {
    const source = context.sourceCode ?? context.getSourceCode()
    const documents = !isApiLayer(context)
    /** Local names of the type imports that resolve into a `__generated__/` directory. */
    const generated = new Set()
    /** True when a type node is `unknown` or names a type imported from the generated wire module. */
    const sanctioned = (type) => {
      if (type.type === "TSUnknownKeyword") return true
      if (type.type !== "TSTypeReference") return false
      const root = typeRoot(type.typeName)
      return root.type === "Identifier" && (root.name === "const" || generated.has(root.name))
    }
    /** Whether the value is a `.json()` read, directly or through a const initialised with one. */
    const readsResponse = (node) => {
      if (isJsonRead(node)) return true
      let current = node
      while (current && (current.type === "AwaitExpression" || current.type === "TSNonNullExpression")) current = current.argument || current.expression
      if (current?.type !== "Identifier") return false
      const init = constInit(source.getScope(node), current)
      return Boolean(init) && isJsonRead(init)
    }
    const castCheck = (node) => {
      if (readsResponse(node.expression) && !sanctioned(node.typeAnnotation)) context.report({ node, messageId: "cast" })
    }
    return {
      Program(program) {
        for (const statement of program.body) {
          if (statement.type !== "ImportDeclaration" || !String(statement.source.value).split("/").includes("__generated__")) continue
          for (const specifier of statement.specifiers) generated.add(specifier.local.name)
        }
      },
      TSAsExpression: castCheck,
      TSTypeAssertion: castCheck,
      VariableDeclarator(node) {
        const annotation = node.id.type === "Identifier" ? node.id.typeAnnotation?.typeAnnotation : null
        if (annotation && node.init && readsResponse(node.init) && !sanctioned(annotation)) context.report({ node, messageId: "cast" })
      },
      TaggedTemplateExpression(node) {
        if (documents && node.tag.type === "Identifier" && /^(?:gql|graphql)$/.test(node.tag.name)) {
          context.report({ node, messageId: "document" })
        }
      },
      TemplateLiteral(node) {
        if (!documents || (node.parent && node.parent.type === "TaggedTemplateExpression")) return
        const text = node.quasis[0] && node.quasis[0].value.cooked
        if (typeof text === "string" && GRAPHQL_TEXT.test(text)) context.report({ node, messageId: "document" })
      },
      Literal(node) {
        if (documents && typeof node.value === "string" && GRAPHQL_TEXT.test(node.value) && node.value.includes("}")) {
          context.report({ node, messageId: "document" })
        }
      },
    }
  },
}

// -- TRANSPORT-7 -----------------------------------------------------------------------------------

/** The kinds of `Outcome<T>` (HFS section 6.2): a reader is owed a screen for each. */
const OUTCOME_KINDS = ["ok", "refused", "invalid", "not-found", "unavailable"]

/** A switch over an Outcome names every kind, so a failure never falls into the success branch or a blank one. */
export const outcomeKindsExhaustive = {
  meta: {
    type: "problem",
    docs: { description: "A `switch` over an Outcome's `kind` has a case for every kind." },
    schema: [],
    messages: {
      missing:
        "This `switch` handles `ok` but not {{missing}}. Each kind is a screen a reader can land on: refused sends them to sign in, invalid shows what to fix, not-found says it is gone, unavailable says try again. A missing case is a blank page, or a `default` that shows the wrong one. Write every case; do not rely on `default`.",
    },
  },
  create(context) {
    return {
      SwitchStatement(node) {
        const subject = node.discriminant
        if (subject.type !== "MemberExpression" || subject.computed || subject.property.type !== "Identifier" || subject.property.name !== "kind") return
        const cases = new Set(node.cases.filter((entry) => entry.test && entry.test.type === "Literal").map((entry) => entry.test.value))
        if (!cases.has("ok")) return
        const missing = OUTCOME_KINDS.filter((kind) => !cases.has(kind))
        if (missing.length > 0) context.report({ node, messageId: "missing", data: { missing: missing.map((kind) => `\`${kind}\``).join(", ") } })
      },
    }
  },
}

// -- FE-OUTCOME-1 ---------------------------------------------------------------------------------

/** The `kind` values of an Outcome failure (HFS section 6.2, plus the session-accepted-but-denied `forbidden`): a `kind` union that carries one is a result union. */
const RESULT_KINDS = new Set([...OUTCOME_KINDS, "forbidden"])

const LITERAL_FLAGS = ts.TypeFlags.StringLiteral | ts.TypeFlags.BooleanLiteral

/** The literal values of a property of an object type, or null when the property is missing or not literal-typed. */
const literalsOf = (checker, type, name, location) => {
  const property = type.getProperty?.(name)
  if (!property) return null
  const propertyType = checker.getTypeOfSymbolAtLocation(property, location)
  const parts = propertyType.isUnion?.() ? propertyType.types : [propertyType]
  if (!parts.every((part) => (part.flags & LITERAL_FLAGS) !== 0)) return null
  return parts.map((part) => (part.flags & ts.TypeFlags.BooleanLiteral ? part.intrinsicName === "true" : part.value))
}

/**
 * A result vocabulary is declared once per repository: `GraphQLResponse` in the file of the slot the manifest marks `outcomeHome`
 * (`fe.transport.outcome`: `modules/api/graphql/types.ts`, or `fe.package.api.outcome`: the api package's `src/graphql/types.ts`).
 *
 * A union type alias is a result union when its members are object types that ALL carry the same literal-typed discriminant, in the
 * result vocabulary: `success` or `ok` (both `true` and `false` among the members) or `kind` (a member of kind `"ok"` beside at least one failure
 * kind of the Outcome vocabulary: refused, forbidden, invalid, not-found, unavailable). A view union that a mapper derives from an
 * Outcome (`{ kind: "ready" } | { kind: "not-found" }`, no `ok` arm) is a screen state, not a second result vocabulary. The check reads the resolved members through the checker, so
 * `Ok<T> | Failure` and an intersection are seen as what they are, and no name (`*Outcome`, `*Result`) decides anything.
 * A UI state union (`{ status: "idle" } | { status: "saving" }`, `{ type: ... }`, a `kind` of menu items) is not result
 * vocabulary and passes. An alias that only composes the one union (`type Read = Outcome<Course>`, `Extract<Outcome<T>, ...>`) is not
 * a union type node and passes; `Outcome<T> | { ok: false; kind: "conflict" }` adds an arm to the one union and is refused.
 */
export const oneOutcomeUnion = {
  meta: {
    type: "problem",
    docs: { description: "A result union (`success` / `ok` / `kind` discriminant) is declared only in the outcome slot (`modules/api/graphql/types.ts`); elsewhere the code composes `GraphQLResponse<T>`." },
    schema: [],
    messages: {
      second:
        "`{{name}}` is a second result union ({{discriminant}}). The repository has one result vocabulary, `GraphQLResponse<T>`, declared in its one outcome home (`modules/api/graphql/types.ts`, or the api package's `src/graphql/types.ts`); a bespoke union here is a result shape the Apollo clients, the toast (`showGraphQLToast`) and the SWR hooks know nothing about. Compose `GraphQLResponse<T>` (the domain detail goes in its `data`) instead of declaring another.",
    },
  },
  create(context) {
    if (isOutcomeModule(context)) return {}
    const { checker, toTs } = typed(context)
    return {
      TSTypeAliasDeclaration(node) {
        let annotation = node.typeAnnotation
        while (annotation.type === "TSParenthesizedType") annotation = annotation.typeAnnotation
        if (annotation.type !== "TSUnionType") return
        const tsNode = toTs(node)
        if (!tsNode) return
        const type = checker.getTypeAtLocation(tsNode.name)
        if (!type.isUnion?.() || type.types.length < 2) return
        // The members must all be object types (an object, or an intersection of them).
        if (!type.types.every((member) => (member.flags & (ts.TypeFlags.Object | ts.TypeFlags.Intersection)) !== 0)) return
        for (const discriminant of ["success", "ok", "kind"]) {
          const values = type.types.map((member) => literalsOf(checker, member, discriminant, tsNode))
          if (values.some((entry) => entry === null)) continue
          const flat = values.flat()
          // `success` / `ok` is a discriminant only when each member pins it to one value; `{ ok: boolean }` on every member is a flag, not a tag.
          const isResult =
            discriminant !== "kind"
              ? values.every((entry) => entry.length === 1) && flat.includes(true) && flat.includes(false)
              : flat.includes("ok") && flat.some((value) => value !== "ok" && RESULT_KINDS.has(value))
          if (isResult) {
            context.report({ node: node.id, messageId: "second", data: { name: node.id.name, discriminant: `\`${discriminant}\` discriminant` } })
            return
          }
        }
      },
    }
  },
}

/** The rules this law contributes to the plugin. */
export const rules = {
  "fetch-only-in-api-client": fetchOnlyInApiClient,
  "client-fetch-has-signal": clientFetchHasSignal,
  "no-shared-transport-state": noSharedTransportState,
  "client-maps-auth-to-refused": clientMapsAuthToRefused,
  "no-failure-collapse": noFailureCollapse,
  "no-hand-typed-wire": noHandTypedWire,
  "outcome-kinds-exhaustive": outcomeKindsExhaustive,
  "one-outcome-union": oneOutcomeUnion,
  // Forward the callback enforcer for the catalog's source-only CONTRIBUTIONS discovery.
  ...callbackShapeRules,
}

/** Every rule is an error: a second transport or a status collapse is the defect, not a style. */
export const recommended = Object.fromEntries(Object.keys(rules).map((name) => [`starci-fe/${name}`, "error"]))
