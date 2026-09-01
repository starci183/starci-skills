import { validatorFor, runValidatorCli } from '../../validation.mjs';
import { capturePreflightOutputSemantic } from '../strict-ui-validation.mjs';
export const validateOutput = validatorFor(new URL('./output.schema.json', import.meta.url), (value) => {
  const errors = capturePreflightOutputSemantic(value);
  const { outcome, result, gaps, evidenceRefs, handoff } = value.output;
  if (evidenceRefs.length === 0) errors.push('$.output.evidenceRefs: every preflight decision requires deterministic evidence');
  if (outcome === 'ready') {
    if (handoff !== null) errors.push('$.output.handoff: ready preflight cannot emit a handoff');
    if (!result?.artifactRefs.includes(result.preflightRef)) errors.push('$.output.result.artifactRefs: must register preflightRef');
    if (result && !evidenceRefs.includes(result.compiledRequestRef)) errors.push('$.output.evidenceRefs: must include compiledRequestRef');
    if (result && !evidenceRefs.includes(result.sourceApplyReturnReceiptRef)) errors.push('$.output.evidenceRefs: must include sourceApplyReturnReceiptRef');
    for (const check of result?.readinessChecks ?? []) {
      if (!evidenceRefs.includes(check.evidenceRef)) errors.push(`$.output.evidenceRefs: missing readiness evidence ${check.evidenceRef}`);
    }
  }
  if (outcome === 'source-repair' && handoff !== null) errors.push('$.output.handoff: source repair remains inside the frontend mission');
  if (outcome === 'backend-required' && handoff?.skillId !== 'starci-backend-process') {
    errors.push('$.output.handoff: backend-required preflight requires an exact backend handoff');
  }
  if (outcome === 'blocked' && handoff !== null) errors.push('$.output.handoff: blocked preflight cannot emit a handoff');
  if (outcome !== 'ready' && result !== null) errors.push('$.output.result: non-ready preflight requires a null result');
  if (outcome !== 'ready' && gaps.length === 0) errors.push('$.output.gaps: non-ready preflight requires exact gaps');
  return errors;
});
if (process.argv[1]?.endsWith('validate-output.mjs')) await runValidatorCli(validateOutput, 'node validate-output.mjs <output.json>');
