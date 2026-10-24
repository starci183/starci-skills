/** Edition-aware proofs for the webhook and realtime door laws R182-R186. */
// proves: BE_WEBHOOK_SHAPE@lite
// proves: BE_WEBHOOK_SHAPE@full
// proves: BE_WEBHOOK_UNVERIFIED@lite
// proves: BE_WEBHOOK_UNVERIFIED@full
// proves: BE_REALTIME_SHAPE@lite
// proves: BE_REALTIME_SHAPE@full
// proves: BE_REALTIME_WRITES@lite
// proves: BE_REALTIME_WRITES@full
// proves: BE_REALTIME_TOPIC_SCOPE@lite
// proves: BE_REALTIME_TOPIC_SCOPE@full
import assert from "node:assert/strict"
import test from "node:test"
import { appDeclaration } from "./fixtures/app.mjs"
import { BE_DECLARATION, TYPED_ROOT, at, ruleTester } from "./fixtures/typed/tester.mjs"
import { hfsFromDeclaration } from "./lib/hfs.mjs"
import { realtimeReadOnly, realtimeShape, realtimeTopicScope } from "./realtime.mjs"
import { webhookShape, webhookVerifyFirst } from "./webhooks.mjs"

const WEBHOOK = at("src/features/webhooks/payment/transport/http/payment.webhook.ts")
const GATEWAY = at("src/features/realtime/order-status/transport/websocket/order-status.gateway.ts")
const SSE = at("src/features/realtime/order-status/transport/sse/order-status.controller.ts")

const PROOF = "this.signature.verify({ rawBody: body, signature })"
const INTAKE = "await this.payments.acceptNotification(body)"
const WEBHOOK_HEAD = `import { Body, Controller, Headers, Post } from "@nestjs/common"
import { Public, PublicReason } from "@modules/domain/identity"
import { PaymentService } from "@modules/domain/payment"
import { WebhookSignatureService } from "@modules/platform/http-security"
`

/** The signature proof and one domain intake are the whole signed delivery handler. */
const webhook = (body = PROOF + "\n" + INTAKE) => WEBHOOK_HEAD + `
@Controller("webhooks/payment")
export class PaymentWebhook {
    constructor(private readonly signature: WebhookSignatureService, private readonly payments: PaymentService) {}
    @Post()
    @Public({ reason: PublicReason.SignedWebhook })
    async receive(@Headers("x-signature") signature: string, @Body() body: object): Promise<void> {
        ${body}
    }
}`

const GATEWAY_HEAD = `import { SubscribeMessage, WebSocketGateway } from "@nestjs/websockets"
import { CurrentPrincipal } from "@modules/domain/identity"
import { RealtimeHub } from "@modules/platform/realtime"
`
const SCOPED_TOPIC = 'return this.hub.subscribe(["orders", principal.id].join(":"))'

/** Both editions use the same socket.io inbound door, authenticated by the identity decorator. */
const gateway = ({ body = SCOPED_TOPIC, injections = "", imports = "" } = {}) => GATEWAY_HEAD + imports + `
@WebSocketGateway()
export class OrderStatusGateway {
    constructor(private readonly hub: RealtimeHub${injections}) {}
    @SubscribeMessage("orders")
    watch(@CurrentPrincipal() principal: { id: string }): AsyncIterable<object> {
        ${body}
    }
}`

const SSE_HEAD = `import { Controller, Headers, Sse } from "@nestjs/common"
import { CurrentPrincipal } from "@modules/domain/identity"
import { RealtimeHub } from "@modules/platform/realtime"
`

/** Both editions serve the same event-stream door: one `@Sse` method, the hub as the only value injected, the topic from the principal. */
const sseController = ({ body = 'return this.hub.subscribe(["orders", principal.id].join(":"), { after: lastEventId })', injections = "", imports = "" } = {}) => SSE_HEAD + imports + `
@Controller("orders")
export class OrderStatusController {
    constructor(private readonly hub: RealtimeHub${injections}) {}
    @Sse("stream")
    watch(@CurrentPrincipal() principal: { id: string }, @Headers("last-event-id") lastEventId?: string): AsyncIterable<object> {
        ${body}
    }
}`

for (const edition of ["lite", "full"]) {
    const declaration = { ...appDeclaration("be", { ...BE_DECLARATION, patterns: ["webhooks", "realtime"] }), edition }
    const hfs = hfsFromDeclaration(declaration, TYPED_ROOT)

    test(`webhook-shape accepts a signed intake and rejects orchestration in ${edition}`, () => {
        assert.equal(hfs.edition, edition)
        ruleTester({ root: TYPED_ROOT, hfs }).run("webhook-shape", webhookShape, {
            valid: [{ filename: WEBHOOK, code: webhook() }],
            invalid: [
                { filename: WEBHOOK, code: webhook(PROOF + "\n" + INTAKE + "\n" + INTAKE), errors: [{ messageId: "intakeCalls" }] },
                { filename: WEBHOOK, code: webhook().replace("PublicReason.SignedWebhook", "PublicReason.Health"), errors: [{ messageId: "notPublic" }] },
            ],
        })
    })

    test(`webhook-verify-first accepts completed proof and rejects intake before proof in ${edition}`, () => {
        assert.equal(hfs.edition, edition)
        ruleTester({ root: TYPED_ROOT, hfs }).run("webhook-verify-first", webhookVerifyFirst, {
            valid: [{ filename: WEBHOOK, code: webhook() }],
            invalid: [
                { filename: WEBHOOK, code: webhook(INTAKE + "\n" + PROOF), errors: [{ messageId: "first" }] },
                { filename: WEBHOOK, code: webhook(INTAKE), errors: [{ messageId: "first" }] },
            ],
        })
    })

    test(`realtime-shape accepts one socket gateway and rejects a missing door in ${edition}`, () => {
        assert.equal(hfs.edition, edition)
        ruleTester({ root: TYPED_ROOT, hfs }).run("realtime-shape", realtimeShape, {
            valid: [{ filename: GATEWAY, code: gateway() }],
            invalid: [{ filename: GATEWAY, code: "export class Plain {}", errors: [{ messageId: "door" }] }],
        })
    })

    test(`realtime-read-only accepts the platform hub and rejects a writing service in ${edition}`, () => {
        assert.equal(hfs.edition, edition)
        ruleTester({ root: TYPED_ROOT, hfs }).run("realtime-read-only", realtimeReadOnly, {
            valid: [{ filename: GATEWAY, code: gateway() }],
            invalid: [{
                filename: GATEWAY,
                code: gateway({ imports: 'import { OrderService } from "@modules/domain/order"\n', injections: ", private readonly orders: OrderService" }),
                errors: [{ messageId: "injects" }],
            }],
        })
    })

    test(`realtime-topic-scope accepts a principal topic and rejects a shared topic in ${edition}`, () => {
        assert.equal(hfs.edition, edition)
        ruleTester({ root: TYPED_ROOT, hfs }).run("realtime-topic-scope", realtimeTopicScope, {
            valid: [{ filename: GATEWAY, code: gateway() }],
            invalid: [{ filename: GATEWAY, code: gateway({ body: 'return this.hub.subscribe("orders")' }), errors: [{ messageId: "scope" }] }],
        })
    })

    test(`realtime-shape accepts one SSE controller and rejects a plain route beside its stream in ${edition}`, () => {
        assert.equal(hfs.edition, edition)
        ruleTester({ root: TYPED_ROOT, hfs }).run("realtime-shape", realtimeShape, {
            valid: [{ filename: SSE, code: sseController() }],
            invalid: [{
                filename: SSE,
                code: sseController({ imports: "import { Get } from '@nestjs/common'\n" }).replace('@Sse("stream")', '@Get("read")\n    read(): string { return "x" }\n    @Sse("stream")'),
                errors: [{ messageId: "foreign" }],
            }],
        })
    })

    test(`realtime-read-only keeps the SSE controller to the platform hub in ${edition}`, () => {
        assert.equal(hfs.edition, edition)
        ruleTester({ root: TYPED_ROOT, hfs }).run("realtime-read-only", realtimeReadOnly, {
            valid: [{ filename: SSE, code: sseController() }],
            invalid: [{
                filename: SSE,
                code: sseController({ imports: "import { OrderService } from '@modules/domain/order'\n", injections: ", private readonly orders: OrderService" }),
                errors: [{ messageId: "injects" }],
            }],
        })
    })

    test(`realtime-topic-scope scopes the SSE stream to the principal, not to Last-Event-ID, in ${edition}`, () => {
        assert.equal(hfs.edition, edition)
        ruleTester({ root: TYPED_ROOT, hfs }).run("realtime-topic-scope", realtimeTopicScope, {
            valid: [{ filename: SSE, code: sseController() }],
            invalid: [{ filename: SSE, code: sseController({ body: "return this.hub.subscribe(`orders:${lastEventId}`)" }), errors: [{ messageId: "scope" }] }],
        })
    })
}
