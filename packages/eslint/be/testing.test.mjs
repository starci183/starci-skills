/**
 * Twin tests for the testing rules.
 *
 *   node --test testing.test.mjs
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
import { at, fixtureHfs, typedTester } from "./fixtures/typed/tester.mjs"
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

const UNIT = at("src/features/checkout/application/add-to-cart.handler.spec.ts")
const SRC = at("src/features/checkout/application/add-to-cart.handler.ts")
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

test("R47: a role has a twin spec, a spec has a subject, and there are two kinds of test file", () => {
  tester.run("unit-test-colocated", unitTestColocated, {
    valid: [
      // the real subject with its real twin on disk
      { filename: at("src/modules/domain/order/covered.service.ts"), code: "export class CoveredService {}" },
      // the real twin beside its real subject
      { filename: at("src/modules/domain/order/covered.service.spec.ts"), code: "export {}" },
      // the app slot requires its composition spec; its subject is the app module, not a sibling file
      { filename: at("apps/api/src/api.composition.spec.ts"), code: "export {}" },
      { filename: at("apps/migrate/src/migrate.composition.spec.ts"), code: "export {}" },
      // a file with no twin role needs no twin
      { filename: at("src/modules/domain/order/order.contracts.ts"), code: "export interface Order {}" },
      { filename: at("src/modules/domain/order/index.ts"), code: "export {}" },
      // a role suffix outside the slot that owns the role is not this rule's business (naming rules judge it)
      { filename: at("src/tests/fixtures/orders.service.ts"), code: "export class Orders {}" },
      // an e2e flow is the second kind of test file
      { filename: E2E, code: "export {}" },
      // a declaration file carries no behaviour
      { filename: at("src/modules/domain/order/order.service.d.ts"), code: "export {}" },
    ],
    invalid: [
      // the roles of BE-CONVENTION 1.16, by slot and basename role
      { filename: at("src/features/checkout/application/start-checkout.handler.ts"), code: "export class StartCheckoutHandler {}", errors: [{ messageId: "twin" }] },
      { filename: at("src/modules/domain/order/order.service.ts"), code: "export class OrderService {}", errors: [{ messageId: "twin" }] },
      { filename: at("src/features/checkout/transport/message/paid.consumer.ts"), code: "export class PaidConsumer {}", errors: [{ messageId: "twin" }] },
      { filename: at("src/features/checkout/transport/schedule/sweep.job.ts"), code: "export class SweepJob {}", errors: [{ messageId: "twin" }] },
      { filename: at("src/features/checkout/transport/http/session.guard.ts"), code: "export class SessionGuard {}", errors: [{ messageId: "twin" }] },
      { filename: at("src/features/checkout/transport/graphql/order.mapper.ts"), code: "export const toType = () => 1", errors: [{ messageId: "twin" }] },
      { filename: at("src/modules/domain/order/policies/refund.policy.ts"), code: "export class RefundPolicy {}", errors: [{ messageId: "twin" }] },
      { filename: at("src/modules/integrations/payos/payos.client.ts"), code: "export class PayosClient {}", errors: [{ messageId: "twin" }] },
      { filename: at("src/modules/domain/order/persistence/order.rows.ts"), code: "export const toOrder = () => 1", errors: [{ messageId: "twin" }] },
      // a spec with no subject beside it
      { filename: at("src/modules/domain/order/nothing-here.spec.ts"), code: "export {}", errors: [{ messageId: "orphan" }] },
      // only the spec the slot requires is exempt: another spec in an app, or a composition spec in a module, has no subject
      { filename: at("apps/api/src/other.spec.ts"), code: "export {}", errors: [{ messageId: "orphan" }] },
      { filename: at("apps/api/src/migrate.composition.spec.ts"), code: "export {}", errors: [{ messageId: "orphan" }] },
      { filename: at("src/modules/domain/order/order.composition.spec.ts"), code: "export {}", errors: [{ messageId: "orphan" }] },
      { filename: at("src/tests/world/use-test-world.spec.ts"), code: "export {}", errors: [{ messageId: "orphan" }] },
      // the banned kinds
      { filename: at("src/modules/domain/order/order.service.test.ts"), code: "export {}", errors: [{ messageId: "suffix" }] },
      { filename: at("src/modules/domain/order/order.int-spec.ts"), code: "export {}", errors: [{ messageId: "suffix" }] },
      { filename: at("src/tests/e2e/checkout/order.harness-spec.ts"), code: "export {}", errors: [{ messageId: "suffix" }] },
    ],
  })
})

test("TESTING-2: an e2e that never reads state back only proves the server replied", () => {
  const READER = "import { EntityManager, DataSource, QueryRunner } from 'typeorm'\n"
  typed.run("e2e-asserts-persisted-state", e2eAssertsPersistedState, {
    valid: [
      // the flow reads a row back through the entity manager, whatever it calls it
      { filename: E2E, code: READER + "declare const store: EntityManager\nit('x', async () => { expect(await store.query('select 1')).toBe(1) })" },
      { filename: E2E, code: READER + "declare const source: DataSource\nit('x', async () => { expect(await source.manager.query('select 1')).toBe(1) })" },
      { filename: E2E, code: READER + "declare const runner: QueryRunner\nit('x', async () => { expect(await runner.query('select 1')).toBe(1) })" },
      // the manager is handed to a fixture reader
      { filename: E2E, code: READER + "declare const em: EntityManager\ndeclare const orderRows: (manager: EntityManager) => Promise<number>\nit('x', async () => { expect(await orderRows(em)).toBe(1) })" },
      // a unit spec is a different lane
      { filename: UNIT, code: "it('x', () => { expect(a).toBe(1) })" },
    ],
    invalid: [
      { filename: E2E, code: "it('x', async () => { expect(response.status).toBe(200) })", errors: [{ messageId: "noState" }] },
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
