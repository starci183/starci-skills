// attempt-budget.spec.mjs — an Op attempt is measured against the token budget its role declares (modules/kernel/roles.yaml
// op.tokenBudget): the measure is the sum of the attempt's llm_usage rows, an overrun on a job that waits on the Kernel is listed by
// `starci kernel status` (budgetOverruns) and planned by the Workflow controller as a Decision Item with three options.
import test from 'node:test';
import assert from 'node:assert/strict';
import { withLedger } from '../helpers/ledger-fixture.mjs';
import { attemptBudget, attemptsOverBudget, budgetOverruns } from '../../scripts/kernel/attempt-budget.mjs';
import { budgetOptions, planBudgetOverruns } from '../../scripts/reconciler/budget-plan.mjs';
import budgetStatus from '../../scripts/kernel/status/budget-overruns.mjs';

const WF = 'wf-budget';
const OWNED = ['apps/web/src/a.tsx', 'apps/web/src/b.tsx', 'apps/api/src/c.ts'];

const world = (t, fn) => withLedger(t, ({ ledger }) => {
  ledger.ensureWorkflow({ workflowId: WF });
  ledger.write.changeWorkflowPhase({ workflowId: WF, to: 'running', by: 'test', reason: 'budget fixture' });
  const attempt = (jobId, dispatchId, tokens, { settle = 'failed' } = {}) => {
    ledger.write.createUnit({ workflowId: WF, unitId: jobId, opId: 'architecture.decide', subjectKey: jobId, goalRevision: 1 });
    ledger.enqueueJob({ workflowId: WF, jobId, unitId: jobId, opId: 'architecture.decide', kind: 'op', payload: { owned_paths: OWNED } });
    ledger.write.setJobStatus({ jobId, to: 'ready', reason: 'test dispatch' });
    ledger.write.setJobStatus({ jobId, to: 'leased', reason: 'test dispatch' });
    const started = ledger.write.startAttempt({ workflowId: WF, jobId, dispatchId, provider: 'claude', dispatchedAt: Date.now() });
    ledger.write.setJobStatus({ jobId, to: 'running', reason: 'test worker accepted' });
    if (tokens != null) {
      ledger.write.recordAttemptUsage({ attemptId: started.attempt_id, rows: [{ model: 'm', inputTokens: tokens.fresh, outputTokens: tokens.out, cacheReadTokens: tokens.cacheRead, cacheWriteTokens: tokens.cacheWrite }] });
    }
    ledger.write.updateAttempt({ attemptId: started.attempt_id, settledAt: Date.now(), endState: 'settled' });
    if (settle === 'succeeded') ledger.write.setJobStatus({ jobId, to: 'reported', reason: 'test report' });
    ledger.write.setJobStatus({ jobId, to: settle, reason: 'test settle' });
    return started.attempt_id;
  };
  return fn({ ledger, attempt });
});

test('the budget is the one the Op role declares', () => {
  const budget = attemptBudget();
  assert.equal(budget.perAttempt, 6_000_000);
  assert.equal(budget.status, 'provisional');
});

test('an attempt is measured by all four token kinds of its usage rows, and an unmeasured attempt is never over', (t) => world(t, ({ ledger, attempt }) => {
  const over = attempt('job-over', 'ctx_over', { fresh: 100_000, out: 50_000, cacheRead: 5_900_000, cacheWrite: 1 });
  attempt('job-under', 'ctx_under', { fresh: 100_000, out: 50_000, cacheRead: 5_000_000, cacheWrite: 0 });
  attempt('job-none', 'ctx_none', null);
  const rows = attemptsOverBudget(ledger.db, WF);
  assert.deepEqual(rows.map((row) => row.attemptId), [over]);
  assert.equal(rows[0].tokens, 6_050_001);
  assert.equal(rows[0].budget, 6_000_000);
  assert.deepEqual(rows[0].ownedPaths, OWNED);
}));

test('an overrun is a decision for the Kernel only while its failed job has no later try', (t) => world(t, ({ ledger, attempt }) => {
  attempt('job-red', 'ctx_red', { fresh: 0, out: 0, cacheRead: 7_000_000, cacheWrite: 0 });
  attempt('job-green', 'ctx_green', { fresh: 0, out: 0, cacheRead: 7_000_000, cacheWrite: 0 }, { settle: 'succeeded' });
  assert.deepEqual(budgetOverruns(ledger.db, WF).map((row) => row.jobId), ['job-red'], 'a green job needs no decision');
  ledger.enqueueJob({ workflowId: WF, jobId: 'job-red-2', unitId: 'job-red', opId: 'architecture.decide', kind: 'op', payload: {}, tryNo: 2, retryOf: 'job-red' });
  assert.deepEqual(budgetOverruns(ledger.db, WF), [], 'a later try answers it');
}));

test('the status field lists the overrun with the tokens and the budget', (t) => world(t, ({ ledger, attempt }) => {
  attempt('job-status', 'ctx_status', { fresh: 1, out: 1, cacheRead: 9_000_000, cacheWrite: 0 });
  const field = budgetStatus.compute({ db: ledger.db, workflowId: WF, wf: { phase: 'running' } });
  assert.equal(field.length, 1);
  assert.match(budgetStatus.lines(field)[0], /BUDGET-OVERRUN architecture\.decide .*9,000,002 tokens over the budget of 6,000,000/);
  assert.equal(budgetStatus.compute({ db: ledger.db, workflowId: WF, wf: { phase: 'finished' } }), null);
}));

test('the Workflow controller plans one Kernel Decision Item per overrun with continue-once, replace and re-scope', () => {
  const row = { attemptId: 7, jobId: 'job-7', opId: 'business.decide', agent: 'claude', tokens: 15_600_000, budget: 6_000_000, jobStatus: 'failed', ownedPaths: OWNED };
  const out = [];
  planBudgetOverruns({ workflowId: WF, status: { budgetOverruns: [row] }, di: (di) => out.push(di) });
  assert.equal(out.length, 1);
  assert.equal(out[0].kind, 'budget-overrun');
  assert.equal(out[0].subject, 'attempt-7');
  assert.match(out[0].summary, /15,600,000 tokens against a budget of 6,000,000/);
  assert.deepEqual(out[0].options.map((option) => option.key), ['continue-once', 'replace', 're-scope']);
  assert.match(out[0].options[0].verb, /^starci kernel enqueue --workflow wf-budget --op business\.decide --retry-of job-7 --paths /);
  assert.equal(out[0].options[1].verb, 'starci kernel settle --workflow wf-budget --job job-7 --verdict fail');
  assert.match(out[0].options[2].verb, /--paths 'apps\/web\/src\/a\.tsx,apps\/web\/src\/b\.tsx'/);
});

test('a leg that owns one path cannot be re-scoped, and an empty status plans nothing', () => {
  const options = budgetOptions(WF, { attemptId: 1, jobId: 'job-1', opId: 'x.y', ownedPaths: ['a.ts'] });
  assert.deepEqual(options.map((option) => option.key), ['continue-once', 'replace']);
  const out = [];
  planBudgetOverruns({ workflowId: WF, status: {}, di: (di) => out.push(di) });
  assert.deepEqual(out, []);
});
