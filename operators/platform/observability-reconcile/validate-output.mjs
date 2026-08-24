import { runValidatorCli, validatorFor } from '../../validation.mjs';
const outcomes = {
  proved: { stage: 'platform.observability.proved', status: 'complete', operatorStatus: 'completed', code: 'platform-observability-reconcile-proved', retryable: false, factsAdd: ['platform-observability-proved'], factsRemove: [] },
  blocked: { stage: 'platform.blocked', status: 'blocked', operatorStatus: 'blocked', code: 'platform-observability-reconcile-blocked', retryable: true, factsAdd: ['platform-observability-blocked'], factsRemove: [] }
};
const same = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
function refs(value, found = []) { if (typeof value === 'string' && value.startsWith('session://')) found.push(value); else if (Array.isArray(value)) for (const item of value) refs(item, found); else if (value && typeof value === 'object') for (const item of Object.values(value)) refs(item, found); return found; }
function semantic(value) {
  const errors = [], p = value.payload, expected = outcomes[p.decision]; if (!expected) return ['$.payload.decision: undeclared decision'];
  if (value.stage !== expected.stage || value.status !== expected.status) errors.push('$: decision route mismatch');
  if (p.state.status !== expected.operatorStatus || p.state.code !== expected.code || p.state.retryable !== expected.retryable) errors.push('$.payload.state: decision semantics mismatch');
  if (p.state.emits.stage !== expected.stage || p.state.emits.status !== expected.status || !same(p.state.emits.factsAdd, expected.factsAdd) || !same(p.state.emits.factsRemove, expected.factsRemove)) errors.push('$.payload.state.emits: exact manifest emission required');
  for (const fact of expected.factsAdd) if (!value.facts.includes(fact)) errors.push(`$.facts: missing ${fact}`);
  if (p.decision === 'proved' && (p.produced.observabilityReceiptRef === null || p.produced.mutations.length === 0)) errors.push('$.payload.produced: proved output requires receipt and mutation');
  for (const mutation of p.produced.mutations) if (mutation.appliedBy !== 'coordinator') errors.push('$.payload.produced.mutations: coordinator ownership required');
  const prefix = `session://tasks/${p.cleanup.taskId}/`; for (const ref of refs({ produced: p.produced, cleanup: p.cleanup, evidenceRefs: p.evidenceRefs })) if (!ref.startsWith(prefix)) errors.push(`$: foreign output session ref ${ref}`);
  for (const item of p.context.used) if (/source[- ]?context|repository[- ]?context/i.test(item.ref)) errors.push('$.payload.context.used: broad context forbidden');
  return errors;
}
export const validateOutput = validatorFor(new URL('./output.schema.json', import.meta.url), semantic);
if (process.argv[1]?.endsWith('validate-output.mjs')) await runValidatorCli(validateOutput, 'node validate-output.mjs <artifact.json>');
