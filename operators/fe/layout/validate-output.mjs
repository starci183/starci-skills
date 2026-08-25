import { validatorFor, runValidatorCli } from '../../validation.mjs';

const outcomes = {
  "directions-ready": {
    "key": "directions-ready",
    "stage": "layout.review",
    "status": "pending",
    "operatorStatus": "pending",
    "code": "fe-layout-directions-ready",
    "retryable": false,
    "factsAdd": [
      "layout-directions-ready",
      "layout-visual-preview-ready"
    ],
    "factsRemove": [
      "layout-feedback-recorded"
    ]
  }
};
const successfulDecisions = new Set(["directions-ready"]);

function sameStrings(left, right) {
  const a = [...left].sort();
  const b = [...right].sort();
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

function semanticErrors(value) {
  const errors = [];
  const payload = value.payload;
  const expected = outcomes[payload.decision];
  if (!expected) return ['$.payload.decision: unknown decision'];
  const state = payload.state;
  if (value.stage !== expected.stage || value.status !== expected.status) errors.push('$: decision does not match root emitted state');
  if (state.status !== expected.operatorStatus || state.code !== expected.code || state.retryable !== expected.retryable) errors.push('$.payload.state: status, code, or retryability does not match decision');
  if (state.emits.stage !== expected.stage || state.emits.status !== expected.status) errors.push('$.payload.state.emits: does not match root emitted state');
  if (!sameStrings(state.emits.factsAdd, expected.factsAdd) || !sameStrings(state.emits.factsRemove, expected.factsRemove)) errors.push('$.payload.state.emits: fact delta does not match decision');
  for (const fact of expected.factsAdd) if (!value.facts.includes(fact)) errors.push(`$.facts: missing emitted fact ${fact}`);
  for (const fact of expected.factsRemove) if (value.facts.includes(fact)) errors.push(`$.facts: retained removed fact ${fact}`);

  const success = successfulDecisions.has(payload.decision);
  const produced = payload.produced;
  if (!success && (produced.mutations.length || produced.externalEffects.length)) errors.push('$.payload.produced: non-success output cannot claim a durable effect');


  if (success && produced.artifactRefs.length === 0) errors.push('$.payload.produced.artifactRefs: successful analysis requires a session artifact reference');

  const preview = payload.reviewPreview;
  if (!sameStrings(preview.viewports, ['wide', 'intermediate', 'compact'])) errors.push('$.payload.reviewPreview.viewports: must cover wide, intermediate, and compact exactly');
  if (!preview.directionIds.includes(preview.recommendedDirectionId)) errors.push('$.payload.reviewPreview.recommendedDirectionId: must identify one rendered direction');
  if (!produced.artifactRefs.includes(preview.artifactRef)) errors.push('$.payload.reviewPreview.artifactRef: must be registered in produced.artifactRefs');
  if (!payload.evidenceRefs.includes(preview.artifactRef)) errors.push('$.payload.reviewPreview.artifactRef: must be registered in evidenceRefs');
  const commandIds = preview.approvalCommands.map((item) => item.directionId);
  if (!sameStrings(commandIds, preview.directionIds)) errors.push('$.payload.reviewPreview.approvalCommands: must cover every rendered direction exactly once');
  for (const item of preview.approvalCommands) {
    if (item.command !== `OK LAYOUT ${item.directionId}`) errors.push(`$.payload.reviewPreview.approvalCommands: invalid exact approval command for ${item.directionId}`);
  }

  const taskMatch = payload.evidenceRefs[0]?.match(/^session:\/\/tasks\/([^/]+)\//);
  if (!taskMatch) errors.push('$.payload.evidenceRefs: cannot determine task ownership');
  else {
    const prefix = `session://tasks/${taskMatch[1]}/`;
    const refs = [preview.artifactRef, ...payload.evidenceRefs, ...payload.cleanup.scratchRefs, ...payload.produced.artifactRefs, ...payload.produced.externalEffects.map((item) => item.evidenceRef)];
    for (const ref of refs) if (!ref.startsWith(prefix)) errors.push(`$: session ref is outside output task: ${ref}`);
  }
  return errors;
}

export const validateOutput = validatorFor(new URL('./output.schema.json', import.meta.url), semanticErrors);

if (process.argv[1]?.endsWith('validate-output.mjs')) {
  await runValidatorCli(validateOutput, 'node validate-output.mjs <artifact.json>');
}
