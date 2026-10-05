import { test } from 'node:test';
import assert from 'node:assert/strict';
import { firstJson, watchOptions, snapshot } from '../../scripts/reconciler/core-watch.mjs';

test('firstJson reads the first balanced object after a banner and ignores braces in strings', () => {
  assert.deepEqual(firstJson('banner\n{"a":"}{","b":{"c":1}} trailing {"x":2}'), { a: '}{', b: { c: 1 } });
  assert.equal(firstJson('no json here'), null);
});

test('watchOptions: defaults, overrides, and no interval or once mode (a snapshot is the only mode)', () => {
  assert.deepEqual(watchOptions([]), { timeoutMs: 90_000, tokenWindowMs: 600_000, tokenSpike: 3_000_000 });
  assert.deepEqual(watchOptions(['--child-timeout', '5', '--token-spike', '0']), { timeoutMs: 5000, tokenWindowMs: 600_000, tokenSpike: 0 });
});

test('a snapshot preserves affirmative healthy observations separately from collector failures', async () => {
  const snap = await snapshot({}, { collectFacts: async () => new Map([
    ['service:ask-gateway', null], ['service:list', 'inventory unreadable'],
  ]) });
  assert.equal(snap.ok, false);
  assert.deepEqual(snap.observations, [
    { key: 'service:ask-gateway', state: 'healthy' }, { key: 'service:list', state: 'unhealthy' },
  ]);
  assert.deepEqual(snap.alerts, [{ key: 'service:list', text: 'inventory unreadable' }]);
});
