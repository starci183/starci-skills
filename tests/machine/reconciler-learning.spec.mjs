import test from 'node:test';
import assert from 'node:assert/strict';
import { controllerContract, fakeCtx } from '../../scripts/reconciler/testing.mjs';
import learning, { KEY, violationItems, planLearning, reconcileLearning, DEFAULTS } from '../../scripts/reconciler/controllers/learning.mjs';
import { newHypotheses, measureExperiments } from '../../scripts/machine/lessons.mjs';

// Lane rc-workers (LANES.md "Lane G", DESIGN.md §8.7): the invariant violations of the window are learning items
// with signature inv:<code>; two violations of one code open ONE hypothesis DI for the Supervisor, a signature that
// already has an open hypothesis opens none, and in shadow the recording pass is only a would-row.

const NOW = Date.parse('2026-09-28T10:00:00Z');
const MIN = 60_000;
const empty = { signatures: {}, experiments: {}, lessons: [], proposals: {} };
const ls = { minRepeats: 2, measureMs: 86_400_000, successDrop: 0.1 };

test('the learning controller module follows the shared contract', () => {
  controllerContract(learning, { name: 'learning', concerns: ['learning.tick'], routeKey: 'runtime-invariant-violated', duty: KEY });
});

test('violations become one item per code, counted inside the window', () => {
  const items = violationItems([
    { code: 'SETTLE_OVERDUE', dedupeKey: 'SETTLE_OVERDUE|job:a', at: NOW - 10 * MIN },
    { code: 'SETTLE_OVERDUE', dedupeKey: 'SETTLE_OVERDUE|job:b', at: NOW - 5 * MIN },
    { code: 'TERMINAL_LEAK', dedupeKey: 'TERMINAL_LEAK|job:c', at: NOW - 2 * 86_400_000 },
  ], { now: NOW, windowMs: DEFAULTS.windowMs });
  assert.equal(items.length, 1);
  assert.equal(items[0].subject, 'inv:SETTLE_OVERDUE');
  assert.equal(items[0].size, 2);
});

test('two violations of one code open exactly one hypothesis DI', () => {
  const items = violationItems([{ code: 'SETTLE_OVERDUE', at: NOW - MIN }, { code: 'SETTLE_OVERDUE', at: NOW - 2 * MIN }, { code: 'WORKER_SILENT', at: NOW - MIN }], { now: NOW });
  const plan = planLearning({ items, state: empty, settings: ls, now: NOW, newHypotheses, measureExperiments });
  assert.deepEqual(plan.hypotheses.map((h) => h.signature), ['inv:SETTLE_OVERDUE']);
  assert.equal(plan.decisions.length, 1);
  assert.equal(plan.decisions[0].kind, 'hypothesis');
  assert.equal(plan.decisions[0].idempotencyKey, 'hypothesis:inv:SETTLE_OVERDUE');
  assert.equal(plan.decisions[0].decider, 'supervisor');
  const known = { ...empty, signatures: { 'inv:SETTLE_OVERDUE': { status: 'open' } } };
  assert.equal(planLearning({ items, state: known, settings: ls, now: NOW, newHypotheses, measureExperiments }).decisions.length, 0, 'an open hypothesis is not reopened');
});

test('an experiment whose signature recurred after its land is one experiment-revert DI', () => {
  const state = { ...empty, experiments: { 'exp-1': { id: 'exp-1', status: 'measuring', signature: 'inv:SETTLE_OVERDUE', landedAt: NOW - 60 * MIN, files: [], commits: ['abc'] } } };
  const items = violationItems([{ code: 'SETTLE_OVERDUE', at: NOW - 5 * MIN }], { now: NOW });
  const plan = planLearning({ items, state, settings: ls, now: NOW, newHypotheses, measureExperiments });
  assert.deepEqual(plan.decisions.map((d) => d.idempotencyKey), ['experiment-revert:exp-1']);
});

test('a shadow pass opens the DI through ctx and records the lessons tick as a would-run', async () => {
  const ctx = fakeCtx({ controller: 'learning', now: () => NOW });
  const deps = { violations: [{ code: 'SETTLE_OVERDUE', at: NOW - MIN }, { code: 'SETTLE_OVERDUE', at: NOW - 2 * MIN }], state: empty, learningSettings: ls,
    lessons: { newHypotheses, measureExperiments, readLearning: () => empty, learningSettings: () => ls } };
  const r = await reconcileLearning(KEY, ctx, { settings: DEFAULTS, deps });
  assert.deepEqual(r.hypotheses, ['inv:SETTLE_OVERDUE']);
  assert.equal(ctx.calls.decisions.length, 1);
  assert.equal(ctx.calls.run.length, 1);
  assert.deepEqual(ctx.calls.run[0].args.slice(0, 2), ['scripts/machine/lessons.mjs', 'tick']);
  const again = await reconcileLearning(KEY, ctx, { settings: DEFAULTS, deps });
  assert.deepEqual(ctx.calls.decisions.map((d) => d.idempotencyKey), ['hypothesis:inv:SETTLE_OVERDUE', 'hypothesis:inv:SETTLE_OVERDUE'], 'the same key: decisions.mjs keeps one live DI');
  assert.equal(again.ok, true);
});
