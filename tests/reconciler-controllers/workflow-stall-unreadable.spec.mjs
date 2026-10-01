import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { withLedger, seedWorkflow } from '../helpers/ledger-fixture.mjs';
import { reconcileWorkflow, keyOf } from '../../scripts/reconciler/controllers/workflow.mjs';
import { stallFindings } from '../../scripts/supervisor/stall.mjs';
import { TEST_REGISTRY_ENV } from '../../engine/db/machine.mjs';

// False progress-stall escalations on 'status unreadable' (job fix-workflow-stall-unreadable-e35c78; sdi-94355e8e
// module-studio, sdi-76a8404d workspace-provision, sdi-2f13ab61 collab): "STALLED <wf> idle 61m: frontier unreadable
// (status unreadable); last progress op-dispatched ...". A read of api status minutes later answered in 3-5 s with the
// frontier engaged and an interface.draw op RUNNING since that op-dispatched. An unreadable status is no evidence of a
// stall: the controller holds the last readable status and retries, and only statusUnreadablePasses consecutive misses
// open one runtime-defect (status-unreadable) DI for the Supervisor, naming the error; never a progress-stall.

const MIN = 60_000;
const NOW = Date.now();
const WF = 'wf-nivo-module-studio-mudqjp5g';
const LEDGER = 'nivo-backend';
const DRAW = 'op-interface.draw-94355e8e00';
const ERROR = 'status unreadable';

function seed(ledger, { idleMin = 120 } = {}) {
  seedWorkflow(ledger, { id: WF, now: NOW - 600 * MIN, goal: { markdown: '# Module studio\nThe studio.' },
    events: [{ kind: 'op-dispatched', payload: { jobId: DRAW }, created_at: NOW - idleMin * MIN }],
    jobs: [{ jobId: DRAW, opId: 'interface.draw', status: 'running', createdAt: NOW - (idleMin + 1) * MIN, updatedAt: NOW - idleMin * MIN }] });
}
const readable = ({ liveness = 'active' } = {}) => ({ ok: true, phase: 'running', progress: null, rca: null, stuck: [],
  workers: [{ jobId: DRAW, liveness }], frontier: { state: 'engaged', actionable: false, queued: [], queuedCauses: {}, reason: null } });
const unreadable = () => ({ ok: false, error: ERROR });

function fakeCtx({ repoRoot, ledgerFile, statusOf }) {
  const stateFile = path.join(path.dirname(repoRoot), 'machine.sqlite');
  const rec = { decisions: [], logs: [] };
  const ctx = {
    mode: 'shadow', now: () => NOW, stateFile, env: { ...process.env, STARCI_SUPERVISOR_HOME: path.join(path.dirname(repoRoot), 'sup'), [TEST_REGISTRY_ENV]: stateFile },
    ledgers: [{ ledgerId: LEDGER, repo: repoRoot, file: ledgerFile }],
    status: async (_ledgerId, wf) => statusOf(wf),
    api: async () => ({ ok: true, shadow: true }),
    run: async () => ({ ok: true, shadow: true }),
    openDecision: async (di) => { rec.decisions.push(di); return { ok: true, shadow: true }; },
    log: async (kind, msg, data) => { rec.logs.push({ kind, msg, data }); },
    owns: () => false,
    kernelTurnOf: () => null,
  };
  return { ctx, rec };
}
const settings = (over = {}) => ({ ...{ resyncMs: 120_000, concurrency: 2, routes: [], decisionDueMs: 0, askRepark: { liveness: new Set(), minIntervalMs: 0 },
  graceMs: 5 * MIN, supervisorGraceMs: 30 * MIN, orphanedFrontierMs: 30 * MIN, revAckMs: 30 * MIN, goalMs: 0, supervisorGateMs: 360 * MIN, stuckSla: {}, statusUnreadablePasses: 3 }, ...over });
const stalls = (rec) => rec.decisions.filter((d) => d.kind === 'progress-stall');

test('an unreadable api status is not a stall: no STALLED finding, no progress-stall DI, no escalation to the Supervisor', (t) => withLedger(t, async ({ repoRoot, ledger, ledgerFile }) => {
  seed(ledger);
  const { ctx, rec } = fakeCtx({ repoRoot, ledgerFile, statusOf: unreadable });
  const r = await reconcileWorkflow(keyOf(LEDGER, WF), ctx, { settings: settings() });
  assert.ok(!r.findings.includes('STALLED'), `findings: ${r.findings.join(',')}`);
  assert.ok(r.findings.includes('STATUS-UNREADABLE'), `findings: ${r.findings.join(',')}`);
  assert.deepEqual(stalls(rec), [], 'no progress-stall DI (Kernel or Supervisor) on a status read that failed');
  assert.equal(r.statusRead, false);
  assert.equal(r.statusUnreadable.error, ERROR, 'the underlying error is recorded');
  assert.equal(r.statusUnreadable.misses, 1);
  assert.ok(r.lines.some((l) => /^STATUS-UNREADABLE .*status unreadable/.test(l)), r.lines.join('\n'));
}));

test('a status that throws or returns nothing names why it was unreadable', (t) => withLedger(t, async ({ repoRoot, ledger, ledgerFile }) => {
  seed(ledger);
  const { ctx: thrower, rec: a } = fakeCtx({ repoRoot, ledgerFile, statusOf: () => { throw new Error('ETIMEDOUT after 120000ms'); } });
  const r1 = await reconcileWorkflow(keyOf(LEDGER, WF), thrower, { settings: settings() });
  assert.match(r1.statusUnreadable.error, /ETIMEDOUT/);
  const { ctx: empty, rec: b } = fakeCtx({ repoRoot, ledgerFile, statusOf: () => null });
  const r2 = await reconcileWorkflow(keyOf(LEDGER, WF), empty, { settings: settings() });
  assert.match(r2.statusUnreadable.error, /no value/);
  assert.deepEqual([...stalls(a), ...stalls(b)], []);
}));

test('a pass that cannot read status holds the last readable one: the live worker keeps the workflow not STALLED', (t) => withLedger(t, async ({ repoRoot, ledger, ledgerFile }) => {
  seed(ledger);
  let next = readable();
  const { ctx, rec } = fakeCtx({ repoRoot, ledgerFile, statusOf: () => next });
  const key = keyOf(LEDGER, WF);
  const first = await reconcileWorkflow(key, ctx, { settings: settings() });
  assert.equal(first.statusRead, true);
  assert.ok(!first.findings.includes('STALLED'), 'a worker mid-turn on a long op is progress, not a stall');
  next = unreadable();
  const second = await reconcileWorkflow(key, ctx, { settings: settings() });
  assert.equal(second.statusRead, false);
  assert.ok(!second.findings.includes('STALLED'), `held frontier judged: ${second.findings.join(',')}`);
  assert.ok(!second.findings.includes('STATUS-UNREADABLE'), 'the held status was judged, not skipped');
  assert.ok(second.lines.some((l) => /holding the status read/.test(l)), second.lines.join('\n'));
  assert.deepEqual(stalls(rec), []);
  assert.deepEqual(rec.decisions.filter((d) => d.kind === 'runtime-defect'), [], 'one miss is retried, not a defect');
}));

test('statusUnreadablePasses consecutive misses open ONE runtime-defect status-unreadable DI for the Supervisor, never a progress-stall', (t) => withLedger(t, async ({ repoRoot, ledger, ledgerFile }) => {
  seed(ledger);
  const { ctx, rec } = fakeCtx({ repoRoot, ledgerFile, statusOf: unreadable });
  const key = keyOf(LEDGER, WF);
  const s = settings({ statusUnreadablePasses: 3, decisionDueMs: 15 * MIN });
  for (let i = 0; i < 2; i += 1) await reconcileWorkflow(key, ctx, { settings: s });
  assert.deepEqual(rec.decisions, [], 'two misses: retried, nothing opened');
  const third = await reconcileWorkflow(key, ctx, { settings: s });
  assert.equal(third.statusUnreadable.misses, 3);
  const defects = rec.decisions.filter((d) => d.kind === 'runtime-defect');
  assert.equal(defects.length, 1);
  assert.equal(defects[0].idempotencyKey, `runtime-defect:${WF}:status-unreadable`);
  assert.equal(defects[0].decider, 'supervisor');
  assert.match(defects[0].summary, /status unreadable/, 'the DI names the error');
  await reconcileWorkflow(key, ctx, { settings: s });
  assert.equal(rec.decisions.filter((d) => d.kind === 'runtime-defect').length, 1, 'once per decision window');
  assert.deepEqual(stalls(rec), []);

  // One readable read resets the count.
  const { ctx: again, rec: rec2 } = fakeCtx({ repoRoot, ledgerFile, statusOf: unreadable });
  let flip = 0;
  again.status = async () => (flip++ % 2 ? readable() : unreadable());
  for (let i = 0; i < 6; i += 1) await reconcileWorkflow(key, again, { settings: s });
  assert.deepEqual(rec2.decisions, [], 'alternating reads never reach three consecutive misses');
}));

test('stallFindings: an unreadable frontier is STATUS-UNREADABLE (not alerted) naming the error and the running op', (t) => withLedger(t, async ({ repoRoot, ledger }) => {
  seed(ledger);
  const findings = stallFindings(ledger.db, { repo: repoRoot, now: NOW, stallMinutes: 30, frontierOf: () => ({ ok: false, error: ERROR }), kernelTurnOf: () => null });
  assert.deepEqual(findings.map((f) => f.type), ['STATUS-UNREADABLE']);
  const [f] = findings;
  assert.equal(f.alert, false);
  assert.equal(f.error, ERROR);
  assert.deepEqual(f.runningJobs, [DRAW]);
  assert.match(f.line, new RegExp(`^STATUS-UNREADABLE ${WF} idle 120m: api status unreadable \\(status unreadable\\); stall not judged; running ${DRAW} \\(interface\\.draw\\)`));

  // A readable frontier with no worker moving is still STALLED: the fix narrows nothing else.
  const idle = stallFindings(ledger.db, { repo: repoRoot, now: NOW, stallMinutes: 30, frontierOf: () => readable({ liveness: 'idle' }), kernelTurnOf: () => null });
  assert.deepEqual(idle.map((x) => x.type), ['STALLED']);
  assert.equal(idle[0].alert, true);
}));
