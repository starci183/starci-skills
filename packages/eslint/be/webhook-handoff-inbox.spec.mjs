/** R263 proof: scalar and signed raw-body intakes cannot escape the inbox contract. */
// proves: BE_WEBHOOK_INBOX_KEY@lite BE_WEBHOOK_INBOX_KEY@full
import assert from "node:assert/strict"
import test from "node:test"
import { BE_DECLARATION, TYPED_ROOT, at, ruleTester } from "./fixtures/typed/tester.mjs"
import { appDeclaration } from "./fixtures/app.mjs"
import { hfsFromDeclaration } from "./lib/hfs.mjs"
import { webhookInboxKey } from "./lib/webhook-handoff-inbox.mjs"
import { rules, recommended } from "./webhooks.mjs"

// The intake is reached by the on-disk door fixture (features/webhooks/intake/.../intake.webhook.ts), which calls DeliveryService.receive.
const SERVICE = at("src/modules/domain/intake/delivery.service.ts")
const DOOR_IMPORT = `import "@features/webhooks/intake/transport/http/intake.webhook"\n\n`
// A plain domain service: no webhook door anywhere calls it.
const PLAIN = at("src/modules/domain/accounting/accounting-book.service.ts")
const head = `import type { Inbox } from "@modules/platform/inbox/inbox.port"
import type { Inbox as Lookalike } from "@modules/domain/order/lookalike.service"
import type { EntityManager } from "typeorm"
import type { EventBus } from "@modules/platform/event-bus/event-bus.port"
import { PaymentService as Processor } from "@modules/domain/payment"
import { CommandBus as Commands } from "@nestjs/cqrs"
`
const service = (body, { parameter = "eventId: string", inbox = "Inbox", className = "DeliveryService", door = true } = {}) => `${door ? DOOR_IMPORT : ""}${head}
export class ${className} {
    constructor(private readonly seen: ${inbox}, private readonly database: EntityManager, private readonly events: EventBus, private readonly processor: Processor, private readonly commands: Commands) {}
    async receive(${parameter}): Promise<void> { ${body} }
    private async work(): Promise<void> {}
}`
const claim = 'if (!(await this.seen.claim("provider", eventId))) return; await this.work()'
const transaction = (body) => `return this.database.transaction(async (tx) => { ${body} })`

test("R263 inbox rule is exported and enabled through the webhook law", () => {
    assert.equal(rules["webhook-inbox-key"], webhookInboxKey)
    assert.equal(recommended["starci-be/webhook-inbox-key"], "error")
    for (const message of Object.values(webhookInboxKey.meta.messages)) assert.match(message, /^\[BE_WEBHOOK_INBOX_KEY\] /)
})

for (const edition of ["lite", "full"]) {
    test(`webhook-inbox-key claims stable delivery ids and returns on replays in ${edition}`, () => {
        const hfs = hfsFromDeclaration({ ...appDeclaration("be", { ...BE_DECLARATION, patterns: ["webhooks"] }), edition }, TYPED_ROOT)
        assert.equal(hfs.edition, edition)
        const error = [{ messageId: "key" }]
        ruleTester({ root: TYPED_ROOT, hfs }).run("webhook-inbox-key", rules["webhook-inbox-key"], {
            valid: [
                { filename: SERVICE, code: service(claim) },
                ...["deliveryId", "messageId", "providerDeliveryId", "orderId", "notificationId"].map((name) => ({ filename: SERVICE, code: service(claim.replaceAll("eventId", name), { parameter: `${name}: string` }) })),
                { filename: SERVICE, code: service(claim, { parameter: 'eventId: string = "fallback"' }) },
                { filename: SERVICE, code: service('const fresh = await this.seen.claim("provider", eventId); if (!fresh) return; await this.work()') },
                { filename: SERVICE, code: service('if ((await this.seen.claim("provider", eventId)) === false) { return }; await this.work()') },
                { filename: SERVICE, code: service(transaction('if (!(await this.seen.claim("provider", eventId, tx))) return; await tx.save({ eventId })')) },
                { filename: SERVICE, code: service(transaction('if (!(await this.seen.claim("provider", eventId, tx))) return; await tx.save({ eventId }); await this.events.publish({ eventId }, tx)')) },
                { filename: SERVICE, code: service('return this.database.transaction("SERIALIZABLE", async (tx) => { if (!(await this.seen.claim("provider", eventId, tx))) return; await tx.save({ eventId }) })') },
                { filename: SERVICE, code: service(claim.replaceAll("eventId", "delivery.deliveryId"), { parameter: "delivery: { deliveryId: string }" }) },
                { filename: SERVICE, code: service(claim.replaceAll("eventId", "messageId"), { parameter: "{ messageId }: { messageId: string }" }) },
                { filename: SERVICE, code: service(claim.replaceAll("eventId", "deliveryId"), { parameter: "rawBody: string, signature: string, deliveryId: string" }) },
                { filename: SERVICE, code: service('const deliveryId = this.decode(rawBody); ' + claim.replaceAll("eventId", "deliveryId"), { parameter: "rawBody: string, signature: string" }).replace('private async work()', 'private decode(body: string): string { return body }; private async work()') },
                { filename: SERVICE, code: service(claim.replaceAll("eventId", "decoded.eventId"), { parameter: "input: { rawBody: string; signature: string }, decoded: { eventId: string }" }) },
                { filename: SERVICE, code: service(claim.replaceAll("eventId", "input.notificationId"), { parameter: "input: { notificationId: string }" }) },
                { filename: SERVICE, code: service(claim.replaceAll("eventId", "event.eventId"), { parameter: "event: { eventId: string }" }) },
                { filename: SERVICE, code: service('await this.work()', { parameter: "body: object" }) },
                { filename: SERVICE, code: service('await this.work()', { parameter: "scale: number, eventId: string" }) },
                { filename: SERVICE, code: service('await this.work()', { parameter: "rawBody: string, signature: string", className: "ProviderWebhookVerifier" }) },
                // Scoping: a domain service no webhook door reaches is never an intake, whatever its first parameter is called.
                { filename: PLAIN, code: service("await this.work()", { parameter: "workspaceId: string", door: false, className: "AccountingBookService" }).replace("receive(", "read(") },
                { filename: PLAIN, code: service("await this.work()", { parameter: "rawBody: string, signature: string", door: false, className: "AccountingBookService" }) },
                { filename: SERVICE, code: `${head}class Service { private async receive(eventId: string) {} protected async forward(deliveryId: string) {} static async replay(messageId: string) {} }` },
                { filename: at("src/features/webhooks/provider/transport/http/provider.webhook.ts"), code: service("await this.work()") },
                { filename: at("src/modules/domain/order/delivery.service.spec.ts"), code: service("await this.work()") },
                { filename: at("src/modules/platform/event-bus/event-bus.service.ts"), code: service("await this.work()") },
            ],
            invalid: [
                // Scoping: the same plain domain method, once a webhook door calls it, is an intake that must claim the inbox.
                { filename: SERVICE, code: service("await this.work()", { parameter: "workspaceId: string" }), errors: error },
                ...["eventId", "deliveryId", "messageId", "providerDeliveryId", "orderId", "notificationId"].map((name) => ({ filename: SERVICE, code: service('await this.work()', { parameter: `${name}: string` }), errors: error })),
                { filename: SERVICE, code: service("await this.work()", { parameter: "input: { notificationId: string }" }), errors: error },
                { filename: SERVICE, code: service("await this.work()", { parameter: "event: { eventId: string }" }), errors: error },
                { filename: SERVICE, code: service("await this.work()", { parameter: "delivery: { deliveryId: string }" }), errors: error },
                { filename: SERVICE, code: service("await this.work()", { parameter: "{ messageId }: { messageId: string }" }), errors: error },
                { filename: SERVICE, code: service("await this.work()", { parameter: "rawBody: string, signature: string" }), errors: error },
                { filename: SERVICE, code: service("await this.work()", { parameter: "input: { rawBody: string; signature: string }" }), errors: error },
                { filename: SERVICE, code: service(claim, { inbox: "Lookalike" }), errors: error },
                { filename: SERVICE, code: service('await this.work(); ' + claim), errors: error },
                { filename: SERVICE, code: service('this.work(); ' + claim), errors: error },
                { filename: SERVICE, code: service('this.processor.acceptNotification({ eventId }); ' + claim), errors: error },
                { filename: SERVICE, code: service('const started = this.work(); ' + claim), errors: error },
                { filename: SERVICE, code: service(claim.replace('return;', 'return this.work();')), errors: error },
                { filename: SERVICE, code: service(claim.replace('return;', 'return await this.work();')), errors: error },
                { filename: SERVICE, code: service('await this.seen.claim("provider", eventId); await this.work()'), errors: error },
                { filename: SERVICE, code: service(claim.replace('"provider", eventId', '"provider", "constant"')), errors: error },
                { filename: SERVICE, code: service('eventId = "constant"; ' + claim), errors: error },
                { filename: SERVICE, code: service('if (eventId) { ' + claim + " }"), errors: error },
                { filename: SERVICE, code: service('if (!(await this.seen.claim(String(this.work()), eventId))) return'), errors: error },
                { filename: SERVICE, code: service('const fresh = await this.seen.claim("provider", eventId); await this.work(); if (!fresh) return'), errors: error },
                { filename: SERVICE, code: service(transaction('if (!(await this.seen.claim("provider", eventId, this.database))) return; await tx.save({ eventId })')), errors: error },
                { filename: SERVICE, code: service(transaction('await tx.save({ eventId }); if (!(await this.seen.claim("provider", eventId, tx))) return')), errors: error },
                { filename: SERVICE, code: service('return this.database.transaction(async (tx) => { await tx.save({ eventId }) }, async (tx) => { if (!(await this.seen.claim("provider", eventId, tx))) return })'), errors: error },
                { filename: SERVICE, code: service('this.database.transaction(async (tx) => { if (!(await this.seen.claim("provider", eventId, tx))) return })'), errors: error },
                { filename: SERVICE, code: service('if (!(await this.seen.claim("provider", signature))) return', { parameter: "rawBody: string, signature: string" }), errors: error },
                { filename: SERVICE, code: service('if (!(await this.seen.claim("provider", rawBody))) return', { parameter: "rawBody: string, signature: string" }), errors: error },
                { filename: SERVICE, code: service('const deliveryId = "constant"; if (!(await this.seen.claim("provider", deliveryId))) return', { parameter: "rawBody: string, signature: string" }), errors: error },
                { filename: SERVICE, code: service('const deliveryId: string = "constant"; if (!(await this.seen.claim("provider", deliveryId))) return', { parameter: "rawBody: string, signature: string" }), errors: error },
                { filename: SERVICE, code: service('const deliveryId = signature; if (!(await this.seen.claim("provider", deliveryId))) return', { parameter: "rawBody: string, signature: string" }), errors: error },
                { filename: SERVICE, code: service('const started = this.work(); const deliveryId = this.decode(rawBody); if (!(await this.seen.claim("provider", deliveryId))) return', { parameter: "rawBody: string, signature: string" }).replace('private async work()', 'private decode(body: string): string { return body }; private async work()'), errors: error },
                ...['await this.processor.acceptNotification({ eventId })', 'await this.processor["acceptNotification"]({ eventId })', 'await this.commands.execute({ eventId })', 'await this.work()'].map((work) => ({
                    filename: SERVICE, code: service(transaction(`if (!(await this.seen.claim("provider", eventId, tx))) return; await tx.save({ eventId }); ${work}`)), errors: [{ messageId: "handoff" }],
                })),
                { filename: SERVICE, code: service(claim + '; const intake = { process: async () => this.work() }'), errors: [{ messageId: "handoff" }] },
                { filename: SERVICE, code: service(claim + '; const process = async () => this.work(); const intake = { process }'), errors: [{ messageId: "handoff" }] },
                { filename: SERVICE, code: service(claim + '; const intake = { ["process"]: async () => this.work() }'), errors: [{ messageId: "handoff" }] },
                { filename: SERVICE, code: service(claim + '; const intake = { async process() { return } }'), errors: [{ messageId: "handoff" }] },
                ...['const execute = this.commands.execute; await execute({ eventId })', 'const execute = this.commands.execute.bind(this.commands); await execute({ eventId })', 'const { execute } = this.commands; await execute({ eventId })', 'const receive = this.processor.acceptNotification; await receive({ eventId })', 'const receive = this.processor.acceptNotification.bind(this.processor); await receive({ eventId })', 'const work = async () => this.commands.execute({ eventId }); await work()'].map((work) => ({
                    filename: SERVICE, code: service(transaction(`if (!(await this.seen.claim("provider", eventId, tx))) return; ${work}`)), errors: [{ messageId: "handoff" }],
                })),
                { filename: SERVICE, code: service('const intake = async (tx: EntityManager) => { if (!(await this.seen.claim("provider", eventId, tx))) return; await this.processor.acceptNotification({ eventId }) }; return this.database.transaction(intake)'), errors: [{ messageId: "handoff" }, { messageId: "key" }] },
            ],
        })
    })
}
