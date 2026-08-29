import { validatorFor, runValidatorCli } from '../../validation.mjs';

const exactSet = (left, right) => JSON.stringify([...new Set(left)].sort()) === JSON.stringify([...new Set(right)].sort());

const semantic = (value) => {
  const errors = [];
  const { approvedPlan, approval, credentialCapability } = value.context;
  const { execution } = value.input;
  if (approval.planSha256 !== approvedPlan.sha256 || execution.expectedPlanSha256 !== approvedPlan.sha256) errors.push('/input/execution/expectedPlanSha256: plan, approval, and execution hashes must match');
  if (!exactSet(approval.allowedEffects, approvedPlan.effects)) errors.push('/context/approval/allowedEffects: must equal the exact planned effects');
  const requiredCapabilities = new Set(approvedPlan.effects.flatMap((effect) => effect === 'upsert-proxied-dns' ? ['dns:write'] : ['tunnel:write']));
  for (const capability of requiredCapabilities) if (!credentialCapability.capabilities.includes(capability)) errors.push(`/context/credentialCapability/capabilities: missing ${capability}`);
  try {
    if (new URL(execution.publicProbeUrl).hostname !== approvedPlan.hostname) errors.push('/input/execution/publicProbeUrl: hostname must equal the approved hostname');
  } catch {
    errors.push('/input/execution/publicProbeUrl: invalid URL');
  }
  return errors;
};

export const validateInput = validatorFor(new URL('./input.schema.json', import.meta.url), semantic);
if (process.argv[1]?.endsWith('validate-input.mjs')) await runValidatorCli(validateInput, 'node validate-input.mjs <input.json>');
