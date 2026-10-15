// proves: BE_OUTBOX_WRITE_TX@lite
// proves: BE_OUTBOX_WRITE_TX@full
// proves: BE_EVENT_CONSUMER_SHAPE@lite
// proves: BE_EVENT_CONSUMER_SHAPE@full
// proves: BE_QUEUE_PRODUCER_SHAPE@lite
// proves: BE_QUEUE_PRODUCER_SHAPE@full
import test from 'node:test';
import assert from 'node:assert/strict';
import { at, BE_DECLARATION, ruleTester, TYPED_ROOT } from './fixtures/typed/tester.mjs';
import { appDeclaration } from './fixtures/app.mjs';
import { hfsFromDeclaration } from './lib/hfs.mjs';
import { eventConsumerShape, outboxWriteTx, queueProducerShape } from './event-bus.mjs';

const domain = at('src/modules/domain/order/placing.service.ts');
const feature = at('src/features/api/checkout/application/place-order.handler.ts');
const consumer = at('src/features/api/checkout/transport/message/order-placed.consumer.ts');
const queue = at('src/modules/queues/mail/mail.queue.ts');
const eventImports = `import type { EntityManager } from "typeorm";
import type { EventBus } from "@modules/platform/event-bus";
import { OrderPlacedEvent } from "@modules/events/order";
`;
const consumerImports = `import type { EventConsumer, EventDelivery } from "@modules/platform/event-bus";
import { OrderPlacedEvent } from "@modules/events/order";
`;
const queueImports = `import type { EntityManager } from "typeorm";
import type { QueueOutbox } from "@modules/platform/queue";
`;

for (const edition of ['lite', 'full']) {
  const declaration = { ...appDeclaration('be', { ...BE_DECLARATION, patterns: ['event-bus', 'queue'] }), edition };
  const hfs = hfsFromDeclaration(declaration, TYPED_ROOT);
  const tester = ruleTester({ root: TYPED_ROOT, hfs });

  test(`${edition} outbox-write-tx accepts domain transactions and rejects foreign or shared managers`, () => {
    assert.equal(hfs.edition, edition);
    tester.run('outbox-write-tx', outboxWriteTx, {
      valid: [
        { filename: domain, code: eventImports + 'export class Placing { constructor(private readonly em: EntityManager, private readonly bus: EventBus) {} async place(): Promise<void> { await this.em.transaction(async (manager) => { await this.bus.publish(new OrderPlacedEvent("e", "o"), manager); }); } }' },
        { filename: domain, code: eventImports + 'export class Placing { constructor(private readonly bus: EventBus) {} async inside(tx: EntityManager): Promise<void> { await this.bus.publish(new OrderPlacedEvent("e", "o"), tx); } }' },
      ],
      invalid: [
        { filename: feature, code: eventImports + 'export class Handler { constructor(private readonly bus: EventBus) {} async run(tx: EntityManager): Promise<void> { await this.bus.publish(new OrderPlacedEvent("e", "o"), tx); } }', errors: [{ messageId: 'foreignTier' }] },
        { filename: domain, code: eventImports + 'export class Placing { constructor(private readonly em: EntityManager, private readonly bus: EventBus) {} async place(): Promise<void> { await this.bus.publish(new OrderPlacedEvent("e", "o"), this.em); } }', errors: [{ messageId: 'noTransaction' }] },
      ],
    });
  });

  test(`${edition} event-consumer-shape accepts typed message doors and rejects missing ids or misplaced consumers`, () => {
    assert.equal(hfs.edition, edition);
    tester.run('event-consumer-shape', eventConsumerShape, {
      valid: [
        { filename: consumer, code: consumerImports + 'export class OrderPlacedConsumer implements EventConsumer<OrderPlacedEvent> { readonly event = OrderPlacedEvent; async handle(delivery: EventDelivery<OrderPlacedEvent>): Promise<void> { void delivery.eventId; } }' },
      ],
      invalid: [
        { filename: consumer, code: consumerImports + 'export class OrderPlacedConsumer implements EventConsumer<OrderPlacedEvent> { readonly event = OrderPlacedEvent; async handle(delivery: EventDelivery<OrderPlacedEvent>): Promise<void> { void delivery.attempt; } }', errors: [{ messageId: 'noEventId' }] },
        { filename: at('src/features/api/checkout/application/order-placed.consumer.ts'), code: consumerImports + 'export class OrderPlacedConsumer implements EventConsumer<OrderPlacedEvent> { readonly event = OrderPlacedEvent; async handle(delivery: EventDelivery<OrderPlacedEvent>): Promise<void> { void delivery.eventId; } }', errors: [{ messageId: 'placement' }] },
      ],
    });
  });

  test(`${edition} queue-producer-shape accepts its transaction parameter and rejects a different manager`, () => {
    assert.equal(hfs.edition, edition);
    tester.run('queue-producer-shape', queueProducerShape, {
      valid: [
        { filename: queue, code: queueImports + 'export class MailQueue { constructor(private readonly outbox: QueueOutbox) {} enqueueMail(payload: { to: string }, tx: EntityManager): Promise<void> { return this.outbox.write(tx, "mail", payload); } }' },
      ],
      invalid: [
        { filename: queue, code: queueImports + 'export class MailQueue { constructor(private readonly outbox: QueueOutbox, private readonly em: EntityManager) {} enqueueMail(payload: { to: string }): Promise<void> { return this.outbox.write(this.em, "mail", payload); } }', errors: [{ messageId: 'noTransaction' }] },
        { filename: queue, code: queueImports + 'export class MailQueue { constructor(private readonly outbox: QueueOutbox) {} enqueueMail(payload: { to: string }, tx: EntityManager, other: EntityManager): Promise<void> { return this.outbox.write(other, "mail", payload); } }', errors: [{ messageId: 'noTransaction' }] },
      ],
    });
  });
}
