import { runValidatorCli, validatorFor } from '../../validation.mjs';

const schemaUrl = new URL('./input.schema.json', import.meta.url);
const requiredFacts = ["backend-patterns-ready"];
const knowledgeIds = ["be.boundary-planning"];

function semantic(value) {
  const errors = [];
  for (const fact of requiredFacts) if (!value.facts.includes(fact)) errors.push(`/facts: missing required fact ${fact}`);
  const providedRefs = Object.values(value.payload.provided).flat();
  const loadedRefs = value.payload.loads.artifacts.map((item) => item.ref);
  for (const ref of providedRefs) if (!loadedRefs.includes(ref)) errors.push(`/payload/loads/artifacts: missing exact binding for ${ref}`);
  const actualKnowledge = value.payload.loads.knowledge.map((item) => item.id).sort();
  if (JSON.stringify(actualKnowledge) !== JSON.stringify([...knowledgeIds].sort())) errors.push('/payload/loads/knowledge: exact knowledge set required');
  const taskPrefix = `session://tasks/${value.payload.session.taskId}/`;
  for (const key of ['inputRef', 'outputRef', 'scratchPrefix']) if (!value.payload.session[key].startsWith(taskPrefix)) errors.push(`/payload/session/${key}: must belong to taskId`);
  if (!/^\.worktrees\/[a-z0-9][a-z0-9-]*\/businesses\//.test(value.payload.loads.business.authorityPath)) errors.push('/payload/loads/business/authorityPath: business authority must come from .worktrees/<project>/businesses');

  return errors;
}

export const validateInput = validatorFor(schemaUrl, semantic);

if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replaceAll('\\\\', '/')}`).href) {
  await runValidatorCli(validateInput, 'usage: node validate-input.mjs <input.json>');
}
