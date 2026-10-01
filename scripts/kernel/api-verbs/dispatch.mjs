// api dispatch: admit and launch an operation from its persisted route.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { transitionWorkflowToRunning, updateJob } from '../../../engine/ledger-db.mjs';
import { parseYaml } from '../../../engine/yaml.mjs';
import { admitOpSlot } from '../../../engine/admission.mjs';
import { allocationMs, allocationSettings } from '../../../engine/config.mjs';
import { buildOpPrompt, renderOwnedPath, ensureJobScratch, jobScratchDirOf } from '../op-prompt.mjs';
import { priorAttemptFailures } from '../prior-failures.mjs';
import { withLessons } from '../../supervisor/lessons-file.mjs';
import { ownerAnswersOf } from '../owner-answers.mjs';
import { isAwaitingOwner } from '../failure-steps.mjs';
import { enqueueRepository, ownedPathPlacements } from '../target-repo.mjs';
import { checkGrantParents } from '../grant-parents.mjs';
import { workflowWorktreeOf, workflowAppRepo, opWorktreeArgs, sideOf, workflowSideWait, workflowWorktreePromptRules, WORKFLOW_WORKTREE_MISSING } from '../workflow-worktree.mjs';
import { grammarContextRequired, grammarInputsOf, resolveGrammarContext, grammarMissingDetail } from '../grammar-context.mjs';
import { spawnAgent } from '../../agent/lib.mjs';
import { depthPreflight } from '../../agent/depth-preflight.mjs';
import { markRunning, runningOrAbandon } from '../api-lib/dispatch-running.mjs';
import { jobPayloadOf, operationTerminalHandleOf, latestGoal, ownedPathsOf, workDirOf, getWorkflow } from '../api-lib/rows.mjs';
import { PEER_WAIT, leaseCanonOf, openPeerWaits, releaseTypedWaits } from '../api-lib/peers.mjs';
import { hostResourcesFor, HOST_RESOURCES_LOW } from '../../lib/host-resources.mjs';
import { hostThrottle, noteThrottled, releaseThrottled, DISPATCH_THROTTLED } from '../../lib/ram-throttle.mjs';
import { deferredQueueCause } from '../autopilot.mjs';
import { resolveWorkerLaunchModel, missingHostTools, defaultOperationTarget } from '../../agent/models.mjs';
import { kindOrder, isFanOutSlice } from '../../agent/models.mjs';
import { resolveOpParams } from '../../route/dispatch-op.mjs';
import { checkPrerequisites, prerequisiteDetail } from '../prerequisites.mjs';
import { FOUNDATION_WAIT, gateShellFoundation, shellFoundationNeed } from '../shell-foundation.mjs';
import { opInputPaths, recordInputs, workInputPaths } from '../input-digests.mjs';
import { resumeContextOf } from '../resume-context.mjs';
import { jobDisplayName, jobWhat, workflowNameOf } from '../../lib/display-names.mjs';
import { productLocaleFor } from '../product-locale.mjs';
import { isSeamCut, seamStubForDispatch, cutManifestOf } from '../cut-seam.mjs';
import { kernelOverrideFor, refuseSettleBacklog } from '../kernel-authority.mjs';
import { jobDirOf } from '../job-artifacts.mjs';
import { packetFileOf } from '../task-spec.mjs';
import { ENV_GATED_OPS } from '../verify-failure.mjs';
import { bindGuardTerminal } from '../../guards/install.mjs';

export default {
  verb: 'dispatch',
  required: ['job'],
  kernelOnly: true,
  usageInCore: true,
  run({ ledger, args, repo, emit, internals }) {
    const { skillRoot, SETTLED, opSlotAdmission, queuedSeamsOf, observeOperationWorker, openOwnerGates, ownerGateOf, refuseStaleKernelRev, latestGraphNodesOf, deferQueuedTestLeg, refuseKernelBias, providerHealthOf, circuitClearHint, resolveModel, buildPacket, bestEffort, rejectDispatch, DISPATCH_LEASE_TTL_MS, opLeaseRequests, livePathLeaseWait, reserveOpLeases, envServicesOf, environmentPreStep, raiseEnvironmentIncident, opGuardLaunch } = internals;

  const db = ledger.db, jobId = args.job;
  // Dispatch never re-decides the route; a Kernel's --prefer/--avoid is an unknown option here as on api route.
  refuseKernelBias('dispatch', args);
  const job = db.prepare('SELECT * FROM jobs WHERE job_id=?').get(jobId);
  if (!job) throw Object.assign(new Error(`unknown job ${jobId}`), { code: 'job-unknown' });
  if (SETTLED.includes(job.status)) throw Object.assign(new Error(`job ${jobId} is already settled (${job.status})`), { code: 'job-settled' });
  // Only a queued or ready job launches (ready: a launch refused before its op took the contract, H13); a cancelled,
  // leased, running or settled one never does (H9).
  if (!['queued', 'ready'].includes(job.status)) throw Object.assign(new Error(`job ${jobId} cannot dispatch while ${job.status}; settle/reconcile the current worker first`), { code: 'job-not-queued' });
  // A paused, stopped, finished or archived workflow launches nothing (H9: an archived workflow's job ran 25 h).
  requirePhase(getWorkflow(db, job.workflow_id), DISPATCHES, 'dispatch');
  // SETTLE-FIRST (driver-loop.yaml progress.settleFirst): no new dispatch while filed reports wait unconsumed.
  refuseSettleBacklog(db, job.workflow_id, 'dispatch');
  const priorWorker = operationTerminalHandleOf(job) ? observeOperationWorker(job) : null;
  if (priorWorker?.connected && priorWorker?.writable) {
    throw Object.assign(new Error(`job ${jobId} is queued in the ledger but exact worker ${priorWorker.terminalHandle} is still live; reconcile it instead of dispatching a duplicate`), {
      code: 'job-live-worker', worker: priorWorker,
    });
  }
  const payload = jobPayloadOf(job);
  const op = job.op_id ?? payload.opId;
  if (!op) throw Object.assign(new Error(`job ${jobId} carries no op identity`), { code: 'job-no-op' });
  const dispatchTarget = enqueueRepository({ op, repository: payload.repository, ownedPaths: ownedPathsOf(payload), repo });
  if (!dispatchTarget.ok) {
    const out = { ok: false, jobId, op, reason: dispatchTarget.reason, detail: dispatchTarget.detail };
    emit(out, `dispatch REFUSED for ${jobId} (${op}): ${out.reason} — ${out.detail}`, args.json);
    process.exit(1);
  }
  // The grant is re-judged at launch: the tree may have moved since enqueue.
  {
    const grant = checkGrantParents({ op, payload: { ...payload, repository: payload.repository ?? dispatchTarget.repository ?? undefined }, ownedPaths: ownedPathsOf(payload), repo });
    if (!grant.ok) {
      const out = { ok: false, jobId, op, reason: grant.reason, violations: grant.violations.map(({ owned, dir, closest }) => ({ owned, dir, closest })), detail: grant.detail };
      emit(out, `dispatch REFUSED for ${jobId} (${op}): ${out.reason} — ${out.detail}; job stays queued`, args.json);
      process.exit(1);
    }
  }
  if (!payload.repository && dispatchTarget.repository) {
    payload.repository = dispatchTarget.repository;
    ledger.transaction((tx) => updateJob(tx, { jobId, payload }));
  }
  if (deferQueuedTestLeg(ledger, { job, op, payload, via: 'dispatch', args })) return;
  refuseStaleKernelRev(db, job.workflow_id, op, 'dispatch');

  // Concurrency admission, before the packet and before any Orca call: the
  // workflow may hold min(budgets.maxOps, maxParallelOps) operations at once
  // and a job above that line stays queued rather than launching
  // (engine/admission.mjs admitOpSlot). Pool maxParallel is a separate fence
  // route already applies; this one is the workflow's own ceiling.
  // A wait whose typed --until-* conditions already hold is released before the gates below read it.
  releaseTypedWaits(ledger, { repo, workflowId: job.workflow_id });
  const heldBy = ownerGateOf(openOwnerGates(db, job.workflow_id), job);
  if (heldBy) {
    const out = { ok: false, jobId, op, reason: heldBy.kind ?? 'owner-gate', incident: heldBy.incidentId };
    emit(out, `dispatch REFUSED for ${jobId} (${op}): ${heldBy.kind ?? 'owner-gate'} — incident ${heldBy.incidentId} holds it until the Kernel resolves it; job stays queued`, args.json);
    process.exit(1);
  }
  // Autopilot: a deferred leg, or a live proof waiting for the handover credential checklist, is not launched.
  const deferredBy = deferredQueueCause(db, job);
  if (deferredBy) {
    const out = { ok: false, jobId, op, reason: deferredBy.queuedBecause, blockedBy: deferredBy.blockedBy, detail: deferredBy.detail };
    emit(out, `dispatch REFUSED for ${jobId} (${op}): ${deferredBy.queuedBecause} — ${deferredBy.detail}; job stays queued`, args.json);
    process.exit(1);
  }
  const peerHeldBy = ownerGateOf(openPeerWaits(db, job.workflow_id), job);
  if (peerHeldBy) {
    const out = { ok: false, jobId, op, reason: PEER_WAIT, incident: peerHeldBy.incidentId, peer: peerHeldBy.peer };
    emit(out, `dispatch REFUSED for ${jobId} (${op}): peer-wait — incident ${peerHeldBy.incidentId} holds it until peer ${peerHeldBy.peer} lands what it waits on and the wait is resolved; job stays queued`, args.json);
    process.exit(1);
  }
  const slots = opSlotAdmission(db, job.workflow_id, { excludeJobId: jobId });
  if (!slots.ok) {
    const out = { ok: false, jobId, op, reason: 'max-ops', slots };
    emit(out, `dispatch REFUSED for ${jobId} (${op}): max-ops — ${slots.running} operation(s) already hold a slot at ceiling ${slots.ceiling} (${slots.ceilingSource}); job stays queued`, args.json);
    process.exit(1);
  }
  // Seam priority (cut-seam.mjs): the workflow's last free slot goes to a queued cut seam nothing else
  // holds, never to other work, so a seam is not starved behind its own siblings and peers.
  const seamFirst = slots.ceiling != null && slots.ceiling - slots.running <= 1 && !isSeamCut(payload.cut)
    ? queuedSeamsOf(db, job.workflow_id).find((seam) => seam.job_id !== jobId) ?? null : null;
  if (seamFirst) {
    const out = { ok: false, jobId, op, reason: 'seam-priority', seam: seamFirst.job_id, slots };
    emit(out, `dispatch REFUSED for ${jobId} (${op}): seam-priority — the last free slot (${slots.running}/${slots.ceiling}) goes to queued cut seam ${seamFirst.job_id} (${seamFirst.op_id}); dispatch it first, then this job`, args.json);
    process.exit(1);
  }
  // A cut sibling dispatched before its seam passed runs on a stub and owes a reconcile (cut-seam.mjs):
  // payload.cut.seamStub rides into the packet (context.cut) and the op prompt.
  if (payload.cut && Number(payload.cut.ordinal) > 1) {
    let seamStub = null;
    try { seamStub = seamStubForDispatch(db, job, { isOwnerWait: (row) => isAwaitingOwner(db, row) }); } catch { seamStub = null; }
    if (seamStub) payload.cut = { ...payload.cut, seamStub };
    else if (payload.cut.seamStub) payload.cut = Object.fromEntries(Object.entries(payload.cut).filter(([key]) => key !== 'seamStub'));
  }

  // Data prerequisites, before the packet and before any Orca call: a record
  // the op must read that the binding names but the repository lacks, or a
  // bound record whose dependsOn is not done where the op requires done. A
  // dispatch that can only end blocked on them is a wasted launch.
  const briefForAdmission = (() => {
    try { return parseYaml(fs.readFileSync(path.join(skillRoot, 'modules', 'ops', 'ops', `${op}.yaml`), 'utf8')); } catch { return null; }
  })();
  const prerequisites = briefForAdmission ? checkPrerequisites({ brief: briefForAdmission, payload, repo }) : { unmet: [], unknown: [] };
  if (prerequisites.unmet.length) {
    const designGate = prerequisites.unmet.find((item) => item.kind === 'design-not-settled');
    const out = { ok: false, jobId, op, reason: 'prerequisite-unmet', ...(designGate ? { code: designGate.code } : {}), unmet: prerequisites.unmet,
      detail: prerequisiteDetail({ op, jobId, unmet: prerequisites.unmet }) };
    emit(out, `dispatch REFUSED for ${jobId} (${op}): prerequisite-unmet — ${out.detail}`, args.json);
    process.exit(1);
  }

  // The layout chain above an interface.draw is one shared foundation (`shell`), never a refusal: a draw starts from a
  // todo shell and unsettled ancestors. The first workflow to find parents to draw claims the foundation and draws them
  // in this op; a live owner elsewhere makes this dispatch wait (foundation-wait) instead of drafting a second shell.
  const shellNeed = briefForAdmission ? shellFoundationNeed({ brief: briefForAdmission, payload, repo }) : null;
  if (shellNeed?.needed) {
    const gate = gateShellFoundation(ledger, { job, need: shellNeed, settings: allocationSettings() });
    if (gate.action === 'wait') {
      const out = { ok: false, jobId, op, reason: FOUNDATION_WAIT, foundation: gate.foundation, owner: gate.owner, detail: gate.detail, ...(gate.decision ? { decision: gate.decision } : {}) };
      emit(out, `dispatch REFUSED for ${jobId} (${op}): ${FOUNDATION_WAIT} — ${gate.detail}${gate.decision ? `; Supervisor Decision Item ${gate.decision} opened (the owner is past its stall limit)` : ''}; job stays queued`, args.json);
      process.exit(1);
    }
  }

  // Environment pre-step, before any Orca call: a walk on a served stack (uat.verify, uat.assisted.verify,
  // e2e.verify) first proves the environment its records reference is up - probes, health-endpoint
  // discovery, a restart of the servers the runtime knows how to start - so a dead server is an
  // environment fact on the packet, never a red walk blamed on the product (scripts/uat/env-health.mjs).
  // A port held by a process that is not this workspace's server is the one state no op can fix: the job
  // stays queued behind an [environment] incident. `--env-gate off` (or STARCI_ENV_GATE=off) skips it.
  let environmentHealth = null;
  if (ENV_GATED_OPS.includes(op) && args['env-gate'] !== 'off' && process.env.STARCI_ENV_GATE !== 'off') {
    environmentHealth = environmentPreStep(repo, payload);
    if (environmentHealth?.declared) {
      ledger.transaction(() => ledger.appendEvent({ workflowId: job.workflow_id, entityType: 'job', entityId: jobId, kind: 'environment-checked',
        payload: { op, ready: environmentHealth.ready, hardBlock: environmentHealth.hardBlock, services: envServicesOf(environmentHealth) } }));
    }
    if (environmentHealth?.hardBlock) {
      const incidentId = raiseEnvironmentIncident(ledger, job, environmentHealth);
      const out = { ok: false, jobId, op, reason: 'environment-not-ready', incident: incidentId, services: envServicesOf(environmentHealth), remedies: environmentHealth.remedies };
      emit(out, `dispatch REFUSED for ${jobId} (${op}): environment-not-ready — ${environmentHealth.remedies.join(' | ')}; incident ${incidentId}. This is the environment, not the product: the job stays queued and costs no attempt; dispatch again once the port is free (or --env-gate off to walk anyway)`, args.json);
      process.exit(1);
    }
  }

  const model = resolveModel(args.model ?? payload.model ?? defaultOperationTarget());
  if (model.error) throw Object.assign(new Error(model.error), { code: 'model-unknown' });
  // Dispatch launches only inside the kind's order at its tier, so strategy kinds run on Claude or Codex alone.
  // A named profile target (gpt-6-sol) counts as its provider's pool.
  const launchOrder = kindOrder({ kind: op, difficulty: payload.difficulty ?? 'medium', fanOut: isFanOutSlice(payload) });
  const allowed = launchOrder.chain ?? [];
  const outsideOrder = allowed.some((p) => p === model.target || launchOrder.rt?.runtimes?.[p]?.provider === model.provider) ? null
    : `${args.model ? '--model' : payload.model ? 'the persisted route' : 'the unrouted default'} ${model.target} is outside ${op}'s ${launchOrder.orderKey ?? '?'} order at ${launchOrder.difficulty ?? '?'} [${allowed.join(', ')}]${launchOrder.error ? ` (${launchOrder.error})` : ''}; ${args.model ? 'dispatch without --model or name a pool of that order' : `re-run api route --job ${jobId}`}. The job stays queued.`;
  const briefAbs = path.join(skillRoot, 'modules', 'ops', 'ops', `${op}.yaml`);
  const briefExists = fs.existsSync(briefAbs);
  const lackingTools = missingHostTools({ pool: { provider: model.provider }, kind: op });

  // The packet's params are the brief's defaults with the overrides enqueue
  // already validated on top — dispatch resolves, it never re-decides.
  const briefDoc = briefForAdmission ?? parseYaml(fs.readFileSync(path.join(skillRoot, 'modules', 'ops', 'ops', `${op}.yaml`), 'utf8'));
  const dispatchParams = resolveOpParams(briefDoc, {}).params;
  for (const [name, value] of Object.entries(payload.params ?? {})) if (Object.hasOwn(briefDoc?.params ?? {}, name)) dispatchParams[name] = value;
  // The workflow worktree (owner decision WFWT, scripts/kernel/workflow-worktree.mjs): Orca created it before the
  // Kernel started, and every op of the workflow launches with `--worktree <it>`; no op gets a tree of its own. Ops on
  // one side (be/ or fe/) run one at a time, across sides together (canDispatchConcurrently): a busy side is the typed
  // wait workflow-side-busy, checked with the other waits below. A workflow with no worktree (an unbound repo, the
  // runtime repo included) is refused below. --worktree overrides the placement.
  const workflowTree = args.worktree ? null : workflowWorktreeOf({ env: process.env }, job.workflow_id);
  // EVERY workflow in a git checkout has its worktree (made before its Kernel started); an op of such a workflow without
  // one is refused, never run on the live checkout where nothing would checkpoint it. A ledger repo in no git checkout
  // has no worktree to make and nothing to checkpoint: its ops run on it. --worktree is the explicit operator placement.
  if (args.spawn && !args.worktree && !workflowTree && workflowAppRepo(repo)) {
    const detail = `workflow ${job.workflow_id} has no workflow worktree in the registry; restart its Kernel (start-workflow creates it through Orca), then dispatch again. The job stays queued.`;
    emit({ ok: false, jobId, op, reason: WORKFLOW_WORKTREE_MISSING, detail }, `dispatch REFUSED for ${jobId} (${op}): ${WORKFLOW_WORKTREE_MISSING} — ${detail}`, args.json);
    process.exit(1);
  }
  const opTreeArgs = workflowTree ? opWorktreeArgs({ env: process.env }, { workflowId: job.workflow_id }) : [];
  const checkoutRoot = args.worktree ?? opTreeArgs[1] ?? repo;
  // The worker starts and works ON its checkout root: the workflow worktree is a git worktree of the app repository,
  // which Orca created and lists under the project. Every owned path is app-relative (target-repo.mjs), so the app root
  // is where they, gate.mjs --root and the app scripts resolve.
  const worktree = checkoutRoot;
  const workerCwd = (() => { const abs = path.resolve(repo, worktree); try { return fs.statSync(abs).isDirectory() ? abs : repo; } catch { return repo; } })();
  const placements = (() => {
    try {
      return ownedPathPlacements({ op, payload, ownedPaths: ownedPathsOf(payload), repo, worktree: checkoutRoot, timeoutMs: allocationMs('settleGit.commandMs') });
    } catch { return []; }
  })();
  // The asks this job's retry lineage already had answered ride in the packet, so an owner-answer
  // retry applies the answer instead of asking again (scripts/kernel/owner-answers.mjs).
  const ownerAnswers = (() => { try { return ownerAnswersOf(db, job); } catch { return []; } })();
  const boundGoal = payload.goal_binding?.revision != null
    ? db.prepare('SELECT * FROM goals WHERE workflow_id=? AND revision=?').get(job.workflow_id, payload.goal_binding.revision) ?? null : null;
  const packet = buildPacket({ job: { ...job, op_id: op }, payload, model, goal: latestGoal(db, job.workflow_id), params: dispatchParams, placements, productLocale: productLocaleFor(repo), ownerAnswers, boundGoal });
  if (environmentHealth?.declared) packet.context.environment = { ready: environmentHealth.ready, checkedAt: environmentHealth.at, services: envServicesOf(environmentHealth), remedies: environmentHealth.remedies };
  if (payload.repairFor) packet.context.repair_for = payload.repairFor;
  if (workflowTree) packet.context.workflow_worktree = { repo: workflowTree.repoRoot, path: workflowTree.path, branch: workflowTree.branch, checkpoint: workflowTree.checkpoint ?? null, side: sideOf(payload) };
  // The cut manifest the brief binds before the first edit (cut-seam.mjs cutManifestOf): every ordinal's paths and
  // status, the path union and the passed ordinals, read from the ledger now. Packet-only: never persisted on the job.
  if (packet.context.cut) { let manifest = null; try { manifest = cutManifestOf(db, { workflowId: job.workflow_id, op, cut: payload.cut, ownJobId: jobId }); } catch { manifest = null; } if (manifest) packet.context.cut = { ...packet.context.cut, manifest }; }
  // The Kernel's local, additive override of this op (api op-override, graph-edit params/continue, redesign).
  { const ko = kernelOverrideFor(db, job.workflow_id, op, payload); if (ko) packet.context.kernel_override = ko; }
  // The retry of a worker that died without a report resumes from what it left (scripts/kernel/resume-context.mjs).
  const resumeFrom = bestEffort(() => resumeContextOf(db, job));
  if (resumeFrom?.of) packet.context.resume_from = resumeFrom;
  // grammarContext: required rides the grammar sources in the packet; a missing one refuses the spawn
  // (scripts/kernel/grammar-context.mjs).
  const grammarContext = grammarContextRequired(briefDoc) ? resolveGrammarContext({ skillRoot, repo, inputs: grammarInputsOf(briefDoc) }) : null;
  if (grammarContext) packet.context.grammar = { family: grammarContext.family, sources: grammarContext.sources };
  const grammarMissing = grammarContext?.missing.length ? grammarMissingDetail(grammarContext.missing) : null;
  // The law inputs this attempt binds, digested now so survey/status can say
  // when one changed under a settled result (scripts/kernel/input-digests.mjs).
  // A digest failure records nothing rather than refusing the dispatch.
  // Source paths are judged against this admission; the product Work records the packet binds
  // (payload.records) are re-baselined when the job settles.
  const inputs = (() => {
    try {
      return recordInputs(skillRoot, opInputPaths(briefDoc, { params: dispatchParams }), undefined,
        { repo, workPaths: workInputPaths(payload), workDir: workDirOf(repo) });
    } catch { return null; }
  })();
  // The red checks of this job's own retry lineage - for a cut ordinal its own
  // ordinal, never a sibling slice (scripts/kernel/prior-failures.mjs).
  // plus the Supervisor's lessons whose signature names one of those checks (scripts/supervisor/lessons-file.mjs).
  const priorFailures = withLessons(priorAttemptFailures(db, { ...job, op_id: op }), { root: skillRoot });
  // The job scratch (a3-3 evidence contract): the op writes its report and attachments there and api report reads them
  // only from op_attempts.scratch_dir / STARCI_JOB_SCRATCH. Created fresh right before the launch.
  const scratchDir = repo ? jobScratchDirOf(repo, job.workflow_id, jobId) : null;
  const prompt = buildOpPrompt({ skillRoot, packet, jobId, repo, priorFailures, cwd: workerCwd, scratchDir }) + workflowWorktreePromptRules(workflowTree);
  const packetFile = repo ? packetFileOf(jobDirOf(repo, job.workflow_id, jobId), job.try_no) : null;
  // The names a person reads (owner request 2026-09-27, scripts/lib/display-names.mjs): the Task display
  // name, the managed worker's tab (terminal-rename after dispatch-show) and the command terminal's title
  // are all `[Op] <op label> · <what> · <workflow name>`. Left untitled, a terminal shows the provider's
  // own auto-summary ("devin.exe: Kernel orchestration for…"). op_id and job_id stay the keys.
  const opWhat = jobWhat({ payload, op, nodes: latestGraphNodesOf(db, job.workflow_id), repo });
  const terminalTitle = `[Op] ${jobDisplayName({ op, what: opWhat, workflowName: workflowNameOf(db, job.workflow_id) })}`;
  const title = terminalTitle;
  // The one launch (contract-changes/launch-through-worker-start.yaml): the Task, then worker-start --agent on the
  // op's own worktree. The launch model is the persisted route's, else the pool's pin at the kind's tier, else the
  // profile's requestedModel (resolveWorkerLaunchModel); a card that takes no model flag (devin) starts on its default.
  const launchModel = resolveWorkerLaunchModel({ target: model.target, requestedModel: model.requestedModel,
    payload: { ...payload, difficulty: launchOrder.difficulty ?? payload.difficulty } });
  const orcaCommands = [
    { step: 'run', argv: ['orchestration', 'run-create', '--objective', `[Workflow] ${workflowNameOf(db, job.workflow_id)} — ${job.workflow_id}`, '--from', '<kernel-terminal>', '--json'], note: 'created once per workflow by the Kernel; later operations reuse it' },
    { step: 'task', argv: ['orchestration', 'task-create', '--run', '<workflow-run-id>', '--task-title', `${op} #${job.try_no}`, '--display-name', title, '--spec', '<prompt>', '--from', '<kernel-terminal>', '--json'] },
    { step: 'worker-start', argv: ['orchestration', 'worker-start', '--task', '<task-id>', '--worktree', checkoutRoot, '--agent', model.provider ?? '<agent>',
      ...(launchModel.modelId ? ['--model', launchModel.modelId, ...(launchModel.effort ? ['--effort', launchModel.effort] : [])] : []), '--display-name', title, '--run', '<workflow-run-id>', '--from', '<kernel-terminal>', '--json'] },
    { step: 'assignee', argv: ['orchestration', 'dispatch-show', '--task', '<task-id>', '--from', '<kernel-terminal>', '--json'] },
    { step: 'title', argv: ['terminal', 'rename', '--terminal', '<assignee>', '--title', title, '--json'] },
    { step: 'attest', argv: ['orchestration', 'worker-show', '--dispatch', '<dispatch-id>', '--json'], note: 'effective agent/model must equal the route' },
  ];

  if (!args.spawn) {
    const out = {
      ok: true, spawned: false, jobId, packet, prompt,
      leases: opLeaseRequests(payload, leaseCanonOf(db, repo), op),
      launch: launchModel.error ? { agent: model.provider, error: `${model.target} has no launch model: ${launchModel.error}` }
        : { agent: model.provider, model: launchModel.modelId, effort: launchModel.effort ?? null, modelSource: launchModel.source },
      orca: { worktree: checkoutRoot, title, profile: model.profile, commands: orcaCommands.map((c) => ({ step: c.step, cli: `orca ${c.argv.join(' ')}`, note: c.note })) },
      ...(briefExists ? {} : { briefMissing: `modules/ops/ops/${op}.yaml not present — spawn will refuse` }),
      ...(lackingTools.length ? { toolUnavailable: `${model.target} lacks host tool ${lackingTools.join(', ')} — spawn will refuse tool-unavailable` } : {}),
      ...(outsideOrder ? { modelOutsideOrder: outsideOrder } : {}),
      ...(grammarMissing ? { grammarContextMissing: `${grammarMissing} — spawn will refuse grammar-context-missing` } : {}),
    };
    emit(out, [
      `PACKET job=${jobId} op=${op} model=${model.target}`,
      `  brief: ${packet.brief}${briefExists ? '' : ' — MISSING ON DISK'}`,
      `  records: ${packet.context.records.join(', ') || '(none)'}`,
      ...(packet.context.grammar ? [`  grammar (${packet.context.grammar.family ?? 'unset'}): ${packet.context.grammar.sources.map((s) => s.path).join(', ')}`] : []),
      ...(grammarMissing ? [`  grammar MISSING: ${grammarMissing}`] : []),
      ...(packet.context.cut ? [`  cut: ${packet.context.cut.id} ${packet.context.cut.ordinal}/${packet.context.cut.total}`] : []),
      ...(packet.context.owner_answers ? [`  owner_answers: ${packet.context.owner_answers.map((a) => `${a.dispatchId} -> ${a.chosen?.label ?? a.chosen?.index ?? 'answered'} (${a.answeredBy})`).join(', ')}`] : []),
      `  owned_paths: ${packet.context.owned_paths.map((p) => renderOwnedPath(p, workerCwd)).join(', ') || '(none)'}`,
      `  launch: ${out.launch.error ?? `worker-start --agent ${out.launch.agent} --model ${out.launch.model} (${out.launch.modelSource})`}`,
      '  orca commands:', ...out.orca.commands.map((c) => `    $ ${c.cli}`),
      '  (dry run — pass --spawn to launch)',
    ].join('\n'), args.json);
    return;
  }

  if (!briefExists) throw Object.assign(new Error(`spawn refused — no brief at modules/ops/ops/${op}.yaml`), { code: 'brief-missing' });
  if (outsideOrder) {
    emit({ ok: false, jobId, op, reason: 'model-outside-order', model: model.target, order: launchOrder.orderKey ?? null,
      difficulty: launchOrder.difficulty ?? null, allowed, detail: outsideOrder }, `dispatch REFUSED for ${jobId} (${op}): model-outside-order — ${outsideOrder}`, args.json);
    process.exit(1);
  }
  // A route persisted before host tools gated routing, an unrouted job's
  // default pool or a --model override can name an agent without a tool the op
  // cannot run without. That launch is a wasted dispatch; nothing is reserved.
  if (lackingTools.length) {
    const detail = `${model.target} (agent ${model.provider}) lacks host tool ${lackingTools.join(', ')} that ${op} requires (route.riskHints host-tool-required on modules/ops/ops/${op}.yaml). Re-run api route --job ${jobId} — it now selects only agents whose card lists the tool — then dispatch again${args.model ? ' without --model' : ''}. The job stays queued.`;
    emit({ ok: false, jobId, op, reason: 'tool-unavailable', tools: lackingTools, model: model.target, detail },
      `dispatch REFUSED for ${jobId} (${op}): tool-unavailable — ${detail}`, args.json);
    process.exit(1);
  }
  if (grammarMissing) {
    const detail = `${op} declares grammarContext: required and ${grammarMissing}. Fix the product's brand.sources or the Source knowledge, then dispatch again. The job stays queued.`;
    emit({ ok: false, jobId, op, reason: 'grammar-context-missing', missing: grammarContext.missing, detail },
      `dispatch REFUSED for ${jobId} (${op}): grammar-context-missing — ${detail}`, args.json);
    process.exit(1);
  }
  // A live lease on the write set is a wait (livePathLeaseWait), checked before the provider circuit,
  // the leases and any Orca call: nothing is spawned, nothing is recorded as a rejection.
  const leaseWait = livePathLeaseWait(db, job, payload, { repo });
  if (leaseWait) {
    emit({ ok: false, jobId, op, reason: 'path-lease', waiting: true, ...leaseWait },
      `dispatch WAITING for ${jobId} (${op}): path-lease — ${leaseWait.detail}`, args.json);
    process.exit(1);
  }
  // A busy side of the workflow worktree is the next wait (a path conflict above is the more precise answer).
  const sideWait = workflowTree ? workflowSideWait(db, job, payload) : null;
  if (sideWait) {
    emit({ ok: false, jobId, op, waiting: true, ...sideWait },
      `dispatch WAITING for ${jobId} (${op}): ${sideWait.reason} — ${sideWait.detail}`, args.json);
    process.exit(1);
  }
  // Host resources are a launch gate on the same admission path as the provider circuit, checked before
  // it, the leases and any Orca call. Disk below allocation.resources.minFreeDiskGb never spawns another
  // worker (scripts/lib/host-resources.mjs). RAM and CPU go through the RAM-aware, priority-aware throttle
  // (scripts/lib/ram-throttle.mjs, owner ruling 2026-09-28): the effective cap min(maxParallelOps, what fits
  // in free RAM) across every ledger of the host, heavy ops paused below minFreeRamPct (the top-priority
  // workflow's still start while they fit, until critical), every op sized by its RAM estimate. Both are a
  // typed wait like path-lease - nothing is recorded as a rejection, a dispatch-throttled event carries the
  // numbers - and each dispatch re-probes, so the job reads ready again on its own once there is room.
  const host = hostResourcesFor({ env: process.env, repo });
  const fmtNum = (n) => (typeof n === 'number' && Number.isFinite(n) ? n.toFixed(1) : '?');
  const throttle = host.lowDisk ? null : (() => {
    try { return hostThrottle({ op, workflowId: job.workflow_id, env: process.env, repo, db, ledgerFile: ledger.path ?? null }); }
    catch (error) { return { error: String(error?.message ?? error) }; }
  })();
  const admission = throttle?.admission ?? null;
  if (host.lowDisk || (admission && !admission.ok)) {
    const parts = [];
    if (host.lowDisk) parts.push(`drive ${host.drive ?? '?'} has ${fmtNum(host.freeDiskGb)} GB free (below allocation.resources.minFreeDiskGb ${host.thresholds?.minFreeDiskGb ?? '?'} GB)`);
    if (admission && !admission.ok) parts.push(`RAM ${fmtNum(host.freeRamPct)}% free, effective cap ${admission.effectiveCap ?? '-'}/${admission.maxParallelOps ?? '-'} (${admission.running} running): ${admission.reason} - ${admission.detail}`);
    const detail = `${parts.join('; ')}; the job stays queued and reads ready once there is room again - do not re-dispatch it by hand`;
    const throttled = admission && !admission.ok ? {
      reason: admission.reason, op, class: admission.class, estimateMb: admission.estimateMb, estimateSource: admission.estimateSource,
      mode: throttle.mode, modeWhy: throttle.modeWhy, freeRamPct: Math.round(Number(host.freeRamPct ?? 0) * 10) / 10, cpuBusy: throttle.cpuBusy,
      totalRamGb: Math.round(Number(host.totalRamBytes ?? 0) / 1e8) / 10, headroomMb: admission.headroomMb, reserveMb: admission.reserveMb,
      running: admission.running, effectiveCap: admission.effectiveCap, heavyCap: admission.heavyCap, maxParallelOps: admission.maxParallelOps,
      priority: admission.priority,
    } : null;
    if (throttled) {
      try { ledger.transaction(() => ledger.appendEvent({ workflowId: job.workflow_id, entityType: 'job', entityId: jobId, kind: DISPATCH_THROTTLED, payload: throttled })); } catch { /* the wait stands without its event */ }
      if (!throttle.testContext) noteThrottled({ jobId, workflowId: job.workflow_id, ledgerId: ledger.ledgerId ?? null, reason: admission.reason });
    }
    emit({ ok: false, jobId, op, reason: HOST_RESOURCES_LOW, waiting: true, host: { ...host, lowRam: host.lowRam || Boolean(throttled) }, ...(throttled ? { throttle: throttled } : {}), detail },
      `dispatch WAITING for ${jobId} (${op}): ${HOST_RESOURCES_LOW} - ${detail}`, args.json);
    process.exit(1);
  }
  if (admission?.ok) releaseThrottled({ jobId, ledgerId: ledger.ledgerId ?? null });
  // A route decision may have been persisted before another job proves the
  // shared provider credential is dead. Re-check the durable provider circuit
  // before taking leases or creating an Orca Task so an already-routed sibling
  // pool cannot slip through the circuit.
  const providerHealth = providerHealthOf(db, model.provider);
  if (providerHealth) {
    const error = `provider ${providerHealth.failureKind ?? 'auth'} unavailable (${providerHealth.provider}); circuit open until ${providerHealth.expiresAt ?? 'explicit recovery'}`;
    const rejection = rejectDispatch(ledger, job, jobId, op, model, {
      step: 'provider-health', error, effectState: 'none', details: providerHealth,
      providerHealthEvidence: providerHealth,
    });
    emit({ ok: false, jobId, rejected: 'dispatch-rejected', packet, rejection, providerHealth },
      `dispatch REJECTED for ${jobId} (provider-health): ${error}; logical attempt retained${circuitClearHint(providerHealth)}`, args.json);
    process.exit(1);
  }
  // §6 admission — the repo-path leases and the job's fencing token are taken
  // BEFORE anything launches, for both launch kinds. A refusal (a live lease
  // already owns a path, or the machine arbiter can't open) is a dispatch
  // rejection: the worker must never be what discovers the write set was
  // already taken, and an unfenced dispatch is exactly what this layer kills.
  const leaseTtlMs = Number(args['lease-ttl'] ?? payload.leaseTtlMs ?? 0) || DISPATCH_LEASE_TTL_MS;
  let reserve;
  try {
    reserve = reserveOpLeases(ledger, job, payload, { ttlMs: leaseTtlMs, repo });
  } catch (e) {
    // Identity/status refusal (job already leased/running, or row drift): the
    // job is left untouched — an operator error, not a dispatch rejection.
    const error = String(e?.message ?? e);
    emit({ ok: false, jobId, refused: 'reserve-failed', error }, `dispatch REFUSED for ${jobId}: ${error}`, args.json);
    process.exit(1);
  }
  if (!reserve.ok) {
    const reason = (reserve.reasons ?? [reserve.reason]).filter(Boolean).join('; ') || 'reservation refused';
    // A holder that took the lease between the pre-check and reserve is the same wait. Only when every
    // refusal reason is about a conflicting path (the overlap, or the capacity-1 row it fills) — a
    // missing capacity or the machine arbiter is still a rejection.
    const conflictKeys = new Set((reserve.pathConflicts ?? []).flatMap((c) => [c.requested, c.held]));
    const pathOnly = (reserve.reasons ?? []).length > 0 && reserve.reasons.every((r) => /overlaps durable lease/.test(r)
      || [...conflictKeys].some((key) => r.startsWith(`resource ${key} capacity `)));
    const raceWait = pathOnly ? livePathLeaseWait(db, job, payload, { conflicts: reserve.pathConflicts }) : null;
    if (raceWait) {
      emit({ ok: false, jobId, op, reason: 'path-lease', waiting: true, ...raceWait },
        `dispatch WAITING for ${jobId} (${op}): path-lease — ${raceWait.detail}`, args.json);
      process.exit(1);
    }
    const rejection = rejectDispatch(ledger, job, jobId, op, model, { step: 'reserve', error: reason });
    emit({ ok: false, jobId, rejected: 'dispatch-rejected', packet, reserve, rejection },
      `dispatch REJECTED for ${jobId} (reserve): ${reason} — job status=${rejection.status}`, args.json);
    process.exit(1);
  }
  if (scratchDir) ensureJobScratch({ repo, workflowId: job.workflow_id, jobId });
  // worker-start owns the agent's environment, so no shim reaches it; the history hook in its checkouts does, finding
  // the op by its bound Orca terminal (scripts/guards/install.mjs bindGuardTerminal).
  const guard = opGuardLaunch({ job, jobId, repo, placements, workerCwd, workflowWorktree: workflowTree?.path ?? null });
  return cmdDispatchManaged(ledger, args, { job, jobId, payload, op, model, packet, prompt, packetFile, worktree, checkoutRoot, title, reserve, inputs, guard, launchModel, scratchDir }, internals, emit);
  },
};

function cmdDispatchManaged(ledger, args, { job, jobId, payload, op, model, packet, prompt, packetFile = null, worktree, checkoutRoot = worktree, title, reserve, inputs = null, guard = null, launchModel, scratchDir = null }, internals, emit) {
  const { cleanupManagedWorker, rejectDispatch, ensureWorkflowRun, createOperationTask, recordLaunchTerminal, skillRoot, AGENT_HIERARCHY_SCHEMA, operationNodeId, kernelNodeId, buildContractMarkdown, fileContract } = internals;
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
    emit(out, `dispatch REJECTED for ${jobId} (${step}): ${reason} — job status=${rejection.status}, effect=${effectState}${cleanup ? `, worker ${dispatchId} cleanup stop=${cleanup.stop?.ok} release=${cleanup.release?.ok}` : ''}`, args.json);
    process.exit(1);
  };

  // 1. Launch model (resolveWorkerLaunchModel, resolved with the launch plan).
  if (launchModel.error) return reject({ step: 'route', error: `${model.target} has no launch model: ${launchModel.error}` });
  const modelId = launchModel.modelId;
  const effort = launchModel.effort ?? null;

  // 2. Run id — one workflow Run, with the Kernel terminal as coordinator.
  const run = ensureWorkflowRun(ledger, { job, jobId, payload });
  if (!run.ok) return reject({ step: 'run-create', error: run.error });
  const { runId, kernelHandle } = run;
  // 2b. Depth (contract change worker-depth-limit): the op nests under its Kernel's Dispatch; one deeper than
  // config.yaml orca.maxWorkerDepth is refused worker-depth-exceeded before its Task exists (no try spent).
  const preflight = depthPreflight({ parentDispatch: run.kernelPayload?.managed?.dispatchId ?? null });
  if (preflight.refusal) return reject({ step: 'depth', code: preflight.refusal.code, error: preflight.refusal.error });

  // 3. Task — the operation's contract. The spec is the rendered packet prompt.
  const task = createOperationTask({ runId, prompt, op, title, attempt: job.try_no, kernelHandle, jobId, packetFile });
  if (!task?.ok || !task.taskId) {
    return reject({ step: 'task-create', error: task?.error ?? 'task-create returned no taskId' });
  }
  const taskId = task.taskId;

  // 4-6. The one agent launch (scripts/agent/lib.mjs spawnAgent): pre-trust, worker-start --agent on the op's worktree,
  // the exact assignee (dispatch-show, never a second orchestration dispatch), its [Op] title, and the attestation
  // that the worker's EFFECTIVE agent/model equal the route - a mismatch is a provider-side defect, rejected with the
  // typed infra-provider incident.
  const launched = spawnAgent({ provider: model.provider, model: modelId, effort, worktree: checkoutRoot, title, task: taskId, run: runId, from: kernelHandle, preflight,
    onCreated: (handle) => recordLaunchTerminal(ledger, jobId, handle), io: { cleanup: cleanupManagedWorker } });
  trust = launched.trust ?? null;
  if (!launched.ok) {
    return reject({ step: launched.step, dispatchId: launched.dispatchId, incident: launched.incident === true,
      ...(launched.step === 'attestation' ? { signal: launched.error } : { error: launched.error }),
      effectState: launched.effectState, observation: launched.observation ?? null, cleanup: launched.cleanup ?? null, details: launched.details ?? null });
  }
  const dispatchId = launched.dispatchId;
  // The op's guard, keyed by the terminal Orca exports as ORCA_TERMINAL_HANDLE (scripts/guards/install.mjs bindGuardTerminal).
  if (guard?.receipt && typeof guard.receipt.jobFile === 'string') {
    try { guard.receipt.terminal = bindGuardTerminal({ skillRoot, handle: launched.terminal, jobFile: guard.receipt.jobFile }); }
    catch (e) { guard.receipt.terminal = { error: String(e?.message ?? e) }; }
  }

  // 7. Running — worker_id is the Dispatch id (managed workers have no
  // command-terminal handle); payload.managed carries the Orca ids settle needs.
  payload.managed = { runId, taskId, dispatchId, agentTerminalHandle: launched.terminal,
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
    ...(payload.hierarchy.runtime ?? {}), host: 'orca',
    agent: model.provider, provider: model.provider, model: modelId,
    profile: model.target, runtimePool: model.target,
    runId, taskId, dispatchId, terminalHandle: launched.terminal,
  };
  const contractMarkdown = buildContractMarkdown({ op, jobId, prompt, packet });
  let attemptId = null;
  runningOrAbandon(() => ledger.transaction(() => {
    const now = Date.now();
    // The attempt and its contract (the dispatch authority; dispatch_id is the worker's Dispatch id), then running.
    transitionWorkflowToRunning(ledger, { workflowId: job.workflow_id, now, by: 'kernel', reason: `first dispatch ${jobId}` });
    attemptId = fileContract(db, {
      job, op, dispatchId, markdown: contractMarkdown, now,
      attempt: { scratchDir, managed: 1, runId, taskId, terminalHandle: launched.terminal, provider: model.provider, model: modelId, effort, modelProfile: model.target, pool: model.target, worktreePath: worktree, startedAt: now, attestedAt: now },
      context: { packet, worktree, model: model.target, managed: payload.managed, hierarchy: payload.hierarchy, lease: { token: reserve.leaseToken, expiresAt: reserve.expiresAt, fencing: reserve.fencing }, inputs },
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
