import { runValidatorCli, validatorFor } from '../../validation.mjs';

const schemaUrl = new URL('./output.schema.json', import.meta.url);
const routes = {
  "closed": {
    "stage": "quality.debt.result",
    "status": "complete",
    "fact": "debt-closed",
    "state": "completed",
    "code": "quality-debt-repay-closed"
  },
  "progress": {
    "stage": "quality.debt.result",
    "status": "ready",
    "fact": "debt-progress",
    "state": "completed",
    "code": "quality-debt-repay-progress"
  },
  "closure-candidate": {
    "stage": "quality.debt.proof",
    "status": "ready",
    "fact": "debt-closure-candidate",
    "state": "completed",
    "code": "quality-debt-repay-closure-candidate"
  },
  "blocked": {
    "stage": "quality.blocked",
    "status": "blocked",
    "fact": "debt-blocked",
    "state": "blocked",
    "code": "quality-debt-repay-blocked"
  }
};

function semantic(value) {
  const errors = [];
  const route = routes[value.payload.decision];
  if (!route) return ['/payload/decision: undeclared decision'];
  if (value.stage !== route.stage || value.status !== route.status) errors.push('/stage: decision does not match emitted route');
  if (value.payload.state.status !== route.state || value.payload.state.code !== route.code) errors.push('/payload/state: status or code does not match decision');
  if (value.payload.state.emits.stage !== value.stage || value.payload.state.emits.status !== value.status) errors.push('/payload/state/emits: must match root route');
  if (!value.facts.includes(route.fact) || !value.payload.state.emits.factsAdd.includes(route.fact)) errors.push(`/facts: missing emitted fact ${route.fact}`);
  const produced = value.payload.produced;
  const loop = produced.loopProof;
  const blocked = value.payload.state.status === 'blocked';
  if (!blocked && produced.debtReceiptRef === null) errors.push('/payload/produced/debtReceiptRef: non-blocked output requires a session artifact');
  if (!blocked && produced.durableWrites.length === 0) errors.push('/payload/produced/durableWrites: non-blocked output must name approved durable writes');
  if (blocked && produced.durableWrites.length !== 0) errors.push('/payload/produced/durableWrites: blocked debt iteration must leave no durable writes');
  const decision = value.payload.decision;
  const iterationDecision = decision === 'progress' || decision === 'closure-candidate';
  if (iterationDecision && !loop.strictlyImproved && !loop.remainingReduced) errors.push('/payload/produced/loopProof: progress requires a strictly better metric or smaller remainder');
  if (iterationDecision && loop.previousFingerprint !== null && loop.previousFingerprint === loop.currentFingerprint) errors.push('/payload/produced/loopProof/currentFingerprint: repeated fingerprint cannot progress');
  if (iterationDecision && loop.iteration >= loop.maxIterations) errors.push('/payload/produced/loopProof: iteration budget exhausted');
  if (decision === 'closure-candidate' && produced.closureCandidateProofRef === null) errors.push('/payload/produced/closureCandidateProofRef: closure-candidate requires proof');
  if (decision !== 'closure-candidate' && produced.closureCandidateProofRef !== null) errors.push('/payload/produced/closureCandidateProofRef: allowed only for closure-candidate');
  if (decision !== 'closed' && produced.closureProof !== null) errors.push('/payload/produced/closureProof: allowed only for closed');
  if (decision !== 'closed' && produced.closedInventory !== null) errors.push('/payload/produced/closedInventory: allowed only for closed');
  if (decision === 'closed') {
    if (produced.closureProof === null) errors.push('/payload/produced/closureProof: closed requires independent green proof');
    if (produced.closedInventory === null) errors.push('/payload/produced/closedInventory: closed requires an atomic closed-inventory receipt');
    if (produced.closureProof?.verifier === 'quality/debt-repay') errors.push('/payload/produced/closureProof/verifier: closure verifier must be independent');
    if (produced.closureProof && produced.closedInventory && produced.closureProof.evidenceSha256 !== produced.closedInventory.closureProofSha256) errors.push('/payload/produced/closedInventory/closureProofSha256: must bind the independent proof');
    if (produced.closedInventory && produced.closedInventory.beforeSha256 === produced.closedInventory.afterSha256) errors.push('/payload/produced/closedInventory: inventory revision must change');
    if (produced.closedInventory && !produced.durableWrites.includes(produced.closedInventory.inventoryRef)) errors.push('/payload/produced/durableWrites: must include the canonical closed inventory');
    if (loop.strictlyImproved || loop.remainingReduced) errors.push('/payload/produced/loopProof: close finalization cannot claim new repayment progress');
  }
  if (blocked && (loop.strictlyImproved || loop.remainingReduced)) errors.push('/payload/produced/loopProof: blocked output cannot claim progress');
  if (blocked && (produced.closureCandidateProofRef !== null || produced.closureProof !== null || produced.closedInventory !== null)) errors.push('/payload/produced: blocked output cannot claim closure artifacts');
  const anchor = produced.debtReceiptRef ?? produced.closureCandidateProofRef ?? produced.closureProof?.ref ?? produced.closedInventory?.receiptRef ?? value.payload.evidenceRefs[0];
  const taskMatch = anchor?.match(/^session:\/\/tasks\/([^/]+)\//);
  const sessionPrefix = taskMatch ? `session://tasks/${taskMatch[1]}/` : null;
  const refs = [produced.debtReceiptRef, produced.closureCandidateProofRef, produced.closureProof?.ref, produced.closedInventory?.receiptRef, ...value.payload.cleanup.scratchRefs, ...value.payload.evidenceRefs].filter(Boolean);
  if (sessionPrefix && refs.some((ref) => !ref.startsWith(sessionPrefix))) errors.push('/payload: every session reference must belong to one task');
  if (value.payload.cleanup.retention !== 'until-skill-terminal' || value.payload.cleanup.purgeAt !== 'skill-terminal') errors.push('/payload/cleanup: terminal purge is mandatory');
  return errors;
}

export const validateOutput = validatorFor(schemaUrl, semantic);

if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replaceAll('\\\\', '/')}`).href) {
  await runValidatorCli(validateOutput, 'usage: node validate-output.mjs <output.json>');
}
