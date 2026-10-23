// A Sonar project is ensured with a New Code definition (scripts/lib/sonar-new-code.mjs, read by `starci sonar project ensure` in
// scripts/gates/sonar-manage.mjs): without one a SonarQube Cloud project's gate status is NONE and the scanner reports the gate as not set.
// The target's own `newCodePeriod` wins over the canonical `gate.newCodePeriod`; Cloud keeps it as sonar.leak.period, a server through
// api/new_code_periods; only a matching readback verifies it.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from '../runtime/engine/yaml.mjs';
import {
  CLOUD_NEW_CODE_SETTING, cloudLeakValue, declaredNewCodePeriod, newCodeMatches, newCodePeriodOf, newCodeProof, newCodeWrite,
} from '../runtime/scripts/lib/sonar-new-code.mjs';

const DAYS = Object.freeze({ type: 'NUMBER_OF_DAYS', value: 30 });

test('the canonical gate of both editions declares a valid New Code period', () => {
  const gate = parseYaml(fs.readFileSync(path.join(import.meta.dirname, '..', 'runtime', 'knowledge', 'sonar-gate.yaml'), 'utf8'));
  assert.deepEqual(newCodePeriodOf(gate.gate.newCodePeriod), DAYS);
  assert.deepEqual(newCodePeriodOf(gate.lite.gate.newCodePeriod), DAYS);
});

test('a target declaration wins over the canonical period, and the canonical one stands in when the target names none', () => {
  assert.deepEqual(declaredNewCodePeriod({}, DAYS), DAYS);
  assert.deepEqual(declaredNewCodePeriod({ newCodePeriod: { type: 'NUMBER_OF_DAYS', value: 14 } }, DAYS), { type: 'NUMBER_OF_DAYS', value: 14 });
  assert.deepEqual(declaredNewCodePeriod({ newCodePeriod: { type: 'PREVIOUS_VERSION' } }, DAYS), { type: 'PREVIOUS_VERSION' });
});

test('a period outside the closed shape is refused, the canonical one included', () => {
  for (const bad of [undefined, null, [], { type: 'NUMBER_OF_DAYS' }, { type: 'NUMBER_OF_DAYS', value: 0 }, { type: 'NUMBER_OF_DAYS', value: 91 },
    { type: 'NUMBER_OF_DAYS', value: '30' }, { type: 'PREVIOUS_VERSION', value: 1 }, { type: 'REFERENCE_BRANCH', value: 'main' }, { ...DAYS, extra: true }])
    assert.throws(() => newCodePeriodOf(bad), /Invalid declared new code period/);
  assert.throws(() => declaredNewCodePeriod({}, undefined), /Invalid declared new code period/);
});

test('SonarQube Cloud keeps the period as the project setting sonar.leak.period', () => {
  assert.deepEqual(newCodeWrite('sonar-cloud', 'org_key', DAYS), { kind: 'setting', key: CLOUD_NEW_CODE_SETTING, value: '30' });
  assert.equal(cloudLeakValue({ type: 'PREVIOUS_VERSION' }), 'previous_version');
  assert.equal(newCodeMatches('sonar-cloud', { settings: [{ key: 'sonar.leak.period', value: '30', parentOrigin: 'INSTANCE' }] }, DAYS), true);
  assert.equal(newCodeMatches('sonar-cloud', { settings: [] }, DAYS), false, 'no definition is the NONE gate status');
  assert.equal(newCodeMatches('sonar-cloud', { settings: [{ key: 'sonar.leak.period', value: '14' }] }, DAYS), false);
  assert.equal(newCodeMatches('sonar-cloud', undefined, DAYS), false);
});

test('a server or Community Build keeps the period through api/new_code_periods', () => {
  for (const provider of ['sonar-server', 'sonar-community'])
    assert.deepEqual(newCodeWrite(provider, 'key', DAYS), { kind: 'period', form: { project: 'key', type: 'NUMBER_OF_DAYS', value: '30' } });
  assert.deepEqual(newCodeWrite('sonar-server', 'key', { type: 'PREVIOUS_VERSION' }), { kind: 'period', form: { project: 'key', type: 'PREVIOUS_VERSION' } });
  assert.equal(newCodeMatches('sonar-server', { type: 'NUMBER_OF_DAYS', value: '30', inherited: false }, DAYS), true);
  assert.equal(newCodeMatches('sonar-server', { type: 'NUMBER_OF_DAYS', value: '7' }, DAYS), false);
  assert.equal(newCodeMatches('sonar-server', { type: 'PREVIOUS_VERSION' }, DAYS), false);
  assert.equal(newCodeMatches('sonar-server', { type: 'PREVIOUS_VERSION' }, { type: 'PREVIOUS_VERSION' }), true);
});

test('the public proof names the period without any value but its days', () => {
  assert.equal(newCodeProof(DAYS), 'NUMBER_OF_DAYS:30');
  assert.equal(newCodeProof({ type: 'PREVIOUS_VERSION' }), 'PREVIOUS_VERSION');
});
