/** R263 scope proofs share a process isolated from the original webhook type fixtures. */
// proves: BE_WEBHOOK_SCOPE@lite BE_WEBHOOK_SCOPE@full
import assert from "node:assert/strict"
import test from "node:test"
import { BE_DECLARATION, TYPED_ROOT, at, ruleTester } from "./fixtures/typed/tester.mjs"
import { appDeclaration } from "./fixtures/app.mjs"
import { hfsFromDeclaration } from "./lib/hfs.mjs"
import { webhookScope } from "./webhooks.mjs"

const DOOR = at("src/features/webhooks/payment/transport/http/payment.webhook.ts")
const OTHER_SLOT = at("src/features/api/payment/transport/http/payment.webhook.ts")
const SPEC = at("src/features/webhooks/payment/transport/http/payment.webhook.spec.ts")

test("R263 scope findings carry their runtime failure code", () => {
    assert.match(webhookScope.meta.messages.scope, /^\[BE_WEBHOOK_SCOPE\] /)
})

for (const edition of ["lite", "full"]) {
    test(`webhook-scope confines signed metadata and public delivery routes in ${edition}`, () => {
        const hfs = hfsFromDeclaration({ ...appDeclaration("be", { ...BE_DECLARATION, patterns: ["webhooks"] }), edition }, TYPED_ROOT)
        assert.equal(hfs.edition, edition)
        const controller = at("src/features/api/payment/transport/http/payment.controller.ts")
        const module = at("src/features/webhooks/payment/transport/http/payment-http.module.ts")
        const service = at("src/modules/domain/payment/payment.service.ts")
        const imports = `import { Controller, Post, Get } from "@nestjs/common"
import { Public, PublicReason } from "@modules/domain/identity"
`
        const route = ({ prefix = '"payment"', path = '"notify"', publicOptions = "{ reason: PublicReason.Health }", before = "", classMetadata = "", metadata = true } = {}) => `${imports}${before}
${classMetadata}
@Controller(${prefix})
export class PaymentController {
    ${metadata ? `@Public(${publicOptions})` : ""}
    @Post(${path}) receive(): void {}
}`
        const error = [{ messageId: "scope" }]
        ruleTester({ root: TYPED_ROOT, hfs }).run("webhook-scope", webhookScope, {
            valid: [
                { filename: DOOR, code: route({ prefix: '"webhooks/payment"', publicOptions: "{ reason: PublicReason.SignedWebhook }" }) },
                { filename: DOOR, code: 'import { PaymentService } from "@modules/domain/payment"; export class Door { constructor(private readonly payment: PaymentService) {} async receive() { await this.payment.acceptNotification({ process: "metadata" }) } }' },
                { filename: controller, code: route({ path: '"sign-in"', publicOptions: "{ reason: PublicReason.AuthHandshake }" }) },
                { filename: controller, code: route({ path: '"events"', metadata: false }) },
                { filename: controller, code: route({ before: "enum LocalReason { SignedWebhook = 'signed-webhook' }", publicOptions: "{ reason: LocalReason.SignedWebhook }" }) },
                { filename: controller, code: route({ before: "const signed = { reason: PublicReason.SignedWebhook } as const", publicOptions: "{ ...signed, reason: PublicReason.Health }" }) },
                { filename: SPEC, code: route({ path: '"webhook"', publicOptions: "{ reason: PublicReason.SignedWebhook }" }) },
                // The module's explicit verifier array names this exact domain method symbol.
                { filename: service, code: `${imports}import "../../../features/webhooks/payment/transport/http/payment-http.module"
export class PaymentService { @Public({ reason: PublicReason.SignedWebhook }) async acceptVerifiedNotification(): Promise<void> {} }` },
                { filename: module, code: 'import { PaymentService } from "@modules/domain/payment"; export const webhookVerifiers = [PaymentService.prototype.acceptVerifiedNotification] as const' },
            ],
            invalid: [
                { filename: controller, code: route({ publicOptions: "{ reason: PublicReason.SignedWebhook }" }), errors: error },
                { filename: OTHER_SLOT, code: route({ publicOptions: "{ reason: PublicReason.SignedWebhook }" }), errors: error },
                { filename: controller, code: route({ before: "const options = { reason: PublicReason.SignedWebhook } as const", publicOptions: "options" }), errors: error },
                { filename: controller, code: route({ publicOptions: "({ ['reason']: PublicReason.SignedWebhook } as const)" }), errors: error },
                { filename: controller, code: route({ before: "const signed = { reason: PublicReason.SignedWebhook } as const", publicOptions: "{ ...signed }" }), errors: error },
                ...["webhook", "callback", "events", "provider/CALLBACK/confirm"].map((path) => ({ filename: controller, code: route({ path: JSON.stringify(path) }), errors: error })),
                { filename: controller, code: route({ prefix: '{ path: ["events", "payment"] }', path: '""' }), errors: error },
                { filename: controller, code: route({ before: "const provider = 'webhook'; const prefix = { path: provider } as const", prefix: "{ ...prefix }" }), errors: error },
                { filename: controller, code: route({ path: "'web' + 'hook'" }), errors: error },
                { filename: controller, code: route({ before: "const segment = 'events'", path: "`provider/${segment}`" }), errors: error },
                { filename: controller, code: route({ classMetadata: "@Public({ reason: PublicReason.Health })", prefix: '"callback"', metadata: false }), errors: error },
                { filename: controller, code: `import * as Identity from "@modules/domain/identity"
import { Controller as Door, Post as Receive } from "@nestjs/common"
@Door("payment") export class PaymentController {
    @Identity.Public({ reason: Identity.PublicReason.SignedWebhook }) @Receive() receive(): void {}
}`, errors: error },
                { filename: service, code: `${imports}export class PaymentService { @Public({ reason: PublicReason.SignedWebhook }) async acceptNotification(): Promise<void> {} }`, errors: error },
                { filename: at("src/features/webhooks/payment/transport/http/payment.controller.ts"), code: route({ publicOptions: "{ reason: PublicReason.SignedWebhook }" }), errors: error },
                { filename: DOOR, code: 'import { PaymentService } from "@modules/domain/payment"; export class Door { constructor(private readonly payment: PaymentService) {} async receive() { await this.payment.acceptNotification({ process: async () => this.payment.refund("id") }) } }', errors: error },
                { filename: DOOR, code: 'import { PaymentService } from "@modules/domain/payment"; export class Door { constructor(private readonly payment: PaymentService) {} async receive() { const process = async () => this.payment.refund("id"); await this.payment.acceptNotification({ process }) } }', errors: error },
            ],
        })
    })
}
