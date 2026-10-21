// The coverage job of the managed CI proves the merged report with the coverage judgement alone (`starci app coverage verify`): the fast and
// lint jobs already ran every other rule, and the whole app check made the job run past its timeout (NIVO v0.3.0, 18m43s of 20).
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderTargets } from '../sync/index.mjs';
import { ciWorkflowCommands } from '../sync/ci-commands.mjs';
import { parseYaml } from '../runtime/engine/yaml.mjs';

const report = 'be/coverage/lcov.info';
const verify = 'npx starci app coverage verify ' + report;

for (const edition of ['full', 'lite']) {
  test(`${edition} coverage job runs only the coverage verify over the merged report, inside its timeout`, () => {
    const hfs = { hfs: 3, kind: 'app', edition, project: 'coverage-proof', sides: {
      be: { apps: [{ name: 'api', kind: 'api' }] },
      fe: { apps: [{ name: 'web', kind: 'next' }], reads: ['be/contracts/'] },
    } };
    const target = renderTargets(hfs, {}).find(item => item.path === '.github/workflows/ci.yml');
    assert.ok(target, 'the managed CI is rendered');
    const job = parseYaml(target.content).jobs.coverage;
    const step = job.steps.find(item => item.name === 'coverage proof');
    assert.equal(step.run, verify);
    assert.doesNotMatch(step.run, /app check|codegen/u, 'no rule of the whole app check runs again');
    assert.equal(job['timeout-minutes'], 15);
  });
}

test('runtime examples verify the coverage inside the isolated example copy', () => {
  const command = ciWorkflowCommands({ runtimeExample: true }).ciCoverageProof;
  assert.equal(command, 'node node_modules/@starci/hfs/runtime/scripts/hfs/example-secrets.mjs --run . -- ' + verify);
});
