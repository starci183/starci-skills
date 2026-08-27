import { validatorFor, runValidatorCli } from '../../validation.mjs';

function sameStrings(left, right) {
  const a = [...left].sort();
  const b = [...right].sort();
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

function semanticErrors(value) {
  const errors = [];
  const payload = value.payload;
  if (payload.decision !== 'directions-ready') return errors;

  const directions = payload.artifact.directions;
  const directionIds = directions.map((direction) => direction.id);
  if (!directionIds.includes(payload.artifact.recommendedId)) {
    errors.push('$.payload.artifact.recommendedId: must identify one direction');
  }

  const preview = payload.reviewPreview;
  if (!preview) {
    errors.push('$.payload.reviewPreview: directions-ready requires a visible-review binding');
    return errors;
  }
  if (!sameStrings(preview.directionIds, directionIds)) {
    errors.push('$.payload.reviewPreview.directionIds: must cover every generated direction exactly once');
  }
  if (preview.recommendedDirectionId !== payload.artifact.recommendedId) {
    errors.push('$.payload.reviewPreview.recommendedDirectionId: must equal the artifact recommendation');
  }
  if (!sameStrings(preview.viewports, ['wide', 'intermediate', 'compact'])) {
    errors.push('$.payload.reviewPreview.viewports: must cover wide, intermediate, and compact exactly');
  }
  if (!payload.produced.artifactRefs.includes(preview.artifactRef)) {
    errors.push('$.payload.reviewPreview.artifactRef: must be registered in produced.artifactRefs');
  }
  if (!payload.evidenceRefs.includes(preview.artifactRef)) {
    errors.push('$.payload.reviewPreview.artifactRef: must be registered in evidenceRefs');
  }

  const commandIds = preview.approvalCommands.map((item) => item.directionId);
  if (!sameStrings(commandIds, directionIds)) {
    errors.push('$.payload.reviewPreview.approvalCommands: must cover every generated direction exactly once');
  }
  const contentHash = preview.contentSha256.slice('sha256:'.length);
  for (const item of preview.approvalCommands) {
    const expected = `OK UI DIRECTION ${item.directionId}@${contentHash}`;
    if (item.command !== expected) {
      errors.push(`$.payload.reviewPreview.approvalCommands: invalid exact approval command for ${item.directionId}`);
    }
  }

  for (const fact of ['ui-directions-ready', 'ui-direction-visual-preview-ready']) {
    if (!value.facts.includes(fact)) errors.push(`$.facts: missing emitted fact ${fact}`);
    if (!payload.state.emits.factsAdd.includes(fact)) errors.push(`$.payload.state.emits.factsAdd: missing ${fact}`);
  }
  return errors;
}

export const validateOutput = validatorFor(new URL('./output.schema.json', import.meta.url), semanticErrors);

if (process.argv[1]?.endsWith('validate-output.mjs')) {
  await runValidatorCli(validateOutput, 'node validate-output.mjs <artifact.json>');
}
