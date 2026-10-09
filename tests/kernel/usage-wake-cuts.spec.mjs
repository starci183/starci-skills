// A seat's usage is cut at its wake events: the sweep reads the timestamps of the session's usage records, so two short adjacent wakes
// each own exactly their own turns and tokens, and a session that was recorded before the wake tags existed is never counted twice.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { withLedger, seedWorkflow } from '../helpers/ledger-fixture.mjs';
import { openMachine } from '../../engine/db/machine.mjs';
import { supervisorEvent } from '../../scripts/machine/home.mjs';
import { sweepUsage } from '../../scripts/kernel/usage-record.mjs';
import { exceededWakes, supervisorWakeBudget, supervisorWakeUsageOf, wakeUsageOf } from '../../scripts/kernel/wake-budget.mjs';

const WF = 'wf-wake-cuts';
const SECOND = 1000;
const preamble = `You are working inside Orca, a multi-agent IDE. You are a dispatched worker.\nYour task ID is: task_0123456789ab\n=== TASK ===\n`;
const ledgerWakes = [{ kind: 'kernel-woken', entityType: 'kernel', payload: { terminal: 't' } }];

/** A Claude session whose assistant messages sit at the given offsets (seconds from `t0`), each with `out` output tokens. */
const session = (dir, name, task, t0, messages) => {
  fs.mkdirSync(dir, { recursive: true });
  const lines = [{ type: 'user', timestamp: new Date(t0 - 3600 * SECOND).toISOString(), message: { content: `${preamble}${task}` } },
    ...messages.map(({ at, out }, index) => ({ type: 'assistant', sessionId: name, timestamp: new Date(t0 + at * SECOND).toISOString(),
      message: { id: `msg-${name}-${at}-${index}`, model: 'claude-opus-5-5', content: [], usage: { input_tokens: 10, output_tokens: out, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } } }))];
  fs.writeFileSync(path.join(dir, `${name}.jsonl`), `${lines.map((line) => JSON.stringify(line)).join('\n')}\n`);
};

const world = async (t, fn) => withLedger(t, async ({ root, ledger, ledgerFile }) => {
  const t0 = Date.now() - 600 * SECOND;
  seedWorkflow(ledger, { id: WF, state: { phase: 'running' }, jobs: [],
    events: [{ ...ledgerWakes[0], at: t0 }, { ...ledgerWakes[0], at: t0 + 60 * SECOND }] });
  const env = { STARCI_AGENT_TRUST_HOME: path.join(root, 'empty-home'), STARCI_TEST_MACHINE_FILE: path.join(root, 'machine.sqlite') };
  openMachine({ env }).close();
  const sweep = () => sweepUsage({ now: Date.now(), lookbackMs: 3600 * SECOND, ledgerFiles: [{ name: 'fixture', file: ledgerFile }], archiveRoot: path.join(root, 'sessions'), env });
  await fn({ root, ledger, t0, env, sweep, sessions: path.join(root, 'sessions', 'claude') });
});

test('two short adjacent wakes each own exactly their rows, and a later sweep adds only what grew', (t) => world(t, async ({ ledger, t0, sweep, sessions }) => {
  const task = `You are [Kernel] ${WF} — ONE long-lived agent.`;
  const first = [{ at: -10, out: 1 }, { at: 10, out: 100 }, { at: 20, out: 200 }, { at: 70, out: 3000 }];
  session(sessions, 'kernel-seat', task, t0, first);
  const result = await sweep();
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  const [a, b] = wakeUsageOf(ledger.db, WF);
  assert.deepEqual([a.turns, a.tokens], [2, 320], 'wake A owns the two messages inside it, not the third that belongs to wake B');
  assert.deepEqual([b.turns, b.tokens], [1, 3010]);
  const refs = ledger.db.prepare("SELECT turn_ref FROM llm_usage WHERE subject_type='kernel-turn' ORDER BY usage_id").all().map((row) => row.turn_ref.slice(row.turn_ref.indexOf('#')));
  assert.equal(refs.length, 3);
  assert.ok(refs.includes('#w0'), 'what the seat spent before its first wake carries the w0 tag and belongs to no wake');
  assert.equal((await sweep()).kernels.rows, 0, 'a second sweep over the same session writes nothing');
  session(sessions, 'kernel-seat', task, t0, [...first, { at: 80, out: 40 }]);
  await sweep();
  const [a2, b2] = wakeUsageOf(ledger.db, WF);
  assert.deepEqual([a2.turns, a2.tokens], [2, 320]);
  assert.deepEqual([b2.turns, b2.tokens], [2, 3060], 'wake B grew by the one new message');
  assert.deepEqual(exceededWakes([a2, b2], { turns: 2, tokens: 3000 }).map((wake) => wake.seq), [b2.seq]);
}));

test('rows recorded before the wake tags existed are taken off the earliest buckets, never counted twice', (t) => world(t, async ({ ledger, t0, sweep, sessions }) => {
  const task = `You are [Kernel] ${WF} — ONE long-lived agent.`;
  session(sessions, 'kernel-seat', task, t0, [{ at: -10, out: 1 }, { at: 10, out: 100 }, { at: 70, out: 3000 }]);
  ledger.db.prepare(`INSERT INTO llm_usage(workflow_id,subject_type,turn_ref,provider,response_model,input_tokens,output_tokens,cache_read_tokens,cache_write_tokens,turns,source,at)
    VALUES(?,'kernel-turn',?,'claude','claude-opus-5-5',20,101,0,0,2,'cli-transcript',?)`).run(WF, `kernel:${WF}:kernel-seat@2`, t0);
  await sweep();
  const total = ledger.db.prepare("SELECT sum(turns) AS turns, sum(output_tokens) AS out FROM llm_usage WHERE subject_type='kernel-turn'").get();
  assert.deepEqual([total.turns, total.out], [3, 3101], 'the older row covered the first two messages; only the third is new');
}));

test('the Supervisor session is cut at its supervisor-wake events and a wake over its token budget is reported', async (t) => withLedger(t, async ({ root, ledger, ledgerFile }) => {
  seedWorkflow(ledger, { id: WF, state: { phase: 'running' }, jobs: [] });
  const env = { STARCI_AGENT_TRUST_HOME: path.join(root, 'empty-home'), STARCI_TEST_MACHINE_FILE: path.join(root, 'machine.sqlite') };
  const t0 = Date.now() - 600 * SECOND;
  const machine = openMachine({ env });
  try { for (const at of [t0, t0 + 60 * SECOND]) supervisorEvent(machine, { kind: 'supervisor-wake', payload: { delivered: true }, now: at }); } finally { machine.close(); }
  session(path.join(root, 'sessions', 'claude'), 'supervisor-seat', '[Supervisor] main\nPACKET FILE: your prompt is 23868 characters.', t0, [{ at: 10, out: 4_000_000 }, { at: 20, out: 7_000_000 }, { at: 70, out: 50 }]);
  const result = await sweepUsage({ now: Date.now(), lookbackMs: 3600 * SECOND, ledgerFiles: [{ name: 'fixture', file: ledgerFile }], archiveRoot: path.join(root, 'sessions'), env });
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  const reader = openMachine({ env });
  try {
    const wakes = supervisorWakeUsageOf(reader.db);
    assert.deepEqual(wakes.map((wake) => [wake.turns, wake.tokens]), [[2, 11_000_020], [1, 60]]);
    assert.deepEqual(exceededWakes(wakes, supervisorWakeBudget()).map((wake) => wake.seq), [wakes[0].seq]);
  } finally { reader.close(); }
}));

test('what a new session reads between its boot and its first wake is the boot\'s, never the last wake of the session it replaced (Nivo wake of 22 turns, 2026-10-09)', (t) => world(t, async ({ ledger, t0, sweep, sessions }) => {
  ledger.transaction(() => ledger.appendEvent({ workflowId: WF, entityType: 'kernel', entityId: WF, kind: 'kernel-restarted', payload: { terminal: 't2' }, createdAt: t0 + 120 * SECOND }));
  session(sessions, 'kernel-old', `You are [Kernel] ${WF} — ONE long-lived agent.`, t0, [{ at: -10, out: 1 }, { at: 70, out: 300 }]);
  session(sessions, 'kernel-new', `You are [Kernel] ${WF} — ONE long-lived agent.`, t0, [{ at: 130, out: 50 }, { at: 140, out: 60 }, { at: 150, out: 70 }]);
  assert.equal((await sweep()).ok, true);
  const usage = wakeUsageOf(ledger.db, WF);
  assert.equal(usage.length, 3, 'two wakes and a boot');
  const [, wakeB, boot] = usage;
  assert.deepEqual([wakeB.boot ?? false, wakeB.turns], [false, 1], 'the last wake of the old session owns its own turn only');
  assert.deepEqual([boot.boot, boot.turns, boot.tokens], [true, 3, 210], 'the boot owns what the new session read before its first wake');
  const budget = { turns: 2, tokens: 1_000_000 };
  assert.deepEqual(exceededWakes(usage, budget).map((wake) => wake.seq), [boot.seq], 'judged by the wake budget, the boot is over it');
  assert.deepEqual(exceededWakes(usage, budget, { turns: 40, tokens: 1_000_000 }), [], 'a boot is judged by its own declared budget');
}));
