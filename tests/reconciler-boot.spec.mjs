// scripts/reconciler/boot.mjs (crash-loop guard: only abnormal starts count) and start.mjs (operational profile,
// ui build staleness, preflight rows). Every host effect is a seam; nothing here starts or stops a process.
import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { crashLoopPlan, crashLoopRecord, ensure, isPlannedStart, SPAWNED_KIND } from '../scripts/reconciler/boot.mjs';
import { PROFILES, REQUIRED_ACTIVE, configuredMode, reconcilerConfig } from '../scripts/reconciler/state.mjs';
import { applyProfileText, cmpVersion, engineItems, isTempLedger, ledgerFindings, ledgerIntegrity, pinProblems, profileItems, sqliteItem, summarize, uiBuildState } from '../scripts/reconciler/start.mjs';
import { tempState } from '../scripts/reconciler/testing.mjs';

const NOW = 10_000_000;
const NUMBERS = { pollMs: 2000, leaseMs: 30000, renewMs: 10000, heartbeatStaleMs: 60000, statusCacheMs: 20000, backoff: { minMs: 1000, maxMs: 300000 }, crashLoop: { max: 3, windowMs: 1800000 } };
const stale = { fresh: false, holder: null, pid: null, epoch: null, ageMs: null, draining: false, pushRunning: false };

function spawnRow(m, at, startReason) {
  m.log({ actor: 'reconciler', kind: SPAWNED_KIND, msg: `boot ensure started the engine pid 1 (${startReason})`, data: { pid: 1, safe: false, startReason }, at });
}

test('planned starts (owner restart, reload handover, restart after a clean exit) never count toward the crash loop', (t) => {
  const st = tempState();
  t.after(() => st.close());
  for (const [i, r] of ['owner-restart', 'start', 'self-reload', 'planned-restart', 'boot'].entries()) spawnRow(st.m, NOW - 60_000 + i, r);
  const record = crashLoopRecord({ env: st.env, now: NOW });
  assert.equal(record.starts.length, 1, 'only the abnormal `boot` start counts');
  assert.equal(crashLoopPlan(record, { now: NOW, max: 3 }).looping, false);
  assert.ok(['owner-restart', 'start', 'self-reload', 'reload', 'handover', 'planned-restart'].every(isPlannedStart) && !isPlannedStart('ensure-stale-heartbeat'));
});

test('a real crash loop is still detected and starts --safe; lands and owner restarts around it do not hide or cause it', async (t) => {
  const st = tempState();
  t.after(() => st.close());
  for (let i = 0; i < 3; i += 1) spawnRow(st.m, NOW - 100_000 + i, 'ensure-stale-heartbeat');
  for (let i = 0; i < 5; i += 1) spawnRow(st.m, NOW - 50_000 + i, 'self-reload');
  const spawned = [];
  const r = await ensure({ env: st.env, now: NOW, numbers: NUMBERS, leader: () => stale, spawnOne: (o) => { spawned.push(o); return 4242; }, push: async () => ({ ok: true }),
    lock: () => null, starting: () => null, record: () => null });
  assert.equal(r.safe, true);
  assert.equal(spawned[0].safe, true);
  assert.equal(spawned[0].startReason, 'crash-restart');
});

test('three lands in 30 minutes (self-reload restarts) do not start safe mode; an owner restart names its reason', async (t) => {
  const st = tempState();
  t.after(() => st.close());
  for (let i = 0; i < 4; i += 1) spawnRow(st.m, NOW - 100_000 + i, 'self-reload');
  const spawned = [];
  const run = (extra) => ensure({ env: st.env, now: NOW, numbers: NUMBERS, leader: () => ({ ...stale, ...(extra.leader ?? {}) }), spawnOne: (o) => { spawned.push(o); return 1; }, push: async () => ({ ok: true }),
    lock: () => null, starting: () => null, record: () => null, ...(extra.reason ? { reason: extra.reason } : {}) });
  assert.equal((await run({})).safe, false);
  assert.equal((await run({ reason: 'owner-restart' })).startReason, 'owner-restart');
  assert.equal((await run({ leader: { exitReason: 'reload-handover' } })).startReason, 'planned-restart');
  assert.equal((await run({ leader: { holder: 'h', pid: null } })).startReason, 'ensure-stale-heartbeat');
});

test('the operational profile makes job/host/workflow/resource active, an explicit mode overrides it, no profile leaves the explicit set', () => {
  const op = reconcilerConfig({ config: { reconciler: { enabled: true, profile: 'operational', controllers: { gc: { mode: 'active' }, job: { mode: 'shadow' } } } } });
  assert.deepEqual(['host', 'workflow', 'resource', 'gc', 'job', 'fleet'].map((n) => configuredMode(n, op)), ['active', 'active', 'active', 'active', 'shadow', 'shadow']);
  assert.equal(profileItems(op, {})[0].status, 'red', 'an explicit shadow of a needed controller is red');
  const plain = reconcilerConfig({ config: { reconciler: { enabled: true, controllers: { job: { mode: 'shadow' } } } } });
  assert.equal(configuredMode('host', plain), 'off');
  const shadow = profileItems(plain, {})[0];
  assert.equal(shadow.status, 'red');
  assert.match(shadow.fix, /start\.mjs/);
  assert.equal(profileItems(reconcilerConfig({ config: { reconciler: { enabled: true, profile: 'operational' } } }), {})[0].status, 'green');
  assert.deepEqual(REQUIRED_ACTIVE, ['job', 'host', 'workflow', 'resource']);
  assert.equal(PROFILES.observe.job, 'shadow');
});

test('applyProfileText rewrites the reconciler block, keeps explicit gc/fleet/learning entries and is idempotent', () => {
  const text = 'model: x\r\nreconciler:\r\n  enabled: true\r\n  controllers: {job: {mode: shadow}, host: {mode: shadow}, gc: {mode: active}}\r\n# specs\r\nspecs: {unit: true}\r\n';
  const out = applyProfileText(text);
  assert.equal(out.changed, true);
  assert.match(out.text, /reconciler:\r\n {2}enabled: true\r\n {2}profile: operational\r\n {2}controllers: \{gc: \{mode: active\}\}\r\n# specs\r\nspecs:/);
  assert.equal(applyProfileText(out.text).changed, false);
  assert.match(applyProfileText('model: x\n').text, /profile: operational/);
  const observe = applyProfileText(text, 'observe');
  assert.match(observe.text, /profile: observe\r\n {2}controllers: \{\}\r\n# specs/);
  assert.throws(() => applyProfileText(text, 'bogus'), /unknown reconciler profile/);
});

test('ui/dist is stale when a ui source is newer than the newest built file, or missing', () => {
  const tree = (files) => {
    const fsImpl = {
      readdirSync: (dir) => Object.keys(files).filter((f) => path.dirname(f) === dir.replace(/\\/g, '/')).map((f) => ({ name: path.basename(f), isDirectory: () => false }))
        .concat([...new Set(Object.keys(files).map((f) => path.dirname(f)).filter((d) => path.dirname(d) === dir.replace(/\\/g, '/')))].map((d) => ({ name: path.basename(d), isDirectory: () => true }))),
      statSync: (f) => { const k = f.replace(/\\/g, '/'); if (!(k in files)) throw Error('ENOENT'); return { mtimeMs: files[k] }; },
    };
    return fsImpl;
  };
  const ui = '/x/ui';
  assert.equal(uiBuildState({ uiDir: ui, fsImpl: tree({ '/x/ui/src/a.tsx': 100, '/x/ui/dist/index.html': 200, '/x/ui/package.json': 50 }) }).stale, false);
  assert.equal(uiBuildState({ uiDir: ui, fsImpl: tree({ '/x/ui/src/a.tsx': 300, '/x/ui/dist/index.html': 200 }) }).stale, true);
  assert.equal(uiBuildState({ uiDir: ui, fsImpl: tree({ '/x/ui/package.json': 300, '/x/ui/dist/index.html': 200 }) }).stale, true);
  assert.equal(uiBuildState({ uiDir: ui, fsImpl: tree({ '/x/ui/src/a.tsx': 1 }) }).stale, true);
});

test('preflight: SQLite version, temp and missing ledgers, a model pin the launch cannot honour', () => {
  assert.ok(cmpVersion('3.51.3', '3.51.3') === 0 && cmpVersion('3.50.9', '3.51.3') < 0 && cmpVersion('3.53.4', '3.51.3') > 0);
  assert.equal(sqliteItem('3.51.2').status, 'red');
  assert.equal(sqliteItem('3.53.4').status, 'green');
  const tmp = path.join(os.tmpdir(), 'starci-boot-spec'), home = path.join(path.resolve(import.meta.dirname, '..'), 'no-such-ledger-dir');
  const ledgerAt = (dir, name) => path.join(dir, name);
  const gone = ledgerAt(home, 'gone.sqlite'), ok = ledgerAt(home, 'ok.sqlite'), gone2 = ledgerAt(home, 'gone2.sqlite'), inTemp = path.join(tmp, 'prereq-dbg', 'runtime.sqlite');
  assert.equal(isTempLedger(inTemp, { tmp }), true);
  const found = ledgerFindings([
    { ledgerId: 'a', name: 'a', file: inTemp },
    { ledgerId: 'b', name: 'b', file: gone }, { ledgerId: 'c', name: 'c', file: ok }, { ledgerId: 'd', name: 'd', file: gone2, state: 'retired' },
  ], { exists: (f) => f === ok, tmp });
  assert.deepEqual(found.map((f) => `${f.ledgerId}:${f.problem}`), ['a:temp', 'b:missing-file']);
  const repos = ledgerFindings([{ ledgerId: 'e', name: 'e', file: ok, repoRoot: path.join(home, 'gone-repo') }, { ledgerId: 'f', name: 'f', file: ok, repoRoot: ok }], { exists: (f) => f === ok, tmp });
  assert.deepEqual(repos.map((f) => `${f.ledgerId}:${f.problem}`), ['e:missing-repo']);
  const integrity = ledgerIntegrity([{ name: 'c', file: ok }, { name: 'x', file: gone }, { name: 'r', file: ok, state: 'retired' }, { name: 'bad', file: 'bad.sqlite' }],
    { exists: (f) => f !== gone, check: (f) => (f === 'bad.sqlite' ? { ok: false, result: ['page 3 corrupt'] } : { ok: true, result: ['ok'] }) });
  assert.deepEqual(integrity, { bad: [{ name: 'bad', result: 'page 3 corrupt' }], checked: 2 });
  // A pinned model is launched with worker-start --model and attested from worker-show: only an agent that takes no
  // --model (devin: start.modelArgument false) or has no card cannot honour a pin.
  const card = (agent) => ({ claude: { start: { api: 'orchestration.worker-start' } }, devin: { start: { api: 'orchestration.worker-start', modelArgument: false } } }[agent] ?? null);
  const bad = pinProblems([{ where: 'kernel', agent: 'devin', model: 'swe-2-max' }, { where: 'k2', agent: 'claude', model: 'claude-opus-5-5' },
    { where: 'k3', agent: 'devin', model: null }, { where: 'k4', agent: 'qwen', model: 'q' }], { card });
  assert.deepEqual(bad.map((b) => b.where), ['kernel', 'k4']);
});

test('the checklist is red when a needed controller is shadow or the engine is safe, and exits green only when every required row is', () => {
  const status = (modes, extra = {}) => ({ leader: { fresh: true, holder: 'h', pid: 1, epoch: 1, ageMs: 1000, safe: false, draining: false, ...extra }, modes, violations: { open: 0, clocks: 0 } });
  const all = (mode) => Object.fromEntries(['job', 'host', 'gc', 'resource', 'workflow', 'fleet', 'learning'].map((n) => [n, { configured: mode, effective: mode }]));
  assert.equal(summarize(engineItems(status(all('shadow')))).ok, false);
  assert.equal(summarize(engineItems(status({ ...all('active'), gc: { configured: 'shadow', effective: 'shadow' }, fleet: { configured: 'shadow', effective: 'shadow' }, learning: { configured: 'shadow', effective: 'shadow' } }))).ok, true);
  assert.equal(summarize(engineItems(status(all('active'), { safe: true }))).ok, false);
});
