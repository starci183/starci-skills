// proves: BE_SAGA_CONSUMER_DEDUPE@lite BE_SAGA_CONSUMER_DEDUPE@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { sagaFindings } from '../runtime/scripts/hfs/rules/saga.mjs';

const STATE = 'be/src/features/saga/place/place.saga-state.ts';
const CONSUMER = 'be/src/features/saga/place/transport/message/cancel.consumer.ts';
// Consumers in the shape the saga pattern ships: the delivery id is forwarded into the command the consumer dispatches.
const SHIPPED_CONSUMERS = [
  'export class PaymentDoneConsumer { constructor(private readonly commandBus: CommandBus) {} async handle(delivery: EventDelivery<PaymentDoneEvent>): Promise<void> { await this.commandBus.execute(new CompleteOrderCommand({ request: { id: delivery.event.payload.id, eventId: delivery.eventId } })); } }',
  'export class PaymentFailedConsumer { constructor(private readonly commandBus: CommandBus) {} async handle(delivery: EventDelivery<PaymentFailedEvent>): Promise<void> { await this.commandBus.execute(new CompensateOrderCommand({ request: { id: delivery.event.payload.id, eventId: delivery.eventId } })); } }',
];

function check(edition, body, source = `export class Consumer { handle(message: Delivery) { ${body} } }`) {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-saga-dedupe-'));
  const sources = {
    [STATE]: 'export interface State { status: string; version: number; }',
    [CONSUMER]: source,
  };
  try {
    for (const [file, text] of Object.entries(sources)) {
      const target = path.join(repoRoot, file);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, text);
    }
    return sagaFindings({ repoRoot, files: Object.keys(sources), repo: { edition } })
      .filter((finding) => finding.code === 'BE_SAGA_CONSUMER_DEDUPE');
  } finally {
    fs.rmSync(repoRoot, { recursive: true, force: true });
  }
}

for (const edition of ['lite', 'full']) {
  test(`${edition} BE_SAGA_CONSUMER_DEDUPE passes delivery key forwarded to command`, () => {
    assert.deepEqual(check(edition, 'return this.commandBus.execute(new CancelOrder({ request: { eventId: message.eventId } }));'), []);
    assert.deepEqual(check(edition, 'const eventId = message.eventId; const request = { eventId }; const command = new CancelOrder({ request }); return this.commandBus.execute(command);'), []);
  });
  test(`${edition} BE_SAGA_CONSUMER_DEDUPE passes consumers in the shipped shape and rendered templates`, () => {
    const sources = SHIPPED_CONSUMERS.slice();
    for (const kind of ['done', 'failed']) {
      sources.push(fs.readFileSync(path.resolve(import.meta.dirname, '..', 'templates', 'be', 'patterns', 'saga', `saga.${kind}.consumer.ts.tpl`), 'utf8').replaceAll(/@@\w+@@/g, 'Sample'));
    }
    assert.ok(sources.length >= 4);
    for (const source of sources) assert.deepEqual(check(edition, '', source), []);
  });
  test(`${edition} BE_SAGA_CONSUMER_DEDUPE refuses discarded or unrelated eventId reads`, () => {
    for (const body of [
      'const ignored = message.eventId; return this.commandBus.execute(new CancelOrder({ id: message.id }));',
      'return message.eventId;',
      'return this.commandBus.execute(new CancelOrder({ eventId: other.eventId }));',
      'return this.commandBus.execute(new CancelOrder({ id: "literal.eventId" }));',
      'return this.commandBus.execute(new CancelOrder({ id: "constant" })); // message.eventId',
      'this.commandBus.execute(new CancelOrder({ eventId: message.eventId })); this.commandBus.execute(new OtherCommand({}));',
      'const request = { request }; return this.commandBus.execute(new CancelOrder(request));',
    ]) {
      assert.ok(check(edition, body).some((finding) => finding.code === 'BE_SAGA_CONSUMER_DEDUPE'), body);
    }
  });
}
