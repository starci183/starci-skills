// Replay of the premortem walk of the authentication workflows (interface.audit and provision.ask, legs 11 and 7 of the approved order): the leg-ready item offered a plain pick and a
// free-text write set for an op whose manifest requires a parameter only the Kernel sets, both refused `params-invalid`, and the Kernel seat cannot call `enqueue` itself.
// The sequence: the world with every leg before provision.ask settled, the Kernel reads the item, answers with the JSON option, the job is queued with its parameter.
// Real: status, decide and the enqueue it runs (child processes). Stubbed: the Orca binary.
import test from 'node:test';
import assert from 'node:assert/strict';
import { seededWalk } from '../helpers/walk-seed.mjs';

test('an op that requires a Kernel-set parameter is offered with the option that carries it, and the pick that cannot work is not offered', async (t) => {
  const walk = await seededWalk(t, 'provision.ask');
  const item = walk.menuItem('provision.ask');
  assert.ok(item, 'the leg is offered');
  assert.deepEqual(item.options.map((option) => option.choice), ['enqueue-with-params', 'none-fits'], 'no plain pick or write-set escape that the enqueue would refuse');
  assert.match(item.question, /subject/, 'the item names the parameter it needs');
  assert.equal(item.subject.paramsRequired, 'subject');

  walk.ack('provision.ask');
  const refused = walk.world.cli('decide', ['--workflow', walk.world.wf, '--item', item.id, '--choice', 'enqueue-with-params', '--text', 'not json', '--reason', 'walk']);
  assert.notEqual(refused.status, 0);
  assert.equal(refused.json.code, 'menu-text-invalid');

  const text = JSON.stringify({ paths: '.starciwork/features/identity/evidence', params: { subject: 'The mail provider key the sign-up confirmation needs' } });
  const answered = walk.world.cli('decide', ['--workflow', walk.world.wf, '--item', item.id, '--choice', 'enqueue-with-params', '--text', text, '--reason', 'walk']);
  assert.equal(answered.status, 0, answered.stderr || answered.stdout);
  const row = walk.world.ledger((ledger) => ledger.db.prepare("SELECT status, payload_json FROM jobs WHERE op_id='provision.ask' AND role='op'").get());
  assert.equal(row.status, 'queued');
  assert.equal(JSON.parse(row.payload_json).params.subject, 'The mail provider key the sign-up confirmation needs');
});
