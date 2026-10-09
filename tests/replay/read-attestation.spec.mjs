// Replay of the StarCi stall of 2026-10-09 (registry: kernel-read-attestation-over-the-inline-event-bound): the revision that added interface.draw to the Kernel's read plan
// made the plan's attestation 19267 bytes against the 16384 inline bound of an event, so `kernel-ack-rev` failed with STARCI_EVENT_PAYLOAD_TOO_LARGE and every new leg was
// refused kernel-read-unverified. The sequence: an ack that fits, an engine restart, the revision that grows the plan, the ack of the grown plan, a new leg.
// Real: the Kernel verbs as the bound Kernel (child processes), the reconciler engine (real controllers, a fresh process), the git runtime root with two revisions.
// Stubbed: the Orca binary only (nothing here launches an agent). Fixture: tests/fixtures/replay/read-plan.json (extracted from a ledger copy, neutral).
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadFixture, replayWorld } from '../helpers/replay-world.mjs';

const INLINE_BOUND = 16384;
const OP = 'review.verify';
const fixture = loadFixture('read-plan');
// A new leg is admitted past the READ gate when its params, not its attestation, are what the verb refuses.
const newLeg = (world) => world.cli('enqueue', ['--workflow', world.wf, '--op', OP, '--paths', 'docs/x', '--params', '{invalid']);
const ackRows = (world) => world.ledger((ledger) => ledger.db.prepare("SELECT length(payload_json) inline, payload_sha FROM events WHERE kind='runtime-rev-acked' ORDER BY seq").all());

test('the ack of a read plan that outgrew the inline event bound lands after an engine restart and a revision change, and the next leg is admitted', (t) => {
  const world = replayWorld(t, fixture);
  const first = world.ack([OP]);
  assert.equal(first.status, 0, `the first plan fits and is attested: ${first.stderr}`);
  const [small] = ackRows(world);
  assert.ok(small.inline > INLINE_BOUND * 0.85 && small.inline < INLINE_BOUND && small.payload_sha === null, `the world reproduces the live size: the first ack is ${small.inline} bytes inline`);

  const restarted = world.engine({ controllers: ['job', 'workflow'], passes: 1 });
  assert.equal(restarted.ok, true, 'the engine restarts over the world');

  world.growReadPlan();
  assert.equal(world.status().kernelRev.stale, true, 'the revision change makes the Kernel stale');
  const refused = newLeg(world);
  assert.equal(refused.json?.code, 'kernel-read-unverified', 'a new leg waits for the ack of the new revision');

  const second = world.ack([OP]);
  assert.equal(second.status, 0, `the ack of the grown plan lands: ${second.stderr || second.stdout}`);
  assert.notEqual(second.json?.code, 'STARCI_EVENT_PAYLOAD_TOO_LARGE');
  const rows = ackRows(world);
  assert.equal(rows.length, 2);
  assert.equal(rows[1].inline, null, 'the row keeps no inline JSON');
  assert.match(rows[1].payload_sha, /^[0-9a-f]{64}$/, 'the whole attestation is behind the sha');

  assert.equal(newLeg(world).json?.code, 'params-invalid', 'the READ gate passes: the verb now refuses only the params');
  assert.equal(world.status().kernelRev.stale, false);
});
