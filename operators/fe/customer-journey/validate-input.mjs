import path from 'node:path';
import { validatorFor, runValidatorCli } from '../../validation.mjs';

const guards = {
  "flow.generate\u0000ready": {
    "all": [
      "preflight-complete"
    ],
    "none": []
  },
  "flow.review\u0000rejected": {
    "all": [
      "flow-feedback-recorded"
    ],
    "none": [
      "flow-approved"
    ]
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
  const refs = [provided.priorStateRef, provided.businessHeadRef, ...provided.authorityRefs, provided.approvalRef, ...loads.upstream.map((item) => item.ref), session.inputRef, session.outputRef, session.scratchPrefix].filter(Boolean);
  for (const ref of refs) if (!ref.startsWith(prefix)) errors.push(`$: session ref is outside task ${session.taskId}: ${ref}`);
  for (const item of loads.upstream) if (!provided.authorityRefs.includes(item.ref)) errors.push(`$.payload.loads.upstream: undeclared authority ref ${item.ref}`);
  const roles = new Set(loads.upstream.map((item) => item.role));
  for (const role of ['preflight', 'business-freshness']) if (!roles.has(role)) errors.push(`$.payload.loads.upstream: missing required role ${role}`);
  if (value.stage === 'flow.generate' && roles.has('flow-feedback')) errors.push('$.payload.loads.upstream: initial generation cannot load flow feedback');
  if (value.stage === 'flow.review' && !roles.has('flow-feedback')) errors.push('$.payload.loads.upstream: rejected review requires flow-feedback');


  return errors;
}

export const validateInput = validatorFor(new URL('./input.schema.json', import.meta.url), semanticErrors);

if (process.argv[1]?.endsWith('validate-input.mjs')) {
  await runValidatorCli(validateInput, 'node validate-input.mjs <artifact.json>');
}
