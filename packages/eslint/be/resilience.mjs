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
import { keyName, walk } from "./lib/ast.mjs"
import { isDeclarationFile, isTestLane, normalizePath } from "./lib/path.mjs"

const HTTP_METHODS = new Set(["get", "post", "put", "patch", "delete", "head", "request"])

/** The receivers whose method calls are outbound HTTP, by the last name of the receiver. */
const HTTP_RECEIVER = /^(?:axios|http|httpService|httpClient|axiosInstance)$/

const lastName = (node) => {
  if (node.type === "Identifier") return node.name
  if (node.type === "MemberExpression" && !node.computed && node.property.type === "Identifier") return node.property.name
  return null
}

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
    if (isTestLane(filename) || isDeclarationFile(filename)) return {}
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
        const receiver = lastName(callee.object)
        if (receiver === "axios" && method === "create") {
          const config = node.arguments[0]
          if (!config || (config.type === "ObjectExpression" && !hasSpread(config) && !hasKey(config, ["timeout", "signal"]))) {
            context.report({ node, messageId: "createNoTimeout" })
          }
          return
        }
        if (!HTTP_METHODS.has(method) || !receiver || !HTTP_RECEIVER.test(receiver)) return
        // Node's own `http.get(url, callback)` is not this rule's business: a bare `http` receiver is not an injected client
        if (receiver === "http" && callee.object.type !== "MemberExpression") return
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
    if (isTestLane(filename) || isDeclarationFile(filename)) return {}
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

const PLATFORM_RETRY = /\/src\/modules\/platform\/retry\//
const DELAY_NAMES = /^(?:sleep|delay|wait|backoff)$/i
const LOOP_TYPES = new Set(["ForStatement", "WhileStatement", "DoWhileStatement"])

/** Whether `node` is a call shaped like a delay: `sleep(ms)`, `x.delay(ms)`, or `setTimeout(...)`. */
const isDelayCall = (node) => {
  if (node.type !== "CallExpression") return false
  const { callee } = node
  if (callee.type === "Identifier") return DELAY_NAMES.test(callee.name) || callee.name === "setTimeout"
  return callee.type === "MemberExpression" && !callee.computed && callee.property.type === "Identifier" && DELAY_NAMES.test(callee.property.name)
}

/** A loop that both catches an error and waits is retrying by hand. */
export const noHandRolledRetry = {
  meta: {
    type: "problem",
    docs: { description: "A loop that catches an error and waits before trying again goes through `platform/retry`, not a hand-written loop." },
    schema: [],
    messages: {
      handRolled:
        "This loop catches an error and waits before trying again - a hand-rolled retry with no attempt bound visible here, no jitter and no way to honor an abort signal. Retry through the shared `platform/retry` helper (bounded attempts, exponential backoff with jitter, an abort signal) instead of a loop written at the call site.",
    },
  },
  create(context) {
    const filename = normalizePath(context.filename || context.getFilename())
    if (isTestLane(filename) || isDeclarationFile(filename) || PLATFORM_RETRY.test(filename)) return {}
    const check = (node) => {
      let hasCatch = false
      let hasDelay = false
      walk(node.body, (child) => {
        if (child.type === "CatchClause") hasCatch = true
        else if (isDelayCall(child)) hasDelay = true
      }, { intoFunctions: false })
      if (hasCatch && hasDelay) context.report({ node, messageId: "handRolled" })
    }
    return Object.fromEntries([...LOOP_TYPES].map((type) => [type, check]))
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
