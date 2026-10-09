// Replay of the other two answers to the Kernel's escape (registry: kernel-escape-ruling-leaves-the-product-item-open): the StarCi Supervisor answered di-16537df8 and di-866fd7b8
// with record-defect, which reaches Debug and never the Kernel, and both items stayed open. The Workflow controller of the real engine (fresh processes, unbound as the live one is)
// closes the product item and tells the Kernel, as a supervisor-ruling Decision Item with a doorbell, that no answer will follow.
// Real: Kernel verbs, the Supervisor's verbs, the engine. Stubbed: the Orca binary only. Fixture: tests/fixtures/replay/leg-ready.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadFixture, replayWorld } from '../helpers/replay-world.mjs';

test('a record-defect answer closes the product item and tells the Kernel it will not be ruled on', (t) => {
  const world = replayWorld(t, loadFixture('leg-ready'));
  const id = world.status().menu.find((item) => item.kind === 'leg-ready').id;
  assert.equal(world.cli('decide', ['--workflow', world.wf, '--item', id, '--choice', 'none-fits', '--reason', 'no option fits']).status, 0);
  const engine = () => assert.equal(world.engine({ controllers: ['workflow'], passes: 1, unbound: true }).ok, true);
  engine();
  const twin = world.starci(['supervisor', 'status']).json.menu.find((item) => item.kind === 'kernel-escape');
  const decided = world.starci(['supervisor', 'decide', '--item', twin.id, '--choice', 'record-defect', '--text', 'read-manifest-refused', '--reason', 'the attestation is refused by the runtime']);
  assert.equal(decided.status, 0, decided.stderr || decided.stdout);
  engine();
  const items = world.ledger((ledger) => ledger.db.prepare('SELECT kind, decider, status, summary FROM decision_items ORDER BY rowid').all());
  assert.equal(items.find((di) => di.kind === 'menu-escape').status, 'resolved', 'the escape is closed');
  const notice = items.find((di) => di.kind === 'supervisor-ruling');
  assert.deepEqual([notice?.decider, notice?.status], ['kernel', 'open']);
  assert.match(notice.summary, /recorded your escape .* as a runtime defect for Debug.*do not retry/);
  assert.equal(world.ledger((ledger) => ledger.db.prepare("SELECT count(*) n FROM events WHERE kind='decision-doorbell'").get().n), 1, 'the Kernel is rung once for it');
  engine();
  assert.equal(world.ledger((ledger) => ledger.db.prepare("SELECT count(*) n FROM decision_items WHERE kind='supervisor-ruling'").get().n), 1, 'a later pass opens nothing more');
});
