import test from 'node:test';
import assert from 'node:assert/strict';
import { openHfs } from '../../scripts/hfs/slots.mjs';
import { allowsFile } from '../../scripts/hfs/allows.mjs';

// The slots of the webhooks and realtime feature kinds (be.feature.webhooks, be.feature.realtime): enabled only by the declared patterns
// `webhooks` and `realtime` (hfs.json sides.be.patterns), one folder per provider or channel, only the files of the kind, each owned by its
// kind slot, and the old websocket transport slot is gone.

const BE_SIDE = { apps: [{ name: 'core', kind: 'api' }] };
const FE_SIDE = { apps: [{ name: 'web', kind: 'next' }] };
const declaration = (patterns) => ({ hfs: 2, kind: 'app', project: 'shop', sides: { be: { ...BE_SIDE, ...(patterns ? { patterns } : {}) }, fe: FE_SIDE } });
const classify = (patterns, file) => {
  const c = openHfs({ declaration: declaration(patterns), side: 'be' }).classifyPath(file);
  return `${c.status}:${c.slot ?? ''}`;
};

const WEBHOOK_FILES = {
  'src/features/webhooks/sepay/index.ts': 'be.feature.webhooks',
  'src/features/webhooks/sepay/transport/http/sepay-http.module.ts': 'be.feature.webhooks.http',
  'src/features/webhooks/sepay/transport/http/sepay.webhook.ts': 'be.feature.webhooks.http',
  'src/features/webhooks/sepay/transport/http/sepay.webhook.spec.ts': 'be.feature.webhooks.http',
  'src/features/webhooks/sepay/transport/http/dto/sepay-transfer.request.ts': 'be.feature.webhooks.dto',
};
const REALTIME_FILES = {
  'src/features/realtime/order-status/index.ts': 'be.feature.realtime',
  'src/features/realtime/order-status/transport/graphql/order-status-graphql.module.ts': 'be.feature.realtime.graphql',
  'src/features/realtime/order-status/transport/graphql/order-status.subscription.ts': 'be.feature.realtime.graphql',
  'src/features/realtime/order-status/transport/graphql/order-status.subscription.spec.ts': 'be.feature.realtime.graphql',
  'src/features/realtime/chat/transport/websocket/chat.gateway.ts': 'be.feature.realtime.websocket',
  'src/features/realtime/chat/transport/websocket/chat.gateway.spec.ts': 'be.feature.realtime.websocket',
  'src/features/realtime/order-status/transport/graphql/dto/order-status-changed.type.ts': 'be.feature.realtime.dto',
};

test('a webhook folder is owned by the webhooks slot once the pattern is declared', () => {
  for (const [file, slot] of Object.entries(WEBHOOK_FILES)) assert.equal(classify(['webhooks'], file), `owned:${slot}`, file);
});

test('a webhook or realtime folder is HFS_SLOT_NOT_ENABLED while its pattern is undeclared, and each pattern enables only its kind', () => {
  assert.equal(classify(undefined, 'src/features/webhooks/sepay/transport/http/sepay.webhook.ts'), 'not-enabled:be.feature.webhooks.http');
  assert.equal(classify(['realtime'], 'src/features/webhooks/sepay/transport/http/sepay.webhook.ts'), 'not-enabled:be.feature.webhooks.http');
  assert.equal(classify(undefined, 'src/features/realtime/chat/transport/websocket/chat.gateway.ts'), 'not-enabled:be.feature.realtime.websocket');
  assert.equal(classify(['webhooks'], 'src/features/realtime/chat/transport/websocket/chat.gateway.ts'), 'not-enabled:be.feature.realtime.websocket');
});

test('a realtime folder is owned by the realtime slot once the pattern is declared', () => {
  for (const [file, slot] of Object.entries(REALTIME_FILES)) assert.equal(classify(['realtime'], file), `owned:${slot}`, file);
});

test('a kind folder admits only the files of its kind: no service, handler, consumer or controller beside a door (BE_FEATURE_SHAPE reads this)', () => {
  const resolver = openHfs({ declaration: declaration(['webhooks', 'realtime']), side: 'be' });
  for (const file of Object.keys({ ...WEBHOOK_FILES, ...REALTIME_FILES })) assert.equal(allowsFile(resolver, file).allowed, true, file);
  for (const file of [
    'src/features/webhooks/sepay/sepay.service.ts',
    'src/features/webhooks/sepay/transport/http/sepay.controller.ts',
    'src/features/webhooks/sepay/transport/http/sepay.mapper.ts',
    'src/features/webhooks/sepay/transport/http/dto/sepay-transfer.response.ts',
    'src/features/realtime/chat/transport/graphql/chat.resolver.ts',
    'src/features/realtime/chat/chat.service.ts',
    'src/features/realtime/chat/transport/graphql/dto/chat.request.ts',
  ]) assert.equal(allowsFile(resolver, file).allowed, false, file);
  for (const file of [
    'src/features/webhooks/sepay/application/accept.handler.ts',
    'src/features/webhooks/sepay/transport/message/paid.consumer.ts',
    'src/features/realtime/chat/application/send.handler.ts',
  ]) assert.equal(classify(['webhooks', 'realtime'], file).split(':')[0], 'owned', `${file} falls to its kind slot, whose allows list refuses the folder`);
});

test('the kind slots carry the trigger of their kind and the old websocket transport slot is gone', () => {
  const { manifest } = openHfs({ declaration: declaration(['webhooks', 'realtime']), side: 'be' });
  const byId = new Map(manifest.slots.map((slot) => [slot.id, slot]));
  assert.equal(byId.get('be.feature.webhooks').trigger, 'webhooks');
  assert.equal(byId.get('be.feature.realtime').trigger, 'realtime');
  assert.equal(byId.get('be.feature.webhooks').pattern, 'webhooks');
  assert.equal(byId.get('be.feature.realtime').pattern, 'realtime');
  assert.equal(byId.has('be.transport.websocket'), false);
  assert.equal(classify(undefined, 'src/features/chat/transport/websocket/chat.gateway.ts'), 'owned:be.feature', 'a websocket folder of an api feature is owned by no transport slot: BE_FEATURE_SHAPE refuses it');
});
