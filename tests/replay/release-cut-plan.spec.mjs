// release-cut-plan.spec.mjs — a CI cut must execute its selected plan, while a local cut retains its local suite and parity.
import test from 'node:test';
import assert from 'node:assert/strict';
import { replayReleaseCutPlan } from '../helpers/replay-release-cut-plan.mjs';

test('CI cut default runner executes the selected local rows and never starts delegated suite or parity', async (t) => {
  const { out, plan, parityCalls, localSuiteRan } = await replayReleaseCutPlan(t, 'ci');
  assert.equal(out.verdict, 'suite-red', 'the private fixture has a deliberately red check');
  assert.equal(out.pushed, false);
  assert.equal(out.tagCreated, false);
  assert.equal(localSuiteRan, false, 'the delegated root command must not execute locally');
  assert.equal(parityCalls, 0, 'the delegated Linux callback must not execute locally');
  assert.deepEqual(out.suite.map((row) => row.name), plan.steps.map((row) => row.name));
  assert.ok(out.suite.some((row) => row.name === 'npm run test:packages'));
  assert.ok(out.suite.some((row) => row.name === 'npm run check'));
  assert.ok(out.suite.some((row) => row.name === 'affected tests'));
  assert.ok(out.suite.some((row) => row.name === 'orca live smokes'));
});

test('local cut default runner retains the selected root suite, package checks and Linux parity', async (t) => {
  const { out, plan, parityCalls, localSuiteRan } = await replayReleaseCutPlan(t, 'local');
  assert.equal(out.verdict, 'suite-red');
  assert.equal(out.pushed, false);
  assert.equal(out.tagCreated, false);
  assert.equal(localSuiteRan, true, 'only the private one-test fixture is executed');
  assert.equal(parityCalls, 1);
  assert.deepEqual(out.suite.map((row) => row.name), [...plan.steps.map((row) => row.name), 'linux-parity']);
});
