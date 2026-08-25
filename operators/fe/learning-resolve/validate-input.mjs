import path from 'node:path';
import { validatorFor, runValidatorCli } from '../../validation.mjs';

const guards = {
  "fe.maintenance.learning-resolve\u0000ready": {
    "all": ["feedback-request-reviewed"],
    "none": []
  }
};
const profileByMode = {
  economical: 'orchestration/modes/economical.json',
  balanced: 'orchestration/modes/balanced.json',
  parallel: 'orchestration/modes/parallel.json'
};

function semanticErrors(value) {
  const errors = [];
  const guard = guards[`${value.stage}\u0000${value.status}`] ?? { all: [], none: [] };
  for (const fact of guard.all) if (!value.facts.includes(fact)) errors.push(`$.facts: missing ${fact}`);
  for (const fact of guard.none) if (value.facts.includes(fact)) errors.push(`$.facts: forbidden ${fact}`);

  const { provided, loads, session } = value.payload;
  if (provided.businessHeadRef !== loads.business.ref) errors.push('$.payload.loads.business.ref: must equal provided.businessHeadRef');
  if (loads.orchestration.profileRef !== profileByMode[loads.orchestration.mode]) errors.push('$.payload.loads.orchestration.profileRef: does not match mode');

  const prefix = `session://tasks/${session.taskId}/`;
  const refs = [provided.priorStateRef, provided.requestRef, provided.businessHeadRef, ...provided.authorityRefs, provided.approvalRef, ...loads.upstream.map((item) => item.ref), session.inputRef, session.outputRef, session.scratchPrefix].filter(Boolean);
  for (const ref of refs) if (!ref.startsWith(prefix)) errors.push(`$: session ref is outside task ${session.taskId}: ${ref}`);
  const declaredUpstreamRefs = new Set([provided.requestRef, ...provided.authorityRefs]);
  for (const item of loads.upstream) if (!declaredUpstreamRefs.has(item.ref)) errors.push(`$.payload.loads.upstream: undeclared ref ${item.ref}`);
  if (!loads.upstream.some((item) => item.role === 'approved-request' && item.ref === provided.requestRef)) errors.push('$.payload.loads.upstream: requestRef must be loaded as approved-request');

  const normalized = loads.exactTargets.map((target) => target.path.replaceAll('\\\\', '/'));
  if (new Set(normalized).size !== normalized.length) errors.push('$.payload.loads.exactTargets: duplicate path');
  for (const [index, target] of normalized.entries()) {
    if (path.isAbsolute(target) || target === '..' || target.startsWith('../') || target.includes('/../')) errors.push(`$.payload.loads.exactTargets[${index}].path: unsafe repository-relative path`);
  }

  return errors;
}

export const validateInput = validatorFor(new URL('./input.schema.json', import.meta.url), semanticErrors);

if (process.argv[1]?.endsWith('validate-input.mjs')) {
  await runValidatorCli(validateInput, 'node validate-input.mjs <artifact.json>');
}
