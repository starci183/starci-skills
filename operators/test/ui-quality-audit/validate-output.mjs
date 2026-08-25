import { validatorFor, runValidatorCli } from '../../validation.mjs';

const outcomes = {
  'delivery-pass': { stage: 'test.ui.journey', status: 'ready', operatorStatus: 'completed', code: 'test-ui-quality-audit-delivery-pass', retryable: false, factsAdd: ['ui-quality-pass', 'ui-quality-evidence'], factsRemove: [] },
  'delivery-in-boundary': { stage: 'code.repair', status: 'repair', operatorStatus: 'repair', code: 'test-ui-quality-audit-delivery-in-boundary', retryable: true, factsAdd: ['ui-quality-failed', 'in-boundary-repair'], factsRemove: [] },
  'delivery-boundary-drift': { stage: 'layout.review', status: 'rejected', operatorStatus: 'replan', code: 'test-ui-quality-audit-delivery-boundary-drift', retryable: true, factsAdd: ['ui-quality-failed', 'boundary-drift', 'layout-feedback-recorded'], factsRemove: ['layout-approved'] },
  'audit-pass': { stage: 'ui.quality.result', status: 'complete', operatorStatus: 'completed', code: 'test-ui-quality-audit-audit-pass', retryable: false, factsAdd: ['ui-quality-pass', 'ui-quality-evidence'], factsRemove: [] },
  'audit-findings': { stage: 'ui.quality.result', status: 'ready', operatorStatus: 'completed', code: 'test-ui-quality-audit-audit-findings', retryable: false, factsAdd: ['ui-quality-findings', 'ui-quality-evidence'], factsRemove: [] },
  blocked: { stage: 'ui.quality.review', status: 'blocked', operatorStatus: 'blocked', code: 'test-ui-quality-audit-blocked', retryable: false, factsAdd: ['ui-quality-blocked'], factsRemove: [] }
};

function same(left, right) {
  left = [...left].sort();
  right = [...right].sort();
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

function refs(value, output = []) {
  if (typeof value === 'string' && value.startsWith('session://')) output.push(value);
  else if (Array.isArray(value)) for (const item of value) refs(item, output);
  else if (value && typeof value === 'object') for (const item of Object.values(value)) refs(item, output);
  return output;
}

function semanticErrors(value) {
  const errors = [];
  const payload = value.payload;
  const outcome = outcomes[payload.decision];
  if (!outcome) return ['$.payload.decision: unknown decision'];
  if (value.stage !== outcome.stage || value.status !== outcome.status) errors.push('$: decision route mismatch');
  if (payload.state.status !== outcome.operatorStatus || payload.state.code !== outcome.code || payload.state.retryable !== outcome.retryable) errors.push('$.payload.state: semantics mismatch');
  if (payload.state.emits.stage !== outcome.stage || payload.state.emits.status !== outcome.status || !same(payload.state.emits.factsAdd, outcome.factsAdd) || !same(payload.state.emits.factsRemove, outcome.factsRemove)) errors.push('$.payload.state.emits: mismatch');
  for (const fact of outcome.factsAdd) if (!value.facts.includes(fact)) errors.push(`$.facts: missing ${fact}`);

  const prefix = `session://tasks/${payload.cleanup.taskId}/`;
  for (const ref of refs({ produced: payload.produced, cleanup: payload.cleanup, evidenceRefs: payload.evidenceRefs })) if (!ref.startsWith(prefix)) errors.push(`$: foreign output session ref ${ref}`);
  if (payload.produced.mutations.length !== 0) errors.push('$.payload.produced.mutations: audit is check-only');

  const ruleIds = payload.produced.ruleResults.map((item) => item.ruleId);
  if (new Set(ruleIds).size !== ruleIds.length) errors.push('$.payload.produced.ruleResults: duplicate ruleId');
  for (const [index, item] of payload.produced.ruleResults.entries()) {
    if (item.applicability === 'not-applicable' && item.result !== 'not-applicable') errors.push(`$.payload.produced.ruleResults[${index}]: not-applicable rule must have not-applicable result`);
    if (item.applicability === 'applicable' && item.result === 'not-applicable') errors.push(`$.payload.produced.ruleResults[${index}]: applicable rule cannot have not-applicable result`);
    if (item.applicability === 'applicable' && item.evidenceRefs.length === 0) errors.push(`$.payload.produced.ruleResults[${index}].evidenceRefs: applicable result requires evidence`);
  }

  const applicable = payload.produced.ruleResults.filter((item) => item.applicability === 'applicable');
  const passDecision = payload.decision === 'delivery-pass' || payload.decision === 'audit-pass';
  if (passDecision && (applicable.length === 0 || applicable.some((item) => item.result !== 'pass'))) errors.push('$.payload.produced.ruleResults: pass requires every applicable rule to pass');
  if (payload.decision === 'audit-findings' && !applicable.some((item) => item.result === 'fail')) errors.push('$.payload.produced.ruleResults: audit-findings requires an evidenced failure');
  if ((payload.decision === 'delivery-in-boundary' || payload.decision === 'delivery-boundary-drift') && !applicable.some((item) => item.result === 'fail')) errors.push('$.payload.produced.ruleResults: delivery failure requires an evidenced failure');
  if (payload.decision === 'blocked' && !applicable.some((item) => item.result === 'blocked')) errors.push('$.payload.produced.ruleResults: blocked decision requires a blocked rule');
  return errors;
}

export const validateOutput = validatorFor(new URL('./output.schema.json', import.meta.url), semanticErrors);
if (process.argv[1]?.endsWith('validate-output.mjs')) await runValidatorCli(validateOutput, 'node validate-output.mjs <artifact.json>');
