import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { withLedger, seedWorkflow } from '../helpers/ledger-fixture.mjs';
import { openMachine } from '../../engine/db/machine.mjs';
import { sweepUsage } from '../../scripts/kernel/usage-record.mjs';

// Orca opens every dispatched seat with its worker preamble (about 6 KB, naming a task id); the seat prompt follows `=== TASK ===`.
const preamble = `You are working inside Orca, a multi-agent IDE. You are a dispatched worker.\nYour coordinator's terminal handle is: term_1\nYour task ID is: task_0123456789ab\n${'orca orchestration check --json\n'.repeat(200)}\n=== TASK ===\n`;

const writeSeat = (dir, name, task) => {
  fs.mkdirSync(dir, { recursive: true });
  const usage = { type: 'assistant', sessionId: name, message: { id: `msg-${name}`, model: 'claude-opus-5-5', content: [], usage: { input_tokens: 5, output_tokens: 3, cache_read_input_tokens: 40, cache_creation_input_tokens: 0 } } };
  fs.writeFileSync(path.join(dir, `${name}.jsonl`),
    `${JSON.stringify({ type: 'user', timestamp: new Date().toISOString(), message: { content: `${preamble}${task}` } })}\n${JSON.stringify(usage)}\n`);
};

test('a Kernel and a Supervisor seat opened under the Orca worker preamble are metered, not taken for ops', async (t) => withLedger(t, async ({ root, ledger, ledgerFile }) => {
  const workflowId = 'wf-seat-preamble';
  seedWorkflow(ledger, { id: workflowId, state: { phase: 'running' }, jobs: [] });
  const sessions = path.join(root, 'sessions', 'claude');
  writeSeat(sessions, 'kernel-seat', `You are [Kernel] ${workflowId} — ONE long-lived agent.\nYour goal is inbox row 1.`);
  writeSeat(sessions, 'supervisor-seat', '[Supervisor] main\nPACKET FILE: your prompt is 23868 characters.');
  const env = { STARCI_AGENT_TRUST_HOME: path.join(root, 'empty-home'), STARCI_TEST_MACHINE_FILE: path.join(root, 'machine.sqlite') };
  openMachine({ env }).close();
  const result = await sweepUsage({ now: Date.now(), lookbackMs: 60_000, ledgerFiles: [{ name: 'fixture', file: ledgerFile }], archiveRoot: path.join(root, 'sessions'), env });
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.equal(result.kernels.recorded, 1);
  assert.equal(result.supervisor.recorded, 1);
  assert.equal(ledger.db.prepare("SELECT count(*) AS n FROM llm_usage WHERE subject_type='kernel-turn' AND workflow_id=?").get(workflowId).n, 1);
  const machine = openMachine({ env });
  try { assert.equal(machine.db.prepare("SELECT count(*) AS n FROM llm_usage WHERE subject_type='supervisor-turn'").get().n, 1); } finally { machine.close(); }
}));
