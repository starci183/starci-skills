import assert from 'node:assert/strict';
import test from 'node:test';
import { validateOutput } from './business/model/validate-output.mjs';

function validOutput() {
  return {
    schemaVersion: 7,
    operatorId: 'business/model',
    output: {
      outcome: 'ready',
      resultRef: 'artifact://business/model',
      evidenceRefs: ['evidence://business/challenge'],
      findings: [
        'stance:falsification-first',
        'assumption:customer-repeats',
        'counterexample:refund-after-value',
        'alternative:narrow-scope',
        'failure-mode:partial-fulfilment',
        'falsification-test:retention-cohort',
        'stakeholder-conflict:customer-support'
      ],
      reason: null
    }
  };
}

function validateChallenge(value) {
  const base = validateOutput(value);
  if (!base.valid) return base;
  const { outcome, findings, evidenceRefs } = value.output;
  const errors = [];
  const required = ['stance:falsification-first', 'assumption:', 'counterexample:', 'alternative:', 'failure-mode:', 'falsification-test:', 'stakeholder-conflict:'];
  for (const prefix of required) if (!findings.some((item) => item.startsWith(prefix))) errors.push(`${prefix} evidence is required`);
  const critical = findings.filter((item) => item.startsWith('unresolved-critical:'));
  if (outcome === 'ready' && critical.length) errors.push('unresolvedCriticalIds must be empty for ready');
  if (outcome === 'revise' && (!critical.length || evidenceRefs.length === 0)) errors.push('revise requires unresolvedCriticalIds and evidence');
  return { valid: errors.length === 0, errors };
}

test('accepts a business model only after structured falsification has no critical residual', () => {
  assert.deepEqual(validateChallenge(validOutput()), { valid: true, errors: [] });
});

test('rejects a ready business model with an unresolved critical challenge', () => {
  const output = validOutput();
  output.output.findings.push('unresolved-critical:value-not-proven');
  const result = validateChallenge(output);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /unresolvedCriticalIds/);
});

test('accepts an evidence-linked revise outcome when critique defeats the candidate', () => {
  const output = validOutput();
  output.output.outcome = 'revise';
  output.output.findings.push('unresolved-critical:incentive-conflict');
  assert.deepEqual(validateChallenge(output), { valid: true, errors: [] });
});
