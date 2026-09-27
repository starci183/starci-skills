import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  aggregate, failureClassOf, jobRecords, opMetrics, percentile, readSnapshots, severityOf, snapshotPayload, stuckCounts, stuckOf, stuckOwedItems,
  telemetrySettings, tickTelemetry, trendLine, WAIT_KINDS, SNAPSHOT_KIND,
} from '../scripts/supervisor/op-metrics.mjs';
import { ownerDigest } from '../scripts/supervisor/stall-alert.mjs';
import { digestText } from '../scripts/supervisor/actions.mjs';
import { workflowFrontiers, tickSettings } from '../scripts/supervisor/tick-duties.mjs';
import { runSupervisorTick } from '../scripts/supervisor/tick.mjs';
import { withSupervisorRead } from '../scripts/supervisor/home.mjs';

// Op health and the stuck SLA (scripts/supervisor/op-metrics.mjs; owner 2026-09-28 "upgrade supervisor to track
// properly"): per-op metrics from ledger rows, every wait aged against runtimes.yaml, the tick's snapshot and trend.

const NOW = Date.parse('2026-09-28T12:00:00Z');
const MIN = 60_000, HOUR = 60 * MIN;
const SLA = Object.fromEntries(WAIT_KINDS.map((k) => [k, { warnMs: HOUR, criticalMs: 4 * HOUR }]));

/** A minimal ledger: the four tables op-metrics reads. */
function ledger() {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE jobs(job_id TEXT PRIMARY KEY, workflow_id TEXT, op_id TEXT, attempt INTEGER, kind TEXT, status TEXT, payload_json TEXT, result_json TEXT, created_at INTEGER, updated_at INTEGER);
    CREATE TABLE events(seq INTEGER PRIMARY KEY AUTOINCREMENT, workflow_id TEXT, entity_type TEXT, entity_id TEXT, kind TEXT, payload_json TEXT, created_at INTEGER);
    CREATE TABLE reports(workflow_id TEXT, op_id TEXT, attempt INTEGER, outcome TEXT, report_json TEXT, created_at INTEGER);
    CREATE TABLE checks(workflow_id TEXT, op_id TEXT, attempt INTEGER, checks_json TEXT, created_at INTEGER);`);
  const job = (id, { wf = 'wf-a', op = 'uat.verify', attempt = 1, status = 'succeeded', payload = {}, result = {}, at = NOW - 10 * HOUR, updated = null } = {}) =>
    db.prepare('INSERT INTO jobs VALUES(?,?,?,?,?,?,?,?,?,?)').run(id, wf, op, attempt, 'op', status, JSON.stringify(payload), JSON.stringify(result), at, updated ?? at);
  const ev = (entity, kind, at, payload = {}, { wf = 'wf-a', type = 'job' } = {}) =>
    db.prepare('INSERT INTO events(workflow_id,entity_type,entity_id,kind,payload_json,created_at) VALUES(?,?,?,?,?,?)').run(wf, type, entity, kind, JSON.stringify(payload), at);
  const report = (op, attempt, outcome, body, at, wf = 'wf-a') => db.prepare('INSERT INTO reports VALUES(?,?,?,?,?,?)').run(wf, op, attempt, outcome, JSON.stringify({ outcome, ...body }), at);
  const checks = (op, attempt, list, at, wf = 'wf-a') => db.prepare('INSERT INTO checks VALUES(?,?,?,?,?)').run(wf, op, attempt, JSON.stringify({ checks: list }), at);
  return { db, job, ev, report, checks };
}

test('failureClassOf: dead worker, root cause, red check, typed blocker, verdict - an owner ask is no failure', () => {
  assert.equal(failureClassOf({ status: 'succeeded' }), null);
  assert.equal(failureClassOf({ status: 'failed', result: { verdict: 'awaiting-owner' } }), null);
  assert.equal(failureClassOf({ status: 'failed', result: { verdict: 'fail', worker: { liveness: 'gone' } } }), 'dead-worker:gone');
  assert.equal(failureClassOf({ status: 'failed', result: { verdict: 'fail' }, report: { outcome: 'failed', rootCause: { category: 'Contract-Gap' } } }), 'root-cause:contract-gap');
  assert.equal(failureClassOf({ status: 'failed', result: { verdict: 'fail' }, report: { outcome: 'failed' }, checks: [{ name: 'lint', exitCode: 0 }, { name: 'typecheck', exitCode: 2 }] }), 'check:typecheck');
  assert.equal(failureClassOf({ status: 'failed', result: { verdict: 'blocked' }, report: { outcome: 'blocked', blocker: { kind: 'authority' } } }), 'blocked:authority');
  assert.equal(failureClassOf({ status: 'failed', result: { verdict: 'fail' }, report: { outcome: 'failed' } }), 'verdict:fail');
  assert.equal(failureClassOf({ status: 'failed', result: { verdict: 'fail', failureClass: { class: 'product', reason: 'r' } }, report: { outcome: 'failed', rootCause: { category: 'contract-gap' } } }), 'product:contract-gap', 'the settle's own class (verify-failure.mjs) leads');
  assert.equal(failureClassOf({ status: 'failed', result: { verdict: 'fail', failureClass: { class: 'tool' } }, report: { outcome: 'failed' }, checks: [{ name: 'canon-scan', exitCode: 1 }] }), 'tool:canon-scan');
});

test('jobRecords + aggregate: success rate, waits, attempts per node, repeated identical failures, dead workers, owner wait, throttle', () => {
  const { db, job, ev, report, checks } = ledger();
  const T = NOW - 10 * HOUR;
  // Chain a1 -> a2 -> a3 of uat.verify: two identical check failures, then a pass.
  job('op-u-1', { attempt: 1, status: 'failed', result: { verdict: 'fail', at: T + 40 * MIN }, at: T });
  ev('op-u-1', 'op-dispatched', T + 10 * MIN); ev('op-u-1', 'report-filed', T + 30 * MIN); ev('op-u-1', 'op-settled', T + 40 * MIN, { verdict: 'fail' });
  report('uat.verify', 1, 'failed', {}, T + 30 * MIN); checks('uat.verify', 1, [{ name: 'e2e', exitCode: 1 }], T + 35 * MIN);
  job('op-u-2', { attempt: 2, status: 'failed', payload: { retry: { retryOf: 'op-u-1' } }, result: { verdict: 'fail', at: T + 100 * MIN }, at: T + 50 * MIN });
  ev('op-u-2', 'op-dispatched', T + 70 * MIN); ev('op-u-2', 'report-filed', T + 90 * MIN); ev('op-u-2', 'op-settled', T + 100 * MIN, { verdict: 'fail' });
  report('uat.verify', 2, 'failed', {}, T + 90 * MIN); checks('uat.verify', 2, [{ name: 'e2e', exitCode: 1 }], T + 95 * MIN);
  job('op-u-3', { attempt: 3, status: 'succeeded', payload: { retry: { retryOf: 'op-u-2' } }, result: { verdict: 'pass', at: T + 160 * MIN }, at: T + 110 * MIN });
  ev('op-u-3', 'dispatch-rejected', T + 115 * MIN, { step: 'reserve' });
  ev('op-u-3', 'op-dispatched', T + 140 * MIN); ev('op-u-3', 'report-filed', T + 150 * MIN); ev('op-u-3', 'op-settled', T + 160 * MIN, { verdict: 'pass' });
  // A dead worker, and an owner ask answered 2 h after its settle.
  job('op-d-1', { op: 'brand.decide', status: 'failed', result: { verdict: 'fail', worker: { liveness: 'disconnected' }, at: T + 60 * MIN }, at: T });
  ev('op-d-1', 'op-dispatched', T + 5 * MIN); ev('op-d-1', 'dead-worker-fenced', T + 50 * MIN, { worker: { liveness: 'disconnected' } });
  job('op-d-2', { op: 'brand.decide', attempt: 2, status: 'failed', result: { verdict: 'awaiting-owner', askDispatchId: 'ctx_aaaaaaaaaaaa', at: T + 3 * HOUR }, at: T + 2 * HOUR });
  ev('op-d-2', 'op-dispatched', T + 2 * HOUR + 5 * MIN); ev('op-d-2', 'op-settled', T + 3 * HOUR, { verdict: 'blocked' });
  ev('ctx_aaaaaaaaaaaa', 'ask-answered', T + 5 * HOUR, {}, { type: 'report' });
  // Outside the window: never counted.
  job('op-old', { op: 'brand.decide', at: NOW - 5 * 24 * HOUR });

  const records = jobRecords(db, { since: NOW - 24 * HOUR, now: NOW });
  assert.equal(records.length, 5);
  const u1 = records.find((r) => r.jobId === 'op-u-1');
  assert.deepEqual([u1.queueWaitMs, u1.runMs, u1.settleMs, u1.failureClass], [10 * MIN, 20 * MIN, 10 * MIN, 'check:e2e']);
  assert.equal(records.find((r) => r.jobId === 'op-u-3').throttleMs, 25 * MIN, 'first reject -> the dispatch');
  assert.equal(records.find((r) => r.jobId === 'op-d-2').ownerWaitMs, 2 * HOUR);
  assert.equal(records.find((r) => r.jobId === 'op-d-2').outcome, 'owner');

  const m = aggregate(records, { now: NOW, windowMs: 24 * HOUR });
  const uat = m.ops.find((r) => r.key === 'uat.verify');
  assert.equal(uat.successRate, 1 / 3);
  assert.equal(uat.repeatedIdentical, 1, 'a2 failed exactly as a1 did');
  assert.deepEqual(uat.attemptsPerNode, { nodes: 1, mean: 3, max: 3 });
  assert.equal(uat.topFailureClass, 'check:e2e');
  assert.equal(uat.queueWait.p50, 20 * MIN);
  const brand = m.ops.find((r) => r.key === 'brand.decide');
  assert.equal(brand.successRate, 0, 'the owner ask is neither a pass nor a fail');
  assert.equal(brand.topFailureClass, 'dead-worker:disconnected');
  assert.equal(brand.deadWorkerRate, 0.5);
  assert.equal(brand.ownerWait.totalMs, 2 * HOUR);
  assert.equal(m.workflows.length, 1);
  assert.equal(opMetrics(db, { now: NOW, windowMs: 24 * HOUR, workflowId: 'wf-none' }).totals.jobs, 0);
});

test('stuckOf: every wait gets an age, a severity and the owner of its next action', () => {
  const { db, job, ev } = ledger();
  ev('inc-gate000001', 'incident-raised', NOW - 5 * HOUR, {}, { type: 'incident' });
  ev('inc-gate000002', 'incident-raised', NOW - 2 * HOUR, {}, { type: 'incident' });
  ev('inc-cap0000001', 'incident-raised', NOW - 90 * MIN, {}, { type: 'incident' });
  job('op-cap', { op: 'uat.verify', status: 'failed', result: { verdict: 'fail', at: NOW - 90 * MIN, nextStep: { kind: 'owner-gate', route: 'failed-retries-the-same-op', limit: 3, firing: 3, incidentId: 'inc-cap0000001' } } });
  job('op-held', { op: 'business.decide', status: 'running', at: NOW - 3 * HOUR });
  ev('op-held', 'report-consumed', NOW - 30 * MIN);
  job('op-block', { op: 'business.decide', status: 'queued', at: NOW - 6 * HOUR });
  job('op-dep-1', { op: 'backend.implement', status: 'queued', at: NOW - 7 * HOUR });
  job('op-dep-2', { op: 'backend.implement', status: 'queued', at: NOW - 3 * HOUR });
  job('op-ready', { op: 'workspace.manage', status: 'queued', at: NOW - 2 * HOUR, updated: NOW - 20 * MIN });
  job('op-pool', { op: 'interface.draw', status: 'queued', at: NOW - 2 * HOUR });
  job('op-ask', { op: 'provision.ask', status: 'failed', result: { verdict: 'awaiting-owner', at: NOW - 50 * MIN } });
  const stuck = stuckOf({ db, workflowId: 'wf-a', now: NOW, sla: SLA,
    ownerGates: [{ incidentId: 'inc-gate000001', holds: ['business.decide'], detail: 'waits on the owner ask ctx_bbbbbbbbbbbb' },
      { incidentId: 'inc-gate000002', holds: ['interface.asset'], detail: 'debris sweep pending' },
      { incidentId: 'inc-cap0000001', holds: ['uat.verify'], detail: 'route fired its limit' }],
    peerWaits: [{ incidentId: 'inc-peer000001', peer: 'wf-b', peerRunning: true, since: NOW - 20 * MIN, detail: 'waits on wf-b grammar' }],
    queued: [
      { jobId: 'op-block', opId: 'business.decide', queuedBecause: 'owner-gate', blockedBy: { incident: 'inc-gate000001' } },
      { jobId: 'op-dep-1', opId: 'backend.implement', queuedBecause: 'dependency', blockedBy: { op: 'business.decide', job: 'op-block' }, detail: 'leg business.decide first' },
      { jobId: 'op-dep-2', opId: 'backend.implement', queuedBecause: 'dependency', blockedBy: { op: 'business.decide', job: 'op-block' }, detail: 'leg business.decide first' },
      { jobId: 'op-ready', opId: 'workspace.manage', queuedBecause: 'ready' },
      { jobId: 'op-pool', opId: 'interface.draw', queuedBecause: 'pool-full', detail: 'codex-agent 10/10' },
    ],
    heldSettle: [{ jobId: 'op-held', opId: 'business.decide', attempt: 1, heldBecause: 'owner-gate', blockedBy: { incident: 'inc-gate000002' }, detail: 'held' }],
    awaitingOwner: [{ jobId: 'op-ask', opId: 'provision.ask', dispatchId: 'ctx_cccccccccccc', answer: 'pending' }] });
  const by = (kind, id) => stuck.find((s) => s.kind === kind && (s.incidentId === id || s.jobId === id));
  assert.deepEqual(pick(by('owner-gate', 'inc-gate000001')), { severity: 'critical', owner: 'owner', ageMs: 5 * HOUR }, 'the gate names an ask: the owner moves it');
  assert.deepEqual(pick(by('owner-gate', 'inc-gate000002')), { severity: 'warn', owner: 'supervisor', ageMs: 2 * HOUR }, 'no ask names it: the supervisor rules or types it');
  assert.deepEqual(pick(by('retry-cap', 'inc-cap0000001')), { severity: 'warn', owner: 'supervisor', ageMs: 90 * MIN });
  assert.ok(!stuck.some((s) => s.kind === 'owner-gate' && s.incidentId === 'inc-cap0000001'), 'a retry cap is not counted twice as a gate');
  assert.deepEqual(pick(by('peer-wait', 'inc-peer000001')), { severity: 'ok', owner: 'peer:wf-b', ageMs: 20 * MIN });
  const dep = by('dependency', 'op-block');
  assert.deepEqual([dep.count, dep.owner, dep.ageMs, dep.severity], [2, 'owner', 7 * HOUR, 'critical'], 'one item per job waited on, owned by whoever moves that job');
  assert.deepEqual(pick(by('queued-ready', 'op-ready')), { severity: 'ok', owner: 'kernel', ageMs: 20 * MIN });
  assert.deepEqual(pick(by('throttled', 'op-pool')), { severity: 'warn', owner: 'supervisor', ageMs: 2 * HOUR });
  assert.deepEqual(pick(by('deferred-settle', 'op-held')), { severity: 'ok', owner: 'supervisor', ageMs: 30 * MIN });
  assert.equal(by('owner-gate', 'op-ask').cause, 'owner-ask');
  assert.equal(stuck[0].severity, 'critical', 'critical first');
  const counts = stuckCounts(stuck);
  assert.equal(counts.critical, 2);
  const owed = stuckOwedItems(stuck, { repo: 'D:/r' });
  assert.equal(owed.length, counts.warn + counts.critical, 'every wait past its SLA is an owed action, none below it');
  assert.ok(owed.every((i) => i.class === 'supervisor' && /^stuck-/.test(i.kind) && i.severity !== 'ok' && i.action && i.line.startsWith('STUCK ')));
});
const pick = (s) => ({ severity: s.severity, owner: s.owner, ageMs: s.ageMs });

test('severity and settings: thresholds come from runtimes.yaml, a missing one refuses', () => {
  assert.equal(severityOf(59 * MIN, { warnMs: HOUR, criticalMs: 2 * HOUR }), 'ok');
  assert.equal(severityOf(HOUR, { warnMs: HOUR, criticalMs: 2 * HOUR }), 'warn');
  assert.equal(severityOf(2 * HOUR, { warnMs: HOUR, criticalMs: 2 * HOUR }), 'critical');
  const s = telemetrySettings();
  assert.deepEqual(Object.keys(s.stuckSla).sort(), [...WAIT_KINDS].sort());
  assert.ok(s.windowMs > 0 && s.trendMs > 0);
  assert.throws(() => telemetrySettings({ opTelemetry: { windowMs: 1, trendMs: 1, stuckSla: {} } }), /stuckSla\.owner-gate\.warnMs/);
  assert.throws(() => telemetrySettings({ opTelemetry: { windowMs: 1, trendMs: 1, stuckSla: Object.fromEntries(WAIT_KINDS.map((k) => [k, { warnMs: 5, criticalMs: 2 }])) } }), /criticalMs must be >= warnMs/);
  assert.equal(percentile([], 50), null);
  assert.equal(percentile([5, 1, 3], 50), 3);
});

test('trendLine compares the newest snapshot with the one closest to trendMs earlier', () => {
  const snap = (at, rate, wait, warn, critical) => ({ at, windowMs: 24 * HOUR, totals: { successRate: rate, queueWaitP50: wait, topFailureClass: 'check:e2e' }, stuck: { warn, critical } });
  assert.equal(trendLine([], { trendMs: 24 * HOUR }), null);
  const line = trendLine([snap(NOW - 30 * HOUR, 0.4, 10 * MIN, 1, 0), snap(NOW - 24 * HOUR, 0.5, 8 * MIN, 2, 1), snap(NOW, 0.62, 5 * MIN, 3, 2)], { trendMs: 24 * HOUR });
  assert.equal(line, 'Op health 1.0d: success 62% (+12pt), median wait 5m (-3m), stuck 5 (2 critical) (+2); top failure check:e2e [vs 1.0d ago]');
  assert.match(trendLine([snap(NOW, 0.62, 5 * MIN, 0, 0)], { trendMs: HOUR, language: 'vi' }), /^Sức khỏe op 1\.0d: đạt 62%/);
});

test('the owner digest carries the trend line when one is given', () => {
  const items = [{ workflowId: 'wf-a', type: 'GATE', incidentId: 'inc-000000000001', text: 'owner decides', raisedAt: NOW - HOUR, key: 'k' }];
  assert.doesNotMatch(ownerDigest(items, 'en', { now: NOW }), /Op health/);
  assert.match(ownerDigest(items, 'en', { now: NOW, trend: 'Op health 1.0d: success 62%' }), /\n\nOp health 1\.0d: success 62%\n\n/);
  assert.match(digestText({ trend: 'Op health 1.0d: success 62%', now: NOW }), /^StarCi supervisor digest [^\n]+\nOp health 1\.0d: success 62%\n/, 'the periodic digest (actions.mjs) too');
});

test('tickTelemetry: snapshot payload, trend, owed actions for warn+critical, alerts for critical only', async () => {
  const { db, job } = ledger();
  job('op-x', { status: 'succeeded', at: NOW - HOUR });
  const stuck = [
    { key: 'stuck:wf-a:queued-ready:op-r', workflowId: 'wf-a', kind: 'queued-ready', cause: 'ready', jobId: 'op-r', since: NOW - 5 * HOUR, ageMs: 5 * HOUR, severity: 'critical', owner: 'kernel', repo: 'D:/r', detail: 'ready' },
    { key: 'stuck:wf-a:peer-wait:inc-1', workflowId: 'wf-a', kind: 'peer-wait', incidentId: 'inc-1', since: NOW - 2 * HOUR, ageMs: 2 * HOUR, severity: 'warn', owner: 'peer:wf-b', repo: 'D:/r', detail: 'w' },
    { key: 'stuck:wf-a:dependency:op-q', workflowId: 'wf-a', kind: 'dependency', jobId: 'op-q', since: NOW - MIN, ageMs: MIN, severity: 'ok', owner: 'kernel', repo: 'D:/r', detail: 'd' },
  ];
  const t = await tickTelemetry({ repos: ['D:/r'], stuck, now: NOW, settings: { windowMs: 24 * HOUR, trendMs: 24 * HOUR, stuckSla: SLA },
    openRead: () => ({ db, close: () => {} }), snapshots: () => [] });
  assert.equal(t.metrics.totals.jobs, 1);
  assert.deepEqual(t.payload.stuck, { total: 3, ok: 1, warn: 1, critical: 1, byKind: { 'queued-ready': 1, 'peer-wait': 1 }, byOwner: { kernel: 1, peer: 1 } });
  assert.equal(t.owed.length, 2);
  assert.deepEqual(t.alerts.map((a) => a.key), ['stuck:wf-a:queued-ready:op-r']);
  assert.match(t.alerts[0].text, /^STUCK-CRITICAL STUCK critical wf-a queued-ready\/ready op-r age=5\.0h next=kernel/);
  assert.match(t.trend, /^Op health 1\.0d: success 100%/);
  assert.ok(t.lines.some((l) => /stuck 2 past SLA \(1 critical\) of 3 wait\(s\)/.test(l)));
  assert.equal(snapshotPayload(t.metrics, stuck).schema, 'starci/op-metrics-snapshot@1');
});

test('workflowFrontiers carries each workflow\'s stuck items with their repo', () => {
  const f = workflowFrontiers({ repos: ['D:/r'], runningOf: () => [{ workflowId: 'wf-a' }],
    frontierOf: () => ({ ok: true, frontier: { state: 'engaged', queuedCauses: {} }, stuck: [{ key: 'k', severity: 'warn' }] }) });
  assert.deepEqual(f.stuck, [{ key: 'k', severity: 'warn', repo: 'D:/r' }]);
});

test('the supervisor tick records one op-metrics snapshot and alerts a critical stuck item', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-op-telemetry-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 }));
  const env = { ...process.env, LOCALAPPDATA: path.join(root, 'la'), STARCI_SUPERVISOR_HOME: path.join(root, 'home'), STARCI_CONNECTORS_OFF: '1' };
  const sent = [];
  const critical = { key: 'stuck:wf-a:owner-gate:inc-000000000009', workflowId: 'wf-a', kind: 'owner-gate', cause: 'owner-gate', incidentId: 'inc-000000000009', since: NOW - 30 * HOUR, ageMs: 30 * HOUR, severity: 'critical', owner: 'supervisor', detail: 'no ask' };
  const r = await runSupervisorTick({ repos: [path.join(root, 'no-ledger')], push: false, heartbeat: false, env, now: () => NOW, settings: tickSettings(), deps: {
    listProcesses: () => [], orca: { probe: () => 'ok' }, statusApp: { up: async () => true }, runTick: async () => ({ digests: [], lines: [] }),
    frontiers: { runningOf: () => [{ workflowId: 'wf-a' }], frontierOf: () => ({ ok: true, frontier: { state: 'awaiting-owner', queuedCauses: {} }, stuck: [critical] }) },
    deadKernels: () => [], load: () => ({ cpuBusy: 0, freeMem: 1, totalRamBytes: 1 }),
    sendAlerts: async (due) => { sent.push(...due); return { inbox: { ok: true }, telegram: { ok: true, skipped: 'spec' } }; },
  } });
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.ok(sent.some((a) => a.key === critical.key && /STUCK-CRITICAL/.test(a.text) && /no owner ask names this gate/.test(a.text)));
  const snaps = withSupervisorRead((db) => readSnapshots(db), [], { env });
  assert.equal(snaps.length, 1);
  assert.equal(snaps[0].at, NOW);
  assert.equal(snaps[0].stuck.critical, 1);
  assert.ok(r.lines.some((l) => l.startsWith('----- op health ')));
  assert.equal(SNAPSHOT_KIND, 'supervisor-op-metrics');
});
