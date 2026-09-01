import { validatorFor, runValidatorCli } from '../../operators/validation.mjs';
import { assertCanonicalReceipts, assertProgress } from '../../runtime/trace.mjs';
import { isRouteIssuedTransitionReceipt, routeIssuedTransitionFor } from '../../runtime/route-transition.mjs';
import { validatePublicSkillReceipt } from '../receipt-consumption.mjs';

const schemaValidate = validatorFor(new URL('./input.schema.json', import.meta.url));
const sameSequence = (left, right) => left.length === right.length && left.every((item, index) => item === right[index]);

export function validateInput(value) {
  const result = schemaValidate(value);
  if (!result.valid) return result;
  const errors = [];
  try { assertCanonicalReceipts(value.receipts); } catch (error) { errors.push(error.message); }
  if (value.receipts.some((receipt) => receipt.missionId !== value.mission.missionId)) errors.push('receipt mission identity mismatch');
  try { assertProgress(value.receipts); } catch (error) { errors.push(error.message); }

  const origin = value.origin;
  if (origin !== null && value.debtPolicy !== 'forbidden') errors.push('frontend Quality origin requires debtPolicy forbidden');
  if (value.debtPolicy === 'forbidden') {
    if (origin === null) errors.push('verification-only Quality requires the exact frontend visual PASS origin');
    if (value.scope.writeRoots.length !== 0) errors.push('verification-only Quality forbids write roots');
    if (value.scope.externalMutation !== false) errors.push('verification-only Quality forbids external mutation');
    if (value.receipts.some(({ operatorId }) => ['quality/finding-repair', 'quality/debt-repay'].includes(operatorId))) errors.push('verification-only Quality forbids repair or debt mutation receipts');
    if (value.receipts.some(({ trace }) => !sameSequence(trace?.sourceHeads ?? [], value.mission.sourceHeads))) errors.push('verification-only Quality requires unchanged source heads on every receipt');
  }

  if (origin !== null) {
    const receipt = value.receipts.find(({ receiptId }) => receiptId === origin.returnReceiptRef);
    if (!receipt) {
      errors.push('frontend origin returnReceiptRef is not present in receipts');
    } else {
      errors.push(...validatePublicSkillReceipt(receipt, {
        label: 'origin visual PASS',
        allowedTypes: ['RETURN'],
        expectedMissionId: value.mission.missionId,
        expectedSkillId: 'starci-fe-process',
        expectedParentId: origin.expectedCallReceiptRef,
        consume: false,
      }));
      const transition = routeIssuedTransitionFor(receipt);
      const output = receipt.trace?.actualOutput?.output;
      const visualInput = receipt.trace?.input?.input?.blindReviewPacket;
      if (receipt.operatorId !== 'fe/visual-fidelity' || output?.outcome !== 'passed' ||
          !isRouteIssuedTransitionReceipt(transition) || transition.trace?.transitionRule?.outcome !== 'passed' ||
          transition.trace?.transitionRule?.target !== 'quality-handoff') {
        errors.push('Quality origin must be the exact route-issued final fe/visual-fidelity PASS transition');
      }
      if (origin.sourceFingerprint !== visualInput?.capturedSourceFingerprint) errors.push('Quality source differs from the final visual PASS source');
      if (origin.evidenceFingerprint !== output?.result?.packetFingerprint) errors.push('Quality evidence differs from the final blind raster packet');
      if (!output?.result?.artifactRefs?.includes(origin.auditRef)) errors.push('Quality origin auditRef is not registered by the final visual PASS');
      if (!sameSequence(receipt.trace?.sourceHeads ?? [], value.mission.sourceHeads)) errors.push('Quality source heads differ from the final visual PASS');
      if (errors.length === 0) errors.push(...validatePublicSkillReceipt(receipt, {
        label: 'origin visual PASS', allowedTypes: ['RETURN'], expectedMissionId: value.mission.missionId,
        expectedSkillId: 'starci-fe-process', expectedParentId: origin.expectedCallReceiptRef,
      }));
    }
  }

  const waitIndex = value.receipts.findLastIndex((receipt) => receipt.type === 'WAIT');
  if (waitIndex >= 0) {
    const resolution = value.receipts.slice(waitIndex + 1).find((receipt) => receipt.type === 'RESUME');
    if (!resolution || typeof resolution.trace?.resumeState?.authorityResolutionRef !== 'string') errors.push('WAIT resumes only from a typed user authority resolution');
  }
  return { valid: errors.length === 0, errors };
}

if (process.argv[1]?.endsWith('validate-input.mjs')) await runValidatorCli(validateInput, 'node validate-input.mjs <input.json>');
