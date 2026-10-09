// Replay of the Nivo stall of 2026-10-09 (registry: prepared-fail-decision-blocks-every-later-settle, runtime-rewind-refused-by-its-own-history-hook): a Kernel chose
// settle-fail on a done architecture report. The tree registry had lost its checkpoint pointer, so the gate base fell back to the merge-base with main - behind the two
// settled ops - and the prepared fail decision aimed its branch rewind there; the apply died (the workflow-branch history hook refused the rewind) and left the receipt and
// a half reset index. Every later settle of the attempt then met workflow-checkpoint-recovery-conflict, and the Kernel was offered the same choice again and again.
// Sequence: the stalled state, a revision change, the engine restarts and passes (the settler withdraws the void receipt and judges the report afresh, the runtime's
// Critic failing it), the Kernel answers settle-fail (the real rewind through the history hook), a second engine pass.
// Real: the engine, the settler, the Kernel verbs `status` and `decide` (record-checks and settle as child verbs), a real git tree with the checkpoint chain, the branch
// history hook of the revision under test, the preserved/ refs. Stubbed: the Orca binary and the Critic agent launch (fake-critic-orca, a failing verdict).
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadFixture, replayWorld } from '../_replay/world.mjs';
import { admitReported } from '../_replay/admit.mjs';

const fixture = loadFixture('prepared-fail');
const [job] = fixture.jobs;
const count = (world, kind) => world.ledger((ledger) => ledger.db.prepare('SELECT count(*) n FROM events WHERE kind=?').get(kind).n);

test('a void prepared fail decision is withdrawn after a restart, the Kernel\'s settle-fail then rewinds the branch, and nothing blocks or wakes again', (t) => {
  const world = replayWorld(t, fixture, { tree: true, admit: admitReported });
  const { tree } = world;
  assert.match(tree.git('status', '--porcelain'), /^D /m, 'the world starts with the half reset index of the failed apply');
  assert.notEqual(tree.baseline, tree.checkpoints.at(-1), 'the receipt aims behind the settled ops');
  assert.equal(world.ack([job.op]).status, 0);

  world.reviseRuntime({ 'modules/kernel/note.md': 'the revision that fixes the apply\n' });
  const critic = { tree: tree.dir, op: job.op, within: ['features/d1/sds'], maker: 'claude', critic: 'codex', beauty: 4 };
  assert.equal(world.engine({ controllers: ['job'], passes: 1, critic }).ok, true);

  const withdrawn = world.ledger((ledger) => ledger.db.prepare("SELECT payload_json FROM events WHERE kind='workflow-op-preserved-withdrawn'").all().map((row) => JSON.parse(row.payload_json)));
  assert.equal(withdrawn.length, 1, 'the runtime withdrew the void receipt');
  assert.equal(withdrawn[0].code, 'prepared-settlement-withdrawn');
  assert.equal(tree.git('status', '--porcelain', '--', '.starciwork'), '', 'the index of the records follows HEAD again');

  const offered = world.status();
  const item = offered.menu.find((entry) => entry.id === `job-decision:${job.id}`);
  assert.ok(item, `the report is judged afresh and the Kernel is offered its one real choice: ${JSON.stringify(offered.menu.map((entry) => entry.id))}`);
  assert.ok(!item.options.some((option) => option.choice === 'accept'), 'a failed Critic verdict is not offered accept');

  const head = tree.git('rev-parse', 'HEAD');
  const answered = world.cli('decide', ['--workflow', world.wf, '--item', item.id, '--choice', 'settle-fail', '--reason', 'the critique stands']);
  assert.equal(answered.status, 0, answered.stderr || answered.stdout);
  const result = world.ledger((ledger) => ledger.db.prepare("SELECT payload_json FROM events WHERE kind='kernel-decision-result' ORDER BY seq DESC LIMIT 1").get());
  assert.notEqual(JSON.parse(result.payload_json).result, 'revert', `the settle-fail applied: ${result.payload_json}`);
  assert.equal(tree.git('rev-parse', 'HEAD'), tree.checkpoints.at(-1), 'the branch is back on its last settled checkpoint');
  assert.equal(tree.git('rev-parse', `refs/heads/preserved/${world.wf}/${job.id}`), head, 'what it held is kept under preserved/');
  assert.equal(world.ledger((ledger) => ledger.db.prepare('SELECT status FROM jobs WHERE job_id=?').get(job.id).status), 'failed');

  const doorbells = count(world, 'decision-doorbell');
  assert.equal(world.engine({ controllers: ['job'], passes: 1, critic }).ok, true, 'a second restart');
  const after = world.status();
  assert.deepEqual(after.menu.map((entry) => entry.id).filter((id) => id.includes(job.id)), [], 'nothing about the settled job is offered again');
  assert.equal(count(world, 'decision-doorbell'), doorbells, 'no wake loop: the Kernel is not rung for it');
  assert.equal(world.ledger((ledger) => ledger.db.prepare("SELECT count(*) n FROM events WHERE kind='workflow-op-preserved-prepared' AND created_at>0").get().n), 2, 'one prepared receipt of the replayed failure and one of the real apply; no third');
});
