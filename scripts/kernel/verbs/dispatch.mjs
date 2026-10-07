// starci kernel dispatch: admit and launch an operation from its persisted route.
import { transitionWorkflowToRunning } from '../../../engine/db/ledger.mjs';
import { inspectOwnerConfig } from '../../../engine/config.mjs';
import { depthPreflight } from '../../agent/depth-preflight.mjs';
import { spawnOperationAgent } from './shared/dispatch-agent.mjs';
import { markRunning, runningOrAbandon } from './shared/dispatch-running.mjs';
import { bindGuardTerminal } from '../../guards/hook-install.mjs';
import { reserveDispatch } from '../dispatch-reservation.mjs';
import { VerbExit } from './shared/verb-exit.mjs';
import { admitTarget, loadQueuedJob, refuseHolds, refuseHostLimits, refuseLaunchInputs, refuseProviderCircuit, refuseUnmetStart, refuseWaits } from './shared/dispatch-gates.mjs';
import { emitDryRun, environmentGate, planModel, planPrompt, planWorker, prepareScratch } from './shared/dispatch-plan.mjs';

export default {
  verb: 'dispatch',
  required: ['job'],
  kernelOnly: true,
  usageInCore: true,
  run({ ledger, args, repo, emit, internals }) {
    const jobId = args.job;
    // One context carries the job and what each gate and plan step learns, in the order the verb runs them.
    const d = { ledger, args, repo, emit, internals, db: ledger.db, jobId };
    loadQueuedJob(d);
    if (admitTarget(d)) return;
    refuseHolds(d);
    refuseUnmetStart(d);
    planModel(d);
    planWorker(d);
    environmentGate(d);
    planPrompt(d);
    if (!args.spawn) { emitDryRun(d); return; }
    refuseLaunchInputs(d);
    refuseWaits(d);
    refuseHostLimits(d);
    refuseProviderCircuit(d);
    const { job, payload, op, model, packet, prompt, packetFile, worktree, checkoutRoot, title, inputs, launchModel, scratchDir, placements, workerCwd, workflowTree } = d;
    // §6 admission — the repo-path leases and the job's fencing token are taken
    // BEFORE anything launches, for both launch kinds. A refusal (a live lease
    // already owns a path, or the machine arbiter can't open) is a dispatch
    // rejection: the worker must never be what discovers the write set was
    // already taken, and an unfenced dispatch is exactly what this layer kills.
    const reserve = reserveDispatch({ ledger, args, job, jobId, payload, packet, op, model, repo, emit, internals });
    prepareScratch(d);
    // worker-start owns the agent's environment, so no shim reaches it; the history hook in its checkouts does, finding
    // the op by its bound Orca terminal (scripts/guards/hook-install.mjs bindGuardTerminal).
    const guard = internals.opGuardLaunch({ job, jobId, repo, placements, workerCwd, workflowWorktree: workflowTree?.path ?? null });
    return cmdDispatchManaged(ledger, args, { job, jobId, payload, op, model, packet, prompt, packetFile, worktree, checkoutRoot, title, reserve, inputs, guard, launchModel, scratchDir }, internals, emit);
  },
};

function cmdDispatchManaged(ledger, args, { job, jobId, payload, op, model, packet, prompt, packetFile = null, worktree, checkoutRoot = worktree, title, reserve, inputs = null, guard = null, launchModel, scratchDir = null }, internals, emit) {
  const { cleanupManagedWorker, rejectDispatch, ensureWorkflowRun, recordLaunchTerminal, skillRoot, ownerRoot, AGENT_HIERARCHY_SCHEMA, operationNodeId, kernelNodeId, buildContractMarkdown, fileContract } = internals;
  const db = ledger.db;

  let trust = null;
  // A rejection before the launch has no effect; a launch rejection arrives already reconciled by spawnAgent
  // (worker-show before any stop on an unknown effect, cleanupManagedWorker on a partial one).
  const reject = ({ step, signal = null, error = null, dispatchId = null, incident = false,
    effectState = 'none', observation = null, cleanup = null, details = null, code = null }) => {
    const rejection = rejectDispatch(ledger, job, jobId, op, model, {
      step, signal, error, terminal: dispatchId, incident,
      effectState, details, settled: cleanup, trust,
    });
    const reason = signal ?? error ?? `managed dispatch failed at ${step}`;
    const out = { ok: false, jobId, rejected: 'dispatch-rejected', packet, rejection,
      managed: { step, dispatchId, effectState, ...(code ? { code } : {}), ...(observation ? { observation } : {}), ...(cleanup ? { cleanup } : {}) } };
    const cleanupNote = cleanup ? `, worker ${dispatchId} cleanup stop=${cleanup.stop?.ok} release=${cleanup.release?.ok}` : '';
    emit(out, `dispatch REJECTED for ${jobId} (${step}): ${reason} — job status=${rejection.status}, effect=${effectState}${cleanupNote}`, args.json);
    throw new VerbExit(1);
  };

  // 1. Launch model (resolveWorkerLaunchModel, resolved with the launch plan).
  if (launchModel.error) return reject({ step: 'route', error: `${model.target} has no launch model: ${launchModel.error}` });
  const modelId = launchModel.modelId;
  const effort = launchModel.effort ?? null;

  // 2. Run id — one workflow Run, with the Kernel terminal as coordinator.
  const run = ensureWorkflowRun(ledger, { job, jobId, payload });
  if (!run.ok) return reject({ step: 'run-create', error: run.error });
  const { runId, kernelHandle } = run;
  // 2b. Depth: the op nests under its Kernel's Dispatch; one deeper than
  // config.yaml orca.maxWorkerDepth is refused worker-depth-exceeded before its Task exists (no try spent).
  const preflight = depthPreflight({ parentDispatch: run.kernelPayload?.managed?.dispatchId ?? null });
  if (preflight.refusal) return reject({ step: 'depth', code: preflight.refusal.code, error: preflight.refusal.error });

  const owner = inspectOwnerConfig(ownerRoot);
  const launchConfig = owner.error || owner.invalid ? null : owner.config;
  const launched = spawnOperationAgent({ ledger, job, op, model, launchModel, payload, jobId, prompt, packetFile, config: launchConfig,
    worktree: checkoutRoot, title, run: runId, from: kernelHandle, preflight, request: { job: jobId, lease: reserve.leaseToken },
    onCreated: (handle, dispatchId) => recordLaunchTerminal(ledger, jobId, handle, dispatchId), io: { cleanup: cleanupManagedWorker } });
  trust = launched.trust ?? null;
  if (!launched.ok) {
    return reject({ step: launched.step, dispatchId: launched.dispatchId, incident: launched.incident === true,
      ...(launched.step === 'attestation' ? { signal: launched.error } : { error: launched.error }),
      effectState: launched.effectState, observation: launched.observation ?? null, cleanup: launched.cleanup ?? null, details: launched.details ?? null });
  }
  const { dispatchId, taskId } = launched;
  // The op's guard, keyed by the terminal Orca exports as ORCA_TERMINAL_HANDLE (scripts/guards/hook-install.mjs bindGuardTerminal).
  if (guard?.receipt && typeof guard.receipt.jobFile === 'string') {
    try { guard.receipt.terminal = bindGuardTerminal({ skillRoot, handle: launched.terminal, jobFile: guard.receipt.jobFile }); }
    catch (e) { guard.receipt.terminal = { error: String(e?.message ?? e) }; }
  }

  // 7. Running — worker_id is the Dispatch id (managed workers have no
  // command-terminal handle); payload.managed carries the Orca ids settle needs.
  payload.managed = { runId, taskId, dispatchId, agentTerminalHandle: launched.terminal,
    admission: launched.admission ?? null,
    terminalTitle: title, terminalTitleApplied: launched.titleApplied };
  payload.agent = model.provider;
  payload.provider = model.provider;
  payload.model = model.target;
  payload.modelId = modelId;
  payload.effort = effort;
  payload.hierarchy = payload.hierarchy ?? {
    schema: AGENT_HIERARCHY_SCHEMA, nodeId: operationNodeId(jobId),
    parentNodeId: kernelNodeId(job.workflow_id), role: 'operation',
    workflowId: job.workflow_id, jobId, opId: op,
    attempt: job.try_no, generation: job.generation,
  };
  payload.hierarchy.runtime = {
    ...payload.hierarchy.runtime, host: 'orca',
    agent: model.provider, provider: model.provider, model: modelId,
    profile: model.target, runtimePool: model.target,
    runId, taskId, dispatchId, terminalHandle: launched.terminal,
  };
  const contractMarkdown = buildContractMarkdown({ op, jobId, prompt, packet });
  runningOrAbandon(() => ledger.transaction(() => {
    const now = Date.now();
    // The attempt and its contract (the dispatch authority; dispatch_id is the worker's Dispatch id), then running.
    transitionWorkflowToRunning(ledger, { workflowId: job.workflow_id, now, by: 'kernel', reason: `first dispatch ${jobId}` });
    fileContract(db, {
      job, op, dispatchId, markdown: contractMarkdown, now,
      attempt: { scratchDir, managed: 1, runId, taskId, terminalHandle: launched.terminal, provider: model.provider, model: modelId, effort, modelProfile: model.target, pool: model.target, worktreePath: worktree, startedAt: now, attestedAt: now },
      context: { packet, contract: packet.context.contract, worktree, model: model.target, managed: payload.managed, hierarchy: payload.hierarchy, lease: { token: reserve.leaseToken, expiresAt: reserve.expiresAt, fencing: reserve.fencing }, inputs },
    });
    markRunning(db, { job, jobId, reserve, worker: dispatchId, payload, now });
    ledger.appendEvent({
      workflowId: job.workflow_id, entityType: 'job', entityId: jobId,
      kind: 'op-dispatched',
      payload: { op, dispatch: dispatchId, model: model.target, worktree, managed: true, runId, taskId, modelId, ...(trust ? { trust } : {}), ...(guard ? { guard: guard.receipt } : {}), parentNodeId: payload.hierarchy.parentNodeId, nodeId: payload.hierarchy.nodeId, leaseToken: reserve.leaseToken, fencing: reserve.fencing },
    });
  }), { ledger, db, job, jobId, op, dispatchId, attemptId: null, emit, args, abandon: () => cleanupManagedWorker(dispatchId) });
  const out = {
    ok: true, jobId, spawned: true, dispatchId, packet,
    managed: { runId, taskId, dispatchId, modelId, effort, assignee: launched.terminal, terminalTitle: title },
    hierarchy: payload.hierarchy,
  };
  emit(out, `dispatched ${jobId} — [Op] ${op} managed worker ${dispatchId} (${model.target}/${modelId}, task ${taskId}); job status=running`, args.json);
}
