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
  e2eUsesProductionTransport,
  harnessCallsProviderDirectly,
  noCallOnlySpec,
  noModelCallInE2e,
  rules,
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

test("TESTING-3: an e2e enters through production transport", () => {
  tester.run("e2e-uses-production-transport", e2eUsesProductionTransport, {
    valid: [
      { filename: E2E, code: "await request(app.getHttpServer()).post('/graphql').send({ query })" },
      { filename: E2E, code: "socket.emit('join', { roomId })" },
      { filename: E2E, code: "await entityManager.query('select 1')" },
      { filename: UNIT, code: "await commandBus.execute(command)" },
      { filename: E2E, code: "import { CqrsModule } from '@nestjs/cqrs'" },
    ],
    invalid: [
      {
        filename: E2E,
        code: "import { CommandBus } from '@nestjs/cqrs'; await commandBus.execute(command)",
        errors: [{ messageId: "busImport" }, { messageId: "direct" }],
      },
      {
        filename: E2E,
        code: "await handler.execute(command)",
        errors: [{ messageId: "direct" }],
      },
      {
        filename: E2E,
        code: "await worker.process(job)",
        errors: [{ messageId: "direct" }],
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
