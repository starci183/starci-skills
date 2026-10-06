// The one semantic agent launch lifecycle: admission, immutable host replay and attested cleanup.
import { ensureLaunchTrust } from './trust.mjs';
import { hostAgentVerdict } from './host-agents.mjs';
import { workerStart } from '../api/orca/worker-start.mjs';
import { requestShow } from '../api/orca/request-show.mjs';
import { orcaRequestIdOf } from '../lib/orca-request-id.mjs';
import { workerShow } from '../api/orca/worker-show.mjs';
import { workerStop } from '../api/orca/worker-stop.mjs';
import { closeWorker, workerClosureProven, workerExitProven } from '../machine/worker-close.mjs';
import { terminalRename } from '../api/orca/terminal-rename.mjs';
import { runCreate } from '../api/orca/run-create.mjs';
import { runShow } from '../api/orca/run-show.mjs';
import { taskSpecOf } from '../machine/task-spec.mjs';
import { dispatchDepthOf } from '../lib/worker-depth.mjs';
import { bestEffortCall } from './best-effort-call.mjs';
import { depthPreflight, entryDispatchOf } from './depth-preflight.mjs';
import { recordLaunchedTerminal } from './launched-terminals.mjs';
import { addStarciShimToPath } from './starci-shim.mjs';
import { loadModelRegistry, loadAdapter, adapterModelAuthority } from './model-registry.mjs';
import { admitAgent, consumeAgentAdmission, observeAgentAdmission, releaseAgentAdmission, reconcileAdmissionNoEffect, launchScopeId } from './admission.mjs';

// Only a card's declared pool default may resolve an omitted model; model-less cards still need a budget identity.
const launchModelOf = (provider, model, card) => model ?? (card?.start?.defaultModel === 'pool' || card?.start?.modelArgument === false
  ? Object.values(loadModelRegistry()?.pools ?? {}).find((pool) => pool?.provider === provider)?.defaultModel ?? null : null);

// ---- the one agent launch --------------------------------------------------
// Every agent - Kernel, [Supervisor], [Worker], [Op] - starts through `orca orchestration worker-start --agent
// <provider> [--model <id> --effort <level>]` (modules/kernel/start-workflow.yaml).
// Orca composes the launch (placement, the owner's per-agent default args, readiness, the Task from --spec) and owns
// the worker's lifecycle; the runtime pre-trusts the directory, starts the worker with its spec (no task-create: a
// failed start leaves no orphan Task), takes the agent terminal from worker-show (result.dispatch.assigneeHandle; live Orca 1.4.209
// has no result.worker in the start receipt, 2026-10-02) or from result.worker.agentTerminalHandle when present, gives it its
// semantic title and attests the EFFECTIVE agent and model (worker-show) against what was routed. A card whose
// `start.modelArgument` is false (devin) takes no model flag and is attested on its agent alone.
// `request` is the launch's ledger identity (calls.yaml worker-start replay: request): the start's --retry-request id
// is derived from it plus the Run, agent and model, so a lost receipt replays this start instead of a second worker.
// Returns {ok:true, terminal, dispatchId, taskId, runId, provider, model, effort, effective, trust, titleApplied} or
// {ok:false, step, error, code, errorCode, effectState, dispatchId, terminal, observation, cleanup, trust}. A start that
// left an effect is reconciled before the failure returns, so no caller ever owns a half launch.
// `onCreated(handle, dispatchId)` runs the moment the agent terminal is known (before attestation when the start
// receipt names it): the caller records it durably (inc-e523617a3c31).
// Depth preflight: `parentDispatch` is the Dispatch of the runtime-launched worker
// this one nests under (an op under its Kernel, the critic under its op), none under the owner's chat. Its depth
// (worker-show) + 1 deeper than config.yaml orca.maxWorkerDepth (`maxDepth` overrides it) is refused at step 'depth'
// with worker-depth-exceeded before anything is trusted or started (effectState none). An unreadable parent depth
// proves nothing: the launch goes on and Orca stays the authority. The receipt carries the attested `depth`.
export function spawnAgent({ provider, model = null, effort = null, worktree, repo = null, baseBranch = null, name = null, setup = null, title, spec, taskTitle = null,
  run, from = null, request, onCreated = null, parentDispatch = null, maxDepth = null, preflight = null, io = null,
  role = 'worker', scopeId = null, allowGroup = null, admission = null, bias = null, ownerGrant = null, author = null, qualityFloor = null, kind = null, difficulty = null, config = undefined, env = process.env } = {}) {
  addStarciShimToPath();
  const orca = { start: io?.start ?? workerStart, show: io?.show ?? workerShow,
    rename: io?.rename ?? terminalRename, stop: io?.stop ?? workerStop, release: io?.release ?? closeWorker,
    trust: io?.trust ?? ensureLaunchTrust };
  const noEffect = (step, error, extra = {}) => {
    const receipt = admission?.receipt;
    const priorEffect = receipt && ['launching', 'live', 'unknown'].includes(receipt.state);
    const owned = receipt && receipt.role === role && receipt.provider === admission.selected?.provider && receipt.model === admission.selected?.model;
    return { ok: false, step, error, provider, effectState: priorEffect ? 'unknown' : 'none', ...extra,
      ...(receipt ? { admission } : {}), ...(owned && !priorEffect ? { providerBudget: releaseAgentAdmission(admission,
        { kind: 'failed-before-launch', confirmed: true }, { io: io?.admission, env }) } : {}) };
  };
  const { card, error: cardError } = loadAdapter(provider);
  if (cardError) return noEffect('card', cardError);
  model = launchModelOf(provider, model, card);
  const host = (io?.hostAgent ?? hostAgentVerdict)({ provider, model, card });
  if (!host.ok) return noEffect('host-agent', host.error, { code: host.code, errorCode: host.code, taskId: null, runId: run ?? null });
  const { depth, limit, refusal } = preflight ?? depthPreflight({ parentDispatch, maxDepth, show: orca.show });
  if (refusal) return noEffect(refusal.step, refusal.error, { ...refusal, taskId: null, runId: run ?? null });
  const takesModel = card?.start?.modelArgument !== false;
  // Resolve the card's declared default before the common gate evaluates this concrete model's role floor.
  if (takesModel && !model) return noEffect('admission', 'a concrete model is required');
  const budgetModel = model;
  admission ??= admitAgent({ role, scopeId: scopeId ?? launchScopeId(role, request), attemptId: launchScopeId(role, request), allowGroup: allowGroup ?? [{ provider, model: budgetModel, effort }],
    bias, ownerGrant, author, qualityFloor, kind, difficulty, scope: { jobId: request?.job ?? request?.workerJob ?? null, runId: run ?? null, seat: request?.seat ?? null } }, { io: io?.admission, env });
  if (!admission.ok) return { ...admission, provider };
  if (admission.selected.provider !== provider || admission.selected.model !== budgetModel)
    return noEffect('admission', 'selected model differs from concrete launch request');
  const agent = card?.start?.agentArgument ?? provider;
  const hostRequest = request ? { ...request, run, agent, model: takesModel ? model : null } : null;
  if (!hostRequest) return noEffect('admission', 'the launch requires its immutable host request');
  const hostRequestId = orcaRequestIdOf('worker-start', hostRequest);
  const launchIdentity = launchScopeId('host-launch', { run, request, spec, worktree, repo, baseBranch, name, setup, provider, model: budgetModel });
  // Invalid model, eligibility or request cannot authorize provider trust writes.
  let trust = null;
  try { trust = orca.trust({ agent: provider, cwd: worktree, config, env }); }
  catch (e) { trust = {agent:provider,status:'failed',errors:[{error:String(e?.message??e)}]}; }
  if(trust && !['written','already','ok'].includes(trust.status) && trust.ok!==true)
    return noEffect('launch-trust',trust.reason??trust.errors?.[0]?.error??'launch trust was not verified',{trust});
  const consumed = consumeAgentAdmission(admission, { provider, model: budgetModel, role, launchIdentity, hostRequestId, io: io?.admission, env });
  if (!consumed.ok) {
    const receipt = consumed.reservation ?? admission.receipt;
    if (receipt?.state === 'unknown' && receipt.launchIdentity === launchIdentity && receipt.hostRequestId === hostRequestId) {
      admission.receipt = receipt;
      const known = bestEffortCall(() => (io?.requestState ?? ((id) => requestShow({ request: id }).state))(hostRequestId));
      if (known === 'completed') {
        const replayed = bestEffortCall(() => orca.start({ spec, taskTitle: taskTitle ?? title, worktree, agent,
          ...(repo ? { repo } : {}), ...(baseBranch ? { baseBranch } : {}), ...(name ? { name } : {}), ...(setup ? { setup } : {}),
          ...(takesModel && model ? { model, ...(effort ? { effort } : {}) } : {}), displayName: title, run, from, request: hostRequest }));
        const reconciled = reconcileAdmissionNoEffect(admission, { launchIdentity, started: replayed }, { io: io?.admission, env });
        return { ok: false, step: 'admission-reconcile', error: replayed?.error ?? consumed.reason,
          effectState: reconciled.ok ? 'none' : 'unknown', admission, providerBudget: reconciled, hostReplay: replayed ?? null };
      }
    }
    return { ok: false, step: 'admission', error: consumed.reason,
      effectState: consumed.effectState ?? (['launching', 'live', 'unknown'].includes(receipt?.state)
        || ['state-regression', 'launch-identity-conflict', 'host-request-conflict'].includes(consumed.reason) ? 'unknown' : 'none'), admission };
  }
  if (effort === 'none') effort = null;
  // A new worktree (`worktree: 'new-child' | 'new-top-level'`) carries Orca's creation flags (--repo, --base-branch,
  // --name, --setup); an existing worktree takes none (Orca refuses them there).
  const creates = worktree === 'new-child' || worktree === 'new-top-level';
  const creation = creates ? { ...(repo ? { repo } : {}), ...(baseBranch ? { baseBranch } : {}), ...(name ? { name } : {}), ...(setup ? { setup } : {}) } : {};
  let started;
  try { started = orca.start({ spec, taskTitle: taskTitle ?? title, worktree, ...creation, agent,
    ...(takesModel && model ? { model, ...(effort ? { effort } : {}) } : {}), displayName: title, run, from,
    request: hostRequest }); }
  catch (error) { started = { ok: false, error: error.message, effectState: 'unknown' }; }
  const dispatchId = started?.dispatchId ?? null;
  const taskId = started?.taskId ?? null;
  let boundHandle = null, handleBinding = null, handleConflict = false;
  const bindHandle = (handle) => {
    if (typeof handle !== 'string' || !handle.trim()) return null;
    if (boundHandle === handle) return handleBinding;
    if (boundHandle && boundHandle !== handle) {
      handleConflict = true;
      return { ok: false, reason: 'observed-terminal-conflict' };
    }
    const observed = observeAgentAdmission(admission, { state: 'unknown', handle }, { io: io?.admission, env });
    if (observed.ok) boundHandle = handle;
    else handleConflict = true;
    handleBinding = observed;
    return observed;
  };
  // A start receipt proves its terminal before Task/model attestation or any cleanup occurs.
  bindHandle(started?.agentTerminalHandle);
  const shownHandle = (shown) => shown?.ok ? shown.agentTerminalHandle ?? shown.dispatch?.assigneeHandle
    ?? shown.result?.worker?.agentTerminalHandle ?? null : null;
  // A failed start is reconciled before it returns (Orca's safety floor: only proof of exit authorizes a stop): no effect -> nothing; unknown
  // -> worker-show first, cleaned only when Orca shows the worker ended; a partial effect -> cleaned. `io.cleanup(dispatchId)` -> {effectState, ...} replaces the default stop + release.
  const cleanupOf = (id) => {
    const observed = bestEffortCall(() => orca.show({ dispatch: id }));
    bindHandle(shownHandle(observed));
    if (!boundHandle || handleConflict) return { effectState: 'unknown', observation: observed,
      providerBudget: handleBinding, error: 'cleanup terminal identity is unproven' };
    if (io?.cleanup) {
      const cleanup = io.cleanup(id);
      return cleanup?.effectState !== 'none' || workerExitProven(cleanup.release, boundHandle)
        ? cleanup : { ...cleanup, effectState: 'unknown' };
    }
    const stop = bestEffortCall(() => orca.stop({ dispatch: id }));
    const release = bestEffortCall(() => orca.release({ dispatch: id, handle: boundHandle, env }));
    const closed = workerClosureProven(release, boundHandle);
    return { effectState: closed ? 'none' : 'partial', stop, release };
  };
  const reconcile = (effectState) => {
    if (effectState === 'none' || !dispatchId) return { effectState, observation: null, cleanup: null };
    if (effectState === 'unknown') {
      const observation = bestEffortCall(() => orca.show({ dispatch: dispatchId }));
      if (!observation?.ok || !['failed', 'stopped', 'released'].includes(observation.state)) return { effectState: 'unknown', observation, cleanup: null };
      bindHandle(shownHandle(observation));
      const cleanup = cleanupOf(dispatchId);
      return { effectState: cleanup.effectState, observation, cleanup };
    }
    const cleanup = cleanupOf(dispatchId);
    return { effectState: cleanup.effectState, observation: null, cleanup };
  };
  const fail = (step, error, { effectState = 'partial', ...extra } = {}) => {
    bindHandle(extra.terminal);
    const reconciled = reconcile(effectState);
    const provedNone = reconciled.effectState === 'none' && !handleConflict;
    const budget = provedNone
      ? releaseAgentAdmission(admission, { kind: effectState === 'none' ? 'failed-before-launch' : 'closed', confirmed: true,
        ...(boundHandle ? { handle: boundHandle } : {}),
        ...(effectState === 'none' ? {} : { terminalProof: reconciled.cleanup?.release?.closed?.proof,
          processVerdict: reconciled.cleanup?.release?.processes?.verdict }) }, { io: io?.admission, env })
      : observeAgentAdmission(admission, { state: 'unknown', ...(boundHandle ? { handle: boundHandle } : {}) }, { io: io?.admission, env });
    return { ok: false, step, error, provider, dispatchId, taskId, runId: run ?? null, ...extra, ...(trust ? { trust } : {}),
      admission, providerBudget: budget,
      effectState: provedNone && budget.ok ? 'none' : provedNone ? 'unknown' : reconciled.effectState === 'none' ? 'unknown' : reconciled.effectState,
      ...(reconciled.observation ? { observation: reconciled.observation } : {}),
      ...(reconciled.cleanup ? { cleanup: reconciled.cleanup } : {}) };
  };
  if (started?.ok !== true || (started.outcome != null && started.outcome !== 'ok') || !dispatchId) {
    return fail('worker-start', started?.error ?? `worker-start outcome=${started?.outcome ?? 'none'} state=${started?.state ?? 'none'} effect=${started?.effectState ?? 'none'}`,
      { effectState: started?.effectState ?? 'unknown', errorCode: started?.errorCode ?? null, details: started ?? null,
        ...(started?.hostUnavailable ? { hostUnavailable: true } : {}) });
  }
  // --spec made the Task: a ready start that names none is a receipt the runtime cannot settle.
  if (!taskId) return fail('worker-start', 'worker-start --spec answered ready without result.taskId', { code: 'worker-start-no-task', details: started });
  let terminal = started.agentTerminalHandle ?? null;
  const created = (handle) => { if (onCreated) { try { onCreated(handle, dispatchId); } catch { /* the receipt still names the handle */ } } };
  if (terminal) created(terminal);
  const attest = bestEffortCall(() => orca.show({ dispatch: dispatchId }));
  bindHandle(shownHandle(attest));
  if (handleConflict) return fail('admission-attestation', 'the observed terminal does not match its original fenced receipt',
    { terminal, details: attest ?? null });
  if (!terminal) {
    terminal = shownHandle(attest);
    if (!terminal) return fail('worker-show', attest?.error ?? 'neither the worker-start receipt nor worker-show names the agent terminal',
      { code: 'worker-terminal-unknown', details: attest ?? null, ...(attest?.hostUnavailable ? { hostUnavailable: true } : {}) });
    created(terminal);
  }
  // A worker in an existing worktree gets Orca's default tab title; the semantic title is presentation only.
  const renamed = title ? bestEffortCall(() => orca.rename({ terminal, title })) : null;
  const eff = attest?.effective ?? {};
  const effAgent = eff.agent ?? eff.provider ?? null;
  const effModel = eff.model ?? eff.modelId ?? null;
  const agentOk = effAgent === agent;
  const modelOk = !takesModel || !model || effModel === model;
  if (attest?.ok !== true || !agentOk || !modelOk) {
    return fail('attestation', `worker attest failed: expected agent=${provider} model=${takesModel ? model : '(agent default)'}, got agent=${effAgent} model=${effModel} state=${attest?.state ?? 'none'}`,
      { terminal, incident: true, details: attest ?? null });
  }
  (io?.recordLaunch ?? recordLaunchedTerminal)({ terminal, dispatchId });
  const budget = observeAgentAdmission(admission, { state: 'live', handle: terminal }, { io: io?.admission, env });
  if (!budget.ok) return fail('admission-attestation', budget.reason ?? 'provider receipt could not be bound to attested worker', { terminal });
  return { ok: true, terminal, dispatchId, taskId, runId: run ?? null, provider, model: takesModel ? model : null,
    admission, modelAuthority: adapterModelAuthority(card),
    effort: takesModel && model ? effort : null, effective: { agent: effAgent, model: takesModel ? effModel : null,
      modelAuthority: adapterModelAuthority(card) }, titleApplied: renamed?.ok === true,
    depth: dispatchDepthOf(attest) ?? depth, maxDepth: limit, ...(trust ? { trust } : {}) };
}


// An agent that is not an operation - the Kernel, the [Supervisor], a [Worker] - is a worker of its own Run: the
// entry terminal (the owner's chat, the Supervisor, whoever ran the launcher; `entry`, Orca's ORCA_TERMINAL_HANDLE)
// is that Run's coordinator. `priorRunId` is reused while Orca still knows it and accepts the start; a start the prior
// Run refuses before any effect (a Run another entry coordinates) moves to a fresh Run (a Run's coordinator is the
// terminal that created it). The Task spec is the prompt, spilled to `specFile` past the host's argv (task-spec.mjs);
// worker-start --spec files it. `request` is the launch's ledger identity (the caller's attempt, token or placement):
// run-create and worker-start derive their --retry-request ids from it (calls.yaml replay: request).
// Returns spawnAgent's receipt (runId/taskId on it), or {ok:false, step:'run-create', effectState:'none'}.
export function startAgent({ provider, model = null, effort = null, worktree, repo = null, baseBranch = null, name = null, setup = null, title, prompt, specFile = null,
  heading = null, objective, entry = null, priorRunId = null, request, onCreated = null, parentDispatch = null, maxDepth = null, io = null,
  role = 'worker', scopeId = null, allowGroup = null, admission = null, bias = null, ownerGrant = null, author = null, qualityFloor = null, kind = null, difficulty = null, config = undefined, env = process.env } = {}) {
  if (!request || typeof request !== 'object') throw new Error('startAgent needs request: the ledger identity of this launch (calls.yaml replay: request)');
  const orca = { runShow: io?.runShow ?? runShow, runCreate: io?.runCreate ?? runCreate };
  // The depth preflight runs before the Run exists, so a refused launch leaves nothing behind in Orca. With no parent named,
  // the entry terminal's own Dispatch (worker-list) is the parent: a Kernel started from a worker nests.
  if (!parentDispatch && entry) parentDispatch = entryDispatchOf(entry, io?.workerList ? { list: io.workerList } : {});
  const preflight = depthPreflight({ parentDispatch, maxDepth, show: io?.spawn?.show ?? workerShow });
  if (preflight.refusal) return { ...preflight.refusal, provider };
  const { card } = loadAdapter(provider);
  const budgetModel = launchModelOf(provider, model, card);
  admission ??= admitAgent({ role, scopeId: scopeId ?? launchScopeId(role, request), attemptId: launchScopeId(role, request), allowGroup: allowGroup ?? [{ provider, model: budgetModel, effort }],
    bias, ownerGrant, author, qualityFloor, kind, difficulty, scope: { jobId: request?.workerJob ?? (request?.workflow ? `kernel-${request.workflow}` : null),
      runId: null, seat: request?.seat ?? null } }, { io: io?.admission ?? io?.spawn?.admission, env });
  if (!admission.ok) return { ...admission, provider };
  provider = admission.selected.provider; model = admission.selected.model; effort = admission.selected.effort ?? effort;
  const spec = taskSpecOf({ prompt, file: specFile, heading: heading ?? title }).spec;
  const launch = (runId) => spawnAgent({ provider, model, effort, worktree, repo, baseBranch, name, setup, title, spec, taskTitle: title, run: runId, from: entry,
    request, onCreated, parentDispatch, maxDepth, preflight, io: { ...io?.spawn, admission: io?.admission ?? io?.spawn?.admission },
    role, scopeId, allowGroup, admission, bias, ownerGrant, author, qualityFloor, kind, difficulty, config, env });
  if (priorRunId && orca.runShow({ id: priorRunId })?.ok) {
    const reused = launch(priorRunId);
    if (reused.ok || reused.step !== 'worker-start' || reused.effectState !== 'none' || reused.hostUnavailable) return reused;
    // A proved no-effect coordinator rejection consumed that candidate attempt. The fresh Run is a distinct attempt.
    admission = admitAgent({ role, scopeId: scopeId ?? launchScopeId(role, request), attemptId: `${launchScopeId(role, request)}:coordinator-retry`,
      allowGroup: allowGroup ?? [{ provider, model, effort }], bias, ownerGrant, author, qualityFloor, kind, difficulty },
    { io: io?.admission ?? io?.spawn?.admission, env });
    if (!admission.ok) return { ...admission, provider };
    provider = admission.selected.provider; model = admission.selected.model; effort = admission.selected.effort ?? effort;
  }
  let created;
  try { created = orca.runCreate({ objective, ...(entry ? { from: entry } : {}), request: { ...request, entry, replaces: priorRunId } }); }
  catch (error) { created = { ok: false, error: error.message, effectState: 'unknown' }; }
  if (!created?.ok || !created.runId) {
    const released = releaseAgentAdmission(admission, { kind: 'failed-before-launch', confirmed: true }, { io: io?.admission ?? io?.spawn?.admission, env });
    return { ok: false, step: 'run-create', error: created?.error ?? 'run-create returned no runId', provider,
      effectState: created?.effectState === 'none' ? 'none' : 'unknown', admission, providerBudget: released,
      ...(created?.hostUnavailable ? { hostUnavailable: true } : {}) };
  }
  return launch(created.runId);
}
