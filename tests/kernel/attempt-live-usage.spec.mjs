// An op attempt past its token budget is seen while it runs: the poll that snapshots the open attempts also reads their session files,
// the first reading past the budget is one `attempt-budget-overrun` event, `starci kernel status` lists it with live: true and the
// Workflow controller plans the same budget-overrun Decision Item, with the same key on every poll. The rows written at settle replace it.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { withLedger } from '../helpers/ledger-fixture.mjs';
import { attemptsOverBudget, budgetOverruns } from '../../scripts/kernel/attempt-budget.mjs';
import { measureOpenAttempts } from '../../scripts/kernel/attempt-live-usage.mjs';
import { planBudgetOverruns } from '../../scripts/reconciler/budget-plan.mjs';
import budgetStatus from '../../scripts/kernel/status/budget-overruns.mjs';

const WF = 'wf-live-budget';
const DISPATCH = 'ctx_0123456789ab';
const BUDGET = 6_000_000;

const writeSession = (dir, cacheRead) => {
  fs.mkdirSync(dir, { recursive: true });
  const lines = [{ type: 'user', timestamp: new Date().toISOString(), message: { content: `=== TASK ===\nrun it: starci kernel report --dispatch-id ${DISPATCH}` } },
    { type: 'assistant', sessionId: 'op-session', timestamp: new Date().toISOString(),
      message: { id: 'm1', model: 'claude-opus-5-5', content: [], usage: { input_tokens: 1000, output_tokens: 500, cache_read_input_tokens: cacheRead, cache_creation_input_tokens: 0 } } }];
  fs.writeFileSync(path.join(dir, 'slug__11111111-2222-3333-4444-555555555555.jsonl'), `${lines.map((line) => JSON.stringify(line)).join('\n')}\n`);
};

const world = (t, fn) => withLedger(t, async ({ root, ledger }) => {
  ledger.ensureWorkflow({ workflowId: WF });
  ledger.write.changeWorkflowPhase({ workflowId: WF, to: 'running', by: 'test', reason: 'live budget fixture' });
  ledger.write.createUnit({ workflowId: WF, unitId: 'job-live', opId: 'architecture.decide', subjectKey: 'job-live', goalRevision: 1 });
  ledger.enqueueJob({ workflowId: WF, jobId: 'job-live', unitId: 'job-live', opId: 'architecture.decide', kind: 'op', payload: { owned_paths: ['a/b.ts', 'c/d.ts'] } });
  ledger.write.setJobStatus({ jobId: 'job-live', to: 'ready', reason: 'test' });
  ledger.write.setJobStatus({ jobId: 'job-live', to: 'leased', reason: 'test' });
  const started = ledger.write.startAttempt({ workflowId: WF, jobId: 'job-live', dispatchId: DISPATCH, provider: 'claude', dispatchedAt: Date.now() });
  ledger.write.setJobStatus({ jobId: 'job-live', to: 'running', reason: 'test worker accepted' });
  const sessions = path.join(root, 'sessions', 'claude');
  const measure = () => measureOpenAttempts(ledger, { archiveRoot: path.join(root, 'sessions'), env: { STARCI_AGENT_TRUST_HOME: path.join(root, 'empty-home') }, budget: BUDGET });
  await fn({ ledger, attemptId: started.attempt_id, sessions, measure });
});

test('a running attempt under the budget records nothing; the first reading past it records one event, and a later poll adds none', (t) => world(t, ({ ledger, attemptId, sessions, measure }) => {
  writeSession(sessions, 5_000_000);
  assert.deepEqual(measure().overruns, []);
  assert.deepEqual(attemptsOverBudget(ledger.db, WF), []);
  writeSession(sessions, 7_000_000);
  const first = measure();
  assert.deepEqual(first.overruns, [{ attemptId, tokens: 7_001_500 }]);
  assert.deepEqual(measure().overruns, [], 'the second poll finds the event and measures nothing more');
  const events = ledger.db.prepare("SELECT payload_json FROM events WHERE kind='attempt-budget-overrun'").all();
  assert.equal(events.length, 1);
  assert.deepEqual(JSON.parse(events[0].payload_json), { attemptId, jobId: 'job-live', opId: 'architecture.decide', agent: null, tokens: 7_001_500, budget: BUDGET, live: true });
}));

test('the live reading is listed by status and planned as the budget-overrun item with the same key on every poll', (t) => world(t, ({ ledger, attemptId, sessions, measure }) => {
  writeSession(sessions, 7_000_000);
  measure();
  const rows = budgetOverruns(ledger.db, WF);
  assert.deepEqual(rows.map((row) => [row.attemptId, row.live, row.jobStatus, row.tokens]), [[attemptId, true, 'running', 7_001_500]]);
  const field = budgetStatus.compute({ db: ledger.db, workflowId: WF, wf: { phase: 'running' } });
  assert.match(budgetStatus.lines(field)[0], /7,001,500 tokens over the budget of 6,000,000; the job is running \(still running\)/);
  const planned = [];
  for (let poll = 0; poll < 3; poll += 1) planBudgetOverruns({ workflowId: WF, status: { budgetOverruns: budgetOverruns(ledger.db, WF) }, di: (di) => planned.push(di) });
  assert.equal(new Set(planned.map((di) => `${di.kind}:${di.subject}`)).size, 1, 'three polls name one item');
  assert.equal(planned[0].subject, `attempt-${attemptId}`);
  assert.match(planned[0].summary, /still running/);
  assert.deepEqual(planned[0].options.map((option) => option.key), ['continue-once', 'replace', 're-scope']);
}));

test('the rows written at settle replace the live reading', (t) => world(t, ({ ledger, attemptId, sessions, measure }) => {
  writeSession(sessions, 7_000_000);
  measure();
  ledger.write.recordAttemptUsage({ attemptId, rows: [{ model: 'm', inputTokens: 1, outputTokens: 1, cacheReadTokens: 9_000_000, cacheWriteTokens: 0 }] });
  ledger.write.updateAttempt({ attemptId, settledAt: Date.now(), endState: 'settled' });
  ledger.write.setJobStatus({ jobId: 'job-live', to: 'failed', reason: 'test settle' });
  const rows = attemptsOverBudget(ledger.db, WF);
  assert.deepEqual(rows.map((row) => [row.live, row.tokens]), [[false, 9_000_002]]);
  assert.equal(budgetOverruns(ledger.db, WF).length, 1);
}));
