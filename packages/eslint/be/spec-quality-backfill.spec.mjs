// proves: BE_SPEC_QUALITY@lite
// proves: BE_SPEC_QUALITY@full
import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import { appDeclaration } from "./fixtures/app.mjs"
import { BE_DECLARATION, TYPED_ROOT, at, typedTester } from "./fixtures/typed/tester.mjs"
import { hfsFromDeclaration } from "./lib/hfs.mjs"
import { specNoSourceRead } from "./spec-quality.mjs"
import {
    e2eUsesProductionTransport,
    noBranchInFlowStep,
    noSleepInFlow,
    noWiringInFlowSpec,
} from "./e2e-flow.mjs"
import {
    e2eAssertsPersistedState,
    noApiShapedE2eFilename,
    noCallOnlySpec,
    noMarkerModelStub,
    noModelCallInE2e,
} from "./testing.mjs"

const tester = new RuleTester({
    languageOptions: { parser: tsParser, ecmaVersion: 2022, sourceType: "module" },
})
const typed = typedTester()
const UNIT = at("src/modules/domain/order/order.service.spec.ts")
const FLOW = at("src/tests/e2e/checkout/course-purchase.e2e-spec.ts")
const MODEL = at("src/tests/fixtures/model.ts")

for (const edition of ["lite", "full"]) {
    const hfs = hfsFromDeclaration({ ...appDeclaration("be", BE_DECLARATION), edition }, TYPED_ROOT)
    const settings = { starci: { hfs } }

    test(`R48 ${edition} accepts behavioral file reads and rejects source-reading specs`, () => {
        tester.run("spec-no-source-read", specNoSourceRead, {
            valid: [{
                filename: UNIT,
                settings,
                code: "import { readFileSync } from 'node:fs'\nexpect(readFileSync(join(outputDir, 'receipt.json'), 'utf8')).toBe('saved')",
            }],
            invalid: [{
                filename: UNIT,
                settings,
                code: "import { readFileSync } from 'node:fs'\nexpect(readFileSync('src/modules/domain/order/order.service.ts', 'utf8')).toContain('save')",
                errors: [{ messageId: "read" }],
            }],
        })
    })

    test(`R48 ${edition} accepts production transport and rejects an internal dispatcher`, () => {
        typed.run("e2e-uses-production-transport", e2eUsesProductionTransport, {
            valid: [{
                filename: FLOW,
                settings,
                code: "declare const request: (app: object) => { post(path: string): { send(body: object): Promise<void> } }\ndeclare const app: object\nawait request(app).post('/graphql').send({})",
            }],
            invalid: [{
                filename: FLOW,
                settings,
                code: "import { CommandBus } from '@nestjs/cqrs'\ndeclare const bus: CommandBus\nawait bus.execute({})",
                errors: [{ messageId: "busImport" }, { messageId: "direct" }],
            }],
        })
    })

    test(`R48 ${edition} accepts one asserted flow outcome and rejects a conditional step`, () => {
        typed.run("no-branch-in-flow-step", noBranchInFlowStep, {
            valid: [{
                filename: FLOW,
                settings,
                code: "it('pays', () => { expect(order.status).toBe('paid') })",
            }],
            invalid: [{
                filename: FLOW,
                settings,
                code: "it('pays', () => { if (order) { expect(order.status).toBe('paid') } })",
                errors: [{ messageId: "branch" }],
            }],
        })
    })

    test(`R48 ${edition} accepts polling for state and rejects sleeping for a duration`, () => {
        typed.run("no-sleep-in-flow", noSleepInFlow, {
            valid: [{
                filename: FLOW,
                settings,
                code: "declare const waitFor: (probe: () => boolean, options: { timeoutMs: number }) => Promise<void>\ndeclare const order: { status: string }\nawait waitFor(() => order.status === 'paid', { timeoutMs: 5000 })",
            }],
            invalid: [{
                filename: FLOW,
                settings,
                code: "declare const sleep: (ms: number) => Promise<void>\nawait sleep(500)",
                errors: [{ messageId: "sleep" }],
            }],
        })
    })

    test(`R48 ${edition} accepts shared world boot and rejects wiring inside a flow`, () => {
        tester.run("no-wiring-in-flow-spec", noWiringInFlowSpec, {
            valid: [{
                filename: FLOW,
                settings,
                code: "import { useTestWorld } from '../../world/use-test-world'\nconst world = useTestWorld()",
            }],
            invalid: [{
                filename: FLOW,
                settings,
                code: "import { Test } from '@nestjs/testing'\nconst moduleRef = await Test.createTestingModule({ imports: [] }).compile()",
                errors: [{ messageId: "wiring" }],
            }],
        })
    })

    test(`R48 ${edition} accepts a persisted-state assertion and rejects response-only evidence`, () => {
        typed.run("e2e-asserts-persisted-state", e2eAssertsPersistedState, {
            valid: [{
                filename: FLOW,
                settings,
                code: "import { EntityManager } from 'typeorm'\ndeclare const store: EntityManager\nit('records payment', async () => { expect(await store.query('select paid from payments')).toEqual([{ paid: true }]) })",
            }],
            invalid: [{
                filename: FLOW,
                settings,
                code: "it('records payment', () => { expect(response.status).toBe(200) })",
                errors: [{ messageId: "noState" }],
            }],
        })
    })

    test(`R48 ${edition} accepts a business-flow filename and rejects an API-shaped filename`, () => {
        tester.run("no-api-shaped-e2e-filename", noApiShapedE2eFilename, {
            valid: [{ filename: FLOW, settings, code: "it('records payment', () => { expect(payment.status).toBe('paid') })" }],
            invalid: [{
                filename: at("src/tests/e2e/checkout/checkout-queries.e2e-spec.ts"),
                settings,
                code: "it('records payment', () => { expect(payment.status).toBe('paid') })",
                errors: [{ messageId: "apiShaped" }],
            }],
        })
    })

    test(`R48 ${edition} accepts a result assertion and rejects a call-only spec`, () => {
        tester.run("no-call-only-spec", noCallOnlySpec, {
            valid: [{
                filename: UNIT,
                settings,
                code: "it('charges the order', () => { expect(result.total).toBe(5000); expect(payments.charge).toHaveBeenCalledWith(5000) })",
            }],
            invalid: [{
                filename: UNIT,
                settings,
                code: "it('charges the order', () => { expect(payments.charge).toHaveBeenCalledWith(5000) })",
                errors: [{ messageId: "callOnly" }],
            }],
        })
    })

    test(`R48 ${edition} accepts a parseable model payload and rejects a marker stub`, () => {
        tester.run("no-marker-model-stub", noMarkerModelStub, {
            valid: [{
                filename: MODEL,
                settings,
                code: "model.run = jest.fn().mockResolvedValue({ text: JSON.stringify({ answer: 'approved' }) })",
            }],
            invalid: [{
                filename: MODEL,
                settings,
                code: "model.run = jest.fn().mockResolvedValue('stubbed')",
                errors: [{ messageId: "marker" }],
            }],
        })
    })

    test(`R48 ${edition} accepts the world model fake and rejects a provider in an e2e`, () => {
        tester.run("no-model-call-in-e2e", noModelCallInE2e, {
            valid: [{ filename: FLOW, settings, code: "import { useTestWorld } from '../../world/use-test-world'\nconst world = useTestWorld()" }],
            invalid: [{
                filename: FLOW,
                settings,
                code: "import Anthropic from '@anthropic-ai/sdk'",
                errors: [{ messageId: "provider" }],
            }],
        })
    })
}
