/**
 * The rules that hold `testing.md`.
 *
 * MOST OF THAT LAW IS NOT MACHINE-CHECKABLE, and pretending otherwise would be worse than
 * checking nothing. No rule can tell whether a file represents a business flow, whether the
 * unhappy path it covers drags a critical flow behind it, or whether the decision branches are
 * covered - those are read by a person.
 *
 * What a rule CAN see is the two shapes that are wrong on their face regardless of intent: a spec
 * whose every assertion is about a call rather than a result, and an end-to-end spec that never
 * reads any state back. Both were measured before being written: eight specs and one e2e file in
 * the source repository, which is why the second lands with a carve-out rather than at zero.
 */

/** Forward-slash form of a filename, so Windows paths compare like every other path. */
const normalizePath = (filename) => String(filename || "").replace(/\\/g, "/")

/** The fast lane: a plain unit spec, excluding every other suffix that also ends in `spec.ts`. */
const isUnitSpec = (filename) => {
  const file = normalizePath(filename)
  if (!/\.spec\.ts$/.test(file)) return false
  return !/\.(?:e2e|int|harness)-spec\.ts$/.test(file)
}

/** The flow lane. */
const isE2eSpec = (filename) => /\.e2e-spec\.ts$/.test(normalizePath(filename))

/** The paid model-quality lane. */
const isHarnessSpec = (filename) => /\.harness-spec\.ts$/.test(normalizePath(filename))

/** Test-only helpers whose only authority is the harness lane. */
const isHarnessHelper = (filename) => /\/src\/tests\/helpers\//.test(normalizePath(filename))

/**
 * Matchers that assert a CALL happened rather than what came out of it.
 *
 * Each is legitimate as a second assertion - "the mail went out" is a real observable effect. The
 * rule fires only when a whole file has nothing else.
 */
const CALL_MATCHERS = new Set([
  "toHaveBeenCalled",
  "toHaveBeenCalledWith",
  "toHaveBeenCalledTimes",
  "toHaveBeenLastCalledWith",
  "toHaveBeenNthCalledWith",
  "toBeCalled",
  "toBeCalledWith",
  "toBeCalledTimes",
  "toHaveReturned",
])

/** Names that mean the test read state back out of the database. */
const STATE_READERS = /^(?:entityManager|dataSource|EntityManager|DataSource|getRepository|queryRunner)$/

/**
 * The matcher a given `expect(...)` call ends in.
 *
 * Climbs the member chain so modifiers pass through: `expect(x).not.toHaveBeenCalled()` answers
 * `toHaveBeenCalled`, and `expect(p).resolves.toBe(1)` answers `toBe`.
 */
const matcherOf = (expectCall) => {
  let cursor = expectCall
  let last = null
  while (cursor.parent && cursor.parent.type === "MemberExpression" && cursor.parent.object === cursor) {
    last = cursor.parent.property && cursor.parent.property.name
    cursor = cursor.parent
  }
  return last
}

// -- TESTING-6 -------------------------------------------------------------------------------------

/** A spec whose every assertion is about a call restates the source instead of testing it. */
export const noCallOnlySpec = {
  meta: {
    type: "problem",
    docs: { description: "A unit spec asserts a result or a state change, not only that a call happened." },
    schema: [],
    messages: {
      callOnly:
        "Every assertion in this spec is `{{matchers}}` - it restates the handler's own source. Rename a collaborator's method and this file goes red; change the business rule to a wrong value and it stays green. Assert what came back, or what changed. A call assertion is legitimate as a SECOND assertion, where the call itself is the observable effect.",
    },
  },
  create(context) {
    if (!isUnitSpec(context.filename || context.getFilename())) return {}
    let assertions = 0
    let callAssertions = 0
    const seen = new Set()
    return {
      CallExpression(node) {
        if (!node.callee || node.callee.type !== "Identifier" || node.callee.name !== "expect") return
        const matcher = matcherOf(node)
        if (matcher === null) return
        assertions += 1
        if (!CALL_MATCHERS.has(matcher)) return
        callAssertions += 1
        seen.add(matcher)
      },
      "Program:exit"(node) {
        // the file asserts nothing at all, or asserts something other than a call somewhere
        if (assertions === 0 || callAssertions !== assertions) return
        context.report({ node, messageId: "callOnly", data: { matchers: [...seen].join(", ") } })
      },
    }
  },
}

// -- TESTING-2 -------------------------------------------------------------------------------------

/** An end-to-end spec that never reads state back proves only that the server replied. */
export const e2eAssertsPersistedState = {
  meta: {
    type: "problem",
    docs: { description: "An e2e spec reads state back rather than asserting only on the response." },
    schema: [],
    messages: {
      noState:
        "This e2e never reads any state back - it asserts on responses alone, so the flow can stop persisting and this file stays green. Read the row, the balance or the entitlement out of the database and assert THAT. A flow that genuinely has no persisted consequence needs an eslint-disable naming what it observes instead.",
    },
  },
  create(context) {
    if (!isE2eSpec(context.filename || context.getFilename())) return {}
    let readsState = false
    return {
      Identifier(node) {
        if (STATE_READERS.test(node.name)) readsState = true
      },
      "Program:exit"(node) {
        if (readsState) return
        context.report({ node, messageId: "noState" })
      },
    }
  },
}

// -- TESTING-9 -------------------------------------------------------------------------------------

/** Provider SDKs. Importing one into a flow test is a real model call by any other name. */
const PROVIDER_PACKAGES = /^(?:@anthropic-ai\/|openai$|openai\/|ollama$|@google\/generative-ai|@mistralai\/|cohere-ai)/

/**
 * The harness's own model helpers, which exist to reach a provider.
 *
 * Matched WITHOUT the `tests/` prefix: an e2e sits beside the helper folder, so the import it
 * actually writes is the relative `../helpers/models.service`, and a pattern anchored on the
 * absolute path never sees it.
 */
const HARNESS_MODEL_HELPERS = /helpers\/models(?:\.service)?$/

/** An e2e never calls a model; the harness is the only lane that does. */
export const noModelCallInE2e = {
  meta: {
    type: "problem",
    docs: { description: "An e2e spec never reaches a model provider." },
    schema: [],
    messages: {
      provider:
        "`{{source}}` reaches a model provider from an e2e. A model call costs money, takes seconds and answers differently every time - so this makes the flow suite expensive, slow and flaky at once, and the assertion has to be loosened until it stops catching anything. Stub the model and assert what can actually break: the entitlement, the quota, the persisted answer. Judging the answer itself belongs in the harness.",
    },
  },
  create(context) {
    if (!isE2eSpec(context.filename || context.getFilename())) return {}
    return {
      ImportDeclaration(node) {
        const source = node.source && node.source.value
        if (typeof source !== "string") return
        if (!PROVIDER_PACKAGES.test(source) && !HARNESS_MODEL_HELPERS.test(source)) return
        context.report({ node, messageId: "provider", data: { source } })
      },
    }
  },
}

// -- TESTING-3 -------------------------------------------------------------------------------------

/** CQRS application buses are internal dispatchers, never production entry points. */
const APPLICATION_BUSES = new Set(["CommandBus", "QueryBus", "EventBus"])

/** Methods whose direct invocation skips the transport owned by production. */
const INTERNAL_ENTRY_METHODS = new Set(["execute", "process"])

/** An e2e enters through a production transport rather than an application object. */
export const e2eUsesProductionTransport = {
  meta: {
    type: "problem",
    docs: { description: "An e2e enters through GraphQL, HTTP, socket, broker or scheduler transport." },
    schema: [],
    messages: {
      busImport:
        "`{{name}}` is an application dispatcher, not a production transport. An e2e must enter through GraphQL, HTTP, a real socket, a broker message or the scheduler boundary so routing, guards, validation and serialization are part of the proof.",
      direct:
        "Direct `.{{method}}()` invocation skips the production transport and starts inside the application. Move this decision/wiring test to the integration lane, or drive the flow through GraphQL, HTTP, a real socket, broker or scheduler boundary.",
    },
  },
  create(context) {
    if (!isE2eSpec(context.filename || context.getFilename())) return {}
    return {
      ImportDeclaration(node) {
        if (!node.source || node.source.value !== "@nestjs/cqrs") return
        for (const specifier of node.specifiers) {
          if (specifier.type !== "ImportSpecifier") continue
          const imported = specifier.imported && (specifier.imported.name || specifier.imported.value)
          if (!APPLICATION_BUSES.has(imported)) continue
          context.report({ node: specifier, messageId: "busImport", data: { name: imported } })
        }
      },
      CallExpression(node) {
        const callee = node.callee
        if (!callee || callee.type !== "MemberExpression" || callee.computed) return
        const method = callee.property && callee.property.name
        if (!INTERNAL_ENTRY_METHODS.has(method)) return
        context.report({ node: callee.property, messageId: "direct", data: { method } })
      },
    }
  },
}

// -- TESTING-10 ------------------------------------------------------------------------------------

/** Official provider clients that a harness may call without a house routing layer. */
const DIRECT_PROVIDER_PACKAGES = /^(?:@anthropic-ai\/sdk(?:\/|$)|openai(?:\/|$)|@google\/genai(?:\/|$)|@google\/generative-ai(?:\/|$)|@mistralai\/(?:mistralai|mistralai-ts)(?:\/|$)|cohere-ai(?:\/|$)|ollama(?:\/|$))/

/** Helpers that hide a model call or impersonate the production gateway. */
const FORBIDDEN_HARNESS_HELPERS = /(?:^|\/)(?:models(?:\.service)?|harness-invoke(?:\.service)?)$/

/** Consumer/CLI credential authorities that are never provider API credentials. */
const FORBIDDEN_HARNESS_AUTH = /(?:CLAUDE_CODE_OAUTH_TOKEN|claude-code-token|sk-ant-oat|OAUTH_BETA|CHATGPT_(?:SESSION|AUTH)_TOKEN|CODEX_(?:SESSION|AUTH)_TOKEN|auth-profile)/i

/** Imported symbols that reveal a fake production gateway in the harness lane. */
const FORBIDDEN_HARNESS_SYMBOLS = new Set([
  "AiInvokeService",
  "HarnessInvokeService",
  "createHarnessInvoke",
])

/** Return the static property name of an object/member property when one exists. */
const propertyName = (property) => {
  if (!property) return null
  if (property.type === "Identifier") return property.name
  if (property.type === "Literal") return property.value
  return null
}

/** Find the `AiInvokeService` token in a `Pick<AiInvokeService, ...>` type. */
const aiInvokePickToken = (sourceCode) => {
  const tokens = sourceCode.getTokens(sourceCode.ast)
  for (let index = 0; index < tokens.length - 2; index += 1) {
    if (tokens[index].value !== "Pick" || tokens[index + 1].value !== "<") continue
    if (tokens[index + 2].value === "AiInvokeService") return tokens[index + 2]
  }
  return null
}

/** A harness calls one explicit provider SDK and never disguises it as `AiInvokeService`. */
export const harnessCallsProviderDirectly = {
  meta: {
    type: "problem",
    docs: { description: "A model-quality harness calls an approved provider SDK directly with provider API credentials." },
    schema: [],
    messages: {
      missingProvider:
        "This harness imports no approved provider SDK. A model-quality harness calls the declared provider client directly; a house helper, tier or gateway override can make it green about a model production does not use.",
      gateway:
        "`{{name}}` impersonates or replaces the production AI gateway from a harness. Reuse the production prompt builder and parser around a direct provider SDK call instead.",
      helper:
        "`{{source}}` hides the provider call behind a house harness helper. Import and call the approved provider SDK in this harness; only credential loading may be shared.",
      consumerAuth:
        "`{{authority}}` is a consumer or CLI credential authority, not a provider-issued server API key. Read an explicit harness API-key environment variable instead.",
    },
  },
  create(context) {
    const filename = context.filename || context.getFilename()
    const harness = isHarnessSpec(filename)
    const authScope = harness || isHarnessHelper(filename)
    if (!authScope) return {}

    let hasProviderImport = false
    return {
      ImportDeclaration(node) {
        const source = node.source && node.source.value
        if (typeof source !== "string") return
        if (harness && DIRECT_PROVIDER_PACKAGES.test(source)) hasProviderImport = true
        if (harness && FORBIDDEN_HARNESS_HELPERS.test(source.replace(/\.(?:ts|js)$/, ""))) {
          context.report({ node, messageId: "helper", data: { source } })
        }
        if (!harness) return
        for (const specifier of node.specifiers) {
          const imported = specifier.imported && (specifier.imported.name || specifier.imported.value)
          const local = specifier.local && specifier.local.name
          const name = imported || local
          if (!FORBIDDEN_HARNESS_SYMBOLS.has(name)) continue
          context.report({ node: specifier, messageId: "gateway", data: { name } })
        }
      },
      Literal(node) {
        if (typeof node.value !== "string" || !FORBIDDEN_HARNESS_AUTH.test(node.value)) return
        context.report({ node, messageId: "consumerAuth", data: { authority: node.value } })
      },
      Property(node) {
        if (!harness || propertyName(node.key) !== "provide") return
        if (!node.value || node.value.type !== "Identifier" || node.value.name !== "AiInvokeService") return
        context.report({ node, messageId: "gateway", data: { name: "provide: AiInvokeService" } })
      },
      CallExpression(node) {
        if (!harness || !node.callee || node.callee.type !== "MemberExpression") return
        if (propertyName(node.callee.property) !== "overrideProvider") return
        const argument = node.arguments && node.arguments[0]
        if (!argument || argument.type !== "Identifier" || argument.name !== "AiInvokeService") return
        context.report({ node, messageId: "gateway", data: { name: "overrideProvider(AiInvokeService)" } })
      },
      "Program:exit"(node) {
        if (!harness) return
        const sourceCode = context.sourceCode || context.getSourceCode()
        const pickToken = aiInvokePickToken(sourceCode)
        if (pickToken) {
          context.report({ node: pickToken, messageId: "gateway", data: { name: 'Pick<AiInvokeService, "run">' } })
        }
        if (!hasProviderImport) context.report({ node, messageId: "missingProvider" })
      },
    }
  },
}

/** The rules this law contributes to the plugin. */
export const rules = {
  "no-call-only-spec": noCallOnlySpec,
  "e2e-asserts-persisted-state": e2eAssertsPersistedState,
  "no-model-call-in-e2e": noModelCallInE2e,
  "e2e-uses-production-transport": e2eUsesProductionTransport,
  "harness-calls-provider-directly": harnessCallsProviderDirectly,
}

/**
 * The level this law asks for, as the plugin's own opinion.
 *
 * MEASURED WITH THE RULES THEMSELVES against the reference repository, which is the only count
 * worth writing down: 1 call-only spec of 181, and 1 e2e of 48 that never reads state back.
 *
 * That number was wrong twice before it was right, and both ways are worth knowing. A grep-based
 * estimate said EIGHT - it counted files whose assertions merely INCLUDED a call matcher, which is
 * the shape this rule deliberately permits. A first run of the rule itself said THREE - it counted
 * eslint's own complaints about inline `eslint-disable` comments referring to rules the measuring
 * config never loaded. Count only the reports carrying this rule's own id.
 *
 * Both land at `warn` with the count, get burned down, and flip to `error` at zero.
 */
export const recommended = {
  "starci-be/no-call-only-spec": "error", // no=0 of 182 - burned down from 1
  "starci-be/e2e-asserts-persisted-state": "error", // no=0 of 47 - burned down from 1
  "starci-be/no-model-call-in-e2e": "error", // no=0 of 47
  "starci-be/e2e-uses-production-transport": "error",
  "starci-be/harness-calls-provider-directly": "error",
}
