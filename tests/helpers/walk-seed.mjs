// walk-seed.mjs - the world of the walk at the start of a later phase: the legs before it are settled rows of the ledger and their products are committed in the tree as the
// workflow's checkpoints (what the real chain of those legs leaves behind: tests/replay/workflow-walk-*.spec.mjs walk the legs of the phase itself, through the real chain).
// The products come from the same producers the stand-in ops use (tests/helpers/walk-standins.mjs), so a seeded prefix and a walked prefix hold the same records.
import path from 'node:path';
import { WALK_OPS, openWalk, walkFixture } from './walk-world.mjs';
import { GRAPH_V0, produceBrand, produceScope, put, writeFamilies } from './walk-standins.mjs';
import { RESOURCE_RECORDS } from './walk-records.mjs';

const PREFIX_PRODUCERS = {
  'scope.define': (walk) => produceScope(walk),
  'business.decide': (walk) => writeFamilies(walk, ['fr', 'br']),
  'architecture.decide': (walk) => writeFamilies(walk, ['sds', 'contract', 'integration']),
  'work.author': (walk) => [...writeFamilies(walk, ['impl', 'uat']), ...Object.entries(RESOURCE_RECORDS).map(([rel, text]) => put(walk.tree, `.starciwork/${rel}`, text))],
  'brand.decide': async (walk) => (await produceBrand(walk, { scratch: path.join(walk.world.base, 'seed-scratch') })).written,
};
export const SEEDABLE = Object.keys(PREFIX_PRODUCERS);

/** The ledger rows a walked prefix leaves: its jobs settled and the work graph v0 scope.define recorded. */
function seedHook(ledger, world) {
  const graph = GRAPH_V0(world.wf);
  const colors = Object.fromEntries(graph.nodes.map((node) => [node.id, 'gray']));
  ledger.db.prepare('INSERT INTO work_graph_versions(workflow_id,version,event,graph_json,diff_json,colors_json,reason,author_op,digest,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)')
    .run(world.wf, 0, 'draw', JSON.stringify(graph), '{}', JSON.stringify(colors), 'work graph v0', 'scope.define', 'walk-graph-v0', world.at(-3_600_000));
}

/** The walk world with every leg before `upTo` settled. Answers the walk (see walk-world.mjs) plus `prefix`: the ops seeded. */
export async function seededWalk(t, upTo) {
  const prefix = WALK_OPS.slice(0, WALK_OPS.indexOf(upTo)).filter((op) => op !== 'request.analyze');
  const fixture = walkFixture();
  fixture.jobs = prefix.map((op, index) => ({ id: `op-${op}-seed`, op, status: 'succeeded', at: { created: -3_600_000 + index * 1000, dispatched: -3_599_000 + index * 1000, updated: -3_000_000 + index * 1000 } }));
  const walk = openWalk(t, { fixture, seed: seedHook });
  for (const op of prefix) {
    await PREFIX_PRODUCERS[op]?.(walk);
    walk.world.tree.commit(`checkpoint ${walk.world.wf}: op-${op}-seed`);
  }
  return Object.assign(walk, { prefix });
}
