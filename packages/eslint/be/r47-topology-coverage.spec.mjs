// proves: BE_TEST_TOPOLOGY@lite BE_TEST_TOPOLOGY@full
import test from 'node:test';
import { projectFixture } from './fixtures/project/tester.mjs';
import { rules } from './project-graph.mjs';
import { unitTestColocated } from './testing.mjs';
import { testsInfraOnlyInWorld, testsNoOverride, testWorldShape } from './test-world.mjs';

const goodWorld = 'src/tests/world/identity.client.ts';
const badWorld = 'src/tests/world/helpers.ts';
const service = 'src/modules/domain/order/covered.service.ts';
const spec = 'src/modules/domain/order/covered.service.spec.ts';
const orphan = 'src/modules/domain/order/orphan.service.spec.ts';
const e2e = 'src/tests/e2e/checkout/order.e2e-spec.ts';
const world = 'src/tests/world/global-setup.ts';
const code = 'export {};';

for (const edition of ['lite', 'full']) {
  test(`${edition} topology lint accepts valid witnesses and rejects violations`, t => {
    const fixture = projectFixture({ edition, files: {
      [goodWorld]: code, [badWorld]: code, [service]: 'export class CoveredService {}', [spec]: code,
    } });
    t.after(fixture.cleanup);
    fixture.tester.run('test-world-files', rules['test-world-files'], {
      valid: [{ filename: fixture.at(goodWorld), code }],
      invalid: [{ filename: fixture.at(badWorld), code, errors: [{ message: /BE_TEST_TOPOLOGY/ }] }],
    });
    fixture.tester.run('unit-test-colocated', unitTestColocated, {
      valid: [{ filename: fixture.at(spec), code }],
      invalid: [{ filename: fixture.at(orphan), code, errors: [{ messageId: 'orphan' }] }],
    });
    fixture.tester.run('tests-infra-only-in-world', testsInfraOnlyInWorld, {
      valid: [{ filename: fixture.at(world), code: 'process.env.PORT = "4000";' }],
      invalid: [{ filename: fixture.at(e2e), code: 'process.env.PORT = "4000";', errors: [{ messageId: 'env' }] }],
    });
    fixture.tester.run('tests-no-override', testsNoOverride, {
      valid: [{ filename: fixture.at(e2e), code }],
      invalid: [{ filename: fixture.at(e2e), code: 'export const p = { provide: 1, useValue: 2 };', errors: [{ messageId: 'override' }] }],
    });
    fixture.tester.run('test-world-shape', testWorldShape, {
      valid: [{ filename: fixture.at(e2e), code: 'const world = useTestWorld({ apps: {} });' }],
      invalid: [{ filename: fixture.at(e2e), code, errors: [{ messageId: 'missing' }] }],
    });
  });
}
