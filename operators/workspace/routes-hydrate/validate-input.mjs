import { runValidatorCli, validatorFor } from '../../validation.mjs';

const schemaUrl = new URL('./input.schema.json', import.meta.url);
const knowledgeIds = ["workspace.initialization"];

function semantic(value) {
  const errors = [];
  if (!value.facts.includes('workspace-declarations-ready')) errors.push('/facts: missing required fact workspace-declarations-ready');
  const reentry = value.stage === 'workspace.initialization';
  if (reentry && !value.facts.includes('workspace-route-initialize-required')) errors.push('/facts: re-entry requires workspace-route-initialize-required');
  if (reentry && !value.payload.provided.routeInitializationEvidenceRef) errors.push('/payload/provided/routeInitializationEvidenceRef: re-entry evidence is required');
  if (!reentry && value.payload.provided.routeInitializationEvidenceRef) errors.push('/payload/provided/routeInitializationEvidenceRef: first pass must not provide route re-entry evidence');
  const providedRefs = Object.values(value.payload.provided).flat();
  const loadedRefs = value.payload.loads.artifacts.map((item) => item.ref);
  for (const ref of providedRefs) if (!loadedRefs.includes(ref)) errors.push(`/payload/loads/artifacts: missing exact binding for ${ref}`);
  const actualKnowledge = value.payload.loads.knowledge.map((item) => item.id).sort();
  if (JSON.stringify(actualKnowledge) !== JSON.stringify([...knowledgeIds].sort())) errors.push('/payload/loads/knowledge: exact knowledge set required');
  const taskPrefix = `session://tasks/${value.payload.session.taskId}/`;
  for (const key of ['inputRef', 'outputRef', 'scratchPrefix']) if (!value.payload.session[key].startsWith(taskPrefix)) errors.push(`/payload/session/${key}: must belong to taskId`);


  return errors;
}

export const validateInput = validatorFor(schemaUrl, semantic);

if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replaceAll('\\\\', '/')}`).href) {
  await runValidatorCli(validateInput, 'usage: node validate-input.mjs <input.json>');
}
