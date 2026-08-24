import { runValidatorCli, validatorFor } from '../../validation.mjs';
function refs(value, found = []) { if (typeof value === 'string' && value.startsWith('session://')) found.push(value); else if (Array.isArray(value)) for (const item of value) refs(item, found); else if (value && typeof value === 'object') for (const item of Object.values(value)) refs(item, found); return found; }
function semantic(value) {
  const errors = [], p = value.payload;
  if (value.stage !== 'platform.tunnel.apply' || value.status !== 'ready' || p.decision !== 'ready') errors.push('$: decision route mismatch');
  if (p.state.status !== 'completed' || p.state.code !== 'platform-tunnel-plan-ready' || p.state.retryable !== false) errors.push('$.payload.state: decision semantics mismatch');
  if (p.state.emits.stage !== 'platform.tunnel.apply' || p.state.emits.status !== 'ready' || JSON.stringify(p.state.emits.factsAdd) !== JSON.stringify(['platform-tunnel-plan-ready']) || p.state.emits.factsRemove.length !== 0) errors.push('$.payload.state.emits: exact manifest emission required');
  if (!value.facts.includes('platform-tunnel-plan-ready')) errors.push('$.facts: missing platform-tunnel-plan-ready');
  if (p.produced.mutations.length !== 0) errors.push('$.payload.produced.mutations: read-only operator cannot mutate');
  const prefix = `session://tasks/${p.cleanup.taskId}/`; for (const ref of refs({ produced: p.produced, cleanup: p.cleanup, evidenceRefs: p.evidenceRefs })) if (!ref.startsWith(prefix)) errors.push(`$: foreign output session ref ${ref}`);
  for (const item of p.context.used) if (/source[- ]?context|repository[- ]?context/i.test(item.ref)) errors.push('$.payload.context.used: broad context forbidden'); return errors;
}
export const validateOutput = validatorFor(new URL('./output.schema.json', import.meta.url), semantic);
if (process.argv[1]?.endsWith('validate-output.mjs')) await runValidatorCli(validateOutput, 'node validate-output.mjs <artifact.json>');
