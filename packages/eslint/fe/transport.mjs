/**
 * The rules that hold `transport.md` (HFS R50 `FE_TRANSPORT_OWNER`, R51 `FE_HTTP_STATUS_COLLAPSE`,
 * R52 `FE_WIRE_GENERATED`).
 *
 * ONE WIRE, ONE VOCABULARY. An app talks to its backend through exactly one module,
 * `modules/api/client.ts`, and that module answers in exactly one vocabulary, `Outcome<T>`. The
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

import { isApiClient, isSpecFile } from "./lib/scope.mjs"
import { normalizePath } from "./lib/path.mjs"

/** Any other way to send an HTTP request: a second transport is a second owner. */
const OTHER_TRANSPORTS = /^(?:axios|ky|ky-universal|got|node-fetch|undici|cross-fetch|isomorphic-fetch|superagent|ofetch|whatwg-fetch)$/

/** `fetch`, `globalThis.fetch`, `window.fetch`, `self.fetch`. */
const isFetchCall = (node) => {
  const callee = node.callee
  if (callee.type === "Identifier") return callee.name === "fetch"
  return (
    callee.type === "MemberExpression" &&
    !callee.computed &&
    callee.property.name === "fetch" &&
    callee.object.type === "Identifier" &&
    ["globalThis", "window", "self", "global"].includes(callee.object.name)
  )
}

/** Files under `modules/api/` that the wire law governs (the contract copy and generated output are data). */
const isApiModuleFile = (filename) => {
  const file = normalizePath(filename)
  return /\/modules\/api\//.test(file) && !/\/(?:contract|__generated__)\//.test(file)
}

// -- FE-TRANSPORT-1 --------------------------------------------------------------------------------

/** `fetch` is called in one module, and no other HTTP library exists. */
export const fetchOnlyInApiClient = {
  meta: {
    type: "problem",
    docs: { description: "The app's single `fetch` lives in `modules/api/client.ts`." },
    schema: [],
    messages: {
      outside:
        "`fetch` outside `modules/api/client.ts`. The app has exactly one transport; a second one is a second place that must remember the timeout, the credential and the status mapping, and it will forget one. Call the client and take its `Outcome`.",
      library:
        "`{{name}}` is a second HTTP transport. The app's one client is `modules/api/client.ts`, built on `fetch`; another library there is another set of timeout, retry and error rules. Use the client.",
      xhr: "`XMLHttpRequest` is a second transport. Use `modules/api/client.ts`.",
    },
  },
  create(context) {
    const filename = context.filename || context.getFilename()
    if (isSpecFile(filename)) return {}
    const client = isApiClient(filename)
    return {
      CallExpression(node) {
        if (!client && isFetchCall(node)) context.report({ node, messageId: "outside" })
      },
      NewExpression(node) {
        if (node.callee.type === "Identifier" && node.callee.name === "XMLHttpRequest") {
          context.report({ node, messageId: "xhr" })
        }
      },
      ImportDeclaration(node) {
        const source = String(node.source.value)
        const name = source.split("/")[0]
        if (OTHER_TRANSPORTS.test(name)) context.report({ node, messageId: "library", data: { name: source } })
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
    if (!isApiClient(context.filename || context.getFilename())) return {}
    return {
      CallExpression(node) {
        if (!isFetchCall(node)) return
        const options = node.arguments[1]
        if (!options) return context.report({ node, messageId: "signal" })
        // A spread or a computed value may carry it; only a literal object that plainly lacks it is wrong.
        if (options.type !== "ObjectExpression") return
        const carries = options.properties.some(
          (property) =>
            property.type === "SpreadElement" ||
            (property.type === "Property" && property.key.type === "Identifier" && property.key.name === "signal"),
        )
        if (!carries) context.report({ node, messageId: "signal" })
      },
    }
  },
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
    if (!isApiModuleFile(filename) || isSpecFile(filename)) return {}
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

/** The client maps 401/403 to `refused`, so "sign in" is a state a reader can reach. */
export const clientMapsAuthToRefused = {
  meta: {
    type: "problem",
    docs: { description: "`modules/api/client.ts` handles 401 and 403 and produces `refused`." },
    schema: [],
    messages: {
      refused:
        "This client calls `fetch` but does not map 401 and 403 to a `refused` outcome. Without that branch a signed-out reader is reported as \"could not load\" and never reaches the sign-in state.",
    },
  },
  create(context) {
    if (!isApiClient(context.filename || context.getFilename())) return {}
    let fetches = false
    const seen = { refused: false, 401: false, 403: false }
    return {
      CallExpression(node) {
        if (isFetchCall(node)) fetches = true
      },
      Literal(node) {
        if (node.value === "refused") seen.refused = true
        if (node.value === 401) seen[401] = true
        if (node.value === 403) seen[403] = true
      },
      "Program:exit"(program) {
        if (fetches && !(seen.refused && seen[401] && seen[403])) {
          context.report({ node: program, messageId: "refused" })
        }
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

/** Wire types are generated from the contract; nobody types the wire by hand. */
export const noHandTypedWire = {
  meta: {
    type: "problem",
    docs: { description: "Wire types come from the contract copy via codegen; responses are not cast." },
    schema: [],
    messages: {
      cast:
        "A response body is cast to a type here. A cast is a claim nobody checks: when the backend changes the shape this still compiles and fails at a reader's screen. Use the type generated from `modules/api/contract`, and validate at the client.",
      graphqlType:
        "`{{name}}` is a hand-written GraphQL result type used as a cast. The generated document type already says exactly what this operation returns; use it.",
      document:
        "A GraphQL document written inline in TypeScript. Documents live in `.graphql` files so codegen can generate their types and the contract check can read them.",
      declared:
        "`{{name}}` declares a wire shape by hand in `modules/api`. Wire types are generated from the backend contract (`codegen`), so a hand-written copy is a second source of truth that drifts. Import the generated type.",
    },
  },
  create(context) {
    const filename = context.filename || context.getFilename()
    if (isSpecFile(filename)) return {}
    const inApi = isApiModuleFile(filename)
    const castCheck = (node) => {
      const type = node.typeAnnotation
      if (type && type.type === "TSTypeReference" && type.typeName.type === "Identifier") {
        if (/^Graph[Qq][Ll]\w*$/.test(type.typeName.name)) {
          context.report({ node, messageId: "graphqlType", data: { name: type.typeName.name } })
          return
        }
      }
      if (isJsonRead(node.expression)) context.report({ node, messageId: "cast" })
    }
    const declared = (node) => {
      if (!inApi || !/(?:Wire|Dto|DTO|Response|Payload)$/.test(node.id.name)) return
      context.report({ node: node.id, messageId: "declared", data: { name: node.id.name } })
    }
    return {
      TSAsExpression: castCheck,
      TSTypeAssertion: castCheck,
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
      TSInterfaceDeclaration: declared,
      TSTypeAliasDeclaration: declared,
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

/** The rules this law contributes to the plugin. */
export const rules = {
  "fetch-only-in-api-client": fetchOnlyInApiClient,
  "client-fetch-has-signal": clientFetchHasSignal,
  "no-shared-transport-state": noSharedTransportState,
  "client-maps-auth-to-refused": clientMapsAuthToRefused,
  "no-http-status-collapse": noHttpStatusCollapse,
  "no-hand-typed-wire": noHandTypedWire,
  "outcome-kinds-exhaustive": outcomeKindsExhaustive,
}

/** Every rule is an error: a second transport or a status collapse is the defect, not a style. */
export const recommended = Object.fromEntries(Object.keys(rules).map((name) => [`starci-fe/${name}`, "error"]))
