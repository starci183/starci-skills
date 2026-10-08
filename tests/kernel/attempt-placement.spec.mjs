// An admitted attempt whose workflow tree was lost and put back at another path (scripts/kernel/attempt-placement.mjs). The 2026-10-08 shape:
// Nivo op-architecture.decide-e78adc94cc was admitted in the workflow's first worktree directory, filed its report, and stayed reported while the
// GC removed that directory and the next start made the tree at the "-2" path; settle then refused op-gate-tool-failed (the owned slice could not
// be bound) for good and `starci workflow custody --apply` refused workflow-custody-busy because the job was reported.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { openLedger } from '../../engine/db/ledger.mjs';
import { retryDisposition } from '../../engine/admission.mjs';
import { ensureWorkflowWorktree, registerWorkflowWorktree, setCheckpoint } from '../../scripts/kernel/workflow-worktree.mjs';
import { gcWorktrees } from '../../scripts/machine/worktrees.mjs';
import { PLACEMENT_LOST, reconcileAttemptPlacements } from '../../scripts/kernel/attempt-placement.mjs';
import { PLACEMENT_REBOUND, reboundBindingOf, reboundMapOf, placedWorktreeOf, supersedeDir } from '../../scripts/machine/placement-rebound.mjs';
import { latestContractOf } from '../../scripts/machine/contract-version.mjs';
import { judgeJobLoop } from '../../scripts/kernel/gate-settle.mjs';
import { inFlightOps } from '../../scripts/kernel/workflow-in-flight.mjs';
import { checkRerunRootOf } from '../../scripts/kernel/verbs/shared/check-evidence.mjs';
import { terminalFactsOf, TERMINAL_HOLDS } from '../../scripts/kernel/terminal-step.mjs';
import { fakeOrcaWorktrees } from '../helpers/fake-orca-worktrees.mjs';

const git = (cwd, ...args) => {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true });
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};
const write = (root, rel, text) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), text); };
const sha = (text, n) => crypto.createHash('sha256').update(text).digest('hex').slice(0, n);
const WF = 'wf-placement';
const JOB = 'op-architecture.decide-aaaaaaaaaa';
const TERMINAL = 'term_worker-1';
const SDS = '.starciwork/features/authentication/sds/accounts/index.yaml';
const gone = () => ({ ok: false, errorCode: 'terminal_handle_stale', connected: false, hostUnavailable: false });
const live = () => ({ ok: true, connected: true, writable: true, hostUnavailable: false });

/** A workflow whose tree was collected by the GC after it filed a report from the first tree; returns the ledger, the lost path and a re-ensure. */
function world(t, { reportFiles = [SDS], writeFiles = [SDS], status = 'reported', reportFiled = true } = {}) {
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'starci-placement-')));
  const app = path.join(base, 'app');
  fs.mkdirSync(app);
  git(app, 'init', '-q', '-b', 'main');
  git(app, 'config', 'user.email', 'spec@starci.test');
  git(app, 'config', 'user.name', 'spec');
  git(app, 'config', 'core.autocrlf', 'false');
  write(app, 'be/src/main.ts', 'export const be = 1;\n');
  git(app, 'add', '-A');
  git(app, 'commit', '-q', '-m', 'init');
  const env = { ...process.env, STARCI_TEST_MACHINE_FILE: path.join(base, 'machine.sqlite') };
  const orca = fakeOrcaWorktrees({ root: path.join(base, 'orca') });
  const ledger = openLedger({ file: path.join(base, 'runtime.sqlite') });
  t.after(() => { try { ledger.close(); } catch { /* closed */ } fs.rmSync(base, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }); });
  const first = ensureWorkflowWorktree({ env, orca }, { workflowId: WF, appRepo: app, ledgerId: 'ledger-1' });
  assert.ok(first.ok, JSON.stringify(first));
  const lost = first.record.path;
  write(lost, 'be/src/step1.ts', 'export const step1 = 1;\n');
  git(lost, 'add', '-A');
  git(lost, 'commit', '-q', '-m', 'checkpoint 1');
  setCheckpoint({ env }, WF, git(lost, 'rev-parse', 'HEAD'));
  for (const file of writeFiles) write(lost, file, 'accounts: {}\n');
  seedAttempt(ledger, { lost, status, reportFiled, reportFiles });
  const items = gcWorktrees({ env, repos: [app], jobStatusOf: Object.assign(() => null, { workflowPhase: () => 'stopped' }), orca });
  assert.equal(items.find((i) => i.path && path.resolve(i.path) === lost)?.ok, true, JSON.stringify(items));
  assert.ok(!fs.existsSync(lost), 'the first tree is gone');
  git(app, 'branch', '-f', `wf-${WF}`, git(app, 'rev-parse', 'refs/heads/preserved/' + WF + '/gc^'));
  const reensure = (show) => ensureWorkflowWorktree({ env, orca, show }, { workflowId: WF, appRepo: app, ledgerId: 'ledger-1', ledger });
  return { app, env, orca, ledger, lost, reensure };
}

/** The ledger rows of one admitted attempt that filed (or did not file) its report from `lost`. */
function seedAttempt(ledger, { lost, status, reportFiled, reportFiles }) {
  const now = Date.now();
  const db = ledger.db;
  db.prepare("INSERT INTO workflows(workflow_id,trace_id,phase,created_at,updated_at) VALUES(?,?,'running',?,?)").run(WF, sha(WF, 32), now, now);
  db.prepare("INSERT INTO work_units(workflow_id,unit_id,op_id,subject_key,goal_revision,state,current_job_id,tries,created_at,updated_at) VALUES(?,?,?,?,0,'queued',?,1,?,?)").run(WF, JOB, 'architecture.decide', JOB, JOB, now, now);
  const payload = { owned_paths: ['.starciwork/features/authentication/sds'], managed: { agentTerminalHandle: TERMINAL, dispatchId: 'ctx_1' } };
  db.prepare("INSERT INTO jobs(job_id,workflow_id,unit_id,op_id,try_no,generation,kind,payload_json,status,worker_id,created_at,updated_at) VALUES(?,?,?,?,1,0,'op',?,'leased',?,?,?)")
    .run(JOB, WF, JOB, 'architecture.decide', JSON.stringify(payload), TERMINAL, now, now);
  const { lastInsertRowid: attemptId } = db.prepare(`INSERT INTO op_attempts(workflow_id,job_id,unit_id,op_id,try_no,dispatch_seq,dispatch_id,span_id,worktree_path,dispatched_at,started_at)
    VALUES(?,?,?,?,1,1,'ctx_1',?,?,?,?)`).run(WF, JOB, JOB, 'architecture.decide', sha('span', 16), lost, now, now);
  const context = { worktree: lost, packet: { context: { workflow_worktree: { path: lost }, gate_binding: { at: now, targets: [{ root: lost, head: sha('head', 40), owned: ['.starciwork/features/authentication/sds'] }] } } } };
  db.prepare('INSERT INTO contracts(attempt_id,workflow_id,job_id,markdown,context_json,created_at) VALUES(?,?,?,?,?,?)').run(attemptId, WF, JOB, 'm', JSON.stringify(context), now);
  if (reportFiled) {
    db.prepare("INSERT INTO reports(workflow_id,attempt_id,dispatch_id,job_id,outcome,report_json,created_at) VALUES(?,?,'ctx_1',?,'done',?,?)")
      .run(WF, attemptId, JOB, JSON.stringify({ schema: 'starci/op-report@1', outcome: 'done', files: reportFiles, checks: [] }), now);
  }
  const walk = { reported: ['running', 'reported'], running: ['running'] }[status];
  for (const next of walk) db.prepare('UPDATE jobs SET status=? WHERE job_id=?').run(next, JOB);
  return attemptId;
}

const jobRow = (ledger) => ledger.db.prepare('SELECT * FROM jobs WHERE job_id=?').get(JOB);

test('a filed report whose files are in the re-attached tree: the placement is rebound, the admission stays, settle and the checks read the new path', (t) => {
  const w = world(t);
  const ensured = w.reensure(gone);
  assert.ok(ensured.ok && ensured.created, JSON.stringify(ensured));
  assert.deepEqual(ensured.placements.rebound.map((r) => r.jobId), [JOB]);
  assert.deepEqual(ensured.placements.ended, []);
  const tree = ensured.record.path;
  assert.notEqual(path.resolve(tree), path.resolve(w.lost), 'the tree came back at another path');
  const event = w.ledger.db.prepare('SELECT * FROM events WHERE kind=?').get(PLACEMENT_REBOUND);
  assert.ok(event, 'a typed custody event records the rebind');
  const payload = JSON.parse(event.payload_json);
  assert.deepEqual([payload.jobId, payload.to, payload.arm, payload.reason], [JOB, tree, 'rebind', 'tree-reattached']);
  assert.ok(payload.from.some((dir) => path.resolve(dir) === path.resolve(w.lost)));
  assert.equal(w.ledger.db.prepare('SELECT worktree_path FROM op_attempts WHERE job_id=?').get(JOB).worktree_path, w.lost, 'the admitted record is untouched');
  const contract = latestContractOf(w.ledger.db, JOB);
  assert.equal(JSON.parse(contract.context_json).worktree, w.lost);
  assert.equal(path.resolve(placedWorktreeOf(w.ledger.db, contract)), path.resolve(tree), 'settle places the owned slice in the registered tree');
  assert.equal(path.resolve(supersedeDir(reboundMapOf(w.ledger.db, contract.attempt_id), w.lost)), path.resolve(tree));
  const root = checkRerunRootOf(w.ledger.db, jobRow(w.ledger), { repo: w.app, env: w.env });
  assert.equal(path.resolve(root), path.resolve(tree), 'the checks re-run in the registered tree, not refused as a foreign placement');
  assert.equal(jobRow(w.ledger).status, 'reported', 'a rebound attempt stays reported for the settler');
});

test('a second pass over a rebound attempt writes nothing', (t) => {
  const w = world(t);
  const first = w.reensure(gone);
  assert.equal(first.placements.rebound.length, 1);
  const again = w.reensure(gone);
  assert.deepEqual([again.placements.rebound, again.placements.ended, again.placements.deferred], [[], [], []]);
  assert.equal(w.ledger.db.prepare('SELECT COUNT(*) n FROM events WHERE kind=?').get(PLACEMENT_REBOUND).n, 1);
});

test('a filed report naming a file the tree lacks: the runtime ends the attempt placement-lost, no business attempt spent, the failed-no-step route takes it', (t) => {
  const w = world(t, { writeFiles: [] });
  const ensured = w.reensure(gone);
  assert.ok(ensured.ok, JSON.stringify(ensured));
  assert.deepEqual(ensured.placements.ended.map((r) => [r.jobId, r.missing]), [[JOB, [SDS]]]);
  assert.deepEqual(ensured.placements.rebound, []);
  const row = jobRow(w.ledger);
  assert.equal(row.status, 'failed');
  const attempt = w.ledger.db.prepare('SELECT * FROM op_attempts WHERE job_id=?').get(JOB);
  assert.deepEqual([attempt.end_state, attempt.settled_by, attempt.verdict], ['worker-dead', 'reconcile', 'fail']);
  const result = JSON.parse(attempt.settle_json);
  assert.equal(result.reason, PLACEMENT_LOST);
  const disposition = retryDisposition({ status: 'failed', result_json: attempt.settle_json });
  assert.equal(disposition.consumesBusinessRetry, false, 'the typed cause does not count against the op');
  assert.equal(disposition.retryClass, 'environment');
  assert.equal(w.ledger.db.prepare('SELECT state FROM work_units WHERE unit_id=?').get(JOB).state, 'failed');
  assert.ok(w.ledger.db.prepare("SELECT 1 FROM events WHERE kind='placement-ended' AND attempt_id=?").get(attempt.attempt_id));
  assert.equal(terminalFactsOf(w.ledger.db, JOB)?.hold, TERMINAL_HOLDS.failedNoStep, 'nothing follows it yet: the Job controller routes the next attempt');
});

test('a job whose report was never filed and whose worker is gone is ended the same way', (t) => {
  const w = world(t, { status: 'running', reportFiled: false, writeFiles: [] });
  const ensured = w.reensure(gone);
  assert.deepEqual(ensured.placements.ended.map((r) => r.jobId), [JOB]);
  assert.equal(jobRow(w.ledger).status, 'failed');
  assert.equal(JSON.parse(w.ledger.db.prepare('SELECT settle_json FROM op_attempts WHERE job_id=?').get(JOB).settle_json).reportFiled, false);
});

test('an attempt whose worker is alive, or unreadable, is left to the next pass', (t) => {
  const w = world(t);
  const ensured = w.reensure(live);
  assert.deepEqual(ensured.placements.deferred.map((r) => [r.jobId, r.worker]), [[JOB, 'live']]);
  const unread = reconcileAttemptPlacements(w.ledger, { workflowId: WF, tree: ensured.record, show: () => ({ ok: false, hostUnavailable: true }) });
  assert.deepEqual(unread.deferred.map((r) => r.worker), ['unknown']);
  assert.equal(w.ledger.db.prepare('SELECT COUNT(*) n FROM events WHERE kind=?').get(PLACEMENT_REBOUND).n, 0);
  assert.equal(jobRow(w.ledger).status, 'reported');
});

test('in flight means a live worker: a reported job whose worker is gone is not in flight, a live or unreadable one is', (t) => {
  const w = world(t);
  assert.deepEqual(inFlightOps(w.ledger.db, WF, { show: gone }), []);
  assert.deepEqual(inFlightOps(w.ledger.db, WF, { show: live }).map((op) => [op.jobId, op.status, op.state]), [[JOB, 'reported', 'live']]);
  assert.deepEqual(inFlightOps(w.ledger.db, WF, { show: () => ({ ok: false, hostUnavailable: true }) }).map((op) => op.state), ['unknown']);
  w.ledger.db.prepare("UPDATE jobs SET payload_json=json_remove(payload_json,'$.managed') WHERE job_id=?").run(JOB);
  w.ledger.db.prepare('UPDATE jobs SET worker_id=NULL WHERE job_id=?').run(JOB);
  assert.deepEqual(inFlightOps(w.ledger.db, WF, { show: live }), [], 'a reported job with no worker handle holds nothing');
});

test('the op gate binds the owned slice of a rebound attempt in the registered tree; without the rebind it refuses as the Nivo settle did', async (t) => {
  const w = world(t);
  const ensured = w.reensure(gone);
  const tree = ensured.record.path;
  const contract = latestContractOf(w.ledger.db, JOB);
  const recorded = JSON.parse(contract.context_json).packet.context.gate_binding;
  recorded.targets[0].head = git(tree, 'rev-parse', 'HEAD');
  const owned = recorded.targets[0].owned[0];
  const placements = [{ owned, base: tree, path: owned, role: null, via: 'work-owner' }];
  const judge = (binding) => judgeJobLoop({ op: 'architecture.decide', files: [], roots: [tree], gateBases: [], binding });
  const refused = await judge({ ...recorded, placements });
  assert.equal(refused.judged.code, 'op-gate-tool-failed');
  assert.match(refused.judged.detail, /could not be bound/);
  const binding = reboundBindingOf(recorded, reboundMapOf(w.ledger.db, contract.attempt_id), placements);
  assert.deepEqual(binding.aliases.map((a) => [path.resolve(a.from), path.resolve(a.to)]), [[path.resolve(w.lost), path.resolve(tree)]]);
  assert.equal(await judge(binding), null, 'a docs-only op owes no loop judgment once its slice binds');
});

test('a registered tree still behind the workflow branch decides nothing: the attempt waits for the custody repair, which then rebinds it', (t) => {
  const w = world(t);
  const made = w.orca.create({ repo: `path:${w.app}`, name: `wf-${WF}`, baseBranch: 'main', setup: 'skip', comment: '' }).worktree;
  const tree = registerWorkflowWorktree({ env: w.env }, { workflowId: WF, orcaWorktreeId: made.id, path: made.path, branch: made.branch, ledgerId: 'ledger-1' });
  const waiting = reconcileAttemptPlacements(w.ledger, { workflowId: WF, tree, show: gone, env: w.env });
  assert.deepEqual([waiting.rebound, waiting.ended], [[], []]);
  assert.deepEqual(waiting.deferred.map((d) => [d.jobId, d.tree]), [[JOB, 'not-attached']]);
  assert.equal(jobRow(w.ledger).status, 'reported', 'the attempt is not ended while its work may still be restored');
  const repaired = w.reensure(gone);
  assert.ok(repaired.ok && repaired.repaired, JSON.stringify(repaired));
  assert.deepEqual(repaired.placements.rebound.map((r) => r.jobId), [JOB]);
});
