import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  nextMode, effectiveCapOf, admitOp, opRamEstimates, footprintObservations, footprintSample, priorityTable, priorityClaim,
  hostThrottle, readThrottleState, setPriority, throttleLine,
} from '../scripts/lib/ram-throttle.mjs';
import { specRunGate } from '../scripts/supervisor/land.mjs';

// The RAM-aware, priority-aware dispatch throttle (owner ruling 2026-09-28): every number below is a fake host
// sample, the thresholds are runtimes.yaml's own (allocation.resources.minFreeRamPct / ramThrottle).

const GB = 1024 ** 3;
const T = { heavyStopBelowPct: 15, heavyResumeAbovePct: 20, landSpecPauseBelowPct: 10, landSpecResumeAbovePct: 15, hardFloorPct: 5,
  cpuHeavyStopAbove: 0.95, cpuHeavyResumeBelow: 0.85, historySamples: 48, historyMinObservations: 3, kernelMb: 900 };
const TABLE = { default: { mb: 1000, class: 'light' }, kinds: {
  'code.refactor': { mb: 2000, class: 'heavy' }, 'uat.verify': { mb: 3500, class: 'heavy' }, 'scope.define': { mb: 800, class: 'light' } } };
const EST = opRamEstimates(TABLE, [], T);
// The live host of 2026-09-27: 68.6 GB, free RAM at 10-13%.
const host = (freePct, totalGb = 68.6) => ({ totalRamBytes: totalGb * GB, freeRamBytes: totalGb * GB * freePct / 100, freeRamPct: freePct });
const running = (n, workflowId = 'wf-other', op = 'scope.define') => Array.from({ length: n }, () => ({ op, workflowId, status: 'running' }));
const queued = (n, workflowId, op = 'code.refactor') => Array.from({ length: n }, () => ({ op, workflowId, status: 'queued' }));

test('mode: below 15% heavy pauses, it resumes only above 20%; below 10% is critical until above 15%', () => {
  const walk = (pcts) => { let prev = {}; return pcts.map((p) => { const m = nextMode(prev, { freeRamPct: p, cpuBusy: 0.5 }, T); prev = m; return m.mode; }); };
  assert.deepEqual(walk([30, 14, 18, 20, 21]), ['normal', 'heavy-paused', 'heavy-paused', 'heavy-paused', 'normal']);
  assert.deepEqual(walk([30, 9, 12, 15, 16, 19, 21]), ['normal', 'critical', 'critical', 'critical', 'heavy-paused', 'heavy-paused', 'normal']);
  assert.match(nextMode({}, { freeRamPct: 12 }, T).why, /free RAM 12% < 15%/);
});

test('mode: a saturated CPU pauses heavy ops with hysteresis even when RAM is plentiful', () => {
  let prev = {};
  const modes = [0.5, 0.96, 0.9, 0.84].map((cpu) => { prev = nextMode(prev, { freeRamPct: 40, cpuBusy: cpu }, T); return prev.mode; });
  assert.deepEqual(modes, ['normal', 'heavy-paused', 'heavy-paused', 'normal']);
});

test('effective cap: maxParallelOps binds on a roomy host and is never exceeded', () => {
  const cap = effectiveCapOf({ maxParallelOps: 20, running: 3, host: host(80), mode: 'normal', estimates: EST, thresholds: T });
  assert.equal(cap.effectiveCap, 20);
  assert.equal(cap.heavyCap, 20);
  assert.match(cap.why, /maxParallelOps 20 binds/);
});

test('effective cap: at 10.9% of 68.6 GB it counts what fits above the 5% floor and allows no new heavy op', () => {
  const cap = effectiveCapOf({ maxParallelOps: 20, running: 8, host: host(10.9), mode: 'heavy-paused', estimates: EST, thresholds: T });
  // free 7657 MB - floor 3512 MB = 4145 MB headroom; the light median (800 MB) fits 5 more.
  assert.equal(cap.headroomMb, 4145);
  assert.equal(cap.lightCap, 13);
  assert.equal(cap.heavyCap, 8, 'no new heavy op beside the 8 running');
  assert.equal(cap.effectiveCap, 13);
});

test('admission: heavy-paused refuses a heavy op, admits a light one, and never kills what runs', () => {
  const base = { maxParallelOps: 20, host: host(12), mode: 'heavy-paused', modeWhy: 'free RAM 12% < 15%', estimates: EST, thresholds: T, ops: running(8) };
  const heavy = admitOp({ ...base, op: 'uat.verify', workflowId: 'wf-a' });
  assert.equal(heavy.ok, false);
  assert.equal(heavy.reason, 'heavy-paused');
  assert.equal(heavy.running, 8);
  const light = admitOp({ ...base, op: 'scope.define', workflowId: 'wf-a' });
  assert.equal(light.ok, true);
  assert.equal(light.class, 'light');
});

test('admission: the fleet never passes the owner maxParallelOps 20, however much RAM is free', () => {
  const a = admitOp({ op: 'scope.define', workflowId: 'wf-a', maxParallelOps: 20, host: host(90), mode: 'normal', estimates: EST, thresholds: T, ops: running(20) });
  assert.equal(a.ok, false);
  assert.equal(a.reason, 'fleet-max-ops');
});

test('admission: an estimate that does not fit above the hard floor waits, light or heavy', () => {
  const a = admitOp({ op: 'scope.define', workflowId: 'wf-a', maxParallelOps: 20, host: host(6), mode: 'critical', estimates: EST, thresholds: T, ops: running(4) });
  assert.equal(a.ok, false);
  assert.equal(a.reason, 'does-not-fit');
  assert.match(a.detail, /needs ~800 MB/);
});

test('priority: the prioritized workflow starts heavy ops under the heavy pause; lower workflows wait for slots and RAM it claims', () => {
  const priorities = priorityTable({ resources: { ramThrottle: { priorities: { 'wf-fe': { weight: 10, reserve: 15 } } } } }, {});
  const ops = [...running(3, 'wf-fe', 'code.refactor'), ...queued(12, 'wf-fe'), ...running(5, 'wf-other')];
  const base = { maxParallelOps: 20, host: host(14), mode: 'heavy-paused', modeWhy: 'free RAM 14% < 15%', estimates: EST, thresholds: T, ops, priorities };
  const fe = admitOp({ ...base, op: 'code.refactor', workflowId: 'wf-fe' });
  assert.equal(fe.ok, true, fe.detail);
  assert.equal(fe.priority.top, true);
  const otherHeavy = admitOp({ ...base, op: 'code.refactor', workflowId: 'wf-other' });
  assert.equal(otherHeavy.ok, false);
  // 8 running + 1 + the 12 slots wf-fe still claims (15 reserved - 3 running) = 21 > 20: no slot left for wf-other.
  const otherLight = admitOp({ ...base, op: 'scope.define', workflowId: 'wf-other' });
  assert.equal(otherLight.ok, false);
  assert.equal(otherLight.reason, 'priority-reserved');
  assert.match(otherLight.detail, /12 slot\(s\) reserved for wf-fe/);
  // With fewer queued slices the others ramp up in what is left.
  const fewer = admitOp({ ...base, ops: [...running(3, 'wf-fe', 'code.refactor'), ...queued(2, 'wf-fe'), ...running(4, 'wf-other')], op: 'scope.define', workflowId: 'wf-other' });
  assert.equal(fewer.ok, true, fewer.detail);
  // A heavy op of a lower workflow on a normal host still leaves the RAM the prioritized pending slices need.
  const normal = admitOp({ ...base, mode: 'normal', host: host(18), ops: [...running(3, 'wf-fe', 'code.refactor'), ...queued(4, 'wf-fe'), ...running(4, 'wf-other')], op: 'code.refactor', workflowId: 'wf-other' });
  assert.equal(normal.ok, false);
  assert.equal(normal.reason, 'priority-reserved');
  assert.equal(normal.priority.claimMb, 8000);
});

test('priority: critical pauses even the prioritized workflow heavy ops', () => {
  const priorities = { 'wf-fe': { weight: 10, reserve: 15 } };
  const a = admitOp({ op: 'code.refactor', workflowId: 'wf-fe', maxParallelOps: 20, host: host(9), mode: 'critical', estimates: EST, thresholds: T, ops: queued(5, 'wf-fe'), priorities });
  assert.equal(a.ok, false);
  assert.equal(a.reason, 'heavy-paused');
});

test('priority: with nobody weighted every workflow is equal and claims nothing', () => {
  const claim = priorityClaim('wf-a', [...queued(10, 'wf-b')], {}, EST);
  assert.equal(claim.slots, 0);
  assert.deepEqual(claim.above, []);
});

test('estimates: footprint history replaces the prior after 3 observations, clamped to [0.5x, 3x]', () => {
  // Two code.refactor and one scope.define running under 6300 MB of op agents with one 900 MB kernel:
  // 5400 MB shared by prior weight 2000:2000:800 -> 2250 MB per code.refactor, 900 per scope.define.
  const sample = { opAgentRamMb: 6300, kernels: 1, running: { 'code.refactor': 2, 'scope.define': 1 } };
  const obs = footprintObservations([sample], TABLE, T);
  assert.deepEqual(obs, { 'code.refactor': [2250], 'scope.define': [900] });
  const two = opRamEstimates(TABLE, [sample, sample], T);
  assert.equal(two['code.refactor'].source, 'table');
  const three = opRamEstimates(TABLE, [sample, sample, sample], T);
  assert.equal(three['code.refactor'].source, 'history');
  assert.equal(three['code.refactor'].mb, 2250);
  const wild = opRamEstimates(TABLE, Array(3).fill({ opAgentRamMb: 60000, kernels: 0, running: { 'scope.define': 1 } }), T);
  assert.equal(wild['scope.define'].mb, 2400, 'clamped to 3x the 800 MB prior');
});

test('footprint sample: agent and op process groups count, the rest do not', () => {
  const s = footprintSample({ owners: [{ key: 'agent:devin', ramMb: 3000 }, { key: 'op:op-code.refactor-0123456789', ramMb: 500 }, { key: 'image:chrome.exe', ramMb: 4000 }],
    ops: [...running(2, 'wf-fe', 'code.refactor').map((o) => ({ ...o, pool: 'devin-agent' })), ...queued(1, 'wf-fe')], kernels: 2, freeRamPct: 12 });
  assert.equal(s.opAgentRamMb, 3500);
  assert.deepEqual(s.running, { 'code.refactor': 2 });
  assert.deepEqual(s.runningByPool, { 'devin-agent': 2 });
});

test('hostThrottle: a fake host sample drives admission; the dispatch path never writes the mode (the Resource controller does)', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-ram-throttle-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const machine = { ...process.env, STARCI_TEST_MACHINE_FILE: path.join(dir, 'machine.sqlite') };
  const env = (freePct, extra = {}) => ({ ...machine, STARCI_HOST_RESOURCES_JSON: JSON.stringify({ freeDiskGb: 500, totalRamBytes: 68.6 * GB, freeRamBytes: 68.6 * GB * freePct / 100, cpuBusy: 0.6, ops: running(6), ...extra }) });
  const first = hostThrottle({ op: 'code.refactor', workflowId: 'wf-a', env: env(8) });
  assert.equal(first.mode, 'heavy-paused');
  assert.equal(first.admission.ok, false);
  assert.equal(first.admission.reason, 'heavy-paused');
  assert.equal(readThrottleState({ env: machine }).mode, undefined, 'nothing written: the hysteresis state is the Resource controller\'s');
  const back = hostThrottle({ op: 'code.refactor', workflowId: 'wf-a', env: env(20) });
  assert.equal(back.mode, 'normal');
  assert.equal(back.admission.ok, true);
  assert.equal(back.cap.maxParallelOps, 20);
  assert.match(throttleLine(back), /effective cap \d+\/20/);
  // The Supervisor's override puts wf-a on top: its heavy op starts under the heavy pause.
  assert.equal(setPriority({ workflowId: 'wf-a', weight: 5, reserve: 3, env: machine }), true);
  const prio = hostThrottle({ op: 'code.refactor', workflowId: 'wf-a', env: env(8) });
  assert.equal(prio.mode, 'heavy-paused');
  assert.equal(prio.admission.ok, true, prio.admission.detail);
});

test('land gate: critical pauses the spec run and refuses after the wait; heavy-paused halves the concurrency', () => {
  let clock = 0;
  const sleep = (ms) => { clock += ms; };
  const now = () => clock;
  const critical = specRunGate({ concurrency: 6, waitMs: 90_000, pollMs: 30_000, probe: () => ({ mode: 'critical', modeWhy: 'free RAM 8% < 10%' }), sleep, now });
  assert.equal(critical.ok, false);
  assert.equal(critical.waitedMs, 90_000);
  clock = 0;
  let calls = 0;
  const recovers = specRunGate({ concurrency: 6, waitMs: 90_000, pollMs: 30_000, probe: () => (++calls < 3 ? { mode: 'critical' } : { mode: 'heavy-paused', modeWhy: 'x' }), sleep, now });
  assert.equal(recovers.ok, true);
  assert.equal(recovers.concurrency, 3);
  assert.equal(specRunGate({ concurrency: 6, probe: () => ({ mode: 'normal' }), sleep, now }).concurrency, 6);
});
