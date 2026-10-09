// The silent loops of the first alpha.8 day (registry: reconciler-action-fails-on-every-pass-unreported): the machine store of the live host held 490 failed runs of
// `run node` for the key of one Kernel seat (a watchdog pass failing every two minutes for a day), 59 for the Supervisor seat, 24 for the ask tunnel and 44 for `kernel reconcile
// health:all`, each with the verb's own `failed` row and nothing else: no queue retry (the action returned instead of throwing), no Decision Item, no clock, no digest line. And a
// Decision Item the runtime refused to open (it named no repository) left one log row per pass and no item, so the role it was for never heard of it.
// Real: the machine store and its action journal, the digest's machine reader and analysis, the verdicts. The rows are written through the journal API the engine uses.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { TEST_REGISTRY_ENV, openMachine } from '../../engine/db/machine.mjs';
import { machineFacts } from '../../scripts/reconciler/debug-digest-machine.mjs';
import { digest, numbers, snapshot, NOW, MIN } from '../helpers/debug-digest-fixture.mjs';

const SEAT = 'seat:kernel:shop:wf-shop';

function store(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-silent-'));
  const env = { ...process.env, STARCI_LOCAL_ROOT: path.join(root, 'la'), STARCI_CONNECTORS_OFF: '1', [TEST_REGISTRY_ENV]: path.join(root, 'machine.sqlite') };
  let now = NOW;
  const m = openMachine({ env, now: () => now });
  t.after(() => { m.close(); fs.rmSync(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 }); });
  return { m, env, at: (ms) => { now = ms; } };
}

/** One run of a controller's verb for a key, journalled the way the engine does (intent, then finished at the clock of the store). */
function run(s, { key, state, at, epoch }) {
  s.at(at);
  const id = s.m.actionIntent({ controller: 'host', key, verb: 'run node', epoch, mode: 'active' });
  s.m.actionRunning(id);
  s.m.actionFinish(id, { state, exitCode: state === 'done' ? 0 : 1, errorSignature: state === 'done' ? null : 'restart-failed kernel-launch-unreconciled' });
}

test('a seat watchdog that fails on every pass for hours is a problem line of the runtime, with its count and span', (t) => {
  const s = store(t);
  for (let i = 0; i < 40; i += 1) run(s, { key: SEAT, state: 'failed', at: NOW - (40 - i) * 2 * MIN, epoch: i });
  const facts = machineFacts({ env: s.env });
  const [found] = facts.silent.actions;
  assert.deepEqual([found.controller, found.key, found.streak], ['host', SEAT, 40]);
  const d = digest(snapshot({ silent: facts.silent }));
  const [problem] = d.problems.filter((p) => p.code === 'action-failing');
  assert.ok(problem, 'the digest names it');
  assert.deepEqual([problem.params.controller, problem.params.verb, problem.params.key, problem.params.count], ['host', 'run node', SEAT, 40]);
  assert.match(problem.params.error, /kernel-launch-unreconciled/);
  assert.equal(d.ok, false, 'a stop nobody is told of is a departure of the runtime');
  assert.equal(problem.role, 'runtime');
});

test('a run that succeeded in between ends the streak: the failures before it are history', (t) => {
  const s = store(t);
  for (let i = 0; i < 20; i += 1) run(s, { key: SEAT, state: 'failed', at: NOW - (40 - i) * 2 * MIN, epoch: i });
  run(s, { key: SEAT, state: 'done', at: NOW - 19 * 2 * MIN, epoch: 100 });
  for (let i = 0; i < 3; i += 1) run(s, { key: SEAT, state: 'failed', at: NOW - (3 - i) * 2 * MIN, epoch: 200 + i });
  const facts = machineFacts({ env: s.env });
  assert.deepEqual(facts.silent.actions.map((r) => r.streak), [3]);
  assert.deepEqual(digest(snapshot({ silent: facts.silent })).problems.filter((p) => p.code === 'action-failing'), [], 'three failures are a retry, not a loop');
});

test('a failure that stopped is not reported: only a stop still happening is a line', (t) => {
  const s = store(t);
  for (let i = 0; i < 30; i += 1) run(s, { key: 'service:ask-tunnel', state: 'failed', at: NOW - 5 * 60 * MIN - (30 - i) * 2 * MIN, epoch: i });
  const facts = machineFacts({ env: s.env });
  assert.equal(facts.silent.actions.length, 1);
  assert.deepEqual(digest(snapshot({ silent: facts.silent })).problems.filter((p) => p.code === 'action-failing'), [], 'its newest failure is hours old');
});

test('a Decision Item the runtime refuses to open on every pass is a line: its role is not being told', (t) => {
  const s = store(t);
  for (let i = 0; i < 12; i += 1) {
    s.at(NOW - (12 - i) * 3 * MIN);
    s.m.log({ actor: 'reconciler', kind: 'reconciler.error', msg: 'decision refused',
      data: { kind: 'reconciler.decision-refused', code: 'decision-item-without-repo', decision: { kind: 'runtime-defect', idempotencyKey: 'runtime-defect:wf-shop:gate-1', decider: 'supervisor' } } });
  }
  const facts = machineFacts({ env: s.env });
  assert.deepEqual(facts.silent.refused.map((r) => [r.key, r.code, r.count]), [['runtime-defect:wf-shop:gate-1', 'decision-item-without-repo', 12]]);
  const [problem] = digest(snapshot({ silent: facts.silent })).problems.filter((p) => p.code === 'decision-refused');
  assert.deepEqual([problem.params.kind, problem.params.code, problem.params.count], ['runtime-defect', 'decision-item-without-repo', 12]);
});

test('a healthy store and a snapshot without the silent facts add no line', (t) => {
  const s = store(t);
  for (let i = 0; i < 10; i += 1) run(s, { key: SEAT, state: 'done', at: NOW - (10 - i) * 2 * MIN, epoch: i });
  assert.deepEqual(machineFacts({ env: s.env }).silent, { actions: [], refused: [] });
  assert.deepEqual(digest(snapshot({ silent: machineFacts({ env: s.env }).silent })).problems, []);
  assert.deepEqual(digest(snapshot()).problems.filter((p) => ['action-failing', 'decision-refused'].includes(p.code)), []);
  assert.ok(numbers.actionFailMin > 1 && numbers.silentFreshMs > 0, 'the bounds are the yaml numbers');
});
