import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const input = JSON.parse(readFileSync(new URL('./fe/source-apply/input.schema.json', import.meta.url), 'utf8'));
const output = JSON.parse(readFileSync(new URL('./fe/source-apply/output.schema.json', import.meta.url), 'utf8'));
const operator = JSON.parse(readFileSync(new URL('./fe/source-apply/operator.json', import.meta.url), 'utf8'));
const execute = readFileSync(new URL('./fe/source-apply/execute.md', import.meta.url), 'utf8');

test('source-apply owns one atomic apply-or-repair mutation', () => {
  assert.equal(operator.id, 'fe/source-apply');
  assert.deepEqual(input.properties.input.properties.mode.enum, ['apply', 'repair']);
  assert.deepEqual(input.properties.context.properties.resumeState.enum, ['apply', 'reapply']);
  assert.match(operator.job, /one frozen frontend contract/i);
  assert.doesNotMatch(execute, /choose the next operator/i);
});

test('source-apply consumes the complete author-once contract', () => {
  const required = input.properties.input.required;
  for (const field of [
    'compiledRequestRef', 'compiledRequestFingerprint', 'directionMode', 'directionBinding',
    'grammarBinding', 'proofMatrix', 'proofMatrixFingerprint', 'behaviorContractRef',
    'behaviorContractFingerprint', 'sourceBoundary', 'sourceBoundaryFingerprint',
  ]) assert.ok(required.includes(field), field);
});

test('a generated direction is bound by receipt, member id, artifact ref, and Grammar manifest', () => {
  const binding = input.properties.input.properties.directionBinding.anyOf[0];
  assert.deepEqual(binding.required, [
    'mode', 'directionGenerateReturnReceiptRef', 'selectedDirectionId',
    'selectedDirectionRef', 'grammarDecisionManifestRef',
  ]);
  assert.equal(binding.properties.directionGenerateReturnReceiptRef.pattern, '^receipt:[A-Za-z0-9._-]+$');
  assert.equal(binding.properties.grammarDecisionManifestRef.pattern, '^grammar://');
});

test('source-apply cannot claim success without exact effects and aggregate after-state', () => {
  const result = output.properties.output.properties.result.anyOf[0];
  for (const field of ['sourceBoundary', 'sourceBoundaryFingerprint', 'effectRecords', 'aggregateAfterFingerprint', 'artifactRefs']) {
    assert.ok(result.required.includes(field), field);
  }
  assert.deepEqual(result.properties.effectRecords.items.properties.effect.enum, ['created', 'updated', 'deleted']);
});
