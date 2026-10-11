// The runtime's own Critic is a worker of its own: its tokens are measured from its session like an op attempt's. The settler records the run
// (event runtime-critic-run, with the worker's dispatch and task id); the usage sweep finds the session by the task id the Orca preamble names and
// appends one runtime-critic-usage event per run, once. The status line and the digest read the tokens from it; a run with no session yet stays unmeasured.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { withLedger, seedWorkflow } from '../helpers/ledger-fixture.mjs';
import { openMachine } from '../../engine/db/machine.mjs';
import { sweepUsage } from '../../scripts/kernel/usage-record.mjs';
import { CRITIC_USAGE_EVENT, criticRunsWithoutUsage, criticUsagePayload } from '../../scripts/kernel/critic-run-usage.mjs';
import { RUNTIME_CRITIC_EVENT } from '../../scripts/kernel/settle/critic-run.mjs';
import { runtimeCriticLine, runtimeCriticsOf } from '../../scripts/kernel/verbs/shared/status-critic.mjs';
import { eventFacts } from '../../scripts/reconciler/debug-digest-ledger.mjs';
import { loadQuestions, answerQuestions } from '../../scripts/reconciler/debug-questions.mjs';
import { digestNumbers } from '../../scripts/reconciler/debug-digest-numbers.mjs';

const TASK = 'task_c0ffee123456';
const preamble = `You are working inside Orca, a multi-agent IDE. You are a dispatched worker.\nYour coordinator's terminal handle is: term_1\nYour task ID is: ${TASK}\n${'orca orchestration check --json\n'.repeat(50)}\n=== TASK ===\n`;

const writeCriticSession = (dir) => {
  fs.mkdirSync(dir, { recursive: true });
  const usage = { type: 'assistant', sessionId: 'critic-session', message: { id: 'msg-critic', model: 'claude-opus-5-5', content: [], usage: { input_tokens: 50, output_tokens: 30, cache_read_input_tokens: 400, cache_creation_input_tokens: 20 } } };
  fs.writeFileSync(path.join(dir, 'critic-session.jsonl'),
    `${JSON.stringify({ type: 'user', timestamp: new Date().toISOString(), message: { content: `${preamble}You are an independent senior reviewer of ONE decision of kind architecture.decide.` } })}\n${JSON.stringify(usage)}\n`);
};

const run = { jobId: 'op-arch', workflowId: 'wf-cu', op: 'architecture.decide', digest: 'd1', maker: 'codex', try: 1, outcome: 'verdict', pass: true,
  critic: { provider: 'claude', model: 'claude-opus-5-5', dispatchId: 'ctx_aaaaaaaaaaaa', taskId: TASK, durationMs: 91_000, tokens: null } };

test('the sweep measures the tokens of a runtime Critic run from its session, once, and the status and the digest print them', async (t) => withLedger(t, async ({ root, ledger, ledgerFile }) => {
  seedWorkflow(ledger, { id: 'wf-cu', state: { phase: 'running' }, jobs: [{ jobId: 'op-arch', opId: 'architecture.decide', status: 'reported', payload: { opId: 'architecture.decide' } }] });
  ledger.transaction(() => ledger.appendEvent({ workflowId: 'wf-cu', entityType: 'job', entityId: 'op-arch', kind: RUNTIME_CRITIC_EVENT, payload: run }));
  assert.equal(runtimeCriticLine(runtimeCriticsOf(ledger.db, 'wf-cu')[0]).includes('tokens unmeasured'), true, 'no session indexed yet: unmeasured, not zero');
  assert.deepEqual(criticRunsWithoutUsage(ledger.db).map((r) => r.jobId), ['op-arch']);

  const sessions = path.join(root, 'sessions', 'claude');
  writeCriticSession(sessions);
  const env = { STARCI_AGENT_TRUST_HOME: path.join(root, 'empty-home'), STARCI_TEST_MACHINE_FILE: path.join(root, 'machine.sqlite') };
  openMachine({ env }).close();
  const sweep = () => sweepUsage({ now: Date.now(), lookbackMs: 60_000, ledgerFiles: [{ name: 'fixture', file: ledgerFile }], archiveRoot: path.join(root, 'sessions'), env });
  const first = await sweep();
  assert.equal(first.ok, true, JSON.stringify(first.errors));
  assert.equal(first.critics.recorded, 1);
  const second = await sweep();
  assert.equal(second.critics.recorded, 0, 'one usage event per run');
  const events = ledger.db.prepare('SELECT payload_json FROM events WHERE kind=?').all(CRITIC_USAGE_EVENT).map((row) => JSON.parse(row.payload_json));
  assert.equal(events.length, 1);
  assert.deepEqual([events[0].jobId, events[0].tokensIn, events[0].tokensOut, events[0].tokens], ['op-arch', 470, 30, 500], 'fresh input, cache read and cache write are the tokens read; the output is the tokens written');
  assert.ok(events[0].costUsd >= 0);

  const line = runtimeCriticLine(runtimeCriticsOf(ledger.db, 'wf-cu')[0]);
  assert.match(line, /tokens 500,/);
  const facts = eventFacts(ledger.db, 'wf-cu');
  const groups = loadQuestions().map((g) => ({ ...g, questions: g.questions.filter((q) => q.id === 'co-critic-independent') }));
  const answer = answerQuestions(groups, {}, { now: Date.now(), workflows: [{ events: facts }] }, digestNumbers()).flatMap((g) => g.questions)[0];
  assert.match(answer.evidence, /91000ms tokens 500 pass/);
}));

test('a session the agent cannot meter records why, and a run with no session is left for a later sweep', () => {
  const runRow = { jobId: 'j', workflowId: 'w', op: 'scope.define', dispatchId: 'ctx_bbbbbbbbbbbb', taskId: null, provider: 'codex', digest: 'd' };
  assert.equal(criticUsagePayload(runRow, []), null);
  const index = [{ role: 'op', dispatchId: 'ctx_bbbbbbbbbbbb', agent: 'codex', file: 'x.jsonl' }];
  const payload = criticUsagePayload(runRow, index, { extract: () => ({ ok: false, reason: 'no usage record' }) });
  assert.deepEqual([payload.tokens, payload.reason], [null, 'no usage record']);
});
