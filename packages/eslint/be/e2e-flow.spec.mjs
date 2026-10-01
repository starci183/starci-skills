/**
 * Twin tests for the e2e-flow rules.
 *
 *   node --test e2e-flow.spec.mjs
 *
 * The valid cases carry most of the weight. Every rule fires only inside `*.e2e-spec.ts`, and a version that widened
 * to every spec would refuse the ordinary unit test, where a sleep is sometimes the thing under test and a
 * conditional is just code. Receivers are identified by type: a renamed bus or handler is still caught, and a lookalike
 * name is not.
 */
import assert from "node:assert/strict"
import test from "node:test"
import { at, typedTester } from "./fixtures/typed/tester.mjs"
import {
  e2eUsesProductionTransport,
  noBranchInFlowStep,
  noSleepInFlow,
  noWiringInFlowSpec,
  rules,
} from "./e2e-flow.mjs"

const tester = typedTester()

const FLOW = at("src/tests/e2e/checkout/course-purchase.e2e-spec.ts")
const UNIT = at("src/modules/domain/billing/charge.spec.ts")
const WORLD = `import { useTestWorld } from "../../world/test-world.contracts"
const world = useTestWorld()
`

test("every rule this law declares is exported under its published name", () => {
  for (const [name, rule] of Object.entries(rules)) {
    assert.ok(rule && rule.meta && rule.create, `${name} is not a rule`)
  }
})

test("operational E2E preserves the production transport boundary", () => {
  const HANDLER = "import { StartCheckoutHandler } from '../../../features/checkout/application/start-checkout.handler'\n"
  tester.run("e2e-uses-production-transport", e2eUsesProductionTransport, {
    valid: [
      { filename: FLOW, code: "declare const request: (app: object) => { post(path: string): { send(body: object): Promise<void> } }\ndeclare const app: object\nawait request(app).post('/graphql').send({})" },
      // a lookalike name is not a bus: the receiver's type decides
      { filename: FLOW, code: "declare const commandBus: { execute(input: object): void }\ncommandBus.execute({})" },
      { filename: FLOW, code: "declare const checkoutWorker: { finalize(job: object): void }\ncheckoutWorker.finalize({})" },
      // a unit spec may call its subject
      { filename: UNIT, code: HANDLER + "declare const handler: StartCheckoutHandler\nawait handler.handle()" },
    ],
    invalid: [
      {
        filename: FLOW,
        code: "import { CommandBus } from '@nestjs/cqrs'\ndeclare const bus: CommandBus\nawait bus.execute({})",
        errors: [{ messageId: "busImport" }, { messageId: "direct" }],
      },
      // a renamed receiver is still the bus
      {
        filename: FLOW,
        code: "import { QueryBus } from '@nestjs/cqrs'\ndeclare const unrelated: QueryBus\nawait unrelated.execute({})",
        errors: [{ messageId: "busImport" }, { messageId: "direct" }],
      },
      {
        filename: FLOW,
        code: HANDLER + "declare const anything: StartCheckoutHandler\nawait anything.handle()",
        errors: [{ messageId: "actor" }],
      },
    ],
  })
})

test("E2E-3: a flow polls for a state and never waits for a duration", () => {
  const SLEEP = "declare const sleep: (ms: number) => Promise<void>\n"
  tester.run("no-sleep-in-flow", noSleepInFlow, {
    valid: [
      // the shape the rule exists to push people towards
      { filename: FLOW, code: "declare const waitFor: (probe: () => boolean, options: { timeoutMs: number }) => Promise<void>\nawait waitFor(() => true, { timeoutMs: 5000 })" },
      // a unit spec is a different lane; a timer there may be the thing under test
      { filename: UNIT, code: SLEEP + "await sleep(50)" },
      { filename: UNIT, code: "await new Promise((resolve) => setTimeout(resolve, 10))" },
      // a name that merely contains a sleeper word is not one: it takes no duration
      { filename: FLOW, code: "declare const waitForOrderPaid: (id: string) => Promise<void>\nawait waitForOrderPaid('o1')" },
      // a number argument on a call that does not return Promise<void> is not a wait
      { filename: FLOW, code: "declare const jest: { advanceTimersByTime(ms: number): void }\njest.advanceTimersByTime(500)" },
      // a local function that shadows the timer name is not the timer
      { filename: FLOW, code: "const setTimeout = (fn: () => void) => fn()\nsetTimeout(() => undefined)" },
    ],
    invalid: [
      // any name: the call takes one number and returns Promise<void>
      { filename: FLOW, code: SLEEP + "await sleep(500)", errors: [{ messageId: "sleep" }] },
      { filename: FLOW, code: "declare const settle: (ms: number) => Promise<void>\nawait settle(500)", errors: [{ messageId: "sleep" }] },
      { filename: FLOW, code: "await new Promise((resolve) => setTimeout(resolve, 500))", errors: [{ messageId: "timer" }] },
      { filename: FLOW, code: "import { setTimeout as pause } from 'node:timers/promises'\nawait pause(500)", errors: [{ messageId: "sleep" }] },
      { filename: FLOW, code: "setTimeout(() => undefined, 10)", errors: [{ messageId: "sleep" }] },
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
      // the probe of the world's waitFor is a polling predicate, not a step: it fails at the deadline instead of passing
      {
        filename: FLOW,
        code: WORLD + "it(\"pays\", async () => { const row = await world.waitFor(\"paid\", async () => { const rows = [1]; return rows.length > 0 ? rows : null }); expect(row).toHaveLength(1) })",
      },
      {
        filename: FLOW,
        code: WORLD + "it(\"pays\", async () => { await world.waitFor(\"paid\", async () => { if (world) return 1; return null }) })",
      },
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
      // a branch in the step beside the probe is still a branch in a step
      {
        filename: FLOW,
        code: WORLD + "it(\"pays\", async () => { await world.waitFor(\"paid\", async () => 1); if (world) { expect(1).toBe(1) } })",
        errors: [{ messageId: "branch" }],
      },
      // a waitFor of another type is no probe: the receiver's type decides, not its name
      {
        filename: FLOW,
        code: "declare const world: { waitFor(label: string, check: () => Promise<number | null>): Promise<number> }; it(\"pays\", async () => { await world.waitFor(\"paid\", async () => (world ? 1 : null)) })",
        errors: [{ messageId: "branch" }],
      },
    ],
  })
})

test("E2E-8 (per-file half): a flow boots through the shared setup, not a testing module of its own", () => {
  tester.run("no-wiring-in-flow-spec", noWiringInFlowSpec, {
    valid: [
      // the shape the law asks for: enter through the shared setup
      { filename: FLOW, code: "declare const bootWorld: () => Promise<object>\nconst world = await bootWorld()" },
      // `Test.createTestingModule` is legitimate where it belongs: the setup itself
      { filename: at("src/tests/e2e/setup/world.ts"), code: "import { Test } from '@nestjs/testing'\nawait Test.createTestingModule({ imports: [] }).compile()" },
      // a unit spec building its own narrow module is a different lane
      { filename: UNIT, code: "import { Test } from '@nestjs/testing'\nawait Test.createTestingModule({ providers: [] }).compile()" },
      // a lookalike `Test` that is not the Nest one
      { filename: FLOW, code: "declare const Test: { createTestingModule(options: object): void }\nTest.createTestingModule({})" },
    ],
    invalid: [
      {
        filename: FLOW,
        code: "import { Test } from '@nestjs/testing'\nconst moduleRef = await Test.createTestingModule({ imports: [] }).compile()",
        errors: [{ messageId: "wiring" }],
      },
      {
        filename: FLOW,
        code: "import { Test as Builder } from '@nestjs/testing'\nawait Builder.createTestingModule({ imports: [] }).compile()",
        errors: [{ messageId: "wiring" }],
      },
    ],
  })
})
