/**
 * Twin tests for `spec-no-skip` (R48, owner test policy 2026-09-30).
 *
 *   node --test spec-no-skip.test.mjs
 */
import assert from "node:assert/strict"
import test from "node:test"
import { at, typedTester } from "./fixtures/typed/tester.mjs"
import { rules, specNoSkip } from "./spec-no-skip.mjs"

const tester = typedTester()
const UNIT = at("src/modules/domain/order/order.service.spec.ts")
const INTEGRATION = at("src/tests/integration/order/place-order.integration-spec.ts")
const E2E = at("src/tests/e2e/checkout/place-order.e2e-spec.ts")
const CONTRACT = at("src/tests/contract/sepay/sepay.contract-spec.ts")
const HELPER = at("src/tests/world/contract.client.ts")
const WORLD_SPEC = at("src/tests/world/contract.client.spec.ts")
// the runners are the test globals: unresolved names, exactly as in a real spec
const RUNNERS = ""
const SANDBOX = "declare const sandbox: { describe(name: string, body: () => void): void }\n"

test("the law publishes spec-no-skip", () => {
    assert.deepEqual(Object.keys(rules), ["spec-no-skip"])
})

test("R48: no spec skips, focuses, marks todo or selects its runner; the contract helper's sandbox.describe stays", () => {
    tester.run("spec-no-skip", specNoSkip, {
        valid: [
            ...[UNIT, INTEGRATION, E2E, CONTRACT].map((filename) => ({ filename, code: `${RUNNERS}describe("x", () => { it("y", () => {}); it.each([1])("z", () => {}); it.concurrent("c", () => {}) })` })),
            { filename: CONTRACT, code: `${SANDBOX}sandbox.describe("sepay sandbox contract", () => { it("works", () => {}) })` },
            // the contract helper is a world file: the skip decision lives there
            { filename: HELPER, code: `${RUNNERS}export const run = (open: boolean) => (open ? describe : describe.skip)` },
            { filename: WORLD_SPEC, code: `${RUNNERS}describe.skip("world", () => {})` },
            // a local binding called it/test is not the runner
            { filename: UNIT, code: "const it = { skip: 1 }\nexport const a = it.skip" },
            // not a spec file
            { filename: at("src/modules/domain/order/order.service.ts"), code: `${RUNNERS}export const a = describe.skip` },
        ],
        invalid: [
            ...[UNIT, INTEGRATION, E2E, CONTRACT].map((filename) => ({ filename, code: `${RUNNERS}it.skip("y", () => {})`, errors: [{ messageId: "skip" }] })),
            { filename: UNIT, code: `${RUNNERS}describe.skip("x", () => {})`, errors: [{ messageId: "skip" }] },
            { filename: UNIT, code: `${RUNNERS}test.skip("x", () => {})`, errors: [{ messageId: "skip" }] },
            { filename: UNIT, code: `${RUNNERS}it.todo("x")`, errors: [{ messageId: "skip" }] },
            { filename: UNIT, code: `${RUNNERS}it.only("x", () => {})`, errors: [{ messageId: "skip" }] },
            { filename: INTEGRATION, code: `${RUNNERS}it["skip"]("x", () => {})`, errors: [{ messageId: "skip" }] },
            { filename: UNIT, code: `${RUNNERS}declare const skipIf: boolean\nit.skipIf(skipIf)("x", () => {})`, errors: [{ messageId: "skip" }] },
            { filename: E2E, code: "xit('x', () => {})", errors: [{ messageId: "skip" }] },
            { filename: E2E, code: "xdescribe('x', () => {})", errors: [{ messageId: "skip" }] },
            { filename: E2E, code: "xtest('x', () => {})", errors: [{ messageId: "skip" }] },
            { filename: CONTRACT, code: `${RUNNERS}declare const on: boolean\n;(on ? describe : describe.skip)("x", () => {})`, errors: [{ messageId: "select" }, { messageId: "skip" }] },
            { filename: CONTRACT, code: `${RUNNERS}declare const on: boolean\nconst run = on ? describe : it\nrun("x", () => {})`, errors: [{ messageId: "select" }, { messageId: "select" }] },
            { filename: UNIT, code: `${RUNNERS}const run = describe\nrun("x", () => {})`, errors: [{ messageId: "select" }] },
            { filename: UNIT, code: `${RUNNERS}declare const mode: "skip"\nit[mode]("x", () => {})`, errors: [{ messageId: "select" }] },
            { filename: UNIT, code: `import { describe } from "@jest/globals"\ndescribe.skip("x", () => {})`, errors: [{ messageId: "skip" }] },
        ],
    })
})
