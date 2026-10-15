// proves: BE_INBOX_DEDUPE_MISSING@lite
// proves: BE_INBOX_DEDUPE_MISSING@full
import assert from "node:assert/strict"
import test from "node:test"
import { BE_DECLARATION, TYPED_ROOT, at, ruleTester } from "./fixtures/typed/tester.mjs"
import { appDeclaration } from "./fixtures/app.mjs"
import { hfsFromDeclaration } from "./lib/hfs.mjs"
import { inboxDedupeRequired } from "./idempotency.mjs"

const SERVICE = at("src/modules/domain/order/billing.service.ts")
const HEAD = [
    'import type { Inbox } from "@modules/platform/inbox/inbox.port"',
    'import type { EntityManager } from "typeorm"',
    "interface Delivery { eventId: string; amount: number }",
].join("\n")
const service = (body) => HEAD
    + "\nclass BillingService { constructor(private readonly inbox: Inbox, private readonly manager: EntityManager) {}"
    + "\nasync handle(delivery: Delivery) { " + body + " }"
    + "\nprivate async work(): Promise<void> {} }"

for (const edition of ["lite", "full"]) {
    test(`R80 valid inbox refusal and invalid unclaimed deliveries in ${edition}`, () => {
        const hfs = hfsFromDeclaration({ ...appDeclaration("be", BE_DECLARATION), edition }, TYPED_ROOT)
        assert.equal(hfs.edition, edition)
        ruleTester({ root: TYPED_ROOT, hfs }).run("inbox-dedupe-required", inboxDedupeRequired, {
            valid: [
                { filename: SERVICE, code: service("if (!(await this.inbox.claim('billing', delivery.eventId))) return; await this.work()") },
                { filename: SERVICE, code: service("return this.manager.transaction(async (tx) => { if (!(await this.inbox.claim('billing', delivery.eventId, tx))) return; await tx.save({ amount: delivery.amount }) })") },
            ],
            invalid: [
                { filename: SERVICE, code: service("await this.work()"), errors: [{ messageId: "noClaim" }] },
                { filename: SERVICE, code: service("await this.work(); if (!(await this.inbox.claim('billing', delivery.eventId))) return"), errors: [{ messageId: "noClaim" }] },
                { filename: SERVICE, code: service("await this.inbox.claim('billing', delivery.eventId); await this.work()"), errors: [{ messageId: "noEarlyReturn" }] },
                { filename: SERVICE, code: service("return this.manager.transaction(async (tx) => { await this.inbox.claim('billing', delivery.eventId, tx); await tx.save({ amount: delivery.amount }) })"), errors: [{ messageId: "noEarlyReturn" }] },
            ],
        })
    })
}
