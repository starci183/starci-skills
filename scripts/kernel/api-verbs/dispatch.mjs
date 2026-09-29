// api dispatch: admit and launch an operation from its persisted route.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { transitionWorkflowToRunning, setJobStatus, updateAttempt, updateJob } from '../../../engine/ledger-db.mjs';
import { parseYaml } from '../../../engine/yaml.mjs';
import { admitOpSlot } from '../../../engine/admission.mjs';
import { allocationMs } from '../../../engine/config.mjs';
import { buildOpPrompt, renderOwnedPath, ensureJobScratch, jobScratchDirOf } from '../op-prompt.mjs';
import { priorAttemptFailures } from '../prior-failures.mjs';
import { withLessons } from '../../supervisor/lessons-file.mjs';
import { ownerAnswersOf } from '../owner-answers.mjs';
import { isAwaitingOwner } from '../failure-steps.mjs';
import { enqueueRepository, ownedPathPlacements, projectBinding } from '../target-repo.mjs';
import { ensureOpWorktree, layoutOf as productLayoutOf, planIsolation, worktreePromptRules } from '../product-worktree.mjs';
import { grammarContextRequired, grammarInputsOf, resolveGrammarContext, grammarMissingDetail } from '../grammar-context.mjs';
import { spawnAgent, buildSpawnCommand, deliverPrompt, cleanupDeliveryArtifact, awaitSubmission, awaitAttestation } from '../../agent/lib.mjs';
import { jobPayloadOf, operationTerminalHandleOf, latestGoal, ownedPathsOf, workDirOf, getWorkflow } from '../api-lib/rows.mjs';
import { DISPATCHES, requirePhase } from '../api-lib/lifecycle.mjs';
import { PEER_WAIT, leaseCanonOf, openPeerWaits, releaseTypedWaits } from '../api-lib/peers.mjs';
import { hostResourcesFor, HOST_RESOURCES_LOW } from '../../lib/host-resources.mjs';
import { hostThrottle, noteThrottled, releaseThrottled, DISPATCH_THROTTLED } from '../../lib/ram-throttle.mjs';
import { deferredQueueCause } from '../autopilot.mjs';
import { resolveCardLaunchModel, resolveLaunchModel, missingHostTools, defaultOperationTarget } from '../../agent/models.mjs';
import { kindOrder, isFanOutSlice } from '../../agent/models.mjs';
import { resolveOpParams } from '../../route/dispatch-op.mjs';
import { checkPrerequisites, prerequisiteDetail } from '../prerequisites.mjs';
import { opInputPaths, recordInputs, workInputPaths } from '../input-digests.mjs';
import { resumeContextOf } from '../resume-context.mjs';
import { orchDispatch } from '../../api/orca/orch-dispatch.mjs';
import { dispatchShow } from '../../api/orca/dispatch-show.mjs';
import { jobDisplayName, jobWhat, workflowNameOf } from '../../lib/display-names.mjs';
import { productLocaleFor } from '../product-locale.mjs';
import { isSeamCut, seamStubForDispatch, cutManifestOf } from '../cut-seam.mjs';
import { kernelOverrideFor, refuseSettleBacklog } from '../kernel-authority.mjs';
import { jobDirOf } from '../job-artifacts.mjs';
import { packetFileOf } from '../task-spec.mjs';
import { ENV_GATED_OPS } from '../verify-failure.mjs';
import { ensureLaunchTrust } from '../../agent/trust.mjs';
import { workerStart } from '../../api/orca/worker-start.mjs';
import { workerShow } from '../../api/orca/worker-show.mjs';
import { closeOperationTerminal } from '../close-op-terminal.mjs';
import { bindGuardTerminal } from '../../guards/install.mjs';
import { terminalRename } from '../../api/orca/terminal-rename.mjs';

export default {
  verb: 'dispatch',
  required: ['job'],
  kernelOnly: true,
  usageInCore: true,
  run({ ledger, args, repo, emit, internals }) {
    const { skillRoot, SETTLED, opSlotAdmission, queuedSeamsOf, observeOperationWorker, AGENT_HIERARCHY_SCHEMA, kernelNodeId, operationNodeId, openOwnerGates, ownerGateOf, refuseStaleKernelRev, latestGraphNodesOf, deferQueuedTestLeg, kernelBiasIgnored, biasIgnoredText, providerHealthOf, circuitClearHint, resolveModel, buildPacket, bestEffort, rejectDispatch, recordGateAnswers, DISPATCH_LEASE_TTL_MS, opLeaseRequests, livePathLeaseWait, reserveOpLeases, buildContractMarkdown, fileContract, envServicesOf, servingWorktreeOf, environmentPreStep, raiseEnvironmentIncident, MANAGED_KINDS, recordLaunchTerminal, ensureWorkflowRun, createOperationTask, opLaunchEnv, opGuardLaunch } = internals;

  const db = ledger.db, jobId = args.job;
  // Dispatch never re-decides the route; a Kernel's --prefer/--avoid here is ignored like on api route.
  const dispatchBiasIgnored = kernelBiasIgnored(args);
  if (dispatchBiasIgnored) console.error(`api dispatch WARNING: ${biasIgnoredText(dispatchBiasIgnored)}; dispatch launches the persisted route`);
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
  const dispatchSiblings = payload.cut?.id ? db.prepare("SELECT payload_json FROM jobs WHERE workflow_id=? AND op_id=? AND job_id<>? AND json_extract(payload_json,'$.cut.id')=?")
    .all(job.workflow_id, op, jobId, String(payload.cut.id)).map((row) => jobPayloadOf(row).repository).filter(Boolean) : [];
  const dispatchTarget = enqueueRepository({ op, repository: payload.repository, ownedPaths: ownedPathsOf(payload), repo, siblingRepositories: dispatchSiblings });
  if (!dispatchTarget.ok) {
    const out = { ok: false, jobId, op, reason: dispatchTarget.reason, detail: dispatchTarget.detail };
    emit(out, `dispatch REFUSED for ${jobId} (${op}): ${out.reason} — ${out.detail}`, args.json);
    process.exit(1);
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
    const out = { ok: false, jobId, op, reason: 'prerequisite-unmet', unmet: prerequisites.unmet,
      detail: prerequisiteDetail({ op, jobId, unmet: prerequisites.unmet }) };
    emit(out, `dispatch REFUSED for ${jobId} (${op}): prerequisite-unmet — ${out.detail}`, args.json);
    process.exit(1);
  }

  // Environment pre-step, before any Orca call: a walk on a served stack (uat.verify, uat.assisted.verify,
  // e2e.verify) first proves the environment its records reference is up - probes, health-endpoint
  // discovery, a restart of the servers the runtime knows how to start - so a dead server is an
  // environment fact on the packet, never a red walk blamed on the product (scripts/uat/env-health.mjs).
  // A port held by a process that is not this workspace's server is the one state no op can fix: the job
  // stays queued behind an [environment] incident. `--env-gate off` (or STARCI_ENV_GATE=off) skips it.
  let environmentHealth = null;
  if (ENV_GATED_OPS.includes(op) && args['env-gate'] !== 'off' && process.env.STARCI_ENV_GATE !== 'off') {
    const serve = bestEffort(() => servingWorktreeOf(db, job.workflow_id));
    environmentHealth = environmentPreStep(repo, payload, serve?.path ? serve : null);
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
  // Product worktrees (DESIGN §16.7, scripts/kernel/product-worktree.mjs): an op whose policy.isolation is `worktree` and
  // whose owned paths land in ONE bound product repository (not the Work owner) runs in its OWN worktree
  // <repo>/.starciwork/worktrees/<wf>/<op> on op/<op>, off the workflow's integration branch wf/<wf>. Only a --spawn
  // makes it (reused by a requeued attempt; a continuation starts from its predecessor's archived commits).
  const productIsolation = (() => {
    if (args.worktree) return { isolate: false, reason: 'worktree-flag' };
    try {
      const bare = ownedPathPlacements({ op, payload, ownedPaths: ownedPathsOf(payload), repo, worktree: null, timeoutMs: allocationMs('settleGit.commandMs') });
      return planIsolation({ brief: briefDoc, placements: bare, binding: projectBinding(repo) });
    } catch (error) { return { isolate: false, reason: 'plan-error', detail: String(error?.message ?? error).slice(0, 200) }; }
  })();
  if (payload.productWorktree && payload.productWorktree.jobId !== jobId) delete payload.productWorktree; // a retry's copy of its predecessor's
  let productWorktree = null;
  if (productIsolation.isolate && args.spawn) {
    const handFrom = [payload.retry?.retryOf, payload.retry?.resumeOf, payload.kernelEdit?.continuationOf].filter(Boolean);
    const made = ensureOpWorktree({ repoRoot: productIsolation.repoRoot, workflowId: job.workflow_id, jobId, handFrom,
      onEvent: (kind, p) => ledger.transaction(() => ledger.appendEvent({ workflowId: job.workflow_id, entityType: 'job', entityId: jobId, kind, payload: p })) });
    if (!made.ok) {
      const out = { ok: false, jobId, op, reason: 'product-worktree-unavailable', detail: { reason: made.reason, detail: made.detail ?? null, repoRoot: productIsolation.repoRoot } };
      emit(out, `dispatch REFUSED for ${jobId} (${op}): product-worktree-unavailable — ${made.reason}${made.detail ? ` ${JSON.stringify(made.detail).slice(0, 300)}` : ''}; job stays queued`, args.json);
      process.exit(1);
    }
    productWorktree = made.record;
    payload.productWorktree = productWorktree;
    ledger.transaction((tx) => updateJob(tx, { jobId, payload }));
  } else if (productIsolation.isolate) {
    productWorktree = { ...productLayoutOf({ repoRoot: productIsolation.repoRoot, workflowId: job.workflow_id, jobId }), preview: true };
  }
  const worktree = args.worktree ?? productWorktree?.op.path ?? repo;
  // Orca lists terminals only under the worktrees it manages (the repository roots), so an op terminal created ON its
  // product worktree showed under no project (owner-visible, 2026-09-28): the command terminal is created on the product
  // repository's ROOT Orca worktree and its shell changes into the op worktree first (agent/lib.mjs cwdCommand), so it
  // shows under that project while the agent runs in its own tree.
  const orcaWorktree = productWorktree ? productWorktree.repoRoot : worktree;
  const workerCwd = (() => { const abs = path.resolve(repo, worktree); try { return fs.statSync(abs).isDirectory() ? abs : repo; } catch { return repo; } })();
  const placements = (() => {
    try {
      return ownedPathPlacements({ op, payload, ownedPaths: ownedPathsOf(payload), repo, worktree: workerCwd, timeoutMs: allocationMs('settleGit.commandMs') });
    } catch { return []; }
  })();
  // The asks this job's retry lineage already had answered ride in the packet, so an owner-answer
  // retry applies the answer instead of asking again (scripts/kernel/owner-answers.mjs).
  const ownerAnswers = (() => { try { return ownerAnswersOf(db, job); } catch { return []; } })();
  const boundGoal = payload.goal_binding?.revision != null
    ? db.prepare('SELECT * FROM goals WHERE workflow_id=? AND revision=?').get(job.workflow_id, payload.goal_binding.revision) ?? null : null;
  const packet = buildPacket({ job: { ...job, op_id: op }, payload, model, goal: latestGoal(db, job.workflow_id), params: dispatchParams, placements, productLocale: productLocaleFor(repo), ownerAnswers, boundGoal });
  if (environmentHealth?.declared) packet.context.environment = { ready: environmentHealth.ready, checkedAt: environmentHealth.at, services: envServicesOf(environmentHealth), remedies: environmentHealth.remedies,
    ...(environmentHealth.environments?.some((e) => e.servedFrom) ? { servedFrom: environmentHealth.environments.filter((e) => e.servedFrom).map((e) => ({ env: e.id, ...e.servedFrom })) } : {}) };
  if (payload.repairFor) packet.context.repair_for = payload.repairFor;
  if (productWorktree) packet.context.product_worktree = { repo: productWorktree.repoRoot, op: productWorktree.op, workflow: productWorktree.workflow, baseSha: productWorktree.baseSha ?? null, ...(productWorktree.preview ? { preview: true } : {}) };
  else if (productIsolation.reason && productIsolation.reason !== 'policy-shared') packet.context.product_isolation = { isolate: false, reason: productIsolation.reason };
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
  const prompt = buildOpPrompt({ skillRoot, packet, jobId, repo, priorFailures, cwd: workerCwd, scratchDir }) + worktreePromptRules(productWorktree);
  const packetFile = repo ? packetFileOf(jobDirOf(repo, job.workflow_id, jobId), job.try_no) : null;
  // The names a person reads (owner request 2026-09-27, scripts/lib/display-names.mjs): the Task display
  // name, the managed worker's tab (terminal-rename after dispatch-show) and the command terminal's title
  // are all `[Op] <op label> · <what> · <workflow name>`. Left untitled, a terminal shows the provider's
  // own auto-summary ("devin.exe: Kernel orchestration for…"). op_id and job_id stay the keys.
  const opWhat = jobWhat({ payload, op, nodes: latestGraphNodesOf(db, job.workflow_id), repo });
  const terminalTitle = `[Op] ${jobDisplayName({ op, what: opWhat, workflowName: workflowNameOf(db, job.workflow_id) })}`;
  const title = terminalTitle;
  // The composed command is what a spawn would actually run — card env prefix
  // + credential strip + requirements (the --yolo/dangerous flags). Dry-run
  // prints it so reviewers see the injected flags, not just the profile body.
  // A command-terminal profile without a static command (the Codex
  // profiles) is card-composed: the agent card's terminalFallback supplies the
  // binary, modelArgs/effortArgs carry the routed model + effort, and its
  // bypassArgs make the op unattended — the same composition the Kernel
  // terminal boots with (modules/models/agents/codex.yaml).
  const cardLaunch = model.kind === 'command-terminal' && !model.command
    ? resolveCardLaunchModel({ target: model.target, requestedModel: model.requestedModel, payload: { ...payload, difficulty: launchOrder.difficulty ?? payload.difficulty } })
    : null;
  const spawnCmd = model.kind === 'command-terminal'
    ? (cardLaunch?.error
      ? { error: `${model.target} has no launch model: ${cardLaunch.error}` }
      : buildSpawnCommand({ provider: model.provider, command: model.command,
        model: cardLaunch?.modelId ?? null, effort: cardLaunch?.effort ?? null, env: opLaunchEnv(jobId, model.provider) }))
    : null;
  const composedCommand = spawnCmd?.command ?? model.command;
  const orcaCommands = model.kind === 'command-terminal'
    ? [
      { step: 'run', argv: ['orchestration', 'run-create', '--objective', `[Workflow] ${workflowNameOf(db, job.workflow_id)} — ${job.workflow_id}`, '--from', '<kernel-terminal>', '--json'], note: 'created once per workflow; later operations reuse it' },
      { step: 'task', argv: ['orchestration', 'task-create', '--run', '<workflow-run-id>', '--task-title', `${op} #${job.try_no}`, '--display-name', title, '--spec', '<prompt>', '--parent', '<kernel-terminal>', '--from', '<kernel-terminal>', '--json'] },
      { step: 'create', argv: ['terminal', 'create', '--worktree', orcaWorktree, '--title', terminalTitle, '--command', `${orcaWorktree !== worktree ? `Set-Location -LiteralPath '${worktree}'; ` : ''}${composedCommand ?? '<command>'}`, '--json'] },
      { step: 'read', argv: ['terminal', 'read', '--terminal', '<handle>', '--screen', '--json'], note: 'readiness — verify the prompt landed before sending' },
      { step: 'dispatch', argv: ['orchestration', 'dispatch', '--task', '<operation-task-id>', '--to', '<handle>', '--from', '<kernel-terminal>', '--run', '<workflow-run-id>', '--return-preamble', '--json'] },
      { step: 'send', argv: ['terminal', 'send', '--terminal', '<handle>', '--text', '<dispatch-preamble>', '--enter', '--json'] },
    ]
    : [
      { step: 'task', argv: ['orchestration', 'task-create', '--run', '<workflow-run-id>', '--task-title', `${op} #${job.try_no}`, '--display-name', title, '--spec', '<prompt>', '--parent', '<kernel-terminal>', '--from', '<kernel-terminal>', '--json'] },
      ...(orcaWorktree !== worktree ? [
        { step: 'create', argv: ['terminal', 'create', '--worktree', orcaWorktree, '--title', terminalTitle, '--command', `Set-Location -LiteralPath '${worktree}'; <${model.provider ?? 'agent'} launch, routed model>`, '--json'], note: 'a product op worktree is not an Orca worktree: the agent is launched on the repository root so the sidebar lists it' },
        { step: 'worker-start', argv: ['orchestration', 'worker-start', '--task', '<task-id>', '--worktree', orcaWorktree, '--terminal', '<handle>', '--display-name', title, '--run', '<workflow-run-id>', '--from', '<kernel-terminal>', '--json'], note: 'adopts the launched terminal; refused with no effect -> the terminal is closed and worker-start --agent runs in the op worktree' },
      ] : [
        { step: 'worker-start', argv: ['orchestration', 'worker-start', '--task', '<task-id>', '--worktree', worktree, '--agent', model.provider ?? '<agent>', '--model', '<resolved-model-id>', '--display-name', title, '--run', '<workflow-run-id>', '--from', '<kernel-terminal>', '--json'], note: `${model.target} is a managed agent; worker-start owns dispatch/injection and must not be followed by orchestration dispatch` },
      ]),
    ];

  if (!args.spawn) {
    const out = {
      ok: true, spawned: false, jobId, packet, prompt,
      leases: opLeaseRequests(payload, leaseCanonOf(db, repo), op),
      spawnCommand: spawnCmd
        ? { command: spawnCmd.command ?? null, commandSource: spawnCmd.commandSource ?? null,
          ...(cardLaunch && !cardLaunch.error ? { model: cardLaunch.modelId, effort: cardLaunch.effort, modelSource: cardLaunch.source } : {}),
          ...(spawnCmd.error ? { error: spawnCmd.error } : {}) }
        : { command: null, error: `${model.target} is launch kind '${model.kind}' — composed by 'orca orchestration worker-start', not terminal create` },
      orca: { worktree, title, terminalTitle, launchKind: model.kind, profile: model.profile, commands: orcaCommands.map((c) => ({ step: c.step, cli: `orca ${c.argv.join(' ')}`, note: c.note })) },
      ...(briefExists ? {} : { briefMissing: `modules/ops/ops/${op}.yaml not present — spawn will refuse` }),
      ...(lackingTools.length ? { toolUnavailable: `${model.target} lacks host tool ${lackingTools.join(', ')} — spawn will refuse tool-unavailable` } : {}),
      ...(outsideOrder ? { modelOutsideOrder: outsideOrder } : {}),
      ...(grammarMissing ? { grammarContextMissing: `${grammarMissing} — spawn will refuse grammar-context-missing` } : {}),
    };
    emit(out, [
      `PACKET job=${jobId} op=${op} model=${model.target} (${model.kind})`,
      `  brief: ${packet.brief}${briefExists ? '' : ' — MISSING ON DISK'}`,
      `  records: ${packet.context.records.join(', ') || '(none)'}`,
      ...(packet.context.grammar ? [`  grammar (${packet.context.grammar.family ?? 'unset'}): ${packet.context.grammar.sources.map((s) => s.path).join(', ')}`] : []),
      ...(grammarMissing ? [`  grammar MISSING: ${grammarMissing}`] : []),
      ...(packet.context.cut ? [`  cut: ${packet.context.cut.id} ${packet.context.cut.ordinal}/${packet.context.cut.total}`] : []),
      ...(packet.context.owner_answers ? [`  owner_answers: ${packet.context.owner_answers.map((a) => `${a.dispatchId} -> ${a.chosen?.label ?? a.chosen?.index ?? 'answered'} (${a.answeredBy})`).join(', ')}`] : []),
      `  owned_paths: ${packet.context.owned_paths.map((p) => renderOwnedPath(p, workerCwd)).join(', ') || '(none)'}`,
      `  spawn command: ${out.spawnCommand.command ?? `(none — ${out.spawnCommand.error})`}`,
      ...(out.spawnCommand.commandSource ? [`  command source: ${out.spawnCommand.commandSource}`] : []),
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
  // Managed-agent launch (managed-agent / native-managed-agent): the run →
  // task → worker-start → return-preamble → attest pipeline owns this profile.
  if (MANAGED_KINDS.includes(model.kind)) {
    // worker-start owns a managed agent's environment, so no shim reaches it; the
    // history hook in its checkouts does, finding the op by its bound Orca terminal.
    const guard = opGuardLaunch({ job, jobId, repo, placements, workerCwd, shims: false });
    return cmdDispatchManaged(ledger, args, { job, jobId, payload, op, model, packet, prompt, packetFile, worktree, orcaWorktree, title, reserve, inputs, guard, launchDifficulty: launchOrder.difficulty, scratchDir }, internals, emit);
  }
  if (model.kind !== 'command-terminal') {
    throw Object.assign(new Error(`spawn refused: ${model.target} is launch kind '${model.kind}' — use 'orca orchestration worker-start' with a Task id (managed-agent path)`), { code: 'managed-agent' });
  }
  // Command-terminal agents still join the workflow's Orca Run. Create the
  // operation Task first, then create/attest the terminal, dispatch that Task
  // to the exact handle and submit Orca's returned preamble. This gives Qwen,
  // Devin and Codex the same durable Kernel → Task → Dispatch hierarchy as managed
  // workers without pretending Orca owns their process lifecycle.
  if (cardLaunch?.error) {
    const error = `${model.target} has no launch model: ${cardLaunch.error}`;
    rejectDispatch(ledger, job, jobId, op, model, { step: 'route', error });
    emit({ ok: false, jobId, rejected: 'dispatch-rejected', packet, step: 'route', error },
      `dispatch REJECTED for ${jobId} (route): ${error}`, args.json);
    process.exit(1);
  }
  const run = ensureWorkflowRun(ledger, { job, jobId, payload });
  if (!run.ok) {
    rejectDispatch(ledger, job, jobId, op, model, { step: 'run-create', error: run.error });
    emit({ ok: false, jobId, rejected: 'dispatch-rejected', packet, step: 'run-create', error: run.error },
      `dispatch REJECTED for ${jobId} (run-create): ${run.error}`, args.json);
    process.exit(1);
  }
  const { runId, kernelHandle } = run;
  const task = createOperationTask({ runId, prompt, op, title, attempt: job.try_no, kernelHandle, jobId, packetFile });
  if (!task?.ok || !task.taskId) {
    const error = task?.error ?? 'task-create returned no taskId';
    rejectDispatch(ledger, job, jobId, op, model, { step: 'task-create', error });
    emit({ ok: false, jobId, rejected: 'dispatch-rejected', packet, step: 'task-create', error },
      `dispatch REJECTED for ${jobId} (task-create): ${error}`, args.json);
    process.exit(1);
  }
  const taskId = task.taskId;

  // spawnAgent assembles the command and attests readiness/model, but prompt
  // delivery is delayed until Orca returns this Task's authoritative preamble.
  // A card-composed launch pins the routed model and effort on the command
  // line and spawnAgent attests the model from the rendered terminal before
  // the Task is dispatched to it.
  const guard = opGuardLaunch({ job, jobId, repo, placements, workerCwd });
  const spawned = spawnAgent({
    provider: model.provider, worktree: orcaWorktree, ...(orcaWorktree !== worktree ? { cwd: worktree } : {}), title: terminalTitle, prompt: null,
    command: model.command, dispatchId: jobId,
    model: cardLaunch?.modelId ?? null, effort: cardLaunch?.effort ?? null,
    env: { ...opLaunchEnv(jobId, model.provider, scratchDir), ...guard.env }, pathPrefix: guard.pathPrefix,
    onCreated: (created) => recordLaunchTerminal(ledger, jobId, created),
  });
  const handle = spawned.terminal ?? null;
  recordGateAnswers(ledger, { workflowId: job.workflow_id, entityType: 'job', entityId: jobId,
    provider: model.provider, terminal: handle, answers: spawned.gateAnswers });
  const spawn = { step: spawned.step, error: spawned.error, signal: spawned.signal ?? null, command: spawned.command, handle,
    ...(spawned.trust ? { trust: spawned.trust } : {}), ...(spawned.gateAnswers ? { gateAnswers: spawned.gateAnswers } : {}),
    ...(spawned.gate ? { gate: spawned.gate, remedy: spawned.remedy ?? null } : {}),
    ...(spawned.createRecovery ? { createRecovery: spawned.createRecovery } : {}) };
  spawn.ok = spawned.ok === true;
  if (!spawn.ok) {
    // dispatch-rejected: the job must NEVER sit 'running' on a dead spawn.
    // Job → failed with a typed result, lease rows released, one event — and
    // for attestation rejections a typed infra-provider incident so survey
    // sees it without parsing events. Terminal is already closed by spawnAgent.
    const reason = (spawned.gate ? spawned.error : null) ?? spawned.signal ?? spawned.error ?? `spawn failed at ${spawned.step}`;
    const rejection = rejectDispatch(ledger, job, jobId, op, model, {
      step: spawned.step, signal: spawned.signal ?? null, error: spawned.error ?? null,
      terminal: handle, closeTerminal: handle, alreadyClosed: true,
      incident: spawned.step === 'attestation', details: spawned,
      createRecovery: spawned.createRecovery ?? null, trust: spawned.trust ?? null,
    });
    const out = { ok: false, jobId, rejected: 'dispatch-rejected', packet, rejection, spawn: { ...spawn, reason } };
    emit(out, `dispatch REJECTED for ${jobId} (${spawned.step}): ${reason} — job status=${rejection.status}, terminal closed`, args.json);
    process.exit(1);
  }

  let artifact = null;
  const rejectCommand = ({ step, error = null, signal = null, dispatchId = null, incident = false, details = null, attemptId = null }) => {
    cleanupDeliveryArtifact(artifact);
    // The terminal this attempt created is closed by rejectDispatch, in the
    // same step that records the refusal — a refused op never keeps a row in
    // the sidebar (docs/fable.md orca-hierarchy: [Op] interface.audit "Idle").
    const rejection = rejectDispatch(ledger, job, jobId, op, model, {
      step, signal, error, terminal: dispatchId ?? handle, closeTerminal: handle, attemptId,
      incident, effectState: 'none', details, createRecovery: spawned.createRecovery ?? null, trust: spawned.trust ?? null,
    });
    const reason = signal ?? error ?? `command-terminal dispatch failed at ${step}`;
    emit({ ok: false, jobId, rejected: 'dispatch-rejected', packet, rejection, step, dispatchId, terminal: handle, error: reason },
      `dispatch REJECTED for ${jobId} (${step}): ${reason} — terminal closed=${rejection.terminalClosed}`, args.json);
    process.exit(1);
  };

  const dispatched = orchDispatch({ task: taskId, to: handle, from: kernelHandle, run: runId });
  const dispatchId = dispatched?.dispatchId ?? null;
  if (!dispatched?.ok || !dispatchId || !dispatched.preamble) {
    return rejectCommand({ step: 'dispatch', dispatchId, error: dispatched?.error ?? 'orchestration dispatch returned no dispatch/preamble' });
  }
  // Contract first: a worker's first action is `api op-contract`, so its row is
  // committed before the preamble reaches the terminal - it used to be filed
  // only after send, submission and the ~20s attestation, and fast Codex workers
  // read contract-missing (nivo Modules inc-e09140ad9c22, WSPV inc-7f437d11edae).
  // The running transaction below re-files it with the delivered text; a launch
  // refused after this point removes the early row again.
  const contractMarkdown = buildContractMarkdown({ op, jobId, prompt, packet });
  let attemptId = null;
  try {
    attemptId = ledger.transaction(() => {
      transitionWorkflowToRunning(ledger, { workflowId: job.workflow_id, now: Date.now(), by: 'kernel', reason: `first dispatch ${jobId}` });
      return fileContract(db, { job, op, dispatchId, markdown: contractMarkdown, now: Date.now(),
        attempt: { scratchDir, terminalHandle: handle, runId, taskId, provider: model.provider, modelProfile: model.target, pool: model.target, worktreePath: worktree },
        context: { packet, worktree, model: model.target, orca: { ...(payload.orca ?? {}), runId, taskId, dispatchId, agentTerminalHandle: handle },
          lease: { token: reserve.leaseToken, expiresAt: reserve.expiresAt, fencing: reserve.fencing }, inputs, delivery: { text: dispatched.preamble } } });
    });
  } catch (error) { return rejectCommand({ step: 'attempt', dispatchId, error: String(error?.message ?? error) }); }
  // The attempt row stays as history; the refusal ends it (end_state requeued) and the job goes back to ready.
  const rejectAfterContract = (rejection) => rejectCommand({ ...rejection, attemptId });
  const adapter = spawnCmd?.adapter;
  const sent = deliverPrompt({ handle, adapter, prompt: dispatched.preamble, worktree, dispatchId });
  artifact = sent.artifact ?? null;
  if (!sent.ok) return rejectAfterContract({ step: 'send', dispatchId, signal: sent.failureKind ?? null,
    error: sent.error ?? 'terminal send failed', details: sent });
  const submitted = sent.submitted ? { ok: true } : awaitSubmission(handle, adapter, { sentText: sent.sentText ?? dispatched.preamble });
  if (!submitted.ok) return rejectAfterContract({ step: 'submission', dispatchId, signal: submitted.signal ?? null,
    error: submitted.reason, details: submitted });
  const attested = awaitAttestation(handle, adapter);
  if (!attested.ok) return rejectAfterContract({ step: 'attestation', dispatchId, signal: attested.signal,
    error: `attestation rejected: ${attested.signal}`, incident: true, details: attested });
  cleanupDeliveryArtifact(artifact);
  artifact = null;
  const shown = dispatchShow({ task: taskId, from: kernelHandle });
  if (!shown?.ok || shown.assigneeHandle !== handle) {
    return rejectAfterContract({ step: 'dispatch-show', dispatchId, error: shown?.error ?? `expected assignee ${handle}, got ${shown?.assigneeHandle ?? 'none'}` });
  }

  payload.orca = { ...(payload.orca ?? {}), runId, taskId, dispatchId, agentTerminalHandle: handle };
  payload.agent = model.provider;
  payload.provider = model.provider;
  payload.model = model.target;
  if (cardLaunch) {
    payload.modelId = spawned.modelAttested ?? cardLaunch.modelId;
    payload.effort = cardLaunch.effort ?? null;
  }
  payload.hierarchy = payload.hierarchy ?? {
    schema: AGENT_HIERARCHY_SCHEMA, nodeId: operationNodeId(jobId),
    parentNodeId: kernelNodeId(job.workflow_id), role: 'operation',
    workflowId: job.workflow_id, jobId, opId: op,
    attempt: job.try_no, generation: job.generation,
  };
  payload.hierarchy.runtime = {
    ...(payload.hierarchy.runtime ?? {}), host: 'orca',
    agent: model.provider, provider: model.provider,
    model: payload.modelId ?? null, profile: model.target, runtimePool: model.target,
    runId, taskId, dispatchId, terminalHandle: handle,
  };
  runningOrAbandon(() => ledger.transaction(() => {
    const now = Date.now();
    markRunning(db, { job, jobId, reserve, worker: handle, payload, now });
    updateAttempt(db, { attemptId, at: now, startedAt: now, attestedAt: now, model: payload.modelId ?? null, effort: payload.effort ?? null });
    ledger.appendEvent({
      workflowId: job.workflow_id, entityType: 'job', entityId: jobId,
      kind: 'op-dispatched',
      payload: { op, terminal: handle, dispatch: dispatchId, runId, taskId, model: model.target, ...(cardLaunch ? { modelId: payload.modelId, effort: payload.effort } : {}), ...(spawned.createRecovery ? { createRecovery: spawned.createRecovery } : {}), ...(spawned.trust ? { trust: spawned.trust } : {}), guard: guard.receipt, worktree, nodeId: payload.hierarchy.nodeId, parentNodeId: payload.hierarchy.parentNodeId, leaseToken: reserve.leaseToken, fencing: reserve.fencing },
    });
  }), { ledger, db, job, jobId, op, dispatchId, attemptId, emit, args, abandon: () => closeOperationTerminal(handle) });
  const out = { ok: true, jobId, spawned: true, handle, dispatchId, packet, spawn, hierarchy: payload.hierarchy,
    orca: { runId, taskId, dispatchId, assignee: handle } };
  emit(out, `dispatched ${jobId} — [Op] ${op} on ${handle} (${model.target}, dispatch ${dispatchId}); job status=running`, args.json);

  },
};

function cmdDispatchManaged(ledger, args, { job, jobId, payload, op, model, packet, prompt, packetFile = null, worktree, orcaWorktree = null, title, reserve, inputs = null, guard = null, launchDifficulty = null, scratchDir = null }, internals, emit) {
  const { cleanupManagedWorker, rejectDispatch, ensureWorkflowRun, createOperationTask, opLaunchEnv, recordLaunchTerminal, skillRoot, AGENT_HIERARCHY_SCHEMA, operationNodeId, kernelNodeId, buildContractMarkdown, fileContract } = internals;
  const db = ledger.db;

  const reconcileFailure = (effectState, dispatchId) => {
    if (effectState === 'none') return { effectState: 'none', observation: null, cleanup: null };
    if (effectState === 'unknown') {
      if (!dispatchId) return { effectState: 'unknown', observation: null, cleanup: null };
      let observation;
      try { observation = workerShow({ dispatch: dispatchId }); }
      catch (e) { observation = { ok: false, error: String(e?.message ?? e) }; }
      if (!observation?.ok || !['failed', 'stopped', 'released'].includes(observation.state))
        return { effectState: 'unknown', observation, cleanup: null };
      const cleanup = cleanupManagedWorker(dispatchId);
      return { effectState: cleanup.effectState, observation, cleanup };
    }
    const cleanup = cleanupManagedWorker(dispatchId);
    return { effectState: cleanup.effectState, observation: null, cleanup };
  };

  let trust = null;
  const reject = ({ step, signal = null, error = null, dispatchId = null, incident = false,
    effectState = 'none', details = null }) => {
    const reconciliation = reconcileFailure(effectState, dispatchId);
    const rejection = rejectDispatch(ledger, job, jobId, op, model, {
      step, signal, error, terminal: dispatchId, incident,
      effectState: reconciliation.effectState, details, settled: reconciliation.cleanup, trust,
    });
    const reason = signal ?? error ?? `managed dispatch failed at ${step}`;
    const out = { ok: false, jobId, rejected: 'dispatch-rejected', packet, rejection,
      managed: { step, dispatchId, effectState: reconciliation.effectState,
        ...(reconciliation.observation ? { observation: reconciliation.observation } : {}),
        ...(reconciliation.cleanup ? { cleanup: reconciliation.cleanup } : {}) } };
    emit(out, `dispatch REJECTED for ${jobId} (${step}): ${reason} — job status=${rejection.status}, effect=${reconciliation.effectState}${reconciliation.cleanup ? `, worker ${dispatchId} cleanup stop=${reconciliation.cleanup.stop?.ok} release=${reconciliation.cleanup.release?.ok}` : ''}`, args.json);
    process.exit(1);
  };

  // 1. Launch model: the `api route` decision on the job payload wins; without
  // it, or when --model names another pool, resolveLaunchModel picks this pool's pin at the kind's tier.
  const routedHere = !payload.model || payload.model === model.target;
  let modelId = routedHere ? payload.modelId ?? null : null;
  let effort = routedHere ? payload.effort ?? null : null;
  if (!modelId) {
    const resolved = resolveLaunchModel(model.target, launchDifficulty ?? payload.difficulty ?? 'medium');
    if (!resolved || resolved.error || !resolved.modelId) {
      return reject({ step: 'route', error: resolved?.error ?? 'resolveLaunchModel returned no modelId' });
    }
    modelId = resolved.modelId;
    effort = resolved.effort ?? null;
  }

  // 2. Run id — one workflow Run, with the Kernel terminal as coordinator.
  const run = ensureWorkflowRun(ledger, { job, jobId, payload });
  if (!run.ok) return reject({ step: 'run-create', error: run.error });
  const { runId, kernelHandle } = run;

  // 3. Task — the operation's contract. The spec is the rendered packet prompt
  // (the same text a command-terminal launch would have sent).
  const task = createOperationTask({ runId, prompt, op, title, attempt: job.try_no, kernelHandle, jobId, packetFile });
  if (!task?.ok || !task.taskId) {
    return reject({ step: 'task-create', error: task?.error ?? 'task-create returned no taskId' });
  }
  const taskId = task.taskId;

  // 4a. Pre-trust the worktree the managed worker launches in (trust.mjs):
  // the owner never answers a Claude/Codex launch prompt.
  try { trust = ensureLaunchTrust({ agent: model.provider, cwd: worktree }); }
  catch (e) { trust = { agent: model.provider, paths: [], status: 'failed', errors: [{ error: String(e?.message ?? e) }] }; }

  // 4. worker-start — outcome ok means a ready worker (calls.yaml classify:
  // exit 0 + result.state 'ready'). Anything else, including a receipt with no
  // dispatchId, is a rejection; a partial effect is stopped + released.
  // A product op worktree is not an Orca worktree, so a worker Orca launches there shows under no project (DESIGN
  // §16.7, owner-visible 2026-09-28). The runtime launches the agent itself on the repository's ROOT Orca worktree with
  // the op worktree as its directory (spawnAgent cwd: Set-Location first, the routed model attested on screen) and
  // hands that terminal to worker-start --terminal. If the adoption is refused with no effect, the terminal is closed
  // and the worker starts the old way, so a dispatch never fails on visibility alone.
  let adopted = null, adoption = null;
  if (orcaWorktree && orcaWorktree !== worktree) {
    const sp = spawnAgent({ provider: model.provider, worktree: orcaWorktree, cwd: worktree, title, prompt: null, command: model.command ?? null,
      dispatchId: jobId, model: modelId, effort, attest: false, env: { ...opLaunchEnv(jobId, model.provider, scratchDir), ...(guard?.env ?? {}) }, pathPrefix: guard?.pathPrefix ?? null,
      onCreated: (created) => recordLaunchTerminal(ledger, jobId, created) });
    adoption = { orcaWorktree, cwd: worktree, spawned: sp.ok === true, terminal: sp.terminal ?? null, ...(sp.ok ? {} : { step: sp.step, error: sp.error }) };
    if (sp.ok && sp.terminal) adopted = sp.terminal;
  }
  let started = adopted
    ? workerStart({ task: taskId, worktree: orcaWorktree, terminal: adopted, displayName: title, run: runId, from: kernelHandle })
    : null;
  if (adopted && (started?.ok !== true || (started.outcome != null && started.outcome !== 'ok') || !started.dispatchId)) {
    adoption.workerStart = { outcome: started?.outcome ?? null, effectState: started?.effectState ?? null, error: started?.error ?? null };
    if ((started?.effectState ?? 'none') === 'none') {
      try { closeOperationTerminal(adopted); } catch { /* recorded launch terminal; the gc closes it */ }
      adopted = null; started = null;
    }
  }
  if (!started) started = workerStart({
    task: taskId, worktree, agent: model.provider, model: modelId, effort,
    displayName: title, run: runId, from: kernelHandle,
  });
  if (adoption) ledger.transaction(() => ledger.appendEvent({ workflowId: job.workflow_id, entityType: 'job', entityId: jobId, kind: 'product-worker-adoption',
    payload: { ...adoption, adopted: Boolean(adopted) } }));
  const dispatchId = started?.dispatchId ?? null;
  if (started?.ok !== true || (started.outcome != null && started.outcome !== 'ok') || !dispatchId) {
    return reject({
      step: 'worker-start', dispatchId,
      error: started?.error ?? `worker-start outcome=${started?.outcome ?? 'none'} state=${started?.state ?? 'none'} effect=${started?.effectState ?? 'none'}`,
      effectState: started?.effectState ?? 'unknown', details: started,
    });
  }

  // 5. Resolve the exact terminal worker-start already dispatched. This is a
  // read/attestation step, not a second orchestration dispatch.
  const shown = dispatchShow({ task: taskId, from: kernelHandle });
  if (!shown?.ok || !shown.assigneeHandle) {
    return reject({ step: 'dispatch-show', error: shown?.error ?? 'dispatch-show returned no assignee', dispatchId,
      effectState: 'partial', details: shown });
  }
  // The op's guard, keyed by the terminal Orca exports as ORCA_TERMINAL_HANDLE (scripts/guards/install.mjs bindGuardTerminal).
  if (guard?.receipt && typeof guard.receipt.jobFile === 'string') {
    try { guard.receipt.terminal = bindGuardTerminal({ skillRoot, handle: shown.assigneeHandle, jobFile: guard.receipt.jobFile }); }
    catch (e) { guard.receipt.terminal = { error: String(e?.message ?? e) }; }
  }

  // Managed workers created inside an existing worktree receive Orca's
  // default `worker-task_<id>` terminal title; worker-start creation labels
  // do not apply there. Rename the exact attested assignee so the visible UI
  // preserves the semantic [Op] role. A presentation failure must not stop a
  // healthy worker, but it is returned and persisted for diagnosis.
  let terminalTitle = null;
  try { terminalTitle = terminalRename({ terminal: shown.assigneeHandle, title }); }
  catch (e) { terminalTitle = { ok: false, terminal: shown.assigneeHandle, title, error: String(e?.message ?? e) }; }

  // 6. Attest — the worker's EFFECTIVE agent/model must equal what routing
  // decided. A mismatch is a provider-side defect: rejected with the typed
  // infra-provider incident (same as a terminal attestation rejection).
  const attest = workerShow({ dispatch: dispatchId });
  const eff = attest?.effective ?? {};
  const effAgent = eff.agent ?? eff.provider ?? null;
  const effModel = eff.model ?? eff.modelId ?? null;
  // An adopted terminal's agent was launched and model-attested by spawnAgent; Orca may not know its effective launch.
  const agentOk = effAgent === model.provider || (adopted && effAgent == null);
  const modelOk = effModel === modelId || (adopted && effModel == null);
  if (attest?.ok !== true || !agentOk || !modelOk) {
    return reject({
      step: 'attestation', dispatchId, incident: true,
      signal: `worker attest failed: expected agent=${model.provider} model=${modelId}, got agent=${effAgent} model=${effModel} state=${attest?.state ?? 'none'}`,
      effectState: 'partial', details: attest,
    });
  }

  // 7. Running — worker_id is the Dispatch id (managed workers have no
  // command-terminal handle); payload.managed carries the Orca ids settle needs.
  payload.managed = { runId, taskId, dispatchId, agentTerminalHandle: shown.assigneeHandle,
    terminalTitle: title, terminalTitleApplied: terminalTitle?.ok === true };
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
    runId, taskId, dispatchId, terminalHandle: shown.assigneeHandle,
  };
  const contractMarkdown = buildContractMarkdown({ op, jobId, prompt, packet });
  let attemptId = null;
  runningOrAbandon(() => ledger.transaction(() => {
    const now = Date.now();
    // The attempt and its contract (the dispatch authority; dispatch_id is the worker's Dispatch id), then running.
    transitionWorkflowToRunning(ledger, { workflowId: job.workflow_id, now, by: 'kernel', reason: `first dispatch ${jobId}` });
    attemptId = fileContract(db, {
      job, op, dispatchId, markdown: contractMarkdown, now,
      attempt: { scratchDir, managed: 1, runId, taskId, terminalHandle: shown.assigneeHandle, provider: model.provider, model: modelId, effort, modelProfile: model.target, pool: model.target, worktreePath: worktree, startedAt: now, attestedAt: now },
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
    managed: { runId, taskId, dispatchId, modelId, effort, assignee: shown.assigneeHandle, terminalTitle },
    hierarchy: payload.hierarchy,
  };
  emit(out, `dispatched ${jobId} — [Op] ${op} managed worker ${dispatchId} (${model.target}/${modelId}, task ${taskId}); job status=running`, args.json);
}

/**
 * The leased → running move, compare-and-set (H9): the job must still be leased under this dispatch's own
 * token in a workflow that dispatches. An archive, drop or reconcile that took the job while its worker was
 * starting wins; the launch is abandoned instead of resurrecting a cancelled job.
 */
function markRunning(db, { job, jobId, reserve, worker, payload, now }) {
  const wf = db.prepare('SELECT * FROM workflows WHERE workflow_id=?').get(job.workflow_id);
  requirePhase(wf, DISPATCHES, 'dispatch');
  const row = db.prepare('SELECT status, lease_token FROM jobs WHERE job_id=?').get(jobId);
  if (row?.status !== 'leased' || row.lease_token !== reserve.leaseToken) {
    throw Object.assign(new Error(`job ${jobId} is no longer leased by this dispatch (now ${row?.status ?? 'gone'})`), { code: 'dispatch-lease-lost', status: row?.status ?? null });
  }
  setJobStatus(db, { jobId, to: 'running', reason: 'dispatched', expect: 'leased', at: now, workerId: worker, payload });
}

/** Run the running transaction; when the job or workflow moved on meanwhile, stop the started worker and refuse. */
function runningOrAbandon(commit, { ledger, db, job, jobId, op, dispatchId, attemptId = null, emit, args, abandon }) {
  try { return commit(); }
  catch (error) {
    if (!['dispatch-lease-lost', 'workflow-not-accepting-work', 'workflow-finished', 'workflow-archived'].includes(error?.code)) throw error;
    let cleanup = null;
    try { cleanup = abandon(); } catch (e) { cleanup = { error: String(e?.message ?? e) }; }
    try {
      ledger.transaction(() => {
        if (attemptId != null) updateAttempt(db, { attemptId, endState: 'cancelled' });
        ledger.appendEvent({ workflowId: job.workflow_id, entityType: 'job', entityId: jobId, kind: 'dispatch-abandoned',
          payload: { op, dispatch: dispatchId, code: error.code, status: error.status ?? null, phase: error.phase ?? null } });
      });
    } catch { /* the refusal stands; events refuse an archived workflow */ }
    emit({ ok: false, jobId, op, refused: error.code, error: error.message, cleanup },
      `dispatch ABANDONED for ${jobId} (${op}): ${error.message}; the started worker was stopped`, args.json);
    process.exit(1);
  }
}
