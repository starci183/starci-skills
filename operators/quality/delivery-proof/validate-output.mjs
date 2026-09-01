import { validatorFor, runValidatorCli } from '../../validation.mjs';

export const validateOutput = validatorFor(new URL('./output.schema.json', import.meta.url), (value) => {
  const issues = [];
  if (value.output.resultRef === null && value.output.reason === null) issues.push('resultRef and reason cannot both be null');
  if (value.output.outcome === 'pass') {
    if (typeof value.output.resultRef !== 'string') issues.push('quality PASS requires a concrete resultRef');
    if (value.output.reason !== null) issues.push('quality PASS cannot carry a narrative fallback reason');
    if (value.output.evidenceRefs.length === 0) issues.push('quality PASS requires nonempty evidenceRefs');
    if (typeof value.output.resultRef === 'string' && !value.output.evidenceRefs.includes(value.output.resultRef)) issues.push('quality PASS resultRef must be bound in evidenceRefs');
    for (const direction of ['add','change','remove']) {
      const refs=value.output.adversarialDecision?.[direction]?.evidenceRefs??[];
      if (refs.length===0) issues.push(`quality PASS requires evidenced ${direction} consideration`);
      if (refs.some((ref)=>!value.output.evidenceRefs.includes(ref))) issues.push(`quality PASS ${direction} evidence must be bound in top-level evidenceRefs`);
    }
  } else {
    if (value.output.resultRef !== null) issues.push('blocked quality proof cannot publish a resultRef');
    if (typeof value.output.reason !== 'string') issues.push('blocked quality proof requires an exact reason');
  }
  return issues;
});

if (process.argv[1]?.endsWith('validate-output.mjs')) await runValidatorCli(validateOutput, 'node validate-output.mjs <artifact.json>');
