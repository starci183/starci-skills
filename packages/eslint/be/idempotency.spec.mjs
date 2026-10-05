import test from "node:test"
import { at, typedTester } from "./fixtures/typed/tester.mjs"
import { inboxDedupeRequired } from "./idempotency.mjs"

const tester = typedTester()
const SERVICE = at("src/modules/domain/order/billing.service.ts")
const BUS = at("src/modules/platform/event-bus/event-bus.service.ts")
const CONSUMER = at("src/features/api/checkout/transport/message/payment-captured.consumer.ts")
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

const transactionService = (body, { asynchronous = false, managerType = "EntityManager", inboxType = "Inbox", declarations = "" } = {}) =>
    PRELUDE + '\nimport type { EntityManager } from "typeorm"\n' + declarations
    + "\nclass C {\n    constructor(private readonly em: " + managerType + ", private readonly other: EntityManager, private readonly inbox: " + inboxType + ") {}"
    + "\n    " + (asynchronous ? "async " : "") + "handle(m: Delivery) { " + body + " }\n    private async work(): Promise<void> {}\n}"

test("delivery claims first with the actual EntityManager callback and cannot escape its duplicate refusal", () => {
    tester.run("inbox-dedupe-required/transaction", inboxDedupeRequired, {
        valid: [
            {
                name: "returned invoice transaction reads a duplicate and writes only after the bound claim", filename: SERVICE,
                code: transactionService("return this.em.transaction(async (tx) => { if (!(await this.inbox.claim('billing', m.eventId, tx))) return await tx.query('read duplicate'); return await tx.save({ amount: m.amount }) })"),
            },
            {
                name: "sole awaited payment transaction returns before work on a duplicate", filename: SERVICE,
                code: transactionService("await this.em.transaction(async (tx) => { if (!(await this.inbox.claim('billing', m.eventId, tx))) return; await tx.save({ amount: m.amount }) })", { asynchronous: true }),
            },
            {
                name: "returned awaited transaction stores its claim and immediately refuses false", filename: SERVICE,
                code: transactionService("return await this.em.transaction(async (tx) => { const fresh = await this.inbox.claim('billing', m.eventId, tx); if (!fresh) return; await tx.save({ amount: m.amount }) })", { asynchronous: true }),
            },
            {
                name: "actual isolation overload uses the second callback", filename: SERVICE,
                code: transactionService("return this.em.transaction('SERIALIZABLE', async (tx) => { if ((await this.inbox.claim('billing', m.eventId, tx)) === false) return; await tx.save({ amount: m.amount }) })"),
            },
            {
                name: "renamed typed ports and manager parameter preserve their origin and binding", filename: SERVICE,
                code: withPrelude('import type { EntityManager as BillingManager } from "typeorm"\nclass C { constructor(private readonly database: BillingManager, private readonly seen: Inbox) {} handle(m: Delivery) { return this.database.transaction(async (unit) => { if (!(await this.seen.claim("billing", m.eventId, unit))) return; await unit.save({ amount: m.amount }) }) } }'),
            },
            {
                name: "function callback selected by TypeORM uses its own parameter and a captured port", filename: SERVICE,
                code: transactionService("return this.em.transaction(async function (tx) { if (!(await mailbox.claim('billing', m.eventId, tx))) return; await tx.save({ amount: m.amount }) })", { declarations: "declare const mailbox: Inbox" }),
            },
        ],
        invalid: [
            { name: "claim missing from selected callback", filename: SERVICE, code: transactionService("return this.em.transaction(async (tx) => { await tx.save({ amount: m.amount }) })"), errors: [{ messageId: "noClaim" }] },
            { name: "claim after the first callback await", filename: SERVICE, code: transactionService("return this.em.transaction(async (tx) => { await tx.save({ amount: m.amount }); if (!(await this.inbox.claim('billing', m.eventId, tx))) return })"), errors: [{ messageId: "noClaim" }] },
            { name: "synchronous callback work before claim", filename: SERVICE, code: transactionService("return this.em.transaction(async (tx) => { this.work(); if (!(await this.inbox.claim('billing', m.eventId, tx))) return })"), errors: [{ messageId: "noClaim" }] },
            { name: "argument effect before the claim call", filename: SERVICE, code: transactionService("return this.em.transaction(async (tx) => { if (!(await this.inbox.claim(String(this.work()), m.eventId, tx))) return })"), errors: [{ messageId: "noClaim" }] },
            { name: "same parameter reassigned while evaluating claim arguments", filename: SERVICE, code: transactionService("return this.em.transaction(async (tx) => { if (!(await this.inbox.claim((tx = this.other, 'billing'), m.eventId, tx))) return })"), errors: [{ messageId: "noClaim" }] },
            { name: "claim hidden under a conditional path", filename: SERVICE, code: transactionService("return this.em.transaction(async (tx) => { if (m.amount > 0) { if (!(await this.inbox.claim('billing', m.eventId, tx))) return } await tx.save({ amount: m.amount }) })"), errors: [{ messageId: "noClaim" }] },
            { name: "claim hidden in another callback", filename: SERVICE, code: transactionService("return this.em.transaction(async (tx) => { const later = async () => { if (!(await this.inbox.claim('billing', m.eventId, tx))) return }; await tx.save({ amount: m.amount }); await later() })"), errors: [{ messageId: "noClaim" }] },
            { name: "TypeORM runs the first callback and ignores the convincing second one", filename: SERVICE, code: transactionService("return this.em.transaction(async (tx) => { await tx.save({ amount: m.amount }) }, async (tx) => { if (!(await this.inbox.claim('billing', m.eventId, tx))) return })"), errors: [{ messageId: "noClaim" }] },
            { name: "non-inline callback is not inspected", filename: SERVICE, code: transactionService("return this.em.transaction(handler)", { declarations: "declare const handler: (tx: EntityManager) => Promise<void>" }), errors: [{ messageId: "noClaim" }] },
            { name: "unknown isolation argument cannot choose a proof callback", filename: SERVICE, code: transactionService("return this.em.transaction('NOT-AN-ISOLATION', async (tx) => { if (!(await this.inbox.claim('billing', m.eventId, tx))) return })"), errors: [{ messageId: "noClaim" }] },
            { name: "claim omits transaction manager", filename: SERVICE, code: transactionService("return this.em.transaction(async (tx) => { if (!(await this.inbox.claim('billing', m.eventId))) return; await tx.save({ amount: m.amount }) })"), errors: [{ messageId: "noClaim" }] },
            { name: "claim uses outer shared manager", filename: SERVICE, code: transactionService("return this.em.transaction(async (tx) => { if (!(await this.inbox.claim('billing', m.eventId, this.em))) return; await tx.save({ amount: m.amount }) })"), errors: [{ messageId: "noClaim" }] },
            { name: "same typed manager from another binding is not the transaction parameter", filename: SERVICE, code: transactionService("return this.em.transaction(async (tx) => { if (!(await this.inbox.claim('billing', m.eventId, other))) return; await tx.save({ amount: m.amount }) })", { declarations: "declare const other: EntityManager" }), errors: [{ messageId: "noClaim" }] },
            { name: "same spelling in a nested shadow is not the selected parameter", filename: SERVICE, code: transactionService("return this.em.transaction(async (tx) => { { const tx = this.other; if (!(await this.inbox.claim('billing', m.eventId, tx))) return }; await tx.save({ amount: m.amount }) })"), errors: [{ messageId: "noClaim" }] },
            { name: "lookalike Inbox cannot claim for the platform owner", filename: SERVICE, code: transactionService("return this.em.transaction(async (tx) => { if (!(await this.inbox.claim('billing', m.eventId, tx))) return })", { inboxType: "Lookalike" }), errors: [{ messageId: "noClaim" }] },
            { name: "lookalike transaction receiver cannot grant a transaction", filename: SERVICE, code: transactionService("return this.em.transaction(async (tx) => { if (!(await this.inbox.claim('billing', m.eventId, tx))) return })", { managerType: "PretendManager", declarations: "declare class PretendManager { transaction<T>(work: (tx: EntityManager) => Promise<T>): Promise<T> }" }), errors: [{ messageId: "noClaim" }] },
            { name: "outer awaited work before returned transaction", filename: SERVICE, code: transactionService("await this.work(); return this.em.transaction(async (tx) => { if (!(await this.inbox.claim('billing', m.eventId, tx))) return })", { asynchronous: true }), errors: [{ messageId: "noClaim" }] },
            { name: "duplicate callback refusal cannot fall through to outer work", filename: SERVICE, code: transactionService("await this.em.transaction(async (tx) => { if (!(await this.inbox.claim('billing', m.eventId, tx))) return }); await this.work()", { asynchronous: true }), errors: [{ messageId: "noClaim" }] },
            { name: "unawaited transaction cannot detach delivery completion", filename: SERVICE, code: transactionService("this.em.transaction(async (tx) => { if (!(await this.inbox.claim('billing', m.eventId, tx))) return })"), errors: [{ messageId: "noClaim" }] },
            { name: "claim answer ignored in the correct transaction", filename: SERVICE, code: transactionService("return this.em.transaction(async (tx) => { await this.inbox.claim('billing', m.eventId, tx); await tx.save({ amount: m.amount }) })"), errors: [{ messageId: "noEarlyReturn" }] },
            { name: "stored claim cannot run work before testing false", filename: SERVICE, code: transactionService("return this.em.transaction(async (tx) => { const fresh = await this.inbox.claim('billing', m.eventId, tx); await tx.save({ amount: m.amount }); if (!fresh) return })"), errors: [{ messageId: "noEarlyReturn" }] },
        ],
    })
})
