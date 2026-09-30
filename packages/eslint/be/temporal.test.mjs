import test from "node:test"
import { at, typedTester } from "./fixtures/typed/tester.mjs"
import { noAmbientClock } from "./temporal.mjs"

const tester = typedTester()
const CLOCK = at("src/modules/platform/clock/system-clock.service.ts")
const CLOCK_SPEC = at("src/modules/platform/clock/system-clock.service.spec.ts")
const SERVICE = at("src/modules/domain/order/order.service.ts")
const SPEC = at("src/modules/domain/order/order.service.spec.ts")
const LOOKALIKE = at("src/modules/platform/clockwork/clock.service.ts")

test("every ambient clock reference is refused outside platform/clock, in specs too", () => {
    tester.run("no-ambient-clock", noAmbientClock, {
        valid: [
            // the one owner that reads the wall clock, asked of the slot view
            { filename: CLOCK, code: "export const now = () => Date.now()" },
            { filename: CLOCK, code: "export const now = () => new Date()" },
            { filename: CLOCK, code: "export const mark = () => performance.now()" },
            { filename: CLOCK, code: "export const stamp = () => process.hrtime.bigint()" },
            { filename: CLOCK_SPEC, code: "const before = Date.now()" },
            // the test world is the composition root: readiness deadlines and fake servers read real time
            { filename: at("src/tests/world/kit/poll.ts"), code: "const deadline = Date.now() + 5000" },
            { filename: at("src/tests/world/fakes/smtp/server.ts"), code: "const at = new Date(); const t = performance.now()" },
            // a value the caller already holds is not an ambient read
            { filename: SERVICE, code: "const at = new Date(record.createdAt)" },
            { filename: SERVICE, code: "const at = new Date(0)" },
            { filename: SERVICE, code: "const at = clock.now()" },
            // a local of the same name is not the global
            { filename: SERVICE, code: "const performance = { now: () => 1 }\nconst t = performance.now()" },
            { filename: SERVICE, code: "const run = (Date: { now(): number }) => Date.now()" },
            // Date members that are not clocks
            { filename: SERVICE, code: "const parsed = Date.parse(text)\nconst utc = Date.UTC(2026, 0, 1)" },
            { filename: SERVICE, code: "const mark = performance.mark('a')" },
        ],
        invalid: [
            { filename: SERVICE, code: "const t = Date.now()", errors: [{ messageId: "now" }] },
            { filename: SERVICE, code: "const at = new Date()", errors: [{ messageId: "date" }] },
            { filename: SERVICE, code: "const at = new Date", errors: [{ messageId: "date" }] },
            { filename: SERVICE, code: "const text = Date()", errors: [{ messageId: "date" }] },
            { filename: SERVICE, code: "const t = performance.now()", errors: [{ messageId: "now" }] },
            { filename: SERVICE, code: "const t = process.hrtime()", errors: [{ messageId: "now" }] },
            { filename: SERVICE, code: "const t = process.hrtime.bigint()", errors: [{ messageId: "now" }] },
            { filename: SERVICE, code: "const at = Temporal.Now.instant()", errors: [{ messageId: "now" }] },
            // a reference is enough: no call
            { filename: SERVICE, code: "const read = Date.now", errors: [{ messageId: "now" }] },
            { filename: SERVICE, code: "const { now } = Date", errors: [{ messageId: "now" }] },
            { filename: SERVICE, code: "const { now: read } = performance", errors: [{ messageId: "now" }] },
            { filename: SERVICE, code: "const injected = { clock: Date.now }", errors: [{ messageId: "now" }] },
            // computed and globalThis spellings
            { filename: SERVICE, code: "const t = Date['now']()", errors: [{ messageId: "now" }] },
            { filename: SERVICE, code: "const t = globalThis.Date.now()", errors: [{ messageId: "now" }] },
            { filename: SERVICE, code: "const at = new globalThis.Date()", errors: [{ messageId: "date" }] },
            // an imported reader is the same ambient object
            { filename: SERVICE, code: "import { performance } from 'node:perf_hooks'\nconst t = performance.now()", errors: [{ messageId: "now" }] },
            { filename: SERVICE, code: "import { hrtime } from 'node:process'\nexport const t = 1", errors: [{ messageId: "now" }] },
            // specs get the same law: they build a FakeClock
            { filename: SPEC, code: "const t = Date.now()", errors: [{ messageId: "now" }] },
            { filename: SPEC, code: "const at = new Date()", errors: [{ messageId: "date" }] },
            // apps, tests and lookalike owners are not platform/clock
            { filename: at("apps/api/src/main.ts"), code: "const t = Date.now()", errors: [{ messageId: "now" }] },
            { filename: at("src/tests/e2e/order/place.e2e-spec.ts"), code: "const t = Date.now()", errors: [{ messageId: "now" }] },
            { filename: at("src/tests/integration/plan/claim.integration-spec.ts"), code: "const t = Date.now()", errors: [{ messageId: "now" }] },
            { filename: at("src/tests/fixtures/plan.builder.ts"), code: "const t = Date.now()", errors: [{ messageId: "now" }] },
            { filename: LOOKALIKE, code: "const t = Date.now()", errors: [{ messageId: "now" }] },
        ],
    })
})
