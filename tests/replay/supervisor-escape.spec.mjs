// Replay of the StarCi stall of 2026-10-09 (registry: kernel-escape-opened-in-the-product-ledger-is-owned-by-nobody, kernel-escape-ruling-leaves-the-product-item-open):
// the Kernel's none-fits opens the Decision Item menu-escape in the product ledger for the Supervisor, who reads machine.sqlite only. The Workflow controller mirrors it
// as the Supervisor's twin; the Supervisor answers it with a ruling; the ruling must reach the Kernel and the product-ledger item must close. The sequence: the Kernel
// escapes the item, the engine runs (a fresh process), the Supervisor reads its menu and rules, the engine runs again.
// Real: Kernel verbs and the Supervisor's verbs (`starci supervisor status|decide`, children), the Workflow controller of the real engine (fresh processes).
// Stubbed: the Orca binary only (the Supervisor seat has no terminal; the Kernel terminal is the fake Orca's). Fixture: tests/fixtures/replay/leg-ready.json.
// The sequence is built once per process (shared fixture); both tests read the world it leaves.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { loadFixture, replayWorld } from '../helpers/replay-world.mjs';

const fixture = loadFixture('leg-ready');

/** The world after the Kernel escaped its menu item and the Supervisor ruled on the twin. */
function escapedAndRuled(t) {
  const world = replayWorld(t, fixture);
  const id = world.status().menu.find((item) => item.kind === 'leg-ready').id;
  const escaped = world.cli('decide', ['--workflow', world.wf, '--item', id, '--choice', 'none-fits', '--reason', 'no option fits']);
  assert.equal(escaped.status, 0, escaped.stderr || escaped.stdout);
  const items = () => world.ledger((ledger) => ledger.db.prepare('SELECT di_id, kind, decider, status FROM decision_items ORDER BY rowid').all());
  const escape = items().find((di) => di.kind === 'menu-escape');
  assert.equal(escape?.decider, 'supervisor', 'the escape is the Supervisor\'s item, opened in the product ledger');
  assert.equal(world.engine({ controllers: ['workflow'], passes: 1, unbound: true }).ok, true, 'the engine starts: the Workflow controller mirrors the escape');
  const twin = world.starci(['supervisor', 'status']).json.menu.find((item) => item.kind === 'kernel-escape');
  const ruled = twin ? world.starci(['supervisor', 'decide', '--item', twin.id, '--choice', 'rule', '--text', 'use the plan as written', '--reason', 'the plan names the write set']) : null;
  assert.equal(world.engine({ controllers: ['workflow'], passes: 1, unbound: true }).ok, true, 'and runs again (a restart) after the ruling');
  return { world, escape, twin, ruled, items };
}

const cleanups = [];
let shared;
before(() => { shared = escapedAndRuled({ after: (fn) => cleanups.push(fn) }); });
after(() => { for (const fn of cleanups.reverse()) fn(); });

test('a Kernel escape reaches the Supervisor menu, and the Supervisor\'s ruling reaches the Kernel as a Decision Item with a doorbell', () => {
  const { world, twin, ruled, items } = shared;
  assert.ok(twin, 'the Supervisor menu holds the escape (kind kernel-escape)');
  assert.equal(ruled.status, 0, ruled.stderr || ruled.stdout);
  assert.equal(ruled.json.resolved, true, 'the Supervisor\'s own item is resolved');
  const ruling = items().find((di) => di.kind === 'supervisor-ruling');
  assert.deepEqual([ruling?.decider, ruling?.status], ['kernel', 'open'], 'the ruling is a Kernel Decision Item in the product ledger');
  const doorbell = world.ledger((ledger) => ledger.db.prepare("SELECT count(*) n FROM events WHERE kind='decision-doorbell'").get().n);
  assert.equal(doorbell, 1, 'the Kernel is rung once for it');
});

// The mirror's loop closes (registry: kernel-escape-ruling-leaves-the-product-item-open): the Workflow controller resolves the product-ledger item once the Supervisor answered its twin.
test('the product-ledger menu-escape item closes once the Supervisor ruled on it', () => {
  const { escape, items } = shared;
  const after = items().find((di) => di.di_id === escape.di_id);
  assert.notEqual(after.status, 'open', `menu-escape ${escape.di_id} is still ${after.status} after the Supervisor ruled`);
  assert.equal(after.status, 'resolved');
});
