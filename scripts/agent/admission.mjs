// One runtime adapter: concrete policy selection, fresh provider evidence and fenced host admission.
// The pure selector owns ordering; this adapter owns observations and launch receipts.
import { sha256 } from '../../engine/digest.mjs';
import { loadModelRegistry, loadRuntimes, loadAdapter, adapterModelAuthority } from './model-registry.mjs';
import { selectAdmission, admissionQualityFloor } from '../lib/agent-admission.mjs';
import { probeQuota } from './quota/index.mjs';
import { prepareProviderBudget, reserveProviderBudget, markProviderBudget, releaseProviderBudget, providerBudgetUsage } from './provider-budget.mjs';
import { biasForRole } from '../lib/owner-routing-bias.mjs';
import { inspectProviderCircuit } from '../machine/provider-circuit.mjs';
import { poolCapsNow } from '../machine/pool-backoff.mjs';
import { providerCircuitOf, kindOrder } from './models.mjs';
import { inspectOwnerConfig, configuredAllocationPolicy, validateConfig } from '../../engine/config.mjs';
import { normalizeQuotaSnapshot } from './quota/snapshot.mjs';
import { quotaFreshAt } from '../lib/quota-evidence.mjs';

export const launchScopeId = (role, request = {}) => `${role}:${sha256(JSON.stringify(request))}`;
/** Authorization comes from the ledger row, never JSON that asserts its own author. */
export function ownerReserveGrant(goalRow) {
  if (goalRow?.approved_by !== 'owner') return null;
  let goal;
  try { goal = typeof goalRow.json === 'string' ? JSON.parse(goalRow.json) : goalRow.json; } catch { return null; }
  if (goal?.definedBy === 'supervisor' || goal?.approvedBy === 'supervisor') return null;
  return goal?.routing_bias?.reserveOverride ?? null;
}
const selectorOf = (item) => typeof item === 'string' ? { pool: item } : item;

/** Both planning and fenced consumption consult the same strict circuit observation. */
const observeAdmissionCircuit = (provider, { io, env, now }) => io?.circuit ? io.circuit(provider, { now, env })
  : providerCircuitOf(null, provider, now, { readCircuit: (key) => {
    const observation = inspectProviderCircuit(key, { env });
    if (!observation.observed) throw new Error(`provider circuit evidence unavailable: ${observation.error}`);
    return observation.row;
  } });

const ownerQuotaGrant = ({ provider, pool, role, kind, difficulty, scopeId, runtimes, policy, now, io }) => {
  const observed = (io?.ownerConfig ?? inspectOwnerConfig)();
  if (!observed?.file || !observed.config || observed.error || observed.invalid) return null;
  const config = validateConfig(observed.config), grants = configuredAllocationPolicy(config).grants;
  const grant = grants?.[pool];
  if (!grant) return null;
  const operation = role === 'op' ? kindOrder({ kind, difficulty, runtimes }) : null;
  if (operation?.error || !grant.roles.some((allowed) => allowed === role || allowed === operation?.role || allowed === operation?.orderKey)) return null;
  return { owner: observed.file, scopeId, roles: [role], slots: grant.slots, observedAt: now, provider, pool };
};

/** A current owner config can declare slots when the provider proves auth but has no quota telemetry. */
export function quotaForAdmission({ quota, provider, pool, role, kind, difficulty, scopeId, registry, runtimes, policy, now = Date.now(), io = null } = {}) {
  if (quota?.authority !== 'owner-grant' && Array.isArray(quota?.windows) && quota.windows.length) return quota;
  if (quota?.auth !== 'ok' || !quotaFreshAt(quota.observedAt, now, policy?.maxAgeMs)) return quota;
  const poolEntry = registry?.pools?.[pool] ?? Object.values(registry?.pools ?? {}).find((entry) => entry.target === pool);
  if (poolEntry?.provider !== provider || poolEntry.capacityAuthority !== 'explicit-workflow-quota') return quota;
  const grant = ownerQuotaGrant({ provider, pool, role, kind, difficulty, scopeId, runtimes, policy, now, io });
  if (!grant) return quota?.authority === 'owner-grant' ? normalizeQuotaSnapshot({ ...quota, authority: 'provider-windows', grant: undefined, windows: [] }, { policy, now }) : quota;
  return normalizeQuotaSnapshot({ ...quota, authority: 'owner-grant', grant, windows: [], state: 'ok', normalAdmission: true, allowLaunchAttempt: true }, { policy, now });
}

/** Only persisted owner intent with an explicit role scope can influence that role. */
const trustedOverride = (requested, grant, { role, scopeId }) => {
  if (!requested || !grant || requested.authorized !== true || grant.authorized !== true) return null;
  if (requested.role !== role || requested.scopeId !== scopeId) return null;
  return ['scopeId', 'role', 'provider', 'model', 'reason'].every((key) => requested[key] === grant[key])
    && (requested.account ?? 'default') === (grant.account ?? 'default') ? requested : null;
};

const heldAttemptFor = (usage, { attemptId, provider, account, model, role, scopeId, scope }) => usage.reservations?.find((receipt) =>
  receipt.attemptId === attemptId && receipt.state !== 'released' && receipt.provider === provider && receipt.account === account
  && receipt.model === model && receipt.role === role && receipt.scope?.scopeId === scopeId
  && ['runId', 'jobId', 'seat'].every((key) => (receipt.scope?.[key] ?? null) === (scope?.[key] ?? null)));
const poolMaxParallel = (member, poolEntries, backoff) => poolEntries.length === 0 ? 0
  : Math.min(member.maxParallel ?? Infinity, ...poolEntries.map(([, row]) => row.maxParallel).filter(Number.isInteger),
    ...poolEntries.flatMap(([id, row]) => [backoff[id], backoff[row.target]]).filter(Number.isInteger));
const candidateEligibility = (member, registered, role) => {
  if (member.eligibility !== null && member.eligibility !== undefined) return member.eligibility;
  if (role === 'op') return { eligible: false, mode: null, reasons: ['operation eligibility was not established'] };
  return { eligible: registered, mode: registered ? 'scoped-control-plane' : null,
    reasons: registered ? [] : ['concrete model/provider or pool is not registered'] };
};
const runningFor = (usage, held) => {
  if (!Number.isInteger(usage.running)) return usage.running;
  return usage.running - (held ? 1 : 0);
};
const heldAttemptsGate = (candidates, heldAttempts) => {
  if (!heldAttempts.size) return;
  const held = heldAttempts.size === 1 ? [...heldAttempts.values()][0] : null;
  for (const candidate of candidates) {
    if (!held || candidate.provider !== held.provider || candidate.account !== held.account || candidate.model !== held.model)
      candidate.eligibility = { eligible: false, mode: null, reasons: ['this attempt already holds a different provider receipt'] };
  }
};

/** A plan observes but never reserves. Callers must supply actual scoped eligibility for Op work. */
export function planAgentAdmission({ role, scopeId, attemptId = null, kind = null, difficulty = null, allowGroup, qualityFloor = null, bias = null,
  ownerGrant = null, author = null, independence = null, scope = null, registry = null, runtimes = null, now = Date.now, env = process.env,
  io = null } = {}) {
  const clock = typeof now === 'function' ? now : () => now;
  const catalog = registry ?? loadModelRegistry(), rt = runtimes ?? loadRuntimes(), policy = rt?.allocation?.admission;
  const scoped = biasForRole(bias, role, scopeId);
  const override = trustedOverride(scoped.reserveOverride, ownerGrant, { role, scopeId });
  const observations = new Map();
  const circuits = new Map();
  const heldAttempts = new Map();
  const backoff = poolCapsNow({ env, now: clock() });
  const candidates = (Array.isArray(allowGroup) ? allowGroup : []).map((member, index) => {
    const provider = member.provider ?? member.agent, model = member.model;
    const poolEntries = Object.entries(catalog?.pools ?? {}).filter(([id, pool]) => pool.provider === provider
      && (!member.pool || id === member.pool || pool.target === member.pool));
    const pool = member.pool ?? poolEntries[0]?.[0] ?? null;
    const identity = `${provider}:${member.account ?? 'active'}`;
    if (!observations.has(identity)) observations.set(identity, (io?.quota ?? probeQuota)(provider, { account: member.account, policy,
      now: io?.quota ? clock() : now, env }));
    const account = member.account ?? observations.get(identity)?.account ?? 'default';
    if (!circuits.has(provider)) circuits.set(provider, observeAdmissionCircuit(provider, { io, env, now: clock() }));
    const circuit = circuits.get(provider);
    const usage = (io?.usage ?? providerBudgetUsage)(provider, account, { env });
    const candidateAttemptId = `${role}:${attemptId ?? scopeId}:${provider}:${account}:${model}`;
    const held = heldAttemptFor(usage, { attemptId: candidateAttemptId, provider, account, model, role, scopeId, scope });
    if (held) heldAttempts.set(candidateAttemptId, { provider, account, model, receipt: held });
    const maxParallel = poolMaxParallel(member, poolEntries, backoff);
    const registered = catalog?.models?.[model]?.provider === provider && poolEntries.length > 0;
    const quota = quotaForAdmission({ quota: observations.get(identity), provider, pool, role, kind,
      difficulty: difficulty ?? 'medium', scopeId, registry: catalog, runtimes: rt, policy, now: clock(), io });
    const eligibility = candidateEligibility(member, registered, role);
    return { ...member, id: member.id ?? `${provider}/${model}/${index}`, provider, agent: member.agent ?? provider, account, model, pool,
      qualityFloor: catalog?.models?.[model]?.tier ?? null, modelAuthority: adapterModelAuthority(loadAdapter(provider).card),
      eligibility: registered ? eligibility : { eligible: false, mode: null, reasons: ['concrete model/provider or pool is not registered'] },
      quota, capacity: { ...member.capacity, running: runningFor(usage, held),
        maxParallel: Number.isFinite(maxParallel) ? maxParallel : 0,
        openIncident: Boolean(circuit) || member.capacity?.openIncident === true,
        ...(circuit?.expiresAt != null ? { blockedUntil: circuit.expiresAt } : {}) } };
  });
  heldAttemptsGate(candidates, heldAttempts);
  return selectAdmission({ request: { attemptId: attemptId ?? scopeId, scopeId, role, kind, difficulty,
    qualityFloor: qualityFloor ?? admissionQualityFloor(role, difficulty, policy),
    allowGroup: candidates.map(({ provider, model }) => ({ provider, model })),
    prefer: (scoped.prefer ?? []).map(selectorOf), avoid: (scoped.avoid ?? []).map(selectorOf), require: scoped.require ?? null,
    reserveOverride: override, author: author ? { ...author, modelAuthority: adapterModelAuthority(loadAdapter(author.provider).card) } : null,
    independence: independence ?? policy?.roles?.[role]?.independence }, candidates, policy, now: clock() });
}

/** On a capacity race only the selector's eligible set is retried; require never widens. */
export function admitAgent(input = {}, options = {}) {
  let decision;
  try {
    const prepared = (options.io?.prepare ?? input.io?.prepare ?? prepareProviderBudget)({
      env: options.env ?? input.env ?? process.env, now: options.now ?? input.now });
    if (prepared?.ok !== true) throw new Error(prepared?.error ?? 'provider budget preparation was not confirmed');
    decision = planAgentAdmission({ ...input, ...options });
  }
  catch (error) { return { ok: false, step: 'admission', error: `admission evidence failed: ${error.message}`, effectState: 'none' }; }
  if (!decision.ok) return { ok: false, step: 'admission', error: decision.reason, effectState: 'none', decision };
  for (const candidate of decision.eligible) {
    const attemptId = `${input.role}:${input.attemptId ?? input.scopeId}:${candidate.provider}:${candidate.account}:${candidate.model}`;
    const bias = biasForRole(input.bias, input.role, input.scopeId);
    const override = trustedOverride(bias.reserveOverride, input.ownerGrant, input);
    let reserved;
    try { reserved = (options.io?.reserve ?? reserveProviderBudget)({ attemptId, scopeId: input.scopeId, role: input.role,
      provider: candidate.provider, account: candidate.account, model: candidate.model, maxParallel: candidate.capacity.maxParallel,
      quota: candidate.quota, override, scope: input.scope ?? {} }, { env: options.env ?? input.env ?? process.env, policy: options.runtimes?.allocation?.admission,
        now: options.now ?? input.now,
        authorizeOverride: (requested) => override !== null && trustedOverride(requested, input.ownerGrant, input) !== null,
        authorizeGrant: (requested) => {
          const grant = ownerQuotaGrant({ provider: candidate.provider, pool: candidate.pool, role: input.role, kind: input.kind,
            difficulty: input.difficulty ?? 'medium', scopeId: input.scopeId, runtimes: options.runtimes ?? loadRuntimes(),
            policy: options.runtimes?.allocation?.admission, now: Date.now(), io: options.io });
          return grant !== null && ['owner', 'scopeId', 'provider', 'pool', 'slots'].every((key) => requested[key] === grant[key])
            && requested.roles?.length === 1 && requested.roles[0] === input.role;
        } }); }
    catch (error) { return { ok: false, step: 'admission', error: `reservation outcome unknown: ${error.message}`, effectState: 'unknown', decision }; }
    if (reserved.ok) return { ok: true, decision: { ...decision, selected: candidate }, selected: candidate,
      receipt: reserved.reservation, reused: reserved.reused === true };
    if (!['capacity-full', 'provider-capacity', 'capacity'].includes(reserved.reason))
      return { ok: false, step: 'admission', error: reserved.reason,
        effectState: ['launching', 'live', 'unknown'].includes(reserved.reservation?.state) ? 'unknown' : 'none', decision, reservation: reserved };
  }
  return { ok: false, step: 'admission', error: 'provider-capacity', effectState: 'none', decision };
}

/** Reusing a receipt is a fenced consume, never an unverified second allocation. */
export function consumeAgentAdmission(admission, { provider, model, role, launchIdentity, hostRequestId, io = null, env = process.env, now, policy } = {}) {
  const receipt = admission?.receipt;
  if (!receipt || receipt.provider !== provider || receipt.model !== model || receipt.role !== role)
    return { ok: false, reason: 'admission-receipt-mismatch' };
  try {
    const circuit = observeAdmissionCircuit(provider, { io, env, now: typeof now === 'function' ? now() : now ?? Date.now() });
    if (circuit) {
      const usage = (io?.usage ?? providerBudgetUsage)(provider, receipt.account, { env });
      const stored = usage.reservations?.find((row) => row.id === receipt.id && row.fence === receipt.fence && row.attemptId === receipt.attemptId);
      return { ok: false, reason: 'provider-circuit-open', reservation: stored ?? receipt, circuit,
        effectState: stored?.state === 'reserved' ? 'none' : 'unknown' };
    }
  } catch (error) {
    return { ok: false, reason: 'provider-circuit-unavailable', error: error.message, reservation: receipt, effectState: 'unknown' };
  }
  const consumed = (io?.mark ?? markProviderBudget)(receipt, { state: 'launching', provider, model, role, account: receipt.account, launchIdentity, hostRequestId }, { env, now, policy });
  if (consumed.ok && consumed.reservation) admission.receipt = consumed.reservation;
  return consumed;
}

export function observeAgentAdmission(admission, observation, { io = null, env = process.env } = {}) {
  const result = (io?.mark ?? markProviderBudget)(admission.receipt, observation, { env });
  if (result.ok && result.reservation) admission.receipt = result.reservation;
  return result;
}
export function releaseAgentAdmission(admission, proof, { io = null, env = process.env } = {}) {
  const result = (io?.release ?? releaseProviderBudget)(admission.receipt, proof, { env });
  if (result.ok && result.reservation) admission.receipt = result.reservation;
  return result;
}

/** Only an affirmative host replay can reconcile a bound, uncertain launch to no effect. */
export function reconcileAdmissionNoEffect(admission, { launchIdentity, started } = {}, options = {}) {
  const request = started?.request;
  if (!launchIdentity || admission?.receipt?.launchIdentity !== launchIdentity || admission?.receipt?.hostRequestId !== request?.id || request?.replayed !== true
    || typeof request.id !== 'string' || !request.id.trim() || started?.outcome !== 'failed' || started.effectState !== 'none'
    || (!started.result && !started.errorReceipt)) return { ok: false, reason: 'host-no-effect-unproven' };
  return releaseAgentAdmission(admission, { kind: 'failed-before-launch', confirmed: true, launchIdentity,
    hostAffirmation: { kind: 'worker-start-replay', requestId: request.id, replayed: true, outcome: started.outcome,
      effectState: started.effectState, receipt: { result: started.result ?? null, error: started.errorReceipt ?? null } } }, options);
}
