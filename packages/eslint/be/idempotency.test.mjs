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
        ],
    })
})
