// A running engine that differs from config.yaml or from the live code revision is a visible red row
// (scripts/reconciler/drift.mjs, boot.mjs status, start-items.mjs engineItems).
import test from 'node:test';
import assert from 'node:assert/strict';
import { status } from '../../scripts/reconciler/boot.mjs';
import { driftSummary, engineDrift, modeDrift, revDrift } from '../../scripts/reconciler/drift.mjs';
import { engineItems } from '../../scripts/reconciler/start-items.mjs';
import { reconcilerConfig } from '../../scripts/reconciler/state.mjs';
import { tempState } from '../../scripts/reconciler/testing.mjs';

const NOW = 50_000_000;
const MIN = 60_000;
const NUMBERS = { pollMs: 2000, leaseMs: 30000, renewMs: 10000, heartbeatStaleMs: 60000, statusCacheMs: 20000, backoff: { minMs: 1000, maxMs: 300000 }, crashLoop: { max: 3, windowMs: 1800000 } };
const OLD = 'c181b15ea4883bd6fc01961a007c465424bca154';
const LIVE = '0302639bb7bc1b05bb3a37a4901b6adb8c334e89';
const active = reconcilerConfig({ config: { reconciler: { enabled: true, controllers: { job: { mode: 'active' }, host: { mode: 'active' }, gc: { mode: 'shadow' } } } } });

test('a controller that runs off while config.yaml wants it active is drift after the grace, from the later of the mode write and the config change', () => {
  const modes = { job: { configured: 'active', effective: 'off', setAt: NOW - 10 * MIN }, gc: { configured: 'shadow', effective: 'shadow', setAt: 0 }, host: { configured: 'active', effective: 'shadow', setAt: 0 } };
  assert.deepEqual(modeDrift({ modes, configAt: 0, now: NOW }).map((d) => d.controller), ['job'], 'active running shadow is safe mode, not drift');
  assert.deepEqual(modeDrift({ modes, configAt: NOW - 10_000, now: NOW }), [], 'a config changed seconds ago is still being picked up');
  assert.deepEqual(modeDrift({ modes: { job: { ...modes.job, setAt: NOW - 5_000 } }, configAt: 0, now: NOW }), [], 'a mode written seconds ago is not drift');
});

test('an engine on an older revision than the live one is drift only past the reload bound and only when a watched path changed', () => {
  const base = { engineRev: OLD, liveRev: LIVE, now: NOW, boundMs: 10 * MIN };
  assert.equal(revDrift({ ...base, movedAt: NOW - 5 * MIN, relevant: true }), null, 'inside the bound the engine may still reload');
  assert.equal(revDrift({ ...base, movedAt: NOW - 20 * MIN, relevant: false }), null, 'a live HEAD that changed nothing the engine imports needs no reload');
  assert.deepEqual(revDrift({ ...base, movedAt: NOW - 20 * MIN, relevant: true }), { engineRev: OLD, liveRev: LIVE, sinceMs: 20 * MIN });
  assert.equal(revDrift({ ...base, engineRev: LIVE, movedAt: NOW - 20 * MIN, relevant: true }), null);
});

test('status of an engine that wrote every mode off and runs old code: a drift first line and two red required rows', (t) => {
  const st = tempState();
  t.after(() => st.close());
  st.m.acquireLeader({ name: 'reconciler', holder: 'host:1:a', pid: 1, leaseMs: 30_000, rev: OLD });
  for (const controller of ['job', 'host']) st.m.setControllerMode({ controller, mode: 'off', by: 'engine:host:1:a', reason: 'config.yaml reconciler.controllers.x.mode' });
  const now = Date.now() + 20 * MIN;
  const s = status({ env: st.env, now: Date.now(), numbers: NUMBERS, config: active });
  assert.equal(s.leader.fresh, true);
  assert.deepEqual(s.drift.modes, [], 'a mode written a moment ago is inside the grace');
  const later = engineDrift({ leader: s.leader, modes: Object.fromEntries(Object.entries(s.modes).map(([n, m]) => [n, { ...m, setAt: m.setAt - 20 * MIN }])), now: Date.now(), configAt: 0, live: LIVE, movedAt: now - 30 * MIN, touched: ['scripts/reconciler/engine.mjs'] });
  const drifted = later.modes.map((d) => d.controller);
  assert.ok(drifted.includes('job') && drifted.includes('host'), 'the two controllers config.yaml runs active but the store holds off');
  assert.ok(!drifted.includes('gc'), 'gc is shadow in both');
  assert.equal(later.rev.engineRev, OLD);
  const line = driftSummary(later);
  assert.match(line, /^DRIFT: .*job configured active runs off for 20m.*host configured active runs off.*engine code c181b15ea differs from live 0302639bb/);
  const rows = engineItems({ ...s, drift: later }).filter((row) => row.id.startsWith('drift-'));
  assert.deepEqual(rows.map((row) => `${row.id}:${row.status}:${row.required}`), ['drift-modes:red:true', 'drift-rev:red:true']);
  const ok = engineItems({ ...s, drift: { modes: [], rev: null } }).filter((row) => row.id.startsWith('drift-'));
  assert.deepEqual(ok.map((row) => row.status), ['green', 'green']);
});

test('a stale or absent engine has no drift to report (the engine row is already red)', () => {
  assert.deepEqual(engineDrift({ leader: { fresh: false }, modes: {} }), { modes: [], rev: null });
  assert.equal(driftSummary({ modes: [], rev: null }), null);
});
