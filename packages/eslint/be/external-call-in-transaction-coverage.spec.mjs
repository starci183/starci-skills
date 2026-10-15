/** R82 proves that external effects follow transaction commit in each edition. */
// proves: BE_TRANSACTION_EXTERNAL_CALL@lite
// proves: BE_TRANSACTION_EXTERNAL_CALL@full
import assert from "node:assert/strict"
import test from "node:test"
import { appDeclaration } from "./fixtures/app.mjs"
import { BE_DECLARATION, TYPED_ROOT, at, ruleTester } from "./fixtures/typed/tester.mjs"
import { hfsFromDeclaration } from "./lib/hfs.mjs"
import { noExternalCallInTransaction } from "./data-access.mjs"

const HANDLER = at("src/features/api/checkout/application/place.handler.ts")
const IMPORTS = 'import { EntityManager } from "typeorm"; import { StripeClient } from "@modules/integrations/stripe/stripe.client"; declare class OrderEntity {}; declare const manager: EntityManager; declare const stripe: StripeClient;\n'

for (const edition of ["lite", "full"]) {
    test(`R82 accepts calls after commit and rejects calls inside transactions in ${edition}`, () => {
        const hfs = hfsFromDeclaration({ ...appDeclaration("be", BE_DECLARATION), edition }, TYPED_ROOT)
        assert.equal(hfs.edition, edition)
        ruleTester({ root: TYPED_ROOT, hfs }).run("no-external-call-in-transaction", noExternalCallInTransaction, {
            valid: [
                { filename: HANDLER, code: IMPORTS + 'await manager.transaction(async (tx) => { await tx.save(OrderEntity) }); await stripe.charge("1")' },
                { filename: HANDLER, code: IMPORTS + 'await manager.transaction(async (tx) => { await tx.save(OrderEntity) }); await fetch("https://example.test")' },
            ],
            invalid: [
                {
                    filename: HANDLER,
                    code: IMPORTS + 'await manager.transaction(async (tx) => { await tx.save(OrderEntity); await stripe.charge("1") })',
                    errors: [{ messageId: "external" }],
                },
                {
                    filename: HANDLER,
                    code: IMPORTS + 'await manager.transaction(async (tx) => { await tx.save(OrderEntity); await fetch("https://example.test") })',
                    errors: [{ messageId: "external" }],
                },
            ],
        })
    })
}
