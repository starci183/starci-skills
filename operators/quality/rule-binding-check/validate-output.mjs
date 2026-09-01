import { validatorFor, runValidatorCli } from '../../validation.mjs';

export const validateOutput = validatorFor(new URL('./output.schema.json', import.meta.url), (value) => {
  const issues = [];
  const { outcome, resultRef, evidenceRefs, findings, reason } = value.output;
  if (outcome === 'pass') {
    if (typeof resultRef !== 'string') issues.push('rule PASS requires a concrete resultRef');
    if (evidenceRefs.length === 0) issues.push('rule PASS requires nonempty evidenceRefs');
    if (findings.length !== 0) issues.push('rule PASS cannot retain findings');
    if (reason !== null) issues.push('rule PASS cannot carry a fallback reason');
  } else if (outcome === 'fail') {
    if (typeof resultRef !== 'string') issues.push('rule failure requires a concrete resultRef');
    if (evidenceRefs.length === 0) issues.push('rule failure requires nonempty evidenceRefs');
    if (findings.length === 0) issues.push('rule failure requires exact findings');
    if (reason !== null) issues.push('rule failure cannot carry a fallback reason');
  } else {
    if (resultRef !== null) issues.push('blocked rule check cannot publish a resultRef');
    if (typeof reason !== 'string') issues.push('blocked rule check requires an exact reason');
  }
  return issues;
});

if (process.argv[1]?.endsWith('validate-output.mjs')) await runValidatorCli(validateOutput, 'node validate-output.mjs <artifact.json>');
