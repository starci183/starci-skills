// Replay of the StarCi stall of 2026-10-09 (registry: kernel-read-attestation-over-the-inline-event-bound): the revision that added interface.draw to the Kernel's read plan
// made the plan's attestation 19267 bytes against the 16384 inline bound of an event, so `kernel-ack-rev` failed with STARCI_EVENT_PAYLOAD_TOO_LARGE and every new leg was
// refused kernel-read-unverified. The sequence: an ack that fits, an engine restart, the revision that grows the plan, the ack of the grown plan, a new leg.
// Real: the Kernel verbs as the bound Kernel (child processes), the reconciler engine (real controllers, a fresh process), the git runtime root with two revisions.
// Stubbed: the Orca binary only (nothing here launches an agent). Fixture: tests/fixtures/replay/read-plan.json (extracted from a ledger copy, neutral).
import test from 'node:test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { loadFixture, replayWorld } from '../helpers/replay-world.mjs';
import { getBlob } from '../../engine/db/blob.mjs';

const INLINE_BOUND = 16384;
const OP = 'review.verify';
const fixture = loadFixture('read-plan');
// A new leg is admitted past the READ gate when its params, not its attestation, are what the verb refuses.
const newLeg = (world) => world.cli('enqueue', ['--workflow', world.wf, '--op', OP, '--paths', 'docs/x', '--params', '{invalid']);
const ackRows = (world) => world.ledger((ledger) => ledger.db.prepare("SELECT length(payload_json) inline, payload_sha FROM events WHERE kind='runtime-rev-acked' ORDER BY seq").all());

test('the ack of a read plan that outgrew the inline event bound lands after an engine restart and a revision change, and the next leg is admitted', (t) => {
  const world = replayWorld(t, fixture);
  const plan = world.cli('kernel-ack-rev', ['--workflow', world.wf, '--plan', '--op', OP]).json;
  assert.equal(plan.bundle.files, plan.unread.length, 'the whole unread set is ONE file to read, not one tool call per path');
  const bundled = fs.readFileSync(plan.bundle.file, 'utf8');
  for (const row of plan.readManifest.files) assert.ok(bundled.includes(`===== ${row.path} (${row.bytes} bytes, sha256 ${row.sha256}) =====`), row.path);
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
  assert.ok(rows[1].inline < 512, `the row keeps a bounded inline view of the scalars (${rows[1].inline} bytes), not the manifest`);
  assert.ok(rows[1].inline < INLINE_BOUND / 8, 'and that view is a small fraction of the inline bound');
  const whole = world.ledger((ledger) => ledger.db.prepare("SELECT payload_json, payload_sha FROM events WHERE kind='runtime-rev-acked' ORDER BY seq DESC LIMIT 1").get());
  assert.ok(getBlob(whole.payload_sha, { root: world.env.STARCI_ARTIFACT_ROOT }).length > INLINE_BOUND, 'the whole attestation resolves behind the sha and is larger than the inline bound');
  assert.match(rows[1].payload_sha, /^[0-9a-f]{64}$/, 'the whole attestation is behind the sha');

  assert.equal(newLeg(world).json?.code, 'params-invalid', 'the READ gate passes: the verb now refuses only the params');
  assert.equal(world.status().kernelRev.stale, false);
});
