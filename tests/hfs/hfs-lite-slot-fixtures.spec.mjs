import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Linter } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import { projectionShape } from '../../packages/eslint/be/projections.mjs';
import { capabilityModuleShape } from '../../packages/eslint/be/module-shape.mjs';
import { realtimeShape } from '../../packages/eslint/be/realtime.mjs';
import { hfsFromDeclaration } from '../../packages/eslint/be/lib/hfs.mjs';
import { openHfs } from '../../scripts/hfs/slots.mjs';
import { allowsFile } from '../../scripts/hfs/allows.mjs';
import { loadLiteFixture } from '../helpers/lite-slot-typescript.mjs';

const root = fileURLToPath(new URL('../fixtures/hfs-lite-slots/', import.meta.url));
const declaration = JSON.parse(fs.readFileSync(path.join(root, 'hfs.json'), 'utf8'));
const eventBus = 'src/modules/platform/event-bus';
const projection = 'src/modules/projections/order-summary';
const realtime = 'src/features/realtime/order-status';
const websocket = `${realtime}/transport/websocket`;
const envelope = { eventId: 'e-1', eventName: 'order.placed', payload: { orderId: 'o-1' } };

function databaseBoundary() {
  const { sql } = loadLiteFixture('src/modules/platform/database/database.sql.ts');
  return { sql, InjectPrimaryEntityManager: () => () => undefined };
}

function eventAdapter(manager) {
  const { EventBusService } = loadLiteFixture(`${eventBus}/event-bus.service.ts`, {
    '@modules/platform/database': databaseBoundary(),
  });
  return new EventBusService(manager);
}

function shapeFindings(relative, rule) {
  const filename = path.join(root, 'be', relative);
  return new Linter().verify(fs.readFileSync(filename, 'utf8'), [{
    files: ['**/*.ts'],
    languageOptions: { parser: tsParser, ecmaVersion: 2022, sourceType: 'module', parserOptions: { project: path.join(root, 'be/tsconfig.json'), tsconfigRootDir: path.join(root, 'be') } },
    settings: { starci: { hfs: hfsFromDeclaration(declaration, path.join(root, 'be')) } },
    plugins: { fixture: { rules: { shape: rule } } },
    rules: { 'fixture/shape': 'error' },
  }], { filename });
}

test('lite adapter fixtures occupy the enabled exact slots and satisfy each required file', () => {
  const hfs = openHfs({ declaration, side: 'be' });
  assert.equal(declaration.edition, 'lite');
  for (const [directory, slot] of [[realtime, 'be.feature.realtime'], [websocket, 'be.feature.realtime.websocket'], [eventBus, 'be.platform.event-bus'], [projection, 'be.projections']]) {
    assert.equal(hfs.classifyPath(`${directory}/index.ts`).slot, slot);
    for (const relative of hfs.requiredFiles(`${directory}/`)) {
      assert.ok(fs.existsSync(path.join(root, 'be', relative)), relative);
    }
  }
  for (const file of ['order-summary.projection.ts', 'persistence/order-summary.rows.ts']) {
    assert.equal(allowsFile(hfs, `${projection}/${file}`).allowed, true);
  }
  assert.equal(hfs.classifyPath(`${projection}/order-summary.projection.spec.ts`).slot, 'be.projections');
  assert.equal(fs.existsSync(path.join(root, 'be', projection, 'order-summary.projection-entity.ts')), false);
  assert.deepEqual(shapeFindings(`${projection}/order-summary.projection.ts`, projectionShape), []);
  assert.deepEqual(shapeFindings(`${projection}/order-summary.module.ts`, capabilityModuleShape), []);
  assert.deepEqual(shapeFindings(`${eventBus}/event-bus.module.ts`, capabilityModuleShape), []);
  assert.deepEqual(shapeFindings(`${websocket}/order-status.gateway.ts`, realtimeShape), []);
});

test('lite event publisher writes the durable envelope in the caller transaction without delivering it', async () => {
  const written = [];
  const tx = { async query(statement, params) { written.push({ statement, params }); } };
  const service = eventAdapter({ query: () => assert.fail('the shared manager must not replace the caller transaction') });
  await service.publish(envelope, tx);
  assert.equal(written.length, 1);
  assert.match(written[0].statement, /INSERT INTO public.event_bus/);
  assert.deepEqual(written[0].params, [envelope.eventId, envelope.eventName, JSON.stringify(envelope)]);
});

function relayDatabase(failQueue) {
  const state = { outbox: [{ event_id: envelope.eventId, event_name: envelope.eventName, payload: envelope }], sent: [] };
  const manager = { async transaction(run) {
    const sent = [];
    const removed = [];
    const tx = { async query(statement, params) {
      if (statement.includes('SELECT event_id')) return state.outbox;
      if (statement.includes('pgmq.send')) {
        if (params[0] === failQueue) throw new Error('queue unavailable');
        sent.push(params);
      }
      if (statement.includes('DELETE FROM public.event_bus')) removed.push(params[0]);
      return [];
    } };
    await run(tx);
    state.sent.push(...sent);
    state.outbox = state.outbox.filter((row) => !removed.includes(row.event_id));
  } };
  return { state, manager };
}

test('lite event relay fans out once per consumer group and rolls back failed fanout', async () => {
  const { ORDER_EVENT_ROUTES } = loadLiteFixture(`${eventBus}/event-bus.contracts.ts`);
  const successful = relayDatabase();
  await eventAdapter(successful.manager).relay(ORDER_EVENT_ROUTES);
  assert.deepEqual(successful.state.sent, [
    ['order_notifications', JSON.stringify(envelope)], ['order_metrics', JSON.stringify(envelope)],
  ]);
  assert.deepEqual(successful.state.outbox, []);
  const failing = relayDatabase('order_metrics');
  await assert.rejects(eventAdapter(failing.manager).relay(ORDER_EVENT_ROUTES), /queue unavailable/);
  assert.deepEqual(failing.state.sent, []);
  assert.equal(failing.state.outbox[0].event_id, envelope.eventId);
  const unmatched = relayDatabase();
  await eventAdapter(unmatched.manager).relay([]);
  assert.equal(unmatched.state.outbox.length, 1);
});

function queueDatabase(attempt) {
  const observed = [];
  const manager = { async query(statement, params) {
    observed.push({ statement, params });
    if (statement.includes('pgmq.read')) return [{ msg_id: '7', read_ct: attempt, message: envelope }];
    return [];
  } };
  return { manager, observed };
}

test('lite pgmq delivery retains the stable id, leaves failed leases for retry and archives exhausted messages', async () => {
  const deliveries = [];
  const consumer = { event: { parse: (value) => value }, handle: async (delivery) => { deliveries.push(delivery); } };
  const success = queueDatabase(2);
  await eventAdapter(success.manager).consume('order_notifications', consumer, 45, 3);
  assert.deepEqual(success.observed[0].params, ['order_notifications', 45]);
  assert.deepEqual(deliveries, [{ eventId: envelope.eventId, event: envelope, attempt: 2 }]);
  assert.match(success.observed[1].statement, /pgmq.delete/);
  assert.deepEqual(success.observed[1].params, ['order_notifications', '7']);
  const retry = queueDatabase(1);
  await assert.rejects(eventAdapter(retry.manager).consume('order_notifications', {
    event: consumer.event, handle: async () => { throw new Error('receiver unavailable'); },
  }), /receiver unavailable/);
  assert.equal(retry.observed.length, 1);
  const exhausted = queueDatabase(4);
  await eventAdapter(exhausted.manager).consume('order_notifications', consumer);
  assert.match(exhausted.observed[1].statement, /pgmq.archive/);
  assert.equal(deliveries.length, 1);
});

test('lite SQL projection recomputes with an idempotent upsert and exposes typed reads', async () => {
  const calls = [];
  let rows = [{ buyer_id: 'buyer-1', order_count: 2 }];
  const { OrderSummaryProjection } = loadLiteFixture(`${projection}/order-summary.projection.ts`, {
    '@modules/platform/database': databaseBoundary(),
  });
  const readModel = new OrderSummaryProjection({ async query(statement, params) { calls.push({ statement, params }); return rows; } });
  await readModel.recomputeOrderSummary('buyer-1');
  await readModel.recomputeOrderSummary('buyer-1');
  assert.deepEqual(calls[0], calls[1]);
  assert.match(calls[0].statement, /ON CONFLICT \(buyer_id\) DO UPDATE/);
  assert.match(calls[0].statement, /FROM public.orders/);
  assert.deepEqual(await readModel.getOrderSummary('buyer-1'), { buyerId: 'buyer-1', orderCount: 2 });
  rows = [];
  assert.equal(await readModel.getOrderSummary('absent'), null);
  const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20261015000100_lite_slot_adapters.sql'), 'utf8');
  assert.match(migration, /create table public.order_summary/);
  assert.match(migration, /pgmq.create\('order_notifications'\)/);
  assert.match(migration, /pgmq.create\('order_metrics'\)/);
});

function socketBoundary() {
  let middleware;
  let connect;
  let disconnect;
  let complete;
  const pushed = new Promise((resolve) => { complete = resolve; });
  const emitted = [];
  const socket = {
    id: 'socket-1', connected: true, handshake: { auth: { accessToken: 'signed-token', principal: { id: 'foreign' } } }, data: {},
    emit: (event, frame) => { emitted.push({ event, frame }); complete(); },
    once: (_event, listener) => { disconnect = listener; },
    disconnect: () => { socket.connected = false; disconnect?.(); },
  };
  const namespace = { use: (handler) => { middleware = handler; }, on: (_event, handler) => { connect = handler; } };
  return { socket, namespace, pushed, emitted,
    authenticate: () => new Promise((resolve, reject) => middleware(socket, (error) => {
      if (error) reject(error);
      else resolve();
    })),
    connect: () => connect(socket),
  };
}

function realtimeAdapter(verify) {
  const { MemoryRealtimeHubService } = loadLiteFixture('src/modules/platform/realtime/memory-realtime-hub.service.ts');
  const hub = new MemoryRealtimeHubService();
  const { OrderStatusGateway } = loadLiteFixture(`${websocket}/order-status.gateway.ts`);
  const { OrderStatusWebsocketModule } = loadLiteFixture(`${websocket}/order-status-websocket.module.ts`);
  const { orderStatusTopic } = loadLiteFixture('src/modules/domain/order/order-status.contracts.ts');
  const boundary = socketBoundary();
  const gateway = new OrderStatusGateway(hub);
  gateway.namespace = boundary.namespace;
  const transport = new OrderStatusWebsocketModule(gateway, verify);
  transport.onModuleInit();
  return { hub, transport, boundary, orderStatusTopic };
}

test('lite in-process realtime authenticates, isolates the principal topic, pushes and releases its stream', async () => {
  const tokens = [];
  const principal = { id: 'buyer-1', role: 'authenticated' };
  const { hub, transport, boundary, orderStatusTopic } = realtimeAdapter(async (token) => { tokens.push(token); return { kind: 'ok', value: principal }; });
  await boundary.authenticate();
  boundary.connect();
  assert.deepEqual(tokens, ['signed-token']);
  assert.deepEqual(boundary.socket.data.principal, principal);
  assert.equal(hub.subscriberCount(orderStatusTopic('foreign')), 0);
  hub.publish(orderStatusTopic('foreign'), { id: 'forbidden' });
  hub.publish(orderStatusTopic('buyer-1'), { id: 'order-1' });
  await boundary.pushed;
  assert.deepEqual(boundary.emitted, [{ event: 'orderStatusChanged', frame: { id: 'order-1' } }]);
  boundary.socket.disconnect();
  await transport.onModuleDestroy();
  assert.equal(hub.subscriberCount(orderStatusTopic('buyer-1')), 0);
});

test('lite realtime refuses invalid tokens and clears unverified principal claims before opening a stream', async () => {
  const { hub, transport, boundary, orderStatusTopic } = realtimeAdapter(async () => ({ kind: 'refused', code: 'ACCESS_TOKEN_INVALID' }));
  boundary.socket.data.principal = { id: 'forged', role: 'authenticated' };
  await assert.rejects(boundary.authenticate(), /Unauthorized/);
  assert.equal(boundary.socket.data.principal, undefined);
  boundary.connect();
  assert.equal(boundary.socket.connected, false);
  assert.equal(hub.subscriberCount(orderStatusTopic('forged')), 0);
  await transport.onModuleDestroy();
});