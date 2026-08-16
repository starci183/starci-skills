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
import { existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import {
  e2eAssertsPersistedState,
  e2eUsesProductionTransport,
  noBranchInFlowStep,
  noModelCallInE2e,
  noSleepInFlow,
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

test("operational E2E preserves transport, consequence and provider boundaries", () => {
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
  tester.run("e2e-asserts-persisted-state", e2eAssertsPersistedState, {
    valid: [{ filename: FLOW, code: "await entityManager.findOne(Entity, {})" }],
    invalid: [{ filename: FLOW, code: "expect(response.status).toBe(200)", errors: [{ messageId: "state" }] }],
  })
  tester.run("no-model-call-in-e2e", noModelCallInE2e, {
    valid: [{ filename: FLOW, code: "jest.mock('@modules/ai/provider')" }],
    invalid: [{ filename: FLOW, code: "import OpenAI from 'openai'", errors: [{ messageId: "provider" }] }],
  })
})

/** The shipped business inventory; absence is a broken lane, not a skip. */
const CANONICAL_FLOWS = [
  "course-purchase",
  "course-refund",
  "course-trial",
  "installment-payment",
  "installment-default",
  "membership-purchase",
  "ai-subscription-purchase",
  "payment-idempotency",
  "payment-reconciliation",
  "signup-and-signin",
  "password-reset",
  "two-factor-lifecycle",
  "session-lifecycle",
  "github-account-link",
  "social-oauth-login",
  "profile-publication",
  "profile-portfolio",
  "course-discovery",
  "content-progress",
  "content-discussion",
  "content-ai-session",
  "challenge-submission",
  "coding-submission",
  "flashcard-review-session",
  "flashcard-quiz-session",
  "flashcard-due-review-session",
  "mock-interview",
  "cv-build",
  "personal-project-review",
  "personal-project-team-request",
  "playground-session",
  "rag-playground",
  "global-learning-search",
  "daily-quest",
  "weekly-challenge",
  "kpi-reward",
  "rewards-redeem",
  "streak-freeze",
  "achievement-unlock",
  "league-season",
  "notification-delivery",
  "community-thread",
  "follow-network",
  "community-chat",
  "job-posting",
  "job-application",
  "talent-discovery",
]

test("the canonical business inventory contains every executable flow suite", () => {
  const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url))
  const missing = CANONICAL_FLOWS.filter((flow) => !existsSync(
    `${repositoryRoot}/src/tests/e2e/${flow}.e2e-spec.ts`,
  ))
  assert.deepEqual(missing, [])
})

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
