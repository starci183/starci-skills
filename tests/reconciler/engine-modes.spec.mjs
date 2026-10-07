// A config the running engine cannot read never changes the controller modes (scripts/reconciler/engine-modes.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../../scripts/reconciler/engine.mjs';
import { tempState } from '../../scripts/reconciler/testing.mjs';

const NUMBERS = { pollMs: 2000, leaseMs: 30000, renewMs: 10000, heartbeatStaleMs: 60000, statusCacheMs: 20000, backoff: { minMs: 1000, maxMs: 300000 }, crashLoop: { max: 3, windowMs: 1800000 } };
const noLock = () => ({ ok: true, release() {} });
const GOOD = { enabled: true, controllers: { job: { mode: 'active' }, host: { mode: 'active' }, gc: { mode: 'shadow' } } };
const NEW_FORMAT = 'Invalid config.yaml: allocation must be {mode:"adaptive"} (a file newer than this code)';

/** An engine over a temp store whose config is `swap.config` (a function result or a thrown error). */
function engineWith(st, swap, logs = [], clock = { at: 1_000_000 }) {
  const config = () => { if (swap.error) throw new Error(swap.error); return swap.config; };
  const engine = new Engine({ env: st.env, now: () => clock.at, numbers: NUMBERS, config, ledgers: [], controllers: [], stateOptions: { file: st.file },
    holder: 'host:1:a', claimLock: noLock, writeLog: (row) => { logs.push(row); }, print: () => {} });
  st.own({ close: () => engine.close({ releaseLead: false }) });
  return engine;
}

const modeRows = (st) => st.m.modeChanges({}).map((r) => `${r.controller}:${r.from_mode}->${r.to_mode}`);
const openClocks = (st) => st.m.db.prepare("SELECT entity, state, violated_at FROM v_sla_open WHERE entity LIKE 'engine:%'").all();

test('a config swapped for one the running code cannot read keeps the modes, raises one typed fault and a critical clock, and recovers', async (t) => {
  const st = tempState();
  t.after(() => st.close());
  const logs = [];
  const swap = { config: GOOD, error: null };
  const clock = { at: 1_000_000 };
  const engine = engineWith(st, swap, logs, clock);
  await engine.load();
  assert.equal(engine.acquire().ok, true);
  assert.equal(engine.modes.job, 'active');
  const before = modeRows(st);
  swap.error = NEW_FORMAT;
  engine.refreshConfig();
  engine.refreshConfig();
  assert.deepEqual({ job: engine.modes.job, host: engine.modes.host, gc: engine.modes.gc, workers: engine.modes.workers }, { job: 'active', host: 'active', gc: 'shadow', workers: 'off' });
  assert.deepEqual(modeRows(st), before, 'no mode_changes row is written for an unreadable config');
  assert.equal(st.m.controllerModes().job, 'active');
  const faults = logs.filter((row) => row.data?.kind === 'reconciler.config-unreadable');
  assert.equal(faults.length, 1, 'the same fault is one row');
  assert.equal(faults[0].kind, 'reconciler.error');
  assert.match(faults[0].msg, /modes held \(job=active host=active gc=shadow/);
  assert.deepEqual(openClocks(st).map((c) => `${c.entity}|${c.state}`), ['engine:config|ENGINE_CONFIG_UNREADABLE']);
  clock.at += 31_000;
  const pass = await engine.slaPass();
  assert.deepEqual(pass.violated.map((v) => v.code), ['ENGINE_CONFIG_UNREADABLE']);
  assert.equal(pass.violated[0].severity, 'critical');
  assert.ok(openClocks(st)[0].violated_at != null, 'the clock is a violation at the next SLA pass');
  swap.error = null;
  engine.refreshConfig();
  assert.equal(engine.configFault, null);
  assert.deepEqual(openClocks(st), [], 'the clock closes when the config reads again');
  assert.equal(logs.filter((row) => row.data?.kind === 'reconciler.config-recovered').length, 1);
});

test('a fresh engine on an unreadable config starts from the modes the store recorded; with a seeded store it holds shadow', async (t) => {
  const st = tempState();
  t.after(() => st.close());
  const swap = { config: GOOD, error: null };
  const first = engineWith(st, swap);
  await first.load();
  first.acquire();
  first.close({ releaseLead: true });
  swap.error = NEW_FORMAT;
  const second = engineWith(st, swap);
  await second.load();
  assert.deepEqual({ job: second.modes.job, gc: second.modes.gc }, { job: 'active', gc: 'shadow' }, 'recorded modes are kept');
  second.acquire();
  assert.equal(st.m.controllerModes().job, 'active');
  const empty = tempState();
  t.after(() => empty.close());
  const third = engineWith(empty, { error: NEW_FORMAT });
  await third.load();
  assert.ok(Object.values(third.modes).every((mode) => mode === 'shadow'), 'a store with no recorded change holds its seeded shadow rows');
  assert.ok(third.configFault);
});

test('safe mode still demotes held active modes to shadow', async (t) => {
  const st = tempState();
  t.after(() => st.close());
  const swap = { config: GOOD, error: null };
  const engine = new Engine({ env: st.env, now: () => 1_000_000, numbers: NUMBERS, config: () => { if (swap.error) throw new Error(swap.error); return swap.config; }, ledgers: [], controllers: [], safe: true,
    stateOptions: { file: st.file }, holder: 'host:1:a', claimLock: noLock, writeLog: () => {}, print: () => {} });
  st.own({ close: () => engine.close({ releaseLead: false }) });
  await engine.load();
  swap.error = NEW_FORMAT;
  engine.refreshConfig();
  assert.equal(engine.modes.job, 'shadow');
});
