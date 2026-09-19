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
 *
 * Two more codes turned out to have a genuinely mechanical HALF, added later and kept narrow on
 * purpose:
 *
 *   - TESTING-1. A filename cannot be checked against a business sentence - but the anti-pattern
 *     the law names by example (`rewards-queries.e2e-spec.ts`) IS a closed, denylisted shape: a
 *     filename whose last segment is an API noun rather than a business one. The rule refuses only
 *     that shape; it does not claim to certify a good name, and it is the same requirement E2E-1 in
 *     `e2e-flow.md` states on the same file, so one rule holds both codes rather than reporting the
 *     same file twice under two names.
 *   - TESTING-7. "A stub of a model returns a payload the production parser can actually parse" -
 *     the rule cannot verify the payload parses, but it CAN refuse the one shape the law names by
 *     example: a bare marker string (`"stubbed"`, `"ok"`, `"test"`) standing in for the whole
 *     answer. An object literal, or a `JSON.stringify(...)` call, is out of the rule's reach on
 *     purpose - that is where a false positive would start.
 *
 * TESTING-5 / TESTING-8 ("a configured lane either holds tests or does not exist") was drafted as a
 * filesystem-reading rule and then WITHDRAWN. It reads correctly as JS to `@typescript-eslint/parser`
 * (`{"rootDir": "..."}` parses as an `ExpressionStatement` over an `ObjectExpression` under this
 * parser, no wrapping needed) and its own file-scoped RuleTester cases passed. It is left out anyway,
 * because the question it would answer is not "does this repository's config have this shape" but
 * "does the CONSUMING repository's `eslint.config.mjs` even point a linter at this file at all" - and
 * in the measured reference repository it does not: `files` there is five TypeScript globs under
 * `src`, `apps`, `libs`, `test` and `tests` - none of them `.json` - so `jest-e2e.json` and
 * `jest-harness.json` sit outside every one of them. A rule that cannot be reached by the config
 * that would run it is not a `warn`-with-a-count away from correct; it is dead code reporting a "0"
 * that means "never asked", not "already true" - the one measurement this family refuses to publish
 * as if it were the other.
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

// -- TESTING-7 -------------------------------------------------------------------------------------

const UNIT_TEST_BUCKET = /\/(?:src\/tests|tests?\/unit)(?:\/|$)/

/** Backend units are colocated `.spec.ts` files; only backend E2E owns a separate tree. */
export const unitTestColocated = {
  meta: {
    type: "problem",
    docs: { description: "Backend unit tests are colocated `.spec.ts` files; generic `.test.ts` and unit buckets are forbidden." },
    schema: [],
    messages: {
      suffix: "`{{name}}` uses `.test.ts`. A backend unit is a colocated `.spec.ts` file beside its production owner.",
      bucket: "`{{path}}` files a unit in a separate test bucket. Move it beside its production owner; only backend E2E owns a separate test tree.",
    },
  },
  create(context) {
    const file = normalizePath(context.filename || context.getFilename())
    const genericUnit = /\.test\.ts$/.test(file)
    const bucketedUnit = isUnitSpec(file) && UNIT_TEST_BUCKET.test(file)
    if (!genericUnit && !bucketedUnit) return {}
    return {
      Program(node) {
        if (genericUnit) context.report({ node, messageId: "suffix", data: { name: file.slice(file.lastIndexOf("/") + 1) } })
        if (bucketedUnit) context.report({ node, messageId: "bucket", data: { path: file } })
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

// -- TESTING-1 (and E2E-1 in e2e-flow.md, the same requirement on the same file) -------------------

/** Nouns that name an API shape rather than a business promise. `rewards-queries` is the anchor. */
const API_SHAPED_FILENAME_NOUNS = new Set([
  "queries", "query", "mutations", "mutation",
  "resolvers", "resolver", "endpoints", "endpoint",
  "controllers", "controller", "handlers", "handler",
  "modules", "module", "apis", "api",
])

/** The hyphen-separated words of an e2e filename, with the lane suffix stripped. */
const e2eFilenameSegments = (filename) => {
  const base = normalizePath(filename).split("/").pop() || ""
  return base.replace(/\.e2e-spec\.ts$/, "").split("-").filter(Boolean)
}

/** An e2e file is one business flow; the filename may not be an API-shape noun wearing its clothes. */
export const noApiShapedE2eFilename = {
  meta: {
    type: "problem",
    docs: {
      description:
        "An e2e filename reads as a business sentence (TESTING-1; E2E-1 in e2e-flow.md), not a resolver/endpoint/module group.",
    },
    schema: [],
    messages: {
      apiShaped:
        "`{{segment}}` names an API shape - a resolver group, an endpoint, a module - not a business promise. TESTING-1 / E2E-1: one e2e file is one business flow and the filename IS that flow; `rewards-queries.e2e-spec.ts` is exactly the shape this refuses. Name the file for the sentence it proves (`course-purchase.e2e-spec.ts`), not the API surface it happens to hit.",
    },
  },
  create(context) {
    const filename = context.filename || context.getFilename()
    if (!isE2eSpec(filename)) return {}
    const segments = e2eFilenameSegments(filename)
    if (segments.length === 0) return {}
    const last = segments[segments.length - 1].toLowerCase()
    if (!API_SHAPED_FILENAME_NOUNS.has(last)) return {}
    return {
      Program(node) {
        context.report({ node, messageId: "apiShaped", data: { segment: last } })
      },
    }
  },
}

// -- TESTING-7 -------------------------------------------------------------------------------------

/** Test-infra helpers, where the shared model stub this code governs actually lives. */
const isTestHelperFile = (filename) => /\/tests\/helpers\//.test(normalizePath(filename))

/** Bare markers a stub returns when nobody gave it a real answer to stand in for. */
const MARKER_STRINGS = new Set(["stubbed", "stub", "ok", "test", "mock", "fake", "todo", "tbd", "n/a", "pending", ""])

/** A string literal that is nothing but a marker - not an object, not a `JSON.stringify(...)` call. */
const isMarkerLiteral = (node) => Boolean(
  node && node.type === "Literal" && typeof node.value === "string" && MARKER_STRINGS.has(node.value.trim().toLowerCase()),
)

/** The world's default model stub returns a payload the production parser can actually parse. */
export const noMarkerModelStub = {
  meta: {
    type: "problem",
    docs: {
      description: "A model stub in test infra returns a parseable payload (TESTING-7), never a bare marker string.",
    },
    schema: [],
    messages: {
      marker:
        "This stub resolves to `{{value}}`, a marker rather than an answer. TESTING-7: a stub of a model returns a payload the production parser can actually parse - a marker string means the strict-JSON parser the real flow depends on never runs, so the most fragile seam in the flow is never exercised. Return the shape the production parser expects (an object, or a `JSON.stringify(...)` of one), the way `DEFAULT_MODEL_ANSWER` does.",
    },
  },
  create(context) {
    if (!isTestHelperFile(context.filename || context.getFilename())) return {}
    return {
      CallExpression(node) {
        const callee = node.callee
        if (!callee || callee.type !== "MemberExpression" || callee.computed) return
        const method = callee.property.name
        if (method === "mockResolvedValue" || method === "mockReturnValue") {
          const argument = node.arguments[0]
          if (isMarkerLiteral(argument)) {
            context.report({ node: argument, messageId: "marker", data: { value: JSON.stringify(argument.value) } })
          }
          return
        }
        if (method !== "mockImplementation") return
        const fn = node.arguments[0]
        if (!fn || (fn.type !== "ArrowFunctionExpression" && fn.type !== "FunctionExpression")) return
        if (fn.body.type !== "BlockStatement") {
          if (isMarkerLiteral(fn.body)) {
            context.report({ node: fn.body, messageId: "marker", data: { value: JSON.stringify(fn.body.value) } })
          }
          return
        }
        for (const statement of fn.body.body) {
          if (statement.type === "ReturnStatement" && isMarkerLiteral(statement.argument)) {
            context.report({ node: statement.argument, messageId: "marker", data: { value: JSON.stringify(statement.argument.value) } })
          }
        }
      },
    }
  },
}

/** The rules this law contributes to the plugin. */
export const rules = {
  "no-call-only-spec": noCallOnlySpec,
  "unit-test-colocated": unitTestColocated,
  "e2e-asserts-persisted-state": e2eAssertsPersistedState,
  "no-model-call-in-e2e": noModelCallInE2e,
  "harness-calls-provider-directly": harnessCallsProviderDirectly,
  "no-api-shaped-e2e-filename": noApiShapedE2eFilename,
  "no-marker-model-stub": noMarkerModelStub,
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
 *
 * The two later rules were measured the same way, against the same repository:
 *
 *   - `no-api-shaped-e2e-filename` found TWO of 77 - `installment-plan-queries.e2e-spec.ts` and
 *     `rewards-queries.e2e-spec.ts`, the exact anchor example the law names. Real, pre-existing debt
 *     this task does not fix, so it lands at `warn` rather than claiming a burn-down that has not
 *     happened.
 *   - `no-marker-model-stub` found ZERO of the world's own stub in `tests/helpers/flow-world.ts`:
 *     the default answer is `JSON.stringify({ answer: "..." })`, which is a `CallExpression`, not a
 *     `Literal`, so the rule does not even see it as a candidate. It ships at `error` as a
 *     regression guard on a shape that is already correct.
 */
export const recommended = {
  "starci-be/no-call-only-spec": "error", // no=0 of 182 - burned down from 1
  "starci-be/unit-test-colocated": "error",
  "starci-be/e2e-asserts-persisted-state": "error", // no=0 of 47 - burned down from 1
  "starci-be/no-model-call-in-e2e": "error", // no=0 of 47
  "starci-be/harness-calls-provider-directly": "error",
  "starci-be/no-api-shaped-e2e-filename": "warn", // no=2 of 77 - pre-existing, not burned down here
  "starci-be/no-marker-model-stub": "error", // no=0 - the world's stub already returns JSON.stringify(...)
}
