// A root-installed Jest with exported bin subpath runs from the owning be config directory.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { GATE_EXIT, runGate } from '../../scripts/gates/gate.mjs';
import { gateJestExportsFixture } from '../helpers/replay-gate-jest-exports.mjs';

test('native gate runs the root-installed exported Jest bin and preserves assertion failures', async (t) => {
  const fixture = gateJestExportsFixture(t);
  const { root, base } = fixture;
  assert.equal(fs.existsSync(path.join(root, 'be/package.json')), false);
  assert.equal(fs.existsSync(path.join(root, 'be/node_modules')), false);
  const run = () => runGate({ root, base, changed: [], tests: 'scenario.cjs' });
  const green = await run();
  assert.equal(green.exit, GATE_EXIT.clean, JSON.stringify(green));
  assert.equal(green.ok, true);
  assert.deepEqual(green.errors, []);
  assert.deepEqual([green.steps.tests.exit, green.steps.tests.total, green.steps.tests.passed,
    green.steps.tests.failed, green.steps.tests.skipped], [0, 1, 1, 0, 0]);
  assert.equal(green.steps.tests.cwd, 'be');
  assert.deepEqual(green.steps.tests.testFiles, ['be/scenario.cjs']);
  const [call] = fixture.calls();
  assert.equal(path.resolve(call.cwd), path.join(root, 'be'));
  for (const arg of ['--maxWorkers=2', '--ci', '--json', 'scenario.cjs']) assert.ok(call.args.includes(arg));
  assert.ok(call.args.some(arg => arg.startsWith('--outputFile=')));
  fixture.fail();
  const red = await run();
  assert.equal(red.exit, GATE_EXIT.findings, JSON.stringify(red));
  assert.equal(red.ok, false);
  assert.deepEqual([red.steps.tests.exit, red.steps.tests.failed], [1, 1]);
  assert.ok(red.findings.some(row => row.rule === 'test-failed' && row.path === 'be/scenario.cjs'));
  const calls = fixture.calls().length;
  const optional = await runGate({ root, base, changed: [] });
  assert.equal(optional.exit, GATE_EXIT.clean, JSON.stringify(optional));
  assert.equal(optional.steps.tests, null);
  assert.equal(fixture.calls().length, calls);
  fixture.removeJest();
  const absent = await run();
  assert.equal(absent.exit, GATE_EXIT.toolFailed, JSON.stringify(absent));
  assert.equal(absent.ok, false);
  assert.ok(absent.errors.some(error => error.includes('jest is not installed')));
  assert.equal(fixture.calls().length, calls);
});
