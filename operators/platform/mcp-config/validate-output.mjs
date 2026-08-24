import { validatorFor, runValidatorCli } from '../../validation.mjs';

function sameStrings(left, right) {
  const a = [...left].sort();
  const b = [...right].sort();
  return a.length === b.length && a.every((item, index) => item === b[index]);
}
function sessionRefs(value, refs = []) {
  if (typeof value === 'string' && value.startsWith('session://')) refs.push(value);
  else if (Array.isArray(value)) for (const item of value) sessionRefs(item, refs);
  else if (value && typeof value === 'object') for (const item of Object.values(value)) sessionRefs(item, refs);
  return refs;
}
function semanticErrors(value) {
  const errors = [];
  const payload = value.payload;
  const expectedFacts = ['platform-mcp-config-ready'];
  if (payload.decision !== 'ready' || value.stage !== 'platform.mcp.index' || value.status !== 'ready') errors.push('$: ready decision must emit platform.mcp.index / ready');
  if (payload.state.operator !== 'platform/mcp-config' || payload.state.status !== 'completed' || payload.state.code !== 'platform-mcp-config-ready' || payload.state.retryable !== false) errors.push('$.payload.state: ready semantics mismatch');
  if (payload.state.emits.stage !== 'platform.mcp.index' || payload.state.emits.status !== 'ready' || !sameStrings(payload.state.emits.factsAdd, expectedFacts) || payload.state.emits.factsRemove.length) errors.push('$.payload.state.emits: route or facts mismatch');
  for (const fact of expectedFacts) if (!value.facts.includes(fact)) errors.push('$.facts: missing emitted fact ' + fact);
  if (payload.produced.mutations.length !== 1 || payload.produced.mutations[0]?.kind !== 'source') errors.push('$.payload.produced.mutations: ready requires exactly one generated-config source mutation');
  const prefix = 'session://tasks/' + payload.cleanup.taskId + '/';
  for (const ref of sessionRefs({ produced: payload.produced, cleanup: payload.cleanup, evidenceRefs: payload.evidenceRefs })) if (!ref.startsWith(prefix)) errors.push('$: output session ref is outside task ' + payload.cleanup.taskId + ': ' + ref);
  for (const used of payload.context.used) if (/source[- ]?context|repository[- ]?context/i.test(used.ref)) errors.push('$.payload.context.used: broad repository context is forbidden');
  return errors;
}

export const validateOutput = validatorFor(new URL('./output.schema.json', import.meta.url), semanticErrors);
if (process.argv[1]?.endsWith('validate-output.mjs')) await runValidatorCli(validateOutput, 'node validate-output.mjs <artifact.json>');
