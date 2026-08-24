import { runValidatorCli, validatorFor } from '../../validation.mjs';

const outcomes = {
  proved: { stage: 'platform.mcp.proved', status: 'complete', operatorStatus: 'completed', code: 'platform-mcp-publish-proved', retryable: false, factsAdd: ['platform-mcp-proved'], factsRemove: [] },
  blocked: { stage: 'platform.blocked', status: 'blocked', operatorStatus: 'blocked', code: 'platform-mcp-publish-blocked', retryable: true, factsAdd: ['platform-mcp-blocked'], factsRemove: [] }
};
const same = (left, right) => JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());
function refs(value, found = []) { if (typeof value === 'string' && value.startsWith('session://')) found.push(value); else if (Array.isArray(value)) for (const item of value) refs(item, found); else if (value && typeof value === 'object') for (const item of Object.values(value)) refs(item, found); return found; }
function semantic(value) {
  const errors = [], payload = value.payload, expected = outcomes[payload.decision];
  if (!expected) return ['$.payload.decision: undeclared decision'];
  if (value.stage !== expected.stage || value.status !== expected.status) errors.push('$: decision does not match root route');
  if (payload.state.status !== expected.operatorStatus || payload.state.code !== expected.code || payload.state.retryable !== expected.retryable) errors.push('$.payload.state: decision semantics mismatch');
  const emits = payload.state.emits;
  if (emits.stage !== expected.stage || emits.status !== expected.status || !same(emits.factsAdd, expected.factsAdd) || !same(emits.factsRemove, expected.factsRemove)) errors.push('$.payload.state.emits: must exactly match manifest emission');
  for (const fact of expected.factsAdd) if (!value.facts.includes(fact)) errors.push(`$.facts: missing emitted fact ${fact}`);
  if (payload.decision === 'proved' && payload.produced.mcpPublishReceiptRef === null) errors.push('$.payload.produced.mcpPublishReceiptRef: proved output requires receipt');
  if (payload.decision === 'proved' && payload.produced.mutations.length === 0) errors.push('$.payload.produced.mutations: proved output requires a reported mutation');
  for (const mutation of payload.produced.mutations) if (mutation.appliedBy !== 'coordinator') errors.push('$.payload.produced.mutations: only coordinator mutations are valid');
  const prefix = `session://tasks/${payload.cleanup.taskId}/`;
  for (const ref of refs({ produced: payload.produced, cleanup: payload.cleanup, evidenceRefs: payload.evidenceRefs })) if (!ref.startsWith(prefix)) errors.push(`$: foreign output session ref ${ref}`);
  for (const item of payload.context.used) if (/source[- ]?context|repository[- ]?context/i.test(item.ref)) errors.push('$.payload.context.used: broad source context is forbidden');
  return errors;
}
export const validateOutput = validatorFor(new URL('./output.schema.json', import.meta.url), semantic);
if (process.argv[1]?.endsWith('validate-output.mjs')) await runValidatorCli(validateOutput, 'node validate-output.mjs <artifact.json>');
