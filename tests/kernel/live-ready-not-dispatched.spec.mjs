// Two live workflows (2026-10-09, runtime 9ec024066) held a ready job for 15 minutes with nothing running and no problem line. The causes, each with its spec:
//   1. interface.draw: the grammar context was resolved against the repository's MAIN checkout, but the brand record a finished brand.decide leg wrote lives in
//      the workflow's own tree until the workflow finishes: every dispatch refused grammar-context-missing, inside a detached push result nobody reads.
//   2. architecture.decide: worker-start was refused consumer_fenced (the Kernel terminal is not the coordinator Orca has bound to the workflow Run; run-show
//      names none, which the binder reads as bound). Each refusal counted as a pool failure; after three, both pools were excluded and the admission answered
//      no-eligible-candidate for ever.
//   3. a lineage that excludes every pool of the tier is a dead end nothing owns.
//   4. the digest named none of it: a ready job not dispatched inside its bound is now a problem line with its owner.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { resolveGrammarContext } from '../../scripts/kernel/grammar-context.mjs';
import { rejectionAttemptsOf } from '../../scripts/kernel/job-rejections.mjs';
import { rebindAfterFence, isRunFence } from '../../scripts/kernel/orca-runs.mjs';
import { spawnOperationAgent } from '../../scripts/kernel/verbs/shared/dispatch-agent.mjs';
import { yieldTotalExclusion } from '../../scripts/agent/op-pick.mjs';
import { makeTempDir } from '../../scripts/api/fs/make-temp-dir.mjs';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { NOW, MIN, digest, job, status, workflow, snapshot } from '../helpers/debug-digest-fixture.mjs';
import { withLedger } from '../helpers/ledger-fixture.mjs';

const write = (root, rel, text) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), text); };
const BRAND = ['schema: work/brand@1', 'kind: brand', 'brand:', '  identity:', '    family: starci', '  sources: []', ''].join('\n');

test('the grammar context reads the brand record from the workflow tree, where a finished brand leg wrote it, not only from the main checkout', (t) => {
  const root = makeTempDir('starci-live-grammar-');
  t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 25 }));
  const main = path.join(root, 'main'), tree = path.join(root, 'tree');
  fs.mkdirSync(path.join(main, '.starciwork'), { recursive: true });
  write(tree, '.starciwork/brand/index.yaml', BRAND);
  const before = resolveGrammarContext({ skillRoot, repo: main, binding: null });
  assert.match(before.missing.map((m) => m.detail).join(' '), /no brand record/i, 'the main checkout alone has no brand record: the live refusal');
  const after = resolveGrammarContext({ skillRoot, repo: main, binding: null, tree });
  assert.equal(after.family, 'starci');
  assert.equal(after.missing.some((m) => /no brand record/i.test(m.detail)), false, 'the tree holds it');
});

const fenced = { payload: { step: 'worker-start', error: 'consumer_fenced: worker-start requires the coordinator terminal currently bound to the Task Run.', model: 'codex-agent', effectState: 'none' } };

test('a launch the host refused consumer_fenced spends no pool strike; a refusal of the agent still does', (t) => {
  withLedger(t, ({ ledger }) => {
    const append = (payload) => ledger.appendEvent({ workflowId: 'wf-1', entityType: 'job', entityId: 'op-a-1', kind: 'dispatch-rejected', createdAt: Date.now(), payload });
    ledger.db.exec('PRAGMA foreign_keys=OFF');
    append(fenced.payload);
    append({ ...fenced.payload, model: 'claude-agent' });
    append({ step: 'worker-start', error: 'the worker did not start', model: 'claude-agent', effectState: 'none' });
    const rows = rejectionAttemptsOf(ledger.db, { job_id: 'op-a-1', attempt: 1 });
    assert.deepEqual(rows.map((r) => [r.pool, r.detail.includes('did not start')]), [['claude-agent', true]], 'only the agent-attributable refusal counts');
  });
});

test('a fence at worker-start re-binds the Run to the Kernel terminal once and retries the launch once; a second fence is rejected as before', () => {
  const calls = [];
  const rows = [];
  const input = { ledger: { transaction: (fn) => fn(), appendEvent: (e) => rows.push(e) }, job: { workflow_id: 'wf-1' }, jobId: 'op-a-1', run: 'run_1', from: 'term_kernel' };
  const fence = { ok: false, step: 'worker-start', error: 'consumer_fenced: worker-start requires the coordinator terminal currently bound to the Task Run.', effectState: 'none' };
  const results = [fence, { ok: true, terminal: 'term_op' }];
  const launch = () => { calls.push('launch'); return results.shift(); };
  const rebind = () => { calls.push('rebind'); return { rebound: true, action: 'rebound', previousCoordinator: null }; };
  const out = spawnOperationAgent(input, { launch, rebind });
  assert.deepEqual(calls, ['launch', 'rebind', 'launch']);
  assert.equal(out.ok, true);
  assert.equal(rows[0].kind, 'run-rebound');
  assert.equal(rows[0].payload.runId, 'run_1');

  calls.length = 0;
  const twice = spawnOperationAgent(input, { launch: () => { calls.push('launch'); return fence; }, rebind });
  assert.deepEqual(calls, ['launch', 'rebind', 'launch'], 'one rebind, one retry, never a loop');
  assert.equal(isRunFence(twice), true);

  calls.length = 0;
  const unrelated = spawnOperationAgent(input, { launch: () => { calls.push('launch'); return { ...fence, error: 'the worker did not start' }; }, rebind });
  assert.deepEqual(calls, ['launch'], 'another refusal is not a fence');
  assert.equal(unrelated.ok, false);
});

test('rebindAfterFence binds a Run whose coordinator run-show does not name, leaves a Run the Kernel already coordinates, and reports a refusal', () => {
  const used = [];
  const use = (a) => { used.push(a); return { ok: true }; };
  const none = rebindAfterFence({ runId: 'run_1', kernelHandle: 'term_k' }, { show: () => ({ ok: true, coordinator: null }), use });
  assert.deepEqual([none.rebound, none.action], [true, 'rebound']);
  assert.deepEqual(used, [{ id: 'run_1', from: 'term_k' }]);
  const same = rebindAfterFence({ runId: 'run_1', kernelHandle: 'term_k' }, { show: () => ({ ok: true, coordinator: 'term_k' }), use });
  assert.deepEqual([same.rebound, same.action], [false, 'already-bound']);
  assert.equal(used.length, 1, 'no second run-use over a bound Run');
  const refused = rebindAfterFence({ runId: 'run_1', kernelHandle: 'term_k' }, { show: () => ({ ok: true, coordinator: 'term_old' }), use: () => ({ ok: false, error: 'denied' }) });
  assert.equal(refused.action, 'failed');
  assert.match(refused.error, /denied/);
});

test('a lineage that excluded every pool of the tier yields its exclusion (the pools stay demoted); one that left a pool is untouched', () => {
  const runtimes = { runtimes: { 'claude-agent': { target: 'claude/sonnet' }, 'codex-agent': { target: 'codex/sol' } } };
  const members = [{ pool: 'claude-agent' }, { pool: 'codex-agent' }];
  const all = { exclude: ['claude/sonnet', 'codex/sol'], demote: [], pools: {} };
  const lifted = yieldTotalExclusion(all, members, runtimes);
  assert.deepEqual(lifted.exclude, []);
  assert.deepEqual(lifted.demote.sort(), ['claude/sonnet', 'codex/sol']);
  const some = { exclude: ['claude/sonnet'], demote: [] };
  assert.equal(yieldTotalExclusion(some, members, runtimes), some);
  assert.equal(yieldTotalExclusion(null, members, runtimes), null);
});

const readyJob = (over = {}) => job({ jobId: 'op-architecture.decide-8da', opId: 'architecture.decide', status: 'ready', tryNo: 2, createdAt: NOW - 20 * MIN, updatedAt: NOW - 1 * MIN, ...over });
const flowOf = (jobs, over = {}) => workflow({ jobs: [...jobs, job({ jobId: 'kernel-wf-1', kind: 'kernel', opId: null })], status: status({ frontier: { state: 'engaged', openOperations: 1, readyOperations: 1, queued: [] } }), ...over });

test('the digest names a ready job nothing dispatched inside the bound as a problem owned by the runtime, and not one inside the bound or one that was dispatched', () => {
  const stuck = digest(snapshot({ workflows: [flowOf([readyJob()])] }));
  const found = stuck.problems.find((p) => p.params?.departure === 'ready-not-dispatched');
  assert.ok(found, `no ready-not-dispatched problem in ${JSON.stringify(stuck.problems.map((p) => p.params?.departure ?? p.code))}`);
  assert.match(JSON.stringify(found), /Workflow controller/);
  const fresh = digest(snapshot({ workflows: [flowOf([readyJob({ createdAt: NOW - 1 * MIN })])] }));
  assert.equal(fresh.problems.some((p) => p.params?.departure === 'ready-not-dispatched'), false, 'inside the bound it is only waiting');
  const none = digest(snapshot({ workflows: [flowOf([readyJob({ status: 'running' })])] }));
  assert.equal(none.problems.some((p) => p.params?.departure === 'ready-not-dispatched'), false);
});
