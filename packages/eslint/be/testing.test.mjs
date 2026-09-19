/**
 * Twin tests for the testing rules.
 *
 *   node --test testing.test.mjs
 *
 * Both rules judge a WHOLE FILE, so the cases that matter are the near-misses: one real assertion
 * among call assertions must clear the first rule, and one state read anywhere must clear the
 * second. A file-level rule that fires on a file doing the right thing once is a rule everybody
 * learns to disable.
 */
import assert from "node:assert/strict"
import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import {
  e2eAssertsPersistedState,
  harnessCallsProviderDirectly,
  noApiShapedE2eFilename,
  noCallOnlySpec,
  noMarkerModelStub,
  noModelCallInE2e,
  rules,
  unitTestColocated,
} from "./testing.mjs"

const tester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: "module",
  },
})

const UNIT = "D:/repo/src/features/api/core/graphql/mutations/courses/add-to-cart/add-to-cart.handler.spec.ts"
const E2E = "D:/repo/src/tests/e2e/course-enroll.e2e-spec.ts"
const SRC = "D:/repo/src/features/api/core/graphql/mutations/courses/add-to-cart/add-to-cart.handler.ts"
const HARNESS = "D:/repo/src/tests/harness/challenge-grading.harness-spec.ts"
const HARNESS_HELPER = "D:/repo/src/tests/helpers/harness-credentials.ts"

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

test("TESTING-7: backend units are colocated specs", () => {
  tester.run("unit-test-colocated", unitTestColocated, {
    valid: [
      { filename: UNIT, code: "it('x', () => expect(1).toBe(1))" },
      { filename: E2E, code: "it('x', () => expect(1).toBe(1))" },
      { filename: HARNESS, code: "it('x', () => expect(1).toBe(1))" },
    ],
    invalid: [
      { filename: UNIT.replace(".spec.ts", ".test.ts"), code: "it('x', () => expect(1).toBe(1))", errors: [{ messageId: "suffix" }] },
      { filename: "D:/repo/src/tests/unit/add-to-cart.handler.spec.ts", code: "it('x', () => expect(1).toBe(1))", errors: [{ messageId: "bucket" }] },
    ],
  })
})

test("TESTING-2: an e2e that never reads state back only proves the server replied", () => {
  tester.run("e2e-asserts-persisted-state", e2eAssertsPersistedState, {
    valid: [
      {
        filename: E2E,
        code: "it('x', async () => { const row = await entityManager.findOne(E, {}); expect(row.isEnrolled).toBe(true) })",
      },
      { filename: E2E, code: "const ds = dataSource; it('x', () => { expect(1).toBe(1) })" },
      // not an e2e - a unit spec has nothing to persist
      { filename: UNIT, code: "it('x', () => { expect(result.total).toBe(1) })" },
      { filename: SRC, code: "export const x = 1" },
    ],
    invalid: [
      {
        filename: E2E,
        code: "it('x', async () => { const res = await post(q); expect(res.status).toBe(200) })",
        errors: [{ messageId: "noState" }],
      },
      {
        filename: E2E,
        code: "it('x', async () => { expect((await post(q)).body.data.__typename).toBe('Course') })",
        errors: [{ messageId: "noState" }],
      },
    ],
  })
})

test("TESTING-9: an e2e overrides the model with Jest; only the harness reaches a provider", () => {
  tester.run("no-model-call-in-e2e", noModelCallInE2e, {
    valid: [
      // the override IS the shape - a stub in place of the model
      { filename: E2E, code: "jest.mock('@modules/ai/ask.service'); it('x', () => {})" },
      { filename: E2E, code: "import { entityManager } from './helpers'" },
      // the harness is the lane that really calls, so it is not this rule's business
      { filename: HARNESS, code: "import Anthropic from '@anthropic-ai/sdk'" },
      { filename: HARNESS, code: "import { generate } from '../helpers/models'" },
      // a unit spec is not an e2e
      { filename: UNIT, code: "import Anthropic from '@anthropic-ai/sdk'" },
      // a package whose name merely starts similarly
      { filename: E2E, code: "import x from 'openai-tokenizer-lite'" },
    ],
    invalid: [
      {
        filename: E2E,
        code: "import Anthropic from '@anthropic-ai/sdk'",
        errors: [{ messageId: "provider" }],
      },
      {
        filename: E2E,
        code: "import OpenAI from 'openai'",
        errors: [{ messageId: "provider" }],
      },
      {
        // reaching the provider through the harness helper is the same call, one hop away
        filename: E2E,
        code: "import { ModelsService } from '../helpers/models.service'",
        errors: [{ messageId: "provider" }],
      },
    ],
  })
})

test("TESTING-10: a model-quality harness calls the declared provider directly", () => {
  tester.run("harness-calls-provider-directly", harnessCallsProviderDirectly, {
    valid: [
      {
        filename: HARNESS,
        code: `
          import OpenAI from "openai"
          import { gradingPrompt } from "../../features/grading/grading-prompt.service"
          import { parseGrade } from "../../features/grading/grading-parse.service"
          const client = new OpenAI({ apiKey: process.env.HARNESS_MODEL_API_KEY })
          const result = await client.chat.completions.create({ model: "deepseek-chat", messages: gradingPrompt(input) })
          expect(parseGrade(result.choices[0].message.content)).toBeDefined()
        `,
      },
      {
        filename: HARNESS,
        code: `
          import Anthropic from "@anthropic-ai/sdk"
          const client = new Anthropic({ apiKey: process.env.HARNESS_ANTHROPIC_API_KEY })
          await client.messages.create({ model: "claude", max_tokens: 10, messages: [] })
        `,
      },
      {
        filename: E2E,
        code: `
          import { AiInvokeService } from "../../modules/ai/ai-invoke.service"
          const providers = [{ provide: AiInvokeService, useValue: { run: jest.fn() } }]
        `,
      },
      {
        filename: UNIT,
        code: `import OpenAI from "openai"; import { AiInvokeService } from "../../modules/ai/ai-invoke.service"`,
      },
      {
        filename: HARNESS_HELPER,
        code: `export const apiKey = process.env.HARNESS_MODEL_API_KEY`,
      },
    ],
    invalid: [
      {
        filename: HARNESS,
        code: `import { HarnessInvokeService } from "../helpers/harness-invoke.service"`,
        errors: [{ messageId: "helper" }, { messageId: "missingProvider" }, { messageId: "gateway" }],
      },
      {
        filename: HARNESS,
        code: `import { createHarnessInvoke } from "../helpers/harness-invoke"`,
        errors: [{ messageId: "helper" }, { messageId: "missingProvider" }, { messageId: "gateway" }],
      },
      {
        filename: HARNESS,
        code: `
          import OpenAI from "openai"
          import { AiInvokeService } from "../../modules/ai/ai-invoke.service"
          const providers = [{ provide: AiInvokeService, useValue: fake }]
        `,
        errors: [{ messageId: "gateway" }, { messageId: "gateway" }],
      },
      {
        filename: HARNESS,
        code: `
          import OpenAI from "openai"
          import { AiInvokeService } from "../../modules/ai/ai-invoke.service"
          builder.overrideProvider(AiInvokeService).useValue(fake)
        `,
        errors: [{ messageId: "gateway" }, { messageId: "gateway" }],
      },
      {
        filename: HARNESS,
        code: `import { askModel } from "../helpers/models"; await askModel("hello")`,
        errors: [{ messageId: "helper" }, { messageId: "missingProvider" }],
      },
      {
        filename: HARNESS,
        code: `import OpenAI from "openai"; const token = process.env["CLAUDE_CODE_OAUTH_TOKEN"]`,
        errors: [{ messageId: "consumerAuth" }],
      },
      {
        filename: HARNESS_HELPER,
        code: `export const tokenFile = ".secrets/claude-code-token.txt"`,
        errors: [{ messageId: "consumerAuth" }],
      },
      {
        filename: HARNESS,
        code: `type Fake = Pick<AiInvokeService, "run">`,
        errors: [{ messageId: "missingProvider" }, { messageId: "gateway" }],
      },
      {
        filename: HARNESS,
        code: `const quality = await grade(prompt)`,
        errors: [{ messageId: "missingProvider" }],
      },
    ],
  })
})

test("TESTING-1 / E2E-1: an e2e filename is the business sentence, not an API-shape noun", () => {
  tester.run("no-api-shaped-e2e-filename", noApiShapedE2eFilename, {
    valid: [
      // a business sentence
      { filename: E2E, code: "it('x', () => {})" },
      // multi-word business sentences that happen to end near an API-flavoured word but not one
      { filename: "D:/repo/src/tests/e2e/community-chat-room-authorization.e2e-spec.ts", code: "it('x', () => {})" },
      { filename: "D:/repo/src/tests/e2e/github-account-link.e2e-spec.ts", code: "it('x', () => {})" },
      // not an e2e file - this code has nothing to say about a unit spec's name
      { filename: UNIT, code: "it('x', () => {})" },
    ],
    invalid: [
      // the law's own anchor example
      {
        filename: "D:/repo/src/tests/e2e/rewards-queries.e2e-spec.ts",
        code: "it('x', () => {})",
        errors: [{ messageId: "apiShaped" }],
      },
      {
        filename: "D:/repo/src/tests/e2e/installment-plan-queries.e2e-spec.ts",
        code: "it('x', () => {})",
        errors: [{ messageId: "apiShaped" }],
      },
      {
        filename: "D:/repo/src/tests/e2e/course-resolvers.e2e-spec.ts",
        code: "it('x', () => {})",
        errors: [{ messageId: "apiShaped" }],
      },
    ],
  })
})

test("TESTING-7: a model stub returns a payload the production parser can parse, not a marker", () => {
  const WORLD_HELPER = "D:/repo/src/tests/helpers/flow-world.ts"
  tester.run("no-marker-model-stub", noMarkerModelStub, {
    valid: [
      // the real shape: JSON.stringify(...) is a CallExpression, not a bare marker Literal
      {
        filename: WORLD_HELPER,
        code: "model.run = jest.fn().mockResolvedValue({ text: JSON.stringify({ answer: 'x' }) })",
      },
      // an object literal payload with a "stub" field elsewhere is not what this rule looks at -
      // only a BARE string literal standing in for the whole argument is
      { filename: WORLD_HELPER, code: "model.run = jest.fn().mockResolvedValue({ text: answer.text, provider: 'stub' })" },
      // a real (non-marker) literal payload is a legitimate stub
      { filename: WORLD_HELPER, code: "model.run = jest.fn().mockResolvedValue('{\"answer\":1}')" },
      // not test infra - a marker string outside tests/helpers/ is not this rule's business
      { filename: UNIT, code: "x.run = jest.fn().mockResolvedValue('stubbed')" },
    ],
    invalid: [
      {
        filename: WORLD_HELPER,
        code: "model.run = jest.fn().mockResolvedValue('stubbed')",
        errors: [{ messageId: "marker" }],
      },
      {
        filename: WORLD_HELPER,
        code: "model.run = jest.fn().mockReturnValue('ok')",
        errors: [{ messageId: "marker" }],
      },
      {
        filename: WORLD_HELPER,
        code: "model.run = jest.fn().mockImplementation(() => 'test')",
        errors: [{ messageId: "marker" }],
      },
      {
        filename: WORLD_HELPER,
        code: "model.run = jest.fn().mockImplementation(() => { return 'mock' })",
        errors: [{ messageId: "marker" }],
      },
    ],
  })
})
