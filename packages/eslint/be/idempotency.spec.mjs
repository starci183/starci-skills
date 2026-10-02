import test from "node:test"
import { at, typedTester } from "./fixtures/typed/tester.mjs"
import { inboxDedupeRequired } from "./idempotency.mjs"

const tester = typedTester()
const SERVICE = at("src/modules/domain/order/billing.service.ts")
const BUS = at("src/modules/platform/event-bus/event-bus.service.ts")
const CONSUMER = at("src/features/checkout/transport/message/payment-captured.consumer.ts")
const SPEC = at("src/modules/domain/order/billing.service.spec.ts")
const PRELUDE = [
    'import type { Inbox } from "@modules/platform/inbox/inbox.port"',
    'import type { Inbox as Lookalike } from "@modules/domain/order/lookalike.service"',
    "interface Delivery { eventId: string; amount: number }",
].join("\n")
const withPrelude = (body) => `${PRELUDE}\n${body}`

test("a service method that takes a delivery claims the event on the Inbox port first and returns on false", () => {
    tester.run("inbox-dedupe-required", inboxDedupeRequired, {
        valid: [
            // the event bus publishes an event (its shape carries an eventId); it receives no delivery
            {
                name: "event bus publishes", filename: BUS,
                code: withPrelude("class C { async publish(event: Delivery) { await this.send(event) }\n private async send(e: Delivery) { return e } }"),
            },
            // the claim as the negated test of an early return
            {
                name: "case 1", filename: SERVICE,
                code: withPrelude("class C { constructor(private readonly inbox: Inbox) {}\n async handle(m: Delivery) { if (!(await this.inbox.claim('billing', m.eventId))) return\n await this.work() }\n private async work() { await this.inbox.claim('x', 'y') } }"),
            },
            // the claim stored, then refused on the next statement; the receiver's name is irrelevant
            {
                name: "case 2", filename: SERVICE,
                code: withPrelude("class C { constructor(private readonly seen: Inbox) {}\n async handle(m: Delivery) { const fresh = await this.seen.claim('billing', m.eventId)\n if (!fresh) { return }\n await this.work() }\n private async work() {} }"),
            },
            // compared to false, in a block that logs then returns
            {
                name: "case 3", filename: SERVICE,
                code: withPrelude("class C { constructor(private readonly inbox: Inbox) {}\n async handle(m: Delivery) { if ((await this.inbox.claim('billing', m.eventId)) === false) { console.log('dup'); return }\n await this.work() }\n private async work() {} }"),
            },
            // a claim that also takes the transaction manager
            {
                name: "case 4", filename: SERVICE,
                code: withPrelude("class C { constructor(private readonly inbox: Inbox) {}\n async handle(m: Delivery, manager: object) { if (!(await this.inbox.claim('billing', m.eventId, manager))) return\n await this.work() }\n private async work() {} }"),
            },
            // a method whose first parameter has no eventId is not a delivery
            { name: "case 5", filename: SERVICE, code: withPrelude("class C { async total(input: { amount: number }) { await this.work() }\n private async work() {} }") },
            // the delivery must be the FIRST parameter
            { name: "case 6", filename: SERVICE, code: withPrelude("class C { async total(scale: number, m: Delivery) { await this.work() }\n private async work() {} }") },
            // private and protected helpers of a service are not entry points
            { name: "case 7", filename: SERVICE, code: withPrelude("class C { private async apply(m: Delivery) { await this.work() }\n protected async step(m: Delivery) { await this.work() }\n private async work() {} }") },
            // doors are judged by transport-is-thin, not here
            { name: "case 8", filename: CONSUMER, code: withPrelude("class C { async handle(m: Delivery) { await this.work() }\n private async work() {} }") },
            // a spec is not a service
            { name: "case 9", filename: SPEC, code: withPrelude("class C { async handle(m: Delivery) { await this.work() }\n private async work() {} }") },
        ],
        invalid: [
            // no claim at all
            { name: "case 10", filename: SERVICE, code: withPrelude("class C { async handle(m: Delivery) { await this.work() }\n private async work() {} }"), errors: [{ messageId: "noClaim" }] },
            // a method that never awaits
            { name: "case 11", filename: SERVICE, code: withPrelude("class C { handle(m: Delivery) { this.work() }\n private work() {} }"), errors: [{ messageId: "noClaim" }] },
            // keyword-only: the words inbox and claim appear, the type is not the port
            {
                name: "case 12", filename: SERVICE,
                code: withPrelude("class C { constructor(private readonly inbox: Lookalike) {}\n async handle(m: Delivery) { if (!(await this.inbox.claim('billing', m.eventId))) return\n await this.work() }\n private async work() {} }"),
                errors: [{ messageId: "noClaim" }],
            },
            // a claim exists but not as the first awaited expression
            {
                name: "case 13", filename: SERVICE,
                code: withPrelude("class C { constructor(private readonly inbox: Inbox) {}\n async handle(m: Delivery) { await this.work()\n if (!(await this.inbox.claim('billing', m.eventId))) return }\n private async work() {} }"),
                errors: [{ messageId: "noClaim" }],
            },
            // the claim is awaited and ignored
            {
                name: "case 14", filename: SERVICE,
                code: withPrelude("class C { constructor(private readonly inbox: Inbox) {}\n async handle(m: Delivery) { await this.inbox.claim('billing', m.eventId)\n await this.work() }\n private async work() {} }"),
                errors: [{ messageId: "noEarlyReturn" }],
            },
            // the answer is tested but the branch does not return
            {
                name: "case 15", filename: SERVICE,
                code: withPrelude("class C { constructor(private readonly inbox: Inbox) {}\n async handle(m: Delivery) { const fresh = await this.inbox.claim('billing', m.eventId)\n if (!fresh) { console.log('dup') }\n await this.work() }\n private async work() {} }"),
                errors: [{ messageId: "noEarlyReturn" }],
            },
            // a claim with the wrong arity is not `claim(source, eventId)`
            {
                name: "case 16", filename: SERVICE,
                code: withPrelude("class C { constructor(private readonly inbox: Inbox) {}\n async handle(m: Delivery) { if (!(await this.inbox.claim(m.eventId))) return }\n }"),
                errors: [{ messageId: "noClaim" }],
            },
            // a delivery typed as a union, a destructured parameter and a default all still carry eventId
            { name: "case 17", filename: SERVICE, code: withPrelude("class C { async handle(m: Delivery | undefined) { await this.work() }\n private async work() {} }"), errors: [{ messageId: "noClaim" }] },
            { name: "case 18", filename: SERVICE, code: withPrelude("class C { async handle({ eventId }: Delivery) { await this.work() }\n private async work() {} }"), errors: [{ messageId: "noClaim" }] },
        ],
    })
})
