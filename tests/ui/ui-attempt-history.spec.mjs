import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { withLedger, seedWorkflow } from '../helpers/ledger-fixture.mjs';
import { openLedgerReader, recordCheckRun, recordArtifact, startAttempt, storeBlob } from '../../engine/db/ledger.mjs';
import { openMachineReader } from '../../engine/db/machine.mjs';
import { checkObservation, checkPairsOf } from '../../ui/api/attempt-read.mjs';
import { handleAttempt } from '../../ui/api/routes/attempt.mjs';
import { attemptProducts } from '../../ui/api/products.mjs';
import { workflowCheckpoint } from '../../ui/api/land-read.mjs';

const at = 1_800_000_000_000;
function storeOf(fixture) {
  const machine = fixture.track(openMachineReader({ file: fixture.machineFile }));
  const db = fixture.track(openLedgerReader(fixture.ledgerFile));
  const row = { name: 'fixture', ledgerId: 'fixture-ledger', repoRoot: fixture.repoRoot, file: fixture.ledgerFile };
  return { machine, stale: new Set(), projects: () => [row], ledger: project => [row.name, row.ledgerId].includes(project) ? { row, db } : null,
    forEachLedger: fn => [{ result: fn({ row, db }) }] };
}
async function request(store, pathname) {
  const response = { headers: {}, status: null, body: null, setHeader(key, value) { this.headers[key] = value; },
    writeHead(status) { this.status = status; }, end(body) { this.body = body ?? null; } };
  await handleAttempt({ method: 'GET', headers: {} }, response, store, new URL(pathname, 'http://fixture'));
  return { status: response.status, ...JSON.parse(response.body) };
}
function contract(db, context) {
  db.prepare('INSERT INTO contracts(attempt_id,workflow_id,job_id,contract_rev,markdown,context_json,created_at) VALUES(?,?,?,?,?,?,?)')
    .run(1, 'wf', 'job', 'contract-a', 'captured prompt', JSON.stringify(context), at);
}
function blobsIn(t, fixture) {
  const previous = process.env.STARCI_ARTIFACT_ROOT;
  process.env.STARCI_ARTIFACT_ROOT = path.join(fixture.root, 'artifacts');
  t.after(() => previous == null ? delete process.env.STARCI_ARTIFACT_ROOT : process.env.STARCI_ARTIFACT_ROOT = previous);
}

test('old dispatch reads its captured packet and launch identity after the current job changes', t => withLedger(t, async fixture => {
  seedWorkflow(fixture.ledger, { id: 'wf', jobs: [{ jobId: 'job', opId: 'backend.implement', status: 'running', payload: {
    title: 'new assignment', owned_paths: ['new/path'], goal_binding: { revision: 9, identity: 'new-goal' }, hierarchy: { runtime: { runId: 'new-run' } } } }] });
  fixture.ledger.transaction(db => {
    contract(db, { contract: { runtimeSha: 'a'.repeat(40) }, packet: { op: 'backend.implement', brief: 'modules/ops/ops/backend.implement.yaml',
      context: { title: 'captured assignment', records: [], owned_paths: [{ path: 'old/path', root: fixture.repoRoot }],
        workflow: { id: 'wf', goal_revision: 2, goal_identity: 'old-goal' }, goal: { revision: 2, statement: 'captured goal' } }, constraints: { model: 'captured-profile' } },
      hierarchy: { nodeId: 'captured-node', parentNodeId: 'captured-parent', runtime: { runId: 'captured-run' } } });
    db.prepare('UPDATE op_attempts SET repo_root=?,request_model=?,model=?,attested_at=NULL WHERE attempt_id=1').run(fixture.repoRoot, 'requested', 'not-attested');
  });
  const store = storeOf(fixture), result = await request(store, '/api/attempts/fixture/1');
  assert.equal(result.status, 200);
  const detail = result.data;
  assert.equal(detail.ledgerId, 'fixture-ledger');
  assert.equal(detail.input.what, 'captured assignment');
  assert.deepEqual(detail.input.ownedPaths, ['old/path']);
  assert.equal(detail.where.runId, 'captured-run');
  assert.equal(detail.where.agentNode, 'captured-node');
  assert.equal(detail.currentInput.what, 'new assignment');
  assert.equal(detail.capturedGoal.revision, 2);
  assert.equal(detail.capturedGoal.text, 'captured goal');
  assert.equal(detail.dispatchContext.contractRev, 'contract-a');
  assert.equal(detail.modelAuthority, 'unobserved');
  assert.equal(detail.requestedModel, 'requested');
  assert.equal(detail.where.mainCheckout, null);
  assert.equal(store.ledger('fixture').db.prepare('SELECT total_changes() AS n').get().n, 0);
  assert.equal(store.machine.db.prepare('SELECT total_changes() AS n').get().n, 0);
}));

test('missing dispatch capture never backfills current job scope or goal', t => withLedger(t, async fixture => {
  seedWorkflow(fixture.ledger, { id: 'wf', jobs: [{ jobId: 'job', status: 'running', payload: { title: 'current', owned_paths: ['current/path'] } }] });
  const result = (await request(storeOf(fixture), '/api/attempts/fixture/1')).data;
  assert.equal(result.input, null);
  assert.equal(result.dispatchContext, null);
  assert.equal(result.capturedGoal, null);
  assert.equal(result.where.scopeSource, 'unobserved');
  assert.deepEqual(result.where.ownedPaths, []);
  assert.equal(result.currentInput.what, 'current');
}));

test('latest check selection keeps runner, authority and phase collisions distinct and uses canonical unavailable semantics', () => {
  const row = fields => ({ id: 1, name: 'same', phase: 'after', runner: 'kernel', authority: 'runtime', runSeq: 1, status: 'pass', exitCode: 0, ...fields });
  const pairs = checkPairsOf([row({}), row({ id: 2, runSeq: 2, status: 'fail', exitCode: 1 }), row({ id: 3, phase: 'before' }),
    row({ id: 4, runner: 'settler' }), row({ id: 5, runner: 'op', authority: 'declared' })]);
  assert.equal(pairs.length, 4);
  assert.equal(pairs.find(pair => pair.runner === 'kernel' && pair.phase === 'after').runtime.id, 2);
  assert.equal(new Set(pairs.map(pair => pair.key)).size, 4);
  assert.equal(checkObservation(row({ status: 'error', exitCode: 0 })), 'unavailable');
  assert.equal(checkObservation(row({ exitCode: 127 })), 'unavailable');
  assert.equal(checkObservation(row({ status: 'skipped' })), 'skipped');
  assert.equal(checkObservation(row({ exitCode: null })), 'unknown');
  assert.equal(checkObservation(row({ authority: 'declared' })), 'unknown');
});

test('artifact names cannot bind a check; exact output SHA can, and malformed manifests stay explicit', t => withLedger(t, async fixture => {
  blobsIn(t, fixture);
  seedWorkflow(fixture.ledger, { id: 'wf', jobs: [{ jobId: 'job', status: 'running' }] });
  let boundId;
  fixture.ledger.transaction(db => {
    const output = storeBlob(db, { content: Buffer.from('measured output'), mediaType: 'text/plain', createdAt: at });
    const foreign = storeBlob(db, { content: Buffer.from('different output'), mediaType: 'text/plain', createdAt: at });
    const invalid = storeBlob(db, { content: Buffer.from('['), mediaType: 'application/yaml', createdAt: at });
    boundId = recordCheckRun(db, { attemptId: 1, name: 'same', phase: 'verify', runner: 'kernel', status: 'pass', exitCode: 0, outputSha: output.sha256, createdAt: at }).check_id;
    recordArtifact(db, { attemptId: 1, name: 'checks/same/output.txt', sha256: foreign.sha256, role: 'check-output', kind: 'file', createdAt: at });
    recordArtifact(db, { attemptId: 1, name: 'checks/different/output.txt', sha256: output.sha256, role: 'check-output', kind: 'file', createdAt: at });
    recordArtifact(db, { attemptId: 1, name: 'attachments/evidence/manifest.yaml', sha256: invalid.sha256, role: 'report-attachment', kind: 'file', createdAt: at });
  });
  const detail = (await request(storeOf(fixture), '/api/attempts/fixture/1')).data;
  assert.equal(detail.files.find(file => file.name === 'checks/same/output.txt').check.id, null);
  assert.equal(detail.files.find(file => file.name === 'checks/same/output.txt').check.binding, 'unbound');
  assert.equal(detail.files.find(file => file.name === 'checks/different/output.txt').check.id, boundId);
  assert.equal(detail.manifest, null);
  assert.equal(detail.manifestRead.state, 'invalid');
  assert.equal(detail.checks[0].cwd, null);
}));

test('final transcript uses recorded blob time and rejects a snapshot from another attempt', t => withLedger(t, async fixture => {
  blobsIn(t, fixture);
  seedWorkflow(fixture.ledger, { id: 'wf', jobs: [{ jobId: 'job', status: 'running' }] });
  fixture.ledger.transaction(db => {
    const blob = storeBlob(db, { content: Buffer.from('recorded scrollback\n'), mediaType: 'text/plain', redaction: 'v1', createdAt: at - 10 });
    db.prepare('UPDATE op_attempts SET transcript_sha=? WHERE attempt_id=1').run(blob.sha256);
  });
  const store = storeOf(fixture), result = await request(store, '/api/attempts/fixture/1/transcript');
  assert.equal(result.data.at, at - 10);
  assert.equal(result.data.timeSource, 'blob');
  assert.equal(result.data.final, true);
  assert.equal((await request(store, '/api/attempts/fixture/1/transcript?snapshot=999')).status, 404);
}));

test('numeric unit subjects do not become exact Attempt decisions', t => withLedger(t, async fixture => {
  seedWorkflow(fixture.ledger, { id: 'wf', jobs: [{ jobId: 'job', status: 'running' }] });
  fixture.ledger.transaction(db => {
    for (const [id, type, subject] of [['unit-decision', 'unit', '1'], ['attempt-decision', 'attempt', '1'], ['job-decision', 'job', 'job']]) {
      db.prepare('INSERT INTO decisions(decision_id,workflow_id,span_id,decider,subject_type,subject_id,choice,decided_at) VALUES(?,?,?,?,?,?,?,?)')
        .run(id, 'wf', '0123456789abcdef', 'kernel:wf', type, subject, 'recorded choice', at);
    }
  });
  const decisions = (await request(storeOf(fixture), '/api/attempts/fixture/1')).data.decisions;
  assert.equal(decisions.length, 2);
  assert.equal(decisions.find(row => row.id === 'attempt-decision').association, 'attempt');
  assert.equal(decisions.find(row => row.id === 'job-decision').association, 'job');
}));

test('Products reads checkpoint content ahead of report-tested head and reports missing source honestly', t => withLedger(t, async fixture => {
  const repo = fixture.repoRoot;
  const git = args => {
    const result = spawnSync('git', args, { cwd: repo, encoding: 'utf8', windowsHide: true });
    assert.equal(result.status, 0, result.stderr); return result.stdout.trim();
  };
  git(['init', '-q', '-b', 'main']);
  git(['config', 'user.name', 'fixture']); git(['config', 'user.email', 'fixture@example.test']); git(['config', 'commit.gpgsign', 'false']);
  fs.writeFileSync(path.join(repo, 'output.txt'), 'tested version\n'); git(['add', 'output.txt']); git(['commit', '-qm', 'tested']);
  const tested = git(['rev-parse', 'HEAD']);
  fs.writeFileSync(path.join(repo, 'output.txt'), 'checkpoint version\n'); git(['add', 'output.txt']); git(['commit', '-qm', 'checkpoint']);
  const checkpoint = git(['rev-parse', 'HEAD']);
  const products = await attemptProducts(repo, { head: tested, files: ['output.txt'] }, { checkpoint: { sha: checkpoint, at } });
  assert.equal(products.headSource, 'runtime-checkpoint');
  assert.equal(products.reportHead, tested);
  assert.equal(products.headAt, at);
  assert.equal(products.files[0].content, 'checkpoint version\n');
  assert.equal((await attemptProducts(repo, { head: tested, files: ['output.txt'] })).headSource, 'report-tested');
  assert.equal((await attemptProducts(repo, null)).errorCode, 'PRODUCT_HEAD_MISSING');
}));

test('dispatch-cohort metrics retain null measurements and exclude cancelled from settled pass rate', t => withLedger(t, async fixture => {
  const now = Date.now();
  seedWorkflow(fixture.ledger, { id: 'wf', jobs: [
    { jobId: 'job', status: 'succeeded', result: { verdict: 'pass' }, dispatchedAt: now - 100, updatedAt: now - 50 },
    { jobId: 'cancelled', status: 'failed', result: { verdict: 'cancelled' }, dispatchedAt: now - 90, updatedAt: now - 40 },
  ] });
  const row = (await request(storeOf(fixture), '/api/metrics/ops?project=fixture-ledger')).data[0];
  assert.equal(row.attempts, 2);
  assert.equal(row.settled, 1);
  assert.equal(row.passRate, 1);
  assert.equal(row.tokensIn, null);
  assert.equal(row.tokensOut, null);
  assert.equal(row.usageCoverage.tokensIn, 0);
  assert.equal(row.usageCoverage.complete, false);
  assert.equal(row.cohort.basis, 'dispatch');
}));

test('checkpoint receipt keeps committed, reused and unbound facts independently of workflow integration', t => withLedger(t, async fixture => {
  seedWorkflow(fixture.ledger, { id: 'wf', jobs: [
    { jobId: 'new', status: 'succeeded', result: { verdict: 'pass' }, dispatchedAt: at, updatedAt: at + 100 },
    { jobId: 'reused', status: 'succeeded', result: { verdict: 'pass' }, dispatchedAt: at, updatedAt: at + 100 },
    { jobId: 'unbound', status: 'succeeded', result: { verdict: 'pass' }, dispatchedAt: at, updatedAt: at + 100 },
    { jobId: 'missing', status: 'succeeded', result: { verdict: 'pass' }, dispatchedAt: at, updatedAt: at + 100 },
  ], events: [
    { kind: 'workflow-checkpoint', entityType: 'job', entityId: 'new', at: at + 40, payload: { sha: 'a'.repeat(40), committed: true, scope: ['ui/'], files: ['ui/output.ts'] } },
    { kind: 'workflow-checkpoint', entityType: 'job', entityId: 'reused', at: at + 40, payload: { sha: 'b'.repeat(40), committed: false, scope: ['ui/'], files: [] } },
    { kind: 'workflow-checkpoint', entityType: 'job', entityId: 'unbound', at: at + 40, payload: { sha: 'c'.repeat(64) } },
  ] });
  const store = storeOf(fixture);
  const details = [];
  for (const id of [1, 2, 3, 4]) details.push((await request(store, `/api/attempts/fixture/${id}`)).data);
  assert.deepEqual(details[0].checkpoint, { sha: 'a'.repeat(40), at: at + 40, committed: true, scope: ['ui/'], files: ['ui/output.ts'] });
  assert.deepEqual(details[1].checkpoint, { sha: 'b'.repeat(40), at: at + 40, committed: false, scope: ['ui/'], files: [] });
  assert.deepEqual(details[2].checkpoint, { sha: 'c'.repeat(64), at: at + 40, committed: null, scope: null, files: null });
  assert.equal(details[3].checkpoint, null);
  assert.ok(details.every(detail => detail.land === null));
  assert.equal(store.ledger('fixture').db.prepare('SELECT total_changes() AS n').get().n, 0);
}));

test('preserved, foreign, malformed and out-of-window events never establish a checkpoint receipt', t => withLedger(t, fixture => {
  seedWorkflow(fixture.ledger, { id: 'wf', jobs: [
    { jobId: 'failed', status: 'failed', result: { verdict: 'fail' }, dispatchedAt: at, updatedAt: at + 100 },
    { jobId: 'passed', status: 'succeeded', result: { verdict: 'pass' }, dispatchedAt: at, updatedAt: at + 100 },
  ], events: [
    { kind: 'workflow-op-preserved', entityType: 'job', entityId: 'failed', at: at + 40, payload: { sha: 'a'.repeat(40), committed: true } },
    { kind: 'workflow-op-preserved', entityType: 'job', entityId: 'passed', at: at + 40, payload: { sha: 'a'.repeat(40), committed: true } },
    { kind: 'workflow-checkpoint', entityType: 'job', entityId: 'foreign', at: at + 40, payload: { sha: 'a'.repeat(40), committed: true } },
    { kind: 'workflow-checkpoint', entityType: 'workflow', entityId: 'passed', at: at + 40, payload: { sha: 'a'.repeat(40), committed: true } },
    { kind: 'workflow-checkpoint', entityType: 'job', entityId: 'passed', at: at - 1, payload: { sha: 'a'.repeat(40), committed: true } },
    { kind: 'workflow-checkpoint', entityType: 'job', entityId: 'passed', at: at + 101, payload: { sha: 'a'.repeat(40), committed: true } },
    { kind: 'workflow-checkpoint', entityType: 'job', entityId: 'passed', at: at + 40, payload: { sha: 'a'.repeat(41), committed: true } },
    { kind: 'workflow-checkpoint', entityType: 'job', entityId: 'passed', at: at + 50, payload: { sha: 'a'.repeat(40), kind: 'workflow-op-preserved' } },
    { kind: 'workflow-checkpoint', entityType: 'job', entityId: 'passed', at: at + 60, payload: { sha: 'a'.repeat(40), attemptId: 1 } },
    { kind: 'workflow-checkpoint', entityType: 'job', entityId: 'passed', at: at + 70, payload: { sha: 'a'.repeat(40), dispatchId: 'other-dispatch' } },
  ] });
  for (const id of [1, 2]) assert.equal(workflowCheckpoint(fixture.ledger.db, fixture.ledger.getAttempt(id)), null);
}));

test('recorded checkpoint effects remain observable with a pending or failed verdict', t => withLedger(t, async fixture => {
  seedWorkflow(fixture.ledger, { id: 'wf', jobs: [
    { jobId: 'pending', status: 'running', dispatchedAt: at },
    { jobId: 'failed', status: 'failed', result: { verdict: 'fail' }, dispatchedAt: at, updatedAt: at + 100 },
  ], events: [
    { kind: 'workflow-checkpoint', entityType: 'job', entityId: 'pending', at: at + 40, payload: { sha: 'a'.repeat(40), committed: true, scope: ['ui/'], files: ['ui/output.ts'] } },
    { kind: 'workflow-checkpoint', entityType: 'job', entityId: 'failed', at: at + 40, payload: { sha: 'b'.repeat(40), committed: false, scope: [], files: [] } },
  ] });
  const store = storeOf(fixture);
  const pending = (await request(store, '/api/attempts/fixture/1')).data;
  const failed = (await request(store, '/api/attempts/fixture/2')).data;
  assert.equal(pending.verdict, null);
  assert.equal(pending.checkpoint.committed, true);
  assert.equal(pending.checkpoint.at, at + 40);
  assert.equal(failed.verdict, 'fail');
  assert.equal(failed.checkpoint.committed, false);
  assert.equal(failed.land, null);
}));

test('unbound checkpoint collisions and a newer dispatch leave association unknown; exact dispatch binding remains usable', t => withLedger(t, fixture => {
  seedWorkflow(fixture.ledger, { id: 'wf', jobs: [{ jobId: 'job', opId: 'test.op', status: 'leased', dispatchedAt: at }], events: [
    { kind: 'workflow-checkpoint', entityType: 'job', entityId: 'job', at: at + 40, payload: { sha: 'a'.repeat(40) } },
    { kind: 'workflow-checkpoint', entityType: 'job', entityId: 'job', at: at + 50, payload: { sha: 'b'.repeat(40) } },
  ] });
  fixture.ledger.transaction(db => db.prepare("UPDATE op_attempts SET verdict='pass',settled_at=? WHERE attempt_id=1").run(at + 100));
  let raw = fixture.ledger.getAttempt(1);
  assert.equal(workflowCheckpoint(fixture.ledger.db, raw), null);
  fixture.ledger.transaction(db => db.prepare('UPDATE op_attempts SET settled_at=? WHERE attempt_id=1').run(at + 45));
  raw = fixture.ledger.getAttempt(1);
  assert.equal(workflowCheckpoint(fixture.ledger.db, raw)?.sha, 'a'.repeat(40));
  fixture.ledger.transaction(db => startAttempt(db, { workflowId: 'wf', jobId: 'job', dispatchId: 'second', dispatchedAt: at + 20, at: at + 20 }));
  assert.equal(workflowCheckpoint(fixture.ledger.db, raw), null);
  fixture.ledger.appendEvent({ workflowId: 'wf', entityType: 'job', entityId: 'job', kind: 'workflow-checkpoint', createdAt: at + 30,
    payload: { sha: 'a'.repeat(40), dispatchId: raw.dispatch_id, committed: 'false', scope: ['ui/', null], files: [] } });
  raw = fixture.ledger.getAttempt(1);
  assert.deepEqual(workflowCheckpoint(fixture.ledger.db, raw), { sha: 'a'.repeat(40), at: at + 30, committed: null, scope: null, files: [] });
}));

test('pending checkpoint receipts stop at the next recorded dispatch without an observation-clock fallback', t => withLedger(t, fixture => {
  seedWorkflow(fixture.ledger, { id: 'wf', jobs: [{ jobId: 'job', opId: 'test.op', status: 'leased', dispatchedAt: at }], events: [
    { kind: 'workflow-checkpoint', entityType: 'job', entityId: 'job', at: at + 40, payload: { sha: 'a'.repeat(40), dispatchId: 'seed:job' } },
  ] });
  let raw = fixture.ledger.getAttempt(1);
  assert.equal(raw.settled_at, null);
  assert.equal(workflowCheckpoint(fixture.ledger.db, raw)?.at, at + 40);
  fixture.ledger.transaction(db => db.prepare("UPDATE op_attempts SET end_state='requeued' WHERE attempt_id=1").run());
  fixture.ledger.transaction(db => startAttempt(db, { workflowId: 'wf', jobId: 'job', dispatchId: 'second', dispatchedAt: at + 20, at: at + 20 }));
  raw = fixture.ledger.getAttempt(1);
  assert.equal(workflowCheckpoint(fixture.ledger.db, raw), null);
}));
