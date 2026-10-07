// The engine's self-reload does not depend on the running code reading config.yaml (scripts/reconciler/reload-env.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { Engine } from '../../scripts/reconciler/engine.mjs';
import { createReloadWatch } from '../../scripts/machine/self-reload.mjs';
import { releasePinnedTemp, reloadEnv, startTempRoot } from '../../scripts/reconciler/reload-env.mjs';
import { tempChildEnv } from '../../engine/temp-root.mjs';
import { tempState } from '../../scripts/reconciler/testing.mjs';

const unreadable = () => { throw new Error('Invalid config.yaml: allocation must be {mode:"adaptive"} (newer than this code)'); };
const ROOT = path.resolve('starci-reload-temp-root');

test('startTempRoot is the resolved root, or null when the config does not read', () => {
  assert.equal(startTempRoot({ resolve: () => ROOT }), ROOT);
  assert.equal(startTempRoot({ resolve: unreadable }), null);
});

test('the replacement env is unchanged while the config reads and pins the start temp root when it does not', () => {
  const env = { A: '1' };
  assert.equal(reloadEnv(env, ROOT, { resolve: () => ROOT }), env);
  const pinned = reloadEnv(env, ROOT, { resolve: unreadable });
  assert.equal(pinned.STARCI_TEMP_ROOT, ROOT);
  assert.equal(pinned.A, '1');
  assert.equal(reloadEnv(env, null, { resolve: unreadable }), env, 'with no start root there is nothing to pin');
  assert.equal(tempChildEnv(pinned).TEMP, ROOT, 'the spawn wrapper resolves the pinned root without reading config.yaml');
});

test('the replacement drops a pinned temp root and keeps one the owner set', () => {
  const pinned = reloadEnv({}, ROOT, { resolve: unreadable });
  releasePinnedTemp(pinned);
  assert.deepEqual(pinned, {});
  const owner = { STARCI_TEMP_ROOT: ROOT };
  releasePinnedTemp(owner);
  assert.deepEqual(owner, { STARCI_TEMP_ROOT: ROOT });
});

test('a failed reload is an error row naming why; a handed-over reload is an event', async (t) => {
  const st = tempState();
  t.after(() => st.close());
  const rows = [];
  const engine = new Engine({ env: st.env, numbers: { pollMs: 2000, leaseMs: 30000, renewMs: 10000, heartbeatStaleMs: 60000, statusCacheMs: 20000, backoff: { minMs: 1000, maxMs: 300000 }, crashLoop: { max: 3, windowMs: 1800000 } },
    config: { enabled: false, controllers: {} }, ledgers: [], controllers: [], stateOptions: { file: st.file }, holder: 'host:1:a', claimLock: () => ({ ok: true, release() {} }), writeLog: (row) => { rows.push(row); }, print: () => {} });
  st.own({ close: () => engine.close({ releaseLead: false }) });
  const watch = { check: () => ({ reload: true, reason: 'runtime HEAD aaa -> bbb' }), markAttempt() {} };
  const due = { at: 0 };
  assert.equal(await engine.reloadWhenDue(due, watch, async () => ({ ok: false, error: 'spawn failed: x' })), undefined);
  const failed = rows.find((row) => row.data?.kind === 'reconciler.reload');
  assert.equal(failed.kind, 'reconciler.error');
  assert.match(failed.msg, /reload failed: spawn failed: x \(runtime HEAD aaa -> bbb\)/);
  due.at = 0;
  assert.deepEqual(await engine.reloadWhenDue(due, watch, async () => ({ ok: true, pid: 7 })), { exitCode: 0, reloaded: 7 });
  assert.equal(rows.at(-1).kind, 'reconciler.event');
});

test('a moved runtime revision reloads the running engine through the drain and hands over', async (t) => {
  const st = tempState();
  t.after(() => st.close());
  const clock = { at: 5_000_000 };
  const engine = new Engine({ env: st.env, now: () => clock.at, numbers: { pollMs: 2000, leaseMs: 30000, renewMs: 10000, heartbeatStaleMs: 60000, statusCacheMs: 20000, backoff: { minMs: 1000, maxMs: 300000 }, crashLoop: { max: 3, windowMs: 1800000 } },
    config: { enabled: false, controllers: {} }, ledgers: [], controllers: [], stateOptions: { file: st.file }, holder: 'host:1:a', claimLock: () => ({ ok: true, release() {} }), writeLog: () => {}, print: () => {} });
  st.own({ close: () => engine.close({ releaseLead: false }) });
  await engine.load();
  let head = 'a'.repeat(40);
  const watch = createReloadWatch({ head: () => head, stamps: () => ({}), now: () => clock.at, headPaths: ['scripts/'], diff: () => ['scripts/reconciler/engine.mjs'] });
  const reloads = [];
  const sleep = async () => { clock.at += 61_000; head = 'b'.repeat(40); };
  const result = await engine.run({ sleep, tickMs: 1, watch, reload: async (check) => { reloads.push(check.reason); return { ok: true, pid: 4242 }; } });
  assert.deepEqual(result, { exitCode: 0, reloaded: 4242 });
  assert.match(reloads[0], /runtime HEAD aaaaaaaaa -> bbbbbbbbb/);
  assert.equal(engine.draining, false, 'the drain ended');
});
