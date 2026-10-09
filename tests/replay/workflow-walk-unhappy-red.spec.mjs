// An unhappy path of the walk of the two authentication workflows, on a late leg (work.author): it ends in exactly one owned next step and never in silence.
// Real: status, decide, enqueue, dispatch, report, the engine, its settler (checks re-run in the tree) and the failure router. Stubbed: the Orca binary, the op itself.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { seededWalk } from '../helpers/walk-seed.mjs';
import { ownedNext, startLeg } from '../helpers/walk-scenarios.mjs';
import { STANDINS } from '../helpers/walk-standins.mjs';

test('a done report whose check is red when the settler re-runs it is failed by the settler and retried by the runtime', async (t) => {
  const walk = await seededWalk(t, 'work.author');
  const { jobId } = startLeg(walk, 'work.author');
  const work = await STANDINS['work.author']({ walk, jobId });
  const record = `${walk.tree}/.starciwork/features/identity/impl/be/account/index.yaml`;
  fs.writeFileSync(record, fs.readFileSync(record, 'utf8').replace('state: todo', 'state: bogus'));
  const filed = walk.file(jobId, work.report, work.attach);
  assert.equal(filed.status, 0, 'the report declares green checks: the settler does not trust them');
  walk.engine({ op: 'work.author', passes: 2 });
  const next = ownedNext(walk, 'work.author');
  assert.equal(next.jobs[0].status, 'failed');
  assert.deepEqual(next.routed.map((route) => route.route), ['rejected-report-retries']);
  assert.equal(next.jobs.length, 2, 'the retry is enqueued by the route');
  assert.deepEqual(next.menu, []);
  assert.deepEqual(next.incidents, []);
});
