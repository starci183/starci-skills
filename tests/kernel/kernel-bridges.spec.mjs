import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { FAKE_ORCA } from '../helpers/fake-orca.mjs';
import { openLedger, inspectLedger, ledgerFileFor } from '../../engine/db/ledger.mjs';
import { TEST_REGISTRY_ENV } from '../../engine/db/machine.mjs';
import { resolveIntroducer } from '../../scripts/kernel/introducer.mjs';

// The runtime defects the running workflows filed, each proven through the api:
//  - orchestration notices the Kernel could not read
//  - a shared blocker nobody owned
//  - contract-missing read inside the dispatch window
//  - uncut retry lineage across unrelated work
//  - the landed proof: filed report files and foreign paths
const ROOT = path.resolve(import.meta.dirname, '..', '..');
const API = path.join(ROOT, 'scripts', 'kernel', 'cli.mjs');
const json = (text) => { try { return JSON.parse(text); } catch { return null; } };
const lastErr = (r) => json(String(r.stderr).trim().split('\n').at(-1));

const world = (t, { orca = false } = {}) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-bridges-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  if (process.env.STARCI_TEST_TEMP_DIR) t.after(() => fs.rmSync(path.join(process.env.STARCI_TEST_TEMP_DIR, 'starci-job-scratch'), { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const repo = path.join(root, 'repo'); fs.mkdirSync(repo, { recursive: true }); fs.mkdirSync(path.join(repo, 'docs'), { recursive: true });
  // A private machine registry per world: dispatch enrols the ledger and 'repo' collides on
  // ledgers.name in the suite-shared test registry otherwise. STARCI_LOCAL_ROOT stays: project
  // resolution runs through it.
  const env = { ...process.env, [TEST_REGISTRY_ENV]: path.join(root, 'machine.sqlite') };
  for (const key of ['ORCA_TERMINAL_HANDLE', 'STARCI_ROLE', 'STARCI_OP_JOB', 'STARCI_GUARD_FILE']) delete env[key];
  const stateFile = path.join(root, 'orca-state.json');
  if (orca) {
    const stub = path.join(root, 'fake-orca.mjs'); fs.writeFileSync(stub, FAKE_ORCA);
    Object.assign(env, { STARCI_ORCA_COMMAND: process.execPath, STARCI_ORCA_ARGS: JSON.stringify([stub]), STARCI_FAKE_ORCA_LOG: path.join(root, 'calls.jsonl'), STARCI_FAKE_ORCA_STATE: stateFile });
  }
  const api = (args) => spawnSync(process.execPath, [API, ...args, '--repo', repo, '--json'], { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 180000, env });
  const apiAsync = (args) => new Promise((resolve) => {
    const child = spawn(process.execPath, [API, ...args, '--repo', repo, '--json'], { cwd: ROOT, windowsHide: true, env });
    let stdout = '', stderr = '';
    child.stdout.on('data', (d) => { stdout += d; }); child.stderr.on('data', (d) => { stderr += d; });
    child.on('close', (status) => resolve({ status, stdout, stderr }));
  });
  const seed = (fn) => { const l = openLedger({ file: ledgerFileFor(repo) }); try { return fn(l); } finally { l.close(); } };
  const read = (fn) => { const l = inspectLedger({ file: ledgerFileFor(repo) }); try { return fn(l.db); } finally { l.close(); } };
  const workflow = (workflowId, { title = workflowId, phase = 'running' } = {}) => seed((l) => {
    l.ensureWorkflow({ workflowId, title, ledgerMode: 'durable', sourceRoots: [repo] });
    // Phase moves only through workflow_transitions + a lifecycle_changes row in the same transaction
    // (workflows_phase_guard): seeded 'finished' walks queued -> running -> finished.
    const walk = { 'queued': [], 'running': ['running'], 'finished': ['running', 'finished'] }[phase] ?? [phase];
    for (const to of walk) l.write.changeWorkflowPhase({ workflowId, to, by: 'test', reason: `seed ${workflowId} ${phase}` });
    l.db.prepare('INSERT INTO goals(workflow_id,revision,goal_identity,markdown,json,created_at) VALUES(?,?,?,?,?,?)')
      .run(workflowId, 0, `goal-${workflowId}`, `# ${title} goal`, JSON.stringify({ derivedFrom: 'bridges-spec' }), Date.now());
  });
  // Every op job is a try of a work unit (jobs_enqueue_guard, H3): create the unit first.
  const unit = (l, workflowId, unitId, opId, subjectKey = unitId) => {
    if (!l.db.prepare('SELECT 1 FROM work_units WHERE workflow_id=? AND unit_id=?').get(workflowId, unitId))
      l.write.createUnit({ workflowId, unitId, opId, subjectKey, goalRevision: 1 });
  };
  // jobs.status moves only along job_transitions (jobs_status_guard): walk the seeded job there.
  const settleTo = (l, jobId, status, reason = 'seed') => {
    const route = {
      ready: ['ready'], leased: ['ready', 'leased'], running: ['ready', 'leased', 'running'],
      failed: ['ready', 'leased', 'running', 'failed'],
      succeeded: ['ready', 'leased', 'running', 'reported', 'succeeded'],
      awaiting_owner: ['ready', 'leased', 'running', 'reported', 'awaiting_owner'],
    }[status];
    for (const to of route ?? [status]) l.write.setJobStatus({ jobId, to, reason });
  };
  const writeOrca = (state) => fs.writeFileSync(stateFile, JSON.stringify(state));
  return { root, repo, api, apiAsync, seed, read, workflow, unit, settleTo, writeOrca };
};

test('starci kernel messages shows every orchestration message of the workflow\'s Runs, with its job and where it is handled', (t) => {
  const w = world(t, { orca: true });
  w.workflow('wf-msg');
  w.seed((l) => {
    w.unit(l, 'wf-msg', 'u-msg-1', 'code.refactor', 'docs/');
    l.enqueueJob({ jobId: 'op-code.refactor-aaaaaaaaaa', workflowId: 'wf-msg', unitId: 'u-msg-1', opId: 'code.refactor', kind: 'op',
      payload: { opId: 'code.refactor', owned_paths: ['docs/'], orca: { runId: 'run-msg-1', dispatchId: 'ctx_msg_1', agentTerminalHandle: 'term-op-1' } } });
    // The Kernel terminal is the consumer the drain names on every orchestration check.
    l.enqueueJob({ jobId: 'kernel-wf-msg', workflowId: 'wf-msg', kind: 'kernel', role: 'kernel', payload: { orca: { runId: 'run-msg-1' } } });
    for (const to of ['ready', 'leased']) l.write.setJobStatus({ jobId: 'kernel-wf-msg', to, reason: 'seed' });
    l.write.setJobStatus({ jobId: 'kernel-wf-msg', to: 'running', reason: 'seed', workerId: 'term-kernel-msg' });
  });
  const row = (id, type, extra = {}) => ({ id, run_id: 'run-msg-1', from_handle: 'dispatch:ctx_msg_1', to_handle: 'run:run-msg-1', subject: `${type} subject`,
    body: `${type} body`, type, thread_id: id, payload: JSON.stringify({ dispatchId: 'ctx_msg_1' }), read: 0, created_at: new Date().toISOString(), ...extra });
  w.writeOrca({ messages: [row('m_done', 'worker_done'), row('m_status', 'status'), row('m_q', 'question'), row('m_hb', 'heartbeat'),
    row('m_other', 'status', { run_id: 'run-elsewhere' })] });
  const first = w.api(['messages', '--workflow', 'wf-msg']);
  assert.equal(first.status, 0, first.stderr);
  const out = json(first.stdout);
  assert.equal(out.error, undefined, 'the Run was checked');
  assert.deepEqual(out.messages.map((m) => m.id).sort(), ['m_done', 'm_q', 'm_status'], 'heartbeats and other Runs are left out');
  assert.equal(out.heartbeats, 1, 'a heartbeat is counted, not listed');
  assert.equal(out.new, 3);
  const done = out.messages.find((m) => m.id === 'm_done');
  assert.equal(done.jobId, 'op-code.refactor-aaaaaaaaaa');
  assert.match(done.handle, /information/);
  assert.match(out.messages.find((m) => m.id === 'm_q').handle, /starci kernel reply/);
  const second = json(w.api(['messages', '--workflow', 'wf-msg']).stdout);
  assert.equal(second.new, 0, 'what the Kernel read is remembered');
  // The Delivery was written into the ledger (the question as an inbox row, the rest as events) and only then acknowledged.
  assert.equal(w.read((db) => db.prepare("SELECT count(*) n FROM inbox WHERE kind='worker-question'").get().n), 1);
  assert.equal(w.read((db) => db.prepare("SELECT count(*) n FROM events WHERE kind='orchestration-message'").get().n), 2);
  const orca = json(fs.readFileSync(path.join(w.root, 'orca-state.json'), 'utf8'));
  assert.ok(Object.values(orca.deliveries).every((d) => d.acked), 'every Delivery acknowledged');
  // an op terminal (the one the ledger binds to the op job) may not read the Kernel's messages
  const op = spawnSync(process.execPath, [API, 'messages', '--workflow', 'wf-msg', '--repo', w.repo, '--json'],
    { cwd: ROOT, encoding: 'utf8', env: { ...process.env, ORCA_TERMINAL_HANDLE: 'term-op-1' } });
  assert.equal(op.status, 1);
  assert.equal(lastErr(op).code, 'op-context-refused');
});

const gitRepo = (dir) => {
  const g = (...args) => spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
  g('init', '-q', '-b', 'main'); g('config', 'user.email', 't@t'); g('config', 'user.name', 't'); g('config', 'commit.gpgsign', 'false');
  return g;
};

test('a shared blocker is routed to the workflow whose code introduced it, as a typed follow-up', (t) => {
  const w = world(t);
  const g = gitRepo(w.repo);
  fs.mkdirSync(path.join(w.repo, 'platform'), { recursive: true });
  fs.writeFileSync(path.join(w.repo, 'platform', 'recovery.ts'), 'import type { Backend } from "./backend"\n');
  g('add', '.'); g('commit', '-q', '-m', 'chore(orders): checkpoint backend and canonical work');
  const scoped = g('rev-parse', 'HEAD').stdout.trim();
  fs.writeFileSync(path.join(w.repo, 'platform', 'shell.ts'), 'export const shell = 1\n');
  g('add', '.'); g('commit', '-q', '-m', 'feat(shell): prove the shell routes (cut be-r0-modules 1/6)');
  const reported = g('rev-parse', 'HEAD').stdout.trim();
  w.workflow('wf-app-workspace-provision-x', { title: 'app-workspace-provision' });
  w.workflow('wf-app-modules-orders-old', { title: 'app-modules-orders', phase: 'finished' });
  w.workflow('wf-app-modules-orders-x', { title: 'app-modules-orders' });
  w.seed((l) => {
    w.unit(l, 'wf-app-modules-orders-x', 'u-r1', 'backend.implement', 'platform/shell.ts');
    l.enqueueJob({ jobId: 'op-backend.implement-1111111111', workflowId: 'wf-app-modules-orders-x', unitId: 'u-r1', opId: 'backend.implement', kind: 'op', payload: { opId: 'backend.implement', owned_paths: ['platform/shell.ts'] } });
    // A reports row is attempt-bound (H10): the job leases, the dispatch opens an op_attempts row, the
    // report files on it - resolveIntroducer reads report_json.head for the 'report-head' route.
    w.settleTo(l, 'op-backend.implement-1111111111', 'leased');
    const attempt = l.write.startAttempt({ workflowId: 'wf-app-modules-orders-x', jobId: 'op-backend.implement-1111111111', dispatchId: 'ctx_r1' });
    l.write.fileReport({ attemptId: attempt.attempt_id, outcome: 'done', report: { outcome: 'done', head: reported.slice(0, 10) } });
  });
  const raise = (extra) => w.api(['incident', '--workflow', 'wf-app-workspace-provision-x', '--kind', 'shared-blocker',
    '--detail', 'Nest cannot resolve ModuleRecoveryClientService (?, MODULE_RECOVERY_RECONCILERS)', ...extra]);
  const viaScope = raise(['--introduced-by', scoped.slice(0, 8), '--fix', 'value-import BackendClientService in platform/recovery.ts']);
  assert.equal(viaScope.status, 0, viaScope.stderr);
  const routed = json(viaScope.stdout).sharedBlocker;
  assert.equal(routed.routed, true, JSON.stringify(routed));
  assert.equal(routed.to, 'wf-app-modules-orders-x', 'the running line of the scope that introduced it');
  assert.equal(routed.via, 'commit-scope');
  const inbox = w.read((db) => db.prepare("SELECT key,payload_json,status FROM inbox WHERE workflow_id=? AND kind='peer-message'").all('wf-app-modules-orders-x'));
  assert.equal(inbox.length, 1);
  const message = json(inbox[0].payload_json);
  assert.equal(message.kind, 'follow-up');
  assert.equal(message.from, 'wf-app-workspace-provision-x');
  assert.equal(message.followUp.commit, scoped);
  assert.match(message.body, /value-import BackendClientService/);
  assert.ok(message.refs.includes(json(viaScope.stdout).incidentId));
  const target = json(w.api(['status', '--workflow', 'wf-app-modules-orders-x']).stdout);
  assert.equal(target.frontier.actionable, true, 'the introducer\'s frontier is actionable on its follow-up');
  const viaHead = json(raise(['--introduced-by', reported]).stdout).sharedBlocker;
  assert.deepEqual([viaHead.routed, viaHead.via], [true, 'report-head']);
  const self = json(w.api(['incident', '--workflow', 'wf-app-modules-orders-x', '--kind', 'shared-blocker', '--detail', 'x', '--introduced-by', reported]).stdout).sharedBlocker;
  assert.deepEqual([self.routed, /introduced it/.test(self.why)], [false, true]);
  const none = json(raise(['--introduced-by', '0123456789abcdef']).stdout).sharedBlocker;
  assert.equal(none.routed, false);
  assert.ok(w.read((db) => db.prepare("SELECT count(*) n FROM events WHERE kind='shared-blocker-routed'").get().n) >= 4);
  // the resolver alone: an explicit introducer wins
  w.read((db) => assert.equal(resolveIntroducer(db, { explicit: 'wf-app-modules-orders-old', roots: [w.repo] }).workflowId, 'wf-app-modules-orders-x'));
});

// A commit (module-studio a5, op-backend.implement-9785552dcb) broke
// pod-registration.controller.spec.ts; the blocker was routed to module-studio, whose queued retry
// op-backend.implement-853af99286 owns the file, yet the reporter's incident carried no typed release and
// sat OWED on the supervisor. Routing now types it as a wait on the owning job, through its retry lineage.
test('a routed shared blocker becomes a typed wait on the introducer\'s owning job, released when it succeeds', (t) => {
  const w = world(t);
  const g = gitRepo(w.repo);
  fs.mkdirSync(path.join(w.repo, 'src'), { recursive: true });
  fs.writeFileSync(path.join(w.repo, 'src', 'pod.controller.ts'), 'export const verify = 1\n');
  g('add', '.'); g('commit', '-q', '-m', 'feat: verify documents');
  const commit = g('rev-parse', 'HEAD').stdout.trim();
  const REPORTER = 'wf-app-debt-x', STUDIO = 'wf-app-module-studio-x';
  const INTRO = 'op-backend.implement-9785552dcb', OWNER = 'op-backend.implement-853af99286', OTHER = 'op-backend.implement-aaaaaaaaaa';
  w.workflow(REPORTER); w.workflow(STUDIO);
  w.seed((l) => {
    // jobs.retry_of is a unit lineage now (H3/H4): the retry is the next try of the introducer's unit.
    const add = (jobId, status, unitId, tryNo, retryOf, payload) => {
      w.unit(l, STUDIO, unitId, 'backend.implement', jobId);
      l.enqueueJob({ jobId, workflowId: STUDIO, unitId, opId: 'backend.implement', tryNo, retryOf, kind: 'op',
        payload: { opId: 'backend.implement', ...payload }, createdAt: Date.now() - 60_000 });
      if (status !== 'queued') w.settleTo(l, jobId, status);
    };
    add(INTRO, 'failed', 'u-intro', 1, null, { owned_paths: ['src/pod.controller.ts'] });
    add(OWNER, 'queued', 'u-intro', 2, INTRO, { owned_paths: ['src/pod.controller.ts', 'src/pod.controller.spec.ts'], retry: { retryOf: INTRO } });
    add(OTHER, 'queued', 'u-other', 1, null, { owned_paths: ['src/unrelated.ts'] });
  });
  const raise = (detail, extra = []) => {
    const r = w.api(['incident', '--workflow', REPORTER, '--kind', 'shared-blocker', '--introducer', STUDIO, '--detail', detail, ...extra]);
    assert.equal(r.status, 0, r.stderr);
    return json(r.stdout);
  };
  const named = raise(`Commit ${commit.slice(0, 8)} (${INTRO} a5) broke pod.controller.spec.ts; queued ${OWNER} owns the fix`);
  assert.deepEqual(named.sharedBlocker.until, [{ type: 'job', jobId: OWNER, want: 'succeeded' }], 'the failed introducer and its retry are one unit: its head');
  const viaCommit = raise('pod.controller.spec.ts red after the verify() change', ['--introduced-by', commit]);
  assert.deepEqual(viaCommit.sharedBlocker.until, [{ type: 'job', jobId: OWNER, want: 'succeeded' }], 'the open job owning a file the commit changed');
  const unnamed = raise('the shared module is broken');
  assert.deepEqual(unnamed.sharedBlocker.until, [{ type: 'message', peer: STUDIO, kind: 'reply' }], 'no owning job: the introducer\'s reply releases it');
  // A blocker routed before routing typed it reads typed all the same.
  const legacy = 'inc-000000legacy';
  w.seed((l) => {
    const text = `Commit 9caa2d5c (${INTRO} a5) broke the spec; queued sibling ${OWNER} owns the fix`;
    l.db.prepare("INSERT INTO incidents(incident_id,workflow_id,kind,owner,attempts,model_calls,tokens,elapsed_ms,last_progress,status,created_at,updated_at) VALUES(?,?,'other','kernel',0,0,0,0,?,'open',?,?)")
      .run(legacy, REPORTER, `[shared-blocker] ${text}`, Date.now(), Date.now());
    l.appendEvent({ workflowId: REPORTER, entityType: 'incident', entityId: legacy, kind: 'incident-raised', payload: { kind: 'shared-blocker', detail: text, opId: null } });
    l.appendEvent({ workflowId: REPORTER, entityType: 'incident', entityId: legacy, kind: 'shared-blocker-routed', payload: { routed: true, to: STUDIO, key: 'pm-x', via: 'explicit', commit: null } });
  });
  const frontier = json(w.api(['status', '--workflow', REPORTER]).stdout).frontier;
  const typed = new Map((frontier.gateConditions ?? []).map((c) => [c.incidentId, c]));
  for (const id of [named.incidentId, viaCommit.incidentId, legacy]) {
    assert.deepEqual(typed.get(id)?.until, [{ type: 'job', jobId: OWNER, want: 'succeeded' }], `${id} waits on ${OWNER}`);
  }
  assert.equal(typed.has(unnamed.incidentId), true);
  w.seed((l) => w.settleTo(l, OWNER, 'succeeded', 'seed owner settled'));
  json(w.api(['status', '--workflow', REPORTER]).stdout);
  const status = (id) => w.read((db) => db.prepare('SELECT status FROM incidents WHERE incident_id=?').get(id).status);
  assert.deepEqual([named.incidentId, viaCommit.incidentId, legacy, unnamed.incidentId].map(status), ['resolved', 'resolved', 'resolved', 'open']);
});

test('op-contract waits for a dispatch still committing its row, and answers missing at once otherwise', async (t) => {
  const w = world(t);
  w.workflow('wf-oc');
  w.seed((l) => {
    w.unit(l, 'wf-oc', 'u-oc-1', 'interface.draw', 'docs/');
    l.enqueueJob({ jobId: 'op-interface.draw-e5233f0306', workflowId: 'wf-oc', unitId: 'u-oc-1', opId: 'interface.draw', kind: 'op', payload: { opId: 'interface.draw', owned_paths: ['docs/'] } });
    w.settleTo(l, 'op-interface.draw-e5233f0306', 'leased');
  });
  const pending = w.apiAsync(['op-contract', '--job', 'op-interface.draw-e5233f0306']);
  await new Promise((resolve) => setTimeout(resolve, 2500));
  w.seed((l) => {
    // Contracts key on op_attempts.attempt_id now: the dispatch opens the attempt, the contract files on it.
    const attempt = l.write.startAttempt({ workflowId: 'wf-oc', jobId: 'op-interface.draw-e5233f0306', dispatchId: 'ctx_72d7e9acb0ef' });
    l.write.writeContract({ attemptId: attempt.attempt_id, markdown: '# contract for attempt 1', context: { packet: {} } });
    l.write.setJobStatus({ jobId: 'op-interface.draw-e5233f0306', to: 'running', reason: 'worker picked it up' });
  });
  const r = await pending;
  assert.equal(r.status, 0, r.stderr);
  assert.equal(json(r.stdout).dispatchId, 'ctx_72d7e9acb0ef');
  w.seed((l) => {
    w.unit(l, 'wf-oc', 'u-oc-2', 'interface.draw', 'docs/other');
    l.enqueueJob({ jobId: 'op-interface.draw-ffffffffff', workflowId: 'wf-oc', unitId: 'u-oc-2', opId: 'interface.draw', kind: 'op', payload: { opId: 'interface.draw' } });
    w.settleTo(l, 'op-interface.draw-ffffffffff', 'running');
  });
  const started = Date.now();
  const missing = w.api(['op-contract', '--job', 'op-interface.draw-ffffffffff']);
  assert.equal(missing.status, 1);
  assert.equal(lastErr(missing).code, 'contract-missing');
  assert.ok(Date.now() - started < 60000, 'a running job without its row is not waited on');
});

test('an uncut retry chains to its own unit of work; --retry-of pins it; the goal rides in the packet', (t) => {
  const w = world(t);
  w.workflow('wf-lin');
  const enqueue = (paths, extra = []) => {
    const r = w.api(['enqueue', '--workflow', 'wf-lin', '--op', 'docs.author', '--paths', paths, ...extra]);
    assert.equal(r.status, 0, r.stderr);
    return json(r.stdout).job_id;
  };
  // jobs has no result column: the result is the attempt's settle_json, or one 'job-result' event
  // for a job that never dispatched (recordJobResult). Status walks job_transitions.
  const fail = (jobId) => w.seed((l) => {
    w.settleTo(l, jobId, 'failed');
    l.write.recordJobResult({ jobId, result: { verdict: 'fail' } });
  });
  fs.mkdirSync(path.join(w.repo, 'docs', 'collab'), { recursive: true });
  const tasks = enqueue('docs/collab/tasks'); fail(tasks);
  const membership = enqueue('docs/collab/membership'); fail(membership);
  const retry = enqueue('docs/collab/tasks');
  // The lineage is the work unit now (units.mjs): a retry is the same unit's next try, jobs.retry_of
  // naming the failed try it follows - payload.retry is gone.
  const lineage = (jobId) => w.read((db) => db.prepare('SELECT unit_id, try_no, retry_of FROM jobs WHERE job_id=?').get(jobId));
  assert.deepEqual([lineage(retry).unit_id, lineage(retry).try_no, lineage(retry).retry_of],
    [lineage(tasks).unit_id, 2, tasks], 'the failed job\'s own unit, not the later membership job');
  assert.equal(lineage(membership).retry_of, null, 'a first job of its own work has no predecessor');
  fail(retry);
  const pinned = enqueue('docs/collab/other', ['--retry-of', membership]);
  assert.equal(lineage(pinned).retry_of, membership);
  const bad = w.api(['enqueue', '--workflow', 'wf-lin', '--op', 'docs.author', '--paths', 'docs/x', '--retry-of', 'op-docs.author-0000000000']);
  assert.equal(bad.status, 1);
  const dryRun = w.api(['dispatch', '--job', pinned]);
  const dry = json(dryRun.stdout);
  assert.ok(dry, dryRun.stderr || dryRun.stdout);
  assert.equal(dry.packet.context.goal.statement, '# wf-lin goal');
  assert.match(dry.prompt, /shared_checkout:/);
  assert.match(dry.prompt, /the runtime is the only committer/);
});

test('an answered ask stays awaiting its owner-answer retry until a job of ITS work exists', (t) => {
  const w = world(t);
  w.workflow('wf-ask');
  // "A job of ITS work" is the next try of the same unit (status.mjs stillWaits): the retry carries
  // try_no+1 and retry_of the failed job of that unit - an unrelated same-op job is a different unit.
  const add = (jobId, { unitId, tryNo = 1, retryOf = null }, status, ownedPaths, result = null) => w.seed((l) => {
    w.unit(l, 'wf-ask', unitId, 'business.decide', jobId);
    l.enqueueJob({ jobId, workflowId: 'wf-ask', unitId, opId: 'business.decide', tryNo, retryOf, kind: 'op', payload: { opId: 'business.decide', owned_paths: ownedPaths } });
    if (status !== 'queued') w.settleTo(l, jobId, status);
    if (result) l.write.recordJobResult({ jobId, result });
  });
  add('op-business.decide-aaaaaaaaaa', { unitId: 'u-ask-a' }, 'awaiting_owner', ['.starciwork/features/account/decision/social-only-password'], { verdict: 'awaiting-owner', askDispatchId: 'ctx_ae2e07987208' });
  w.seed((l) => l.appendEvent({ workflowId: 'wf-ask', entityType: 'job', entityId: 'op-business.decide-aaaaaaaaaa', kind: 'ask-answered', payload: { dispatchId: 'ctx_ae2e07987208' } }));
  const waiting = () => json(w.api(['status', '--workflow', 'wf-ask']).stdout).awaitingOwner.map((a) => [a.jobId, a.answer]);
  assert.deepEqual(waiting(), [['op-business.decide-aaaaaaaaaa', 'answered']]);
  add('op-business.decide-bbbbbbbbbb', { unitId: 'u-ask-b' }, 'queued', ['.starciwork/features/community/decision/study-day-qualifier']);
  assert.deepEqual(waiting(), [['op-business.decide-aaaaaaaaaa', 'answered']], 'an unrelated same-op job is not its retry');
  add('op-business.decide-cccccccccc', { unitId: 'u-ask-a', tryNo: 2, retryOf: 'op-business.decide-aaaaaaaaaa' }, 'queued', ['.starciwork/features/account/decision/social-only-password']);
  assert.deepEqual(waiting(), [], 'the owner-answer retry of its own record replaces the wait');
});

test('dispatch files the contract row for the worker-start Dispatch; an early op-contract read waits for it', (t) => {
  const w = world(t, { orca: true });
  w.workflow('wf-cf');
  const enqueue = (jobId) => w.seed((l) => {
    l.enqueueJob({ jobId: `kernel-${jobId}`, workflowId: 'wf-cf', kind: 'kernel', role: 'kernel',
      payload: { hierarchy: { schema: 'starci/agent-hierarchy@1', nodeId: 'agent:kernel:wf-cf', parentNodeId: 'workflow:wf-cf', role: 'kernel' } } });
    w.settleTo(l, `kernel-${jobId}`, 'running', 'kernel seated');
    l.write.updateJob({ jobId: `kernel-${jobId}`, workerId: 'fake-kernel-terminal' });
    w.unit(l, 'wf-cf', `u-${jobId}`, 'code.refactor', 'docs/');
    l.enqueueJob({ jobId, workflowId: 'wf-cf', unitId: `u-${jobId}`, opId: 'code.refactor', kind: 'op', payload: { opId: 'code.refactor', owned_paths: ['docs/'], model: 'codex-agent', difficulty: 'hard' } });
  });
  enqueue('op-code.refactor-cf00000001');
  const ok = w.api(['dispatch', '--job', 'op-code.refactor-cf00000001', '--model', 'codex-agent', '--spawn']);
  assert.equal(ok.status, 0, ok.stderr || ok.stdout);
  // The contract row keys on the dispatch attempt (contracts.attempt_id); dispatch_id lives on op_attempts.
  const row = w.read((db) => db.prepare(`SELECT a.dispatch_id, c.context_json FROM contracts c JOIN op_attempts a ON a.attempt_id=c.attempt_id
    WHERE c.workflow_id='wf-cf' AND a.op_id='code.refactor' AND a.try_no=1`).get());
  assert.equal(row.dispatch_id, json(ok.stdout).dispatchId);
  assert.equal(json(row.context_json).managed.dispatchId, json(ok.stdout).dispatchId, 'the contract names the worker-start Dispatch');
  const guard = w.read((db) => json(db.prepare("SELECT payload_json FROM events WHERE kind='op-dispatched' AND entity_id='op-code.refactor-cf00000001'").get().payload_json).guard);
  assert.ok(guard?.jobFile, 'the dispatch receipt names the shared-checkout guard');
});
