import { validatorFor, runValidatorCli } from '../../validation.mjs';

export const validateOutput = validatorFor(new URL('./output.schema.json', import.meta.url), (value) => {
  const issues = [];
  const { outcome, resultRef, evidenceRefs, findings, reason } = value.output;
  if (outcome === 'green') {
    if (typeof resultRef !== 'string') issues.push('green readiness requires a concrete resultRef');
    if (evidenceRefs.length === 0) issues.push('green readiness requires nonempty evidenceRefs');
    if (findings.length !== 0) issues.push('green readiness cannot retain findings');
    if (reason !== null) issues.push('green readiness cannot carry a fallback reason');
  } else if (outcome === 'findings') {
    if (typeof resultRef !== 'string') issues.push('readiness findings require a concrete resultRef');
    if (evidenceRefs.length === 0) issues.push('readiness findings require nonempty evidenceRefs');
    if (findings.length === 0) issues.push('readiness findings require exact findings');
    if (reason !== null) issues.push('readiness findings cannot carry a fallback reason');
  } else {
    if (resultRef !== null) issues.push('blocked readiness cannot publish a resultRef');
    if (typeof reason !== 'string') issues.push('blocked readiness requires an exact reason');
  }
  return issues;
});

if (process.argv[1]?.endsWith('validate-output.mjs')) await runValidatorCli(validateOutput, 'node validate-output.mjs <artifact.json>');
