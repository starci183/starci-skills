import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { withLedger, seedWorkflow } from '../helpers/ledger-fixture.mjs';
import { reconcileWorkflow, keyOf, SUPERVISOR_LEDGER } from '../../scripts/reconciler/controllers/workflow.mjs';
import { createCtx, statusFailureOf } from '../../scripts/reconciler/ctx.mjs';
import { TEST_REGISTRY_ENV } from '../../engine/db/machine.mjs';

// Follow-up of 11a66bc49 (job fix-workflow-status-unreadable-v2-201f00). Seen live 2026-09-29 13:25-13:33Z:
// 1) the runtime-defect:<wf>:status-unreadable DI (decider supervisor) was opened in the PRODUCT ledger (nivo-backend
//    di-8f93adc4), so `decisions.mjs supervisor --list` never showed it; it belongs in the supervisor ledger.
// 2) ctx.status mapped every failed spawn to null: the finding said 'no value (api status timed out, exited non-zero or
//    printed no JSON)'. The real cause: api.mjs status REFUSED plan-edges-missing for wf-nivo-collab-mum8xsop and
//    wf-nivo-module-studio-mum8xt5e - exit 1, its {ok:false,error} JSON on STDERR, stdout empty. The read now names it.

const MIN = 60_000;
const NOW = Date.now();
const WF = 'wf-nivo-collab-mum8xsop';
const LEDGER = 'nivo-backend';
const REFUSAL = { ok: false, error: "plan-edges-missing: the plan's 12 leg(s) [request.analyze, scope.define] carry no provable dependency edges (absent, partial, naming an unknown leg or cyclic); a plan without edges is refused", code: 'plan-edges-missing' };
const refusedSpawn = () => ({ ok: false, code: 1, value: null, stdout: '', stderr: `${JSON.stringify(REFUSAL)}\n`, timedOut: false });

function seed(ledger) {
  seedWorkflow(ledger, { id: WF, now: NOW - 600 * MIN, goal: { markdown: '# Collab\nThe collab module.' },
    events: [{ kind: 'op-dispatched', payload: { jobId: 'op-x' }, created_at: NOW - 120 * MIN }] });
}
const settings = (over = {}) => ({ resyncMs: 120_000, concurrency: 2, routes: [], decisionDueMs: 15 * MIN, askRepark: { liveness: new Set(), minIntervalMs: 0 },
  graceMs: 5 * MIN, supervisorGraceMs: 30 * MIN, orphanedFrontierMs: 30 * MIN, revAckMs: 30 * MIN, goalMs: 0, supervisorGateMs: 360 * MIN, stuckSla: {}, statusUnreadablePasses: 3, ...over });

/** A real createCtx (the read path under test) whose api status child is `spawn`; decisions and logs recorded. */
function realCtx({ repoRoot, ledgerFile, spawn }) {
  const stateFile = path.join(path.dirname(repoRoot), 'machine.sqlite');
  const env = { ...process.env, STARCI_SUPERVISOR_HOME: path.join(path.dirname(repoRoot), 'sup'), [TEST_REGISTRY_ENV]: stateFile };
  const spawns = [];
  let at = NOW;
  const ctx = createCtx({ controller: 'workflow', mode: 'shadow', ledgers: [{ ledgerId: LEDGER, repo: repoRoot, file: ledgerFile }], env, now: () => at,
    numbers: { statusCacheMs: 20_000 }, writeLog: () => ({ ok: true }), spawnChild: async (cmd, args, opts) => { spawns.push(args); return spawn(); } });
  const rec = { decisions: [], spawns, tick: () => { at += MIN; } };
  ctx.openDecision = async (di) => { rec.decisions.push(di); return { ok: true, shadow: true }; };
  ctx.kernelTurnOf = () => null;
  ctx.owns = () => false;
  return { ctx, rec };
}

test('statusFailureOf names the cause of a failed api status spawn: refusal on stderr, timeout, exit code, no JSON', () => {
  const refused = statusFailureOf(refusedSpawn());
  assert.equal(refused.cause, 'refused');
  assert.equal(refused.code, 1);
  assert.equal(refused.refusal, 'plan-edges-missing');
  assert.match(refused.error, /^api status refused \(exit 1\): plan-edges-missing/);

  const timedOut = statusFailureOf({ ok: false, code: null, value: null, stdout: '', stderr: '', timedOut: true }, { timeoutMs: 120_000 });
  assert.equal(timedOut.cause, 'timeout');
  assert.match(timedOut.error, /timed out after 120000ms/);

  const crashed = statusFailureOf({ ok: false, code: 1, value: null, stdout: '', stderr: '(node:12) ExperimentalWarning: SQLite\nError: Cannot find module \'x\'\n    at foo', timedOut: false });
  assert.equal(crashed.cause, 'exit');
  assert.match(crashed.error, /exited 1: Error: Cannot find module/);
  assert.doesNotMatch(crashed.stderrHead, /ExperimentalWarning/);

  assert.equal(statusFailureOf({ ok: true, code: 0, value: null, stdout: 'plain text', stderr: '' }).cause, 'no-json');
  assert.equal(statusFailureOf({ ok: false, code: null, value: null, stdout: '', stderr: '', error: 'spawn ENOENT' }).cause, 'spawn');
  assert.equal(statusFailureOf({ ok: true, code: 0, value: { ok: true, frontier: {} } }), null);
});

test('ctx.statusRead keeps the spawn failure; ctx.status still answers null for it', async (t) => withLedger(t, async ({ repoRoot, ledger, ledgerFile }) => {
  seed(ledger);
  const { ctx } = realCtx({ repoRoot, ledgerFile, spawn: refusedSpawn });
  const read = await ctx.statusRead(LEDGER, WF);
  assert.equal(read.value, null);
  assert.equal(read.failure.cause, 'refused');
  assert.match(read.failure.error, /plan-edges-missing/);
  assert.equal(await ctx.status(LEDGER, WF), null, 'ctx.status keeps its contract for the other controllers');
}));

test('3 failed status spawns: the finding and the ONE status-unreadable DI name the cause, and the DI lands in the supervisor ledger', async (t) => withLedger(t, async ({ repoRoot, ledger, ledgerFile }) => {
  seed(ledger);
  const { ctx, rec } = realCtx({ repoRoot, ledgerFile, spawn: refusedSpawn });
  const key = keyOf(LEDGER, WF);
  let last;
  for (let i = 0; i < 3; i += 1) { last = await reconcileWorkflow(key, ctx, { settings: settings() }); rec.tick(); }
  assert.equal(rec.spawns.length, 3);
  assert.equal(last.statusUnreadable.misses, 3);
  assert.match(last.statusUnreadable.error, /api status refused \(exit 1\): plan-edges-missing/, 'not "no value"');
  assert.equal(last.statusUnreadable.failure.cause, 'refused');
  assert.ok(last.lines.some((l) => /^STATUS-UNREADABLE .*plan-edges-missing/.test(l)), last.lines.join('\n'));

  const defects = rec.decisions.filter((d) => d.kind === 'runtime-defect');
  assert.equal(defects.length, 1);
  const [di] = defects;
  assert.equal(di.idempotencyKey, `runtime-defect:${WF}:status-unreadable`);
  assert.equal(di.decider, 'supervisor');
  assert.equal(di.ledger, SUPERVISOR_LEDGER, 'a supervisor-decider DI goes to the supervisor ledger, where decisions.mjs supervisor --list reads');
  assert.equal(di.productLedger, LEDGER);
  assert.equal(di.workflowId, WF);
  assert.match(di.summary, /plan-edges-missing/);
  const refs = di.evidence.map((e) => e.ref).join('\n');
  assert.match(refs, /cause refused; exit 1; timedOut false; refusal plan-edges-missing/);
  assert.match(refs, /^stderr: \{"ok":false/m);
  assert.match(refs, new RegExp(`ledger ${LEDGER} workflow ${WF}`));
}));

test('a timed-out status spawn is named as a timeout in the DI', async (t) => withLedger(t, async ({ repoRoot, ledger, ledgerFile }) => {
  seed(ledger);
  const { ctx, rec } = realCtx({ repoRoot, ledgerFile, spawn: () => ({ ok: false, code: null, value: null, stdout: '', stderr: '', timedOut: true }) });
  for (let i = 0; i < 3; i += 1) { await reconcileWorkflow(keyOf(LEDGER, WF), ctx, { settings: settings() }); rec.tick(); }
  const [di] = rec.decisions.filter((d) => d.kind === 'runtime-defect');
  assert.equal(di.ledger, SUPERVISOR_LEDGER);
  assert.match(di.summary, /timed out after \d+ms/);
  assert.ok(di.evidence.some((e) => /cause timeout; exit -; timedOut true/.test(e.ref)));
}));
