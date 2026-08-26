import { validatorFor, runValidatorCli } from '../../validation.mjs';

export const validateOutput = validatorFor(new URL('./output.schema.json', import.meta.url), (value) => {
  if (value.payload.decision !== 'detail-frozen') return [];
  const artifact = value.payload.artifact;
  const errors = [];
  const ids = artifact.surfaceTree.map((surface) => surface.id);
  const surfaces = new Set(ids);
  if (surfaces.size !== ids.length) errors.push('$.payload.artifact.surfaceTree: surface ids must be unique');
  for (const surface of artifact.surfaceTree) {
    if (surface.parentId !== null && !surfaces.has(surface.parentId)) errors.push(`$.payload.artifact.surfaceTree: ${surface.id} has unknown parent`);
  }
  if (artifact.breadcrumb.visibility === 'required' && artifact.breadcrumb.items.length < 2) errors.push('$.payload.artifact.breadcrumb.items: required breadcrumb needs hierarchy');
  for (const policy of [...artifact.decorationPolicy.icons, ...artifact.decorationPolicy.separators]) {
    if (!surfaces.has(policy.targetId)) errors.push(`$.payload.artifact.decorationPolicy: unknown target ${policy.targetId}`);
  }
  for (const responsive of artifact.responsiveMatrix) {
    for (const id of responsive.surfaceOrder) if (!surfaces.has(id)) errors.push(`$.payload.artifact.responsiveMatrix: unknown surface ${id}`);
  }
  const interactionIds = artifact.interactionContainers.map((item) => item.interactionId);
  if (new Set(interactionIds).size !== interactionIds.length) errors.push('$.payload.artifact.interactionContainers: interaction ids must be unique');
  for (const [index, item] of artifact.interactionContainers.entries()) {
    const at = `$.payload.artifact.interactionContainers[${index}]`;
    if (!surfaces.has(item.triggerSurfaceId)) errors.push(`${at}.triggerSurfaceId: unknown surface`);
    if (!surfaces.has(item.containerSurfaceId)) errors.push(`${at}.containerSurfaceId: unknown surface`);
    if (item.focusReturnSurfaceId !== null && !surfaces.has(item.focusReturnSurfaceId)) errors.push(`${at}.focusReturnSurfaceId: unknown surface`);
    if (item.desktop !== item.selected) errors.push(`${at}.desktop: must preserve the approved desktop selection`);
    if (['modal', 'drawer', 'popover'].includes(item.selected) && item.focusReturnSurfaceId === null) errors.push(`${at}.focusReturnSurfaceId: overlays require explicit focus return`);
  }
  return errors;
});

if (process.argv[1]?.endsWith('validate-output.mjs')) {
  await runValidatorCli(validateOutput, 'node validate-output.mjs <artifact.json>');
}
