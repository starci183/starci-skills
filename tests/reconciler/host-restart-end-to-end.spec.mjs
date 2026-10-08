// One workflow across a host restart, end to end (registry entry workflow-across-host-restart). The shape of the two real workflows after the
// 2026-10-07 shutdown: a Kernel seat and a running op whose terminals the restart ended, a reported op whose worker died with the host, a
// provider reservation that never got a terminal, and the workflow's tree on disk (case 1) or lost (case 2). The restart is simulated by a new
// boot (every terminal handle gone, the operating system and Orca started after every receipt); then what the runtime does by itself runs:
// the engine's start-up recovery, the worktree GC pass, the Kernel start path's tree custody, the Job controller pass and the Kernel launch bar.
// The end state is asserted: nothing is left that a person must repair.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { openMachine, readMachine } from '../../engine/db/machine.mjs';
import { openLedger } from '../../engine/db/ledger.mjs';
import { retryDisposition } from '../../engine/admission.mjs';
import { startRecovery } from '../../scripts/reconciler/engine-process.mjs';
import { reapProviderReservations } from '../../scripts/machine/provider-reservation-reap.mjs';
import { ensureWorkflowWorktree, setCheckpoint } from '../../scripts/kernel/workflow-worktree.mjs';
import { gcWorktrees } from '../../scripts/machine/worktrees.mjs';
import { PLACEMENT_LOST } from '../../scripts/kernel/attempt-placement.mjs';
import { PLACEMENT_REBOUND } from '../../scripts/machine/placement-rebound.mjs';
import { startBar } from '../../scripts/kernel/workflow-startup.mjs';
import { startHoldBudget } from '../../scripts/kernel/start-hold.mjs';
import job, { SETTLER_SCRIPT } from '../../scripts/reconciler/controllers/job.mjs';
import { fakeCtx } from '../../scripts/reconciler/testing.mjs';
import { fakeOrcaWorktrees } from '../helpers/fake-orca-worktrees.mjs';

const git = (cwd, ...args) => {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true });
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};
const write = (root, rel, text) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), text); };
const sha = (text, n) => crypto.createHash('sha256').update(text).digest('hex').slice(0, n);
const WF = 'wf-restart';
const JOB = 'op-architecture.decide-bbbbbbbbbb';
const LEDGER = 'shop-be';
const SDS = '.starciwork/features/authentication/sds/accounts/index.yaml';
const KERNEL_TERMINAL = 'term_kernel_old';
const OP_TERMINAL = 'term_op_old';
const CAP = 3;
const NEW_BOOT = Date.now() + 3_600_000;
const MODEL = 'gpt-6.1-sol';
const gone = () => ({ ok: false, errorCode: 'terminal_handle_stale', connected: false, hostUnavailable: false });

/** The host after the restart: Orca answers, nothing is listed, every process of the old boot is gone, the host request is unknown to it. */
const restartedHost = () => ({
  status: () => ({ reachable: true, appPid: 4242 }), bootAt: () => NEW_BOOT, request: () => ({ ok: true, state: 'absent' }),
  table: () => [{ pid: 4242, ppid: 1, name: 'Orca.exe', created: NEW_BOOT }], list: () => ({ ok: true, terminals: [] }), env: () => [],
});

function reserveKernel(env, attemptId) {
  const m = openMachine({ env });
  try { return m.reserveProvider({ provider: 'codex', account: 'default', attemptId, role: 'kernel', model: MODEL, maxParallel: CAP, scope: { scopeId: attemptId } }); } finally { m.close(); }
}

/** Three receipts of the old boot: the Kernel seat and the op worker with a terminal handle, one launch that never got a handle. */
function reservations(env) {
  const m = openMachine({ env });
  try {
    const seed = (attemptId, role, scopeId, handle) => {
      const reserved = m.reserveProvider({ provider: 'codex', account: 'default', attemptId, role, model: MODEL, maxParallel: CAP, scope: { scopeId } });
      assert.equal(reserved.ok, true, JSON.stringify(reserved));
      const { id, fence } = reserved.reservation;
      const base = { id, fence, attemptId, provider: 'codex', account: 'default', model: MODEL, role };
      assert.equal(m.markProviderReservation({ ...base, state: 'launching', launchIdentity: `launch-${role}-${scopeId}`, hostRequestId: `request-${scopeId}` }).ok, true);
      if (handle) assert.equal(m.markProviderReservation({ ...base, state: 'live', handle }).ok, true);
      return id;
    };
    return [seed(`kernel:${WF}`, 'kernel', `${LEDGER}:kernel`, KERNEL_TERMINAL), seed(`${LEDGER}:${JOB}:attempt:1`, 'worker', `${LEDGER}:${JOB}:attempt:1`, OP_TERMINAL), seed('worker:lost', 'worker', 'worker:lost', null)];
  } finally { m.close(); }
}

/** The ledger of the workflow: running, a Kernel seat signal, one op admitted in `tree` that filed its report, its worker's terminal now gone. */
function seedWorkflow(ledger, tree) {
  const now = Date.now(), db = ledger.db;
  db.prepare("INSERT INTO workflows(workflow_id,trace_id,phase,created_at,updated_at) VALUES(?,?,'running',?,?)").run(WF, sha(WF, 32), now, now);
  db.prepare("INSERT INTO signals(scope,key,workflow_id,holder_pid,token,value_json,at,expires_at) VALUES('kernel',?,?,1,'tok',?,?,NULL)").run(WF, WF, JSON.stringify({ terminal: KERNEL_TERMINAL }), now);
  db.prepare("INSERT INTO work_units(workflow_id,unit_id,op_id,subject_key,goal_revision,state,current_job_id,tries,created_at,updated_at) VALUES(?,?,?,?,0,'queued',?,1,?,?)").run(WF, JOB, 'architecture.decide', JOB, JOB, now, now);
  const payload = { owned_paths: ['.starciwork/features/authentication/sds'], managed: { agentTerminalHandle: OP_TERMINAL, dispatchId: 'ctx_1' } };
  db.prepare("INSERT INTO jobs(job_id,workflow_id,unit_id,op_id,try_no,generation,kind,payload_json,status,worker_id,created_at,updated_at) VALUES(?,?,?,?,1,0,'op',?,'leased',?,?,?)")
    .run(JOB, WF, JOB, 'architecture.decide', JSON.stringify(payload), OP_TERMINAL, now, now);
  const { lastInsertRowid: attemptId } = db.prepare(`INSERT INTO op_attempts(workflow_id,job_id,unit_id,op_id,try_no,dispatch_seq,dispatch_id,span_id,worktree_path,dispatched_at,started_at)
    VALUES(?,?,?,?,1,1,'ctx_1',?,?,?,?)`).run(WF, JOB, JOB, 'architecture.decide', sha('span', 16), tree, now, now);
  const context = { worktree: tree, packet: { context: { workflow_worktree: { path: tree }, gate_binding: { at: now, targets: [{ root: tree, head: sha('head', 40), owned: ['.starciwork/features/authentication/sds'] }] } } } };
  db.prepare('INSERT INTO contracts(attempt_id,workflow_id,job_id,markdown,context_json,created_at) VALUES(?,?,?,?,?,?)').run(attemptId, WF, JOB, 'm', JSON.stringify(context), now);
  db.prepare("INSERT INTO reports(workflow_id,attempt_id,dispatch_id,job_id,outcome,report_json,created_at) VALUES(?,?,'ctx_1',?,'done',?,?)")
    .run(WF, attemptId, JOB, JSON.stringify({ schema: 'starci/op-report@1', outcome: 'done', files: [SDS], checks: [] }), now);
  for (const next of ['running', 'reported']) db.prepare('UPDATE jobs SET status=? WHERE job_id=?').run(next, JOB);
}

/** A running workflow: its tree and branch, a Kernel seat, a reported op filed from the tree, three provider reservations; `treeGone` loses the tree directory. */
function world(t, { treeGone = false } = {}) {
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'starci-restart-')));
  const app = path.join(base, 'app');
  fs.mkdirSync(app);
  git(app, 'init', '-q', '-b', 'main');
  for (const [key, value] of [['user.email', 'spec@starci.test'], ['user.name', 'spec'], ['core.autocrlf', 'false']]) git(app, 'config', key, value);
  write(app, 'be/src/main.ts', 'export const be = 1;\n');
  git(app, 'add', '-A'); git(app, 'commit', '-q', '-m', 'init');
  const machineFile = path.join(base, 'machine.sqlite');
  const env = { ...process.env, STARCI_TEST_MACHINE_FILE: machineFile };
  const saved = process.env.STARCI_TEST_MACHINE_FILE;
  process.env.STARCI_TEST_MACHINE_FILE = machineFile;
  const orca = fakeOrcaWorktrees({ root: path.join(base, 'orca') });
  const ledgerFile = path.join(base, 'runtime.sqlite');
  const ledger = openLedger({ file: ledgerFile });
  t.after(() => {
    try { ledger.close(); } catch { /* closed */ }
    if (saved === undefined) delete process.env.STARCI_TEST_MACHINE_FILE; else process.env.STARCI_TEST_MACHINE_FILE = saved;
    fs.rmSync(base, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 });
  });
  const first = ensureWorkflowWorktree({ env, orca }, { workflowId: WF, appRepo: app, ledgerId: LEDGER });
  assert.ok(first.ok, JSON.stringify(first));
  const tree = first.record.path;
  write(tree, 'be/src/step1.ts', 'export const step1 = 1;\n');
  git(tree, 'add', '-A'); git(tree, 'commit', '-q', '-m', 'checkpoint 1');
  setCheckpoint({ env }, WF, git(tree, 'rev-parse', 'HEAD'));
  write(tree, SDS, 'accounts: {}\n');
  seedWorkflow(ledger, tree);
  const ids = reservations(env);
  if (treeGone) {
    fs.rmSync(tree, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 });
    git(app, 'worktree', 'prune');
    orca.forget(first.record.orcaWorktreeId);
  }
  return { base, app, env, orca, ledger, ledgerFile, tree, ids };
}

/** The engine start-up recovery against the restarted host; `lines` are what the recovery logs. */
function recover() {
  const lines = [];
  const engine = { rev: 'rev-after-restart', now: () => Date.now(), log: (kind, message, data) => lines.push({ kind, message, data }), queue: { rearmParked: () => [] } };
  startRecovery(engine, { reevaluated: false }, { reap: (options) => reapProviderReservations(options, restartedHost()), boot: () => ({ bootAt: NEW_BOOT, uptimeMs: 1000, bootId: 'boot-after-restart' }) });
  return lines;
}

const active = (env) => readMachine((m) => m.providerReservations({ activeOnly: true }), [], { env });
const releaseProofs = (env) => readMachine((m) => m.db.prepare("SELECT reservation_id, proof_json FROM provider_reservation_events WHERE to_state='released'").all(), [], { env })
  .map((row) => [row.reservation_id, JSON.parse(row.proof_json).kind]);
const jobRow = (ledger) => ledger.db.prepare('SELECT * FROM jobs WHERE job_id=?').get(JOB);
const gcPass = (w) => gcWorktrees({ env: w.env, repos: [w.app], jobStatusOf: Object.assign(() => null, { workflowPhase: () => 'running' }), orca: w.orca, now: Date.now() + 3 * 3_600_000 });
const itemOf = (items, dir) => items.find((item) => item.path && path.resolve(item.path) === path.resolve(dir));
const custody = (w) => ensureWorkflowWorktree({ env: w.env, orca: w.orca, show: gone }, { workflowId: WF, appRepo: w.app, ledgerId: LEDGER, ledger: w.ledger });

/** The Job controller's pass over the reported job: active, every concern owned, the settler a recorded run. */
async function jobPass(w) {
  const reader = new DatabaseSync(w.ledgerFile, { readOnly: true });
  try {
    const ctx = fakeCtx({ controller: 'job', mode: 'active', ledgers: [{ ledgerId: LEDGER, repo: w.app, file: w.ledgerFile }], dbs: { [LEDGER]: reader } });
    return { result: await job.reconcile(`job:${LEDGER}:${JOB}`, ctx), ctx };
  } finally { reader.close(); }
}

test('tree on disk: recovery releases every reservation with its proof, the GC keeps the tree, custody changes nothing, the reported op is settled, the seat can relaunch', async (t) => {
  const w = world(t);
  assert.equal(active(w.env).length, CAP, 'the pool is full of receipts of the old boot');
  assert.equal(reserveKernel(w.env, 'kernel:wf-restart:2').ok, false, 'before the recovery the new Kernel cannot be launched: the pool is full');

  const lines = recover();
  assert.deepEqual(lines.map((line) => line.data.kind), ['reconciler.boot', 'reconciler.provider-receipts-released']);
  assert.equal(lines[0].data.bootId, 'boot-after-restart');
  assert.deepEqual(active(w.env), [], 'no reservation is left');
  assert.deepEqual(releaseProofs(w.env).sort(), [[w.ids[0], 'closed'], [w.ids[1], 'closed'], [w.ids[2], 'host-restarted']].sort(), 'a handle whose terminal is gone, a launch the restart ended');

  assert.equal(itemOf(gcPass(w), w.tree), undefined, 'the GC leaves the tree of a running workflow');
  assert.ok(fs.existsSync(w.tree));
  const ensured = custody(w);
  assert.ok(ensured.ok && !ensured.created, JSON.stringify(ensured));
  assert.equal(path.resolve(ensured.record.path), path.resolve(w.tree));
  assert.deepEqual([ensured.placements.rebound, ensured.placements.ended], [[], []], 'the admitted placement is still valid');

  const { result, ctx } = await jobPass(w);
  assert.equal(result.action, 'settle', JSON.stringify(result));
  assert.deepEqual(ctx.calls.run.map((call) => call.args.slice(0, 5)), [[SETTLER_SCRIPT, '--repo', w.app, '--job', JOB]]);
  assert.equal(jobRow(w.ledger).try_no, 1, 'no business attempt was spent');

  assert.equal(reserveKernel(w.env, 'kernel:wf-restart:2').ok, true, 'the pool has room again: the Kernel seat launches');
  assert.equal(startBar({ authority: { ok: true }, launchedBy: 'watchdog', db: w.ledger.db, workflowId: WF }), null, 'no failed launch is on record: nothing holds the seat');
});

test('tree lost: custody puts the tree back at the branch and the reported op is rebound to it, or ended placement-lost with no business attempt spent', (t) => {
  const w = world(t, { treeGone: true });
  recover();
  assert.deepEqual(active(w.env), []);
  assert.equal(itemOf(gcPass(w), w.tree)?.reason, 'directory-gone', 'the registry row of a vanished tree is closed, nothing is removed');

  const ensured = custody(w);
  assert.ok(ensured.ok && ensured.created, JSON.stringify(ensured));
  assert.ok(fs.existsSync(path.join(ensured.record.path, 'be/src/step1.ts')), 'the checkpoint chain is back in the new tree');
  // The report names a file only the lost tree held: the runtime ends the attempt with the typed cause instead of leaving it reported for good.
  assert.deepEqual(ensured.placements.ended.map((row) => [row.jobId, row.missing]), [[JOB, [SDS]]]);
  assert.equal(w.ledger.db.prepare('SELECT COUNT(*) n FROM events WHERE kind=?').get(PLACEMENT_REBOUND).n, 0);
  assert.equal(jobRow(w.ledger).status, 'failed');
  const attempt = w.ledger.db.prepare('SELECT * FROM op_attempts WHERE job_id=?').get(JOB);
  assert.equal(JSON.parse(attempt.settle_json).reason, PLACEMENT_LOST);
  assert.equal(retryDisposition({ status: 'failed', result_json: attempt.settle_json }).consumesBusinessRetry, false, 'the restart is no fault of the op');
});

test('a Kernel launch that keeps failing for the same cause after the restart is held with that cause, not retried every pass', (t) => {
  const w = world(t);
  const budget = startHoldBudget();
  const lockedPath = path.join(w.tree, 'node_modules', 'x.node');
  const failed = (at) => w.ledger.appendEvent({ workflowId: WF, entityType: 'kernel', entityId: WF, generation: 1, kind: 'kernel-start-failed', createdAt: at,
    payload: { step: 'workflow-worktree-install', reason: 'workflow-worktree-install-locked', error: 'npm error code EPERM', install: { receipt: { cause: 'file-locked', code: 'EPERM', path: lockedPath, holders: [{ pid: 7, name: 'node.exe' }] } } } });
  const at = Date.now();
  for (let i = 0; i < budget.maxAttempts; i += 1) failed(at + i * 1000);
  const bar = startBar({ authority: { ok: true }, launchedBy: 'watchdog', db: w.ledger.db, workflowId: WF, now: at + 10_000 });
  assert.equal(bar.step, 'kernel-start-held');
  assert.equal(bar.fields.hold.state, 'held');
  assert.equal(bar.fields.hold.reason, 'workflow-worktree-install-locked');
  assert.equal(bar.fields.hold.count, budget.maxAttempts);
});
