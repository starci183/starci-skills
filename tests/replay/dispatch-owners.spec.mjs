// Replay of three dispatch-side defects of 2026-10-09 on runtime 3cf4005fa (registry: approved-leg-reaches-the-kernel-without-a-write-set, shape-refused-classifies-by-text-and-carries-no-evidence,
// refused-dispatch-is-retried-and-recorded-every-push), each with the owner its duty was missing.
//   a (StarCi): the approved interface.draw leg came to the Kernel as `leg-ready:...:approved-leg-open`, "the plan declares no write set", free text only; the Kernel guessed ui/** of the feature.
//   b (StarCi): work.author blocked on an sds-gap was read as a too-narrow grant by a text match; its same-shape retry was refused and offered to the Kernel as a widen with no evidence.
//   c (StarCi): interface.draw ready, refused grammar-context-missing every ~60 s (fifty route-decided events before it dispatched).
// Real: the Kernel verbs status, decide and dispatch-ready as child processes (their route and dispatch children run for real up to the launch), the menu builder, the failure classifier,
// the refusal memo, the digest. Stubbed: the Orca binary only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadFixture, replayWorld } from '../helpers/replay-world.mjs';

const push = (world) => world.cli('dispatch-ready', ['--workflow', world.wf, '--foreground'], { timeout: 300_000 }).json;
const count = (world, kind) => world.ledger((ledger) => ledger.db.prepare('SELECT count(*) AS n FROM events WHERE kind=?').get(kind).n);
const BRAND = ['schema: work/brand@1', 'kind: brand', 'brand:', '  identity:', '    family: starci', '  sources:', '    - path: brand-theme.css', ''].join('\n');

test('a: the approved leg whose plan declares no write set offers the op contract\'s families as a picked choice, and picking it enqueues the leg', (t) => {
  const world = replayWorld(t, loadFixture('leg-ready'), { tree: true });
  const item = world.status().menu.find((entry) => entry.kind === 'leg-ready');
  assert.ok(item, 'the real menu offers the leg-ready item');
  assert.deepEqual(item.options.map((option) => option.choice), ['enqueue-proposed', 'enqueue-leg', 'none-fits'], 'a pick first, free text only as the escape');
  assert.equal(item.options[0].args.paths, '.starciwork/features/own-1/ui', 'the proposal is the contract family of the node\'s feature, not a guess');
  assert.equal(item.options[0].text, undefined);

  // The pick goes through the real decide verb, as the Kernel answers it (the READ of the op attested first).
  assert.equal(world.ack(['interface.draw']).status, 0, 'the Kernel attests its READ of the op');
  const picked = world.cli('decide', ['--workflow', world.wf, '--item', item.id, '--choice', 'enqueue-proposed', '--reason', 'the contract write set']);
  assert.equal(picked.status, 0, picked.stderr || picked.stdout);
  const jobs = world.ledger((ledger) => ledger.db.prepare("SELECT payload_json FROM jobs WHERE op_id='interface.draw'").all().map((row) => JSON.parse(row.payload_json).owned_paths));
  assert.deepEqual(jobs, [['.starciwork/features/own-1/ui']], 'the proposal passes the enqueue guards and the leg is enqueued on it');
});

/** The shape-guard world with a retry that is a plain repeat of the failed job (the failure route queued nothing behind a curing leg). */
function repeatWorld(blocker) {
  const fixture = structuredClone(loadFixture('shape-guard'));
  const failed = fixture.jobs.find((job) => job.id === 'job-2');
  failed.report = { outcome: 'blocked', blocker };
  delete failed.result.nextStep;
  const retry = fixture.jobs.find((job) => job.id === 'job-3');
  delete retry.after;
  delete retry.routed;
  return fixture;
}

test('b: a blocker typed sds-gap is no too-narrow grant by its prose: the retry is not refused as the failed shape and the Kernel is not asked to widen', (t) => {
  const prose = 'the SDS leaves the session record out; the fix needs files outside the owned paths';
  const world = replayWorld(t, repeatWorld({ kind: 'sds-gap', detail: prose }), { tree: true, launch: true });
  assert.equal(world.engine({ controllers: ['job', 'workflow'], passes: 1 }).ok, true);
  const status = world.status();
  assert.deepEqual(status.menu.map((item) => item.id).filter((id) => id.startsWith('shape-refused:')), [], 'no widen is offered for a gap that is no narrow grant');
  assert.equal(world.ack(['work.author']).status, 0);
  const [result] = push(world).results;
  assert.equal(result.skipped, undefined, `the push did not skip it as a failed shape: ${result.skipped}`);
});

test('b2: a shared-change blocker is a real shape failure; the item carries the failed attempt\'s blocker and the paths it reported as a ready choice', (t) => {
  const detail = 'the fix needs apps/app/src/auth/session.ts and apps/app/src/auth/cookie.ts, outside the owned paths';
  const world = replayWorld(t, repeatWorld({ kind: 'shared-change', detail }), { tree: true, launch: true });
  assert.equal(world.engine({ controllers: ['job', 'workflow'], passes: 1 }).ok, true);
  const item = world.status().menu.find((entry) => entry.kind === 'shape-refused');
  assert.ok(item, 'the shape is refused: the failure is the grant\'s');
  assert.match(item.question, /Its blocker was shared-change: the fix needs apps\/app\/src\/auth\/session\.ts/, 'the failed attempt\'s own blocker is on the item');
  assert.deepEqual(item.options.map((option) => option.choice), ['widen-reported', 'widen', 'none-fits']);
  assert.equal(item.options[0].args['add-paths'], 'apps/app/src/auth/session.ts,apps/app/src/auth/cookie.ts', 'the reported paths are a ready choice');
});

test('c: the same refusal of the same ready job is recorded once, held on a growing interval, tried at once when the named resource appears, and named in the digest', (t) => {
  const fixture = structuredClone(loadFixture('grammar-in-tree'));
  fixture.tree.brand = false;
  const draw = fixture.jobs.find((job) => job.op === 'interface.draw');
  const world = replayWorld(t, fixture, { tree: true, launch: true });
  assert.equal(world.ack([draw.op]).status, 0);

  const first = push(world).results[0];
  assert.match(String(first.error), /grammar-context-missing/, 'the brand record is not there: the refusal of the live StarCi');
  assert.equal(first.memo.count, 1);
  const afterFirst = { routes: count(world, 'route-decided'), pushes: count(world, 'kernel-api') + count(world, 'dispatch-push') };

  const rest = [push(world).results[0], push(world).results[0], push(world).results[0]];
  assert.ok(rest.every((result) => result.held === 'refusal-backoff' && result.cause === 'grammar-context-missing'), `held, not refused again: ${JSON.stringify(rest)}`);
  assert.equal(count(world, 'route-decided'), afterFirst.routes, 'no route decision is written for a held job');
  assert.equal(count(world, 'kernel-api') + count(world, 'dispatch-push'), afterFirst.pushes, 'a push in which every job is held writes no row');

  world.ledger((ledger) => ledger.db.prepare("UPDATE jobs SET created_at=? WHERE job_id=?").run(Date.now() - 3_600_000, draw.id));
  const digest = JSON.stringify(world.starci(['debug', 'digest', '--workflow', world.wf]).json);
  assert.match(digest, /ready-not-dispatched/);
  assert.match(digest, /refused 1x for grammar-context-missing/, 'the digest names the cause the job is refused for');

  world.tree.write('.starciwork/brand/index.yaml', BRAND);
  world.tree.write('brand-theme.css', ':root { --brand: #000; }\n');
  const after = push(world).results[0];
  assert.equal(after.held, undefined, 'the resource the refusal named appeared: the job is tried at once, not on the interval');
  assert.doesNotMatch(String(after.error ?? ''), /grammar-context-missing/);
});
