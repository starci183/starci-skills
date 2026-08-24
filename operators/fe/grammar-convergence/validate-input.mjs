import path from 'node:path';
import { validatorFor, runValidatorCli } from '../../validation.mjs';

const guards = {
  "layout.review\u0000approved": {
    "all": [
      "layout-approved",
      "grammar-pair-ready",
      "neutral-facts-ready"
    ],
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
  if (loads.orchestration.profileRef !== profileByMode[loads.orchestration.mode]) errors.push('$.payload.loads.orchestration.profileRef: does not match mode');

  const knowledgeIds = new Set(loads.knowledge.map((item) => item.id));
  const selectedPrefix = `fe.grammar-${provided.grammarId}-`;
  const selectedOverview = `${selectedPrefix}overview`;
  const otherPrefix = provided.grammarId === 'core' ? 'fe.grammar-offset-pop-' : 'fe.grammar-core-';
  if (!knowledgeIds.has('fe.grammar-common-overview')) errors.push('$.payload.loads.knowledge: fe.grammar-common-overview is required');
  if (!knowledgeIds.has('fe.grammar-common-contracts')) errors.push('$.payload.loads.knowledge: fe.grammar-common-contracts is required');
  if (!knowledgeIds.has(selectedOverview)) errors.push(`$.payload.loads.knowledge: ${selectedOverview} is required for grammarId ${provided.grammarId}`);
  if (![...knowledgeIds].some((id) => id.startsWith(selectedPrefix) && id !== selectedOverview)) errors.push(`$.payload.loads.knowledge: at least one ${provided.grammarId} object or named case guide is required`);
  for (const id of knowledgeIds) if (id.startsWith(otherPrefix)) errors.push(`$.payload.loads.knowledge: ${id} belongs to the unselected Grammar`);

  const prefix = `session://tasks/${session.taskId}/`;
  const refs = [provided.priorStateRef, ...provided.authorityRefs, provided.approvalRef, ...loads.upstream.map((item) => item.ref), session.inputRef, session.outputRef, session.scratchPrefix].filter(Boolean);
  for (const ref of refs) if (!ref.startsWith(prefix)) errors.push(`$: session ref is outside task ${session.taskId}: ${ref}`);
  for (const item of loads.upstream) if (!provided.authorityRefs.includes(item.ref)) errors.push(`$.payload.loads.upstream: undeclared authority ref ${item.ref}`);


  return errors;
}

export const validateInput = validatorFor(new URL('./input.schema.json', import.meta.url), semanticErrors);

if (process.argv[1]?.endsWith('validate-input.mjs')) {
  await runValidatorCli(validateInput, 'node validate-input.mjs <artifact.json>');
}
