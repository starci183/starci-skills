/**
 * Twin tests for the webhook kind (R182 `BE_WEBHOOK_SHAPE`, R183 `BE_WEBHOOK_UNVERIFIED`).
 *
 *   node --test webhooks.spec.mjs
 */
import assert from "node:assert/strict"
import test from "node:test"
import { BE_DECLARATION, at, typedTester } from "./fixtures/typed/tester.mjs"
import { rules, webhookShape, webhookVerifyFirst } from "./webhooks.mjs"

const tester = typedTester({ declaration: { ...BE_DECLARATION, patterns: ["webhooks", "realtime"] } })
const DOOR = at("src/features/webhooks/payment/transport/http/payment.webhook.ts")
const OTHER_SLOT = at("src/features/plan/transport/http/payment.webhook.ts")
const SPEC = at("src/features/webhooks/payment/transport/http/payment.webhook.spec.ts")

const HEAD = `import { Body, Controller, Headers, Post } from "@nestjs/common"
import { InjectCommandBus } from "@modules/platform/cqrs"
import { Public, PublicReason } from "@modules/domain/identity"
import { PaymentService } from "@modules/domain/payment"
import { WebhookSignatureService } from "@modules/platform/http-security"
`

const LOOKALIKE = `${HEAD}import { WebhookSignatureService as Lookalike } from "@modules/domain/payment/webhook-signature.service"
@Controller("w")
export class W {
    constructor(private readonly signature: Lookalike, private readonly payments: PaymentService) {}
    @Post()
    @Public({ reason: PublicReason.SignedWebhook })
    async receive(@Body() body: object): Promise<void> {
        this.signature.verify({ rawBody: body })
        await this.payments.acceptNotification(body)
    }
}`

const PROVEN = "this.signature.verify({ rawBody: body, signature })"

/** A webhook class with the given constructor and handler body, a signed webhook by default. */
const door = ({ ctor = "private readonly signature: WebhookSignatureService, private readonly payments: PaymentService", body, decorators = "@Post()\n    @Public({ reason: PublicReason.SignedWebhook })", extra = "" } = {}) => `${HEAD}
@Controller("webhooks/payment")
export class PaymentWebhook {
    constructor(${ctor}) {}

    ${decorators}
    async receive(@Headers("x-signature") signature: string, @Body() body: object): Promise<void> {
        ${body ?? `${PROVEN}\n        await this.payments.acceptNotification(body)`}
    }
    ${extra}
}`

test("every rule this law declares is exported under its published name", () => {
    for (const [name, rule] of Object.entries(rules)) assert.ok(rule && rule.meta && rule.create, `${name} is not a rule`)
})

test("webhook-shape: a signed door with one verify and one domain intake call passes, everything else is refused", () => {
    tester.run("webhook-shape", webhookShape, {
        valid: [
            { filename: DOOR, code: door() },
            // the proof may be awaited when it is async, and the intake takes any argument
            { filename: DOOR, code: door({ body: `await ${PROVEN}\n        await this.payments.acceptNotification({ body })` }) },
            // a file outside the webhook slot is not judged by this rule (its own door laws apply)
            { filename: OTHER_SLOT, code: door({ ctor: "private readonly payments: PaymentService", body: "await this.payments.acceptNotification(body)\n        await this.payments.refund('x')" }) },
            // a spec is not a door
            { filename: SPEC, code: "export const a = 1" },
        ],
        invalid: [
            // injection: a bus next to the two allowed values, a lookalike signature service of a domain owner
            { filename: DOOR, code: door({ ctor: "private readonly signature: WebhookSignatureService, private readonly payments: PaymentService, @InjectCommandBus() private readonly bus: object" }), errors: [{ messageId: "injects" }] },
            { filename: DOOR, code: LOOKALIKE, errors: [{ messageId: "intakeCalls" }] },
            // the handler makes no domain call, or two
            { filename: DOOR, code: door({ body: PROVEN }), errors: [{ messageId: "intakeCalls" }] },
            { filename: DOOR, code: door({ body: `${PROVEN}\n        await this.payments.acceptNotification(body)\n        await this.payments.refund('x')` }), errors: [{ messageId: "intakeCalls" }] },
            // a decision and a try in the door
            { filename: DOOR, code: door({ body: `${PROVEN}\n        if (signature) await this.payments.acceptNotification(body)` }), errors: [{ messageId: "branch" }] },
            { filename: DOOR, code: door({ body: `${PROVEN}\n        try { await this.payments.acceptNotification(body) } catch { return }` }), errors: [{ messageId: "branch" }] },
            // parsing in the door is another call
            { filename: DOOR, code: door({ body: `${PROVEN}\n        await this.payments.acceptNotification(JSON.parse(String(body)))` }), errors: [{ messageId: "call" }, { messageId: "call" }] },
            // the door returns domain data
            { filename: DOOR, code: door({ body: `${PROVEN}\n        return await this.payments.acceptNotification(body)` }), errors: [{ messageId: "returns" }] },
            // not a signed webhook: another public reason, or none
            { filename: DOOR, code: door({ decorators: "@Post()\n    @Public({ reason: PublicReason.Health })" }), errors: [{ messageId: "notPublic" }] },
            { filename: DOOR, code: door({ decorators: "@Post()" }), errors: [{ messageId: "notPublic" }] },
            // route shape: a second route, and a door with no @Post
            { filename: DOOR, code: door({ extra: `@Post("b")\n    @Public({ reason: PublicReason.SignedWebhook })\n    async other(@Body() body: object): Promise<void> {\n        ${PROVEN}\n        await this.payments.acceptNotification(body)\n    }` }), errors: [{ messageId: "route" }] },
            { filename: DOOR, code: `${HEAD}import { Get } from "@nestjs/common"
@Controller("w")
export class W {
    constructor(private readonly signature: WebhookSignatureService, private readonly payments: PaymentService) {}
    @Get()
    @Public({ reason: PublicReason.SignedWebhook })
    async receive(): Promise<void> {}
}`, errors: [{ messageId: "route" }] },
            // the file holds no door, or two
            { filename: DOOR, code: "export class NotADoor {}", errors: [{ messageId: "noDoor" }] },
            { filename: DOOR, code: `${door()}\n@Controller("second")\nexport class Second {}`, errors: [{ messageId: "noDoor" }] },
        ],
    })
})

test("webhook-verify-first: the first statement of the handler is the verify call", () => {
    tester.run("webhook-verify-first", webhookVerifyFirst, {
        valid: [
            { filename: DOOR, code: door() },
            { filename: DOOR, code: door({ body: `await ${PROVEN}\n        await this.payments.acceptNotification(body)` }) },
            // outside the webhook slot nothing is judged
            { filename: OTHER_SLOT, code: door({ body: "await this.payments.acceptNotification(body)" }) },
        ],
        invalid: [
            { filename: DOOR, code: door({ body: `await this.payments.acceptNotification(body)\n        ${PROVEN}` }), errors: [{ messageId: "first" }] },
            { filename: DOOR, code: door({ body: `const received = body\n        ${PROVEN}\n        await this.payments.acceptNotification(received)` }), errors: [{ messageId: "first" }] },
            // a verify guarded by a condition is not unconditional
            { filename: DOOR, code: door({ body: `if (signature) ${PROVEN}\n        await this.payments.acceptNotification(body)` }), errors: [{ messageId: "first" }] },
            // a lookalike signature service of a domain owner proves nothing
            { filename: DOOR, code: LOOKALIKE, errors: [{ messageId: "first" }] },
            { filename: DOOR, code: door({ body: "" }), errors: [{ messageId: "first" }] },
        ],
    })
})
