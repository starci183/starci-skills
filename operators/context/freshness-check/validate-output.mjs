import { validatorFor, runValidatorCli } from '../../validation.mjs';

const outcomeContract = {
  fresh: { reason: 'current', hasReceipt: true },
  'initialize-required': { reasons: new Set(['missing', 'identity-drift']), hasReceipt: false },
  blocked: { reason: 'invalid', hasReceipt: false }
};

const semantic = (value) => {
  const { outcome, reason, receiptRef } = value.output;
  const contract = outcomeContract[outcome];
  const reasonMatches = contract.reason === reason || contract.reasons?.has(reason);
  const receiptMatches = contract.hasReceipt === (receiptRef !== null);
  return [
    ...(!reasonMatches ? [`/output/reason: ${reason} is invalid for ${outcome}`] : []),
    ...(!receiptMatches ? [`/output/receiptRef: receipt presence is invalid for ${outcome}`] : [])
  ];
};

export const validateOutput = validatorFor(new URL('./output.schema.json', import.meta.url), semantic);

if (process.argv[1]?.endsWith('validate-output.mjs')) {
  await runValidatorCli(validateOutput, 'node validate-output.mjs <output.json>');
}
