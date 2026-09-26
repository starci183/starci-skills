import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { FAKE_ORCA } from './helpers/fake-orca.mjs';
import { openLedger, inspectLedger, ledgerFileFor } from '../engine/ledger-db.mjs';
import { landedProof } from '../scripts/kernel/settle-landed.mjs';
import { resolveIntroducer } from '../scripts/kernel/introducer.mjs';

// The runtime defects the running workflows filed on 2026-09-23/24, each proven through the api:
//  - orchestration notices the Kernel could not read (starci-next inc-81559e3a064b, mia inc-c55b52879387)
//  - a shared blocker nobody owned (nivo WSPV inc-be78a39b6b50, Modules inc-b6f66a0d29ce)
//  - contract-missing read inside the dispatch window (nivo inc-e09140ad9c22, inc-7f437d11edae)
//  - uncut retry lineage across unrelated work (nivo inc-6a0cfe1b39d4, mia inc-bca4d2034f8c, inc-2f7968ede59c)
//  - the landed proof: filed report files and foreign paths (inc-5d7ce049e810, inc-40fed684fff8)
const ROOT = path.resolve(import.meta.dirname, '..');
const API = path.join(ROOT, 'scripts', 'kernel', 'api.mjs');
const json = (text) => { try { return JSON.parse(text); } catch { return null; } };
const lastErr = (r) => json(String(r.stderr).trim().split('\n').at(-1));

const world = (t, { orca = false } = {}) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-bridges-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const repo = path.join(root, 'repo'); fs.mkdirSync(repo, { recursive: true });
  const env = { ...process.env };
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
    l.db.prepare('UPDATE workflows SET phase=? WHERE workflow_id=?').run(phase, workflowId);
    l.db.prepare('INSERT INTO goals(workflow_id,revision,goal_identity,markdown,json,created_at) VALUES(?,?,?,?,?,?)')
      .run(workflowId, 0, `goal-${workflowId}`, `# ${title} goal`, JSON.stringify({ derivedFrom: 'bridges-spec' }), Date.now());
  });
  const writeOrca = (state) => fs.writeFileSync(stateFile, JSON.stringify(state));
  return { root, repo, api, apiAsync, seed, read, workflow, writeOrca };
};

test('api messages shows every orchestration message of the workflow\'s Runs, with its job and where it is handled', (t) => {
  const w = world(t, { orca: true });
  w.workflow('wf-msg');
  w.seed((l) => l.enqueueJob({ jobId: 'op-code.refactor-aaaaaaaaaa', workflowId: 'wf-msg', opId: 'code.refactor', kind: 'op',
    payload: { opId: 'code.refactor', owned_paths: ['docs/'], orca: { runId: 'run-msg-1', dispatchId: 'ctx_msg_1', agentTerminalHandle: 'term-op-1' } } }));
  const row = (id, type, extra = {}) => ({ id, run_id: 'run-msg-1', from_handle: 'dispatch:ctx_msg_1', to_handle: 'run:run-msg-1', subject: `${type} subject`,
    body: `${type} body`, type, thread_id: id, payload: JSON.stringify({ dispatchId: 'ctx_msg_1' }), read: 0, created_at: new Date().toISOString(), ...extra });
  w.writeOrca({ messages: [row('m_done', 'worker_done'), row('m_status', 'status'), row('m_q', 'question'), row('m_hb', 'heartbeat'),
    row('m_other', 'status', { run_id: 'run-elsewhere' })] });
  const first = w.api(['messages', '--workflow', 'wf-msg']);
  assert.equal(first.status, 0, first.stderr);
  const out = json(first.stdout);
  assert.deepEqual(out.messages.map((m) => m.id).sort(), ['m_done', 'm_q', 'm_status'], 'heartbeats and other Runs are left out');
  assert.equal(out.new, 3);
  const done = out.messages.find((m) => m.id === 'm_done');
  assert.equal(done.jobId, 'op-code.refactor-aaaaaaaaaa');
  assert.match(done.handle, /information/);
  assert.match(out.messages.find((m) => m.id === 'm_q').handle, /api reply/);
  const second = json(w.api(['messages', '--workflow', 'wf-msg']).stdout);
  assert.equal(second.new, 0, 'what the Kernel read is remembered');
  assert.equal(w.read((db) => db.prepare("SELECT count(*) n FROM inbox").get().n), 0, 'nothing is bridged or acknowledged');
  // an op terminal may not read the Kernel's messages
  const op = spawnSync(process.execPath, [API, 'messages', '--workflow', 'wf-msg', '--repo', w.repo, '--json'],
    { cwd: ROOT, encoding: 'utf8', env: { ...process.env, STARCI_ROLE: 'op', STARCI_OP_JOB: 'op-code.refactor-aaaaaaaaaa' } });
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
  g('add', '.'); g('commit', '-q', '-m', 'chore(agentos): checkpoint backend and canonical work');
  const scoped = g('rev-parse', 'HEAD').stdout.trim();
  fs.writeFileSync(path.join(w.repo, 'platform', 'shell.ts'), 'export const shell = 1\n');
  g('add', '.'); g('commit', '-q', '-m', 'feat(shell): prove the shell routes (cut be-r0-modules 1/6)');
  const reported = g('rev-parse', 'HEAD').stdout.trim();
  w.workflow('wf-nivo-workspace-provision-x', { title: 'nivo-workspace-provision' });
  w.workflow('wf-nivo-modules-agentos-old', { title: 'nivo-modules-agentos', phase: 'finished' });
  w.workflow('wf-nivo-modules-agentos-x', { title: 'nivo-modules-agentos' });
  w.seed((l) => {
    l.enqueueJob({ jobId: 'op-backend.implement-1111111111', workflowId: 'wf-nivo-modules-agentos-x', opId: 'backend.implement', kind: 'op', payload: { opId: 'backend.implement', owned_paths: ['platform/shell.ts'] } });
    l.db.prepare('INSERT INTO reports(workflow_id,dispatch_id,op_id,attempt,generation,outcome,report_json,created_at) VALUES(?,?,?,?,?,?,?,?)')
      .run('wf-nivo-modules-agentos-x', 'ctx_r1', 'backend.implement', 1, 1, 'done', JSON.stringify({ outcome: 'done', head: reported.slice(0, 10) }), Date.now());
  });
  const raise = (extra) => w.api(['incident', '--workflow', 'wf-nivo-workspace-provision-x', '--kind', 'shared-blocker',
    '--detail', 'Nest cannot resolve ModuleRecoveryClientService (?, MODULE_RECOVERY_RECONCILERS)', ...extra]);
  const viaScope = raise(['--introduced-by', scoped.slice(0, 8), '--fix', 'value-import BackendClientService in platform/recovery.ts']);
  assert.equal(viaScope.status, 0, viaScope.stderr);
  const routed = json(viaScope.stdout).sharedBlocker;
  assert.equal(routed.routed, true, JSON.stringify(routed));
  assert.equal(routed.to, 'wf-nivo-modules-agentos-x', 'the running line of the scope that introduced it');
  assert.equal(routed.via, 'commit-scope');
  const inbox = w.read((db) => db.prepare("SELECT key,payload_json,status FROM inbox WHERE workflow_id=? AND kind='peer-message'").all('wf-nivo-modules-agentos-x'));
  assert.equal(inbox.length, 1);
  const message = json(inbox[0].payload_json);
  assert.equal(message.kind, 'follow-up');
  assert.equal(message.from, 'wf-nivo-workspace-provision-x');
  assert.equal(message.followUp.commit, scoped);
  assert.match(message.body, /value-import BackendClientService/);
  assert.ok(message.refs.includes(json(viaScope.stdout).incidentId));
  const target = json(w.api(['status', '--workflow', 'wf-nivo-modules-agentos-x']).stdout);
  assert.equal(target.frontier.actionable, true, 'the introducer\'s frontier is actionable on its follow-up');
  const viaHead = json(raise(['--introduced-by', reported]).stdout).sharedBlocker;
  assert.deepEqual([viaHead.routed, viaHead.via], [true, 'report-head']);
  const self = json(w.api(['incident', '--workflow', 'wf-nivo-modules-agentos-x', '--kind', 'shared-blocker', '--detail', 'x', '--introduced-by', reported]).stdout).sharedBlocker;
  assert.deepEqual([self.routed, /introduced it/.test(self.why)], [false, true]);
  const none = json(raise(['--introduced-by', '0123456789abcdef']).stdout).sharedBlocker;
  assert.equal(none.routed, false);
  assert.ok(w.read((db) => db.prepare("SELECT count(*) n FROM events WHERE kind='shared-blocker-routed'").get().n) >= 4);
  // the resolver alone: an explicit introducer wins
  w.read((db) => assert.equal(resolveIntroducer(db, { explicit: 'wf-nivo-modules-agentos-old', roots: [w.repo] }).workflowId, 'wf-nivo-modules-agentos-x'));
});

// nivo academy-debt inc-9474fe9ff445: 9caa2d5c (module-studio a5, op-backend.implement-9785552dcb) broke
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
  const REPORTER = 'wf-nivo-academy-debt-x', STUDIO = 'wf-nivo-module-studio-x';
  const INTRO = 'op-backend.implement-9785552dcb', OWNER = 'op-backend.implement-853af99286', OTHER = 'op-backend.implement-aaaaaaaaaa';
  w.workflow(REPORTER); w.workflow(STUDIO);
  w.seed((l) => {
    const add = (jobId, attempt, status, payload) => l.db.prepare(`INSERT INTO jobs(job_id,workflow_id,op_id,attempt,generation,kind,role,payload_json,status,created_at,updated_at)
      VALUES(?,?,'backend.implement',?,0,'op','op',?,?,?,?)`).run(jobId, STUDIO, attempt, JSON.stringify({ opId: 'backend.implement', ...payload }), status, Date.now() - 60_000, Date.now() - 60_000);
    add(INTRO, 5, 'failed', { owned_paths: ['src/pod.controller.ts'] });
    add(OWNER, 10, 'queued', { owned_paths: ['src/pod.controller.ts', 'src/pod.controller.spec.ts'], retry: { retryOf: INTRO } });
    add(OTHER, 11, 'queued', { owned_paths: ['src/unrelated.ts'] });
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
  // A blocker routed before routing typed it (the live inc-9474fe9ff445) reads typed all the same.
  const legacy = 'inc-000000legacy';
  w.seed((l) => {
    const text = `Commit 9caa2d5c (${INTRO} a5) broke the spec; queued sibling ${OWNER} owns the fix`;
    l.db.prepare("INSERT INTO incidents(incident_id,workflow_id,op_id,attempts,model_calls,tokens,elapsed_ms,last_progress,status,updated_at) VALUES(?,?,NULL,0,0,0,0,?,'open',?)")
      .run(legacy, REPORTER, `[shared-blocker] ${text}`, Date.now());
    l.appendEvent({ workflowId: REPORTER, entityType: 'incident', entityId: legacy, kind: 'incident-raised', payload: { kind: 'shared-blocker', detail: text, opId: null } });
    l.appendEvent({ workflowId: REPORTER, entityType: 'incident', entityId: legacy, kind: 'shared-blocker-routed', payload: { routed: true, to: STUDIO, key: 'pm-x', via: 'explicit', commit: null } });
  });
  const frontier = json(w.api(['status', '--workflow', REPORTER]).stdout).frontier;
  const typed = new Map((frontier.gateConditions ?? []).map((c) => [c.incidentId, c]));
  for (const id of [named.incidentId, viaCommit.incidentId, legacy]) {
    assert.deepEqual(typed.get(id)?.until, [{ type: 'job', jobId: OWNER, want: 'succeeded' }], `${id} waits on ${OWNER}`);
  }
  assert.equal(typed.has(unnamed.incidentId), true);
  w.seed((l) => l.db.prepare("UPDATE jobs SET status='succeeded',updated_at=? WHERE job_id=?").run(Date.now(), OWNER));
  json(w.api(['status', '--workflow', REPORTER]).stdout);
  const status = (id) => w.read((db) => db.prepare('SELECT status FROM incidents WHERE incident_id=?').get(id).status);
  assert.deepEqual([named.incidentId, viaCommit.incidentId, legacy, unnamed.incidentId].map(status), ['resolved', 'resolved', 'resolved', 'open']);
});

test('op-contract waits for a dispatch still committing its row, and answers missing at once otherwise', async (t) => {
  const w = world(t);
  w.workflow('wf-oc');
  w.seed((l) => {
    l.enqueueJob({ jobId: 'op-interface.draw-e5233f0306', workflowId: 'wf-oc', opId: 'interface.draw', kind: 'op', payload: { opId: 'interface.draw', owned_paths: ['docs/'] } });
    l.db.prepare("UPDATE jobs SET status='leased' WHERE job_id='op-interface.draw-e5233f0306'").run();
  });
  const pending = w.apiAsync(['op-contract', '--job', 'op-interface.draw-e5233f0306']);
  await new Promise((resolve) => setTimeout(resolve, 2500));
  w.seed((l) => {
    l.db.prepare('INSERT INTO contracts(workflow_id,op_id,attempt,dispatch_id,markdown,context_json,created_at) VALUES(?,?,?,?,?,?,?)')
      .run('wf-oc', 'interface.draw', 1, 'ctx_72d7e9acb0ef', '# contract for attempt 1', JSON.stringify({ packet: {} }), Date.now());
    l.db.prepare("UPDATE jobs SET status='running' WHERE job_id='op-interface.draw-e5233f0306'").run();
  });
  const r = await pending;
  assert.equal(r.status, 0, r.stderr);
  assert.equal(json(r.stdout).dispatchId, 'ctx_72d7e9acb0ef');
  w.seed((l) => l.enqueueJob({ jobId: 'op-interface.draw-ffffffffff', workflowId: 'wf-oc', opId: 'interface.draw', attempt: 2, kind: 'op', payload: { opId: 'interface.draw' } }));
  w.seed((l) => l.db.prepare("UPDATE jobs SET status='running' WHERE job_id='op-interface.draw-ffffffffff'").run());
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
  const fail = (jobId) => w.seed((l) => l.db.prepare("UPDATE jobs SET status='failed', result_json=? WHERE job_id=?").run(JSON.stringify({ verdict: 'fail' }), jobId));
  const tasks = enqueue('docs/collab/tasks'); fail(tasks);
  const membership = enqueue('docs/collab/membership'); fail(membership);
  const retry = enqueue('docs/collab/tasks');
  const lineage = (jobId) => w.read((db) => json(db.prepare('SELECT payload_json FROM jobs WHERE job_id=?').get(jobId).payload_json).retry);
  assert.equal(lineage(retry).retryOf, tasks, 'not the later membership job');
  assert.equal(lineage(membership), undefined, 'a first job of its own work has no predecessor');
  fail(retry);
  const pinned = enqueue('docs/collab/other', ['--retry-of', membership]);
  assert.equal(lineage(pinned).retryOf, membership);
  const bad = w.api(['enqueue', '--workflow', 'wf-lin', '--op', 'docs.author', '--paths', 'docs/x', '--retry-of', 'op-docs.author-0000000000']);
  assert.equal(bad.status, 1);
  const dryRun = w.api(['dispatch', '--job', pinned]);
  const dry = json(dryRun.stdout);
  assert.ok(dry, dryRun.stderr || dryRun.stdout);
  assert.equal(dry.packet.context.goal.statement, '# wf-lin goal');
  assert.match(dry.prompt, /shared_checkout:/);
  assert.match(dry.prompt, /git commit -m "<msg>" -- <owned paths>/);
});

test('the landed proof ignores filed report files and refuses a commit carrying foreign paths', (t) => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-landed-'));
  t.after(() => fs.rmSync(repo, { recursive: true, force: true }));
  const g = gitRepo(repo);
  fs.mkdirSync(path.join(repo, 'src', 'mine'), { recursive: true });
  fs.mkdirSync(path.join(repo, '.starcistacks', 'dev'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'src', 'mine', 'a.ts'), '1\n');
  fs.writeFileSync(path.join(repo, '.starcistacks', 'dev', 'stack.yaml.enc'), 'v1\n');
  g('add', '.');
  spawnSync('git', ['commit', '-q', '-m', 'base'], { cwd: repo, env: { ...process.env, GIT_AUTHOR_DATE: '2026-01-01T00:00:00Z', GIT_COMMITTER_DATE: '2026-01-01T00:00:00Z' } });
  const admitted = Date.parse('2026-06-01T00:00:00Z');
  fs.writeFileSync(path.join(repo, 'src', 'mine', 'a.ts'), '2\n');
  g('add', 'src/mine/a.ts'); g('commit', '-q', '-m', 'mine');
  const head = g('rev-parse', 'HEAD').stdout.trim();
  const report = path.join(repo, 'src', 'mine', 'evidence', 'a23', 'report.json');
  fs.mkdirSync(path.dirname(report), { recursive: true }); fs.writeFileSync(report, '{}\n');
  const placements = [{ base: repo, path: 'src/mine', role: null }];
  assert.equal(landedProof({ placements, head, pushes: false }).reason, 'not-landed', 'the report file alone made it dirty');
  const clean = landedProof({ placements, head, pushes: false, exclude: [report], foreign: { sinceMs: admitted } });
  assert.equal(clean.ok, true, JSON.stringify(clean));
  fs.writeFileSync(path.join(repo, 'src', 'mine', 'a.ts'), '3\n');
  fs.writeFileSync(path.join(repo, '.starcistacks', 'dev', 'stack.yaml.enc'), 'v2 re-encrypted by a hook\n');
  g('add', 'src/mine/a.ts', '.starcistacks/dev/stack.yaml.enc'); g('commit', '-q', '-m', 'mine + swept');
  const swept = g('rev-parse', 'HEAD').stdout.trim();
  const refused = landedProof({ placements, head: swept, pushes: false, exclude: [report], foreign: { sinceMs: admitted } });
  assert.equal(refused.reason, 'foreign-paths');
  assert.deepEqual(refused.detail.foreign, [{ sha: swept, foreign: ['.starcistacks/dev/stack.yaml.enc'] }]);
  const accepted = landedProof({ placements, head: swept, pushes: false, exclude: [report], foreign: { sinceMs: admitted, accept: ['.starcistacks/dev/stack.yaml.enc'] } });
  assert.equal(accepted.ok, true);
  assert.equal(landedProof({ placements, head: swept, pushes: false, exclude: [report] }).ok, true, 'a leg admitted before the change is not judged on foreign paths');
});

test('an answered ask stays awaiting its owner-answer retry until a job of ITS work exists (mia inc-2f7968ede59c)', (t) => {
  const w = world(t);
  w.workflow('wf-ask');
  const add = (jobId, attempt, status, ownedPaths, result = null) => w.seed((l) => {
    l.enqueueJob({ jobId, workflowId: 'wf-ask', opId: 'business.decide', attempt, kind: 'op', payload: { opId: 'business.decide', owned_paths: ownedPaths } });
    l.db.prepare('UPDATE jobs SET status=?, result_json=? WHERE job_id=?').run(status, result ? JSON.stringify(result) : null, jobId);
  });
  add('op-business.decide-aaaaaaaaaa', 1, 'failed', ['.starciwork/features/account/decision/social-only-password'], { verdict: 'awaiting-owner', askDispatchId: 'ctx_ae2e07987208' });
  w.seed((l) => l.appendEvent({ workflowId: 'wf-ask', entityType: 'job', entityId: 'op-business.decide-aaaaaaaaaa', kind: 'ask-answered', payload: { dispatchId: 'ctx_ae2e07987208' } }));
  const waiting = () => json(w.api(['status', '--workflow', 'wf-ask']).stdout).awaitingOwner.map((a) => [a.jobId, a.answer]);
  assert.deepEqual(waiting(), [['op-business.decide-aaaaaaaaaa', 'answered']]);
  add('op-business.decide-bbbbbbbbbb', 2, 'queued', ['.starciwork/features/community/decision/study-day-qualifier']);
  assert.deepEqual(waiting(), [['op-business.decide-aaaaaaaaaa', 'answered']], 'an unrelated same-op job is not its retry');
  add('op-business.decide-cccccccccc', 3, 'queued', ['.starciwork/features/account/decision/social-only-password']);
  assert.deepEqual(waiting(), [], 'the owner-answer retry of its own record replaces the wait');
});

test('dispatch files the contract row before the preamble reaches the worker', (t) => {
  const w = world(t, { orca: true });
  w.workflow('wf-cf');
  const enqueue = (jobId) => w.seed((l) => {
    l.enqueueJob({ jobId: `kernel-${jobId}`, workflowId: 'wf-cf', kind: 'kernel', role: 'kernel',
      payload: { hierarchy: { schema: 'starci/agent-hierarchy@1', nodeId: 'agent:kernel:wf-cf', parentNodeId: 'workflow:wf-cf', role: 'kernel' } } });
    l.db.prepare("UPDATE jobs SET status='running',worker_id='fake-kernel-terminal' WHERE job_id=?").run(`kernel-${jobId}`);
    l.enqueueJob({ jobId, workflowId: 'wf-cf', opId: 'code.refactor', kind: 'op', payload: { opId: 'code.refactor', owned_paths: ['docs/'], model: 'codex-agent', difficulty: 'hard' } });
  });
  enqueue('op-code.refactor-cf00000001');
  const ok = w.api(['dispatch', '--job', 'op-code.refactor-cf00000001', '--model', 'codex-agent', '--spawn']);
  assert.equal(ok.status, 0, ok.stderr || ok.stdout);
  const row = w.read((db) => db.prepare("SELECT dispatch_id, context_json FROM contracts WHERE workflow_id='wf-cf' AND op_id='code.refactor' AND attempt=1").get());
  assert.equal(row.dispatch_id, json(ok.stdout).dispatchId);
  assert.ok(json(row.context_json).delivery.text, 'the running transaction re-files it with the delivered text');
  const guard = w.read((db) => json(db.prepare("SELECT payload_json FROM events WHERE kind='op-dispatched' AND entity_id='op-code.refactor-cf00000001'").get().payload_json).guard);
  assert.ok(guard?.jobFile, 'the dispatch receipt names the shared-checkout guard');
  const code = fs.readFileSync(path.join(ROOT, 'scripts', 'kernel', 'api.mjs'), 'utf8');
  const early = code.indexOf('ledger.transaction(() => fileContract(db, { job, op, dispatchId, markdown: contractMarkdown');
  assert.ok(early > 0 && early < code.indexOf('const sent = deliverPrompt({ handle, adapter, prompt: dispatched.preamble'),
    'the command-terminal dispatch commits the contract row before it delivers the preamble');
});
