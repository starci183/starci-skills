import { validatorFor, runValidatorCli } from '../../validation.mjs';
export const validateOutput = validatorFor(new URL('./output.schema.json', import.meta.url), (value) => {
  const errors = [];
  const { outcome, result, gaps } = value.output;
  if (outcome === 'repair') {
    if (result === null || result.score > 8 || result.route !== 'repair' || result.directionMode !== 'none') errors.push('repair requires a failed score and no direction generation');
    if (gaps.length) errors.push('repair cannot retain gaps');
  }
  if (outcome === 'reconstruct') {
    if (result === null || result.score >= 7 || result.route !== 'reconstruct' || !['dominant', 'comparison'].includes(result.directionMode)) errors.push('reconstruct requires score below 7 and one direction mode');
    if (gaps.length) errors.push('reconstruct cannot retain gaps');
  }
  const routedOwners = {
    'shared-authority-required': 'shared-authority',
    'business-required': 'business',
    'backend-required': 'backend',
    'session-recovery': 'session-recovery'
  };
  if (routedOwners[outcome] && (result === null || result.route !== routedOwners[outcome] || result.directionMode !== 'none' || gaps.length)) errors.push(`${outcome} requires its exact nonvisual route`);
  if (['authorization-required', 'blocked'].includes(outcome) && (result !== null || gaps.length === 0)) errors.push(`${outcome} requires null result and exact gaps`);
  return errors;
});
if (process.argv[1]?.endsWith('validate-output.mjs')) await runValidatorCli(validateOutput, 'node validate-output.mjs <output.json>');
