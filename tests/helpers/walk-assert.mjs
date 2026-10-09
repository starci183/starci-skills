// walk-assert.mjs - what every walked leg owes: it settled green through the real chain, the runtime committed its checkpoint, nothing was handed to the Kernel, and the next leg is offered.
import assert from 'node:assert/strict';
import { WALK_OPS } from './walk-world.mjs';
import { walkLeg } from './walk-legs.mjs';

const NEXT = (op) => WALK_OPS.slice(WALK_OPS.indexOf(op) + 1).find((candidate) => candidate !== 'request.analyze');

/** The failing steps of a walked leg, for a message that names where the walk stopped. */
export const stopsOf = (out) => JSON.stringify(out.steps.filter((step) => !step.ok).map((step) => ({ step: step.step, detail: step.detail?.json ?? step.detail?.result?.json ?? step.detail })), null, 1).slice(0, 3000);

/** Walks `op` and asserts it settled; answers the walk result. */
export async function walkSettled(walk, op) {
  const out = await walkLeg(walk, op, { within: ['features/identity'] });
  console.log('# walk', op, out.steps.map((step) => `${step.step}=${step.ms}`).join(' '));
  assert.equal(out.settled, true, `${op} did not settle (status ${out.status}): ${stopsOf(out)}`);
  const events = walk.events(['job-settle-needs-kernel', 'runtime-critic-run']);
  assert.deepEqual(events.filter((event) => event.kind === 'job-settle-needs-kernel'), [], 'nothing was handed to the Kernel');
  const log = walk.world.tree.git('log', '--format=%s', '-n', '3');
  assert.match(log, new RegExp(`checkpoint ${walk.world.wf}: .*${op.replace('.', '\.')}`), `the runtime committed the checkpoint of ${op}`);
  return out;
}

/** The leg after `op` is the Kernel's next menu item (the legs behind a deferred one are offered too). */
export function assertNextOffered(walk, op) {
  const next = NEXT(op);
  const offered = walk.status().menu.filter((item) => item.kind === 'leg-ready').map((item) => item.subject.op);
  assert.ok(offered.includes(next), `${next} is offered after ${op} (menu: ${offered.join(', ') || 'empty'})`);
}
