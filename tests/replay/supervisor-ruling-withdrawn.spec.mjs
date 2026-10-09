// Replay of the StarCi ruling di-ddda767e of 2026-10-09 (registry: supervisor-ruling-contradicted-by-the-runtime-stands): the Supervisor ruled "do not run op-work.author-ab81f9802d
// again in the same shape" on the Kernel's escape of shape-refused:<job>; the dispatch guard fix then let that very job run. The runtime withdraws the ruling it contradicts, with the
// reason, and shows it to the Supervisor. Sequence: the escape (the world has the retry ready, its curing leg landed), the engine mirrors it, the Supervisor rules, the engine runs again.
// Real: the engine's Workflow controller (fresh processes, unbound as the live one is), the Supervisor's verbs, the Kernel's decisions verb. Stubbed: the Orca binary only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { loadFixture, replayWorld } from '../helpers/replay-world.mjs';
import { openDecisionRow } from '../../scripts/machine/decisions.mjs';

const fixture = loadFixture('shape-guard');
const retry = fixture.jobs.find((job) => job.retryOf);

test('a ruling not to run a shape again is withdrawn, with its reason shown to the Supervisor, once the guard lets that job run', (t) => {
  const world = replayWorld(t, fixture, { tree: true });
  world.ledger((ledger) => openDecisionRow(ledger, { workflowId: world.wf, kind: 'menu-escape', decider: 'supervisor', entity: { type: 'workflow', id: world.wf },
    idempotencyKey: `menu-escape:${world.wf}:shape-refused:${retry.id}`, summary: `Kernel: no option of shape-refused:${retry.id} fits: not a narrow grant`, by: 'kernel' }));
  const engine = () => assert.equal(world.engine({ controllers: ['workflow'], passes: 1, unbound: true }).ok, true);
  engine();
  const twin = world.starci(['supervisor', 'status']).json.menu.find((item) => item.kind === 'kernel-escape');
  assert.ok(twin, 'the escape reaches the Supervisor menu');
  const ruled = world.starci(['supervisor', 'decide', '--item', twin.id, '--choice', 'rule', '--text', `do not run ${retry.id} again in the same shape`, '--reason', 'an SDS gap']);
  assert.equal(ruled.status, 0, ruled.stderr || ruled.stdout);
  const rulings = () => world.ledger((ledger) => ledger.db.prepare("SELECT status, resolved_by, resolution_verb FROM decision_items WHERE kind='supervisor-ruling'").all());
  assert.equal(rulings().length, 1);
  engine();
  const [ruling] = rulings();
  assert.deepEqual([ruling.status, ruling.resolved_by, ruling.resolution_verb], ['resolved', 'runtime', 'ruling-withdrawn'], 'the contradicted ruling is withdrawn by the runtime');
  const machine = new DatabaseSync(world.machineFile, { readOnly: true });
  const shown = machine.prepare("SELECT payload_json FROM sup_events WHERE kind='supervisor-action' AND entity_id LIKE 'ruling-withdrawn:%'").all();
  machine.close();
  assert.equal(shown.length, 1, 'the withdrawal is a Supervisor action record');
  assert.match(shown[0].payload_json, /no longer refuses the shape of/);
});
