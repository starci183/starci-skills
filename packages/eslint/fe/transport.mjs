/**
 * The rules that hold `transport.md` (HFS R50 `FE_TRANSPORT_OWNER`, R51 `FE_HTTP_STATUS_COLLAPSE`,
 * R52 `FE_WIRE_GENERATED`).
 *
 * ONE WIRE, ONE VOCABULARY. A repository talks to its backend through exactly one module, the api client (HFS slot
 * `fe.transport.client`: `modules/api/client.ts`, or `fe.package.api.client`: the shared api package's `src/client.ts`),
 * and that module answers in exactly one vocabulary, `Outcome<T>` (slot `fe.transport.outcome` / `fe.package.api.outcome`). The
 * defects the three halves prevent were measured on real apps: seven transports and six result
 * shapes in one repository, and in another a client that folded every non-2xx into "could not
 * read", so the state a real backend produces for a signed-out reader - 401, which must become
 * `refused` and send the reader to sign in - was unreachable, while the e2e double hid it by
 * answering 200.
 *
 * WHAT THESE RULES CANNOT SEE. They read one file at a time, so they cannot tell that a client's
 * timeout is long enough or that a `refused` outcome is routed to the sign-in page - the module's
 * spec proves that. They hold the shapes that make it provable: one `fetch`, an abort signal on
 * it, no shared mutable state, a 401/403 branch, and no null standing in for a status.
 */

import ts from "typescript"
import { hfsOf } from "./lib/hfs.mjs"
import { globalReferences, isApiClient, isOutcomeModule, isSpecFile, slotOfFile } from "./lib/scope.mjs"
import { typed } from "./lib/types.mjs"

/** Packages that send an HTTP request: a second transport is a second owner. Matched on the module specifier, never on a file name. */
const TRANSPORT_PACKAGES = new Set([
  "axios", "ky", "ky-universal", "got", "node-fetch", "undici", "cross-fetch", "isomorphic-fetch", "superagent", "ofetch",
  "whatwg-fetch", "graphql-request", "urql", "next-urql", "apollo-client",
])

/** Package scopes and prefixes whose every package is a GraphQL/HTTP client of its own (`@apollo/client`, `@urql/core`, `apollo-link-http`). */
const TRANSPORT_SCOPES = ["@apollo/", "@urql/", "apollo-"]

/** True when a module specifier resolves to an HTTP client library. */
const isTransportLibrary = (specifier) => {
  const parts = String(specifier).split("/")
  const name = specifier.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0]
  return TRANSPORT_PACKAGES.has(name) || TRANSPORT_SCOPES.some((prefix) => name.startsWith(prefix))
}

/** The global objects that carry the same globals as the bare names. */
const GLOBAL_OBJECTS = new Set(["globalThis", "window", "self", "global"])

/** The bare globals that open a connection. */
const TRANSPORT_GLOBALS = new Set(["fetch", "Request", "EventSource", "XMLHttpRequest", "navigator"])

/** The static name of a member's property, else null. */
const propertyName = (member) => {
  if (!member.computed) return member.property.type === "Identifier" ? member.property.name : null
  return member.property.type === "Literal" && typeof member.property.value === "string" ? member.property.value : null
}

/**
 * Every use of a global transport in the file, found by scope resolution (an imported, declared or parameter `fetch` is not
 * one): `fetch` however it is reached (`fetch(...)`, `globalThis.fetch`, `window.fetch`, `const f = fetch`,
 * `const { fetch } = globalThis`), `new Request`, `new EventSource`, `navigator.sendBeacon`, `new XMLHttpRequest`.
 *
 * @param {object} context - The ESLint rule context.
 * @returns {Array<{ node: object, kind: "fetch" | "channel" | "xhr", name: string, call: object | null }>} The uses; `call` is the call of `fetch` when it is called there.
 */
const transportUses = (context) => {
  const uses = []
  const calledBy = (node) => (node.parent?.type === "CallExpression" && node.parent.callee === node ? node.parent : null)
  const constructedBy = (node) => node.parent?.type === "NewExpression" && node.parent.callee === node
  const classify = (node, name) => {
    if (name === "fetch") uses.push({ node, kind: "fetch", name, call: calledBy(node) })
    else if ((name === "Request" || name === "EventSource") && constructedBy(node)) uses.push({ node, kind: "channel", name, call: null })
    else if (name === "XMLHttpRequest" && constructedBy(node)) uses.push({ node, kind: "xhr", name, call: null })
    else if (name === "navigator" && node.parent?.type === "MemberExpression" && node.parent.object === node && propertyName(node.parent) === "sendBeacon") {
      uses.push({ node: node.parent, kind: "channel", name: "navigator.sendBeacon", call: calledBy(node.parent) })
    }
  }
  for (const id of globalReferences(context, new Set([...TRANSPORT_GLOBALS, ...GLOBAL_OBJECTS]))) {
    // `typeof fetch` names the type of the function; it does not call it.
    if (id.parent?.type === "TSTypeQuery") continue
    if (!GLOBAL_OBJECTS.has(id.name)) {
      classify(id, id.name)
      continue
    }
    const parent = id.parent
    if (parent?.type === "MemberExpression" && parent.object === id) {
      const name = propertyName(parent)
      if (name !== null && TRANSPORT_GLOBALS.has(name)) classify(parent, name)
    } else if (parent?.type === "VariableDeclarator" && parent.init === id && parent.id.type === "ObjectPattern") {
      for (const property of parent.id.properties) {
        if (property.type === "Property" && !property.computed && property.key.type === "Identifier" && property.key.name === "fetch") {
          uses.push({ node: property, kind: "fetch", name: "fetch", call: null })
        }
      }
    }
  }
  return uses
}

// -- FE-TRANSPORT-1 --------------------------------------------------------------------------------

/**
 * `fetch` is reached in one file per repository, and no other HTTP library exists.
 *
 * The one file is the one whose HFS slot is `fe.transport.client` (`apps/<app>/src/modules/api/client.ts`, a one-app repository)
 * or `fe.package.api.client` (`packages/<family>-api/src/client.ts`, the shared client of a multi-app repository). Every other
 * file, including another file of the same package, is a finding.
 */
export const fetchOnlyInApiClient = {
  meta: {
    type: "problem",
    docs: { description: "The repository's single `fetch` (and `Request`, `EventSource`, `sendBeacon`) lives in the api client slot." },
    schema: [],
    messages: {
      outside:
        "`fetch` outside the api client (`modules/api/client.ts`, or the shared api package's `src/client.ts`). The repository has exactly one transport; a second one is a second place that must remember the timeout, the credential and the status mapping, and it will forget one. Call the client and take its `Outcome`.",
      channel:
        "`{{name}}` opens a connection outside the api client. `Request`, `EventSource` and `navigator.sendBeacon` are transports of their own; the repository's one client owns every request. Call the client and take its `Outcome`.",
      library:
        "`{{name}}` is a second HTTP transport. The repository's one client (`modules/api/client.ts` or the api package's `src/client.ts`) is built on `fetch`; another library is another set of timeout, retry and error rules. Use the client.",
      xhr: "`XMLHttpRequest` is a second transport. Use the repository's api client.",
    },
  },
  create(context) {
    const filename = context.filename || context.getFilename()
    if (isSpecFile(filename)) return {}
    const client = isApiClient(context)
    const library = (node, source) => {
      if (typeof source === "string" && isTransportLibrary(source)) context.report({ node, messageId: "library", data: { name: source } })
    }
    return {
      "Program:exit"() {
        for (const use of transportUses(context)) {
          if (use.kind === "xhr") context.report({ node: use.node, messageId: "xhr" })
          else if (client) continue
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

/** The client's `fetch` carries an abort signal, so a hung backend cannot hang a reader. */
export const clientFetchHasSignal = {
  meta: {
    type: "problem",
    docs: { description: "Every `fetch` in `modules/api/client.ts` passes an AbortSignal (timeout or caller)." },
    schema: [],
    messages: {
      signal:
        "This `fetch` carries no `signal`. A request with no abort signal waits as long as the backend does, and the reader waits with it. Pass `signal` (an `AbortSignal.timeout(...)` combined with the caller's).",
    },
  },
  create(context) {
    if (!isApiClient(context)) return {}
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

/** The slots that make up the API layer: the app's `modules/api` and the shared api package. */
const API_LAYER_SLOTS = ["fe.modules.api", "fe.transport.client", "fe.transport.outcome", "fe.package.api", "fe.package.api.client", "fe.package.api.outcome"]

/**
 * True for a file of the API layer, except the data folders its slot allows (`contract/`, `__generated__/`: the contract copy
 * and generated output are data, not code the wire law governs).
 */
const isTransportFile = (context) => {
  const slotId = slotOfFile(context)
  if (!API_LAYER_SLOTS.includes(slotId)) return false
  const hfs = hfsOf(context)
  const dataFolders = (hfs.slot(slotId).allows ?? []).filter((entry) => entry.endsWith("/")).map((entry) => entry.slice(0, -1))
  const { root } = hfs.classify(context.filename || context.getFilename())
  const below = hfs.relative(context.filename || context.getFilename()).slice(root.length + 1).split("/")
  return !dataFolders.includes(below[0])
}

// -- FE-TRANSPORT-3 --------------------------------------------------------------------------------

/** No module-level mutable state in the API layer: a token or locale in a `let` leaks across requests. */
export const noSharedTransportState = {
  meta: {
    type: "problem",
    docs: { description: "`modules/api/**` holds no module-level `let`/`var`." },
    schema: [],
    messages: {
      shared:
        "A module-level `{{kind}}` in the API layer. A token or locale kept there is shared by every request on the server and by every reader in one tab, so one reader's credential can answer another's request. Pass the credential as a parameter or read it from context.",
    },
  },
  create(context) {
    const filename = context.filename || context.getFilename()
    if (!isTransportFile(context) || isSpecFile(filename)) return {}
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
const isStatusParameter = (context, definition, depth) => {
  const fn = definition.node
  const index = fn.params?.findIndex((param) => param === definition.name || (param.type === "AssignmentPattern" && param.left === definition.name))
  if (index === undefined || index < 0) return false
  const binding = fn.type === "FunctionDeclaration" ? fn.id : fn.parent?.type === "VariableDeclarator" && fn.parent.init === fn ? fn.parent.id : null
  if (!binding || binding.type !== "Identifier") return false
  const variable = variableOf(context, binding)
  const calls = (variable?.references ?? []).map((reference) => reference.identifier.parent).filter((parent) => parent?.type === "CallExpression" && parent.callee.type === "Identifier" && parent.callee.name === binding.name)
  return calls.length > 0 && calls.every((call) => call.arguments[index] !== undefined && isResponseStatus(context, call.arguments[index], depth + 1))
}

const isResponseStatus = (context, node, depth = 0) => {
  const expression = unwrap(node)
  if (!expression || depth > 4) return false
  if (expression.type === "MemberExpression") return propertyName(expression) === "status" && isResponseLike(context, unwrap(expression.object))
  if (expression.type !== "Identifier") return false
  const definition = variableOf(context, expression)?.defs[0]
  if (definition?.type === "Parameter") return isStatusParameter(context, definition, depth)
  if (!definition || definition.type !== "Variable") return false
  const declarator = definition.node
  if (declarator.id === definition.name) return declarator.init ? isResponseStatus(context, declarator.init, depth + 1) : false
  if (declarator.id.type !== "ObjectPattern" || !declarator.init) return false
  const bound = declarator.id.properties.find(
    (property) => property.type === "Property" && (property.value === definition.name || (property.value.type === "AssignmentPattern" && property.value.left === definition.name)),
  )
  const key = bound?.key
  const keyName = key?.type === "Identifier" ? key.name : key?.type === "Literal" ? key.value : null
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
const codesOf = (context, test) => {
  const expression = unwrap(test)
  if (!expression) return null
  if (expression.type === "LogicalExpression" && expression.operator === "||") {
    const left = codesOf(context, expression.left)
    const right = codesOf(context, expression.right)
    return left && right ? new Set([...left, ...right]) : null
  }
  if (expression.type === "BinaryExpression" && (expression.operator === "===" || expression.operator === "==")) {
    for (const [side, other] of [[expression.left, expression.right], [expression.right, expression.left]]) {
      const literal = unwrap(other)
      if (literal?.type === "Literal" && typeof literal.value === "number" && isResponseStatus(context, side)) return new Set([literal.value])
    }
    return null
  }
  if (expression.type === "CallExpression" && expression.callee.type === "MemberExpression" && expression.arguments.length === 1) {
    const method = propertyName(expression.callee)
    if ((method === "includes" || method === "has") && isResponseStatus(context, expression.arguments[0])) return numbersOf(context, expression.callee.object)
  }
  return null
}

/** True when a subtree builds an outcome of kind `"refused"`: an object whose `kind` is that literal, or a call whose first argument is it. */
const buildsRefused = (node) => {
  let found = false
  const visit = (current) => {
    if (found || !current || typeof current.type !== "string") return
    if (current.type === "Property" && !current.computed) {
      const key = current.key
      const named = (key.type === "Identifier" && key.name === "kind") || (key.type === "Literal" && key.value === "kind")
      const value = unwrap(current.value)
      if (named && value?.type === "Literal" && value.value === "refused") found = true
    }
    // A constructor of the Outcome vocabulary named by its kind: `failed("refused", { ... })`.
    if (current.type === "CallExpression" && current.arguments[0]?.type === "Literal" && current.arguments[0].value === "refused") found = true
    for (const [name, child] of Object.entries(current)) {
      if (name === "parent") continue
      if (Array.isArray(child)) child.forEach(visit)
      else if (child && typeof child.type === "string") visit(child)
    }
  }
  visit(node)
  return found
}

/**
 * The client maps 401 and 403 to `refused`, so "sign in" is a state a reader can reach.
 *
 * It judges a real branch in the client file: a comparison of the fetch response's status (typed as a `Response`) with 401 and with
 * 403 (`===`, `||`, a literal list, a `switch` with both cases), whose consequent builds an object with `kind: "refused"`. The three
 * literals lying anywhere in the file do not pass. A mapping delegated to a function in another file is not visible here and does
 * not pass either: the client is the one file that owns the status meaning.
 */
export const clientMapsAuthToRefused = {
  meta: {
    type: "problem",
    docs: { description: "The api client branches on the response status 401 and 403 and builds a `refused` outcome there." },
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
const failureSubject = (test) => {
  if (test.type === "UnaryExpression" && test.operator === "!") return okSubject(test.argument)
  if (test.type !== "BinaryExpression") return null
  for (const [side, other] of [
    [test.left, test.right],
    [test.right, test.left],
  ]) {
    const subject = okSubject(side)
    if (subject && other.type === "Literal") {
      if ((test.operator === "===" || test.operator === "==") && other.value === false) return subject
      if ((test.operator === "!==" || test.operator === "!=") && other.value === true) return subject
    }
    const isStatus = side.type === "MemberExpression" && !side.computed && side.property.name === "status"
    if (isStatus && other.type === "Literal" && typeof other.value === "number") {
      if (side === test.left) return side.object
    }
  }
  return null
}

/** Statements of a branch body. */
const bodyStatements = (node) => (node.type === "BlockStatement" ? node.body : [node])

/** True when a subtree mentions a status or the tested response itself, so it can tell the codes apart. */
const inspectsResponse = (text, subjectName) =>
  /\bstatus\b/.test(text) || (subjectName !== null && new RegExp(`\\b${subjectName}\\b`).test(text))

/** A failed response is not one branch, and never `null`. */
export const noHttpStatusCollapse = {
  meta: {
    type: "problem",
    docs: { description: "A non-ok response is not folded into one branch or into null; 401/403 become `refused`." },
    schema: [],
    messages: {
      empty:
        "A failed response becomes an empty value here. `null` says nothing about WHY: the reader who is signed out, the record that does not exist and the backend that is down all look identical, so the screen can show only one message. Return an `Outcome` (`refused`, `not-found`, `invalid`, `unavailable`) chosen by status; 401/403 must be `refused`.",
      collapse:
        "Every failed status takes this one branch and the response is never inspected. 401/403 must become `refused`, 404 `not-found`, 422 `invalid`, the rest `unavailable`. Branch on `response.status`.",
      raw: "The server's own text is used as the reason. That text is written for a developer, may leak internals, and is in the wrong language. Map the status to a reason code and let the screen translate it.",
    },
  },
  create(context) {
    if (isSpecFile(context.filename || context.getFilename())) return {}
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

/** Wire types are generated from the contract; nobody types the wire by hand. */
export const noHandTypedWire = {
  meta: {
    type: "problem",
    docs: { description: "A transport response body is narrowed from `unknown` or typed by a generated wire type, never by a hand-written one." },
    schema: [],
    messages: {
      cast:
        "A response body is typed by hand here. An assertion or annotation is a claim nobody checks: when the backend changes the shape this still compiles and fails at a reader's screen. Narrow the body from `unknown` (`(await response.json()) as unknown`, then a check), or use the type generated from `modules/api/contract` (imported from `__generated__/`), and validate at the client.",
      document:
        "A GraphQL document written inline in TypeScript. Documents live in `.graphql` files so codegen can generate their types and the contract check can read them.",
    },
  },
  create(context) {
    const filename = context.filename || context.getFilename()
    if (isSpecFile(filename)) return {}
    const source = context.sourceCode ?? context.getSourceCode()
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
        if (node.tag.type === "Identifier" && /^(?:gql|graphql)$/.test(node.tag.name)) {
          context.report({ node, messageId: "document" })
        }
      },
      TemplateLiteral(node) {
        if (node.parent && node.parent.type === "TaggedTemplateExpression") return
        const text = node.quasis[0] && node.quasis[0].value.cooked
        if (typeof text === "string" && GRAPHQL_TEXT.test(text)) context.report({ node, messageId: "document" })
      },
      Literal(node) {
        if (typeof node.value === "string" && GRAPHQL_TEXT.test(node.value) && node.value.includes("}")) {
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
    if (isSpecFile(context.filename || context.getFilename())) return {}
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
 * A result union is declared once per repository: `Outcome<T>` in the `fe.transport.outcome` / `fe.package.api.outcome` file.
 *
 * A union type alias is a result union when its members are object types that ALL carry the same literal-typed discriminant, in the
 * result vocabulary: `ok` (both `true` and `false` among the members) or `kind` (a member of kind `"ok"` beside at least one failure
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
    docs: { description: "A result union (`ok` / `kind` discriminant) is declared only in the outcome slot; elsewhere the code composes `Outcome<T>`." },
    schema: [],
    messages: {
      second:
        "`{{name}}` is a second result union ({{discriminant}}). The repository has one vocabulary, `Outcome<T>`, declared in `modules/api/outcome.ts` (or the api package's `src/outcome.ts`); a bespoke union here is a result shape the client, the status mapping and `outcome-kinds-exhaustive` know nothing about. Compose `Outcome<T>` (add the domain detail as its second parameter) instead of declaring another.",
    },
  },
  create(context) {
    if (isSpecFile(context.filename || context.getFilename()) || isOutcomeModule(context)) return {}
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
        for (const discriminant of ["ok", "kind"]) {
          const values = type.types.map((member) => literalsOf(checker, member, discriminant, tsNode))
          if (values.some((entry) => entry === null)) continue
          const flat = values.flat()
          // `ok` is a discriminant only when each member pins it to one value; `{ ok: boolean }` on every member is a flag, not a tag.
          const isResult =
            discriminant === "ok"
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
  "no-http-status-collapse": noHttpStatusCollapse,
  "no-hand-typed-wire": noHandTypedWire,
  "outcome-kinds-exhaustive": outcomeKindsExhaustive,
  "one-outcome-union": oneOutcomeUnion,
}

/** Every rule is an error: a second transport or a status collapse is the defect, not a style. */
export const recommended = Object.fromEntries(Object.keys(rules).map((name) => [`starci-fe/${name}`, "error"]))
