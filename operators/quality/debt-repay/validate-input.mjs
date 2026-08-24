import { runValidatorCli, validatorFor } from '../../validation.mjs';

const schemaUrl = new URL('./input.schema.json', import.meta.url);
const requiredFacts = [];
const knowledgeIds = ["quality.readiness-repair"];

function semantic(value) {
  const errors = [];
  for (const fact of requiredFacts) if (!value.facts.includes(fact)) errors.push(`/facts: missing required fact ${fact}`);
  const providedRefs = Object.values(value.payload.provided).flat().filter((ref) => typeof ref === 'string');
  const loadedRefs = value.payload.loads.artifacts.map((item) => item.ref);
  for (const ref of providedRefs) if (!loadedRefs.includes(ref)) errors.push(`/payload/loads/artifacts: missing exact binding for ${ref}`);
  const actualKnowledge = value.payload.loads.knowledge.map((item) => item.id).sort();
  if (JSON.stringify(actualKnowledge) !== JSON.stringify([...knowledgeIds].sort())) errors.push('/payload/loads/knowledge: exact knowledge set required');
  const taskPrefix = `session://tasks/${value.payload.session.taskId}/`;
  for (const key of ['inputRef', 'outputRef', 'scratchPrefix']) if (!value.payload.session[key].startsWith(taskPrefix)) errors.push(`/payload/session/${key}: must belong to taskId`);
  for (const [key, ref] of Object.entries(value.payload.provided)) if (ref !== null && !ref.startsWith(taskPrefix)) errors.push(`/payload/provided/${key}: must belong to taskId`);
  for (const [index, artifact] of value.payload.loads.artifacts.entries()) if (!artifact.ref.startsWith(taskPrefix)) errors.push(`/payload/loads/artifacts/${index}/ref: must belong to taskId`);

  if (value.payload.loads.source.repositoryContext !== false || value.payload.loads.source.loadMode !== 'exact-files') errors.push('/payload/loads/source: only exact files are allowed');
  const targets = value.payload.loads.source.targetFiles;
  for (const [index, target] of targets.entries()) {
    const normalized = target.path.replaceAll('\\', '/');
    if (/^[A-Za-z]:\//.test(normalized) || normalized.startsWith('/') || normalized === '..' || normalized.startsWith('../') || normalized.includes('/../')) errors.push(`/payload/loads/source/targetFiles/${index}/path: must be a safe repository-relative path`);
  }
  if (value.payload.intent === 'repay') {
    if (value.payload.provided.closureProofRef !== null) errors.push('/payload/provided/closureProofRef: repay requires null');
    if (targets.length === 0) errors.push('/payload/loads/source/targetFiles: repay requires at least one exact target');
    if (value.payload.control.iteration >= value.payload.control.maxIterations) errors.push('/payload/control: repayment iteration budget exhausted');
    if (value.payload.control.iteration === 0 && value.payload.control.previousIterationFingerprint !== null) errors.push('/payload/control/previousIterationFingerprint: first iteration requires null');
    if (value.payload.control.iteration > 0 && value.payload.control.previousIterationFingerprint === null) errors.push('/payload/control/previousIterationFingerprint: later iterations require the prior fingerprint');
  } else {
    if (value.payload.provided.closureProofRef === null) errors.push('/payload/provided/closureProofRef: close requires independent proof');
    if (targets.length !== 0) errors.push('/payload/loads/source/targetFiles: close cannot load or mutate source');
  }

  return errors;
}

export const validateInput = validatorFor(schemaUrl, semantic);

if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replaceAll('\\\\', '/')}`).href) {
  await runValidatorCli(validateInput, 'usage: node validate-input.mjs <input.json>');
}
