import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { withLedger, seedWorkflow } from '../helpers/ledger-fixture.mjs';
import { reconcileWorkflow, keyOf, SUPERVISOR_LEDGER } from '../../scripts/reconciler/controllers/workflow.mjs';
import { createCtx, statusFailureOf } from '../../scripts/reconciler/ctx.mjs';
import { spawnCapture } from '../../scripts/api/process/spawn-capture.mjs';
import statusVerb from '../../scripts/kernel/verbs/status.mjs';
import { TEST_REGISTRY_ENV } from '../../engine/db/machine.mjs';

// Follow-up of 11a66bc49. Seen live on a product repo:
// 1) the runtime-defect:<wf>:status-unreadable DI (decider supervisor) was opened in the PRODUCT ledger,
//    so `decisions.mjs supervisor --list` never showed it; it belongs in the supervisor ledger.
// 2) ctx.status mapped every failed spawn to null: the finding said 'no value (starci kernel status timed out, exited non-zero or
//    printed no JSON)'. The real cause: cli.mjs status REFUSED plan-edges-missing on two product workflows -
//    exit 1, its {ok:false,error} JSON on STDERR, stdout empty. The read now names it.

const MIN = 60_000;
const NOW = Date.now();
const WF = 'wf-nivo-collab-mum8xsop';
const LEDGER = 'shop-be';
const REFUSAL = { ok: false, error: "plan-edges-missing: the plan's 12 leg(s) [request.analyze, scope.define] carry no provable dependency edges (absent, partial, naming an unknown leg or cyclic); a plan without edges is refused", code: 'plan-edges-missing' };
const refusedSpawn = () => ({ ok: false, code: 1, value: null, stdout: '', stderr: `${JSON.stringify(REFUSAL)}\n`, timedOut: false });

function seed(ledger) {
  seedWorkflow(ledger, { id: WF, now: NOW - 600 * MIN, goal: { markdown: '# Collab\nThe collab module.' },
    events: [{ kind: 'op-dispatched', payload: { jobId: 'op-x' }, created_at: NOW - 120 * MIN }] });
}
const settings = (over = {}) => ({ resyncMs: 120_000, concurrency: 2, routes: [], decisionDueMs: 15 * MIN, askRepark: { liveness: new Set(), minIntervalMs: 0 },
  graceMs: 5 * MIN, supervisorGraceMs: 30 * MIN, orphanedFrontierMs: 30 * MIN, revAckMs: 30 * MIN, goalMs: 0, supervisorGateMs: 360 * MIN, stuckSla: {}, statusUnreadablePasses: 3, ...over });

/** A real createCtx (the read path under test) whose starci kernel status child is `spawn`; decisions and logs recorded. */
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

test('statusFailureOf names the cause of a failed starci kernel status spawn: refusal on stderr, timeout, exit code, no JSON', () => {
  const refused = statusFailureOf(refusedSpawn());
  assert.equal(refused.cause, 'refused');
  assert.equal(refused.code, 1);
  assert.equal(refused.refusal, 'plan-edges-missing');
  assert.match(refused.error, /^starci kernel status refused \(exit 1\): plan-edges-missing/);

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
  assert.match(last.statusUnreadable.error, /starci kernel status refused \(exit 1\): plan-edges-missing/, 'not "no value"');
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

const busySpawn = () => ({ ok: true, code: 0, value: null, stdout: '', stderr: '', timedOut: false });

test('statusFailureOf: exit 0 with both streams empty is busy — the child ran no status code at all', async (t) => {
  // The live cluster: `starci kernel status` exiting 0 with NOTHING on either stream while a hand run returns the
  // JSON. A child that ran the status path always writes something (its JSON or a refusal); a cli.mjs read mid-land —
  // empty, or truncated to a still-valid module ending before main() — evaluates and exits 0 silently. The empty
  // module below is exactly that child, spawned through the real capture.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-status-busy-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const midSwapEntry = path.join(dir, 'cli.mjs');
  fs.writeFileSync(midSwapEntry, '');
  const r = await spawnCapture(process.execPath, [midSwapEntry], {});
  assert.equal(r.code, 0);
  assert.equal(r.stdout, '');
  assert.equal(r.stderr, '');
  assert.equal(statusFailureOf(r).cause, 'busy', 'a silent exit-0 is a transient runtime-busy, not a defect');
  // Any output at all keeps the defect classification it already had.
  assert.equal(statusFailureOf(busySpawn()).cause, 'busy');
  assert.equal(statusFailureOf({ ok: true, code: 0, value: null, stdout: 'plain text', stderr: '' }).cause, 'no-json');
  assert.equal(statusFailureOf({ ok: true, code: 0, value: null, stdout: '', stderr: 'a real line' }).cause, 'no-json');
});

test('the status verb never exits 0 silently: a run that emitted nothing is a typed non-zero refusal', async () => {
  // The contract `starci kernel status --json` keeps: exactly one JSON value on exit 0, else a typed refusal.
  // withStatusSpawnMemo answering without cmdStatus's emit is the no-emission case the guard names.
  const errors = [];
  const originalError = console.error;
  const originalExitCode = process.exitCode;
  console.error = (line) => { errors.push(String(line)); };
  try {
    await statusVerb.run({ ledger: { db: null }, args: { workflow: 'wf-x' }, repo: 'r', emit: () => {},
      internals: { prefetchStatusOrcaReads: async () => new Map(), withStatusSpawnMemo: () => undefined }, ext: {} });
    assert.equal(process.exitCode, 1, 'a no-emission run exits non-zero');
  } finally {
    console.error = originalError;
    process.exitCode = originalExitCode;
  }
  assert.equal(errors.length, 1, errors.join('\n'));
  const refusal = JSON.parse(errors[0]);
  assert.equal(refusal.ok, false);
  assert.equal(refusal.code, 'status-render-empty');
});

test('silent-exit status children are busy passes: re-spawned each pass, no defect until a long streak', async (t) => withLedger(t, async ({ repoRoot, ledger, ledgerFile }) => {
  seed(ledger);
  const { ctx, rec } = realCtx({ repoRoot, ledgerFile, spawn: busySpawn });
  const key = keyOf(LEDGER, WF);
  // Three passes inside the 20 s statusCache TTL: a failed read is never replayed from cache, and a transient
  // busy read is not a runtime defect at the usual streak.
  let last;
  for (let i = 0; i < 3; i += 1) last = await reconcileWorkflow(key, ctx, { settings: settings() });
  assert.equal(rec.spawns.length, 3, 'a failed status read is not served from the shared cache');
  assert.equal(last.statusUnreadable.misses, 3);
  assert.equal(last.statusUnreadable.failure.cause, 'busy');
  assert.match(last.lines.join('\n'), /STATUS-UNREADABLE .*either stream/);
  assert.equal(rec.decisions.filter((d) => d.kind === 'runtime-defect').length, 0, 'a transient busy read is not a runtime defect');
  // An entry that stays broken still defects, on a streak far past the read's own cadence.
  for (let i = 0; i < 10; i += 1) { last = await reconcileWorkflow(key, ctx, { settings: settings() }); rec.tick(); }
  assert.equal(last.statusUnreadable.misses, 13);
  const defects = rec.decisions.filter((d) => d.kind === 'runtime-defect');
  assert.equal(defects.length, 1);
  assert.equal(defects[0].idempotencyKey, `runtime-defect:${WF}:status-unreadable`);
  assert.ok(defects[0].evidence.some((e) => /cause busy; exit 0; timedOut false/.test(e.ref)));
}));
