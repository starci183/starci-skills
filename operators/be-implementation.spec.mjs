import assert from 'node:assert/strict';
import test from 'node:test';
import { validateInput } from './be/implementation/validate-input.mjs';
import { validateOutput } from './be/implementation/validate-output.mjs';

const hash = (character) => `sha256:${character.repeat(64)}`;

function validInput() {
  return {
    schemaVersion: 7,
    operatorId: 'be/implementation',
    context: {
      contextRefs: [
        '.worktrees/businesses/create-vps/model.json',
        'artifact://architecture/approved-boundary',
        'artifact://be/frozen-coding-scope',
        `target-set:${hash('9')}`
      ],
      sourceRefs: ['src/vps/vps.service.ts']
    },
    input: {
      project: 'starci-academy',
      objectiveRef: 'implement create VPS at git:abcdef1',
      sourceFingerprint: hash('d')
    }
  };
}

function validReadyOutput() {
  return {
    schemaVersion: 7,
    operatorId: 'be/implementation',
    output: {
      outcome: 'ready',
      resultRef: 'artifact://be/change-receipt',
      evidenceRefs: ['src/vps/vps.service.ts@sha256:' + 'e'.repeat(64)],
      findings: ['mutation:src/vps/vps.service.ts', 'before:' + hash('d'), 'after:' + hash('e')],
      reason: null
    }
  };
}

function validateImplementationInput(value) {
  const base = validateInput(value);
  if (!base.valid) return base;
  const errors = [];
  if (value.context.sourceRefs.some((ref) => ref === '.' || ref.endsWith('/'))) errors.push('repository source context is forbidden');
  if (value.context.contextRefs.some((ref) => ref.includes('session://'))) errors.push('session references are forbidden');
  if (!value.context.contextRefs.some((ref) => /^\.worktrees\/businesses\//.test(ref))) errors.push('project-scoped businesses authority is required');
  if (!value.context.contextRefs.some((ref) => ref.startsWith('artifact://be/frozen-coding-scope'))) errors.push('frozen coding scope is required');
  if (!value.context.contextRefs.includes(`target-set:${hash('9')}`)) errors.push('frozen target set differs');
  return { valid: errors.length === 0, errors };
}

function validateImplementationOutput(value) {
  const base = validateOutput(value);
  if (!base.valid) return base;
  const errors = [];
  if (value.output.outcome !== 'ready' && value.output.resultRef !== null) errors.push('non-ready outcome cannot claim mutations');
  return { valid: errors.length === 0, errors };
}

test('accepts the closed strict-v7 input and explicit ready outcome', () => {
  assert.deepEqual(validateImplementationInput(validInput()), { valid: true, errors: [] });
  assert.deepEqual(validateImplementationOutput(validReadyOutput()), { valid: true, errors: [] });
});

test('refuses repository source context and session references', () => {
  const sourceContext = validInput();
  sourceContext.context.sourceRefs = ['.'];
  assert.equal(validateImplementationInput(sourceContext).valid, false);
  const sessionContext = validInput();
  sessionContext.context.contextRefs.push('session://tasks/task-2/business');
  assert.equal(validateImplementationInput(sessionContext).valid, false);
});

test('requires project-scoped business authority', () => {
  const input = validInput();
  input.context.contextRefs[0] = '.worktrees/business/create-vps/model.json';
  assert.equal(validateImplementationInput(input).valid, false);
});

test('requires a frozen coding scope before opening exact source', () => {
  const missing = validInput();
  missing.context.contextRefs = missing.context.contextRefs.filter((ref) => !ref.startsWith('artifact://be/frozen-coding-scope'));
  assert.equal(validateImplementationInput(missing).valid, false);
  const drifted = validInput();
  drifted.context.contextRefs[3] = `target-set:${hash('8')}`;
  assert.equal(validateImplementationInput(drifted).valid, false);
});

test('refuses a non-ready outcome that claims source mutations', () => {
  const output = validReadyOutput();
  output.output.outcome = 'source-drift';
  output.output.reason = 'source fingerprint changed';
  assert.equal(validateImplementationOutput(output).valid, false);
});
