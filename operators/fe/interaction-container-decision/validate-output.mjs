import { validatorFor, runValidatorCli } from '../../validation.mjs';

const containers = ['page', 'modal', 'drawer', 'popover', 'inline'];

export const validateOutput = validatorFor(new URL('./output.schema.json', import.meta.url), (value) => {
  if (value.payload.decision !== 'containers-ready') return [];
  const errors = [];
  const decisions = value.payload.artifact.decisions;
  const ids = decisions.map((item) => item.interactionId);
  if (new Set(ids).size !== ids.length) errors.push('$.payload.artifact.decisions: interaction ids must be unique');

  for (const [index, item] of decisions.entries()) {
    const at = `$.payload.artifact.decisions[${index}]`;
    const rejected = item.rejections.map((entry) => entry.container);
    const expectedRejected = containers.filter((container) => container !== item.selected);
    if (new Set(rejected).size !== rejected.length || expectedRejected.some((container) => !rejected.includes(container))) {
      errors.push(`${at}.rejections: reject every non-selected container exactly once`);
    }
    if (!item.considered.includes(item.selected)) errors.push(`${at}.considered: selected container was not considered`);
    if (item.responsive.desktop !== item.selected) errors.push(`${at}.responsive.desktop: must equal the selected desktop container`);

    const behavior = item.behavior;
    if (item.selected === 'page' && item.taskRole === 'anchored-micro-choice') errors.push(`${at}.selected: an anchored micro-choice cannot be a page`);
    if (item.selected === 'modal' && (!behavior.blocksBackground || !behavior.mustCompleteOrCancel || behavior.urlOwned || behavior.resumable || behavior.stepCount > 1 || behavior.longContent || behavior.comparisonRequired)) {
      errors.push(`${at}.selected: modal requires one bounded blocking decision without durable, long, resumable, or comparison work`);
    }
    if (item.selected === 'drawer' && (!behavior.preservesPageContext || item.taskRole === 'primary-task')) {
      errors.push(`${at}.selected: drawer requires contextual secondary work that preserves the page`);
    }
    if (item.selected === 'popover' && (behavior.blocksBackground || behavior.urlOwned || behavior.resumable || behavior.stepCount > 1 || behavior.longContent || !['anchored-micro-choice', 'stable-region'].includes(item.taskRole))) {
      errors.push(`${at}.selected: popover is limited to a lightweight anchored disclosure or micro-choice`);
    }
    if (item.selected === 'inline' && behavior.stableInlineOwnerRef === null) errors.push(`${at}.behavior.stableInlineOwnerRef: inline presentation requires a stable owner`);
    if (['modal', 'drawer', 'popover'].includes(item.selected) && behavior.focusReturnRef === null) errors.push(`${at}.behavior.focusReturnRef: overlays require explicit focus return`);
    if (item.selected === 'drawer' && !['sheet', 'fullscreen-modal'].includes(item.responsive.mobile)) errors.push(`${at}.responsive.mobile: a desktop drawer must declare sheet or fullscreen transformation`);
  }
  return errors;
});

if (process.argv[1]?.endsWith('validate-output.mjs')) {
  await runValidatorCli(validateOutput, 'node validate-output.mjs <artifact.json>');
}
