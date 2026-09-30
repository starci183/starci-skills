import test from 'node:test';
import assert from 'node:assert/strict';
import { archFixture, runArch, findings } from './_hfs-arch-be-fixture.mjs';

// R47 test-world-files (BE_TEST_TOPOLOGY): src/tests/world/ holds only global-setup.ts, global-teardown.ts, use-test-world.ts,
// fakes/, kit/ and role-suffixed files at its root (knowledge/hfs/slots.yaml be.tests.world allows).
const E = 'export const value = 1;\n';
const GOOD = {
  'src/tests/world/global-setup.ts': E,
  'src/tests/world/global-teardown.ts': E,
  'src/tests/world/use-test-world.ts': E,
  'src/tests/world/fakes/stripe/stripe.server.ts': E,
  'src/tests/world/kit/wait-for.service.ts': E,
  'src/tests/world/identity.client.ts': E,
  'src/tests/world/checkout.contracts.ts': E,
  'src/tests/world/world.policy.ts': E,
  'src/tests/world/world.error.ts': E,
  'src/tests/world/world.options.ts': E,
};
const DECLARE = { declaration: { optionalSlots: [] } };
const hits = report => findings(report, 'BE_TEST_TOPOLOGY').filter(item => item.slot === 'be.tests.world');
const paths = report => hits(report).map(item => item.path).sort();
const run = (t, files) => runArch(archFixture(t, { files: { ...GOOD, ...files }, ...DECLARE }));

test('a test world with its fixed files, fakes/, kit/ and role-suffixed root helpers raises no world-files finding', t => {
  const report = run(t, {});
  assert.deepEqual(hits(report), [], JSON.stringify(hits(report), null, 1));
  assert.equal(report.coverage.hfsMachine.testWorldFiles.status, 'checked');
  assert.ok(report.coverage.checkedRuleIds.includes('BE_TEST_TOPOLOGY'));
});

test('a stray file, a file without a role suffix, an unknown folder or a role file in a subfolder is refused', t => {
  const report = run(t, {
    'src/tests/world/helpers.ts': E,
    'src/tests/world/checkout.helper.ts': E,
    'src/tests/world/utils/clock.client.ts': E,
    'src/tests/world/setup.ts': E,
  });
  assert.deepEqual(paths(report), ['src/tests/world/checkout.helper.ts', 'src/tests/world/helpers.ts', 'src/tests/world/setup.ts', 'src/tests/world/utils/clock.client.ts']);
  assert.match(hits(report)[0].message, /holds only/);
});
