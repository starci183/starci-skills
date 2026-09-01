import { isCanonicalReceipt, isRoutableOperatorReturnReceipt } from './trace.mjs';
import { brandCompletionCounterevidence, isCompletionCounterevidenceEnvelope } from './counterevidence-envelope.mjs';
import { isRouteIssuedTransitionReceipt } from '../skills/route-machine.mjs';

const FINDINGS = new Set(['unverified', 'confirmed', 'disproved']);
const requiredCausalFields = ['priorVerdict','failedAssumption','missingProof','cause','counterevidenceRef'];
const consumedProofTransitions = new WeakSet();

function assertReopenEvidence(input) {
  if (typeof input.skillId !== 'string' || input.skillId.trim() === '') throw new Error('post-completion feedback requires the exact owning skill');
  if (!input.priorFailureRecord || requiredCausalFields.some((field) => typeof input.priorFailureRecord[field] !== 'string' || input.priorFailureRecord[field].trim() === '')) throw new Error('post-completion feedback requires a complete causal prior-failure record');
  if (!isCanonicalReceipt(input.errorReceipt) || input.errorReceipt.type !== 'ERROR' || input.errorReceipt.missionId !== input.missionId || input.errorReceipt.skillId !== input.skillId) throw new Error('post-completion feedback requires a canonical same-mission same-skill ERROR receipt');
  if (!isCanonicalReceipt(input.resumeReceipt) || input.resumeReceipt.type !== 'RESUME' || input.resumeReceipt.missionId !== input.missionId || input.resumeReceipt.skillId !== input.skillId || input.resumeReceipt.parentId !== input.errorReceipt.receiptId) throw new Error('post-completion feedback requires a canonical same-skill ERROR→RESUME chain');
}

function assertReproof(input) {
  if (input.skillId !== 'starci-fe-process') throw new Error('chained completion reproof is currently defined only for the frontend owner');
  const specs = [
    ['visual','starci-fe-process','fe/visual-fidelity','passed','quality-handoff'],
    ['quality','starci-quality-assure','quality/delivery-proof','pass','complete'],
    ['uat','starci-uat-verify','test/uat-result-publish','passed','complete'],
  ];
  let expectedParent = input.resumeReceipt.receiptId;
  const lifecycles = [];
  for (const [name, skillId, operatorId, outcome, target] of specs) {
    const lifecycle = input.proofChain?.[name];
    const call = lifecycle?.callReceipt;
    const returned = lifecycle?.returnReceipt;
    const transition = lifecycle?.transitionReceipt;
    const receipts = [call, returned, transition];
    if (!receipts.every(isCanonicalReceipt) || call.type !== 'CALL' || returned.type !== 'RETURN' || transition.type !== 'TRANSITION') throw new Error(`closure requires a canonical ${name} CALL→RETURN→TRANSITION lifecycle`);
    if (!isRoutableOperatorReturnReceipt(returned) || !isRouteIssuedTransitionReceipt(transition)) throw new Error(`${name} closure proof must be validator-routed by its canonical Skill machine`);
    if (receipts.some((receipt) => receipt.missionId !== input.missionId || receipt.skillId !== skillId || receipt.operatorId !== operatorId)) throw new Error(`${name} closure lifecycle identity mismatch`);
    const invocationRef = call.trace?.context?.invocationRef;
    const executionRef = call.trace?.context?.executionRef;
    if (!invocationRef || !executionRef || receipts.some((receipt) => receipt.trace?.context?.invocationRef !== invocationRef || receipt.trace?.context?.executionRef !== executionRef)) throw new Error(`${name} closure lifecycle invocation or execution identity changed`);
    if (call.parentId !== expectedParent || returned.parentId !== call.receiptId || transition.parentId !== returned.receiptId) throw new Error(`${name} closure lifecycle does not descend from the prior canonical gate`);
    if (returned.trace?.actualOutput?.output?.outcome !== outcome || transition.trace?.transitionRule?.outcome !== outcome || transition.trace?.transitionRule?.target !== target) throw new Error(`${name} closure lifecycle is not the required PASS transition`);
    if (Date.parse(call.timestamp) < Date.parse(input.resumeReceipt.timestamp)) throw new Error(`${name} closure proof predates counterevidence RESUME`);
    if (consumedProofTransitions.has(transition)) throw new Error(`${name} closure transition was already consumed`);
    expectedParent = transition.receiptId;
    lifecycles.push({ name, call, returned, transition });
  }
  const visual = lifecycles[0].returned;
  const quality = lifecycles[1].returned;
  const uat = lifecycles[2].returned;
  const visualResult = visual.trace.actualOutput.output.result;
  const sourceFingerprint = visual.trace.input.input.blindReviewPacket.capturedSourceFingerprint;
  const packetFingerprint = visualResult.packetFingerprint;
  const auditRefs = visualResult.artifactRefs.filter((ref) => /(^|[\\/])audit\.md$/.test(ref));
  if (quality.trace.input.input.sourceFingerprint !== sourceFingerprint || uat.trace.input.context.sourceFingerprint !== sourceFingerprint) throw new Error('closure gate chain changed source fingerprint');
  if (!quality.trace.actualOutput.output.evidenceRefs.includes(packetFingerprint) || !uat.trace.actualOutput.output.evidenceRefs.includes(packetFingerprint)) throw new Error('closure gate chain lost the exact visual packet evidence');
  if (auditRefs.length === 0 || auditRefs.some((ref) => !quality.trace.actualOutput.output.evidenceRefs.includes(ref) || !uat.trace.actualOutput.output.evidenceRefs.includes(ref))) throw new Error('closure gate chain lost the final owner audit evidence');
  if (!Array.isArray(input.affectedEvidenceRefs) || input.affectedEvidenceRefs.length === 0 || input.affectedEvidenceRefs.some((ref) => !uat.trace.actualOutput.output.evidenceRefs.includes(ref))) throw new Error('closure proof does not cover every affected evidence reference at final UAT PASS');
  for (const { transition } of lifecycles) consumedProofTransitions.add(transition);
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
  if (input.finding === 'unverified') return result(input,{ verdict: 'reopened', nextState: 'capture-preflight', canClose: false, authorityUpdateRequired: false });
  if (input.finding === 'confirmed' && input.reusableGap === true && input.authorityUpdated !== true) return result(input,{ verdict: 'reopened', nextState: 'request-compile', canClose: false, authorityUpdateRequired: true });
  if (input.proofRerun !== true) return result(input,{ verdict: 'reopened', nextState: input.finding === 'confirmed' ? 'reapply' : 'capture-preflight', canClose: false, authorityUpdateRequired: false });
  assertReproof(input);
  return result(input,{ verdict: 'reproved', nextState: 'complete', canClose: true, authorityUpdateRequired: false });
}
