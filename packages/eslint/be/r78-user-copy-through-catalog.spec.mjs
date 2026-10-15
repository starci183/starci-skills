// proves: BE_USER_COPY_LITERAL@lite
// proves: BE_USER_COPY_LITERAL@full
import assert from "node:assert/strict"
import test from "node:test"
import { BE_DECLARATION, TYPED_ROOT, at, ruleTester } from "./fixtures/typed/tester.mjs"
import { appDeclaration } from "./fixtures/app.mjs"
import { hfsFromDeclaration } from "./lib/hfs.mjs"
import { userCopyThroughCatalog } from "./user-copy.mjs"

const SERVICE = at("src/modules/domain/order/order.service.ts")
const CONTROLLER = at("src/features/api/checkout/transport/http/order.controller.ts")
const HEAD = [
    'import type { MailerClient } from "@modules/integrations/mailer/mailer.client"',
    "declare const mailer: MailerClient",
    "declare const messages: { get(key: string): string }",
    "class PlanNotFoundError extends Error {}",
].join("\n")
const code = (body) => HEAD + "\n" + body

for (const edition of ["lite", "full"]) {
    test(`R78 valid catalog lookups and invalid literal user copy in ${edition}`, () => {
        const hfs = hfsFromDeclaration({ ...appDeclaration("be", BE_DECLARATION), edition }, TYPED_ROOT)
        assert.equal(hfs.edition, edition)
        ruleTester({ root: TYPED_ROOT, hfs }).run("user-copy-through-catalog", userCopyThroughCatalog, {
            valid: [
                { filename: SERVICE, code: code("throw new PlanNotFoundError(messages.get('plan.notFound'))") },
                { filename: SERVICE, code: code("mailer.send({ subject: messages.get('plan.subject') })") },
                { filename: CONTROLLER, code: code("const response = { message: messages.get('plan.updated') }") },
            ],
            invalid: [
                { filename: SERVICE, code: code("throw new PlanNotFoundError('Plan not found for this account')"), errors: [{ messageId: "exception" }] },
                { filename: SERVICE, code: code("mailer.send({ subject: 'Your plan has changed' })"), errors: [{ messageId: "notification" }] },
                { filename: CONTROLLER, code: code("const response = { message: 'Plan updated successfully' }"), errors: [{ messageId: "response" }] },
            ],
        })
    })
}
