// Source READ drift must have runtime-main provenance, retained in settlement evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { withLedger, seedWorkflow } from '../helpers/ledger-fixture.mjs';
import { writeContract } from '../../engine/db/ledger.mjs';
import { sha256, sha256File } from '../../engine/digest.mjs';
import { contractVersionOf } from '../../scripts/machine/contract-version.mjs';
import { recordCheck } from '../../scripts/machine/evidence-store.mjs';
import { classifyCheck } from '../../scripts/kernel/settle/job-settle.mjs';
import { observationContextOf, judgeFiledRead, observeCheck, stageObservation, mechanismObservations } from '../../scripts/kernel/mechanism-observation.mjs';
import { judgeJobProofs, recordProofJudgment } from '../../scripts/kernel/mechanism-proofs.mjs';
import { DIGEST_SCHEMA } from '../../scripts/gates/read-digest.mjs';

const LAW = 'knowledge/hfs/runtime-slots.yaml';
const put = (root, rel, bytes) => {
  const file = path.join(root, rel); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, bytes); return file;
};
function fixture(t) {
  return withLedger(t, (fx) => {
    const source = path.join(fx.root, 'runtime'); fs.mkdirSync(source);
    const git = (...args) => execFileSync('git', ['-c', 'core.autocrlf=false', ...args], { cwd: source, encoding: 'utf8', windowsHide: true }).trim();
    git('init', '-b', 'main'); git('config', 'user.name', 'READ fixture'); git('config', 'user.email', 'read@example.invalid');
    const commit = (bytes) => { put(source, LAW, bytes); git('add', '.'); git('commit', '-m', 'fixture law'); return git('rev-parse', 'HEAD'); };
    const oldRev = commit('slots: admission\n'), admittedAt = Date.now() - 1000;
    const ref = { path: LAW, root: source, absolute: path.join(source, LAW), rootKind: 'source', sha256: sha256File(path.join(source, LAW)) };
    seedWorkflow(fx.ledger, { id: 'wf-read-drift', now: admittedAt, jobs: [{ jobId: 'op-read-drift', opId: 'architecture.decide', status: 'running', dispatchId: 'read-drift-dispatch' }] });
    const job = fx.ledger.db.prepare('SELECT * FROM jobs WHERE job_id=?').get('op-read-drift');
    const attemptId = fx.ledger.db.prepare('SELECT attempt_id FROM op_attempts WHERE job_id=?').get(job.job_id).attempt_id;
    const contract = contractVersionOf(source, 'architecture.decide', { now: admittedAt });
    fx.ledger.transaction((db) => writeContract(db, { attemptId, createdAt: admittedAt, markdown: '# READ fixture', context: {
      contract, worktree: fx.repoRoot, packet: { context: { selected_op: { contract: { reads: [] } }, readRefs: [ref], owned_paths: [{ root: fx.repoRoot, path: 'src/' }] } },
    } }));
    const context = observationContextOf(fx.ledger.db, job, { repo: fx.repoRoot, skillRoot: source });
    const read = (hash = sha256File(ref.absolute)) => ({ schema: DIGEST_SCHEMA, root: fx.repoRoot, at: new Date().toISOString(), files: [{ path: LAW, role: 'knowledge', sha256: hash }] });
    return { ...fx, source, git, commit, oldRev, ref, context, attemptId, read };
  });
}

test('Source changed after admission: READ of the later runtime main revision passes with recorded drift', (t) => {
  const fx = fixture(t), revision = fx.commit('slots: later runtime\n'), digest = fx.read();
  const judged = judgeFiledRead(digest, fx.context, null, []);
  assert.equal(judged?.status, 'pass', JSON.stringify(judged));
  const sourceDrift = [{ path: LAW, admissionDigest: fx.ref.sha256, readDigest: digest.files[0].sha256, revision }];
  assert.deepEqual(judged.sourceDrift, sourceDrift);
  assert.equal(fx.context.readRefs[0].sha256, fx.ref.sha256, 'the admission acknowledgement stays factual');
  assert.equal(fx.context.admittedRuntimeSha, fx.oldRev);

  // The private child boundary supplies output; production observation and blob indexing qualify it.
  const previous = process.env.STARCI_ARTIFACT_ROOT;
  process.env.STARCI_ARTIFACT_ROOT = path.join(fx.root, 'artifacts');
  t.after(() => { if (previous === undefined) delete process.env.STARCI_ARTIFACT_ROOT; else process.env.STARCI_ARTIFACT_ROOT = previous; });
  const check = classifyCheck({ command: `starci gate read --root "${fx.repoRoot}" --knowledge ${LAW}` }, { mechanical: true });
  const run = observeCheck(check, fx.context, () => ({ processStatus: 0, processSignal: null, processError: null,
    exitCode: 0, status: 'pass', startedAt: Date.now(), finishedAt: Date.now(), output: digest }));
  const staged = stageObservation(run, [fx.repoRoot]);
  fx.ledger.transaction((db) => recordCheck(db, { attemptId: fx.attemptId, name: 'native-read', runner: 'kernel', phase: 'verify', ...staged, summary: { native: staged.native } }));
  const file = { abs: put(fx.root, 'read.json', JSON.stringify(digest)), name: 'read.json' };
  const judgment = judgeJobProofs({ op: 'architecture.decide', files: [file], context: fx.context, observations: mechanismObservations(fx.ledger.db, fx.context) });
  assert.equal(judgment.judged.status, 'pass', JSON.stringify(judgment));
  assert.deepEqual(judgment.sourceDrift, sourceDrift);
  recordProofJudgment(fx.ledger, { attemptId: fx.attemptId, judgment });
  const summary = JSON.parse(fx.ledger.db.prepare("SELECT summary_json FROM check_runs WHERE name='op-proof'").get().summary_json);
  assert.deepEqual(summary.sourceDrift, sourceDrift, 'settlement retains both digests and the carrying revision');
});

test('READ of an intermediate later main revision remains advisory after runtime advances again', (t) => {
  const fx = fixture(t), revision = fx.commit('slots: read revision\n'), digest = fx.read();
  fx.commit('slots: current revision\n');
  const judged = judgeFiledRead(digest, fx.context, null, []);
  assert.equal(judged?.status, 'pass'); assert.equal(judged.sourceDrift[0].revision, revision);
  assert.equal(judgeFiledRead(fx.read(fx.ref.sha256), fx.context, null, []), null, 'captured admission bytes still acknowledge only admission');
});

test('READ bytes matching no runtime revision refuse, even when present in the dirty runtime file', (t) => {
  const fx = fixture(t); fx.commit('slots: committed revision\n');
  put(fx.source, 'knowledge/other.yaml', 'fabricated bytes');
  fx.git('add', '.'); fx.git('commit', '-m', 'same bytes at a different Source path');
  for (const hash of [sha256('fabricated bytes'), sha256('slots: uncommitted\n')]) {
    put(fx.source, LAW, 'slots: uncommitted\n');
    assert.match(judgeFiledRead(fx.read(hash), fx.context, null, []).detail, /READ differs from its filed input/);
  }
});

test('READ of older or side-branch Source bytes cannot fabricate a later acknowledgement', (t) => {
  const fx = fixture(t);
  fx.git('checkout', '-b', 'unlanded'); const sideRev = fx.commit('slots: unlanded\n'), side = fx.read(); fx.git('checkout', 'main');
  assert.equal(judgeFiledRead(side, fx.context, null, []).status, 'red');
  fx.commit('slots: newer main\n');
  for (const admittedRuntimeSha of [null, '0'.repeat(40), sideRev]) {
    assert.equal(judgeFiledRead(fx.read(), { ...fx.context, admittedRuntimeSha }, null, []).status, 'red');
  }
  const context = { ...fx.context, admittedRuntimeSha: fx.commit('slots: admission moved\n'), readRefs: [{ ...fx.ref, sha256: sha256File(fx.ref.absolute) }] };
  assert.equal(judgeFiledRead(fx.read(fx.ref.sha256), context, null, []).status, 'red', 'an earlier main blob is no later acknowledgement');
  assert.equal(judgeFiledRead(fx.read(), { ...context, admittedRuntimeSha: null }, null, []), null, 'exact admission reads need no ancestry exemption');
});

test('product, Work, op-owned and foreign Source inputs never receive the advisory drift exemption', (t) => {
  const fx = fixture(t); fx.commit('slots: later\n'); const digest = fx.read();
  for (const ownedPaths of [[{ root: fx.source, path: 'knowledge/' }], [{ root: fx.source, path: 'knowledge/**' }], [{ abs: fx.ref.absolute, path: LAW }]]) {
    assert.equal(judgeFiledRead(digest, { ...fx.context, ownedPaths }, null, []).status, 'red');
  }
  const foreign = path.join(fx.root, 'foreign-source'); put(foreign, LAW, 'slots: admission\n');
  assert.equal(judgeFiledRead(digest, { ...fx.context, readRefs: [{ ...fx.ref, root: foreign, absolute: path.join(foreign, LAW) }] }, null, []).status, 'red');
  for (const rootKind of ['app', 'work']) {
    const rel = rootKind === 'work' ? '.starciwork/input.yaml' : 'src/input.ts';
    const absolute = put(fx.repoRoot, rel, 'admission\n'), ref = { path: rel, root: fx.repoRoot, absolute, rootKind, sha256: sha256File(absolute) };
    put(fx.repoRoot, rel, 'later\n');
    const read = { ...digest, files: [...digest.files, { path: rel, role: 'read', sha256: sha256File(absolute) }] };
    assert.equal(judgeFiledRead(read, { ...fx.context, readRefs: [...fx.context.readRefs, ref] }, null, []).status, 'red');
    read.files[1].sha256 = ref.sha256;
    assert.match(judgeFiledRead(read, { ...fx.context, readRefs: [...fx.context.readRefs, ref] }, null, []).detail, /target input changed/);
  }
});
