import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { unitsOf } from '../scripts/kernel/progress-rca.mjs';
import { logRowOf } from '../scripts/reconciler/ctx.mjs';
import { supLogRows } from '../scripts/supervisor/sup-log.mjs';
import { attemptOf, diffRefOf, unitGraphOf } from '../ui/unit-graph.mjs';
import { reconcilerState } from '../ui/reconciler.mjs';

// The workflow page's unit board read models (ui/unit-graph.mjs) and the system page's controller attribution
// (ui/reconciler.mjs reconcilerState): only what the ledger records, null with a reason otherwise.
const job = (id, { op = 'code.refactor', status = 'succeeded', attempt = 1, at = 1, ...payload } = {}) =>
  ({ job_id: id, op_id: op, attempt, status, created_at: at, updated_at: at, payload, result: {} });

test('unitGraphOf draws only recorded after and seam edges between units, never order', () => {
  const jobs = [
    job('j-seam', { cut: { id: 'c', ordinal: 1, total: 3 }, at: 1 }),
    job('j-2', { cut: { id: 'c', ordinal: 2, total: 3, seamStub: { mode: 'timeout', seamJobId: 'j-seam' } }, at: 2 }),
    job('j-3', { cut: { id: 'c', ordinal: 3, total: 3 }, status: 'failed', at: 3 }),
    // A retry of ordinal 3: same unit; its after copies the predecessor's (one edge per unit pair).
    job('j-3b', { cut: { id: 'c', ordinal: 3, total: 3 }, status: 'queued', attempt: 2, retry: { retryOf: 'j-3' }, after: ['j-2'], at: 4 }),
    job('j-wire', { after: ['j-2', 'j-3b', 'op-elsewhere-1', 'j-wire-old'], status: 'queued', at: 5, retry: { retryOf: 'j-wire-old' } }),
    job('j-wire-old', { status: 'failed', at: 0 }),
    // Plain order without a recorded edge: no edge.
    job('j-lone', { op: 'review.verify', at: 6 }),
  ];
  const units = unitsOf(jobs);
  const g = unitGraphOf(jobs, units);
  assert.equal(g.status, 'ok');
  const e = (from, to, kind) => g.edges.find((x) => x.from === from && x.to === to && x.kind === kind);
  const seam2 = e('code.refactor|c#1', 'code.refactor|c#2', 'seam');
  assert.ok(seam2 && seam2.met && seam2.released === 'timeout' && seam2.source === 'jobs.payload.cut');
  assert.equal(e('code.refactor|c#1', 'code.refactor|c#3', 'seam').released, null);
  const wireKey = units.find((u) => u.jobs.some((j) => j.job_id === 'j-wire')).key;
  assert.ok(e('code.refactor|c#2', wireKey, 'after') && e('code.refactor|c#3', wireKey, 'after'));
  assert.equal(e('code.refactor|c#3', wireKey, 'after').met, false, 'the prerequisite unit has no succeeded job');
  assert.equal(g.counts.dangling, 1, 'an after outside the workflow is counted, not drawn');
  assert.equal(g.counts.selfLoops, 1, 'an after inside its own retry lineage is no edge');
  assert.equal(g.edges.filter((x) => x.to === 'code.refactor|c#3' && x.kind === 'after').length, 1);
  assert.ok(!g.edges.some((x) => x.from.startsWith('review.verify') || x.to.startsWith('review.verify')), 'no edge from ordering alone');
  assert.equal(g.nodes.length, units.length);
  assert.deepEqual(g.nodes.find((n) => n.unitKey === 'code.refactor|c#3').cut, { id: 'c', ordinal: 3, total: 3 });
  assert.ok(g.omitted.some((o) => o.kind === 'record'), 'record dependsOn holds are named as not drawn');

  const none = unitGraphOf([job('a'), job('b', { at: 2 })], unitsOf([job('a'), job('b', { at: 2 })]));
  assert.equal(none.status, 'empty');
  assert.match(none.reason, /no job of this workflow records a dependency/);
  assert.equal(unitGraphOf([], []).reason, 'the workflow has no op job yet');
});

test('attemptOf reads provider/model from the attempt record, null with a reason when it is absent', () => {
  const dispatched = attemptOf(job('d', { status: 'succeeded', attempt: 4, routedAt: 100, effort: 'high',
    hierarchy: { runtime: { agent: 'codex', provider: 'codex', model: 'gpt-6-luna', runtimePool: 'codex-agent', dispatchId: 'ctx_1' } } }),
  [{ kind: 'op-dispatched', created_at: 200, payload: { model: 'codex-agent', modelId: 'gpt-6-luna', effort: 'medium' } }, { kind: 'op-dispatched', created_at: 260, payload: { model: 'codex-agent', modelId: 'gpt-6-luna', effort: 'medium' } },
    { kind: 'report-filed', created_at: 300 }, { kind: 'op-settled', created_at: 400 }], { at: 300 });
  assert.deepEqual({ ...dispatched, source: undefined }, { number: 4, stage: 'dispatched', agent: 'codex', provider: 'codex', model: 'gpt-6-luna', pool: 'codex-agent', effort: 'medium',
    routedAt: 100, startedAt: 200, dispatches: 2, lastEventAt: 400, reportedAt: 300, settledAt: 400, source: undefined, why: null });
  assert.match(dispatched.source, /hierarchy\.runtime \+ 2 op-dispatched/);

  const routed = attemptOf(job('r', { status: 'cancelled', model: 'claude-agent', routedAt: 50, hierarchy: { runtime: { host: 'orca', agent: 'claude', provider: 'claude', model: 'claude-opus-5-5', runtimePool: 'claude-agent' } } }), [{ kind: 'job-enqueued', created_at: 40 }]);
  assert.equal(routed.stage, 'routed');
  assert.equal(routed.provider, 'claude');
  assert.equal(routed.startedAt, null);
  assert.match(routed.why, /ended before any dispatch/);

  const never = attemptOf(job('n', { status: 'queued', hierarchy: { runtime: { host: 'orca' } } }), []);
  assert.equal(never.stage, 'none');
  for (const f of ['agent', 'provider', 'model', 'pool', 'effort', 'routedAt', 'startedAt', 'lastEventAt', 'source']) assert.equal(never[f], null, f);
  assert.match(never.why, /never routed/);

  // An older dispatch without hierarchy.runtime: the op-dispatched event's pool/model id, provider unknown.
  const legacy = attemptOf(job('l', { model: 'claude-agent' }), [{ kind: 'op-dispatched', created_at: 9, payload: { model: 'claude-agent' } }]);
  assert.equal(legacy.pool, 'claude-agent');
  assert.equal(legacy.provider, null);
  assert.match(legacy.why, /provider: not recorded/);
});

test('diffRefOf points at the unit\'s newest stored patch, null without one', () => {
  const unit = { jobs: [job('a'), job('b', { at: 2 })] };
  const patches = new Map([['a', { label: 'landed', head_sha: 'h1', landed_sha: 'h1', created_at: 5 }]]);
  assert.deepEqual(diffRefOf(unit, patches), { jobId: 'a', label: 'landed', headSha: 'h1', landedSha: 'h1', at: 5 });
  assert.equal(diffRefOf(unit, new Map()), null);
});

test('reconcilerState attributes an engine reconcile-failed row to the controller it names; engine/sla rows are others', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-status-units-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 30, retryDelay: 50 }));
  const env = { ...process.env, STARCI_SUPERVISOR_HOME: path.join(root, 'home'), LOCALAPPDATA: path.join(root, 'la') };
  const now = Date.now();
  const rows = [
    logRowOf('gc', 'reconciler.act', 'gc closed a leftover', { verb: 'close' }),
    logRowOf('engine', 'reconciler.error', 'gc gc:job:x failed (attempt 1)', { kind: 'reconciler.reconcile-failed', name: 'gc', key: 'gc:job:x' }),
    logRowOf('engine', 'reconciler.error', 'slaPass failed', { kind: 'reconciler.reconcile-failed', name: 'sla' }),
    logRowOf('host', 'reconciler.event', 'harness-ui degraded -> healthy', { name: 'harness-ui', kind: 'reconciler.host.service' }),
    logRowOf('engine', 'reconciler.event', 'leader acquired', { kind: 'reconciler.leader' }),
  ].map((r, i) => ({ ...r, at: now - 1000 + i }));
  assert.equal(supLogRows(rows, { env }).written, rows.length);
  const st = reconcilerState({ env, now });
  const c = Object.fromEntries(st.controllers.map((x) => [x.name, x]));
  assert.deepEqual(st.controllers.map((x) => x.name), ['job', 'host', 'gc', 'resource', 'workflow', 'fleet', 'learning']);
  assert.equal(c.gc.acts, 1);
  assert.equal(c.gc.errors, 1, 'the failed gc reconcile is gc\'s error, not the engine\'s');
  assert.match(c.gc.lastError, /gc gc:job:x failed/);
  assert.equal(c.gc.lastErrorAt, now - 999);
  assert.equal(c.host.events, 1);
  const others = Object.fromEntries(st.others.map((x) => [x.name, x]));
  assert.equal(others.sla.errors, 1);
  assert.equal(others.engine.events, 1);
  assert.equal(st.windowMs, 24 * 3_600_000);
  assert.ok(!('cpuPercent' in c.gc) && !('ramBytes' in c.gc), 'no per-controller CPU/RAM: the engine does not measure it');
});
