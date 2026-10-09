// Replay of the Nivo stall of 2026-10-09 (registry: gate-newer-than-the-job-it-refuses, runtime-critic-launched-without-a-sender-terminal): architecture.decide had been
// reported done and admitted before the Critic gate existed; the settler refused it op-critic-verdict-missing and handed it to the Kernel, whose every choice then
// failed (the op's worker was gone and its contract never told it to run a Critic). After a revision change the RUNTIME owes that Critic: the settler runs it, judges
// its verdict like an attached one, and the report settles; nothing is offered to the Kernel and nobody is woken.
// Sequence: the handed-over job, the Kernel attests its READ, the runtime revision changes, the engine starts (a fresh process) and passes once.
// Real: the engine, the job controller, the settler (reconcileJobSettle: re-verified checks, the Critic gate, record-checks and settle as child verbs), the work tree
// (a git repository registered as the workflow worktree), the admission and read-knowledge proof of the op. Stubbed: the Orca binary and the Critic agent launch
// (tests/helpers/fake-critic-orca.mjs through the settler's criticSeams, which hands back a verdict document over the real product digests).
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadFixture, replayWorld } from '../helpers/replay-world.mjs';
import { admitReported } from '../helpers/replay-admit.mjs';

const fixture = loadFixture('handed-over');
const [job] = fixture.jobs;

test('a done report refused for a missing Critic verdict is judged with the runtime\'s own Critic after a revision change, and nothing is offered to the Kernel', (t) => {
  const world = replayWorld(t, fixture, { tree: true, admit: admitReported });
  assert.equal(world.ack([job.op]).status, 0, 'the Kernel attests its READ of the op');
  const before = world.status();
  assert.deepEqual(before.menu.map((item) => item.id), [], 'the settle the runtime owes is no choice of the Kernel');
  assert.equal(before.frontier.actionable, false);

  world.reviseRuntime({ 'modules/kernel/note.md': 'a revision the settler judges again\n' });
  const out = world.engine({ controllers: ['job'], passes: 1, critic: { tree: world.tree.dir, op: job.op, within: ['features/d1/sds'], maker: 'claude', critic: 'codex' } });
  assert.equal(out.ok, true);

  const runs = world.ledger((ledger) => ledger.db.prepare("SELECT payload_json FROM events WHERE kind='runtime-critic-run' ORDER BY seq").all().map((row) => JSON.parse(row.payload_json)));
  assert.equal(runs.length, 1, 'the runtime ran the Critic once');
  assert.deepEqual([runs[0].outcome, runs[0].pass, runs[0].maker, runs[0].critic.provider], ['verdict', true, 'claude', 'codex'], 'a verdict of an independent provider');
  const state = world.ledger((ledger) => ({
    status: ledger.db.prepare('SELECT status FROM jobs WHERE job_id=?').get(job.id).status,
    handovers: ledger.db.prepare("SELECT count(*) n FROM events WHERE kind='job-settle-needs-kernel'").get().n,
    doorbells: ledger.db.prepare("SELECT count(*) n FROM events WHERE kind='decision-doorbell'").get().n,
  }));
  assert.equal(state.status, 'succeeded', 'the report settled');
  assert.equal(state.handovers, 1, 'no second handover: only the one the replay started from');
  assert.equal(state.doorbells, 0, 'the Kernel was not rung');
  const after = world.status();
  assert.deepEqual(after.menu.map((item) => item.id).filter((id) => id.includes(job.id)), [], 'nothing about the job is offered to the Kernel');
});
