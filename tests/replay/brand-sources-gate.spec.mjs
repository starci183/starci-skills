// A settled brand product that supplies no family CSS refuses the draw dispatch. The real runtime's first refusal
// exposes the upstream owner and field during backoff; the brand's own settler independently measures that same input.
// Real: dispatch, status/menu, decide, digest and the engine/settler. Stubbed: Orca and the engine's Critic agent only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadFixture, replayWorld } from '../helpers/replay-world.mjs';

const NO_SOURCES = 'schema: work/brand@1\nkind: brand\nbrand:\n  identity:\n    family: starci\n';
const BRAND = `${NO_SOURCES}  sources:\n    - path: brand-theme.css\n`;
const push = (world) => world.cli('dispatch-ready', ['--workflow', world.wf, '--foreground']).json;
const gaps = (world) => world.status().menu.filter((item) => item.kind === 'dispatch-gap');
const fixtureOf = () => {
  const fixture = loadFixture('grammar-in-tree');
  fixture.jobs[0].extra = { owned_paths: ['.starciwork/brand'] };
  fixture.jobs[1].at = { created: 0, updated: 0 };
  return fixture;
};

test('the first typed brand refusal exposes one upstream repair during backoff, with an owner in the digest', (t) => {
  const world = replayWorld(t, fixtureOf(), { tree: true, launch: true });
  world.tree.write('.starciwork/brand/index.yaml', NO_SOURCES);
  assert.equal(world.ack(['interface.draw', 'brand.decide']).status, 0);
  const first = push(world).results[0];
  assert.equal(first.memo.count, 1);
  assert.deepEqual(first.memo.cause, { kind: 'brand-gap', cause: 'record-gap', op: 'brand.decide', field: 'brand.sources' });
  const [item] = gaps(world);
  assert.ok(item, 'the first refusal is actionable without an age threshold');
  assert.equal(gaps(world).length, 1);
  assert.match(item.question, /brand\.decide.*brand\.sources/);
  assert.equal(world.status().frontier.actionable, true);
  assert.equal(push(world).results[0].held, 'refusal-backoff');
  assert.equal(gaps(world).length, 1, 'backoff preserves exactly one repair item');
  const digest = JSON.stringify(world.starci(['debug', 'digest', '--workflow', world.wf]).json);
  assert.match(digest, /refused 1x for grammar-context-missing/);
  assert.match(digest, /brand\.decide.*brand\.sources/);
  assert.match(digest, /Workflow controller/);
  const choice = world.cli('decide', ['--workflow', world.wf, '--item', item.id, '--choice', 'repair-upstream', '--reason', 'repair the filed family CSS']);
  assert.equal(choice.status, 0, choice.stderr || choice.stdout);
  const repairs = world.ledger((ledger) => ledger.db.prepare("SELECT payload_json FROM jobs WHERE op_id='brand.decide' AND status='queued'").all());
  assert.equal(repairs.length, 1, 'the choice enqueues the settled upstream leg');
  assert.deepEqual(JSON.parse(repairs[0].payload_json).owned_paths, ['.starciwork/brand']);
  assert.deepEqual(gaps(world), [], 'the upstream repair now owns the wait');
});

test('the repair item disappears when the named source resolves or the waiting job is cancelled', (t) => {
  const world = replayWorld(t, fixtureOf(), { tree: true, launch: true });
  world.tree.write('.starciwork/brand/index.yaml', NO_SOURCES);
  assert.equal(world.ack(['interface.draw']).status, 0);
  assert.equal(push(world).results[0].memo.count, 1);
  assert.equal(gaps(world).length, 1);
  world.tree.write('.starciwork/brand/index.yaml', BRAND);
  assert.deepEqual(gaps(world), [], 'the source already exists in the workflow tree');
  world.tree.write('.starciwork/brand/index.yaml', NO_SOURCES);
  assert.equal(gaps(world).length, 1);
  world.ledger((ledger) => ledger.write.setJobStatus({ jobId: 'job-2', to: 'cancelled' }));
  assert.deepEqual(gaps(world), []);
});

const sourceWorld = (t) => {
  const fixture = fixtureOf();
  fixture.jobs[0].status = 'reported';
  fixture.jobs[0].report = { outcome: 'done', checks: [{ name: 'worker-selected-check' }] };
  fixture.jobs[1].status = 'cancelled';
  return replayWorld(t, fixture, { tree: true });
};

test('a direct pass remeasures brand sources even when the maker and an earlier independent check claim green', (t) => {
  const world = sourceWorld(t);
  world.tree.write('.starciwork/brand/index.yaml', NO_SOURCES);
  world.ledger((ledger) => {
    const attemptId = ledger.db.prepare("SELECT attempt_id FROM op_attempts WHERE job_id='job-1'").get().attempt_id;
    ledger.write.recordCheckRun({ attemptId, name: 'brand-consumable', phase: 'verify', runner: 'kernel', status: 'pass', exitCode: 0 });
  });
  const result = world.cli('settle', ['--job', 'job-1', '--verdict', 'pass']);
  assert.notEqual(result.status, 0);
  assert.equal(result.json?.code ?? result.json?.reason, 'grammar-context-missing', result.stderr || result.stdout);
  assert.match(result.stderr || result.stdout, /brand\.sources/);
  const check = world.ledger((ledger) => ledger.db.prepare("SELECT exit_code, runner FROM check_runs WHERE name='brand-consumable' ORDER BY check_id DESC LIMIT 1").get());
  assert.deepEqual({ ...check }, { exit_code: 1, runner: 'settler' });
  assert.equal(world.ledger((ledger) => ledger.db.prepare("SELECT status FROM jobs WHERE job_id='job-1'").get().status), 'reported');
});

test('the automatic settler runs the brand measure even when the report omits it', (t) => {
  const world = sourceWorld(t);
  world.tree.write('.starciwork/brand/index.yaml', NO_SOURCES);
  assert.equal(world.engine({ controllers: ['job'], passes: 1, unbound: true }).ok, true);
  const measured = world.ledger((ledger) => ledger.db.prepare("SELECT exit_code, runner FROM check_runs WHERE name='brand-consumable' ORDER BY check_id DESC LIMIT 1").get());
  assert.ok(measured, 'the runtime, not the report, selects the measure');
  assert.deepEqual({ ...measured }, { exit_code: 1, runner: 'settler' });
  assert.notEqual(world.ledger((ledger) => ledger.db.prepare("SELECT status FROM jobs WHERE job_id='job-1'").get().status), 'succeeded');
});

test('the brand measure accepts family CSS declared in the workflow tree', (t) => {
  const world = sourceWorld(t);
  assert.equal(world.engine({ controllers: ['job'], passes: 1, unbound: true }).ok, true);
  const check = world.ledger((ledger) => ledger.db.prepare("SELECT exit_code FROM check_runs WHERE name='brand-consumable' AND runner='settler' ORDER BY check_id DESC LIMIT 1").get());
  assert.equal(check?.exit_code, 0, 'the workflow tree contains the declared source');
});

test('the brand measure accepts an installed family export without declared sources', (t) => {
  const world = sourceWorld(t);
  world.tree.write('.starciwork/brand/index.yaml', NO_SOURCES);
  world.tree.write('node_modules/@starci/grammar/package.json', JSON.stringify({ exports: { './core.css': './core.css' } }));
  world.tree.write('node_modules/@starci/grammar/core.css', ':root { --brand: #000; }\n');
  assert.equal(world.engine({ controllers: ['job'], passes: 1, unbound: true }).ok, true);
  const check = world.ledger((ledger) => ledger.db.prepare("SELECT exit_code FROM check_runs WHERE name='brand-consumable' AND runner='settler' ORDER BY check_id DESC LIMIT 1").get());
  assert.equal(check?.exit_code, 0, 'the installed export is the same fallback dispatch consumes');
});
