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
const LIVE_STATES = new Set(['launching', 'live', 'unknown']);

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
  const noEffect = (step, error, extra = {}) => noEffectOf({ admission, role, provider, io, env }, step, error, extra);
  const target = resolveLaunchTarget({ provider, model, orca, io, run, preflight, parentDispatch, maxDepth, noEffect });
  if (target.refusal) return target.refusal;
  const { card, depth, limit, takesModel } = target;
  model = target.model;
  const budgetModel = model;
  admission ??= admitAgent({ role, scopeId: scopeId ?? launchScopeId(role, request), attemptId: launchScopeId(role, request), allowGroup: allowGroup ?? [{ provider, model: budgetModel, effort }],
    bias, ownerGrant, author, qualityFloor, kind, difficulty, scope: { jobId: request?.job ?? request?.workerJob ?? null, runId: run ?? null, seat: request?.seat ?? null } }, { io: io?.admission, env });
  const unadmitted = unadmittedLaunch(admission, provider, budgetModel, noEffect);
  if (unadmitted) return unadmitted;
  const agent = card?.start?.agentArgument ?? provider;
  const hostRequest = request ? { ...request, run, agent, model: takesModel ? model : null } : null;
  if (!hostRequest) return noEffect('admission', 'the launch requires its immutable host request');
  const hostRequestId = orcaRequestIdOf('worker-start', hostRequest);
  const launchIdentity = launchScopeId('host-launch', { run, request, spec, worktree, repo, baseBranch, name, setup, provider, model: budgetModel });
  // Invalid model, eligibility or request cannot authorize provider trust writes.
  const trust = launchTrustOf(orca, { agent: provider, cwd: worktree, config, env });
  if (launchTrustRefused(trust)) return noEffect('launch-trust', trust.reason ?? trust.errors?.[0]?.error ?? 'launch trust was not verified', { trust });
  const consumed = consumeAgentAdmission(admission, { provider, model: budgetModel, role, launchIdentity, hostRequestId, io: io?.admission, env });
  const launch = { provider, model, takesModel, spec, taskTitle: taskTitle ?? title, title, worktree, repo, baseBranch, name, setup, agent, run, from, request: hostRequest };
  if (!consumed.ok) return consumeRefusal({ admission, orca, io, env, launch, hostRequestId, launchIdentity }, consumed, effort);
  if (effort === 'none') effort = null;
  let started;
  try { started = orca.start(startPayloadOf(launch, effort)); }
  catch (error) { started = { ok: false, error: error.message, effectState: 'unknown' }; }
  const session = launchSession({ admission, orca, io, env, provider, run, trust, started });
  return settleLaunch(session, launch, started, { effort, onCreated, depth, limit, card });
}

// The terminal each launched worker is known by: the start receipt first, worker-show second.
const shownHandle = (shown) => shown?.ok ? shown.agentTerminalHandle ?? shown.dispatch?.assigneeHandle
  ?? shown.result?.worker?.agentTerminalHandle ?? null : null;

// A launch that left no effect: any receipt that proves a prior effect makes the effect `unknown`; an owned receipt is released.
function noEffectOf({ admission, role, provider, io, env }, step, error, extra = {}) {
  const receipt = admission?.receipt;
  const priorEffect = receipt && LIVE_STATES.has(receipt.state);
  const owned = receipt?.role === role && receipt.provider === admission.selected?.provider && receipt.model === admission.selected?.model;
  return { ok: false, step, error, provider, effectState: priorEffect ? 'unknown' : 'none', ...extra,
    ...(receipt ? { admission } : {}), ...(owned && !priorEffect ? { providerBudget: releaseAgentAdmission(admission,
      { kind: 'failed-before-launch', confirmed: true }, { io: io?.admission, env }) } : {}) };
}

// The card, host agent, depth and concrete model checks that precede admission: `{ refusal }` or the resolved target.
function resolveLaunchTarget({ provider, model, orca, io, run, preflight, parentDispatch, maxDepth, noEffect }) {
  const { card, error: cardError } = loadAdapter(provider);
  if (cardError) return { refusal: noEffect('card', cardError) };
  const resolvedModel = launchModelOf(provider, model, card);
  const host = (io?.hostAgent ?? hostAgentVerdict)({ provider, model: resolvedModel, card });
  if (!host.ok) return { refusal: noEffect('host-agent', host.error, { code: host.code, errorCode: host.code, taskId: null, runId: run ?? null }) };
  const { depth, limit, refusal } = preflight ?? depthPreflight({ parentDispatch, maxDepth, show: orca.show });
  if (refusal) return { refusal: noEffect(refusal.step, refusal.error, { ...refusal, taskId: null, runId: run ?? null }) };
  const takesModel = card?.start?.modelArgument !== false;
  // Resolve the card's declared default before the common gate evaluates this concrete model's role floor.
  if (takesModel && !resolvedModel) return { refusal: noEffect('admission', 'a concrete model is required') };
  return { card, model: resolvedModel, depth, limit, takesModel };
}

// An admission verdict that refuses the launch, or one that selected another model than the concrete request.
function unadmittedLaunch(admission, provider, model, noEffect) {
  if (!admission.ok) return { ...admission, provider };
  if (admission.selected.provider !== provider || admission.selected.model !== model)
    return noEffect('admission', 'selected model differs from concrete launch request');
  return null;
}

function launchTrustOf(orca, args) {
  try { return orca.trust(args); }
  catch (e) { return { agent: args.agent, status: 'failed', errors: [{ error: String(e?.message ?? e) }] }; }
}

const launchTrustRefused = (trust) => trust && !['written', 'already', 'ok'].includes(trust.status) && trust.ok !== true;

const modelPartOf = (launch, effort) => launch.takesModel && launch.model ? { model: launch.model, ...(effort ? { effort } : {}) } : {};
const creationOf = (launch) => ({ ...(launch.repo ? { repo: launch.repo } : {}), ...(launch.baseBranch ? { baseBranch: launch.baseBranch } : {}),
  ...(launch.name ? { name: launch.name } : {}), ...(launch.setup ? { setup: launch.setup } : {}) });

// A new worktree (`worktree: 'new-child' | 'new-top-level'`) carries Orca's creation flags (--repo, --base-branch,
// --name, --setup); an existing worktree takes none (Orca refuses them there).
function startPayloadOf(launch, effort) {
  const creates = launch.worktree === 'new-child' || launch.worktree === 'new-top-level';
  return { spec: launch.spec, taskTitle: launch.taskTitle, worktree: launch.worktree, ...(creates ? creationOf(launch) : {}), agent: launch.agent,
    ...modelPartOf(launch, effort), displayName: launch.title, run: launch.run, from: launch.from, request: launch.request };
}

const replayPayloadOf = (launch, effort) => ({ spec: launch.spec, taskTitle: launch.taskTitle, worktree: launch.worktree, agent: launch.agent,
  ...creationOf(launch), ...modelPartOf(launch, effort), displayName: launch.title, run: launch.run, from: launch.from, request: launch.request });

const CONSUME_REFUSAL_REASONS = new Set(['state-regression', 'launch-identity-conflict', 'host-request-conflict']);

// A refused consume replays a start Orca already completed, then reconciles it; any other refusal names its effect state.
function consumeRefusal({ admission, orca, io, env, launch, hostRequestId, launchIdentity }, consumed, effort) {
  const receipt = consumed.reservation ?? admission.receipt;
  if (receipt?.state === 'unknown' && receipt.launchIdentity === launchIdentity && receipt.hostRequestId === hostRequestId) {
    admission.receipt = receipt;
    const known = bestEffortCall(() => (io?.requestState ?? ((id) => requestShow({ request: id }).state))(hostRequestId));
    if (known === 'completed') {
      const replayed = bestEffortCall(() => orca.start(replayPayloadOf(launch, effort)));
      const reconciled = reconcileAdmissionNoEffect(admission, { launchIdentity, started: replayed }, { io: io?.admission, env });
      return { ok: false, step: 'admission-reconcile', error: replayed?.error ?? consumed.reason,
        effectState: reconciled.ok ? 'none' : 'unknown', admission, providerBudget: reconciled, hostReplay: replayed ?? null };
    }
  }
  return { ok: false, step: 'admission', error: consumed.reason,
    effectState: consumed.effectState ?? (LIVE_STATES.has(receipt?.state) || CONSUME_REFUSAL_REASONS.has(consumed.reason) ? 'unknown' : 'none'), admission };
}

// The launched worker's mutable terminal binding (the first terminal observed wins) and the facts a failure reports.
function launchSession({ admission, orca, io, env, provider, run, trust, started }) {
  const terminal = { handle: null, binding: null, conflict: false };
  const session = { admission, orca, io, env, provider, run, trust, terminal, dispatchId: started?.dispatchId ?? null, taskId: started?.taskId ?? null };
  // A start receipt proves its terminal before Task/model attestation or any cleanup occurs.
  bindHandle(session, started?.agentTerminalHandle);
  return session;
}

function bindHandle(session, handle) {
  const { terminal } = session;
  if (typeof handle !== 'string' || !handle.trim()) return null;
  if (terminal.handle === handle) return terminal.binding;
  if (terminal.handle && terminal.handle !== handle) {
    terminal.conflict = true;
    return { ok: false, reason: 'observed-terminal-conflict' };
  }
  const observed = observeAgentAdmission(session.admission, { state: 'unknown', handle }, { io: session.io?.admission, env: session.env });
  if (observed.ok) terminal.handle = handle;
  else terminal.conflict = true;
  terminal.binding = observed;
  return observed;
}

// A failed start is reconciled before it returns (Orca's safety floor: only proof of exit authorizes a stop): no effect -> nothing; unknown
// -> worker-show first, cleaned only when Orca shows the worker ended; a partial effect -> cleaned. `io.cleanup(dispatchId)` -> {effectState, ...} replaces the default stop + release.
function cleanupLaunch(session, id) {
  const { orca, io, env, terminal } = session;
  const observed = bestEffortCall(() => orca.show({ dispatch: id }));
  bindHandle(session, shownHandle(observed));
  if (!terminal.handle || terminal.conflict) return { effectState: 'unknown', observation: observed,
    providerBudget: terminal.binding, error: 'cleanup terminal identity is unproven' };
  if (io?.cleanup) {
    const cleanup = io.cleanup(id);
    return cleanup?.effectState !== 'none' || workerExitProven(cleanup.release, terminal.handle)
      ? cleanup : { ...cleanup, effectState: 'unknown' };
  }
  const stop = bestEffortCall(() => orca.stop({ dispatch: id }));
  const release = bestEffortCall(() => orca.release({ dispatch: id, handle: terminal.handle, env }));
  const closed = workerClosureProven(release, terminal.handle);
  return { effectState: closed ? 'none' : 'partial', stop, release };
}

function reconcileUnknownLaunch(session) {
  const observation = bestEffortCall(() => session.orca.show({ dispatch: session.dispatchId }));
  if (!observation?.ok || !['failed', 'stopped', 'released'].includes(observation.state)) return { effectState: 'unknown', observation, cleanup: null };
  bindHandle(session, shownHandle(observation));
  const cleanup = cleanupLaunch(session, session.dispatchId);
  return { effectState: cleanup.effectState, observation, cleanup };
}

function reconcileLaunch(session, effectState) {
  if (effectState === 'none' || !session.dispatchId) return { effectState, observation: null, cleanup: null };
  if (effectState === 'unknown') return reconcileUnknownLaunch(session);
  const cleanup = cleanupLaunch(session, session.dispatchId);
  return { effectState: cleanup.effectState, observation: null, cleanup };
}

// The provider budget after a failed launch: released when the reconciliation proved no effect and no terminal conflict, else observed as unknown.
function failureBudgetOf(session, effectState, reconciled, provedNone) {
  const { admission, io, env, terminal } = session;
  const handlePart = terminal.handle ? { handle: terminal.handle } : {};
  if (!provedNone) return observeAgentAdmission(admission, { state: 'unknown', ...handlePart }, { io: io?.admission, env });
  const closedProof = effectState === 'none' ? {} : { terminalProof: reconciled.cleanup?.release?.closed?.proof,
    processVerdict: reconciled.cleanup?.release?.processes?.verdict };
  return releaseAgentAdmission(admission, { kind: effectState === 'none' ? 'failed-before-launch' : 'closed', confirmed: true, ...handlePart, ...closedProof },
    { io: io?.admission, env });
}

function failedEffectState(provedNone, budget, reconciled) {
  if (provedNone) return budget.ok ? 'none' : 'unknown';
  return reconciled.effectState === 'none' ? 'unknown' : reconciled.effectState;
}

function failLaunch(session, step, error, { effectState = 'partial', ...extra } = {}) {
  bindHandle(session, extra.terminal);
  const reconciled = reconcileLaunch(session, effectState);
  const provedNone = reconciled.effectState === 'none' && !session.terminal.conflict;
  const budget = failureBudgetOf(session, effectState, reconciled, provedNone);
  return { ok: false, step, error, provider: session.provider, dispatchId: session.dispatchId, taskId: session.taskId, runId: session.run ?? null, ...extra,
    ...(session.trust ? { trust: session.trust } : {}), admission: session.admission, providerBudget: budget,
    effectState: failedEffectState(provedNone, budget, reconciled),
    ...(reconciled.observation ? { observation: reconciled.observation } : {}),
    ...(reconciled.cleanup ? { cleanup: reconciled.cleanup } : {}) };
}

const startRefused = (started, dispatchId) => started?.ok !== true || (started.outcome != null && started.outcome !== 'ok') || !dispatchId;

function failStart(session, started) {
  return failLaunch(session, 'worker-start', started?.error ?? `worker-start outcome=${started?.outcome ?? 'none'} state=${started?.state ?? 'none'} effect=${started?.effectState ?? 'none'}`,
    { effectState: started?.effectState ?? 'unknown', errorCode: started?.errorCode ?? null, details: started ?? null,
      ...(started?.hostUnavailable ? { hostUnavailable: true } : {}) });
}

function notifyCreated(onCreated, handle, dispatchId) {
  if (!onCreated) return;
  try { onCreated(handle, dispatchId); } catch { /* the receipt still names the handle */ }
}

// The agent terminal of a started worker, from the start receipt or worker-show: `{ terminal, attest }` or `{ failure }`.
function attestedTerminal(session, started, onCreated) {
  const { dispatchId } = session;
  let terminal = started.agentTerminalHandle ?? null;
  if (terminal) notifyCreated(onCreated, terminal, dispatchId);
  const attest = bestEffortCall(() => session.orca.show({ dispatch: dispatchId }));
  bindHandle(session, shownHandle(attest));
  if (session.terminal.conflict) return { failure: failLaunch(session, 'admission-attestation', 'the observed terminal does not match its original fenced receipt',
    { terminal, details: attest ?? null }) };
  if (terminal) return { terminal, attest };
  terminal = shownHandle(attest);
  if (!terminal) return { failure: failLaunch(session, 'worker-show', attest?.error ?? 'neither the worker-start receipt nor worker-show names the agent terminal',
    { code: 'worker-terminal-unknown', details: attest ?? null, ...(attest?.hostUnavailable ? { hostUnavailable: true } : {}) }) };
  notifyCreated(onCreated, terminal, dispatchId);
  return { terminal, attest };
}

// The worker a settled start produced, attested against what was routed, or the failure that reconciled it.
function settleLaunch(session, launch, started, { effort, onCreated, depth, limit, card }) {
  if (startRefused(started, session.dispatchId)) return failStart(session, started);
  // --spec made the Task: a ready start that names none is a receipt the runtime cannot settle.
  if (!session.taskId) return failLaunch(session, 'worker-start', 'worker-start --spec answered ready without result.taskId', { code: 'worker-start-no-task', details: started });
  const found = attestedTerminal(session, started, onCreated);
  if (found.failure) return found.failure;
  const { terminal, attest } = found;
  // A worker in an existing worktree gets Orca's default tab title; the semantic title is presentation only.
  const renamed = launch.title ? bestEffortCall(() => session.orca.rename({ terminal, title: launch.title })) : null;
  const eff = attest?.effective ?? {};
  const effAgent = eff.agent ?? eff.provider ?? null;
  const effModel = eff.model ?? eff.modelId ?? null;
  const { takesModel, model, agent, provider } = launch;
  const agentOk = effAgent === agent;
  const modelOk = !takesModel || !model || effModel === model;
  if (attest?.ok !== true || !agentOk || !modelOk) {
    return failLaunch(session, 'attestation', `worker attest failed: expected agent=${provider} model=${takesModel ? model : '(agent default)'}, got agent=${effAgent} model=${effModel} state=${attest?.state ?? 'none'}`,
      { terminal, incident: true, details: attest ?? null });
  }
  (session.io?.recordLaunch ?? recordLaunchedTerminal)({ terminal, dispatchId: session.dispatchId });
  const budget = observeAgentAdmission(session.admission, { state: 'live', handle: terminal }, { io: session.io?.admission, env: session.env });
  if (!budget.ok) return failLaunch(session, 'admission-attestation', budget.reason ?? 'provider receipt could not be bound to attested worker', { terminal });
  return { ok: true, terminal, dispatchId: session.dispatchId, taskId: session.taskId, runId: launch.run ?? null, provider, model: takesModel ? model : null,
    admission: session.admission, modelAuthority: adapterModelAuthority(card),
    effort: takesModel && model ? effort : null, effective: { agent: effAgent, model: takesModel ? effModel : null,
      modelAuthority: adapterModelAuthority(card) }, titleApplied: renamed?.ok === true,
    depth: dispatchDepthOf(attest) ?? depth, maxDepth: limit, ...(session.trust ? { trust: session.trust } : {}) };
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
    if (!coordinatorRefused(reused)) return reused;
    // A proved no-effect coordinator rejection consumed that candidate attempt. The fresh Run is a distinct attempt.
    admission = admitAgent({ role, scopeId: scopeId ?? launchScopeId(role, request), attemptId: `${launchScopeId(role, request)}:coordinator-retry`,
      allowGroup: allowGroup ?? [{ provider, model, effort }], bias, ownerGrant, author, qualityFloor, kind, difficulty },
    { io: io?.admission ?? io?.spawn?.admission, env });
    if (!admission.ok) return { ...admission, provider };
    provider = admission.selected.provider; model = admission.selected.model; effort = admission.selected.effort ?? effort;
  }
  const created = createRun(orca, { objective, entry, request, priorRunId });
  if (!created?.ok || !created.runId) return runCreateFailure({ created, admission, provider, io, env });
  return launch(created.runId);
}

// A start the prior Run refused before any effect: only then does the launch move to a fresh Run.
const coordinatorRefused = (reused) => !reused.ok && reused.step === 'worker-start' && reused.effectState === 'none' && !reused.hostUnavailable;

function createRun(orca, { objective, entry, request, priorRunId }) {
  try { return orca.runCreate({ objective, ...(entry ? { from: entry } : {}), request: { ...request, entry, replaces: priorRunId } }); }
  catch (error) { return { ok: false, error: error.message, effectState: 'unknown' }; }
}

function runCreateFailure({ created, admission, provider, io, env }) {
  const released = releaseAgentAdmission(admission, { kind: 'failed-before-launch', confirmed: true }, { io: io?.admission ?? io?.spawn?.admission, env });
  return { ok: false, step: 'run-create', error: created?.error ?? 'run-create returned no runId', provider,
    effectState: created?.effectState === 'none' ? 'none' : 'unknown', admission, providerBudget: released,
    ...(created?.hostUnavailable ? { hostUnavailable: true } : {}) };
}
