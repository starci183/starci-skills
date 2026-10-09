// Replay of the StarCi Kernel decisions of 2026-10-09 (dec-47a88c5428, dec-97f398806a, dec-32e5ded724): `starci kernel decide --choice enqueue-leg` answers that were reverted.
// The decide verb is admitted once, with a READ baseline taken before its step runs; its nested enqueue writes the new job, which adds the op's own files to the required set, and the
// recheck at that ledger write compared the whole sets: "required bytes changed during this call" (kernel-read-unverified), though no byte had changed. The same enqueue run
// directly was admitted with the op in its baseline and passed. Sequence: the real menu offers the item, the Kernel attests its READ of the op, then decides - through the real verb.
// Real: the Kernel verbs status, kernel-ack-rev and decide as child processes, the caller admission, the nested enqueue. Stubbed: the Orca binary only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadFixture, replayWorld } from '../helpers/replay-world.mjs';

const offered = (world) => world.status().menu.find((entry) => entry.kind === 'leg-ready');
const decide = (world, item) => world.cli('decide', ['--workflow', world.wf, '--item', item.id, '--choice', 'enqueue-leg', '--text', '.starciwork/features/own-1/ui', '--reason', 'the leg\'s write set']);
const jobsOf = (world) => world.ledger((ledger) => ledger.db.prepare("SELECT payload_json FROM jobs WHERE op_id='interface.draw'").all().map((row) => JSON.parse(row.payload_json).owned_paths));

test('a decide step that enqueues an op the Kernel attested its READ of is admitted: the new job\'s own files are no change of the bytes it read', (t) => {
  const world = replayWorld(t, loadFixture('leg-ready'), { tree: true });
  const item = offered(world);
  assert.equal(world.ack(['interface.draw']).status, 0, 'the Kernel attests its READ of the op');
  const answered = decide(world, item);
  assert.equal(answered.status, 0, answered.stderr || answered.stdout);
  assert.equal(answered.json.ok, true);
  assert.deepEqual(jobsOf(world), [['.starciwork/features/own-1/ui']], 'the leg is enqueued on the answer');
  const log = world.ledger((ledger) => ledger.db.prepare("SELECT payload_json FROM events WHERE kind='kernel-decision' ORDER BY seq").all().map((row) => JSON.parse(row.payload_json)));
  assert.notEqual(log.at(-1).status, 'revert');
});

test('a decide step that enqueues an op the Kernel life has NOT attested its READ of is still refused kernel-read-unverified, by the enqueue\'s own gate', (t) => {
  const world = replayWorld(t, loadFixture('leg-ready'), { tree: true });
  const answered = decide(world, offered(world));
  assert.notEqual(answered.status, 0);
  assert.match(JSON.stringify(answered.json), /kernel-read-unverified/);
  assert.doesNotMatch(JSON.stringify(answered.json), /required bytes changed during this call/, 'refused for the missing attestation, not for a byte that did not change');
  assert.deepEqual(jobsOf(world), [], 'nothing was enqueued');
});
