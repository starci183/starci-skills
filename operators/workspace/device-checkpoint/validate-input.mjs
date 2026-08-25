import { runValidatorCli, validatorFor } from '../../validation.mjs';

const schemaUrl = new URL('./input.schema.json', import.meta.url);

function semantic(value) {
  const errors = [];
  for (const fact of ['workspace-route-ready', 'checkpoint-explicitly-authorized']) {
    if (!value.facts.includes(fact)) errors.push(`/facts: missing required fact ${fact}`);
  }
  const loaded = new Set(value.payload.loads.artifacts.map((item) => item.ref));
  const refs = [
    value.payload.provided.routeReceiptRef,
    value.payload.provided.approvalRef,
    value.payload.provided.deviceStateContractRef,
    ...value.payload.provided.touchedCheckoutRefs
  ];
  for (const ref of refs) if (!loaded.has(ref)) errors.push(`/payload/loads/artifacts: missing exact binding for ${ref}`);
  if (value.payload.loads.knowledge.length !== 0) errors.push('/payload/loads/knowledge: device checkpoint loads no Qdrant bodies');
  const prefix = `session://tasks/${value.payload.session.taskId}/`;
  for (const key of ['inputRef', 'outputRef', 'scratchPrefix']) {
    if (!value.payload.session[key].startsWith(prefix)) errors.push(`/payload/session/${key}: must belong to taskId`);
  }
  return errors;
}

export const validateInput = validatorFor(schemaUrl, semantic);

if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replaceAll('\\\\', '/')}`).href) {
  await runValidatorCli(validateInput, 'usage: node validate-input.mjs <input.json>');
}
