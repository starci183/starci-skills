import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import { noAmbientClock } from "./temporal.mjs"

const tester = new RuleTester({
    languageOptions: { parser: tsParser, ecmaVersion: 2022, sourceType: "module" },
})
const CLOCK = "D:/repo/src/modules/platform/clock/clock.service.ts"
const SERVICE = "D:/repo/src/modules/domain/plan/plan.service.ts"

test("Date.now, a bare new Date and performance.now are read only inside platform/clock", () => {
    tester.run("no-ambient-clock", noAmbientClock, {
        valid: [
            { filename: CLOCK, code: "export const now = () => Date.now()" },
            { filename: CLOCK, code: "export const now = () => new Date()" },
            { filename: CLOCK, code: "export const mark = () => performance.now()" },
            // a value the caller already holds is not an ambient read
            { filename: SERVICE, code: "const at = new Date(record.createdAt)" },
            { filename: SERVICE, code: "const at = new Date(0)" },
            { filename: SERVICE, code: "const at = clock.now()" },
            // a spec drives time itself
            { filename: "D:/repo/src/modules/domain/plan/plan.service.spec.ts", code: "const t = Date.now()" },
        ],
        invalid: [
            { filename: SERVICE, code: "const t = Date.now()", errors: [{ messageId: "now" }] },
            { filename: SERVICE, code: "const at = new Date()", errors: [{ messageId: "date" }] },
            { filename: SERVICE, code: "const t = performance.now()", errors: [{ messageId: "now" }] },
            { filename: "D:/repo/apps/api/src/main.ts", code: "const t = Date.now()", errors: [{ messageId: "now" }] },
        ],
    })
})
