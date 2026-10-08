// The frontier decorations of `starci kernel status` (verbs/status.mjs): typed-wait views, lints, the
// draw-review board's retry pushes, and the open cut sets with their seam duties.
import { ownerClaimAudit, ownerGatesNotOwnerWork } from '../../../machine/owner-claim.mjs';
import { DRAW_REVIEW_OP } from '../../../work/draw-review.mjs';
import { drawReviewBoard, openKnowledgeRequests } from '../../../work/draw-feedback.mjs';
import { openGrammarProposals } from '../../../work/grammar-proposal.mjs';
import { gateConditionView } from '../../gate-conditions.mjs';
import { jobPayloadOf } from './rows.mjs';

const autoResolvedView = ({ incidentId, kind, holds, evidence }) => ({ incidentId, kind, holds, evidence });

const claimView = ({ incidentId, kind, resolvedAt, by, claim, reason }) => ({ incidentId, kind, resolvedAt, by, claim, reason });

// A typed condition that can no longer hold (the awaited job settled failed under :succeeded, a named job
// or incident is gone) is the Kernel's to re-point: actionable, like a dead peer wait.
const unmeetablePhase = (s) => {
  const f = s.frontier;
  f.actionable = true;
  f.gateConditionsUnmeetable = s.typedUnmeetable.map((incident) => incident.incidentId);
  const waits = s.typedUnmeetable.map((incident) => `${incident.incidentId} (${incident.unmeetable.join('; ')})`).join(', ');
  f.reason = [f.reason, `typed wait ${waits} can no longer be met on its own; re-check the prerequisite, then re-point the wait (starci kernel incident --attach <id> --until-...) or resolve it (starci kernel incident --resolve) and continue`].filter(Boolean).join('; ');
};

// The owner's image review board (scripts/work/draw-feedback.mjs): a redraw the owner asked for and no
// interface.draw leg has taken up since is a next action - the runtime's, not the Kernel's choice.
const drawRetriesOf = (s) => {
  const { db, workflowId } = s;
  for (const entry of s.drawReviews) {
    if (!entry.redrawOwed) continue;
    const answeredAt = Date.parse(entry.rounds[entry.rounds.length - 1]?.answeredAt ?? '') || 0;
    const takenUp = Number(db.prepare('SELECT MAX(created_at) AS at FROM jobs WHERE workflow_id=? AND op_id=?').get(workflowId, DRAW_REVIEW_OP)?.at ?? 0) > answeredAt;
    if (takenUp || s.graph.nextActions.some((a) => a.op === DRAW_REVIEW_OP && ['retry', 'dispatch'].includes(a.kind) && (!entry.redrawOwed.jobId || a.jobId === entry.redrawOwed.jobId))) continue;
    s.graph.nextActions.push(drawRetry(entry));
  }
};

const drawRetry = (entry) => {
  const retryOf = entry.redrawOwed.jobId ? ` --retry-of ${entry.redrawOwed.jobId}` : '';
  return { kind: 'retry', origin: 'draw-redraw', op: DRAW_REVIEW_OP, jobId: entry.redrawOwed.jobId ?? null,
    reason: `the owner asked for a redraw of ${entry.record} in ask ${entry.redrawOwed.dispatchId} (${entry.redrawOwed.notes.length} note(s)): starci kernel enqueue --op ${DRAW_REVIEW_OP}${retryOf} - the packet carries the answer (context.owner_answers); the redraw must address every note (draw-feedback.mjs brief)` };
};

// A job a supervisor-gate holds shows where the gate is on the Supervisor ladder: handler, step of steps, deadline and the watched condition.
const gateOnQueued = (s) => {
  const gates = new Map((s.autopilotView?.view?.supervisorGates ?? []).map((gate) => [gate.incidentId, gate]));
  for (const item of s.queued.filter((row) => row.queuedBecause === 'supervisor-gate' && gates.has(row.blockedBy?.incident))) {
    const { handler, step, steps, deadlineAt, condition } = gates.get(item.blockedBy.incident);
    item.blockedBy.gate = { handler, step, steps, deadlineAt, condition };
  }
};

// Typed release conditions still pending, what this status released, and the jobs of this workflow
// other workflows wait on (gate-conditions.mjs, waiter-priority.mjs).
// Each key is present only when non-empty, so a workflow that uses neither reads exactly as before.
export const decorPhase = (s) => {
  const { db, workflowId, repo, internals } = s;
  const { typedLogWarningsOf } = internals;
  const f = s.frontier;
  gateOnQueued(s);
  if (s.typedWaits.open.length) f.gateConditions = s.typedWaits.open.map(gateConditionView);
  if (s.typedWaits.resolved.length) f.autoResolved = s.typedWaits.resolved.map(autoResolvedView);
  if (s.blockingOthers.length) f.blockingOthers = s.blockingOthers;
  // Lints (scripts/machine/owner-claim.mjs), present only when non-empty: an open owner-gate whose own text
  // says it is runtime / not-owner work sits in the owner's queue by mistake; a resolution of this workflow
  // that claims an owner decision no owner answer backs is surfaced, never rewritten.
  const notOwnerGates = ownerGatesNotOwnerWork(db, workflowId);
  if (notOwnerGates.length) f.ownerGatesNotOwnerWork = notOwnerGates;
  // Grammar proposals interface.draw filed (grammar-proposal-filed) that no grammar lane resolved yet: the owner's to
  // decide, never accepted automatically.
  s.grammarProposals = openGrammarProposals(db, workflowId);
  s.drawReviews = [];
  try { s.drawReviews = repo ? drawReviewBoard(db, { workflowId, repo }) : []; } catch { s.drawReviews = []; }
  s.knowledgeChangeRequests = openKnowledgeRequests(db, workflowId);
  drawRetriesOf(s);
  // LOG_TYPED_MISSING warnings (typed-logs.mjs typedLogGaps): op jobs that settled without the typed rows they owed.
  s.logTypedMissing = typedLogWarningsOf(db, workflowId);
  const unprovenClaims = ownerClaimAudit(db, { workflowId });
  if (unprovenClaims.length) f.ownerClaimsUnproven = unprovenClaims.map(claimView);
  if (s.typedUnmeetable.length) unmeetablePhase(s);
};

// Open cut sets and which ordinal's pass closes each: that pass is the one
// `starci kernel settle` holds to full-regression-final, so the Kernel runs the whole-set
// integration gate before it (inc-751dd1ac4492). A set with one open ordinal
// names it; ordinals settle out of order, so it need not be the highest.
export const cutPhase = (s) => {
  const { db, workflowId, wf, internals } = s;
  const { CUT_SET_CLOSING_CHECK, cutSeamViewOf, cutSetStateOf, seamActionsOf } = internals;
  s.cutSets = [];
  for (const row of s.workflowJobs) {
    const cut = jobPayloadOf(row).cut;
    if (!cut?.id || !row.op_id || s.cutSets.some((set) => set.op === row.op_id && set.id === String(cut.id))) continue;
    const set = cutSetStateOf(db, { workflowId, op: row.op_id, cut });
    if (!set.open.length) continue;
    // The seam's contract-first state (cut-seam.mjs): which siblings run on a stub, which owe a reconcile
    // against the real seam, and - once the seam slipped - the re-cut plan.
    const seamView = cutSeamViewOf(db, { workflowId, op: row.op_id, cutId: set.id, queued: s.queued });
    const closing = set.open.length === 1 ? { closingOrdinal: set.open[0], closingJob: set.jobs[set.open[0]]?.jobId ?? null, closingCheck: CUT_SET_CLOSING_CHECK } : {};
    s.cutSets.push({ op: row.op_id, id: set.id, total: set.total, passed: set.passed, open: set.open, jobs: set.jobs, ...closing, ...(seamView ? { seam: seamView } : {}) });
  }
  // Seam duties the Kernel moves now: a reconcile owed (or red) against a landed seam, a re-cut of a seam
  // that slipped. They ride before the waits in nextActions and make the frontier actionable.
  const seamActions = wf.phase === 'finished' ? [] : s.cutSets.flatMap((set) => seamActionsOf(set));
  if (!seamActions.length) return;
  const firstWait = s.graph.nextActions.findIndex((action) => ['owner-gate', 'wait'].includes(action.kind));
  s.graph.nextActions.splice(firstWait < 0 ? s.graph.nextActions.length : firstWait, 0, ...seamActions);
  s.frontier.actionable = true;
  s.frontier.seamDuties = seamActions.map(({ seamDuty, jobId, cutId }) => ({ duty: seamDuty, jobId, cutId }));
  const duties = seamActions.map((action) => `${action.seamDuty} ${action.jobId ?? action.cutId}`).join(', ');
  s.frontier.reason = [s.frontier.reason, `cut seam duties: ${duties} (nextActions)`].filter(Boolean).join('; ');
};
