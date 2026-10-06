// The drift and handover side of `starci kernel status` (verbs/status.mjs): settled results whose inputs
// moved, indexed proofs gone stale, artwork slots still owed, the autopilot projection, and the owner
// handover projection.
import { openAssetSlots } from '../../../work/asset-slot.mjs';
import { staleProofsOf } from '../../proof-integrity.mjs';
import { peerDriftSummaryOf, sourceDriftSummaryOf, staleOperationsOf } from '../../input-digests.mjs';
import { HANDOVER_CREDENTIALS_SUBJECT, autopilotOn, autopilotProjection, credentialsOwed, deferredLegsOf, provisionalOps, reopenedOwed } from '../../autopilot-run.mjs';
import { isLiveProofOp } from '../../ask-server.mjs';
import { HANDOVER_OP, handoverProjection } from '../../handover.mjs';
import { jobPayloadOf } from './rows.mjs';

// A settled result whose product Work inputs changed and owe work is work the Kernel owes now: an
// owner-declared breaking change owes ONE follow-up leg (followUp), an unattributed edit of a record
// the workflow owns a redo as a new attempt (driver-loop.yaml enqueue.cutExecution). A peer's change
// the owner did not declare breaking is peerDrift, and a Source (knowledge/schemas) edit since
// admission sourceDrift: both advisory, never owed work.
export const driftPhase = (s) => {
  const { db, workflowId, wf, repo, internals } = s;
  const { staleInputProjection } = internals;
  s.stale = staleInputProjection(db, wf, repo);
  s.staleOperations = staleOperationsOf(s.stale.staleInput);
  s.sourceDrift = sourceDriftSummaryOf(s.stale.sourceDrift);
  s.peerDrift = peerDriftSummaryOf(s.stale.peerDrift);
  s.staleReady = s.staleOperations.filter((item) => !item.heldBy);
  s.staleRedo = s.staleReady.filter((item) => !item.followUp);
  s.staleFollowUp = s.staleReady.filter((item) => item.followUp);
  // Indexed proofs whose dependencies moved (proof-integrity.mjs staleProofsOf); a projection error rides beside an empty list.
  s.staleProofs = [];
  s.staleProofsError = null;
  if (wf.phase !== 'finished' && repo) {
    try { s.staleProofs = staleProofsOf(db, workflowId, { repo }); } catch (error) { s.staleProofsError = String(error?.message ?? error); }
  }
  // Artwork slots interface.draw declared that interface.asset has not filled (asset-slot-owed without -filled).
  s.assetSlotsOwed = openAssetSlots(db, workflowId);
  s.autopilotView = autopilotViewOf(s);
};

const opDone = (s, op, deferredJobIds) => (s.jobsByOp.get(op) ?? []).some((row) => row.status === 'succeeded')
  || (s.jobsByOp.get(op) ?? []).some((row) => deferredJobIds.has(row.job_id));

const autopilotGraph = (s, view, owed, checklistDue) => ({
  on: true, deferred: view.deferred, provisionalOps: provisionalOps(s.db, s.workflowId), reopened: reopenedOwed(s.db, s.workflowId), credentialsOwed: owed.length > 0,
  checklistDue, checklistApprovals: owed.filter((item) => item.deferClass !== 'credential').map((item) => item.dispatchId).filter(Boolean),
});

const autopilotViewOf = (s) => {
  const { db, workflowId, internals } = s;
  const { LEG_IN_FLIGHT } = internals;
  try {
    const view = autopilotProjection(db, workflowId, { settings: s.autopilotSettingsNow, sweep: s.autopilotSweepOut });
    if (!view.on) return { view, graph: null };
    const owed = credentialsOwed(db, workflowId);
    const deferredJobIds = new Set(view.deferred.map((item) => item.jobId));
    const checklistJob = s.workflowJobs.find((row) => row.op_id === 'provision.ask' && jobPayloadOf(row).params?.subject === HANDOVER_CREDENTIALS_SUBJECT && row.status !== 'cancelled') ?? null;
    const mainLineDone = s.legOps.filter((op) => op !== HANDOVER_OP && op !== 'provision.ask' && !isLiveProofOp(op))
      .every((op) => opDone(s, op, deferredJobIds));
    const openElsewhere = s.workflowJobs.some((row) => (row.status === 'queued' && !isLiveProofOp(row.op_id)) || LEG_IN_FLIGHT.includes(row.status));
    const checklistDue = owed.length > 0 && !checklistJob && mainLineDone && !openElsewhere;
    return { view: { ...view, ...(owed.length ? { checklist: { due: checklistDue, jobId: checklistJob?.job_id ?? null, items: owed.length } } : {}) },
      graph: autopilotGraph(s, view, owed, checklistDue) };
  } catch (error) {
    return { view: { on: autopilotOn(db, workflowId, s.autopilotSettingsNow), error: String(error?.message ?? error).slice(0, 300) }, graph: null };
  }
};

// The owner handover (scripts/kernel/handover.mjs): an answered handover ask
// is the Kernel's move, a current owner approval makes finish the next move,
// and a chain whose every leg settled owes the handover leg.
// Autopilot: a leg deferred to the final review counts as settled for the handover, and so does a provision.ask
// leg when nothing is owed to the end-of-flow credential checklist.
export const handoverPhase = (s) => {
  const { db, workflowId } = s;
  s.autopilotSettled = settledForHandover(s);
  s.handover = handoverProjection(db, workflowId, { legOps: s.legOps, alsoSettled: s.autopilotSettled });
};

const settledForHandover = (s) => {
  const { db, workflowId } = s;
  try {
    if (!autopilotOn(db, workflowId, s.autopilotSettingsNow)) return [];
    const ops = deferredLegsOf(db, workflowId).map((item) => item.opId).filter(Boolean);
    if (!credentialsOwed(db, workflowId).length) ops.push('provision.ask');
    return [...new Set(ops)];
  } catch { return []; }
};
