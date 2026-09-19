/**
 * Twin tests for the e2e-flow rules.
 *
 *   node --test e2e-flow.test.mjs
 *
 * The valid cases carry most of the weight. Both rules fire only inside `*.e2e-spec.ts`, and a
 * version that widened to every spec would refuse the ordinary unit test - where a sleep is
 * sometimes the thing under test, and a conditional is just code.
 */
import assert from "node:assert/strict"
import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import {
  e2eUsesProductionTransport,
  noBranchInFlowStep,
  noSleepInFlow,
  noWiringInFlowSpec,
  rules,
} from "./e2e-flow.mjs"

const tester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: "module",
  },
})

const FLOW = "/repo/src/tests/e2e/course-purchase.e2e-spec.ts"
const UNIT = "/repo/src/modules/billing/charge.spec.ts"

test("operational E2E preserves the production transport boundary", () => {
  tester.run("e2e-uses-production-transport", e2eUsesProductionTransport, {
    valid: [{ filename: FLOW, code: "await request(app).post('/graphql').send(body)" }],
    invalid: [{
      filename: FLOW,
      code: "import { CommandBus } from '@nestjs/cqrs'; await commandBus.execute(command)",
      errors: [{ messageId: "busImport" }, { messageId: "direct" }],
    }, {
      filename: FLOW,
      code: "await enrollWorker.finalize(job)",
      errors: [{ messageId: "actor" }],
    }],
  })
})

/** The shipped business inventory; absence is a broken lane, not a skip. */

/*
 * THE CANONICAL-INVENTORY TEST IS NOT HERE, AND THAT IS THE FIX.
 *
 * It used to assert that every flow in a 47-entry list had a matching
 * `src/tests/e2e/<flow>.e2e-spec.ts`, resolving the repository root as `../../../`.
 * That path was correct while these machines lived INSIDE the backend checkout. When they
 * were lifted out into this standalone package the relative path came with them unchanged,
 * so it now resolves to this repository -- which has no `src/tests/e2e` and never will.
 * The test therefore failed on every run since the lift, and the suite has been red since.
 *
 * Pointing it at a sibling checkout would be worse than leaving it broken: a machine that
 * reads a consumer's filesystem asserts something it cannot know, passes or fails on where
 * somebody happened to clone a repository, and silently stops checking the moment a second
 * consumer adopts the canon. The inventory is a fact about ONE backend, so it is that
 * backend's gate. It now lives in the consumer, where the 47 files actually are.
 */

test("every rule this law declares is exported under its published name", () => {
  for (const [name, rule] of Object.entries(rules)) {
    assert.ok(rule && rule.meta && rule.create, `${name} is not a rule`)
  }
})

test("E2E-3: a flow polls for a state and never waits for a duration", () => {
  tester.run("no-sleep-in-flow", noSleepInFlow, {
    valid: [
      // the shape the rule exists to push people towards
      { filename: FLOW, code: "await pollUntil(() => order.status === \"paid\", { deadlineMs: 5000 })" },
      // a unit spec is a different lane; a timer there may be the thing under test
      { filename: UNIT, code: "await sleep(50)" },
      { filename: UNIT, code: "await new Promise((resolve) => setTimeout(resolve, 10))" },
      // a name that merely contains a sleeper word is not one
      { filename: FLOW, code: "await waitForOrderPaid(order.id)" },
    ],
    invalid: [
      { filename: FLOW, code: "await sleep(500)", errors: [{ messageId: "sleep" }] },
      { filename: FLOW, code: "await delay(500)", errors: [{ messageId: "sleep" }] },
      {
        filename: FLOW,
        code: "await new Promise((resolve) => setTimeout(resolve, 500))",
        errors: [{ messageId: "timer" }],
      },
    ],
  })
})

test("E2E-7: a step asserts one outcome, so it takes no branch", () => {
  tester.run("no-branch-in-flow-step", noBranchInFlowStep, {
    valid: [
      { filename: FLOW, code: "it(\"pays\", async () => { expect(order.status).toBe(\"paid\") })" },
      // outside a step, a conditional is setup rather than a hedged assertion
      { filename: FLOW, code: "if (process.env.CI) { jest.setTimeout(60000) }" },
      // the same shape in a unit spec is ordinary code
      { filename: UNIT, code: "it(\"charges\", () => { if (x) expect(a).toBe(b) })" },
      // `&&` inside an assertion is an expression, not a hidden if
      { filename: FLOW, code: "it(\"pays\", () => { expect(a && b).toBe(true) })" },
    ],
    invalid: [
      {
        filename: FLOW,
        code: "it(\"pays\", async () => { if (order) { expect(order.status).toBe(\"paid\") } })",
        errors: [{ messageId: "branch" }],
      },
      {
        filename: FLOW,
        code: "it(\"pays\", async () => { expect(order ? order.status : \"none\").toBe(\"paid\") })",
        errors: [{ messageId: "branch" }],
      },
      {
        filename: FLOW,
        code: "it(\"pays\", async () => { order && expect(order.status).toBe(\"paid\") })",
        errors: [{ messageId: "branch" }],
      },
    ],
  })
})

test("E2E-8 (per-file half): a flow boots through the shared world, not a testing module of its own", () => {
  tester.run("no-wiring-in-flow-spec", noWiringInFlowSpec, {
    valid: [
      // the shape the law asks for: enter through the shared helper
      { filename: FLOW, code: "const world = await bootFlowWorld({ modelAnswer })" },
      { filename: FLOW, code: "const app = await createE2eApp()" },
      // `Test.createTestingModule` is legitimate where it belongs: the shared helper itself
      { filename: "/repo/src/tests/helpers/flow-world.ts", code: "await Test.createTestingModule({ imports: [] }).compile()" },
      // a unit spec building its own narrow module is a different lane and not this rule's business
      { filename: UNIT, code: "await Test.createTestingModule({ providers: [Service] }).compile()" },
    ],
    invalid: [
      {
        filename: FLOW,
        code: "const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()",
        errors: [{ messageId: "wiring" }],
      },
    ],
  })
})
