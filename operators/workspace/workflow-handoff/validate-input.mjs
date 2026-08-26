import { runValidatorCli, validatorFor } from '../../validation.mjs';

const schemaUrl = new URL('./input.schema.json', import.meta.url);

function semantic(value) {
  const errors = [];
  for (const fact of ['workspace-route-ready', 'workflow-handoff-explicitly-authorized']) {
    if (!value.facts.includes(fact)) errors.push(`/facts: missing required fact ${fact}`);
  }
  const loaded = new Set(value.payload.loads.artifacts.map((item) => item.ref));
  const refs = [value.payload.provided.routeReceiptRef, value.payload.provided.approvalRef, ...value.payload.provided.touchedCheckoutRefs];
  for (const ref of refs) if (!loaded.has(ref)) errors.push(`/payload/loads/artifacts: missing exact binding for ${ref}`);
  if (value.payload.loads.knowledge.length !== 0) errors.push('/payload/loads/knowledge: workflow handoff loads no knowledge bodies');
  if (value.payload.provided.durableArtifactRefs.some((ref) => ref.startsWith('session://'))) errors.push('/payload/provided/durableArtifactRefs: session refs are not portable');
  const provided = value.payload.provided;
  if (provided.mode === 'publish') {
    if (provided.checkpointTag !== null) errors.push('/payload/provided/checkpointTag: publish mode creates the tag');
    if (typeof provided.resumeCapability !== 'string') errors.push('/payload/provided/resumeCapability: publish mode requires the next capability');
    if (typeof provided.resumeStage !== 'string') errors.push('/payload/provided/resumeStage: publish mode requires the next stage');
  } else {
    if (typeof provided.checkpointTag !== 'string') errors.push('/payload/provided/checkpointTag: resume mode requires an exact tag');
    if (provided.resumeCapability !== null || provided.resumeStage !== null) errors.push('/payload/provided: resume target must come from the verified tag');
    if (provided.durableArtifactRefs.length !== 0) errors.push('/payload/provided/durableArtifactRefs: resume artifacts must come from the verified tag');
  }
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
