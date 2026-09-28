import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fakeCtx } from '../scripts/reconciler/testing.mjs';
import fleet, { KEYS, reconcileFleet, waitCycles, planDeps, planOwed, planLand, planPush, overdueUrgent, DEFAULTS } from '../scripts/reconciler/controllers/fleet.mjs';
import { clusterOwed } from '../scripts/supervisor/cluster.mjs';
import { digest, urgent, planUrgent, digestDue, composeDigest, URGENT_KEY_MS } from '../scripts/reconciler/notifier.mjs';
import { digestText } from '../scripts/supervisor/actions.mjs';

// Lane rc-fleet-ui (LANES.md "Lane G", DESIGN.md §8.6, §10.2, §17.2): a wait cycle is ONE deadlock DI, an owed cluster
// ONE Supervisor DI (the same key on every pass), and the Notifier sends one digest per window and one urgent message
// per key per 6 h. Ledgers and Telegram are faked: the ctx is scripts/reconciler/testing.mjs fakeCtx, the push a stub.

const HERE = fileURLToPath(import.meta.url);
const NOW = Date.parse('2026-09-28T10:00:00Z');
const MIN = 60_000;
// A ledger whose file exists (this spec) and a reader that is never queried: the deps/owed helpers are injected.
const ledgers = [{ ledgerId: 'nivo-backend', repo: 'D:/Repositories/nivo-backend', file: HERE }, { ledgerId: 'supervisor', repo: null, file: HERE }];
const ctxOf = (over = {}) => fakeCtx({ controller: 'fleet', now: () => NOW, ledgers, openReader: () => ({ close() {} }), ...over });

test('the controller module follows the shared contract', () => {
  assert.equal(fleet.name, 'fleet');
  assert.deepEqual(fleet.concerns, ['fleet.owed', 'fleet.push', 'fleet.deps', 'notify.owner']);
  assert.equal(typeof fleet.reconcile, 'function');
  assert.equal(fleet.routes['land-*']({ kind: 'land-passed' }), KEYS.land);
});

test('waitCycles: a 2-workflow cycle is one cycle with a canonical order; a chain is none', () => {
  assert.deepEqual(waitCycles([{ from: 'wf-b', to: 'wf-a' }, { from: 'wf-a', to: 'wf-b' }]), [['wf-a', 'wf-b']]);
  assert.deepEqual(waitCycles([{ from: 'wf-a', to: 'wf-b' }, { from: 'wf-b', to: 'wf-c' }]), []);
  assert.deepEqual(waitCycles([{ from: 'wf-c', to: 'wf-a' }, { from: 'wf-a', to: 'wf-b' }, { from: 'wf-b', to: 'wf-c' }]), [['wf-a', 'wf-b', 'wf-c']]);
});

test('a 2-workflow wait cycle opens exactly one deadlock DI for the Supervisor, with the same key on every pass', async () => {
  const graph = { edges: [{ from: 'wf-fe', to: 'wf-be', via: 'seam:api', strength: 'hard' }, { from: 'wf-be', to: 'wf-fe', via: 'peer-wait', strength: 'hard' }, { from: 'wf-x', to: 'wf-fe', strength: 'soft' }], findings: [] };
  const ctx = ctxOf();
  const deps = { dependencyGraph: () => graph, force: true };
  const first = await reconcileFleet(KEYS.deps, ctx, { settings: DEFAULTS, deps });
  const second = await reconcileFleet(KEYS.deps, ctx, { settings: DEFAULTS, deps });
  assert.equal(first.cycles, 1);
  const deadlocks = ctx.calls.decisions.filter((d) => d.kind === 'deadlock');
  assert.equal(deadlocks.length, 2, 'one per pass');
  assert.equal(new Set(deadlocks.map((d) => d.idempotencyKey)).size, 1, 'the same idempotency key: decisions.mjs keeps one live DI');
  const d = deadlocks[0];
  assert.equal(d.idempotencyKey, 'deadlock:wf-be+wf-fe');
  assert.equal(d.decider, 'supervisor');
  assert.equal(d.ledger, 'supervisor');
  assert.deepEqual(d.options.map((o) => o.key), ['seam-stub', 'bridge', 'lower-priority:wf-fe']);
  assert.equal(second.opened.length, 1);
});

test('the deps cadence: a second pass inside depsEveryMs does nothing', async () => {
  const ctx = ctxOf();
  const deps = { dependencyGraph: () => ({ edges: [], findings: [] }) };
  assert.equal((await reconcileFleet(KEYS.deps, ctx, { settings: DEFAULTS, deps })).skipped, undefined);
  assert.equal((await reconcileFleet(KEYS.deps, ctx, { settings: DEFAULTS, deps })).skipped, 'not-due');
});

test('hub-blocker and unowned-need findings are one cross-workflow DI each', () => {
  const plan = planDeps({ now: NOW, graphs: [{ ledgerId: 'nivo-backend', edges: [], findings: [
    { kind: 'hub-blocker', workflows: ['wf-b', 'wf-a'], summary: 'wf-a blocks 2', proposal: { action: 'bridge', why: 'transfer the need', clearCut: true } },
    { kind: 'duplicate-work', workflows: ['wf-a', 'wf-c'], summary: 'dup' },
  ] }] });
  assert.equal(plan.length, 1);
  assert.equal(plan[0].kind, 'cross-workflow');
  assert.equal(plan[0].idempotencyKey, 'cross-workflow:hub-blocker:wf-a+wf-b');
  assert.equal(plan[0].options[0].recommended, true);
});

test('an owed cluster opens one Supervisor DI keyed by the cluster, idempotent across passes; a fixed cluster opens none', async () => {
  const items = [
    { key: 'owed|a', workflowId: 'wf-a', incidentId: 'inc-000000000001', kind: 'runtime-defect', class: 'supervisor', summary: 'checker crashed', raisedAt: NOW - 40 * MIN, ageMin: 40, fixTokens: ['checker-crash'] },
    { key: 'owed|b', workflowId: 'wf-b', incidentId: 'inc-000000000002', kind: 'runtime-defect', class: 'supervisor', summary: 'checker crashed', raisedAt: NOW - 30 * MIN, ageMin: 30, fixTokens: ['checker-crash'] },
  ];
  const clusters = clusterOwed(items);
  const plan = planOwed({ clusters, now: NOW });
  assert.equal(plan.length, clusters.filter((c) => !c.fixedBy).length);
  assert.ok(plan.every((d) => d.decider === 'supervisor' && d.idempotencyKey === `owed:${d.entity.id}`));
  const ctx = ctxOf();
  const deps = { owed: Promise.resolve({ owedFindings: () => items }), cluster: Promise.resolve({ clusterOwed }), force: true };
  await reconcileFleet(KEYS.owed, ctx, { settings: DEFAULTS, deps });
  await reconcileFleet(KEYS.owed, ctx, { settings: DEFAULTS, deps });
  const keys = ctx.calls.decisions.map((d) => d.idempotencyKey);
  assert.equal(new Set(keys).size, plan.length, 'the same keys on the second pass');
  assert.deepEqual(planOwed({ clusters: clusters.map((c) => ({ ...c, fixedBy: 'abc1234' })), now: NOW }), []);
});

test('the land pass holds LAND_QUEUE_STALL while busy, LAND_FAILED_UNOWNED for the newest failure, DERIVED_STALE for a stale dist', async () => {
  const plan = planLand({ now: NOW, land: { busy: true, current: { at: NOW - 10 * MIN } }, events: [{ kind: 'land-failed', id: 'lane-x', at: NOW - 5 * MIN }, { kind: 'land-failed', id: 'lane-old', at: NOW - 60 * MIN }], dist: { ok: false, state: 'stale' } });
  assert.deepEqual(plan.set.map((c) => c.state), ['LAND_QUEUE_STALL', 'LAND_FAILED_UNOWNED', 'DERIVED_STALE']);
  assert.ok(plan.clear.some((c) => c.entity === 'land:lane-old'));
  const calm = planLand({ now: NOW, land: { busy: false }, events: [{ kind: 'land-passed', id: 'lane-y', at: NOW }], dist: { ok: true, state: 'fresh' } });
  assert.deepEqual(calm.set, []);
  const ctx = ctxOf();
  const r = await reconcileFleet(KEYS.land, ctx, { settings: DEFAULTS, deps: { landStatus: () => ({ busy: true, current: null }), landEvents: [], dist: { ok: true, state: 'fresh' } } });
  assert.deepEqual(r.clocks, ['LAND_QUEUE_STALL:land:queue']);
  assert.equal(ctx.calls.clock[0].state, 'LAND_QUEUE_STALL');
});

test('push: shadow only records the run; a refused repo is one push-refused DI', async () => {
  const ctx = ctxOf();
  const r = await reconcileFleet(KEYS.push, ctx, { settings: DEFAULTS, deps: { force: true } });
  assert.equal(r.shadow, true);
  assert.equal(ctx.calls.run[0].args[0], 'scripts/supervisor/push-mains.mjs');
  const plan = planPush({ now: NOW, results: [{ repo: 'D:/Repositories/nivo-fe', pushed: false, refused: 'secret scan found candidates', head: 'abcdef1234567890', signature: 'secret-scan:aws-key' },
    { repo: 'D:/Repositories/nivo-be', pushed: false, error: 'failed', head: '' }, { repo: 'D:/x', pushed: true }] });
  assert.equal(plan.length, 1);
  assert.match(plan[0].idempotencyKey, /^push-refused:nivo-fe:[0-9a-f]{10}:abcdef123456$/);
  assert.deepEqual(plan[0].keyParts, { kind: 'push-refused', repo: 'nivo-fe', signature: 'secret-scan:aws-key', head: 'abcdef1234567890' });
  assert.equal(plan.incomplete.length, 1, 'a refusal without head or signature opens nothing (MB-07)');
});

test('a Supervisor DI escalated 3 times and past due is an urgent item; others are not', () => {
  const dis = [{ id: 'di-1', status: 'escalated', escalations: 3, dueAt: NOW - MIN, summary: 'deadlock' }, { id: 'di-2', status: 'open', escalations: 1, dueAt: NOW - MIN }, { id: 'di-3', status: 'resolved', escalations: 5, dueAt: 0 }];
  assert.deepEqual(overdueUrgent(dis, { now: NOW }).map((u) => u.key), ['di:di-1']);
});

test('notify: in shadow the controller only records the notifier run', async () => {
  const ctx = ctxOf();
  const r = await reconcileFleet(KEYS.notify, ctx, { settings: DEFAULTS, deps: { force: true } });
  assert.equal(r.digest, 'shadow');
  assert.deepEqual(ctx.calls.run[0].args.slice(0, 3), ['scripts/reconciler/notifier.mjs', 'digest', '--send']);
});

/* ------------------------------------------------------------ the Notifier */

function home(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-rc-notifier-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 }));
  return { ...process.env, STARCI_SUPERVISOR_HOME: dir, LOCALAPPDATA: dir, STARCI_CONNECTORS_OFF: '1' };
}
const inputs = { progress: [{ workflowId: 'wf-nivo-fe-canon', name: 'Nivo · Chuẩn hoá code FE', progress: { unitsDone: 14, unitsTotal: 36, unitsPerHour: 4, minUnitsPerHour: 3, eta: '2026-09-28T18:00:00Z', stall: { stalled: false } }, why: null }],
  ownerWaits: [], violations: [{ code: 'SETTLE_OVERDUE' }, { code: 'SETTLE_OVERDUE' }], gc: 'Dọn rác: 0 agent, 0 terminal, 3 worktree, 0.4 GB', actions: [], owed: null };

test('the notifier sends one digest per window (fake push), then refuses until the window passes', async (t) => {
  const env = home(t);
  const sent = [];
  const push = async (text) => { sent.push(text); return { ok: true, messageId: sent.length }; };
  const everyMs = 2 * 3_600_000;
  const a = await digest({ send: true, env, now: NOW, everyMs, push, inputs, language: 'vi' });
  const b = await digest({ send: true, env, now: NOW + 30 * MIN, everyMs, push, inputs, language: 'vi' });
  const c = await digest({ send: true, env, now: NOW + everyMs, everyMs, push, inputs, language: 'vi' });
  assert.equal(a.sent, true);
  assert.equal(b.sent, false);
  assert.match(b.skipped, /last digest 30m ago/);
  assert.equal(c.sent, true);
  assert.equal(sent.length, 2);
  assert.match(sent[0], /14\/36 đơn vị, 4\/h/);
  assert.match(sent[0], /SETTLE_OVERDUE x2/);
  assert.match(sent[0], /Dọn rác/);
});

test('the notifier sends one urgent message per key per 6 h, and only for the urgent classes', async (t) => {
  const env = home(t);
  const sent = [];
  const push = async (text) => { sent.push(text); return { ok: true }; };
  const item = { class: 'ram-critical', key: 'ram:host', text: 'RAM 96%' };
  const first = await urgent([item], { send: true, env, now: NOW, push });
  const again = await urgent([item], { send: true, env, now: NOW + 60 * MIN, push });
  const later = await urgent([item], { send: true, env, now: NOW + URGENT_KEY_MS + MIN, push });
  const wrong = await urgent([{ class: 'progress-stall', key: 'x', text: 'slow' }], { send: true, env, now: NOW, push });
  assert.deepEqual(first.sent, ['ram:host']);
  assert.deepEqual(again.sent, []);
  assert.deepEqual(later.sent, ['ram:host']);
  assert.deepEqual(wrong.sent, []);
  assert.match(wrong.skipped[0].why, /not an urgent class/);
  assert.equal(sent.length, 2);
});

test('pure pieces: digestDue, planUrgent, composeDigest', () => {
  assert.equal(digestDue({ lastSentAt: null, now: NOW, everyMs: 1 }), true);
  assert.equal(digestDue({ lastSentAt: NOW - 10, now: NOW, everyMs: 100 }), false);
  assert.equal(digestDue({ lastSentAt: NOW - 10, now: NOW, everyMs: 100, force: true }), true);
  assert.deepEqual(planUrgent([{ class: 'crash-loop', key: 'k', text: '' }, { class: 'crash-loop', key: 'k', text: '' }], {}, { now: NOW }).due.length, 1);
  const text = composeDigest({ digestText, ...inputs, lands: [{ kind: 'land-passed', id: '7feb447e0', at: NOW - MIN }], judgements: [{ text: 'fe-canon on track', at: NOW }], language: 'vi', now: NOW });
  assert.match(text, /AUTO land hôm nay: 1/);
  assert.match(text, /Nhận định của Supervisor/);
});

/* ------------------------------------------------------------ what only the deleted tick did */

test('fleet:metrics records one op-health snapshot per window (telemetry, also in shadow) with the cached stuck waits', async () => {
  const recorded = [];
  const om = await import('../scripts/supervisor/op-metrics.mjs');
  const ctx = ctxOf({ status: { 'nivo-backend:wf-a': { stuck: [{ key: 'k', kind: 'queued-ready', severity: 'critical', ageMs: 1 }] } } });
  const db = { prepare: (sql) => ({ all: () => (/FROM workflows/.test(sql) ? [{ workflow_id: 'wf-a' }] : []) }), close() {} };
  ctx.openReader = () => db;
  const deps = { opMetrics: { ...om, jobRecords: () => [] }, recordSnapshot: async (p) => recorded.push(p) };
  const r = await reconcileFleet(KEYS.metrics, ctx, { settings: DEFAULTS, deps });
  assert.equal(r.ok, true);
  assert.equal(recorded.length, 1);
  assert.equal(recorded[0].schema, 'starci/op-metrics-snapshot@1');
  assert.equal(recorded[0].stuck.critical, 1);
  assert.equal((await reconcileFleet(KEYS.metrics, ctx, { settings: DEFAULTS, deps })).skipped, 'not-due');
});

test('fleet:direct: each direct commit on main is one runtime-defect Supervisor DI, only in the exclusive land-gate mode', async () => {
  const commits = [{ sha: 'a'.repeat(40), subject: 'hotfix straight on main' }];
  const ctx = ctxOf();
  const r = await reconcileFleet(KEYS.direct, ctx, { settings: DEFAULTS, deps: { force: true, landGateMode: 'exclusive', directCommits: () => commits } });
  assert.equal(r.direct, 1);
  assert.equal(ctx.calls.decisions[0].kind, 'runtime-defect');
  assert.equal(ctx.calls.decisions[0].idempotencyKey, `direct-commit:${'a'.repeat(40)}`);
  const shared = ctxOf();
  assert.match((await reconcileFleet(KEYS.direct, shared, { settings: DEFAULTS, deps: { force: true, landGateMode: 'shared', directCommits: () => commits } })).skipped, /land gate shared/);
  assert.equal(shared.calls.decisions.length, 0);
});

test('the digest carries the op-health trend line', () => {
  const text = composeDigest({ digestText, ...inputs, trend: 'Sức khỏe op 1d: đạt 44%', lands: [], judgements: [], language: 'vi', now: NOW });
  assert.match(text, /Sức khỏe op 1d: đạt 44%/);
});
