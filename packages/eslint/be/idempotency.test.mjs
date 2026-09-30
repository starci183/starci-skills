import test from "node:test"
import { at, typedTester } from "./fixtures/typed/tester.mjs"
import { inboxDedupeRequired } from "./idempotency.mjs"

const tester = typedTester()
const CONSUMER = at("src/features/checkout/transport/message/payment-captured.consumer.ts")
const WEBHOOK = at("src/features/checkout/transport/http/payment.controller.ts")
const PLAIN_CONTROLLER = at("src/features/checkout/transport/http/plan.controller.ts")
const SPEC = at("src/features/checkout/transport/message/payment-captured.consumer.spec.ts")
const PRELUDE = [
    'import type { Inbox } from "@modules/platform/inbox/inbox.port"',
    'import type { Inbox as Lookalike } from "@modules/domain/order/lookalike.service"',
    'import { Public, PublicReason } from "@modules/domain/identity/identity.decorators"',
].join("\n")
const withPrelude = (body) => `${PRELUDE}\n${body}`

test("a consumer or SignedWebhook handler claims the event on the Inbox port first and returns on false", () => {
    tester.run("inbox-dedupe-required", inboxDedupeRequired, {
        valid: [
            // the claim as the negated test of an early return
            {
                name: "case 1", filename: CONSUMER,
                code: withPrelude("class C { constructor(private readonly inbox: Inbox) {}\n async handle(m: { id: string }) { if (!(await this.inbox.claim('billing', m.id))) return\n await this.work() }\n private async work() { await this.inbox.claim('x', 'y') } }"),
            },
            // the claim stored, then refused on the next statement; the receiver's name is irrelevant
            {
                name: "case 2", filename: CONSUMER,
                code: withPrelude("class C { constructor(private readonly seen: Inbox) {}\n async handle(m: { id: string }) { const fresh = await this.seen.claim('billing', m.id)\n if (!fresh) { return }\n await this.work() }\n private async work() {} }"),
            },
            // compared to false, in a block that logs then returns
            {
                name: "case 3", filename: CONSUMER,
                code: withPrelude("class C { constructor(private readonly inbox: Inbox) {}\n async handle(m: { id: string }) { if ((await this.inbox.claim('billing', m.id)) === false) { console.log('dup'); return }\n await this.work() }\n private async work() {} }"),
            },
            // a SignedWebhook handler that claims first
            {
                name: "case 4", filename: WEBHOOK,
                code: withPrelude("class C { constructor(private readonly inbox: Inbox) {}\n @Public({ reason: PublicReason.SignedWebhook })\n async receive(body: { id: string }) { if (!(await this.inbox.claim('payos', body.id))) return\n await this.work() }\n private async work() {} }"),
            },
            // another public reason is not a webhook door
            {
                name: "case 5", filename: WEBHOOK,
                code: withPrelude("class C { @Public({ reason: PublicReason.Health })\n async ping() { await this.work() }\n private async work() {} }"),
            },
            // a controller with no public door
            { name: "case 6", filename: PLAIN_CONTROLLER, code: "class C { async list() { await this.work() }\n private async work() {} }" },
            // private helpers of a consumer are not handlers
            {
                name: "case 7", filename: CONSUMER,
                code: withPrelude("class C { constructor(private readonly inbox: Inbox) {}\n async handle(m: { id: string }) { if (!(await this.inbox.claim('billing', m.id))) return\n await this.work() }\n private async work() { await this.step() }\n private async step() {} }"),
            },
            // a producer that only publishes lives outside transport/message and carries no consumer file name
            { name: "case 8", filename: at("src/features/checkout/application/billing-outbox.service.ts"), code: "class C { async publish() { await this.work() }\n async work() {} }" },
        ],
        invalid: [
            // no claim at all
            { name: "case 9", filename: CONSUMER, code: withPrelude("class C { async handle() { await this.work() }\n private async work() {} }"), errors: [{ messageId: "noClaim" }] },
            // a handler that never awaits
            { name: "case 10", filename: CONSUMER, code: withPrelude("class C { handle() { this.work() }\n private work() {} }"), errors: [{ messageId: "noClaim" }] },
            // keyword-only: the words inbox and dedupe appear, the type is not the port
            {
                name: "case 11", filename: CONSUMER,
                code: withPrelude("class C { constructor(private readonly inbox: Lookalike) {}\n async handle(m: { id: string }) { if (!(await this.inbox.claim('billing', m.id))) return\n await this.work() }\n private async work() {} }"),
                errors: [{ messageId: "noClaim" }],
            },
            // a claim exists but not as the first awaited expression
            {
                name: "case 12", filename: CONSUMER,
                code: withPrelude("class C { constructor(private readonly inbox: Inbox) {}\n async handle(m: { id: string }) { await this.work()\n if (!(await this.inbox.claim('billing', m.id))) return }\n private async work() {} }"),
                errors: [{ messageId: "noClaim" }],
            },
            // the claim is awaited and ignored
            {
                name: "case 13", filename: CONSUMER,
                code: withPrelude("class C { constructor(private readonly inbox: Inbox) {}\n async handle(m: { id: string }) { await this.inbox.claim('billing', m.id)\n await this.work() }\n private async work() {} }"),
                errors: [{ messageId: "noEarlyReturn" }],
            },
            // the answer is tested but the branch does not return
            {
                name: "case 14", filename: CONSUMER,
                code: withPrelude("class C { constructor(private readonly inbox: Inbox) {}\n async handle(m: { id: string }) { const fresh = await this.inbox.claim('billing', m.id)\n if (!fresh) { console.log('dup') }\n await this.work() }\n private async work() {} }"),
                errors: [{ messageId: "noEarlyReturn" }],
            },
            // a claim with the wrong arity is not `claim(source, eventId)`
            {
                name: "case 15", filename: CONSUMER,
                code: withPrelude("class C { constructor(private readonly inbox: Inbox) {}\n async handle(m: { id: string }) { if (!(await this.inbox.claim(m.id))) return }\n }"),
                errors: [{ messageId: "noClaim" }],
            },
            // a SignedWebhook handler with no claim, reason read by type
            {
                name: "case 16", filename: WEBHOOK,
                code: withPrelude("const reason = PublicReason.SignedWebhook\nclass C { @Public({ reason })\n async receive() { await this.work() }\n private async work() {} }"),
                errors: [{ messageId: "noClaim" }],
            },
            // the decorator on the class covers every public method
            {
                name: "case 17", filename: WEBHOOK,
                code: withPrelude("@Public({ reason: PublicReason.SignedWebhook })\nclass C { async receive() { await this.work() }\n async other() { await this.work() }\n private async work() {} }"),
                errors: [{ messageId: "noClaim" }, { messageId: "noClaim" }],
            },
            // specs are not exempt
            { name: "case 18", filename: SPEC, code: withPrelude("class C { @Public({ reason: PublicReason.SignedWebhook })\n async receive() { await this.work() }\n private async work() {} }"), errors: [{ messageId: "noClaim" }] },
        ],
    })
})
