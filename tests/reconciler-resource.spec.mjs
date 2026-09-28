// reconciler-resource.spec.mjs — the reconciler Resource controller (scripts/reconciler/controllers/resource.mjs):
// mode hysteresis, the single writer of the throttle state (shadow writes nothing), fair-share slot targets, the
// quota probe and the quota-exhausted / cap-starved Decision Items. Every host seam is injected; the throttle state
// lives in a temp file.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createResourceController, fairShare, quotaExhausted, starvedWorkflows, HOST_KEY } from '../scripts/reconciler/controllers/resource.mjs';

import { fakeCtx } from '../scripts/reconciler/testing.mjs';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-rc-resource-spec-'));
after(() => fs.rmSync(TMP, { recursive: true, force: true }));
const T = 2_000_000_000_000;
const GB = 1024 ** 3;
const SETTINGS = { resources: { minFreeRamPct: 10, ramThrottle: { heavyResumeAbovePct: 15, landSpecPauseBelowPct: 2.5, landSpecResumeAbovePct: 5, hardFloorPct: 2.5 },
  opRam: { default: { mb: 1200, class: 'light' } } } };

function ctxOf(mode, extra = {}) {
  const calls = { api: [], log: [], decisions: [], clocks: [] };
  let now = T;
  const ctx = fakeCtx({ mode, now: () => now, ledgers: [{ ledgerId: 'nivo-backend', repo: 'D:/r' }, { ledgerId: 'supervisor' }], read: () => null,
    api: async (...a) => { calls.api.push(a); return { ok: true, shadow: mode !== 'active' }; }, run: async () => ({ ok: true }),
    clock: (...a) => calls.clocks.push(['clock', ...a]), clear: (...a) => calls.clocks.push(['clear', ...a]),
    openDecision: async (di) => { calls.decisions.push(di); return { ok: true }; }, log: (kind, msg, data) => calls.log.push({ kind, msg, data }), owns: () => false, ...extra });
  return { ctx, calls, advance: (ms) => { now += ms; } };
}

function controller({ pct = () => 50, ops = () => [], priorities = null, file = null, ready = () => null } = {}) {
  const stateFile = file ?? path.join(fs.mkdtempSync(path.join(TMP, 'rc-resource-')), 'ram-throttle.json');
  const footprints = [];
  const settings = priorities ? { ...SETTINGS, resources: { ...SETTINGS.resources, ramThrottle: { ...SETTINGS.resources.ramThrottle, priorities } } } : SETTINGS;
  const c = createResourceController({ settings: async () => settings, maxParallelOps: async () => 20, stateFile,
    host: async () => ({ totalRamBytes: 100 * GB, freeRamBytes: pct() * GB, freeRamPct: pct(), lowDisk: false }),
    load: async () => 0.2, census: async () => ({ ops: ops(), kernels: 0 }), footprints: async () => [], owners: async () => [],
    recordFootprint: async (p) => footprints.push(p), queuedReady: async (ctx, wf) => ready(wf), providerOf: async () => (pool) => ({ 'qwen-agent': 'qwen', 'codex-agent': 'codex' })[pool] ?? null });
  return { c, stateFile, footprints };
}

test('mode hysteresis: heavy at 10% resumes above 15%; critical at 2.5% resumes above 5%', async () => {
  let p = 50;
  const { c } = controller({ pct: () => p });
  const { ctx } = ctxOf('shadow');
  const seq = [[12, 'normal'], [9, 'heavy-paused'], [12, 'heavy-paused'], [15, 'heavy-paused'], [16, 'normal'], [2, 'critical'], [4, 'critical'], [5, 'critical'], [6, 'heavy-paused'], [14, 'heavy-paused'], [20, 'normal']];
  for (const [pct, want] of seq) { p = pct; assert.equal((await c.reconcile(HOST_KEY, ctx)).mode, want, `free ${pct}%`); }
});

test('single writer: shadow writes nothing (would-rows only); active writes the mode and the slot targets', async () => {
  const shadow = controller({ pct: () => 8 });
  const s = ctxOf('shadow');
  const r = await shadow.c.reconcile(HOST_KEY, s.ctx);
  assert.equal(r.wrote, false);
  assert.equal(fs.existsSync(shadow.stateFile), false, 'shadow never writes the throttle state');
  assert.equal(shadow.footprints.length, 0, 'shadow records no footprint event');
  const would = s.calls.log.filter((l) => l.kind === 'reconciler.would');
  assert.ok(would.some((l) => l.data.action === 'writeThrottleState' && l.data.patch.mode === 'heavy-paused' && l.data.diff === true));
  assert.ok(would.some((l) => l.data.action === 'supervisorEvent' && l.data.kind === 'op-ram-footprint'));
  // An unchanged mode and target set logs no second would-row.
  await shadow.c.reconcile(HOST_KEY, s.ctx);
  assert.equal(s.calls.log.filter((l) => l.data.action === 'writeThrottleState').length, 1);

  const active = controller({ pct: () => 8, ops: () => [{ op: 'code.refactor', workflowId: 'wf-a', status: 'queued' }] });
  const a = ctxOf('active');
  assert.equal((await active.c.reconcile(HOST_KEY, a.ctx)).wrote, true);
  const st = JSON.parse(fs.readFileSync(active.stateFile, 'utf8'));
  assert.equal(st.mode, 'heavy-paused');
  assert.equal(st.writer, 'reconciler/resource');
  assert.equal(st.slotTargets.targets['wf-a'].target, 1);
  assert.equal(active.footprints.length, 1);
  assert.ok(a.calls.clocks.length === 0, 'no clock at 8% (not critical, disk fine)');
});

test('RAM_CRITICAL clock opens once when critical and clears when it leaves', async () => {
  let p = 2;
  const { c } = controller({ pct: () => p });
  const { ctx, calls } = ctxOf('shadow');
  await c.reconcile(HOST_KEY, ctx); await c.reconcile(HOST_KEY, ctx);
  assert.deepEqual(calls.clocks.map((x) => [x[0], x[2]]), [['clock', 'RAM_CRITICAL']]);
  p = 30; await c.reconcile(HOST_KEY, ctx);
  assert.deepEqual(calls.clocks.at(-1).slice(0, 3), ['clear', 'host:local', 'RAM_CRITICAL']);
});

test('fair share: targets never sum above maxParallelOps; reserve first; demand caps; held slots come off the top', () => {
  const ops = (wf, running, queued) => [...Array(running)].map(() => ({ workflowId: wf, status: 'running' })).concat([...Array(queued)].map(() => ({ workflowId: wf, status: 'queued' })));
  const all = [...ops('wf-fe', 2, 30), ...ops('wf-be', 1, 30), ...ops('wf-small', 0, 1), ...ops('wf-idle', 3, 0)];
  const s = fairShare({ ops: all, priorities: { 'wf-fe': { weight: 3, reserve: 6 } }, maxParallelOps: 20 });
  const sum = Object.values(s.targets).reduce((n, t) => n + t.target, 0);
  assert.ok(sum <= 20 - 3, `sum ${sum} leaves wf-idle's 3 running slots`);
  assert.equal(sum, 17);
  assert.ok(s.targets['wf-fe'].target >= 6, 'reserve honored');
  assert.ok(s.targets['wf-fe'].target > s.targets['wf-be'].target, 'weight 3 beats weight 1');
  assert.equal(s.targets['wf-small'].target, 1, 'demand caps a small workflow');
  assert.equal(s.targets['wf-idle'], undefined, 'no ready work, no target');
  // Randomized: the sum never exceeds maxParallelOps, no target exceeds demand.
  for (let i = 0; i < 200; i++) {
    const n = 1 + (i % 5), max = 1 + (i % 23), list = [], pr = {};
    for (let w = 0; w < n; w++) { list.push(...ops(`wf-${w}`, (i * 7 + w) % 4, (i * 3 + w * 5) % 9)); if ((i + w) % 3 === 0) pr[`wf-${w}`] = { weight: 1 + ((i + w) % 4), reserve: (i + w) % 5 }; }
    const r = fairShare({ ops: list, priorities: pr, maxParallelOps: max });
    const total = Object.values(r.targets).reduce((a, t) => a + t.target, 0);
    assert.ok(total <= max, `case ${i}: ${total} > ${max}`);
    for (const t of Object.values(r.targets)) assert.ok(t.target <= t.demand);
  }
});

test('cap-starved: the reserve workflow short of its slots for 15 min opens one DI to the Supervisor', async () => {
  const ops = [{ op: 'code.refactor', workflowId: 'wf-fe', status: 'queued' }, { op: 'code.refactor', workflowId: 'wf-fe', status: 'queued' }, { op: 'x', workflowId: 'wf-be', status: 'running' }];
  assert.equal(starvedWorkflows({ ops, priorities: { 'wf-fe': { weight: 3, reserve: 2 } }, ready: { 'wf-fe': 2 } }).length, 1);
  const { c } = controller({ ops: () => ops, priorities: { 'wf-fe': { weight: 3, reserve: 2 } }, ready: () => 2 });
  const { ctx, calls, advance } = ctxOf('shadow');
  await c.reconcile(HOST_KEY, ctx);
  assert.equal(calls.decisions.length, 0);
  advance(16 * 60_000);
  await c.reconcile(HOST_KEY, ctx); await c.reconcile(HOST_KEY, ctx);
  assert.equal(calls.decisions.length, 1);
  assert.equal(calls.decisions[0].kind, 'cap-starved');
  assert.equal(calls.decisions[0].decider, 'supervisor');
});

test('quota: probe every 5 min while a quota circuit is open; quota-exhausted when every pool of a waiting kind is out', async () => {
  const circuits = [{ key: 'qwen', value_json: JSON.stringify({ provider: 'qwen', status: 'unavailable', failureKind: 'quota' }), expires_at: T + 3_600_000 }];
  const jobs = [{ op: 'interface.draw', status: 'queued', pool: 'qwen-agent' }, { op: 'interface.draw', status: 'queued', pool: 'qwen-agent' }, { op: 'code.refactor', status: 'queued', pool: 'codex-agent' }];
  const read = (id, fn) => fn({ prepare: (sql) => ({ all: () => (/signals/.test(sql) ? circuits : jobs) }) });
  const { c } = controller();
  const { ctx, calls, advance } = ctxOf('shadow', { read });
  const r = await c.reconcile('resource:quota:nivo-backend', ctx);
  assert.equal(r.probed, true);
  assert.deepEqual(calls.api[0].slice(0, 3), ['nivo-backend', 'provider-health', ['--quota-probe']]);
  assert.deepEqual(r.exhausted, ['interface.draw'], 'code.refactor (codex) still has quota');
  assert.equal(calls.decisions[0].kind, 'quota-exhausted');
  advance(60_000);
  assert.equal((await c.reconcile('resource:quota:nivo-backend', ctx)).probed, false);
  advance(5 * 60_000);
  assert.equal((await c.reconcile('resource:quota:nivo-backend', ctx)).probed, true);
  assert.deepEqual(await c.list(ctx), [HOST_KEY, 'resource:pools', 'resource:quota:nivo-backend']);
  assert.deepEqual(quotaExhausted({ jobs: [{ op: 'a', status: 'queued', pool: null }], openProviders: ['qwen'], providerOf: () => 'qwen' }), [], 'an unrouted kind is never judged');
});

test('hostThrottle steps aside while the reconciler owns resource.throttle: reads the published mode, writes nothing', async () => {
  const { hostThrottle, RECONCILER_WRITER } = await import('../scripts/lib/ram-throttle.mjs');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-rc-throttle-yield-'));
  const stateFile = path.join(dir, 'ram-throttle.json');
  const env = { STARCI_HOST_RESOURCES_JSON: JSON.stringify({ totalRamBytes: 100 * GB, freeRamBytes: 50 * GB, ops: [] }) };
  const published = { mode: 'critical', ramMode: 'critical', cpuHot: false, why: 'free RAM 2%', at: new Date(T - 30_000).toISOString(), writer: RECONCILER_WRITER };
  fs.writeFileSync(stateFile, JSON.stringify(published));
  const owned = hostThrottle({ env, stateFile, now: T, settings: SETTINGS, owns: (c) => c === 'resource.throttle' });
  assert.equal(owned.mode, 'critical', 'the published mode, not a local recompute at 50% free');
  assert.equal(owned.modePublished, true);
  assert.deepEqual(JSON.parse(fs.readFileSync(stateFile, 'utf8')), published, 'the dispatch path wrote nothing');
  // A stale publication: computed locally, still not written.
  const stale = hostThrottle({ env, stateFile, now: T + 10 * 60_000, settings: SETTINGS, owns: () => true });
  assert.equal(stale.modePublished, false);
  assert.deepEqual(JSON.parse(fs.readFileSync(stateFile, 'utf8')), published);
  // Not owned (engine dead or controller not active): the old path writes again.
  const free = hostThrottle({ env, stateFile, now: T, settings: SETTINGS, owns: () => false });
  assert.equal(free.modeWriter, undefined);
  assert.notEqual(JSON.parse(fs.readFileSync(stateFile, 'utf8')).writer, RECONCILER_WRITER);
});

test('cap-starved counts only queued-READY work: jobs waiting on leases, dependencies or decisions never starve; a stale clock is cleared', async () => {
  const pr = { 'wf-fe': { weight: 3, reserve: 6 } };
  const ops = [...Array(4)].map(() => ({ op: 'code.refactor', workflowId: 'wf-fe', status: 'running' })).concat([...Array(9)].map(() => ({ op: 'code.refactor', workflowId: 'wf-fe', status: 'queued' })));
  assert.equal(starvedWorkflows({ ops, priorities: pr, ready: { 'wf-fe': 0 } }).length, 0, '9 queued, all on live file leases: not starved');
  assert.equal(starvedWorkflows({ ops, priorities: pr }).length, 0, 'no status reading: never starved on a guess');
  assert.equal(starvedWorkflows({ ops, priorities: pr, ready: { 'wf-fe': 1 } })[0].want, 5, 'want = min(reserve, running + queuedReady)');
  const { c } = controller({ ops: () => ops, priorities: pr, ready: () => 0 });
  const { ctx, calls, advance } = ctxOf('shadow');
  await c.reconcile(HOST_KEY, ctx);
  advance(16 * 60_000); await c.reconcile(HOST_KEY, ctx);
  assert.equal(calls.decisions.length, 0);
  assert.ok(!calls.clocks.some((x) => x[0] === 'clock' && x[2] === 'CAP_STARVED'));
  assert.equal(calls.clocks.filter((x) => x[0] === 'clear' && x[1] === 'workflow:wf-fe' && x[2] === 'CAP_STARVED').length, 1, 'the stale clock a previous run left is cleared once');
});
