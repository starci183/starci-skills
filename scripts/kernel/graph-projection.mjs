// graph-projection.mjs - the work-graph projection of `starci kernel status`: the next actions and the legs of a workflow.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { jobResult } from '../../engine/db/ledger.mjs';
import { unresolvedFailures } from './failure-steps.mjs';
import { TERMINAL_HOLDS, filedReportOf, holdView, ownerWaitsWithoutAsk, upstreamPlanOf } from './terminal-step.mjs';
import { domainsOfPaths, latestVersion as latestGraphVersion } from '../work/work-graph-store.mjs';
import { deferredFieldOf, externalOpsOf, legStatusColorOf } from './leg-status-view.mjs';
import { ownerLanguage as ownerLanguageOf, translator } from '../lib/i18n.mjs';
import { jobPayloadOf, latestGoal } from './verbs/shared/rows.mjs';
import { isLiveProofOp } from './ask-server.mjs';
import { AUTOPILOT_BY, AUTOPILOT_RULING, HANDOVER_CREDENTIALS_SUBJECT, PROVISIONAL_LABEL, SUPERVISOR_GATE } from './autopilot-run.mjs';
import { deferralOf as testDeferralOf, ownerSpecs, deferredTestsOf, planLegDeferral } from '../route/spec-deferral.mjs';
import { HANDOVER_OP } from './handover.mjs';
import { SEAM_PRIORITY_CLASS, SEAM_RECONCILE_CHECK } from './seam-policy.mjs';
import { ASSET_OP } from '../work/asset-slot.mjs';
import { retryMoveOf } from './retry-move.mjs';
import { enqueueMove, legPathsOf, rerunMoveOf, withDeferredStubs, withMove } from './next-moves.mjs';
import { handoverReviewAction } from './handover-move.mjs';
import { proposedLegPaths, requiredKernelParamsOf, treesOfWorkflow } from './leg-proposal.mjs';
const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ownerLanguage = () => ownerLanguageOf();

/** A retry action with the typed move that performs it (scripts/kernel/retry-move.mjs), when the job has a write set to repeat. */
const retryAction = (ctx, origin, action) => {
  const move = retryMoveOf(ctx.rowOf.get(action.jobId), { op: action.op });
  return { ...action, origin, ...(move ? { move } : {}) };
};
const NEXT_ACTION_KINDS = ['retry', 'root-verify', 'dispatch', 'impact-check', 'supervisor-gate', 'owner-gate', 'wait'];
// Legs that run per domain in parallel once the workflow has a work graph (scripts/work/work-graph-store.mjs).
export const DOMAIN_PARALLEL_OPS = new Set(['business.decide', 'architecture.decide']);
export const disjointDomains = (graph, left, right) => {
  const a = domainsOfPaths(graph, left), b = domainsOfPaths(graph, right);
  return a.size > 0 && b.size > 0 && ![...a].some((domain) => b.has(domain));
};
export const NEXT_ACTION_MOVES = ['retry', 'root-verify', 'dispatch', 'impact-check'];
export const LEG_IN_FLIGHT = ['leased', 'running', 'answering', 'effect_unknown'];
/** The newest work-graph nodes of a workflow (display names read what a job covers); null without one. */
export const latestGraphNodesOf = (db, workflowId) => { try { return latestGraphVersion(db, workflowId)?.graph?.nodes ?? null; } catch { return null; } };
export const nextActionLabel = (action) => `${action.kind} ${action.op ?? '-'}` + (action.jobId ? ' ' + action.jobId : '') + (action.displayName ?? action.label ? ' «' + (action.displayName ?? action.label) + '»' : '');
/** A failed attempt whose settle recorded no step: the runtime routes it (reconcile --route-failure), or it waits for the leg that cures its blocker. */
const unsteppedAction = (db, row) => {
  const blocker = filedReportOf(db, row.job_id)?.blocker ?? null;
  const upstream = blocker ? upstreamPlanOf(db, row, blocker) : null;
  if (upstream?.action === 'wait') {
    return { kind: 'wait', origin: 'unstepped-failure-wait', op: row.op_id, jobId: row.job_id, reason: `${row.job_id} was blocked (${blocker}) and waits for ${upstream.on}: its retry is enqueued behind that leg once it has a job` };
  }
  return { kind: 'retry', origin: 'unstepped-failure', op: row.op_id, jobId: row.job_id, reason: `${row.job_id} failed and nothing follows it (no step recorded): starci kernel reconcile --job ${row.job_id} --route-failure routes it by the table - the Job controller runs it within a pass; a step that records none is yours: retry with the failure fed back, switch agent, re-plan, or raise the typed gate` };
};
/** A failed attempt nothing follows (its owner-gate resolved, no deferral): retry it. */
const unresolvedRetryActions = (actions, ctx) => {
  const { db, ownerGates, unresolved, deferredJobs } = ctx;
  for (const row of unresolved) {
    const step = jobResult(db, row.job_id)?.nextStep;
    if (ownerGateOf(ownerGates, row) || deferredJobs.has(row.job_id)) continue;
    if (!step) { actions.push(unsteppedAction(db, row)); continue; }
    if (step.kind === 'deferred') continue;
    actions.push(retryAction(ctx, 'failed-step-open', { kind: 'retry', op: row.op_id, jobId: row.job_id,
      reason: `${row.job_id} failed and nothing follows it (${['owner-gate', SUPERVISOR_GATE].includes(step.kind) ? step.kind + ' ' + step.incidentId + ' resolved' : step.reason}): starci kernel enqueue --op ${row.op_id} with its paths and records --retry-of ${row.job_id}` }));
  }
};
/** An owner wait that names no ask: the owner has nothing to answer, so the op runs again and files its question. */
const askless = (actions, ctx) => {
  for (const item of ownerWaitsWithoutAsk(ctx.awaitingOwner)) {
    actions.push(retryAction(ctx, 'askless-owner-wait', { kind: 'retry', op: item.opId, jobId: item.jobId, reason: `${item.jobId} waits on the owner but filed no ask: starci kernel enqueue --op ${item.opId} --retry-of ${item.jobId} so it files its question` }));
  }
};
/** An ask the owner (or the autopilot) answered: its op re-runs with the answer. */
const answeredAskActions = (actions, ctx) => {
  const { awaitingOwner } = ctx;
  for (const item of awaitingOwner.filter((ask) => ask.answer === 'answered')) {
    const action = { kind: 'retry', op: item.opId, jobId: item.jobId };
    if (item.answeredBy === AUTOPILOT_BY) { const dispatchId = item.dispatchId; const ruling = item.provisional ? 'provisional acceptance, ' + PROVISIONAL_LABEL : 'redraw/revise with the gate findings as the brief'; action.reason = `autopilot answered ask ${dispatchId} (${ruling}; owner ruling ${AUTOPILOT_RULING}): starci kernel enqueue --op ${item.opId} --retry-of ${item.jobId} so it applies the receipt`; }
    else action.reason = `the owner answered ask ${item.dispatchId}: starci kernel enqueue --op ${item.opId} --retry-of ${item.jobId} so it runs with the answer`;
    actions.push(retryAction(ctx, 'answered-ask', action));
  }
};
/** The owner's handover feedback re-opened a provisional acceptance: only that op re-runs (draw-feedback loop). */
const reopenedActions = (actions, ctx) => {
  const { autopilot } = ctx;
  for (const item of autopilot?.reopened ?? []) {
    actions.push(retryAction(ctx, 'reopened-provisional', { kind: 'retry', op: item.opId, jobId: item.jobId, reason: `the owner's handover answer ${item.handoverDispatchId} re-opened the provisional ${item.record ?? item.dispatchId}: starci kernel enqueue --op ${item.opId} --retry-of ${item.jobId} - the redraw's brief is the owner's note in ${item.receiptPath}` }));
  }
};
/** A queued leg the specs switches defer: its route settles it deferred at once, which releases every leg behind it. */
const deferredQueuedActions = (actions, ctx) => {
  const { queued, deferredQueued } = ctx;
  for (const item of queued.filter((row) => deferredQueued.has(row.jobId))) {
    const deferral = deferredQueued.get(item.jobId);
    actions.push({ kind: 'dispatch', origin: 'deferred-queued', op: item.opId, jobId: item.jobId, deferred: deferral.reason,
      reason: `deferred (${deferral.reason}): starci kernel route --job ${item.jobId} settles it deferred without dispatch (no attempt spent, whatever it was queued behind) and the legs behind it proceed` });
  }
};
/** A queued job that is ready: dispatch it (a root-cause check or a seam dispatch reads its own reason). */
const readyQueuedActions = (actions, ctx) => {
  const { queued, rowOf, deferredQueued } = ctx;
  for (const item of queued.filter((row) => row.queuedBecause === 'ready' && !deferredQueued.has(row.jobId))) {
    const payload = jobPayloadOf(rowOf.get(item.jobId));
    const action = { kind: payload.rootVerify ? 'root-verify' : 'dispatch', origin: 'ready-queued', op: item.opId, jobId: item.jobId, ...(item.seam ? { seamDuty: 'dispatch-seam' } : {}) };
    if (payload.rootVerify) action.reason = `read-only check of the root-cause claim on ${payload.rootVerify.node} (for ${payload.rootVerify.of}): starci kernel route --job ${item.jobId}, then starci kernel dispatch`; else if (item.seam) action.reason = `dispatch seam now: ordinal 1 of cut ${item.seam.cutId}, ${item.seam.siblings} sibling ordinal(s) build on it (priority ${SEAM_PRIORITY_CLASS}): starci kernel route --job ${item.jobId}, then starci kernel dispatch - before any other queued work`; else if (item.seamStub) action.reason = `ready on a stub (${item.seamStub.mode}): ${item.seamStub.reason}; starci kernel route --job ${item.jobId}, then starci kernel dispatch - it owes ${SEAM_RECONCILE_CHECK} once the seam lands`; else action.reason = `ready: starci kernel route --job ${item.jobId}, then starci kernel dispatch`;
    actions.push(action);
  }
};
/** The plan ancestors `op` still waits on: an approval, or a leg that has not succeeded and is held neither by a credential only nor by a deferral. */
const planWaitsOf = (op, ctx, { firstReached, succeeded, credentialOnly }) => {
  const { legOps, planAncestors, jobsByOp, approvalWaitOps, autopilot, deferredPlanOps } = ctx;
  return (planAncestors.get(op) ?? []).filter((ancestor) => !externalOpsOf(skillRoot).has(ancestor) && !(autopilot?.on && ancestor === 'provision.ask') && (approvalWaitOps.has(ancestor) || (!succeeded.has(ancestor) && !credentialOnly(ancestor)
    && !deferredPlanOps.has(ancestor) && (jobsByOp.has(ancestor) || legOps.indexOf(ancestor) > firstReached))));
};
/**
 * What the Kernel is offered to enqueue a leg the plan leaves open: the op contract's own families as the proposal (kernel-menu.yaml leg-ready), not a guess, and the parameters only
 * the Kernel can set. Nothing for a leg whose plan declares its write set (the runtime enqueues it) or a deferred one.
 */
function legProposalOf({ op, ctx, move, deferral }) {
  const nodePaths = ctx.workGraph?.frontier?.[0]?.ownedPaths ?? [];
  const proposed = move || deferral ? '' : proposedLegPaths({ skillRoot, op, trees: treesOfWorkflow(ctx.db, ctx.wf.workflow_id), nodePaths });
  const required = move ? [] : requiredKernelParamsOf({ skillRoot, op });
  return { ...(proposed ? { proposed } : {}), ...(required.length ? { paramsRequired: required.join(', ') } : {}) };
}

/** The dispatch action of an approved leg nothing holds: deferred, or a dispatch building on placeholder values when only a credential holds it. */
const approvedLegAction = (op, ctx, credentialOnly) => {
  const { planAncestors, workGraph, deferredPlanOps } = ctx;
  const placeholder = (planAncestors.get(op) ?? []).some((ancestor) => credentialOnly(ancestor));
  const nodes = workGraph ? workGraph.frontier.map((node) => node.id) : [];
  const deferral = deferredPlanOps.get(op);
  // The plan leg's own write set is the move (a deferred leg that declares none takes its evidence stub: it is never dispatched); a work graph partitions the leg per node and any other leg that declares none leaves the write set to the Kernel.
  const move = nodes.length ? null : enqueueMove(ctx.wf.workflow_id, { op, paths: ctx.legPaths.get(op) });
  const action = withMove({ kind: 'dispatch', origin: 'approved-leg', op, ...(nodes.length ? { nodes } : {}), ...(deferral ? { deferred: deferral.reason } : {}) }, move);
  Object.assign(action, legProposalOf({ op, ctx, move, deferral }));
  if (deferral) {
    action.reason = `approved leg ${op} is deferred (${deferral.reason}): starci kernel enqueue --op ${op} with its paths records it - it settles deferred at once, never dispatched, no attempt spent - and the legs behind it do not wait on it`;
  } else {
    action.reason = `approved leg ${op} has no job and every plan leg before it succeeded${placeholder ? ' or waits on a credential only' : ''}: starci kernel enqueue --op ${op}${placeholder ? ' building on placeholder values (credentialPending)' : ''}${nodes.length ? ' once per runnable work-graph node (' + nodes.join(', ') + ') with --paths its ownedPaths' : ''}, then route and dispatch it`;
  }
  return action;
};
/** An approved plan leg with no job and nothing it waits on: a dispatch action (placeholder values when only a credential holds it). While no leg has a job the empty prefix counts as "every leg before it succeeded": the first approved leg is offered like any later one; a leg the chat intake runs is never one. */
const approvedLegActions = (actions, ctx) => {
  const { legOps, workflowJobs, jobsByOp, credentialWaitOps, autopilot } = ctx;
  const firstReached = legOps.findIndex((op) => jobsByOp.has(op));
  const succeeded = new Set(workflowJobs.filter((row) => row.status === 'succeeded').map((row) => row.op_id));
  const external = externalOpsOf(skillRoot);
  for (const [index, op] of legOps.entries()) {
    if (index <= firstReached || jobsByOp.has(op) || op === HANDOVER_OP || external.has(op)) continue;
    // Autopilot: provision.ask is planned only at the end of the flow (the handover credential checklist below);
    // a live proof waits for it while every other leg proceeds on the sandbox/stub path.
    if (autopilot?.on && (op === 'provision.ask' || (isLiveProofOp(op) && autopilot.credentialsOwed))) continue;
    // A credential ask holds only the live-proof legs: a build behind it runs on placeholder values.
    const credentialOnly = (ancestor) => credentialWaitOps.has(ancestor) && !isLiveProofOp(op);
    if (!planWaitsOf(op, ctx, { firstReached, succeeded, credentialOnly }).length) actions.push(approvedLegAction(op, ctx, credentialOnly));
  }
};
/** A red node of the work graph owes rework: the op that last wrote it runs again on its owned paths. */
const redNodeActions = (actions, ctx) => {
  const { workGraph } = ctx;
  for (const node of workGraph?.frontier ?? []) {
    if (node.color !== 'red' || !node.lastOp) continue;
    const row = ctx.rowOf.get(node.lastJob);
    const again = row?.status === 'succeeded' ? { reopen: `work-graph node ${node.id} turned red` } : { 'retry-of': ['failed', 'awaiting_owner'].includes(row?.status) ? row.job_id : null };
    const move = enqueueMove(ctx.wf.workflow_id, { op: node.lastOp, paths: node.ownedPaths, ...again });
    actions.push(withMove({ kind: 'dispatch', origin: 'red-node', op: node.lastOp, nodes: [node.id], round: node.lastJob, paths: node.ownedPaths.join(','), reason: `work-graph v${workGraph.version} turned ${node.id} red: starci kernel enqueue --op ${node.lastOp} --paths ${node.ownedPaths.join(',')}, then route and dispatch it` }, move));
  }
};
/** A proof whose every piece of evidence is stale re-runs only the check that made it (proof-integrity.mjs). */
const staleProofActions = (actions, ctx) => {
  const { staleReady, staleProofs } = ctx;
  for (const item of staleProofs.filter((proof) => !staleReady.some((stale) => stale.jobId === proof.jobId))) {
    const move = rerunMoveOf(ctx.rowOf.get(item.jobId), { op: item.op, reason: `its proof is stale: ${item.changed.slice(0, 3).join(', ')} changed` });
    actions.push(withMove({ kind: 'impact-check', origin: 'stale-proof', op: item.op, jobId: item.jobId, reason: `its proof of ${item.items.slice(0, 5).join(', ')}${item.items.length > 5 ? ' (+' + (item.items.length - 5) + ')' : ''} is stale: ${item.changed.slice(0, 5).join(', ')} changed since it was indexed; re-dispatch ${item.op} as a new attempt --retry-of ${item.jobId} (only that check)` }, move));
  }
};
/** Artwork slots a drawing declared and interface.asset has not filled: propose the interface.asset leg that owes them. */
const assetSlotActions = (actions, ctx) => {
  const { workflowJobs, assetSlotsOwed } = ctx;
  const assetLegOpen = workflowJobs.some((row) => row.op_id === ASSET_OP && (row.status === 'queued' || LEG_IN_FLIGHT.includes(row.status)));
  if (assetSlotsOwed.length && !assetLegOpen) {
    const records = [...new Set(assetSlotsOwed.map((slot) => slot.ui).filter(Boolean))];
    actions.push(withMove({ kind: 'dispatch', origin: 'asset-slots', op: ASSET_OP, paths: records.join(','), slots: assetSlotsOwed.map((slot) => slot.key),
      reason: `${assetSlotsOwed.length} artwork slot(s) the drawing owes to interface.asset (${assetSlotsOwed.slice(0, 5).map((slot) => slot.key).join(', ')}${assetSlotsOwed.length > 5 ? ' (+' + (assetSlotsOwed.length - 5) + ')' : ''}): starci kernel enqueue --op ${ASSET_OP} --paths ${records.join(',')}, then route and dispatch it - it generates each slot under the brand imagery.promptRules and replaces the placeholder (src + data-asset-sha256)` }, enqueueMove(ctx.wf.workflow_id, { op: ASSET_OP, paths: records })));
  }
};
/** A ready attempt whose read records changed: re-dispatch it as a new attempt. */
const staleReadyActions = (actions, ctx) => {
  const { staleReady } = ctx;
  for (const item of staleReady) {
    const move = rerunMoveOf(ctx.rowOf.get(item.jobId), { op: item.op, reason: item.followUp ? 'the owner of a record it read declared the change breaking' : 'records it read changed since it settled' });
    const action = withMove({ kind: 'impact-check', origin: 'stale-ready', op: item.op, jobId: item.jobId }, move);
    if (item.followUp) action.reason = `the owner of a record it read declared the change breaking: enqueue ONE follow-up attempt of ${item.op}${item.cut ? ' cut ordinal ' + item.cut.ordinal : ''}`; else action.reason = `records it read changed since it settled: re-dispatch ${item.op} as a new attempt${item.cut ? ' of cut ordinal ' + item.cut.ordinal : ''}`;
    actions.push(action);
  }
};
/** An open owner-gate or supervisor-gate incident. */
const gateActions = (actions, ctx) => {
  const { ownerGates, rowOf } = ctx;
  for (const gate of ownerGates) {
    const held = gate.holds.find((id) => rowOf.has(id)) ?? null;
    actions.push(gate.kind === SUPERVISOR_GATE
      ? { kind: SUPERVISOR_GATE, origin: 'supervisor-gate', op: gate.opId ?? (held ? rowOf.get(held).op_id : null), ...(held ? { jobId: held } : {}), incidentId: gate.incidentId,
        reason: `supervisor-gate ${gate.incidentId}: ${gate.detail}; the Supervisor's step (never the owner's) - keep driving every other leg; its resolve --by supervisor wakes you` }
      : { kind: 'owner-gate', origin: 'owner-gate', op: gate.opId ?? (held ? rowOf.get(held).op_id : null), ...(held ? { jobId: held } : {}), incidentId: gate.incidentId,
        reason: `owner-gate ${gate.incidentId}: ${gate.detail}; the owner's step, then starci kernel incident --resolve` });
  }
};
/** Under autopilot nothing waits on the owner but the end of the flow: a pending ask the sweep could not handle is the handover's. */
const pendingAskActions = (actions, ctx) => {
  const { awaitingOwner, autopilot } = ctx;
  for (const item of awaitingOwner.filter((ask) => ask.answer === 'pending')) {
    actions.push({ kind: 'owner-gate', origin: 'pending-ask', op: item.opId, jobId: item.jobId, reason: autopilot?.on ? `ask ${item.dispatchId ?? '-'} is the end-of-flow owner step (handover or its credential checklist)` : `ask ${item.dispatchId ?? '-'} waits on the owner` });
  }
};
/** The ONE end-of-flow credential step: every business leg but the deferred live proofs settled (or deferred). */
const credentialStepAction = (actions, ctx) => {
  const { wf, autopilot } = ctx;
  if (autopilot?.on && autopilot.checklistDue) {
    const params = `{"subject":"${HANDOVER_CREDENTIALS_SUBJECT}"}`, paths = `.starciwork/evidence/${wf.workflow_id}.credentials`;
    actions.push(withMove({ kind: 'dispatch', origin: 'credential-step', op: 'provision.ask', final: true, params, paths, reason: `the end-of-flow owner step "supply credentials": starci kernel enqueue --op provision.ask --params '{"subject":"${HANDOVER_CREDENTIALS_SUBJECT}"}' --paths .starciwork/evidence/${wf.workflow_id}.credentials; its ask files the question \`starci kernel autopilot --workflow ${wf.workflow_id} --checklist --json\` prints (.question), verbatim - one form for every deferred credential; the deferred approvals (${(autopilot.checklistApprovals ?? []).join(', ') || 'none'}) are released at the same time (starci kernel autopilot --release <dispatchId>). The deferred live proofs resume by themselves once the owner answers` }, enqueueMove(wf.workflow_id, { op: 'provision.ask', paths, params })));
  }
};
/** A leg in flight is a wait. */
const inFlightWaitActions = (actions, ctx) => {
  const { workflowJobs } = ctx;
  for (const row of workflowJobs.filter((job) => LEG_IN_FLIGHT.includes(job.status))) {
    actions.push({ kind: 'wait', origin: 'in-flight', op: row.op_id, jobId: row.job_id, reason: row.status === 'effect_unknown' ? 'effect_unknown: reconcile it' : row.status });
  }
};
/** A queued job that is not ready is a wait on what holds it. */
const queuedWaitActions = (actions, ctx) => {
  const { queued, deferredQueued } = ctx;
  for (const item of queued.filter((row) => !['ready', 'owner-gate', SUPERVISOR_GATE].includes(row.queuedBecause) && !deferredQueued.has(row.jobId))) {
    const seamFirst = item.seam && ['max-ops', 'pool-full', 'circuit-open', 'path-lease'].includes(item.queuedBecause)
      ? '; seam first: it takes the next free slot of this workflow (starci kernel dispatch refuses other work the last slot while it is queued)' : '';
    actions.push({ kind: 'wait', origin: 'queued-wait', op: item.opId, jobId: item.jobId, reason: `${item.queuedBecause}${item.detail ? ': ' + item.detail : ''}${seamFirst}` });
  }
};
/** A peer-wait incident is a wait. */
const peerWaitActions = (actions, ctx) => {
  const { peerWaits } = ctx;
  for (const wait of peerWaits) actions.push({ kind: 'wait', origin: 'peer-wait', op: wait.opId, incidentId: wait.incidentId, reason: `peer-wait on ${wait.peer}: ${wait.detail.slice(0, 160)}` });
};
/** The actions ranked by kind; a move held by a supervisor-gate or a peer-wait says so. */
const nextActionsOf = (actions, ownerGates, peerWaits) => {
  // A proposed leg has no job yet, so queuedBecause cannot mark it held. Keep it visible, but do not
  // turn the frontier actionable for a dispatch the same supervisor-gate will refuse after enqueue.
  return NEXT_ACTION_KINDS.flatMap((kind) => actions.filter((action) => action.kind === kind).map((action) => {
    if (!NEXT_ACTION_MOVES.includes(action.kind) || action.deferred) return action;
    const gate = ownerGates.find((item) => item.kind === SUPERVISOR_GATE
      && (item.holds.includes('*') || (action.jobId && item.holds.includes(action.jobId)) || (action.op && item.holds.includes(action.op))));
    if (gate) return { ...action, heldBy: { incident: gate.incidentId }, reason: `${action.reason}; held by supervisor-gate ${gate.incidentId} until the Supervisor resolves it` };
    // A peer-wait whose --holds names the step's op or job holds it too (fe-hold-until-landed): the other steps stay moves.
    const wait = peerWaits.find((item) => (action.jobId && item.holds.includes(action.jobId)) || (action.op && item.holds.includes(action.op)));
    return wait ? { ...action, heldBy: { incident: wait.incidentId, peer: wait.peer }, reason: `${action.reason}; held by peer-wait ${wait.incidentId} on ${wait.peer}: ${wait.detail.slice(0, 120)}` } : action;
  }));
};
/** One row per leg: its status colour and the job it reads. */
const legsOf = (ctx) => {
  const { legOps, jobsByOp, failedRows, awaitingOwner, workGraph, autopilot, unresolved, rowOf, deferredJobs, deferredPlanOps, specDeferredJobs } = ctx;
  const unresolvedIds = new Set(unresolved.map((row) => row.job_id));
  const ownerWaitOps = new Set(awaitingOwner.map((item) => item.opId));
  const reworkOps = new Set((workGraph?.frontier ?? []).filter((node) => node.color === 'red').map((node) => node.lastOp).filter(Boolean));
  const ops = [...legOps, ...[...jobsByOp.keys()].filter((op) => !legOps.includes(op))];
  const provisional = autopilot?.provisionalOps ?? new Set();
  const tr = translator(ownerLanguage());
  const external = externalOpsOf(skillRoot);
  const legs = ops.map((op) => {
    const rows = (jobsByOp.get(op) ?? []).filter((row) => row.status !== 'cancelled');
    const latest = rows.at(-1) ?? null;
    // An external leg (request.analyze) is run by the chat intake before the workflow exists: no job, so never gray-and-waiting.
    if (!rows.length && external.has(op)) return { op, color: 'external', label: tr('run by the chat intake, not dispatched here'), jobId: null, status: null };
    // Autopilot: a leg whose open work is only deferred reads `deferred`; a green leg resting on a provisional
    // acceptance reads green-provisional, labelled by PROVISIONAL_LABEL (the owner reviews it once at handover).
    if (rows.length && rows.every((row) => row.status === 'succeeded' || deferredJobs.has(row.job_id) || !['queued', 'failed', ...LEG_IN_FLIGHT].includes(row.status))
      && rows.some((row) => deferredJobs.has(row.job_id)) && !rows.some((row) => row.status === 'succeeded')) {
      return { op, color: 'deferred', label: tr('deferred to the final review'), jobId: latest?.job_id ?? null, status: latest?.status ?? null };
    }
    const color = legStatusColorOf({ noRows: () => !rows.length, inFlight: () => rows.some((row) => LEG_IN_FLIGHT.includes(row.status)), unresolved: () => failedRows.some((row) => row.op_id === op && unresolvedIds.has(row.job_id)), failedRetry: () => rows.some((row) => row.status === 'queued' && rowOf.get(jobPayloadOf(row).retry?.retryOf)?.status === 'failed'), queued: () => rows.some((row) => row.status === 'queued'), ownerWait: () => ownerWaitOps.has(op), succeeded: () => rows.some((row) => row.status === 'succeeded'), rework: () => reworkOps.has(op) });
    const deferred = latest ? specDeferredJobs.get(latest.job_id) ?? null : null;
    const deferredField = deferredFieldOf(deferred, () => !rows.length && deferredPlanOps.has(op), () => deferredPlanOps.get(op).reason);
    if (color === 'green' && provisional.has(op)) return { op, color: 'green-provisional', label: tr(PROVISIONAL_LABEL), jobId: latest?.job_id ?? null, status: latest?.status ?? null, ...deferredField };
    // A leg whose latest try ended asking the owner is yellow and says so: it is a wait, never a failure.
    const waitsOnOwner = latest?.status === 'awaiting_owner' && ownerWaitOps.has(op) ? { awaitingOwner: true } : {};
    return { op, color, jobId: latest?.job_id ?? null, status: latest?.status ?? null, ...waitsOnOwner, ...deferredField };
  });
  return legs;
};
/** The terminal holds of the table that apply now, each with its handler, chain and bound: a failed job with no step, an owner wait with no ask. */
const terminalHoldsOf = (ctx) => {
  const { db, unresolved, awaitingOwner } = ctx;
  const failed = unresolved.filter((row) => !jobResult(db, row.job_id)?.nextStep).map((row) => ({ jobId: row.job_id, op: row.op_id, ...holdView(TERMINAL_HOLDS.failedNoStep) }));
  const asked = ownerWaitsWithoutAsk(awaitingOwner).map((item) => ({ jobId: item.jobId, op: item.opId, ...holdView(TERMINAL_HOLDS.ownerWaitNoAsk) }));
  return [...failed, ...asked];
};
export function graphProjectionOf(db, { wf, legOps, planAncestors, workflowJobs, jobsByOp, failedRows, queued, ownerGates, peerWaits, awaitingOwner, staleReady, staleProofs = [], credentialWaitOps = new Set(), approvalWaitOps = new Set(), workGraph = null, assetSlotsOwed = [], autopilot = null, handover = null }) {
  if (wf.phase === 'finished') return { nextActions: [], legs: [], terminal: [] };
  const unresolved = unresolvedFailures(db, failedRows, workflowJobs);
  const rowOf = new Map(workflowJobs.map((row) => [row.job_id, row]));
  const actions = [];
  // Autopilot (scripts/kernel/autopilot-run.mjs): deferred legs wait for the final review and block nothing.
  const deferredJobs = new Set((autopilot?.deferred ?? []).map((item) => item.jobId));
  // The owner's config.yaml specs switches, read once per projection: a test leg of a class that is off is
  // deferred, so nothing waits on it and its enqueue/route only records the deferral (spec-deferral.mjs).
  const specs = ownerSpecs(skillRoot);
  const goalText = latestGoal(db, wf.workflow_id)?.markdown ?? null;
  const deferredPlanOps = new Map(legOps.map((op) => [op, planLegDeferral({ skillRoot, op, settings: specs, goalText })]).filter(([, deferral]) => deferral));
  const specDeferredJobs = new Map(deferredTestsOf(db, wf.workflow_id).map((item) => [item.jobId, item.reason ?? 'deferred']));
  // A queued leg the specs switches defer needs nothing it waits on: whatever holds it, its route settles it
  // deferred at once (no dispatch, no attempt), which releases every leg behind it.
  const deferredQueued = new Map(queued.map((item) => [item.jobId, testDeferralOf({ skillRoot, op: item.opId, payload: jobPayloadOf(rowOf.get(item.jobId)), settings: specs })]).filter(([, deferral]) => deferral));
  const ctx = { db, wf, legOps, planAncestors, workflowJobs, jobsByOp, failedRows, queued, ownerGates, peerWaits, awaitingOwner, staleReady, staleProofs, credentialWaitOps,
    approvalWaitOps, workGraph, assetSlotsOwed, autopilot, unresolved, rowOf, deferredJobs, specs, goalText, deferredPlanOps, specDeferredJobs, deferredQueued,
    legPaths: withDeferredStubs(legPathsOf(latestGoal(db, wf.workflow_id)?.json), wf.workflow_id, deferredPlanOps.keys()) };
  unresolvedRetryActions(actions, ctx);
  askless(actions, ctx);
  answeredAskActions(actions, ctx);
  reopenedActions(actions, ctx);
  deferredQueuedActions(actions, ctx);
  readyQueuedActions(actions, ctx);
  approvedLegActions(actions, ctx);
  redNodeActions(actions, ctx);
  staleProofActions(actions, ctx);
  assetSlotActions(actions, ctx);
  staleReadyActions(actions, ctx);
  gateActions(actions, ctx);
  pendingAskActions(actions, ctx);
  credentialStepAction(actions, ctx);
  const handoverAction = handoverReviewAction(handover, wf.workflow_id);
  if (handoverAction) actions.push(handoverAction);
  inFlightWaitActions(actions, ctx);
  queuedWaitActions(actions, ctx);
  peerWaitActions(actions, ctx);
  return { nextActions: nextActionsOf(actions, ownerGates, peerWaits), legs: legsOf(ctx), terminal: terminalHoldsOf(ctx) };
}
export const ownerGateOf = (gates, job) => {
  const opId = job.op_id ?? jobPayloadOf(job).opId ?? null;
  return gates.find((gate) => gate.holds.includes(job.job_id) || (opId && gate.holds.includes(opId)) || (gate.kind === SUPERVISOR_GATE && gate.holds.includes('*') && job.status === 'queued')) ?? null;
};
