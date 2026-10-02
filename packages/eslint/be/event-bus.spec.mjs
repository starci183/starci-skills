/**
 * Twin tests for the event-bus and queue laws (R132 `BE_OUTBOX_WRITE_TX`, R133 `BE_EVENT_CONSUMER_SHAPE`, R134 `BE_QUEUE_PRODUCER_SHAPE`).
 *
 *   node --test event-bus.spec.mjs
 *
 * The fixture project declares the `EventBus`, `EventConsumer`, `EventDelivery` (platform/event-bus) and `QueueOutbox` (platform/queue)
 * stand-ins; a case's path decides its slot and tier.
 */
import assert from "node:assert/strict"
import test from "node:test"
import { at, BE_DECLARATION, typedTester } from "./fixtures/typed/tester.mjs"
import { eventConsumerShape, outboxWriteTx, queueProducerShape, rules } from "./event-bus.mjs"

const tester = typedTester({ declaration: { ...BE_DECLARATION, patterns: ["event-bus", "queue"] } })

const DOMAIN = at("src/modules/domain/order/placing.service.ts")
const DOMAIN_SPEC = at("src/modules/domain/order/placing.service.spec.ts")
const FEATURE = at("src/features/checkout/application/place-order.handler.ts")
const INTEGRATION = at("src/modules/integrations/foo/foo.client.ts")
const CONSUMER = at("src/features/checkout/transport/message/order-placed.consumer.ts")
const MISNAMED = at("src/features/checkout/transport/message/placed.consumer.ts")
const NOT_TRANSPORT = at("src/features/checkout/application/order-placed.consumer.ts")
const QUEUE = at("src/modules/queues/mail/mail.queue.ts")
const WORLD = at("src/tests/world/use-test-world.ts")

const HEAD = `import type { EntityManager } from "typeorm"
import type { EventBus } from "@modules/platform/event-bus"
import { OrderPlacedEvent } from "@modules/events/order"
import { MailQueue } from "@modules/queues/mail"
`

test("every rule this law declares is exported under its published name", () => {
    for (const [name, rule] of Object.entries(rules)) assert.ok(rule && rule.meta && rule.create, `${name} is not a rule`)
})

test("outbox-write-tx: the outbox is written only by a domain service, with its own transaction manager", () => {
    tester.run("outbox-write-tx", outboxWriteTx, {
        valid: [
            { filename: DOMAIN, code: `${HEAD}export class Placing { constructor(private readonly em: EntityManager, private readonly bus: EventBus, private readonly mail: MailQueue) {}\n async place(): Promise<void> { await this.em.transaction(async (manager) => { await this.bus.publish(new OrderPlacedEvent("e", "o"), manager); await this.mail.enqueueMail({ to: "a" }, manager) }) } }` },
            { filename: DOMAIN, code: `${HEAD}export class Placing { constructor(private readonly bus: EventBus) {}\n async inside(tx: EntityManager): Promise<void> { await this.bus.publish(new OrderPlacedEvent("e", "o"), tx) } }` },
            { filename: DOMAIN, code: `${HEAD}export class Placing { constructor(private readonly em: EntityManager, private readonly bus: EventBus) {}\n async read(): Promise<number> { return this.bus.pendingRetries(OrderPlacedEvent) } }` },
            { filename: DOMAIN_SPEC, code: `${HEAD}export const probe = async (bus: EventBus, tx: EntityManager): Promise<void> => { await bus.publish(new OrderPlacedEvent("e", "o"), tx) }` },
            { filename: WORLD, code: `${HEAD}export const emit = async (bus: EventBus, tx: EntityManager): Promise<void> => { await bus.publish(new OrderPlacedEvent("e", "o"), tx) }` },
            { filename: FEATURE, code: `import type { EventBus } from "@modules/platform/event-bus"\nimport { OrderPlacedEvent } from "@modules/events/order"\nexport const waiting = (bus: EventBus): Promise<number> => bus.pendingRetries(OrderPlacedEvent)` },
        ],
        invalid: [
            { filename: FEATURE, code: `${HEAD}export class Handler { constructor(private readonly bus: EventBus) {}\n async run(tx: EntityManager): Promise<void> { await this.bus.publish(new OrderPlacedEvent("e", "o"), tx) } }`, errors: [{ messageId: "foreignTier" }] },
            { filename: INTEGRATION, code: `${HEAD}export class Client { constructor(private readonly mail: MailQueue) {}\n async run(tx: EntityManager): Promise<void> { await this.mail.enqueueMail({ to: "a" }, tx) } }`, errors: [{ messageId: "foreignTier" }] },
            { filename: DOMAIN, code: `${HEAD}export class Placing { constructor(private readonly em: EntityManager, private readonly bus: EventBus) {}\n async place(): Promise<void> { await this.bus.publish(new OrderPlacedEvent("e", "o"), this.em) } }`, errors: [{ messageId: "noTransaction" }] },
            { filename: DOMAIN, code: `${HEAD}export class Placing { constructor(private readonly em: EntityManager, private readonly bus: EventBus) {}\n async place(): Promise<void> { const alias = this.em; await this.bus.publish(new OrderPlacedEvent("e", "o"), alias) } }`, errors: [{ messageId: "noTransaction" }] },
            { filename: DOMAIN, code: `${HEAD}export class Placing { constructor(private readonly em: EntityManager, private readonly mail: MailQueue) {}\n async place(): Promise<void> { await this.em.transaction(async (manager) => { await manager.query("x"); await this.mail.enqueueMail({ to: "a" }, this.em) }) } }`, errors: [{ messageId: "noTransaction" }] },
            { filename: DOMAIN, code: `${HEAD}export class Placing { constructor(private readonly bus: EventBus) {}\n async place(): Promise<void> { await this.bus.publish(new OrderPlacedEvent("e", "o")) } }`, errors: [{ messageId: "noTransaction" }] },
        ],
    })
})

const CONSUMER_HEAD = `import { Injectable } from "@nestjs/common"
import type { EventConsumer, EventDelivery } from "@modules/platform/event-bus"
import { OrderPlacedEvent } from "@modules/events/order"
`

test("event-consumer-shape: a consumer is a transport door named after its event that forwards the event id", () => {
    tester.run("event-consumer-shape", eventConsumerShape, {
        valid: [
            { filename: CONSUMER, code: `${CONSUMER_HEAD}@Injectable()\nexport class OrderPlacedConsumer implements EventConsumer<OrderPlacedEvent> {\n readonly event = OrderPlacedEvent\n async handle(delivery: EventDelivery<OrderPlacedEvent>): Promise<void> { void delivery.eventId } }` },
            { filename: DOMAIN, code: `export class NotAConsumer { handle(): void {} }` },
        ],
        invalid: [
            { filename: NOT_TRANSPORT, code: `${CONSUMER_HEAD}export class OrderPlacedConsumer implements EventConsumer<OrderPlacedEvent> {\n readonly event = OrderPlacedEvent\n async handle(delivery: EventDelivery<OrderPlacedEvent>): Promise<void> { void delivery.eventId } }`, errors: [{ messageId: "placement" }] },
            { filename: MISNAMED, code: `${CONSUMER_HEAD}export class PlacedConsumer implements EventConsumer<OrderPlacedEvent> {\n readonly event = OrderPlacedEvent\n async handle(delivery: EventDelivery<OrderPlacedEvent>): Promise<void> { void delivery.eventId } }`, errors: [{ messageId: "stem" }] },
            { filename: CONSUMER, code: `${CONSUMER_HEAD}export class OrderPlacedConsumer implements EventConsumer<OrderPlacedEvent> {\n readonly event = OrderPlacedEvent\n async handle(delivery: EventDelivery<OrderPlacedEvent>): Promise<void> { void delivery.attempt } }`, errors: [{ messageId: "noEventId" }] },
            { filename: CONSUMER, code: `${CONSUMER_HEAD}export class OrderPlacedConsumer implements EventConsumer<OrderPlacedEvent> {\n readonly event = { eventName: "order.placed", version: 1, parse: OrderPlacedEvent.parse }\n async handle(delivery: EventDelivery<OrderPlacedEvent>): Promise<void> { void delivery.eventId } }`, errors: [{ messageId: "eventUnknown" }] },
            { filename: CONSUMER, code: `export class Plain { run(): number { return 1 } }`, errors: [{ messageId: "notConsumer" }] },
        ],
    })
})

const QUEUE_HEAD = `import type { EntityManager } from "typeorm"
import type { QueueOutbox } from "@modules/platform/queue"
`

test("queue-producer-shape: a producer passes its own transaction parameter to the outbox", () => {
    tester.run("queue-producer-shape", queueProducerShape, {
        valid: [
            { filename: QUEUE, code: `${QUEUE_HEAD}export class MailQueue { constructor(private readonly outbox: QueueOutbox) {}\n enqueueMail(payload: { to: string }, tx: EntityManager): Promise<void> { return this.outbox.write(tx, "mail", payload) } }` },
            { filename: QUEUE, code: `${QUEUE_HEAD}export class MailQueue { constructor(private readonly outbox: QueueOutbox) {}\n label(): string { return "mail" } }` },
            { filename: QUEUE, code: `export const queueName = (): string => "mail"` },
            { filename: DOMAIN, code: `${QUEUE_HEAD}export class Other { constructor(private readonly outbox: QueueOutbox) {}\n run(tx: EntityManager): Promise<void> { return this.outbox.write(this as never, "x", {}) } }` },
        ],
        invalid: [
            { filename: QUEUE, code: `${QUEUE_HEAD}export class MailQueue { constructor(private readonly outbox: QueueOutbox, private readonly em: EntityManager) {}\n enqueueMail(payload: { to: string }): Promise<void> { return this.outbox.write(this.em, "mail", payload) } }`, errors: [{ messageId: "noTransaction" }] },
            { filename: QUEUE, code: `${QUEUE_HEAD}export class MailQueue { constructor(private readonly outbox: QueueOutbox) {}\n enqueueMail(payload: { to: string }, tx: EntityManager, other: EntityManager): Promise<void> { return this.outbox.write(other, "mail", payload) } }`, errors: [{ messageId: "noTransaction" }] },
            { filename: QUEUE, code: `${QUEUE_HEAD}export const enqueue = (outbox: QueueOutbox, payload: object): Promise<void> => outbox.write(undefined as never, "mail", payload)`, errors: [{ messageId: "noTransaction" }] },
        ],
    })
})
