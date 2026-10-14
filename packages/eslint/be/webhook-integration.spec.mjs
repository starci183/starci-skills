/** The complete provider door must satisfy the webhook and thin-feature laws together. */
import test from "node:test"
import { BE_DECLARATION, at, typedTester } from "./fixtures/typed/tester.mjs"
import { featureThin } from "./feature-thin.mjs"
import { webhookShape, webhookVerifyFirst } from "./webhooks.mjs"

const laws = { shape: webhookShape, proof: webhookVerifyFirst, thin: featureThin }
const tester = typedTester({ declaration: { ...BE_DECLARATION, patterns: ["webhooks"] } })
const filename = at("src/features/webhooks/meta/transport/http/meta.webhook.ts")

/** Compose the real visitors, retaining each law's distinct diagnostic identity. */
const combined = {
    meta: {
        type: "problem",
        schema: [],
        messages: Object.fromEntries(Object.entries(laws).flatMap(([name, law]) =>
            Object.entries(law.meta.messages).map(([id, message]) => [`${name}_${id}`, message]))),
    },
    create(context) {
        const visitors = new Map()
        for (const [name, law] of Object.entries(laws)) {
            const scoped = Object.create(context, {
                report: { value: (finding) => context.report({ ...finding, messageId: `${name}_${finding.messageId}` }) },
            })
            for (const [event, visitor] of Object.entries(law.create(scoped))) {
                if (!visitors.has(event)) visitors.set(event, [])
                visitors.get(event).push(visitor)
            }
        }
        return Object.fromEntries([...visitors].map(([event, callbacks]) => [event, (node) => {
            for (const callback of callbacks) callback(node)
        }]))
    },
}

const metaDoor = (ack, challenge = "const echo = this.verifier.challenge(query)\n        return echo") => `
import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Post, Query } from "@nestjs/common"
import { Public, PublicReason } from "@modules/domain/identity"
import { PaymentService } from "@modules/domain/payment"
import { MetaWebhookVerifier } from "@modules/domain/payment/meta-verifier.service"
import { RateLimit, RateTier } from "@modules/platform/http-security"

${ack}

@Controller("webhooks/meta")
export class MetaWebhook {
    constructor(private readonly verifier: MetaWebhookVerifier, private readonly deliveries: PaymentService) {}

    @Get()
    @Public({ reason: PublicReason.SignedWebhook })
    @RateLimit(RateTier.Strict)
    async challenge(@Query() query: object): Promise<string> {
        ${challenge}
    }

    @Post()
    @HttpCode(HttpStatus.OK)
    @Public({ reason: PublicReason.SignedWebhook })
    @RateLimit(RateTier.Strict)
    async receive(@Headers("x-hub-signature-256") signature: string, @Body() body: object): Promise<typeof PROVIDER_ACK> {
        this.verifier.verifyDelivery({ body, signature })
        await this.deliveries.acceptNotification(body)
        return PROVIDER_ACK
    }
}`

test("a full Meta GET/POST door passes R182, R183 and R203 together", () => {
    tester.run("webhook-integration", combined, {
        valid: [
            { filename, code: metaDoor('export const PROVIDER_ACK = "EVENT_RECEIVED" as const') },
            { filename, code: metaDoor("export const PROVIDER_ACK = { success: true } as const", "return await this.verifier.asyncChallenge(query)") },
            { filename, code: metaDoor("export const PROVIDER_ACK: { readonly success: true } = { success: true }") },
            { filename, code: metaDoor("export const PROVIDER_ACK: { readonly code: -1 } = { code: -1 }") },
            { filename, code: metaDoor("export const PROVIDER_ACK = { success: true, details: { code: -1, values: [null, false, 2] } } as const") },
        ],
        invalid: [],
    })
})
