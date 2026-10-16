import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from '../../engine/yaml.mjs';
import { policyFindings, zoneFindings } from '../../scripts/hfs/runtime-rules/rights-policy.mjs';
import { policyVerdict, loadCommandPolicy } from '../../scripts/guards/command-policy.mjs';
import { fileWriteVerdict } from '../../scripts/guards/rights.mjs';

const policy = loadCommandPolicy();
const zone = parseYaml(fs.readFileSync('modules/kernel/protected-zone.yaml', 'utf8'));
const runtimeRoot = path.resolve('.');
const command = (program, args) => ({ program, args, cwd: runtimeRoot });
const cases = [
  ['RIGHTS_ROLE_DENIED', command('starci', ['work', 'imagegen'])],
  ['RIGHTS_GIT_PUSH', command('git', ['push', 'origin', 'main'])],
  ['RIGHTS_GIT_TAG', command('git', ['tag', 'v1.0.0'])],
  ['RIGHTS_GIT_COMMIT', command('git', ['commit', '-m', 'fixture'])],
  ['RIGHTS_GIT_SYNC', command('git', ['merge', 'main'])],
  ['RIGHTS_NPM_PUBLISH', command('npm', ['publish'])],
  ['RIGHTS_NPM_CI_UNLOCKED', command('npm', ['ci'])],
  ['RIGHTS_SUITE_RUN', command('npm', ['test'])],
  ['RIGHTS_RELEASE_CUT', command('starci', ['release', 'cut'])],
  ['RIGHTS_RAW_TOOL', command('docker', ['compose', 'up'])],
];

for (const edition of ['lite', 'full']) {
  test(`${edition}: invalid policy and zone data produce their own codes`, () => {
    assert.equal(policyFindings({ policy: null })[0].code, 'RIGHTS_ROLE_DENIED');
    assert.equal(zoneFindings({ zone: null })[0].code, 'RIGHTS_PROTECTED_ZONE');
  });
  test(`${edition}: valid policy and zone data pass`, () => {
    assert.deepEqual(policyFindings({ policy }), []);
    assert.deepEqual(zoneFindings({ zone, tracked: file => fs.existsSync(file), catalogued: () => true }), []);
  });
  test(`${edition}: command policy refuses each forbidden command`, () => {
    for (const [code, command] of cases) {
      assert.equal(policyVerdict({ role: 'coordinator', command, policy })?.code, code);
    }
  });
  test(`${edition}: owner commands and a bound role read pass`, () => {
    for (const [, command] of cases) {
      assert.equal(policyVerdict({ role: null, command, policy }), null);
    }
    assert.equal(policyVerdict({ role: 'coordinator', command: command('git', ['status']), policy }), null);
  });
  test(`${edition}: file writes refuse the protected zone and op runtime write`, () => {
    const filePath = path.join(runtimeRoot, 'scripts/fixture.mjs');
    assert.equal(fileWriteVerdict({ role: 'op', filePath, zone: { runtimeRoot } })?.code, 'RIGHTS_OP_RUNTIME_WRITE');
    assert.equal(fileWriteVerdict({ role: 'supervisor', filePath, zone: { runtimeRoot, rel: 'scripts/fixture.mjs', zone: { id: 'fixture', why: 'protected' } } })?.code, 'RIGHTS_PROTECTED_ZONE');
  });
  test(`${edition}: owner writes and op owned paths pass`, () => {
    const filePath = path.join(runtimeRoot, 'scripts/fixture.mjs');
    assert.equal(fileWriteVerdict({ role: null, filePath, zone: { runtimeRoot } }), null);
    assert.equal(fileWriteVerdict({ role: 'op', filePath, zone: { runtimeRoot }, guard: { owned: [runtimeRoot] } }), null);
  });
}
