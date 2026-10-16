import assert from 'node:assert/strict';
import test from 'node:test';
import { coverageProofFindings } from '../../scripts/checks/lib/coverage-proofs.mjs';

const CODE = 'PROCESS_OUTPUT_DRIFT';
const SCRIPT = 'scripts/checks/process-fixture.mjs';
const SPEC = 'tests/checks/process-fixture.spec.mjs';

function fixture({ invocation = 'spawnSync(process.execPath, [script])', main = 'main();', parameters = '', setup = '', assertion = 'result.stderr.includes' } = {}) {
  const spec = `import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const script = fileURLToPath(new URL('../../${SCRIPT}', import.meta.url));
${setup}
const run = (${parameters}) => ${invocation};
// proves: ${CODE}@lite ${CODE}@full
for (const edition of ['lite', 'full']) {
  test(edition + ' invalid output is rejected', () => {
    const result = run();
    assert.ok(${assertion}('${CODE}'));
  });
  test(edition + ' valid output passes', () => {
    const result = run();
    assert.ok(!${assertion}('${CODE}'));
  });
}`;
  const rule = { id: 'R901', code: CODE, failureCodes: [CODE], proves: [SPEC],
    enforcers: [{ kind: 'runtime', id: 'process-fixture', at: SCRIPT }] };
  const files = new Map([
    [SPEC, spec],
    [SCRIPT, `const CODE = '${CODE}'; const main = () => { console.error(CODE); }; ${main}`],
  ]);
  return { context: { files, catalog: { rules: [rule] } }, rule };
}

for (const edition of ['lite', 'full']) {
  test(`a consumed Node subprocess result reaches its invoked main in ${edition}`, () => {
    const { context, rule } = fixture();
    assert.deepEqual(coverageProofFindings(context, rule, CODE, edition), []);
  });

  test(`vacuous process proofs remain rejected in ${edition}`, () => {
    for (const options of [
      { main: '' },
      { parameters: 'spawnSync' },
      { parameters: 'process' },
      { setup: 'const URL = class {};'},
      { invocation: "spawnSync('echo', [script])" },
      { invocation: "spawnSync(process.execPath, ['--check', script])" },
      { invocation: "spawnSync(process.execPath, ['--eval', script])" },
      { invocation: "spawnSync(process.execPath, ['scripts/missing.mjs'])" },
      { assertion: "['PROCESS_OUTPUT_DRIFT'].includes" },
    ]) {
      const { context, rule } = fixture(options);
      assert.equal(coverageProofFindings(context, rule, CODE, edition).length, 1, JSON.stringify(options));
    }
  });
}
