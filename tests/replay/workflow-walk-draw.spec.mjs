// The walk of the two authentication workflows, leg 6, interface.draw. The draw loop itself (render tool, image generation, the independent critic, the owner's draw-review ask) needs a
// host the replay world does not have, so the walk goes as far as the chain owns it without that host: the leg is offered with a write set the contract proposes, the dispatch passes the
// grammar-context gate on the brand record the previous leg left, the packet the op reads names the report command, and a `done` that omits the native producer of a mechanism proof is
// refused at report time with the exact command to run (never accepted and failed later at settle).
// Real: status, decide, enqueue, dispatch, report. Stubbed: the Orca binary.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { seededWalk } from '../helpers/walk-seed.mjs';
import { packetOf } from '../helpers/walk-world.mjs';
import { enqueueLeg } from '../helpers/walk-legs.mjs';

test('interface.draw: dispatched on the brand record of the brand leg, and a done without the lint producer is refused at report with the command', async (t) => {
  const walk = await seededWalk(t, 'interface.draw');
  const item = walk.menuItem('interface.draw');
  assert.ok(item.options.some((option) => option.choice === 'enqueue-proposed'), 'the contract proposes the ui family of the features');
  const queued = enqueueLeg(walk, 'interface.draw');
  assert.equal(queued.ok, true, JSON.stringify(queued.result?.json));
  const dispatched = walk.dispatch().json.results[0];
  assert.equal(dispatched.dispatched, true, `${dispatched.error}`);
  const packet = fs.readFileSync(packetOf(walk.world, queued.jobId), 'utf8');
  assert.match(packet, /starci kernel report|cli\.mjs report/, 'the packet teaches the report command');
  const filed = walk.file(queued.jobId, { schema: 'starci/op-report@1', outcome: 'done', summary: 'probe', files: [], checks: [] });
  assert.equal(filed.status, 1);
  assert.equal(filed.json.code, 'report-proof-producer-missing');
  assert.match(filed.json.error, /starci app lint --format json/, 'the refusal names the producer to run and to list in report.checks');
  assert.equal(walk.job(queued.jobId).status, 'running', 'the op still owns the attempt: it repairs the report');
});
