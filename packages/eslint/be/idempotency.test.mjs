import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import { inboxDedupeRequired } from "./idempotency.mjs"

const tester = new RuleTester({
    languageOptions: { parser: tsParser, ecmaVersion: 2022, sourceType: "module" },
})
const WEBHOOK = "D:/repo/src/features/billing/transport/http/billing-webhook.controller.ts"
const OTHER_CONTROLLER = "D:/repo/src/features/billing/transport/http/plan.controller.ts"
const CONSUMER = "D:/repo/src/features/billing/transport/message/payment-captured.consumer.ts"
// Not under transport/message/ and not named *.consumer.ts: only the shape (decorator or class-name suffix) says these consume.
const SHAPED_HANDLER = "D:/repo/src/features/billing/platform/payment-captured.handler.ts"
const OUTBOX_CONSUMER_ELSEWHERE = "D:/repo/src/features/billing/jobs/payment-captured.ts"
// The producer half of an outbox: it publishes, it does not consume, and its name says nothing about consuming.
const OUTBOX_PRODUCER = "D:/repo/src/features/billing/transport/schedule/billing-outbox.service.ts"

test("a webhook or outbox consumer claims the event through the inbox before it acts", () => {
    tester.run("inbox-dedupe-required", inboxDedupeRequired, {
        valid: [
            {
                filename: WEBHOOK,
                code: "@Controller('billing') class C { @Public({ reason: 'external' }) handle() { this.inboxPort.claim(source, id) } }",
            },
            {
                filename: CONSUMER,
                code: "class C { handle() { return this.dedupeStore.claim(key) } }",
            },
            {
                filename: CONSUMER,
                code: "class C { constructor(private readonly idempotencyPort: IdempotencyPort) {} }",
            },
            // a plain door with no webhook shape and no Public decorator is out of scope
            { filename: OTHER_CONTROLLER, code: "@Controller('plan') class C { get() { return 1 } }" },
            // a spec arranges its own doubles
            { filename: "D:/repo/src/features/billing/transport/http/billing-webhook.controller.spec.ts", code: "class C {}" },
            // a consumer recognized by shape, claiming through the inbox
            {
                filename: SHAPED_HANDLER,
                code: "class PaymentCapturedHandler { @EventPattern('payment.captured') async handle(payload) { if (!(await this.inbox.claim('internal-outbox', payload.eventId))) return } }",
            },
            {
                filename: OUTBOX_CONSUMER_ELSEWHERE,
                code: "class PaymentCapturedOutboxConsumer { handle() { return this.dedupeStore.claim(key) } }",
            },
            // the producer half of an outbox publishes; it has no delivery to dedupe and is not asked for one
            {
                filename: OUTBOX_PRODUCER,
                code: "class BillingOutboxService { @Cron('*/10 * * * * *') async publish() { const rows = await this.repo.findPending(); for (const row of rows) await this.broker.publish(row) } }",
            },
        ],
        invalid: [
            {
                filename: WEBHOOK,
                code: "@Controller('billing') class C { @Public({ reason: 'external' }) handle() { return this.service.charge() } }",
                errors: [{ messageId: "webhook" }],
            },
            {
                filename: CONSUMER,
                code: "class C { handle() { return this.service.capture() } }",
                errors: [{ messageId: "consumer" }],
            },
            {
                filename: OTHER_CONTROLLER,
                code: "@Controller('billing/webhook') class C { @Public({ reason: 'external' }) handle() { return this.service.charge() } }",
                errors: [{ messageId: "webhook" }],
            },
            // a decorator naming an incoming message/event handler is a consumer shape, wherever the file sits
            {
                filename: SHAPED_HANDLER,
                code: "class PaymentCapturedHandler { @EventPattern('payment.captured') async handle(payload) { return this.service.capture(payload) } }",
                errors: [{ messageId: "consumer" }],
            },
            {
                filename: SHAPED_HANDLER,
                code: "class PaymentSettled { @MessagePattern('payment.settled') async handle(payload) { return this.service.settle(payload) } }",
                errors: [{ messageId: "consumer" }],
            },
            // a class name ending Consumer/OutboxConsumer is a consumer shape, wherever the file sits
            {
                filename: OUTBOX_CONSUMER_ELSEWHERE,
                code: "class PaymentCapturedOutboxConsumer { handle() { return this.service.capture() } }",
                errors: [{ messageId: "consumer" }],
            },
            {
                filename: OUTBOX_CONSUMER_ELSEWHERE,
                code: "class PaymentSettledConsumer { handle() { return this.service.settle() } }",
                errors: [{ messageId: "consumer" }],
            },
        ],
    })
})
