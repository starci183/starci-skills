// proves: BE_AMBIENT_CLOCK@lite
// proves: BE_AMBIENT_CLOCK@full
import assert from "node:assert/strict"
import test from "node:test"
import { BE_DECLARATION, TYPED_ROOT, at, ruleTester } from "./fixtures/typed/tester.mjs"
import { appDeclaration } from "./fixtures/app.mjs"
import { hfsFromDeclaration } from "./lib/hfs.mjs"
import { noAmbientClock } from "./temporal.mjs"

const SERVICE = at("src/modules/domain/order/order.service.ts")
const SPEC = at("src/modules/domain/order/order.service.spec.ts")
const CLOCK = at("src/modules/platform/clock/system-clock.service.ts")

for (const edition of ["lite", "full"]) {
    test(`R79 valid injected clock and invalid ambient time in ${edition}`, () => {
        const hfs = hfsFromDeclaration({ ...appDeclaration("be", BE_DECLARATION), edition }, TYPED_ROOT)
        assert.equal(hfs.edition, edition)
        ruleTester({ root: TYPED_ROOT, hfs }).run("no-ambient-clock", noAmbientClock, {
            valid: [
                { filename: SERVICE, code: "declare const clock: { now(): number }; const createdAt = new Date(clock.now())" },
                { filename: SPEC, code: "import { FakeClock } from '@starci/jest-preset'; const clock = new FakeClock(0); const createdAt = new Date(clock.now())" },
                { filename: CLOCK, code: "export const readTime = () => Date.now()" },
            ],
            invalid: [
                { filename: SERVICE, code: "const createdAt = Date.now()", errors: [{ messageId: "now" }] },
                { filename: SERVICE, code: "const createdAt = new Date()", errors: [{ messageId: "date" }] },
                { filename: SERVICE, code: "const elapsed = performance.now()", errors: [{ messageId: "now" }] },
                { filename: SERVICE, code: "const elapsed = process.hrtime.bigint()", errors: [{ messageId: "now" }] },
                { filename: SERVICE, code: "const createdAt = Temporal.Now.instant()", errors: [{ messageId: "now" }] },
                { filename: SPEC, code: "const readTime = Date.now", errors: [{ messageId: "now" }] },
            ],
        })
    })
}
