/**
 * The rules that hold `testing.md` (catalog R47 `BE_TEST_TOPOLOGY` and R48 `BE_SPEC_QUALITY`).
 *
 * MOST OF THAT LAW IS NOT MACHINE-CHECKABLE, and pretending otherwise would be worse than checking nothing. No rule
 * can tell whether a file represents a business flow, whether the unhappy path it covers drags a critical flow
 * behind it, or whether the decision branches are covered - those are read by a person. What a rule CAN see is a
 * shape that is wrong on its face regardless of intent:
 *
 *   - a spec whose every assertion is about a call rather than a result (`no-call-only-spec`);
 *   - a unit spec of anything but a service, a service with no `<name>.service.spec.ts` beside it, a service spec with no
 *     service beside it, and a file of a kind the convention bans (`.test.ts`, `int-spec`, `harness-spec`)
 *     (`unit-test-colocated`);
 *   - an e2e that never reads persisted state back, and an e2e that reaches a model provider
 *     (`e2e-asserts-persisted-state`, `no-model-call-in-e2e`);
 *   - an e2e filename that names an API shape instead of a business flow (`no-api-shaped-e2e-filename`);
 *   - a model stub that returns a bare marker instead of a payload the production parser can parse
 *     (`no-marker-model-stub`).
 *
 * Every path question is asked of the slot manifest (`hfsOf(context)`): a rule never tests a path with a regular
 * expression. A file name is a role vocabulary of the slots (`*.spec.ts`, `*.e2e-spec.ts`, `*.handler.ts`) and is read
 * from the basename. A state read is recognised by the TYPE of the receiver (`EntityManager`, `DataSource`,
 * `QueryRunner` of `typeorm`), never by its variable name.
 */

import { statSync } from "node:fs"
import { basename, dirname, join } from "node:path"
import { hfsOf } from "./lib/hfs.mjs"
import { isPackageType } from "./lib/types.mjs"
import { isServiceSpecFile, isUnitSpecFile, serviceNameOfSpec } from "./lib/unit-spec.mjs"

/** The file name of a linted path, in forward-slash form. */
const baseOf = (filename) => basename(String(filename || "").replace(/\\/g, "/"))

/** Test kind 1 of exactly two: a unit spec, `<name>.spec.ts` beside its subject. */
const isUnitSpec = (filename) => /\.spec\.ts$/.test(baseOf(filename))

/** Test kind 2 of exactly two: `*.e2e-spec.ts`. */
const isE2eSpec = (filename) => /\.e2e-spec\.ts$/.test(baseOf(filename))

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


// -- R47 unit spec topology ------------------------------------------------------------------------

/** Whether a file exists (a spec is beside its subject on disk, so this is the one question the disk answers). */
const exists = (path) => {
  try {
    return statSync(path).isFile()
  } catch {
    return false
  }
}

/** Kinds of test file the convention bans: `.test.ts`, `*.int-spec.ts`, `*.harness-spec.ts` (any spec kind other than `spec` and `e2e-spec`). */
const BANNED_TEST_FILE = /(?:\.test|\.int-spec|\.harness-spec)\.[cm]?[jt]sx?$/

/**
 * Unit specs are for services only: every `<name>.service.ts` has its `<name>.service.spec.ts` beside it, every unit spec is
 * one of those, and there are no other kinds of test file. A composition spec is not a unit kind.
 */
export const unitTestColocated = {
  meta: {
    type: "problem",
    docs: { description: "Only a `<name>.service.ts` is unit-tested: it has its `<name>.service.spec.ts` beside it, any other unit spec is a finding, and there are only the spec kinds `spec`, `e2e-spec`, `integration-spec` and `contract-spec`." },
    schema: [],
    messages: {
      suffix: "`{{name}}` is a banned kind of test file. A test is a `<name>.service.spec.ts` unit beside its service or a `*.e2e-spec.ts` flow under `src/tests/e2e/`; there is no `.test.ts`, `int-spec` or `harness-spec`.",
      notService: "`{{name}}` is a unit spec of something that is not a service. Only `<name>.service.ts` is unit-tested; a handler, resolver, controller, consumer, mapper, entity, guard, module, policy, helper or composition is covered through the service tests and the e2e flows. Delete this spec and move any business rule it checks into a service.",
      orphan: "`{{name}}` has no service beside it. A unit spec is `<name>.service.spec.ts` next to `<name>.service.ts` and tests that one service; move it beside its service, or rename it after the service it tests.",
      missing: "This service has no spec. Add `{{spec}}` beside it: it builds the service with `Test.createTestingModule`, provides only its constructor dependencies as typed doubles and asserts results or state.",
    },
  },
  create(context) {
    const filename = context.filename || context.getFilename()
    const name = baseOf(filename)
    const hfs = hfsOf(context)
    if (/\.d\.[cm]?ts$/.test(name)) return {}
    if (BANNED_TEST_FILE.test(name)) {
      return { Program(node) { context.report({ node, messageId: "suffix", data: { name } }) } }
    }
    if (isUnitSpecFile(hfs, filename)) {
      if (!isServiceSpecFile(hfs, filename)) return { Program(node) { context.report({ node, messageId: "notService", data: { name } }) } }
      if (exists(join(dirname(filename), `${serviceNameOfSpec(filename)}.service.ts`))) return {}
      return { Program(node) { context.report({ node, messageId: "orphan", data: { name } }) } }
    }
    if (!name.endsWith(".service.ts")) return {}
    // a service outside the test tree; the slot manifest says where the tests live
    const slot = hfs.slotOf(filename)
    if (!slot || slot.startsWith("be.tests.")) return {}
    const stem = join(dirname(filename), name.slice(0, -".ts".length))
    if (exists(`${stem}.spec.ts`)) return {}
    return { Program(node) { context.report({ node, messageId: "missing", data: { spec: `${name.slice(0, -".ts".length)}.spec.ts` } }) } }
  },
}


// -- TESTING-2 -------------------------------------------------------------------------------------

/** The typeorm types a flow reads persisted state through. */
const STATE_TYPES = ["EntityManager", "DataSource", "QueryRunner"]

/** Whether an expression is a receiver of persisted state, by the TYPE it has and the package that declares it. */
const isStateReader = (context, node) => STATE_TYPES.some((name) => isPackageType(context, node, name, "typeorm"))

/** An end-to-end spec that never reads state back proves only that the server replied. */
export const e2eAssertsPersistedState = {
  meta: {
    type: "problem",
    docs: { description: "An e2e spec reads state back rather than asserting only on the response." },
    schema: [],
    messages: {
      noState:
        "This e2e never reads any state back - it asserts on responses alone, so the flow can stop persisting and this file stays green. Read the row, the balance or the entitlement out of the database through the `EntityManager` and assert THAT.",
    },
  },
  create(context) {
    if (!isE2eSpec(context.filename || context.getFilename())) return {}
    let readsState = false
    return {
      MemberExpression(node) {
        if (!readsState && isStateReader(context, node.object)) readsState = true
      },
      CallExpression(node) {
        if (!readsState && node.arguments.some((argument) => argument.type !== "SpreadElement" && isStateReader(context, argument))) readsState = true
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
const PROVIDER_PACKAGES = /^(?:@anthropic-ai\/|openai$|openai\/|ollama$|@google\/generative-ai|@google\/genai|@mistralai\/|cohere-ai)/

/** An e2e never calls a model; only a contract spec (`src/tests/contract/`, suffix `.contract-spec.ts`) may reach a provider. */
export const noModelCallInE2e = {
  meta: {
    type: "problem",
    docs: { description: "An e2e spec never reaches a model provider." },
    schema: [],
    messages: {
      provider:
        "`{{source}}` reaches a model provider from an e2e. A model call costs money, takes seconds and answers differently every time - so this makes the flow suite expensive, slow and flaky at once, and the assertion has to be loosened until it stops catching anything. Point the model integration at the world's network fake (`world.fake.<provider>`) and assert what can actually break: the entitlement, the quota, the persisted answer. Judging the answer itself belongs in a contract spec under `src/tests/contract/<provider>/`.",
    },
  },
  create(context) {
    const filename = context.filename || context.getFilename()
    if (!isE2eSpec(filename)) return {}
    return {
      ImportDeclaration(node) {
        const source = node.source && node.source.value
        if (typeof source !== "string" || !PROVIDER_PACKAGES.test(source)) return
        context.report({ node, messageId: "provider", data: { source } })
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
  const base = baseOf(filename)
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

/** Test infrastructure: the fixtures and the test world, where the shared model stub lives (slots `be.tests.fixtures`, `be.tests.world`). */
const isTestInfrastructure = (hfs, filename) => ["be.tests.fixtures", "be.tests.world"].includes(hfs.slotOf(filename))

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
    if (!isTestInfrastructure(hfsOf(context), context.filename || context.getFilename())) return {}
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

/** The rules this law contributes to the plugin. */
export const rules = {
  "no-call-only-spec": noCallOnlySpec,
  "unit-test-colocated": unitTestColocated,
  "e2e-asserts-persisted-state": e2eAssertsPersistedState,
  "no-model-call-in-e2e": noModelCallInE2e,
  "no-api-shaped-e2e-filename": noApiShapedE2eFilename,
  "no-marker-model-stub": noMarkerModelStub,
}

/** Every rule of this law ships at `error`. */
export const recommended = {
  "starci-be/no-call-only-spec": "error",
  "starci-be/unit-test-colocated": "error",
  "starci-be/e2e-asserts-persisted-state": "error",
  "starci-be/no-model-call-in-e2e": "error",
  "starci-be/no-api-shaped-e2e-filename": "error",
  "starci-be/no-marker-model-stub": "error",
}
