import { validatorFor, runValidatorCli } from '../../validation.mjs';

export const validateInput = validatorFor(new URL('./input.schema.json', import.meta.url), (value) => {
  const errors = [];
  const provided = value.payload.provided;
  const targets = value.payload.loads.exactTargets;
  const targetPaths = targets.map((target) => target.path);
  if (new Set(targetPaths).size !== targetPaths.length) errors.push('$.payload.loads.exactTargets: duplicate targets are forbidden');
  if (JSON.stringify([...provided.requestRefs].sort()) !== JSON.stringify([...targetPaths].sort())) errors.push('$.payload.loads.exactTargets: must match provided requestRefs exactly');
  const knowledgeIds = value.payload.loads.knowledge.map((item) => item.id);
  if (new Set(knowledgeIds).size !== 4) errors.push('$.payload.loads.knowledge: each declared knowledge binding is required exactly once');

  if (provided.phase === 'plan') {
    if (value.status !== 'ready') errors.push('$.status: plan requires ready');
    for (const fact of ['product-uat-failed', 'ux-ui-repair-required']) if (!value.facts.includes(fact)) errors.push(`$.facts: plan requires ${fact}`);
    if (provided.priorResolutionRef !== null) errors.push('$.payload.provided.priorResolutionRef: plan requires null');
    if (provided.repairReceiptRefs.length !== 0) errors.push('$.payload.provided.repairReceiptRefs: plan requires an empty array');
    if (targets.some((target) => !['captured', 'proven'].includes(target.currentStatus))) errors.push('$.payload.loads.exactTargets: plan accepts only captured or proven requests');
  }

  if (provided.phase === 'close') {
    if (value.status !== 'verify') errors.push('$.status: close requires verify');
    for (const fact of ['product-uat-passed', 'ux-ui-resolution-close-required']) if (!value.facts.includes(fact)) errors.push(`$.facts: close requires ${fact}`);
    if (provided.priorResolutionRef === null) errors.push('$.payload.provided.priorResolutionRef: close requires the prior resolution');
    if (provided.repairReceiptRefs.length === 0) errors.push('$.payload.provided.repairReceiptRefs: close requires repair receipts');
    if (targets.some((target) => target.currentStatus !== 'approved')) errors.push('$.payload.loads.exactTargets: close accepts only approved requests');
  }
  return errors;
});

if (process.argv[1]?.endsWith('validate-input.mjs')) await runValidatorCli(validateInput, 'node validate-input.mjs <artifact.json>');
