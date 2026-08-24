import { validatorFor, runValidatorCli } from '../../validation.mjs';

const outcomes = {
  ready: {
    stage: 'quality.format', status: 'ready', operatorStatus: 'completed',
    code: 'implementation-complete', retryable: false, factsAdd: ['backend-source-written']
  },
  'source-drift': {
    stage: 'architecture.boundary', status: 'ready', operatorStatus: 'replan',
    code: 'source-revision-drift', retryable: true, factsAdd: ['backend-boundary-feedback', 'source-drift']
  },
  'boundary-drift': {
    stage: 'architecture.boundary', status: 'ready', operatorStatus: 'replan',
    code: 'approved-boundary-insufficient', retryable: true, factsAdd: ['backend-boundary-feedback', 'boundary-drift']
  },
  blocked: {
    stage: 'be.blocked', status: 'blocked', operatorStatus: 'blocked',
    code: 'required-binding-unavailable', retryable: false, factsAdd: ['backend-implementation-blocked']
  }
};

function sameStrings(left, right) {
  return left.length === right.length && [...left].sort().every((item, index) => item === [...right].sort()[index]);
}

function semanticErrors(value) {
  const errors = [];
  const payload = value.payload;
  const expected = outcomes[payload.decision];
  if (!expected) return ['$.payload.decision: unknown decision'];
  const state = payload.state;
  if (value.stage !== expected.stage || value.status !== expected.status) errors.push('$: decision does not match root emitted state');
  if (state.status !== expected.operatorStatus || state.code !== expected.code || state.retryable !== expected.retryable) {
    errors.push('$.payload.state: status, code, or retryability does not match decision');
  }
  if (state.emits.stage !== expected.stage || state.emits.status !== expected.status) errors.push('$.payload.state.emits: does not match root emitted state');
  if (!sameStrings(state.emits.factsAdd, expected.factsAdd)) errors.push('$.payload.state.emits.factsAdd: does not match decision');
  for (const fact of expected.factsAdd) if (!value.facts.includes(fact)) errors.push(`$.facts: missing emitted fact ${fact}`);

  const changed = payload.produced.mutations.length > 0;
  const hasReceipt = typeof payload.produced.changeReceiptRef === 'string';
  if (payload.decision === 'ready' && (!changed || !hasReceipt)) errors.push('$.payload.produced: ready requires mutations and a session change receipt');
  if (payload.decision !== 'ready' && (changed || hasReceipt)) errors.push('$.payload.produced: non-ready output cannot claim source mutations');
  return errors;
}

export const validateOutput = validatorFor(new URL('./output.schema.json', import.meta.url), semanticErrors);

if (process.argv[1]?.endsWith('validate-output.mjs')) {
  await runValidatorCli(validateOutput, 'node validate-output.mjs <artifact.json>');
}
