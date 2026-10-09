// Replay of the StarCi stall of 2026-10-09 (registry: kernel-answer-stored-through-redaction-never-matches-its-item): the Kernel answered none-fits to the item
// leg-ready:interface.draw:<node>:approved-leg-open 14 times. The ledger stores the answer through the redaction filter, which blanks what follows `password:` in the
// node name, so the stored item never equalled the live item, the snooze never held, and every status asked again - each ask a wake that counted toward the 8-wake
// rotation. The sequence: the real menu offers the item, the Kernel answers none-fits, the engine restarts, the menu is read again (twice).
// Real: the Kernel verbs `status` and `decide` as the bound Kernel (child processes), the work graph and plan read from the ledger, the engine (a fresh process).
// Stubbed: the Orca binary only. Fixture: tests/fixtures/replay/leg-ready.json (extracted from a ledger copy, neutral: the node keeps only the word the filter reacts to).
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadFixture, replayWorld } from '../helpers/replay-world.mjs';

const fixture = loadFixture('leg-ready');
const itemId = (menu) => menu.find((item) => item.kind === 'leg-ready')?.id;

test('a none-fits on an item whose id the redaction filter rewrites holds across stored spellings and an engine restart', (t) => {
  const world = replayWorld(t, fixture);
  const offered = world.status();
  const id = itemId(offered.menu);
  assert.match(id ?? '', /^leg-ready:interface\.draw:d-1\.s-1-password:approved-leg-open$/, 'the real menu offers the leg-ready item of the live node');
  assert.equal(offered.frontier.actionable, true);

  const answered = world.cli('decide', ['--workflow', world.wf, '--item', id, '--choice', 'none-fits', '--reason', 'no option fits']);
  assert.equal(answered.status, 0, answered.stderr || answered.stdout);
  const stored = world.ledger((ledger) => ledger.db.prepare("SELECT payload_json FROM events WHERE kind='kernel-decision'").all().map((row) => JSON.parse(row.payload_json).menu.item));
  assert.deepEqual(stored.map((item) => item.endsWith('[redacted]')), [true], 'the ledger holds the id through the filter: the live defect precondition');
  assert.notEqual(stored[0], id);

  const held = world.status();
  assert.deepEqual(held.menu.map((item) => item.id), [], 'the snooze holds against the stored spelling');
  assert.equal(held.frontier.actionable, false, 'so the watchdog has nothing to wake the Kernel for');

  assert.equal(world.engine({ controllers: ['job', 'workflow'], passes: 1 }).ok, true, 'the engine restarts over the answered item');
  const again = world.status();
  assert.deepEqual(again.menu.map((item) => item.id), [], 'still held after the restart');
  assert.equal(again.frontier.actionable, false);
  assert.equal(world.ledger((ledger) => ledger.db.prepare("SELECT count(*) n FROM events WHERE kind='kernel-decision'").get().n), 1, 'asking again recorded no second answer');
});
