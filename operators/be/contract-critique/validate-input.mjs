import { runValidatorCli, validatorFor } from '../../validation.mjs';
const schemaUrl = new URL('./input.schema.json', import.meta.url);
function semantic(value) {
  const errors = [];
  const loaded = value.payload.loads.artifacts.map((item) => item.ref);
  for (const ref of value.payload.provided.artifactRefs) if (!loaded.includes(ref)) errors.push(`/payload/loads/artifacts: missing exact binding for ${ref}`);
  if (value.payload.loads.knowledge[0]?.id !== 'be.plan-challenge') errors.push('/payload/loads/knowledge: exact operator knowledge required');
  const prefix = `session://tasks/${value.payload.session.taskId}/`;
  for (const key of ['inputRef','outputRef','scratchPrefix']) if (!value.payload.session[key].startsWith(prefix)) errors.push(`/payload/session/${key}: foreign task ref`);
  return errors;
}
export const validateInput = validatorFor(schemaUrl, semantic);
if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replaceAll('\\', '/')}`).href) await runValidatorCli(validateInput, 'usage: node validate-input.mjs <input.json>');
