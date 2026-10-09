// Nivo 2026-10-09: a Kernel settle-fail of a done report prepared a reset receipt aimed at the merge-base with main (the tree registry record had lost its checkpoint
// pointer, so the gate base fell behind two settled ops), the apply died with workflow-reset-failed and left the index half reset, and the receipt blocked every later
// settle of the attempt (workflow-checkpoint-recovery-conflict), the Critic path included. The gate base follows the checkpoint chain; a void receipt is withdrawn by the runtime.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { withLedger, seedWorkflow } from '../helpers/ledger-fixture.mjs';
import { chainCheckpointOf } from '../../scripts/machine/workflow-tree.mjs';
import { openPreparedOf, recoverPreparedSettlement, PREPARED_KEPT, PREPARED_WITHDRAWN_CODE } from '../../scripts/kernel/settle/prepared-recovery.mjs';
import { preparedSettlementOf, PREPARED_WITHDRAWN } from '../../scripts/kernel/workflow-checkpoint-state.mjs';

const identity = { GIT_AUTHOR_NAME: 'spec', GIT_AUTHOR_EMAIL: 's@s.test', GIT_COMMITTER_NAME: 'spec', GIT_COMMITTER_EMAIL: 's@s.test' };

/** A workflow branch as the Nivo tree was: baseline, two settled checkpoints, then a commit that preserved uncommitted work. */
function branch(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-prep-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const git = (...args) => execFileSync('git', args, { cwd: dir, env: { ...process.env, ...identity }, encoding: 'utf8' }).trim();
  git('init', '-q');
  const commit = (file, text, message) => { fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true }); fs.writeFileSync(path.join(dir, file), text); git('add', '-A'); git('commit', '-q', '-m', message); return git('rev-parse', 'HEAD'); };
  const baseline = commit('a.txt', 'a\n', 'chore(app): establish canonical hfs app baseline');
  commit('b.txt', 'b\n', 'checkpoint wf-n: op-scope.define-1');
  const last = commit('c.txt', 'c\n', 'checkpoint wf-n: op-business.decide-2');
  const head = commit('records/index.yaml', 'x: 1\n', 'preserve wf-n/gc: uncommitted work of its worktree');
  return { dir, git, baseline, last, head };
}

test('the gate base of a tree whose record lost its checkpoint pointer is the newest checkpoint of its chain, not the merge-base with main', (t) => {
  const { dir, last } = branch(t);
  assert.equal(chainCheckpointOf({ path: dir, workflowId: 'wf-n' }), last);
  assert.equal(chainCheckpointOf({ path: dir, workflowId: 'wf-other' }), null, 'the checkpoints of another workflow are not this one');
});

const world = async (t, fn) => withLedger(t, async ({ ledger }) => {
  const tree = branch(t);
  seedWorkflow(ledger, { id: 'wf-n', goal: { revision: 1, markdown: '# n' }, jobs: [{ jobId: 'op-arch', opId: 'architecture.decide', status: 'reported', payload: { opId: 'architecture.decide', owned_paths: [] } }] });
  const attemptId = ledger.db.prepare('SELECT attempt_id FROM op_attempts WHERE job_id=?').get('op-arch').attempt_id;
  // The half-applied reset the failed apply left: the op record is staged as deleted although the branch never moved.
  tree.git('rm', '-q', '--cached', 'records/index.yaml');
  const receipt = { workflowId: 'wf-n', opId: 'op-arch', attemptId, path: tree.dir, branch: 'main', before: tree.head, resetTo: tree.baseline, files: ['records/index.yaml'], settlement: { verdict: 'fail', job: { status: 'reported' } } };
  ledger.transaction(() => ledger.appendEvent({ workflowId: 'wf-n', entityType: 'job', entityId: 'op-arch', attemptId, kind: 'workflow-op-preserved-prepared', payload: receipt }));
  await fn({ ledger, tree, attemptId, item: { jobId: 'op-arch', workflowId: 'wf-n' } });
});

test('a prepared fail whose reset target is not the gate base is withdrawn by the runtime, the index is put back, and the settle can pass again', (t) => world(t, ({ ledger, tree, attemptId, item }) => {
  const blocking = () => preparedSettlementOf({ db: ledger.db }, { workflowId: 'wf-n', opId: 'op-arch', attemptId });
  assert.ok(openPreparedOf(ledger.db, 'op-arch'));
  assert.equal(blocking()?.verdict, 'fail', 'the receipt blocks the settle');
  assert.match(tree.git('status', '--porcelain'), /^D /m, 'the apply left the record staged as deleted');
  const out = recoverPreparedSettlement(ledger, item, { baseOf: () => tree.last, headOf: () => tree.head });
  assert.deepEqual([out.withdrawn, out.indexRestored], [true, true]);
  assert.equal(openPreparedOf(ledger.db, 'op-arch'), null);
  assert.equal(blocking(), null, 'a withdrawn receipt no longer blocks the settle');
  assert.equal(tree.git('status', '--porcelain'), '', 'the index follows HEAD again');
  const journal = ledger.db.prepare('SELECT payload_json FROM events WHERE kind=?').get(PREPARED_WITHDRAWN);
  assert.equal(JSON.parse(journal.payload_json).code, PREPARED_WITHDRAWN_CODE);
}));

test('a prepared fail that aims at the live gate base is kept, once: finishing its apply is the Kernel own', (t) => world(t, ({ ledger, tree, attemptId, item }) => {
  const out = recoverPreparedSettlement(ledger, item, { baseOf: () => tree.baseline, headOf: () => tree.head });
  assert.deepEqual(out, { kept: true });
  assert.equal(openPreparedOf(ledger.db, 'op-arch'), null, 'looked at once');
  assert.equal(ledger.db.prepare('SELECT count(*) n FROM events WHERE kind=?').get(PREPARED_KEPT).n, 1);
  assert.equal(preparedSettlementOf({ db: ledger.db }, { workflowId: 'wf-n', opId: 'op-arch', attemptId })?.verdict, 'fail', 'a kept receipt still stands');
  assert.equal(recoverPreparedSettlement(ledger, item, { baseOf: () => tree.baseline, headOf: () => tree.head }), null);
}));
