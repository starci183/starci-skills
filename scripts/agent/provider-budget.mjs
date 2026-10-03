// Host provider admission owns quota policy; machine.sqlite owns atomic slot receipts.
// A slot is one concurrent launch, not a provider token/credit measurement. Estimates are descriptive.
import { allocationSettings } from '../../engine/config.mjs';
import { withMachine, readMachine } from '../../engine/db/machine.mjs';
import { normalizeQuotaSnapshot } from './quota/snapshot.mjs';
import { inspectQuotaEvidence } from '../lib/quota-evidence.mjs';
import { providerBudgetClock as clockOf, providerBudgetOptions as optionsOf } from '../machine/provider-budget-release.mjs';
export { releaseProviderBudgetByHandle } from '../machine/provider-budget-release.mjs';

const scopeOf = (input) => ({ scopeId: input.scopeId ?? input.scope?.scopeId ?? null,
  runId: input.scope?.runId ?? input.runId ?? null, jobId: input.scope?.jobId ?? input.jobId ?? null,
  seat: input.scope?.seat ?? input.seat ?? null });
const policyOf = (options) => options.policy ?? allocationSettings()?.admission;
const exactOverride = (override, input, scope) => override?.authorized === true && typeof override.reason === 'string' && override.reason.trim()
  && override.scopeId === scope?.scopeId && scope?.scopeId != null && override.role === input.role
  && override.provider === input.provider && override.model === input.model && (override.account ?? 'default') === (input.account ?? 'default');
const validGrant = (quota, role, scopeId, policy, now) => quota.authority !== 'owner-grant'
  || inspectQuotaEvidence(quota, { role, scopeId, policy, now }).codes.length === 0;

/** Actual admission prepares the store through its writer; read-only plans never create or upgrade it. */
export function prepareProviderBudget(options = {}) {
  return withMachine((machine) => {
    machine.meta(); // Forces the owning connection's schema validation/create/compatible upgrade.
    return { ok: true, file: machine.file };
  }, optionsOf(options));
}

/** Revalidate evidence at admission, then reserve the last shared slot in BEGIN IMMEDIATE. */
export function reserveProviderBudget(input = {}, options = {}) {
  const now = clockOf(options)(), policy = policyOf(options), scope = scopeOf(input);
  const quota = normalizeQuotaSnapshot(input.quota, { policy, now });
  if (quota.provider !== input.provider || quota.account !== (input.account ?? 'default')) return { ok: false, reason: 'quota-identity' };
  if (!quota.fresh || quota.auth !== 'ok' || ['dead', 'unknown'].includes(quota.state)) return { ok: false, reason: 'quota-ineligible', quota };
  let maxParallel = input.maxParallel;
  if (quota.authority === 'owner-grant') {
    if (!validGrant(quota, input.role, scope.scopeId, policy, now) || options.authorizeGrant?.(quota.grant, input) !== true)
      return { ok: false, reason: 'grant-ineligible' };
    maxParallel = Math.min(maxParallel, quota.grant.slots);
  }
  const override = input.override ?? input.reserveOverride;
  // The callback is a trusted runtime boundary: it verifies separately persisted owner authority,
  // not the requested override's self-asserted `authorized` flag or a pure selection plan.
  const overrideApplied = quota.state === 'limited' && exactOverride(override, input, scope)
    && options.authorizeOverride?.(override, input) === true;
  if (!quota.normalAdmission && !overrideApplied) return { ok: false, reason: 'quota-reserve', quota };
  return withMachine((m) => m.reserveProvider({ provider: input.provider, account: input.account ?? 'default',
    attemptId: input.attemptId ?? input.requestId, role: input.role, model: input.model, maxParallel,
    scope, quota, estimate: input.estimate ?? null, override: overrideApplied ? override : null }), optionsOf(options));
}
/** Progress observations are fenced; the launcher supplies authoritative handle/process evidence. */
export function markProviderBudget(receipt, observation, options = {}) {
  return withMachine((m) => {
    if (observation?.state === 'launching') {
      const stored = m.providerReservations({ provider: receipt.provider, account: receipt.account }).find((row) => row.id === receipt.id && row.fence === receipt.fence && row.attemptId === receipt.attemptId);
      if (!stored) return { ok: false, reason: 'fenced' };
      const now = clockOf(options)(), policy = policyOf(options), quota = normalizeQuotaSnapshot(stored.quota, { policy, now });
      if (!quota.fresh || quota.auth !== 'ok' || ['dead', 'unknown'].includes(quota.state)
        || !validGrant(quota, stored.role, stored.scope?.scopeId, policy, now)
        || (!quota.normalAdmission && !exactOverride(stored.override, stored, stored.scope)))
        return { ok: false, reason: 'quota-ineligible', quota, reservation: stored };
    }
    return m.markProviderReservation({ ...receipt, ...observation, id: receipt.id, fence: receipt.fence, attemptId: receipt.attemptId });
  }, optionsOf(options));
}
/** Closure/no-effect proof must match the admitted attempt and its known execution identity. */
export function releaseProviderBudget(receipt, proof, options = {}) {
  return withMachine((m) => m.releaseProviderReservation({ ...receipt, proof }), optionsOf(options));
}
/** Missing, stale or unknown observations retain capacity. This function never probes processes itself. */
export function reconcileProviderBudget(observations = [], options = {}) {
  return observations.map(({ receipt, proof, observation }) => proof
    ? releaseProviderBudget(receipt, proof, options) : observation
      ? markProviderBudget(receipt, observation, options) : { ok: false, reason: 'observation-unknown', reservation: receipt });
}
export function providerBudgetUsage(provider, account = 'default', options = {}) {
  return readMachine((m) => m.providerReservationUsage({ provider, account }),
  { running: null, reservations: [], observed: false }, optionsOf(options));
}
