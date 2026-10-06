/**
 * Twin tests for the testing rules.
 *
 *   node --test testing.spec.mjs
 *
 * Several rules judge a WHOLE FILE, so the cases that matter are the near-misses: one real assertion among call
 * assertions must clear the first rule, and one state read anywhere must clear the e2e rule. A file-level rule that
 * fires on a file doing the right thing once is a rule everybody learns to disable. Path questions are answered by
 * the slot manifest and receivers by their type, so the cases are placed with `at()` under the typed fixture root.
 */
import assert from "node:assert/strict"
import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import { BE_DECLARATION, at, fixtureHfs, typedTester } from "./fixtures/typed/tester.mjs"
import {
  e2eAssertsPersistedState,
  noApiShapedE2eFilename,
  noCallOnlySpec,
  noMarkerModelStub,
  noModelCallInE2e,
  rules,
  unitTestColocated,
} from "./testing.mjs"

/** Rules that need only slots: the parser is untyped, so any number of virtual files may be linted. */
const tester = new RuleTester({
  languageOptions: { parser: tsParser, ecmaVersion: 2022, sourceType: "module" },
  settings: { starci: { hfs: fixtureHfs() } },
})
/** The one rule that reads types: the default project holds at most eight virtual files, so it has its own tester. */
const typed = typedTester()

/** The same slots with the feature kinds enabled: a webhook or realtime door carries its own spec beside it. */
const kinds = new RuleTester({
  languageOptions: { parser: tsParser, ecmaVersion: 2022, sourceType: "module" },
  settings: { starci: { hfs: fixtureHfs({ ...BE_DECLARATION, patterns: ["webhooks", "realtime"] }) } },
})

const UNIT = at("src/features/api/checkout/application/add-to-cart.handler.spec.ts")
const SRC = at("src/features/api/checkout/application/add-to-cart.handler.ts")
const E2E = at("src/tests/e2e/checkout/course-enroll.e2e-spec.ts")
const LIVE = at("src/tests/contract/anthropic/answer.contract-spec.ts")

test("every rule this law declares is exported under its published name", () => {
  for (const [name, rule] of Object.entries(rules)) {
    assert.ok(rule && rule.meta && rule.create, `${name} is not a rule`)
  }
})

test("TESTING-6: a spec whose every assertion is a call restates the source", () => {
  tester.run("no-call-only-spec", noCallOnlySpec, {
    valid: [
      // asserts a result
      { filename: UNIT, code: "it('x', () => { expect(result.total).toBe(5000) })" },
      // a call assertion is fine ALONGSIDE a real one - the mail going out is an observable effect
      {
        filename: UNIT,
        code: "it('x', () => { expect(result.total).toBe(5000); expect(mailer.send).toHaveBeenCalledTimes(1) })",
      },
      // modifiers pass through: this is a real assertion, not a call one
      { filename: UNIT, code: "it('x', async () => { await expect(run()).rejects.toThrow() })" },
      // a file with no assertions is a different problem, and not this rule's
      { filename: UNIT, code: "it('x', () => { run() })" },
      // not a unit spec - the e2e lane has its own rule
      { filename: E2E, code: "it('x', () => { expect(pay.charge).toHaveBeenCalled() })" },
      // not a spec at all
      { filename: SRC, code: "const x = () => expect(a).toHaveBeenCalled()" },
    ],
    invalid: [
      {
        filename: UNIT,
        code: "it('x', () => { expect(payments.charge).toHaveBeenCalledWith(1) })",
        errors: [{ messageId: "callOnly" }],
      },
      {
        filename: UNIT,
        code: "it('a', () => { expect(a.b).toHaveBeenCalled() }); it('c', () => { expect(d.e).not.toHaveBeenCalled() })",
        errors: [{ messageId: "callOnly" }],
      },
    ],
  })
})

test("R47: only a service is unit-tested, its spec sits beside it, and there are only the sanctioned kinds of test file", () => {
  tester.run("unit-test-colocated", unitTestColocated, {
    valid: [
      // the real service with its real spec on disk
      { filename: at("src/modules/domain/order/covered.service.ts"), code: "export class CoveredService {}" },
      // the real spec beside its real service
      { filename: at("src/modules/domain/order/covered.service.spec.ts"), code: "export {}" },
      // a cli command of the cli feature root is a unit-tested role (ruleParams.be.unitRoles): its spec sits beside it, and the spec beside its command
      { filename: at("src/features/cli/migrate/subs/run.cli.ts"), code: "export class RunCli {}" },
      { filename: at("src/features/cli/migrate/subs/run.cli.spec.ts"), code: "export {}" },
      // a file that is not a service needs no spec: handlers, guards, mappers, policies, clients are covered through services
      { filename: at("src/features/api/checkout/application/start-checkout.handler.ts"), code: "export class StartCheckoutHandler {}" },
      { filename: at("src/features/api/checkout/transport/http/session.guard.ts"), code: "export class SessionGuard {}" },
      { filename: at("src/features/api/checkout/transport/graphql/order.mapper.ts"), code: "export const toType = () => 1" },
      { filename: at("src/modules/domain/order/policies/refund.policy.ts"), code: "export class RefundPolicy {}" },
      { filename: at("src/modules/integrations/payos/payos.client.ts"), code: "export class PayosClient {}" },
      // a logic role of the measured modules (coverage required) may carry its own spec beside it: the file owes 100 per file, a spec of its own is optional
      { filename: at("src/modules/domain/order/order.pause.policy.spec.ts"), code: "export {}" },
      { filename: at("src/modules/domain/order/http.client.spec.ts"), code: "export {}" },
      { filename: at("src/modules/domain/order/order.contracts.ts"), code: "export interface Order {}" },
      { filename: at("src/modules/domain/order/index.ts"), code: "export {}" },
      // a service suffix inside the test tree is a fixture, not a subject
      { filename: at("src/tests/fixtures/orders.service.ts"), code: "export class Orders {}" },
      // the integration, e2e and contract layers and world infrastructure are not unit specs
      { filename: E2E, code: "export {}" },
      { filename: at("src/tests/e2e/checkout/archive.spec.ts"), code: "export {}" },
      { filename: at("src/tests/world/use-test-world.spec.ts"), code: "export {}" },
      // a declaration file carries no behaviour
      { filename: at("src/modules/domain/order/order.service.d.ts"), code: "export {}" },
    ],
    invalid: [
      // a service with no spec beside it
      { filename: at("src/modules/domain/order/order.service.ts"), code: "export class OrderService {}", errors: [{ messageId: "missing" }] },
      { filename: at("src/modules/platform/cache/cache.service.ts"), code: "export class CacheService {}", errors: [{ messageId: "missing" }] },
      // a unit spec of anything else is a finding, whatever it is named after
      { filename: at("src/features/api/checkout/application/start-checkout.handler.spec.ts"), code: "export {}", errors: [{ messageId: "notService" }] },
      { filename: at("src/features/api/checkout/transport/graphql/order.resolver.spec.ts"), code: "export {}", errors: [{ messageId: "notService" }] },
      { filename: at("src/features/api/checkout/transport/http/order.controller.spec.ts"), code: "export {}", errors: [{ messageId: "notService" }] },
      { filename: at("src/features/api/checkout/transport/message/paid.consumer.spec.ts"), code: "export {}", errors: [{ messageId: "notService" }] },
      { filename: at("src/features/api/checkout/transport/graphql/order.mapper.spec.ts"), code: "export {}", errors: [{ messageId: "notService" }] },
      { filename: at("src/features/api/checkout/transport/http/session.guard.spec.ts"), code: "export {}", errors: [{ messageId: "notService" }] },
      { filename: at("src/modules/domain/order/order.module.spec.ts"), code: "export {}", errors: [{ messageId: "notService" }] },
      { filename: at("src/modules/domain/order/persistence/entities/order.entity.spec.ts"), code: "export {}", errors: [{ messageId: "notService" }] },
      // a logic role (policy) inside the measured modules may have its spec, but only beside its subject
      { filename: at("src/modules/domain/order/policies/refund.policy.spec.ts"), code: "export {}", errors: [{ messageId: "orphan" }] },
      // a role that is not a logic role has no unit spec anywhere
      { filename: at("src/modules/domain/order/order.options.spec.ts"), code: "export {}", errors: [{ messageId: "notService" }] },
      { filename: at("src/modules/domain/order/order-math.spec.ts"), code: "export {}", errors: [{ messageId: "notService" }] },
      { filename: at("src/modules/domain/order/order.spec.ts"), code: "export {}", errors: [{ messageId: "notService" }] },
      // a composition spec in an app is not a unit kind
      { filename: at("apps/api/src/api.composition.spec.ts"), code: "export {}", errors: [{ messageId: "notService" }] },
      { filename: at("apps/cli/src/cli.composition.spec.ts"), code: "export {}", errors: [{ messageId: "notService" }] },
      // a cli command with no spec beside it, and a cli spec with no command beside it
      { filename: at("src/features/cli/migrate/subs/seed.cli.ts"), code: "export class SeedCli {}", errors: [{ messageId: "missing" }] },
      { filename: at("src/features/cli/migrate/subs/gone.cli.spec.ts"), code: "export {}", errors: [{ messageId: "orphan" }] },
      // a cli spec outside the cli feature root is no unit-tested role
      { filename: at("src/modules/domain/order/order.cli.spec.ts"), code: "export {}", errors: [{ messageId: "notService" }] },
      // a service spec with no service beside it
      { filename: at("src/modules/domain/order/nothing-here.service.spec.ts"), code: "export {}", errors: [{ messageId: "orphan" }] },
      // the banned kinds
      { filename: at("src/modules/domain/order/order.service.test.ts"), code: "export {}", errors: [{ messageId: "suffix" }] },
      { filename: at("src/modules/domain/order/order.int-spec.ts"), code: "export {}", errors: [{ messageId: "suffix" }] },
      { filename: at("src/tests/e2e/checkout/order.harness-spec.ts"), code: "export {}", errors: [{ messageId: "suffix" }] },
    ],
  })
})

test("R47: a webhook or realtime door carries its own spec beside it, and only in the slot of its kind", () => {
  kinds.run("unit-test-colocated", unitTestColocated, {
    valid: [
      // the door's spec beside its real door
      { filename: at("src/features/webhooks/payment/transport/http/payment.webhook.spec.ts"), code: "export {}" },
      // the door itself needs no service spec
      { filename: at("src/features/webhooks/payment/transport/http/payment.webhook.ts"), code: "export class PaymentWebhook {}" },
    ],
    invalid: [
      // a door spec with no door beside it
      { filename: at("src/features/webhooks/ghost/transport/http/ghost.webhook.spec.ts"), code: "export {}", errors: [{ messageId: "orphan" }] },
      { filename: at("src/features/realtime/orders/transport/websocket/orders.gateway.spec.ts"), code: "export {}", errors: [{ messageId: "orphan" }] },
      // the same name outside the slot of the kind is an ordinary non-service unit spec
      { filename: at("src/features/plan/transport/http/pay.webhook.spec.ts"), code: "export {}", errors: [{ messageId: "notService" }] },
      // the kind's slot holds door specs only: a controller spec of another role is still refused
      { filename: at("src/features/webhooks/payment/payment.controller.spec.ts"), code: "export {}", errors: [{ messageId: "notService" }] },
    ],
  })
})

test("TESTING-2: an e2e that never reads state back only proves the server replied", () => {
  const READER = "import { EntityManager, DataSource, QueryRunner } from 'typeorm'\n"
  const WORLD = "import { useTestWorld } from '../../world/test-world.contracts'\n"
  typed.run("e2e-asserts-persisted-state", e2eAssertsPersistedState, {
    valid: [
      // the flow reads a row back through the entity manager, whatever it calls it
      { filename: E2E, code: READER + "declare const store: EntityManager\nit('x', async () => { expect(await store.query('select 1')).toBe(1) })" },
      { filename: E2E, code: READER + "declare const source: DataSource\nit('x', async () => { expect(await source.manager.query('select 1')).toBe(1) })" },
      { filename: E2E, code: READER + "declare const runner: QueryRunner\nit('x', async () => { expect(await runner.query('select 1')).toBe(1) })" },
      // the manager is handed to a fixture reader
      { filename: E2E, code: READER + "declare const em: EntityManager\ndeclare const orderRows: (manager: EntityManager) => Promise<number>\nit('x', async () => { expect(await orderRows(em)).toBe(1) })" },
      // the world's own state reads: a connection's entity manager and a sibling service's API
      { filename: E2E, code: WORLD + "const world = useTestWorld()\nit('x', async () => { expect(await world.db.core.find()).toEqual([]) })" },
      { filename: E2E, code: WORLD + "const w = useTestWorld()\nit('x', async () => { expect(await w.services.billing.api.balance()).toBe(0) })" },
      // a unit spec is a different lane
      { filename: UNIT, code: "it('x', () => { expect(a).toBe(1) })" },
    ],
    invalid: [
      { filename: E2E, code: "it('x', async () => { expect(response.status).toBe(200) })", errors: [{ messageId: "noState" }] },
      // a world that only waits and calls reads nothing back
      { filename: E2E, code: WORLD + "const world = useTestWorld()\nit('x', async () => { expect(await world.waitFor('x', async () => 1)).toBe(1) })", errors: [{ messageId: "noState" }] },
      // `db` on a value that is not the world proves nothing
      { filename: E2E, code: WORLD + "const world = useTestWorld()\nit('x', () => { expect(world.other.db.find()).toBe(1) })", errors: [{ messageId: "noState" }] },
      // the name entityManager on a value that is not one proves nothing
      { filename: E2E, code: "declare const entityManager: { find(): number }\nit('x', () => { expect(entityManager.find()).toBe(1) })", errors: [{ messageId: "noState" }] },
      // importing the type is not reading state
      { filename: E2E, code: READER + "it('x', async () => { expect(response.status).toBe(200) })", errors: [{ messageId: "noState" }] },
    ],
  })
})

test("TESTING-9: an e2e reaches a model only through the world's network fake; only a contract spec reaches a provider", () => {
  tester.run("no-model-call-in-e2e", noModelCallInE2e, {
    valid: [
      { filename: E2E, code: "import { useTestWorld } from '../../world/use-test-world'" },
      // a contract spec is the one place a provider is reachable
      { filename: LIVE, code: "import Anthropic from '@anthropic-ai/sdk'" },
      { filename: LIVE, code: "import OpenAI from 'openai'" },
      // not an e2e
      { filename: SRC, code: "import OpenAI from 'openai'" },
    ],
    invalid: [
      { filename: E2E, code: "import Anthropic from '@anthropic-ai/sdk'", errors: [{ messageId: "provider" }] },
      { filename: E2E, code: "import OpenAI from 'openai'", errors: [{ messageId: "provider" }] },
      { filename: E2E, code: "import { GoogleGenAI } from '@google/genai'", errors: [{ messageId: "provider" }] },
    ],
  })
})

test("TESTING-1 / E2E-1: an e2e filename is the business sentence, not an API-shape noun", () => {
  tester.run("no-api-shaped-e2e-filename", noApiShapedE2eFilename, {
    valid: [
      // a business sentence
      { filename: E2E, code: "it('x', () => {})" },
      // multi-word business sentences that happen to end near an API-flavoured word but not one
      { filename: at("src/tests/e2e/community/community-chat-room-authorization.e2e-spec.ts"), code: "it('x', () => {})" },
      { filename: at("src/tests/e2e/github/github-account-link.e2e-spec.ts"), code: "it('x', () => {})" },
      // not an e2e file - this code has nothing to say about a unit spec's name
      { filename: UNIT, code: "it('x', () => {})" },
    ],
    invalid: [
      // the law's own anchor example
      { filename: at("src/tests/e2e/rewards/rewards-queries.e2e-spec.ts"), code: "it('x', () => {})", errors: [{ messageId: "apiShaped" }] },
      { filename: at("src/tests/e2e/plans/installment-plan-queries.e2e-spec.ts"), code: "it('x', () => {})", errors: [{ messageId: "apiShaped" }] },
      { filename: at("src/tests/e2e/courses/course-resolvers.e2e-spec.ts"), code: "it('x', () => {})", errors: [{ messageId: "apiShaped" }] },
    ],
  })
})

test("TESTING-7: a model stub returns a payload the production parser can parse, not a marker", () => {
  const FIXTURE = at("src/tests/fixtures/model.ts")
  tester.run("no-marker-model-stub", noMarkerModelStub, {
    valid: [
      // the real shape: JSON.stringify(...) is a CallExpression, not a bare marker Literal
      { filename: FIXTURE, code: "model.run = jest.fn().mockResolvedValue({ text: JSON.stringify({ answer: 'x' }) })" },
      // an object literal payload with a "stub" field elsewhere is not what this rule looks at:
      // only a BARE string literal standing in for the whole argument is
      { filename: FIXTURE, code: "model.run = jest.fn().mockResolvedValue({ text: answer.text, provider: 'stub' })" },
      // a real (non-marker) literal payload is a legitimate stub
      { filename: FIXTURE, code: "model.run = jest.fn().mockResolvedValue('{\"answer\":1}')" },
      // not test infrastructure: a marker string in a unit spec is not this rule's business
      { filename: UNIT, code: "x.run = jest.fn().mockResolvedValue('stubbed')" },
    ],
    invalid: [
      { filename: FIXTURE, code: "model.run = jest.fn().mockResolvedValue('stubbed')", errors: [{ messageId: "marker" }] },
      { filename: FIXTURE, code: "model.run = jest.fn().mockReturnValue('ok')", errors: [{ messageId: "marker" }] },
      { filename: FIXTURE, code: "model.run = jest.fn().mockImplementation(() => 'test')", errors: [{ messageId: "marker" }] },
      { filename: FIXTURE, code: "model.run = jest.fn().mockImplementation(() => { return 'mock' })", errors: [{ messageId: "marker" }] },
      // the e2e setup is test infrastructure too
      { filename: at("src/tests/world/use-test-world.ts"), code: "model.run = jest.fn().mockResolvedValue('stubbed')", errors: [{ messageId: "marker" }] },
    ],
  })
})
