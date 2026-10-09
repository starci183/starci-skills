// Replay of the premortem walk of the authentication workflows (no live occurrence yet - this is the sequence a fresh release would meet): a freshly approved goal has no job, the
// Kernel seat cannot enqueue (its shell is `decide`), and the runtime offered nothing: the frontier read orphaned-frontier and not actionable, the menu was empty, and no leg ever began.
// The sequence: the world of a fresh goal, status, the Kernel answers the leg-ready item of the first leg through `decide`, the engine restarts and dispatches it.
// Real: status, decide and the enqueue it runs, the dispatch push, the engine. Stubbed: the Orca binary.
import test from 'node:test';
import assert from 'node:assert/strict';
import { openWalk } from '../helpers/walk-world.mjs';

test('a fresh goal offers its first leg on the Kernel menu, and the Kernel starts the workflow through decide', (t) => {
  const walk = openWalk(t);
  const status = walk.status();
  const item = status.menu.find((entry) => entry.kind === 'leg-ready');
  assert.ok(item, `the first leg is offered: ${JSON.stringify(status.menu.map((entry) => entry.id))} (frontier ${status.frontier.state})`);
  assert.equal(item.subject.op, 'scope.define', 'the first leg after the external intake leg');
  assert.equal(status.frontier.actionable, true, 'the Kernel is woken for it');
  assert.equal(status.menu.some((entry) => entry.subject?.op === 'business.decide'), false, 'only the first leg: the legs behind it wait');
  walk.ack('scope.define');
  const answered = walk.world.cli('decide', ['--workflow', walk.world.wf, '--item', item.id, '--choice', 'enqueue-leg', '--text', '.starciwork/features/identity,.starciwork/index.yaml', '--reason', 'the first leg']);
  assert.equal(answered.status, 0, answered.stderr || answered.stdout);
  const jobs = walk.world.ledger((ledger) => ledger.db.prepare("SELECT op_id, status FROM jobs WHERE role='op'").all());
  assert.deepEqual(jobs.map((job) => [job.op_id, job.status]), [['scope.define', 'queued']]);
  const after = walk.status();
  assert.deepEqual(after.menu.filter((entry) => entry.kind === 'leg-ready'), [], 'the leg has a job: nothing is offered twice');
});
