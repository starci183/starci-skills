import { validatorFor, runValidatorCli } from '../../validation.mjs';

const profileByMode = {
  economical: 'orchestration/modes/economical.json',
  balanced: 'orchestration/modes/balanced.json',
  parallel: 'orchestration/modes/parallel.json'
};

function semanticErrors(value) {
  const errors = [];
  const { provided, loads, session } = value.payload;
  if (!value.facts.includes('feedback-request-recorded')) errors.push('$.facts: missing feedback-request-recorded');
  if (loads.orchestration.profileRef !== profileByMode[loads.orchestration.mode]) errors.push('$.payload.loads.orchestration.profileRef: does not match mode');
  const prefix = `session://tasks/${session.taskId}/`;
  const refs = [provided.priorStateRef, provided.requestRef, provided.reviewEvidenceRef, ...loads.upstream.map((item) => item.ref), session.inputRef, session.outputRef, session.scratchPrefix];
  for (const ref of refs) if (!ref.startsWith(prefix)) errors.push(`$: session ref is outside task ${session.taskId}: ${ref}`);
  if (!loads.upstream.some((item) => item.role === 'request' && item.ref === provided.requestRef)) errors.push('$.payload.loads.upstream: requestRef must be loaded with role request');
  if (!loads.upstream.some((item) => item.role === 'review-evidence' && item.ref === provided.reviewEvidenceRef)) errors.push('$.payload.loads.upstream: reviewEvidenceRef must be loaded with role review-evidence');
  const target = loads.exactTargets[0]?.path.replaceAll('\\', '/');
  if (!target?.startsWith('.claude/requests/') || !target.endsWith('.request.json')) errors.push('$.payload.loads.exactTargets: target must remain under .claude/requests');
  if (provided.targetOwners.includes('local-only') && provided.targetOwners.length > 1) errors.push('$.payload.provided.targetOwners: local-only cannot be combined with an upgrade owner');
  return errors;
}

export const validateInput = validatorFor(new URL('./input.schema.json', import.meta.url), semanticErrors);
if (process.argv[1]?.endsWith('validate-input.mjs')) await runValidatorCli(validateInput, 'node validate-input.mjs <artifact.json>');
