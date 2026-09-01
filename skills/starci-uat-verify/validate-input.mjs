import { validatorFor, runValidatorCli } from '../../operators/validation.mjs';
import { assertProgress, fingerprint } from '../../runtime/trace.mjs';
import { isRouteIssuedTransitionReceipt, routeIssuedTransitionFor } from '../../runtime/route-transition.mjs';
import { validatePublicSkillReceipt } from '../receipt-consumption.mjs';

const schemaValidate = validatorFor(new URL('./input.schema.json', import.meta.url));
const sameSequence = (left, right) => left.length === right.length && left.every((item, index) => item === right[index]);

export function validateInput(value) {
  const result = schemaValidate(value);
  if (!result.valid) return result;
  const errors = [];
  const receipt = value.returnReceipt;
  const origin = value.origin;
  if (receipt === null) return { valid: false, errors: ['UAT requires the exact canonical Quality delivery-proof PASS origin'] };
  if (origin.returnReceiptRef !== receipt.receiptId) errors.push('origin returnReceiptRef does not identify returnReceipt');
  errors.push(...validatePublicSkillReceipt(receipt, {
    label: 'origin Quality PASS', allowedTypes: ['RETURN'], expectedMissionId: value.runId,
    expectedSkillId: 'starci-quality-assure', expectedParentId: origin.expectedCallReceiptRef, consume: false,
  }));
  try { assertProgress([...value.progressHistory, receipt.progressFingerprint]); } catch (error) { errors.push(error.message); }
  const transition = routeIssuedTransitionFor(receipt);
  const output = receipt.trace?.actualOutput?.output;
  const proofInput = receipt.trace?.input?.input;
  if (receipt.operatorId !== 'quality/delivery-proof' || output?.outcome !== 'pass' ||
      !isRouteIssuedTransitionReceipt(transition) || transition.trace?.transitionRule?.outcome !== 'pass' ||
      transition.trace?.transitionRule?.target !== 'complete') {
    errors.push('UAT origin must be the exact route-issued quality/delivery-proof PASS transition');
  }
  if (origin.sourceFingerprint !== proofInput?.sourceFingerprint) errors.push('UAT source differs from the Quality delivery proof');
  if (origin.evidenceFingerprint !== fingerprint(output?.evidenceRefs ?? [])) errors.push('UAT evidence fingerprint differs from the Quality delivery proof');
  if (!output?.evidenceRefs?.includes(origin.auditRef)) errors.push('UAT auditRef is not registered by the Quality delivery proof');
  if (!sameSequence(receipt.trace?.sourceHeads ?? [], value.sourceHeads)) errors.push('UAT source heads differ from the Quality delivery proof');
  if (errors.length === 0) errors.push(...validatePublicSkillReceipt(receipt, {
    label: 'origin Quality PASS', allowedTypes: ['RETURN'], expectedMissionId: value.runId,
    expectedSkillId: 'starci-quality-assure', expectedParentId: origin.expectedCallReceiptRef,
  }));
  return { valid: errors.length === 0, errors };
}

if(process.argv[1]?.endsWith('validate-input.mjs')) await runValidatorCli(validateInput,'node validate-input.mjs <input.json>');
