// The admission gates of `starci kernel dispatch`: every refusal that leaves the job queued, in the order the verb runs
// them. A gate reads and fills one dispatch context `d` ({ ledger, args, repo, emit, internals, db, jobId } plus what the
// earlier gates set: job, payload, op, ...) and either returns or refuses with a typed object and exit 1.
import path from 'node:path';
import { updateJob } from '../../../../engine/db/ledger.mjs';
import { allocationSettings } from '../../../../engine/config.mjs';
import { isAwaitingOwner } from '../../failure-steps.mjs';
import { enqueueRepository } from '../../target-repo.mjs';
import { checkGrantParents } from '../../grant-parents.mjs';
import { workflowAppRepo, workflowSideWait, requireWorkflowPlacement } from '../../workflow-worktree.mjs';
import { DISPATCHES, requirePhase } from './workflow-transitions.mjs';
import { ownedPathsOf, getWorkflow } from './rows.mjs';
import { releaseTypedWaits } from './peer-waits.mjs';
import { queuedJobOp, refuseOwnerGate, refusePeerWait, opSlotsOrRefuse } from './job-gates.mjs';
import { hostResourcesFor, HOST_RESOURCES_LOW } from '../../../machine/host-resources.mjs';
import { tempRoot, TEMP_ROOT_ENV } from '../../../../engine/temp-root.mjs';
import { ensureTempRoot } from '../../../api/fs/ensure-temp-root.mjs';
import { hostThrottle, noteThrottled, releaseThrottled, DISPATCH_THROTTLED } from '../../../machine/ram-throttle.mjs';
import { deferredQueueCause } from '../../autopilot-run.mjs';
import { checkPrerequisites, prerequisiteDetail } from '../../prerequisites.mjs';
import { unsettledPlanPrerequisites } from '../../plan-prerequisites.mjs';
import { FOUNDATION_WAIT, gateShellFoundation, shellFoundationNeed } from '../../shell-foundation.mjs';
import { isSeamCut, seamStubForDispatch } from '../../seam-policy.mjs';
import { selectDispatchContract } from '../../dispatch-admission.mjs';
import { refuseVerb } from './verb-exit.mjs';
import { grammarGapCause } from '../../brand-product.mjs';

/** The queued (or ready) job of the call and its op; an unknown, settled or running job refuses with its code. */
export function loadQueuedJob(d) {
  const { ledger, args, db, jobId, internals } = d;
  // Dispatch never re-decides the route; a Kernel's --prefer/--avoid is an unknown option here as on starci kernel route.
  internals.refuseKernelBias('dispatch', args);
  const job = db.prepare('SELECT * FROM jobs WHERE job_id=?').get(jobId);
  if (!job) throw Object.assign(new Error(`unknown job ${jobId}`), { code: 'job-unknown' });
  if (internals.SETTLED.includes(job.status)) throw Object.assign(new Error(`job ${jobId} is already settled (${job.status})`), { code: 'job-settled' });
  // Only a queued or ready job launches (ready: a launch refused before its op took the contract, H13); a cancelled,
  // leased, running or settled one never does (H9).
  if (!['queued', 'ready'].includes(job.status)) throw Object.assign(new Error(`job ${jobId} cannot dispatch while ${job.status}; settle/reconcile the current worker first`), { code: 'job-not-queued' });
  // A paused, stopped, finished or archived workflow launches nothing (H9: an archived workflow's job ran 25 h).
  requirePhase(getWorkflow(db, job.workflow_id), DISPATCHES, 'dispatch');
  // SETTLE-FIRST (driver-loop.yaml menu.settleFirst): no new dispatch while filed reports wait unconsumed.
  const { payload, op } = queuedJobOp(ledger, { job, verb: 'dispatch', liveHint: 'dispatching a duplicate', internals });
  Object.assign(d, { job, payload, op });
}

/** Placement authority is checked before environment preparation, leases, packet files or an agent spawn. */
function workflowTreeOf(d) {
  const { args, repo, job } = d;
  const gitPlacement = Boolean(workflowAppRepo(repo) || (args.worktree && workflowAppRepo(path.resolve(repo, args.worktree))));
  return args.spawn || !args.worktree ? requireWorkflowPlacement({ env: process.env }, { workflowId: job.workflow_id,
    placements: args.worktree ? [path.resolve(repo, args.worktree)] : [], required: Boolean(args.spawn && gitPlacement) }) : null;
}

/** The grant is re-judged at launch: the tree may have moved since enqueue. */
function refuseUnsatisfiableGrant(d, dispatchTarget) {
  const { repo, jobId, op, payload } = d;
  const grant = checkGrantParents({ op, payload: { ...payload, repository: payload.repository ?? dispatchTarget.repository ?? undefined }, ownedPaths: ownedPathsOf(payload), repo });
  if (grant.ok) return;
  const out = { ok: false, jobId, op, reason: grant.reason, violations: grant.violations.map(({ owned, dir, closest }) => ({ owned, dir, closest })), detail: grant.detail };
  refuseVerb(d, out, `dispatch REFUSED for ${jobId} (${op}): ${out.reason} — ${out.detail}; job stays queued`);
}

/**
 * The dispatch contract, the repository and the workflow tree of the job, the grant re-judged, and the test-leg deferral.
 * Returns true when the job was deferred (the verb ends there).
 */
export function admitTarget(d) {
  const { ledger, args, repo, jobId, job, payload, op, internals } = d;
  const selectedDispatch = selectDispatchContract(internals.skillRoot, op, payload, { planning: !args.spawn });
  d.selectedDispatch = selectedDispatch;
  d.briefDoc = selectedDispatch.brief;
  d.dispatchParams = selectedDispatch.params;
  const dispatchTarget = enqueueRepository({ op, repository: payload.repository, ownedPaths: ownedPathsOf(payload), repo });
  if (!dispatchTarget.ok) {
    const out = { ok: false, jobId, op, reason: dispatchTarget.reason, detail: dispatchTarget.detail };
    refuseVerb(d, out, `dispatch REFUSED for ${jobId} (${op}): ${out.reason} — ${out.detail}`);
  }
  d.workflowTree = workflowTreeOf(d);
  refuseUnsatisfiableGrant(d, dispatchTarget);
  if (!payload.repository && dispatchTarget.repository) {
    payload.repository = dispatchTarget.repository;
    ledger.transaction((tx) => updateJob(tx, { jobId, payload }));
  }
  if (internals.deferQueuedTestLeg(ledger, { job, op, payload, via: 'dispatch', args })) return true;
  internals.refuseStaleKernelRev(d.db, job.workflow_id, op, 'dispatch');
  return false;
}

/** Autopilot: a deferred leg, or a live proof waiting for the handover credential checklist, is not launched. */
function refuseAutopilotDeferral(d) {
  const { db, job, jobId, op } = d;
  const deferredBy = deferredQueueCause(db, job);
  if (!deferredBy) return;
  const out = { ok: false, jobId, op, reason: deferredBy.queuedBecause, blockedBy: deferredBy.blockedBy, detail: deferredBy.detail };
  refuseVerb(d, out, `dispatch REFUSED for ${jobId} (${op}): ${deferredBy.queuedBecause} — ${deferredBy.detail}; job stays queued`);
}

/** Seam priority (cut-seam.mjs): the workflow's last free slot goes to a queued cut seam nothing else holds, never to other work. */
function refuseSeamPriority(d, slots) {
  const { db, job, jobId, op, payload, internals } = d;
  const free = slots.ceiling != null && slots.ceiling - slots.running <= 1 && !isSeamCut(payload.cut);
  const seamFirst = free ? internals.queuedSeamsOf(db, job.workflow_id).find((seam) => seam.job_id !== jobId) ?? null : null;
  if (!seamFirst) return;
  const out = { ok: false, jobId, op, reason: 'seam-priority', seam: seamFirst.job_id, slots };
  refuseVerb(d, out, `dispatch REFUSED for ${jobId} (${op}): seam-priority — the last free slot (${slots.running}/${slots.ceiling}) goes to queued cut seam ${seamFirst.job_id} (${seamFirst.op_id}); dispatch it first, then this job`);
}

/**
 * A cut sibling dispatched before its seam passed runs on a stub and owes a reconcile (cut-seam.mjs):
 * payload.cut.seamStub rides into the packet (context.cut) and the op prompt.
 */
function applySeamStub(d) {
  const { db, job, payload } = d;
  if (!(payload.cut && Number(payload.cut.ordinal) > 1)) return;
  let seamStub = null;
  try { seamStub = seamStubForDispatch(db, job, { isOwnerWait: (row) => isAwaitingOwner(db, row) }); } catch { seamStub = null; }
  if (seamStub) payload.cut = { ...payload.cut, seamStub };
  else if (payload.cut.seamStub) payload.cut = Object.fromEntries(Object.entries(payload.cut).filter(([key]) => key !== 'seamStub'));
}

/**
 * Concurrency admission, before the packet and before any Orca call: the workflow may hold min(budgets.maxOps,
 * maxParallelOps) operations at once and a job above that line stays queued rather than launching (engine/admission.mjs
 * admitOpSlot). Pool maxParallel is a separate fence route already applies; this one is the workflow's own ceiling.
 */
export function refuseHolds(d) {
  const { ledger, args, repo, job, op, internals } = d;
  // A wait whose typed --until-* conditions already hold is released before the gates below read it.
  releaseTypedWaits(ledger, { repo, workflowId: job.workflow_id });
  refuseOwnerGate(ledger, { job, op, opKey: 'op', verb: 'dispatch', suffix: '; job stays queued', emit: d.emit, args, internals });
  refuseAutopilotDeferral(d);
  refusePeerWait(ledger, { job, op, opKey: 'op', verb: 'dispatch', suffix: '; job stays queued', emit: d.emit, args, internals });
  const slots = opSlotsOrRefuse(ledger, { job, op, opKey: 'op', verb: 'dispatch', suffix: '; job stays queued', emit: d.emit, args, internals });
  refuseSeamPriority(d, slots);
  applySeamStub(d);
}

/**
 * Data prerequisites, before the packet and before any Orca call: a record the op must read that the binding names but
 * the repository lacks, or a bound record whose dependsOn is not done where the op requires done. A dispatch that can
 * only end blocked on them is a wasted launch.
 */
function refuseUnmetPrerequisites(d) {
  const { repo, db, job, jobId, op, payload, briefDoc, dispatchParams } = d;
  const unmet = [...checkPrerequisites({ brief: briefDoc, payload, repo, params: dispatchParams }).unmet, ...unsettledPlanPrerequisites(db, { workflowId: job.workflow_id, op })];
  if (!unmet.length) return;
  const coded = unmet.find((item) => item.code);
  const out = { ok: false, jobId, op, reason: 'prerequisite-unmet', ...(coded ? { code: coded.code } : {}), unmet,
    detail: prerequisiteDetail({ op, jobId, unmet }) };
  refuseVerb(d, out, `dispatch REFUSED for ${jobId} (${op}): prerequisite-unmet — ${out.detail}`);
}

/**
 * The layout chain above an interface.draw is one shared foundation (`shell`), never a refusal: a draw starts from a
 * pending shell and unsettled ancestors. The first workflow to find parents to draw claims the foundation and draws them
 * in this op; a live owner elsewhere makes this dispatch wait (foundation-wait) instead of drafting a second shell.
 */
function refuseShellFoundationWait(d) {
  const { ledger, repo, job, jobId, op, payload, briefDoc } = d;
  const shellNeed = briefDoc ? shellFoundationNeed({ brief: briefDoc, payload, repo }) : null;
  if (!shellNeed?.needed) return;
  const gate = gateShellFoundation(ledger, { job, need: shellNeed, settings: allocationSettings() });
  if (gate.action !== 'wait') return;
  const out = { ok: false, jobId, op, reason: FOUNDATION_WAIT, foundation: gate.foundation, owner: gate.owner, detail: gate.detail, ...(gate.decision ? { decision: gate.decision } : {}) };
  const decisionNote = gate.decision ? `; Supervisor Decision Item ${gate.decision} opened (the owner is past its stall limit)` : '';
  refuseVerb(d, out, `dispatch REFUSED for ${jobId} (${op}): ${FOUNDATION_WAIT} — ${gate.detail}${decisionNote}; job stays queued`);
}

export function refuseUnmetStart(d) {
  refuseUnmetPrerequisites(d);
  refuseShellFoundationWait(d);
}

/** What a spawn needs and a dry run only reports: the brief on disk, a model inside the kind's order, the host tools, the grammar context. */
export function refuseLaunchInputs(d) {
  const { args, jobId, op, model, launchOrder, allowed, outsideOrder, briefExists, lackingTools, grammarMissing, grammarContext } = d;
  if (!briefExists) throw Object.assign(new Error(`spawn refused — no brief at modules/ops/ops/${op}.yaml`), { code: 'brief-missing' });
  if (outsideOrder) {
    refuseVerb(d, { ok: false, jobId, op, reason: 'model-outside-order', model: model.target, tier: launchOrder.tier ?? null,
      difficulty: launchOrder.difficulty ?? null, allowed, detail: outsideOrder }, `dispatch REFUSED for ${jobId} (${op}): model-outside-order — ${outsideOrder}`);
  }
  // A route persisted before host tools gated routing, an unrouted job's
  // default pool or a --model override can name an agent without a tool the op
  // cannot run without. That launch is a wasted dispatch; nothing is reserved.
  if (lackingTools.length) {
    const detail = `${model.target} (agent ${model.provider}) lacks host tool ${lackingTools.join(', ')} that ${op} requires (route.riskHints host-tool-required on modules/ops/ops/${op}.yaml). Re-run starci kernel route --job ${jobId} — it now selects only agents whose card lists the tool — then dispatch again${args.model ? ' without --model' : ''}. The job stays queued.`;
    refuseVerb(d, { ok: false, jobId, op, reason: 'tool-unavailable', tools: lackingTools, model: model.target, detail },
      `dispatch REFUSED for ${jobId} (${op}): tool-unavailable — ${detail}`);
  }
  if (grammarMissing) {
    const detail = `${op} declares grammarContext: required and ${grammarMissing}. Fix the product's brand.sources or the Source knowledge, then dispatch again. The job stays queued.`;
    refuseVerb(d, { ok: false, jobId, op, reason: 'grammar-context-missing', cause: grammarGapCause(grammarContext.missing), missing: grammarContext.missing, watch: grammarContext.watch ?? [], detail },
      `dispatch REFUSED for ${jobId} (${op}): grammar-context-missing — ${detail}`);
  }
}

/** A live lease on the write set, then a busy workflow side: typed waits, checked before the provider circuit, the leases and any Orca call. */
export function refuseWaits(d) {
  const { db, repo, job, jobId, op, payload, workflowTree, internals } = d;
  // A live lease on the write set is a wait (livePathLeaseWait): nothing is spawned, nothing is recorded as a rejection.
  const leaseWait = internals.livePathLeaseWait(db, job, payload, { repo });
  if (leaseWait) {
    refuseVerb(d, { ok: false, jobId, op, reason: 'path-lease', waiting: true, ...leaseWait },
      `dispatch WAITING for ${jobId} (${op}): path-lease — ${leaseWait.detail}`);
  }
  // A busy side of the workflow worktree is the next wait (a path conflict above is the more precise answer).
  const sideWait = workflowTree ? workflowSideWait(db, job, payload) : null;
  if (sideWait) {
    refuseVerb(d, { ok: false, jobId, op, waiting: true, ...sideWait },
      `dispatch WAITING for ${jobId} (${op}): ${sideWait.reason} — ${sideWait.detail}`);
  }
}

const fmtNum = (n) => (typeof n === 'number' && Number.isFinite(n) ? n.toFixed(1) : '?');

/** The RAM-aware throttle verdict of the host ({error} when the probe threw; null below the disk floor). */
function hostThrottleOf(d, host) {
  const { ledger, repo, db, job, op } = d;
  if (host.lowDisk) return null;
  try { return hostThrottle({ op, workflowId: job.workflow_id, env: process.env, repo, db, ledgerFile: ledger.path ?? null }); }
  catch (error) { return { error: String(error?.message ?? error) }; }
}

/** The numbers a dispatch-throttled event carries. */
function throttledOf(d, host, throttle, admission) {
  return {
    reason: admission.reason, op: d.op, class: admission.class, estimateMb: admission.estimateMb, estimateSource: admission.estimateSource,
    mode: throttle.mode, modeWhy: throttle.modeWhy, freeRamPct: Math.round(Number(host.freeRamPct ?? 0) * 10) / 10, cpuBusy: throttle.cpuBusy,
    totalRamGb: Math.round(Number(host.totalRamBytes ?? 0) / 1e8) / 10, headroomMb: admission.headroomMb, reserveMb: admission.reserveMb,
    running: admission.running, effectiveCap: admission.effectiveCap, heavyCap: admission.heavyCap, maxParallelOps: admission.maxParallelOps,
    priority: admission.priority,
  };
}

/** The disk half of a host limit: the drive, what it keeps free, the config.yaml keys that move the floor and the temp root in use. */
function diskLimitDetail(host) {
  const floors = host.thresholds ?? {};
  const required = fmtNum(host.requiredDiskGb ?? floors.minFreeDiskGb);
  const pct = floors.minFreeDiskPct == null ? '' : ` / minFreeDiskPct ${floors.minFreeDiskPct}%`;
  return `drive ${host.drive ?? '?'} has ${fmtNum(host.freeDiskGb)} GB free (below the ${required} GB floor; change it in config.yaml resources.minFreeDiskGb${pct}, or move the temp root with roots.temp / ${TEMP_ROOT_ENV} - the temp root in use is ${tempRoot()})`;
}

/** The sentence of a host limit: the disk floor and the RAM admission, each when it holds the job. */
function hostLimitDetail(host, admission) {
  const parts = [];
  if (host.lowDisk) parts.push(diskLimitDetail(host));
  if (admission && !admission.ok) parts.push(`RAM ${fmtNum(host.freeRamPct)}% free, effective cap ${admission.effectiveCap ?? '-'}/${admission.maxParallelOps ?? '-'} (${admission.running} running): ${admission.reason} - ${admission.detail}`);
  return `${parts.join('; ')}; the job stays queued and reads ready once there is room again - do not re-dispatch it by hand`;
}

/** Records the throttle event (the wait stands without it) and notes the throttled job for the other ledgers. */
function recordThrottled(d, throttle, admission, throttled) {
  const { ledger, job, jobId } = d;
  try { ledger.transaction(() => ledger.appendEvent({ workflowId: job.workflow_id, entityType: 'job', entityId: jobId, kind: DISPATCH_THROTTLED, payload: throttled })); } catch { /* the wait stands without its event */ }
  if (!throttle.testContext) noteThrottled({ jobId, workflowId: job.workflow_id, ledgerId: ledger.ledgerId ?? null, reason: admission.reason });
}

/**
 * Host resources are a launch gate on the same admission path as the provider circuit, checked before it, the leases and
 * any Orca call. Disk below the config.yaml resources floor (minFreeDiskGb / minFreeDiskPct, shipped default allocation.resources.minFreeDiskGb) never spawns another worker (scripts/machine/host-resources.mjs).
 * RAM and CPU go through the RAM-aware, priority-aware throttle (scripts/machine/ram-throttle.mjs, owner ruling
 * 2026-09-28): the effective cap min(maxParallelOps, what fits in free RAM) across every ledger of the host, heavy ops
 * paused below minFreeRamPct (the top-priority workflow's still start while they fit, until critical), every op sized by
 * its RAM estimate. Both are a typed wait like path-lease - nothing is recorded as a rejection, a dispatch-throttled event
 * carries the numbers - and each dispatch re-probes, so the job reads ready again on its own once there is room.
 */
export function refuseHostLimits(d) {
  const { ledger, repo, jobId, op } = d;
  try { ensureTempRoot(); } catch (error) {
    refuseVerb(d, { ok: false, jobId, op, reason: error.code, detail: error.message }, `dispatch REFUSED for ${jobId} (${op}): ${error.message}`);
  }
  const host = hostResourcesFor({ env: process.env, repo });
  const throttle = hostThrottleOf(d, host);
  const admission = throttle?.admission ?? null;
  if (host.lowDisk || admission?.ok === false) {
    const detail = hostLimitDetail(host, admission);
    const throttled = admission?.ok === false ? throttledOf(d, host, throttle, admission) : null;
    if (throttled) recordThrottled(d, throttle, admission, throttled);
    refuseVerb(d, { ok: false, jobId, op, reason: HOST_RESOURCES_LOW, waiting: true, host: { ...host, lowRam: host.lowRam || Boolean(throttled) }, ...(throttled ? { throttle: throttled } : {}), detail },
      `dispatch WAITING for ${jobId} (${op}): ${HOST_RESOURCES_LOW} - ${detail}`);
  }
  if (admission?.ok) releaseThrottled({ jobId, ledgerId: ledger.ledgerId ?? null });
}

/**
 * A route decision may have been persisted before another job proves the shared provider credential is dead. Re-check
 * the durable provider circuit before taking leases or creating an Orca Task so an already-routed sibling pool cannot
 * slip through the circuit.
 */
export function refuseProviderCircuit(d) {
  const { ledger, db, job, jobId, op, model, packet, internals } = d;
  const providerHealth = internals.providerHealthOf(db, model.provider);
  if (!providerHealth) return;
  const error = `provider ${providerHealth.failureKind ?? 'auth'} unavailable (${providerHealth.provider}); circuit open until ${providerHealth.expiresAt ?? 'explicit recovery'}`;
  const rejection = internals.rejectDispatch(ledger, job, jobId, op, model, {
    step: 'provider-health', error, effectState: 'none', details: providerHealth,
    providerHealthEvidence: providerHealth,
  });
  refuseVerb(d, { ok: false, jobId, rejected: 'dispatch-rejected', packet, rejection, providerHealth },
    `dispatch REJECTED for ${jobId} (provider-health): ${error}; logical attempt retained${internals.circuitClearHint(providerHealth)}`);
}
