import { validatorFor, runValidatorCli } from '../../validation.mjs';

const semantic = (value) => {
  const errors = [];
  const routeProject = value.context.projectRoute.backendRouteRef.split('/')[2];
  if (routeProject !== value.context.projectRoute.project) errors.push('/context/projectRoute: project must match the verified backend route');
  if (value.context.businessHead.outcome !== value.input.targetOutcome) errors.push('/input/targetOutcome: must equal the approved business-visible outcome');
  return errors;
};

export const validateInput = validatorFor(new URL('./input.schema.json', import.meta.url), semantic);
if (process.argv[1]?.endsWith('validate-input.mjs')) await runValidatorCli(validateInput, 'node validate-input.mjs <input.json>');
