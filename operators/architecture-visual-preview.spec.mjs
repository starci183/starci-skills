import assert from 'node:assert/strict';
import test from 'node:test';
import { validateOutput } from './architecture/decision-challenge/validate-output.mjs';

const reviewRef = 'artifact://architecture/review.html';
const requiredScenarios = ['normal', 'retry', 'concurrency', 'outage', 'rollback'];

function validOutput() {
  return {
    schemaVersion: 7,
    operatorId: 'architecture/decision-challenge',
    output: {
      outcome: 'ready',
      resultRef: reviewRef,
      evidenceRefs: [reviewRef, 'evidence://architecture/challenge'],
      findings: [
        'renderer:visualize',
        'media-type:text/html',
        'interactive:true',
        ...requiredScenarios.map((id) => `scenario:${id}`),
        'recommended-option:postgres-outbox',
        'approval-command:postgres-outbox',
        'approval-command:event-ledger',
        'rejected-option:event-ledger'
      ],
      reason: null
    }
  };
}

function validateReview(value) {
  const base = validateOutput(value);
  if (!base.valid) return base;
  const { outcome, resultRef, evidenceRefs, findings } = value.output;
  const errors = [];
  if (outcome === 'ready') {
    if (!resultRef?.endsWith('.html') || !findings.includes('renderer:visualize') || !findings.includes('interactive:true')) errors.push('visualize artifact binding is incomplete');
    if (!evidenceRefs.includes(resultRef)) errors.push('resultRef must be registered in evidenceRefs');
    for (const id of requiredScenarios) if (!findings.includes(`scenario:${id}`)) errors.push(`scenario:${id} is required`);
    if (!findings.includes('approval-command:postgres-outbox')) errors.push('approval command must bind the recommended option');
    if (findings.some((item) => item.startsWith('unresolved-critical:'))) errors.push('unresolvedCriticalIds must be empty');
    if (findings.includes('rejected-option:postgres-outbox')) errors.push('rejectedOptionIds cannot contain the recommended option');
  }
  return { valid: errors.length === 0, errors };
}

test('accepts an architecture approval result only with a complete visualize review binding', () => {
  assert.deepEqual(validateReview(validOutput()), { valid: true, errors: [] });
});

test('rejects a ready architecture decision without a visualize preview', () => {
  const output = validOutput();
  output.output.findings = output.output.findings.filter((item) => item !== 'renderer:visualize');
  assert.equal(validateReview(output).valid, false);
});

test('rejects missing failure scenarios and approval command drift', () => {
  const output = validOutput();
  output.output.findings = output.output.findings.filter((item) => item !== 'scenario:concurrency' && item !== 'approval-command:postgres-outbox');
  const result = validateReview(output);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /scenario:concurrency|approval command/);
});

test('rejects a preview that is not registered as produced evidence', () => {
  const output = validOutput();
  output.output.evidenceRefs = ['evidence://architecture/challenge'];
  const result = validateReview(output);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /resultRef/);
});

test('rejects agreement-first architecture evidence', () => {
  const output = validOutput();
  output.output.findings.push('unresolved-critical:data-loss', 'rejected-option:postgres-outbox');
  const result = validateReview(output);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /unresolvedCriticalIds|rejectedOptionIds/);
});
