import { test } from 'node:test';
import assert from 'node:assert/strict';
import { firstJson, watchOptions, snapshot, serviceRowFact } from '../../scripts/reconciler/core-watch.mjs';

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

test('core-watch raises no alert for a connector config.yaml turns off, and still alerts an enabled one that is down', async () => {
  const rows = [
    { name: 'telegram-bridge', state: 'backoff', failStreak: 84, lastProbe: { error: 'not running' } },
    { name: 'ask-tunnel', state: 'unmanaged', lastProbe: { error: 'off in config.yaml connectors (not required)' } },
    { name: 'ask-gateway', state: 'failed', failStreak: 3, lastProbe: { error: 'timeout' } },
  ];
  const factsOf = (config) => { const facts = new Map(); for (const row of rows) serviceRowFact(facts, row, { config }); return facts; };
  const off = await snapshot({}, { collectFacts: async () => factsOf({ connectors: { telegram: { enabled: false }, cloudflare: { mode: 'off' } } }) });
  assert.deepEqual(off.alerts, [{ key: 'service:ask-gateway', text: 'failed (timeout) failStreak 3' }]);
  assert.deepEqual(off.observations.filter((o) => o.state === 'unhealthy').map((o) => o.key), ['service:ask-gateway']);
  const on = await snapshot({}, { collectFacts: async () => factsOf({ connectors: { telegram: { enabled: true }, cloudflare: { mode: 'quick' } } }) });
  assert.deepEqual(on.alerts.map((a) => a.key), ['service:telegram-bridge', 'service:ask-tunnel', 'service:ask-gateway']);
  assert.equal(on.alerts[0].text, 'backoff (not running) failStreak 84');
});
