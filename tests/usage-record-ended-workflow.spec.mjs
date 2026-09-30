import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { withLedger, seedWorkflow } from './_ledger-fixture.mjs';
import { changeWorkflowPhase } from '../engine/ledger-db.mjs';
import { sweepUsage } from '../scripts/kernel/usage-record.mjs';

const session = (root, workflowId, dispatchId) => {
  const dir = path.join(root, 'sessions', 'claude');
  fs.mkdirSync(dir, { recursive: true });
  const usage = { type: 'assistant', sessionId: `${workflowId}-session`, message: { id: `msg-${workflowId}`, model: 'claude-opus-5-5', content: [], usage: { input_tokens: 7, output_tokens: 11, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } } };
  for (const [name, first] of [['op', `worker --dispatch-id ${dispatchId}`], ['kernel', `You are [Kernel] ${workflowId}`]]) {
    fs.writeFileSync(path.join(dir, `${workflowId}-${name}.jsonl`),
      `${JSON.stringify({ type: 'user', timestamp: new Date().toISOString(), message: { content: first } })}\n${JSON.stringify(usage)}\n`);
  }
};

test('usage sweep skips archived attempts and Kernel sessions, and records running and finished workflows', async (t) => withLedger(t, async ({ root, ledger, ledgerFile }) => {
  const now = Date.now();
  const workflows = [
    ['wf-usage-archived', 'archived'],
    ['wf-usage-archive-stamp', 'archive-stamp'],
    ['wf-usage-running', 'running'],
    ['wf-usage-finished', 'finished'],
  ];
  for (const [index, [workflowId, phase]] of workflows.entries()) {
    const jobId = `job-${workflowId}`;
    const dispatchId = `ctx_${String(index + 1).repeat(12)}`;
    seedWorkflow(ledger, { id: workflowId, state: { phase: 'running' }, jobs: [{ jobId, status: 'failed', pool: 'claude', dispatchId, payload: { model: 'claude', opId: 'test.op' } }] });
    session(root, workflowId, dispatchId);
    if (phase === 'archive-stamp') ledger.db.prepare('UPDATE workflows SET archived_at=? WHERE workflow_id=?').run(now, workflowId);
    else if (phase !== 'running') ledger.transaction((db) => {
      changeWorkflowPhase(db, { workflowId, to: phase === 'archived' ? 'stopped' : 'finished', by: 'test-fixture', reason: 'seed', at: now });
      if (phase === 'archived') {
        changeWorkflowPhase(db, { workflowId, to: 'archived', by: 'test-fixture', reason: 'seed', at: now });
      }
    });
  }
  const before = ledger.db.prepare('SELECT count(*) AS n FROM llm_usage').get().n;
  const result = await sweepUsage({ now, lookbackMs: 60_000, ledgerFiles: [{ name: 'fixture', file: ledgerFile }],
    archiveRoot: path.join(root, 'sessions'), env: { STARCI_AGENT_TRUST_HOME: path.join(root, 'empty-home') } });
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.equal(result.attempts.skippedEnded, 2);
  assert.equal(result.kernels.skippedEnded, 2);
  assert.equal(result.attempts.recorded, 2);
  assert.equal(result.kernels.recorded, 2);
  assert.equal(ledger.db.prepare('SELECT count(*) AS n FROM llm_usage').get().n - before, 4);
  assert.equal(ledger.db.prepare('SELECT count(*) AS n FROM llm_usage WHERE workflow_id=?').get('wf-usage-archived').n, 0);
  assert.equal(ledger.db.prepare('SELECT count(*) AS n FROM llm_usage WHERE workflow_id=?').get('wf-usage-archive-stamp').n, 0);
  const again = await sweepUsage({ now, lookbackMs: 60_000, ledgerFiles: [{ name: 'fixture', file: ledgerFile }],
    archiveRoot: path.join(root, 'sessions'), env: { STARCI_AGENT_TRUST_HOME: path.join(root, 'empty-home') } });
  assert.equal(again.ok, true, JSON.stringify(again.errors));
  assert.equal(again.attempts.skippedEnded, 2);
  assert.equal(again.kernels.skippedEnded, 2);
}));

test('an archive refusal after selection is a terminal skip, not a sweep error', async (t) => withLedger(t, async ({ root, ledger, ledgerFile }) => {
  const workflowId = 'wf-usage-refusal';
  const dispatchId = 'ctx_eeeeeeeeeeee';
  seedWorkflow(ledger, { id: workflowId, state: { phase: 'running' }, jobs: [{ jobId: 'job-refusal', status: 'failed', pool: 'claude', dispatchId, payload: { model: 'claude', opId: 'test.op' } }] });
  session(root, workflowId, dispatchId);
  ledger.db.exec(`CREATE TRIGGER simulate_archive_refusal BEFORE INSERT ON llm_usage
    WHEN NEW.workflow_id='wf-usage-refusal' BEGIN SELECT RAISE(ABORT,'workflow-archived: no further writes'); END`);
  const result = await sweepUsage({ now: Date.now(), lookbackMs: 60_000, ledgerFiles: [{ name: 'fixture', file: ledgerFile }],
    archiveRoot: path.join(root, 'sessions'), env: { STARCI_AGENT_TRUST_HOME: path.join(root, 'empty-home') } });
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.deepEqual(result.errors, []);
  assert.equal(result.attempts.skippedEnded, 1);
  assert.equal(result.kernels.skippedEnded, 1);
  assert.equal(ledger.db.prepare('SELECT count(*) AS n FROM llm_usage').get().n, 0);
}));

test('missing usage adapters and session files remain unavailable, without sweep errors', async (t) => withLedger(t, async ({ root, ledger, ledgerFile }) => {
  const at = Date.now() - 60 * 60_000;
  seedWorkflow(ledger, { id: 'wf-usage-unavailable', state: { phase: 'running' }, now: at, jobs: [
    { jobId: 'job-devin', status: 'failed', pool: 'devin', payload: { model: 'devin', opId: 'test.op' } },
    { jobId: 'job-no-session', status: 'failed', pool: 'claude', payload: { model: 'claude', opId: 'test.op' } },
  ] });
  const result = await sweepUsage({ now: Date.now(), lookbackMs: 2 * 60 * 60_000, ledgerFiles: [{ name: 'fixture', file: ledgerFile }],
    archiveRoot: path.join(root, 'sessions'), env: { STARCI_AGENT_TRUST_HOME: path.join(root, 'empty-home') } });
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.equal(result.attempts.unavailable, 2);
  assert.equal(result.attempts.skippedEnded, 0);
  const rows = ledger.db.prepare("SELECT job_id,usage_source,usage_reason FROM op_attempts ORDER BY job_id").all();
  assert.deepEqual(rows.map(({ job_id, usage_source }) => [job_id, usage_source]), [['job-devin', 'unavailable'], ['job-no-session', 'unavailable']]);
  assert.match(rows[0].usage_reason, /no usage adapter/i);
  assert.match(rows[1].usage_reason, /no session file/i);
}));
