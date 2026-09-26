// A repo-wide gate red on a peer's change is the peer's, not this op's failure
// (scripts/kernel/gate-attribution.mjs; modules/kernel/api.yaml commands.check peerBlocked).
// nivo academy-debt's test:ci went red 812/813 on module-studio commit 9caa2d5c (inc-9474fe9ff445)
// and on module-studio's uncommitted spec (inc-36b309cb9138); academy-debt retried for both.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { FAKE_ORCA } from './helpers/fake-orca.mjs';
import { inspectLedger, ledgerFileFor, openLedger } from '../engine/ledger-db.mjs';
import { retryDisposition } from '../engine/admission.mjs';
import { attemptCauseOf } from '../scripts/kernel/lineage-route.mjs';
import { attributeRedGate, failingPath, peerRouteOf } from '../scripts/kernel/gate-attribution.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const API = path.join(ROOT, 'scripts', 'kernel', 'api.mjs');
const json = (text) => { try { return JSON.parse(text); } catch { return null; } };
const SELF = 'wf-gates-self', PEER = 'wf-gates-peer';
const DAY = 86_400_000;

const git = (repo, args, at = null) => {
  const env = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t',
    ...(at ? { GIT_AUTHOR_DATE: new Date(at).toISOString(), GIT_COMMITTER_DATE: new Date(at).toISOString() } : {}) };
  const r = spawnSync('git', ['-C', repo, ...args], { encoding: 'utf8', windowsHide: true, env });
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};
const write = (repo, rel, text) => { fs.mkdirSync(path.dirname(path.join(repo, rel)), { recursive: true }); fs.writeFileSync(path.join(repo, rel), text); };
const commit = (repo, files, message, at) => { for (const [rel, text] of Object.entries(files)) write(repo, rel, text); git(repo, ['add', '-A']); git(repo, ['commit', '-q', '-m', message], at); return git(repo, ['rev-parse', 'HEAD']); };

// A product repo two workflows share: old files committed a day before the self job began, a peer
// commit after it, a peer job holding a lease on an in-flight directory.
const fixture = (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-gate-attribution-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const repo = path.join(root, 'repo');
  fs.mkdirSync(repo, { recursive: true });
  git(repo, ['init', '-q', '-b', 'main']);
  const began = Date.now() - 3_600_000;
  commit(repo, { 'src/self/own.ts': 'a', 'src/pod/pod.controller.ts': 'a', 'src/pod/pod.controller.spec.ts': 'a', 'src/studio/studio.spec.ts': 'a', 'src/old/old.spec.ts': 'a' }, 'initial', began - DAY);
  const peerSha = commit(repo, { 'src/pod/pod.controller.ts': 'b' }, `feat(studio): verify the upload (${PEER})`, began + 60_000);
  const selfSha = commit(repo, { 'src/shared/util.ts': 'b' }, `fix(self): util (${SELF})`, began + 120_000);
  commit(repo, { 'src/leased/clean.ts': 'x' }, 'leased clean', began - DAY);
  write(repo, 'src/studio/studio.spec.ts', 'dirty');            // the peer job's uncommitted change

  const stub = path.join(root, 'fake-orca.mjs'); fs.writeFileSync(stub, FAKE_ORCA);
  const env = { ...process.env, STARCI_ORCA_COMMAND: process.execPath, STARCI_ORCA_ARGS: JSON.stringify([stub]),
    STARCI_FAKE_ORCA_LOG: path.join(root, 'calls.jsonl'), STARCI_FAKE_ORCA_STATE: path.join(root, 'state.json') };
  for (const key of ['ORCA_TERMINAL_HANDLE', 'STARCI_ROLE', 'STARCI_OP_JOB']) delete env[key];
  const api = (args) => spawnSync(process.execPath, [API, ...args, '--repo', repo, '--json'], { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 120000, env });
  const ok = (args) => { const r = api(args); assert.equal(r.status, 0, `${args.join(' ')}: ${r.stderr || r.stdout}`); return json(r.stdout) ?? json(r.stdout.trim().split('\n').at(-1)); };
  const seed = (fn) => { const l = openLedger({ file: ledgerFileFor(repo) }); try { return fn(l); } finally { l.close(); } };
  const read = (fn) => { const l = inspectLedger({ file: ledgerFileFor(repo) }); try { return fn(l.db); } finally { l.close(); } };
  seed((l) => {
    for (const wf of [SELF, PEER]) {
      l.ensureWorkflow({ workflowId: wf, title: wf, ledgerMode: 'durable', sourceRoots: [repo] });
      l.db.prepare("UPDATE workflows SET phase='running' WHERE workflow_id=?").run(wf);
    }
    const job = (jobId, wf, owned, outcome, at) => {
      const dispatchId = `ctx-${jobId}`;
      l.db.prepare("INSERT INTO jobs(job_id,workflow_id,op_id,attempt,generation,kind,role,payload_json,status,worker_id,lease_token,created_at,updated_at) VALUES(?,?,?,1,0,'op','op',?,'running',?,'t',?,?)")
        .run(jobId, wf, 'backend.implement', JSON.stringify({ opId: 'backend.implement', owned_paths: owned, managed: { dispatchId } }), dispatchId, at, at);
      l.db.prepare('INSERT INTO contracts(workflow_id,op_id,attempt,dispatch_id,markdown,context_json,created_at) VALUES(?,?,1,?,?,?,?)').run(wf, 'backend.implement', dispatchId, '# contract', '{}', at);
      const report = { schema: 'starci/op-report@1', outcome, summary: 'scoped gates green; repo-wide test:ci red outside the slice',
        ...(outcome === 'blocked' ? { blocker: { kind: 'shared-change', detail: 'test:ci red on a peer change' } } : {}) };
      l.db.prepare('INSERT INTO reports(workflow_id,dispatch_id,op_id,attempt,generation,outcome,report_json,consumed_at,created_at) VALUES(?,?,?,1,0,?,?,?,?)')
        .run(wf, dispatchId, 'backend.implement', outcome, JSON.stringify(report), at, at);
    };
    job('job-self', SELF, ['src/self'], 'blocked', began);
    job('job-peer', PEER, ['src/studio', 'src/leased'], 'done', began);
    for (const p of ['src/studio', 'src/leased']) {
      l.db.prepare("INSERT INTO leases(resource_key,job_id,workflow_id,op_id,attempt,generation,token,units,acquired_at,expires_at) VALUES(?,?,?,?,1,0,'t',1,?,?)")
        .run(`path:${p}`, 'job-peer', PEER, 'backend.implement', began, Date.now() + DAY);
    }
  });
  return { repo, api, ok, seed, read, peerSha, selfSha };
};

test('failing paths are read as the gate prints them', () => {
  assert.equal(failingPath('src\\pod\\pod.controller.spec.ts:123', null), 'src/pod/pod.controller.spec.ts');
  assert.equal(failingPath('src/a.ts:12:7', null), 'src/a.ts');
  assert.equal(failingPath(path.join(os.tmpdir(), 'r', 'src', 'b.ts'), path.join(os.tmpdir(), 'r')), 'src/b.ts');
  assert.equal(failingPath('', null), null);
});

test('each implicated file is own, a peer\'s commit, a peer\'s in-flight change or unknown', (t) => {
  const fx = fixture(t);
  fx.read((db) => {
    const job = db.prepare("SELECT * FROM jobs WHERE job_id='job-self'").get();
    const at = (failing) => attributeRedGate(db, { repo: fx.repo, job, failing });

    // inc-9474fe9ff445: the spec is old, the controller it tests changed in a peer's commit.
    const landed = at(['src/pod/pod.controller.spec.ts:123', 'src/pod/pod.controller.ts']);
    assert.equal(landed.class, 'peer');
    assert.deepEqual(landed.files.map((f) => f.owner), ['unknown', 'peer']);
    assert.deepEqual(landed.peers, [{ workflowId: PEER, via: 'commit', commit: fx.peerSha, files: ['src/pod/pod.controller.ts'] }]);
    assert.match(peerRouteOf(SELF, landed.peers[0], 'test:ci'), new RegExp(`--kind shared-blocker --introduced-by ${fx.peerSha}`));

    // inc-36b309cb9138: the spec is dirty under the peer job's lease.
    const inFlight = at(['src/studio/studio.spec.ts']);
    assert.equal(inFlight.class, 'peer');
    assert.deepEqual(inFlight.peers, [{ workflowId: PEER, via: 'lease', jobId: 'job-peer', files: ['src/studio/studio.spec.ts'] }]);
    assert.match(peerRouteOf(SELF, inFlight.peers[0], 'test:ci'), /--kind peer-wait --peer wf-gates-peer --until-job job-peer:succeeded/);

    // Any file of this op's own slice, or its own workflow's commit, makes the red its own.
    assert.equal(at(['src/pod/pod.controller.ts', 'src/self/own.ts']).class, 'own');
    assert.equal(at(['src/shared/util.ts']).class, 'own');
    assert.equal(at(['src/shared/util.ts']).files[0].commit, fx.selfSha);
    // A leased but clean file is not the peer's change; an old untouched file is nobody's.
    assert.equal(at(['src/leased/clean.ts']).class, 'unknown');
    assert.equal(at(['src/old/old.spec.ts']).class, 'unknown');
    // A git read that fails never blames a peer.
    assert.equal(attributeRedGate(db, { repo: fx.repo, job, failing: ['src/studio/studio.spec.ts', 'src/pod/pod.controller.ts'], git: () => ({ ok: false, stdout: '' }) }).class, 'unknown');
  });
});

test('api check records a peer-attributed red gate peerBlocked; settle spends no business attempt on it', (t) => {
  const fx = fixture(t);
  const checks = JSON.stringify({ checks: [
    { name: 'container', exitCode: 0, command: 'npm run test:container' },
    { name: 'test:ci', exitCode: 1, command: 'npm run test:ci', failing: ['src/pod/pod.controller.spec.ts:123', 'src/pod/pod.controller.ts'] },
  ] });
  const recorded = fx.ok(['check', '--job', 'job-self', '--checks', checks]);
  assert.deepEqual(recorded.checkEvidence, { observed: 2, passed: 1, failed: 0, green: true, peerBlocked: 1 });
  assert.deepEqual(recorded.peerBlocked.map((c) => c.name), ['test:ci']);
  assert.equal(recorded.peerBlocked[0].peers[0].commit, fx.peerSha);

  // A caller-supplied peerBlocked is dropped: only the api attributes.
  const forged = fx.ok(['check', '--job', 'job-self', '--checks', JSON.stringify({ checks: [
    { name: 'container', exitCode: 0 },
    { name: 'test:ci', exitCode: 1, peerBlocked: { peers: [] }, failing: ['src/self/own.ts'] },
  ] })]);
  assert.deepEqual(forged.checkEvidence, { observed: 2, passed: 1, failed: 1, green: false });
  assert.equal(fx.read((db) => JSON.parse(db.prepare("SELECT checks_json FROM checks WHERE op_id='backend.implement'").get().checks_json)).checks[1].attribution.class, 'own');

  fx.ok(['check', '--job', 'job-self', '--checks', checks]);
  const settled = fx.ok(['settle', '--job', 'job-self', '--verdict', 'blocked']);
  assert.deepEqual(settled.peerBlocked.checks, ['test:ci']);
  assert.match(settled.peerBlocked.routes[0], /--kind shared-blocker --introduced-by/);
  const row = fx.read((db) => db.prepare("SELECT * FROM jobs WHERE job_id='job-self'").get());
  assert.deepEqual(retryDisposition(row), { retryClass: 'peer-blocked', effectState: 'unknown', resumable: false, consumesBusinessRetry: false });
  fx.read((db) => assert.equal(attemptCauseOf(db, { ...row, status: 'failed', result_json: JSON.stringify({ ...JSON.parse(row.result_json), verdict: 'fail' }) }).cause, 'peer-blocked'));
});

test('retry accounting: peer-blocked is free only off a pass and only when the api recorded it', () => {
  const job = (result) => ({ job_id: 'j', attempt: 1, result_json: JSON.stringify(result) });
  assert.equal(retryDisposition(job({ verdict: 'fail', peerBlocked: { checks: ['test:ci'] } })).consumesBusinessRetry, false);
  assert.equal(retryDisposition(job({ verdict: 'fail' })).consumesBusinessRetry, true);
  assert.equal(retryDisposition(job({ verdict: 'blocked', peerBlocked: { checks: ['test:ci'] } })).retryClass, 'peer-blocked');
});
