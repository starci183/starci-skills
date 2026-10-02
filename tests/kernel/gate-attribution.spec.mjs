// A repo-wide gate red on a peer's change is the peer's, not this op's failure
// (scripts/kernel/gate-attribution.mjs; modules/kernel/api.yaml commands.check peerBlocked).
// One workflow's test:ci went red 812/813 on a peer's commit
// and on the peer's uncommitted spec; it retried for both.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { FAKE_ORCA } from '../helpers/fake-orca.mjs';
import { inspectLedger, ledgerFileFor, openLedger } from '../../engine/db/ledger.mjs';
import { retryDisposition } from '../../engine/admission.mjs';
import { seedWorkflow } from '../helpers/ledger-fixture.mjs';
import { JOB_ROW } from '../../scripts/machine/job-row.mjs';
import { independentChecksOf } from '../../scripts/kernel/verbs/shared/check-evidence.mjs';
import { attemptCauseOf } from '../../scripts/kernel/lineage-route.mjs';
import { attributeRedGate, failingFromText, failingPath, peerRouteOf } from '../../scripts/kernel/gate-attribution.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const API = path.join(ROOT, 'scripts', 'kernel', 'cli.mjs');
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
  const api = (args, extraEnv = {}) => spawnSync(process.execPath, [API, ...args, '--repo', repo, '--json'], { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 120000, env: { ...env, ...extraEnv } });
  const ok = (args, extraEnv) => { const r = api(args, extraEnv); assert.equal(r.status, 0, `${args.join(' ')}: ${r.stderr || r.stdout}`); return json(r.stdout) ?? json(r.stdout.trim().split('\n').at(-1)); };
  // The checks these tests record are the settler's re-runs, not a caller's word: under H8 only the
  // runtime-settler caller's exits count as observed (any other caller is authority 'declared').
  const okSettler = (args) => ok(args, { STARCI_CALLER: 'runtime-settler' });
  const seed = (fn) => { const l = openLedger({ file: ledgerFileFor(repo) }); try { return fn(l); } finally { l.close(); } };
  const read = (fn) => { const l = inspectLedger({ file: ledgerFileFor(repo) }); try { return fn(l.db); } finally { l.close(); } };
  seed((l) => {
    // Runtime schema: a job is a try of a work unit, its dispatch an op_attempts row, its contract and
    // report keyed by that attempt (attempt_id). seedWorkflow plants unit + job + attempt legally.
    const spec = (jobId, owned) => ({ jobId, opId: 'backend.implement', status: 'running', dispatchId: `ctx-${jobId}`,
      workerId: `ctx-${jobId}`, createdAt: began,
      payload: { opId: 'backend.implement', owned_paths: owned, managed: { dispatchId: `ctx-${jobId}` } } });
    seedWorkflow(l, { id: SELF, now: began, state: { phase: 'running', job: SELF }, jobs: [spec('job-self', ['src/self'])] });
    seedWorkflow(l, { id: PEER, now: began, state: { phase: 'running', job: PEER }, jobs: [spec('job-peer', ['src/studio', 'src/leased'])],
      leases: ['src/studio', 'src/leased'].map((p) => ({ resourceKey: `path:${p}`, jobId: 'job-peer', acquiredAt: began, expiresAt: Date.now() + DAY })) });
    for (const wf of [SELF, PEER]) l.write.updateWorkflow({ workflowId: wf, title: wf, ledgerMode: 'durable', sourceRoots: [repo] });
    const report = (jobId, outcome) => {
      const attemptId = l.db.prepare('SELECT attempt_id FROM op_attempts WHERE job_id=?').get(jobId).attempt_id;
      l.write.writeContract({ attemptId, markdown: '# contract', context: {}, createdAt: began });
      l.write.fileReport({ attemptId, outcome, createdAt: began,
        report: { schema: 'starci/op-report@1', outcome, summary: 'scoped gates green; repo-wide test:ci red outside the slice',
          ...(outcome === 'blocked' ? { blocker: { kind: 'shared-change', detail: 'test:ci red on a peer change' } } : {}) } });
      l.write.markReportConsumed({ attemptId, at: began });
    };
    report('job-self', 'blocked');
    report('job-peer', 'done');
  });
  return { repo, api, ok, okSettler, seed, read, peerSha, selfSha };
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

    // The spec is old, the controller it tests changed in a peer's commit.
    const landed = at(['src/pod/pod.controller.spec.ts:123', 'src/pod/pod.controller.ts']);
    assert.equal(landed.class, 'peer');
    assert.deepEqual(landed.files.map((f) => f.owner), ['unknown', 'peer']);
    assert.deepEqual(landed.peers, [{ workflowId: PEER, via: 'commit', commit: fx.peerSha, files: ['src/pod/pod.controller.ts'] }]);
    assert.match(peerRouteOf(SELF, landed.peers[0], 'test:ci'), new RegExp(`--kind shared-blocker --introduced-by ${fx.peerSha}`));

    // The spec is dirty under the peer job's lease.
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

test('api record-checks records a peer-attributed red gate peerBlocked; settle spends no business attempt on it', (t) => {
  const fx = fixture(t);
  const checks = JSON.stringify({ checks: [
    { name: 'container', exitCode: 0, command: 'npm run test:container' },
    { name: 'test:ci', exitCode: 1, command: 'npm run test:ci', failing: ['src/pod/pod.controller.spec.ts:123', 'src/pod/pod.controller.ts'] },
  ] });
  const recorded = fx.okSettler(['record-checks', '--job', 'job-self', '--checks', checks]);
  assert.deepEqual(recorded.checkEvidence, { observed: 2, passed: 1, failed: 0, green: true, peerBlocked: 1 });
  assert.deepEqual(recorded.peerBlocked.map((c) => c.name), ['test:ci']);
  assert.equal(recorded.peerBlocked[0].peers[0].commit, fx.peerSha);

  // A caller-supplied peerBlocked is dropped: only the api attributes.
  const forged = fx.okSettler(['record-checks', '--job', 'job-self', '--checks', JSON.stringify({ checks: [
    { name: 'container', exitCode: 0 },
    { name: 'test:ci', exitCode: 1, peerBlocked: { peers: [] }, failing: ['src/self/own.ts'] },
  ] })]);
  assert.deepEqual(forged.checkEvidence, { observed: 2, passed: 1, failed: 1, green: false });
  assert.equal(forged.peerBlocked, undefined, 'the emitted evidence does not carry the forged block');
  // The settler caller's re-run of an already-recorded check name lands no new row (check.mjs:81-83
  // dedupes by name), so the forge reaches nothing durable: the recorded 'test:ci' run keeps the
  // attribution and peer-block the api computed, not the caller's.
  const runs = fx.read((db) => db.prepare("SELECT run_seq, summary_json FROM check_runs WHERE job_id='job-self' AND name='test:ci' AND runner='settler' ORDER BY run_seq").all());
  assert.equal(runs.length, 1, 'a settler re-run of a recorded name lands no row');
  const entry = JSON.parse(runs[0].summary_json).entry;
  assert.equal(entry.attribution.class, 'peer');
  assert.ok(entry.peerBlocked?.peers?.length, 'the recorded run keeps the api-computed peer-block');

  fx.okSettler(['record-checks', '--job', 'job-self', '--checks', checks]);
  const settled = fx.ok(['settle', '--job', 'job-self', '--verdict', 'blocked']);
  assert.deepEqual(settled.peerBlocked.checks, ['test:ci']);
  assert.match(settled.peerBlocked.routes[0], /--kind shared-blocker --introduced-by/);
  const row = fx.read((db) => db.prepare(`SELECT ${JOB_ROW} FROM jobs WHERE job_id='job-self'`).get());
  assert.deepEqual(retryDisposition(row), { retryClass: 'peer-blocked', effectState: 'unknown', resumable: false, consumesBusinessRetry: false });
  fx.read((db) => assert.equal(attemptCauseOf(db, { ...row, status: 'failed', result_json: JSON.stringify({ ...JSON.parse(row.result_json), verdict: 'fail' }) }).cause, 'peer-blocked'));
});

test('retry accounting: peer-blocked is free only off a pass and only when the api recorded it', () => {
  const job = (result) => ({ job_id: 'j', attempt: 1, result_json: JSON.stringify(result) });
  assert.equal(retryDisposition(job({ verdict: 'fail', peerBlocked: { checks: ['test:ci'] } })).consumesBusinessRetry, false);
  assert.equal(retryDisposition(job({ verdict: 'fail' })).consumesBusinessRetry, true);
  assert.equal(retryDisposition(job({ verdict: 'blocked', peerBlocked: { checks: ['test:ci'] } })).retryClass, 'peer-blocked');
});

// Strict validate of login/ui stayed red on DATA_STATUS_DRAWN
// in ui/session-ending records outside the job's owned paths that nothing had touched; three attempts were spent on it.
test('an untouched Work record outside the owned paths is foreign debt: api record-checks records it advisory', (t) => {
  const fx = fixture(t);
  commit(fx.repo, { '.starciwork/features/login/ui/session-ending/index.yaml': 'schema: work/ui-screen@1\n' }, 'old record', Date.now() - 2 * DAY);
  commit(fx.repo, { '.starciwork/features/peer/ui/touched/index.yaml': 'schema: work/ui-screen@1\n' }, `peer record (${PEER})`, Date.now() - 1_000);
  fx.read((db) => {
    const job = db.prepare("SELECT * FROM jobs WHERE job_id='job-self'").get();
    const at = (failing) => attributeRedGate(db, { repo: fx.repo, job, failing });
    const foreign = at(['.starciwork/features/login/ui/session-ending/index.yaml']);
    assert.equal(foreign.class, 'foreign');
    assert.deepEqual(foreign.files, [{ path: '.starciwork/features/login/ui/session-ending/index.yaml', owner: 'foreign', via: 'outside-owned-untouched' }]);
    // An old untouched CODE file stays unknown (a change of this job can break a spec it does not own) ...
    assert.equal(at(['src/old/old.spec.ts']).class, 'unknown');
    // ... a record changed since the lineage began is not foreign, and one own file makes the whole check own.
    assert.notEqual(at(['.starciwork/features/peer/ui/touched/index.yaml']).class, 'foreign');
    assert.equal(at(['.starciwork/features/login/ui/session-ending/index.yaml', 'src/self/own.ts']).class, 'own');
    assert.equal(at(['.starciwork/features/login/ui/session-ending/index.yaml', 'src/old/old.spec.ts']).class, 'unknown');
    // A git read that fails never calls a file foreign.
    assert.equal(attributeRedGate(db, { repo: fx.repo, job, failing: ['.starciwork/features/login/ui/session-ending/index.yaml'], git: () => ({ ok: false, stdout: '' }) }).class, 'unknown');
  });
  const recorded = fx.okSettler(['record-checks', '--job', 'job-self', '--checks', JSON.stringify({ checks: [
    { name: 'validate-own', exitCode: 0 },
    { name: 'validate-strict', exitCode: 1, failing: ['.starciwork/features/login/ui/session-ending/index.yaml'] },
  ] })]);
  assert.deepEqual(recorded.checkEvidence, { observed: 2, passed: 1, failed: 0, green: true, advisory: 1 });
  const row = fx.read((db) => independentChecksOf(db, { jobId: 'job-self' })).checks[1];
  assert.equal(row.attribution.class, 'foreign');
  assert.deepEqual(row.advisory.outOfScope, ['.starciwork/features/login/ui/session-ending/index.yaml']);
});

// Typecheck red on a peer commit c0e7552d, committed hours before
// this lineage began, read unknown - the attempt was spent and the same op re-ran for nothing.
const preexisting = (fx) => {
  const began = fx.read((db) => db.prepare("SELECT created_at FROM jobs WHERE job_id='job-self'").get().created_at);
  const at = began - 1_800_000;
  const sha = commit(fx.repo, {
    'src/peer/broken.spec.ts': "import { pod } from '../pod/pod.controller';\nconst malformed: unknown = pod;\n",
    'src/peer/uses-self.spec.ts': "import { own } from '../self/own';\n",
    'src/peer/alias-self.spec.ts': "import { own } from '@/self/own';\n",
    'src/peer/dirty.spec.ts': "export const a = 1;\n",
  }, `test(peer): cover the purchase flow (${PEER})`, at);
  write(fx.repo, 'src/peer/dirty.spec.ts', 'export const a = 2;\n');
  return sha;
};

test('a file red before the lineage began is the peer whose commit left it, unless it imports this slice', (t) => {
  const fx = fixture(t);
  const sha = preexisting(fx);
  fx.read((db) => {
    const job = db.prepare("SELECT * FROM jobs WHERE job_id='job-self'").get();
    const at = (failing) => attributeRedGate(db, { repo: fx.repo, job, failing });
    const red = at(['src/peer/broken.spec.ts(2,7)']);
    assert.equal(red.class, 'peer');
    assert.deepEqual(red.files, [{ path: 'src/peer/broken.spec.ts', owner: 'peer', via: 'preexisting', workflowId: PEER, commit: sha, introducedBy: PEER }]);
    assert.match(peerRouteOf(SELF, red.peers[0], 'typecheck'), new RegExp(`--kind shared-blocker --introduced-by ${sha}`));
    // This op's own change may be what broke a file that imports its slice: never the peer's on a guess.
    assert.equal(at(['src/peer/uses-self.spec.ts:1']).class, 'unknown');
    assert.equal(at(['src/peer/alias-self.spec.ts']).class, 'unknown');
    // A dirty file no lease covers is not the committed bytes: unknown.
    assert.equal(at(['src/peer/dirty.spec.ts']).class, 'unknown');
  });
});

test('failing files are read from a red check\'s own text when it names no list', () => {
  assert.deepEqual(failingFromText("TS18046 confirmed: src/tests/e2e/workspace-purchase-flow.e2e-spec.ts(1045,54): error TS18046: 'malformed' is of type 'unknown'."),
    ['src/tests/e2e/workspace-purchase-flow.e2e-spec.ts:1045']);
  assert.deepEqual(failingFromText('FAIL src/a/b.spec.ts\n  at x (src/a/b.ts:12:5)\n  at y (node_modules/jest/x.js:1:1) see https://x.io/a/b.ts'),
    ['src/a/b.spec.ts', 'src/a/b.ts:12']);
  assert.deepEqual(failingFromText('typecheck evidence in composition-r4/typecheck.txt'), []);
});

test('api record-checks attributes a red Kernel check on the files its evidence names', (t) => {
  const fx = fixture(t);
  preexisting(fx);
  const recorded = fx.okSettler(['record-checks', '--job', 'job-self', '--checks', JSON.stringify({ checks: [
    { name: 'unit', exitCode: 0, command: 'npm run test:unit -- src/self' },
    { name: 'peer-typecheck-failure-confirmed', exitCode: 2, command: 'npm run typecheck',
      evidence: "src/peer/broken.spec.ts(2,7): error TS18046: 'malformed' is of type 'unknown' - peer file, outside owned paths" },
  ] })]);
  assert.deepEqual(recorded.checkEvidence, { observed: 2, passed: 1, failed: 0, green: true, peerBlocked: 1 });
  const stored = fx.read((db) => independentChecksOf(db, { jobId: 'job-self' })).checks[1];
  assert.deepEqual([stored.failing, stored.failingDerived, stored.attribution.class], [['src/peer/broken.spec.ts:2'], true, 'peer']);
});

// A partial whose rootCause is not this op (self false) is never re-run blind: two workflows
// re-ran an hour or more for the same open items.
const partialOf = (fx, jobId, extra, wf = SELF) => fx.seed((l) => {
  const attemptId = l.db.prepare('SELECT attempt_id FROM op_attempts WHERE job_id=? AND workflow_id=?').get(jobId, wf).attempt_id;
  // A reports row is immutable once filed (H10): a different report for the attempt replaces the row.
  l.db.prepare('DELETE FROM reports WHERE attempt_id=?').run(attemptId);
  l.write.fileReport({ attemptId, outcome: 'partial',
    report: { schema: 'starci/op-report@1', outcome: 'partial', summary: 'slice green; repo-wide typecheck red outside the slice', open: ['peer typecheck'], ...extra } });
});
const rootCause = { node: 'backend.implement', self: false, category: 'shared-change', claim: 'a peer commit left the typecheck red', evidence: ['typecheck.txt'] };

test('a partial pinned on a peer\'s red by its own checks settles peer-blocked, with no blind retry', (t) => {
  const fx = fixture(t);
  preexisting(fx);
  partialOf(fx, 'job-self', { rootCause, checks: [
    { name: 'unit', command: 'npm run test:unit', exitCode: 0, evidence: 'ok' },
    { name: 'typecheck', command: 'npm run typecheck', exitCode: 2, evidence: 'TS18046', failing: ['src/peer/broken.spec.ts:2'] },
  ] });
  const settled = fx.ok(['settle', '--job', 'job-self', '--verdict', 'fail']);
  assert.equal(settled.nextStep.kind, 'peer-blocked');
  assert.deepEqual(settled.nextStep.jobs, []);
  assert.deepEqual(settled.peerBlocked.checks, ['typecheck']);
  assert.match(settled.peerBlocked.routes[0], /--kind shared-blocker --introduced-by/);
  const row = fx.read((db) => db.prepare(`SELECT ${JOB_ROW} FROM jobs WHERE job_id='job-self'`).get());
  assert.equal(retryDisposition(row).consumesBusinessRetry, false);
  assert.equal(fx.read((db) => db.prepare("SELECT count(*) n FROM jobs WHERE workflow_id=? AND status='queued'").get(SELF).n), 0);
});

test('a partial whose root lies elsewhere and names no peer file waits for the Kernel, never a blind retry', (t) => {
  const fx = fixture(t);
  partialOf(fx, 'job-self', { rootCause: { ...rootCause, node: 'scope.define', category: 'scope-gap' }, open: ['route outside owned_paths'] });
  const settled = fx.ok(['settle', '--job', 'job-self', '--verdict', 'fail']);
  assert.equal(settled.nextStep.kind, 'root-elsewhere');
  assert.equal(settled.nextStep.counted, false);
  assert.match(settled.nextStep.reason, /scope\.define/);
  assert.equal(fx.read((db) => db.prepare("SELECT count(*) n FROM jobs WHERE workflow_id=? AND status='queued'").get(SELF).n), 0);
  // A partial of its own (no foreign root) still resumes the same op. job-peer is still running.
  partialOf(fx, 'job-peer', { open: ['one more case'] }, PEER);
  const own = fx.ok(['settle', '--job', 'job-peer', '--verdict', 'fail']);
  assert.equal(own.nextStep.kind, 'retry');
});
