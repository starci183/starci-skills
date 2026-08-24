import { runValidatorCli, validatorFor } from '../../validation.mjs';

const schemaUrl = new URL('./input.schema.json', import.meta.url);

function semantic(value) {
  const errors = [];
  if (!value.facts.includes('deployment-host-ready')) errors.push('/facts: missing deployment-host-ready');
  const providedRefs = Object.values(value.payload.provided).flat();
  const loadedRefs = value.payload.loads.artifacts.map((item) => item.ref);
  for (const ref of providedRefs) if (!loadedRefs.includes(ref)) errors.push(`/payload/loads/artifacts: missing exact binding for ${ref}`);
  if (value.payload.loads.knowledge.length !== 1 || value.payload.loads.knowledge[0].id !== 'deployment.lifecycle') {
    errors.push('/payload/loads/knowledge: exact deployment.lifecycle binding required');
  }
  if (value.payload.loads.source.repositoryContext !== false || value.payload.loads.source.loadMode !== 'exact-files') {
    errors.push('/payload/loads/source: exact files only');
  }
  if (value.payload.loads.commands.loadMode !== 'declared-only' || value.payload.loads.commands.capture !== 'session-only') {
    errors.push('/payload/loads/commands: declared commands with session-only capture required');
  }
  const taskPrefix = `session://tasks/${value.payload.session.taskId}/`;
  for (const key of ['inputRef', 'outputRef', 'scratchPrefix']) {
    if (!value.payload.session[key].startsWith(taskPrefix)) errors.push(`/payload/session/${key}: must belong to taskId`);
  }
  return errors;
}

export const validateInput = validatorFor(schemaUrl, semantic);

if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replaceAll('\\', '/')}`).href) {
  await runValidatorCli(validateInput, 'usage: node validate-input.mjs <input.json>');
}
