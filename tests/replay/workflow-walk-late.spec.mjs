// The walk of the two authentication workflows, legs 11 to 14, on the world with every leg before interface.audit settled: the leg that needs a Kernel-set audit matrix is offered with the
// option that carries it; the two legs the owner's switches defer (e2e.verify with specs.e2e=false, integration.verify without an explicit ask) settle deferred at enqueue, never dispatched,
// and release the leg behind them; review.verify is offered with its mode option and, enqueued with a concrete mode, passes the dispatch gate (the default mode `select` is planning only).
// Real: status, decide, enqueue, the dispatch push. Stubbed: the Orca binary.
import test from 'node:test';
import assert from 'node:assert/strict';
import { seededWalk } from '../helpers/walk-seed.mjs';

const AUDIT = { id: 'operation.identity.sign-in', feature: 'identity', selectedMatrix: { cells: [{ id: 'sign-in.desktop.light', surface: 'page', route: '/sign-in', state: 'initial', viewport: 'desktop', theme: 'light', assertionIds: ['visual-equivalence'] }] } };

const answer = (walk, item, text) => walk.world.cli('decide', ['--workflow', walk.world.wf, '--item', item.id, '--choice', item.options[0].choice, ...(text ? ['--text', text] : []), '--reason', 'walk']);

test('interface.audit takes its matrix through the menu; the deferred legs settle at enqueue; review.verify takes its mode through the menu', async (t) => {
  const walk = await seededWalk(t, 'interface.audit');
  const audit = walk.menuItem('interface.audit');
  assert.deepEqual(audit.options.map((option) => option.choice), ['enqueue-with-params', 'none-fits']);
  walk.ack('interface.audit');
  const queued = answer(walk, audit, JSON.stringify({ paths: '.starciwork/features/identity/ui', params: { audit: AUDIT } }));
  assert.equal(queued.status, 0, queued.stderr || queued.stdout);
  const job = walk.world.ledger((ledger) => ledger.db.prepare("SELECT status, payload_json FROM jobs WHERE op_id='interface.audit' AND role='op'").get());
  assert.equal(job.status, 'queued');
  assert.equal(JSON.parse(job.payload_json).params.audit.id, 'operation.identity.sign-in');
});

test('e2e.verify and integration.verify settle deferred at enqueue and review.verify is offered with its mode', async (t) => {
  const walk = await seededWalk(t, 'e2e.verify');
  const e2e = walk.menuItem('e2e.verify');
  assert.match(e2e.subject.situation, /deferred/, 'the item says the leg is deferred and releases the legs behind it');
  walk.ack('e2e.verify');
  const first = walk.world.cli('decide', ['--workflow', walk.world.wf, '--item', e2e.id, '--choice', 'enqueue-leg', '--text', '.starciwork/features/identity/uat,be/src', '--reason', 'walk']);
  assert.equal(first.status, 0, first.stderr || first.stdout);
  assert.equal(first.json.steps[0].out.status, 'succeeded', 'settled deferred at enqueue: no dispatch, no attempt');
  const integration = walk.menuItem('integration.verify');
  assert.ok(integration, 'the leg behind the deferred one is offered');
  walk.ack('integration.verify');
  const second = walk.world.cli('decide', ['--workflow', walk.world.wf, '--item', integration.id, '--choice', 'enqueue-leg', '--text', '.starciwork/features/identity/integration,be/src', '--reason', 'walk']);
  assert.equal(second.status, 0, second.stderr || second.stdout);
  assert.equal(second.json.steps[0].out.status, 'succeeded');
  const review = walk.menuItem('review.verify');
  assert.deepEqual(review.options.map((option) => option.choice), ['enqueue-with-params', 'none-fits'], 'the mode `select` the manifest defaults to is planning only: the Kernel names the mode');
  walk.ack('review.verify');
  const queued = answer(walk, review, JSON.stringify({ paths: '.starciwork/evidence/review', params: { mode: 'delivery' } }));
  assert.equal(queued.status, 0, queued.stderr || queued.stdout);
  const pushed = walk.dispatch().json.results[0];
  assert.notEqual(pushed.refusal?.code, 'params-invalid', `dispatch accepts a concrete mode: ${pushed.error}`);
});
