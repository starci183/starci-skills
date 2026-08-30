import { isCanonicalReceipt, isRoutableOperatorReturnReceipt } from './trace.mjs';
import { brandCompletionCounterevidence, isCompletionCounterevidenceEnvelope } from './counterevidence-envelope.mjs';
import { isRouteIssuedTransitionReceipt } from '../skills/route-machine.mjs';

const FINDINGS = new Set(['unverified', 'confirmed', 'disproved']);
const requiredCausalFields = ['priorVerdict','failedAssumption','missingProof','cause','counterevidenceRef'];
const closureProofOperators = Object.freeze({
  'starci-fe-process': new Set([
    'fe/semantic-audit','fe/ux-audit','fe/ui-audit','fe/visual-fidelity','fe/independent-review',
  ]),
});
const consumedProofTransitions = new WeakSet();

function assertReopenEvidence(input) {
  if (typeof input.skillId !== 'string' || input.skillId.trim() === '') throw new Error('post-completion feedback requires the exact owning skill');
  if (!input.priorFailureRecord || requiredCausalFields.some((field) => typeof input.priorFailureRecord[field] !== 'string' || input.priorFailureRecord[field].trim() === '')) throw new Error('post-completion feedback requires a complete causal prior-failure record');
  if (!isCanonicalReceipt(input.errorReceipt) || input.errorReceipt.type !== 'ERROR' || input.errorReceipt.missionId !== input.missionId || input.errorReceipt.skillId !== input.skillId) throw new Error('post-completion feedback requires a canonical same-mission same-skill ERROR receipt');
  if (!isCanonicalReceipt(input.resumeReceipt) || input.resumeReceipt.type !== 'RESUME' || input.resumeReceipt.missionId !== input.missionId || input.resumeReceipt.skillId !== input.skillId || input.resumeReceipt.parentId !== input.errorReceipt.receiptId) throw new Error('post-completion feedback requires a canonical same-skill ERROR→RESUME chain');
}

function assertReproof(input) {
  const call = input.proofLifecycle?.callReceipt;
  const returned = input.proofLifecycle?.returnReceipt;
  const transition = input.proofLifecycle?.transitionReceipt;
  const receipts = [call, returned, transition];
  if (!receipts.every(isCanonicalReceipt) || call.type !== 'CALL' || returned.type !== 'RETURN' || transition.type !== 'TRANSITION') throw new Error('closure requires one canonical CALL→RETURN→TRANSITION proof lifecycle');
  if (!isRoutableOperatorReturnReceipt(returned) || !isRouteIssuedTransitionReceipt(transition)) throw new Error('closure proof must be validator-routed by the owning Skill machine');
  if (receipts.some((receipt) => receipt.missionId !== input.missionId || receipt.skillId !== input.skillId)) throw new Error('closure proof lifecycle must belong to the reopened mission and owning skill');
  if (!call.operatorId || receipts.some((receipt) => receipt.operatorId !== call.operatorId)) throw new Error('closure proof lifecycle must belong to one operator');
  if (!closureProofOperators[input.skillId]?.has(call.operatorId)) throw new Error('closure proof operator is not declared by the owning Skill review boundary');
  const invocationRef = call.trace?.context?.invocationRef;
  const executionRef = call.trace?.context?.executionRef;
  if (!invocationRef || !executionRef || receipts.some((receipt) => receipt.trace?.context?.invocationRef !== invocationRef || receipt.trace?.context?.executionRef !== executionRef)) throw new Error('closure proof lifecycle invocation or execution identity changed');
  if (call.parentId !== input.resumeReceipt.receiptId || returned.parentId !== call.receiptId || transition.parentId !== returned.receiptId) throw new Error('closure proof lifecycle is not descended from the counterevidence RESUME');
  if (transition.trace?.transitionRule?.target !== 'complete') throw new Error('closure proof lifecycle does not transition the owning skill to complete');
  if (!Array.isArray(input.affectedEvidenceRefs) || input.affectedEvidenceRefs.length === 0 || receipts.some((receipt) => input.affectedEvidenceRefs.some((ref) => !receipt.trace?.evidenceRefs?.includes(ref)))) throw new Error('closure proof does not cover every affected lifecycle evidence reference across CALL RETURN and TRANSITION');
  if (Date.parse(call.timestamp) < Date.parse(input.resumeReceipt.timestamp)) throw new Error('closure proof predates counterevidence RESUME');
  if (consumedProofTransitions.has(transition)) throw new Error('closure proof lifecycle was already consumed');
  consumedProofTransitions.add(transition);
}

function result(input, value) {
  const envelope = { ...value, type:'COUNTEREVIDENCE', missionId:input.missionId, skillId:input.skillId ?? null };
  return brandCompletionCounterevidence(envelope);
}

export { isCompletionCounterevidenceEnvelope };

/** Resolve the next mission state after feedback contradicts a reported terminal result. */
export function evaluateCompletionCounterevidence(input) {
  if (input.priorTerminal !== true) return result(input,{ verdict: 'normal', nextState: null, canClose: false, authorityUpdateRequired: false });
  assertReopenEvidence(input);
  if (!FINDINGS.has(input.finding)) throw new Error('invalid counterevidence finding');
  if (input.finding === 'unverified') return result(input,{ verdict: 'reopened', nextState: 'capture', canClose: false, authorityUpdateRequired: false });
  if (input.finding === 'confirmed' && input.reusableGap === true && input.authorityUpdated !== true) return result(input,{ verdict: 'reopened', nextState: 'finding-classify', canClose: false, authorityUpdateRequired: true });
  if (input.proofRerun !== true) return result(input,{ verdict: 'reopened', nextState: input.finding === 'confirmed' ? 'repair' : 'capture', canClose: false, authorityUpdateRequired: false });
  assertReproof(input);
  return result(input,{ verdict: 'reproved', nextState: 'complete', canClose: true, authorityUpdateRequired: false });
}
