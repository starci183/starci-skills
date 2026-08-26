import { runValidatorCli, validatorFor } from '../../validation.mjs';
const schemaUrl = new URL('./output.schema.json', import.meta.url);
function semantic(value) {
  const errors = [];
  if (value.payload.state.emits.stage !== value.stage || value.payload.state.emits.status !== value.status) errors.push('/payload/state/emits: route drift');
  if (!value.facts.includes('architecture-design-realization-ready')) errors.push('/facts: capability fact missing');
  if (value.payload.produced.durableWrites.length) errors.push('/payload/produced/durableWrites: analysis operator is read-only');
  return errors;
}
export const validateOutput = validatorFor(schemaUrl, semantic);
if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replaceAll('\\', '/')}`).href) await runValidatorCli(validateOutput, 'usage: node validate-output.mjs <output.json>');
