// Normalize provider observations without inventing unobserved quota, spend or reset values.
import { quotaTimestamp as timestamp, quotaPolicyValid, quotaMaxAgeMs, inspectQuotaEvidence } from '../../lib/quota-evidence.mjs';
const observedOrParent = (value, parent) => value == null ? parent : timestamp(value) ?? value;
/** All percentage windows supplied by one provider/account response, including short windows. */
export function quotaWindows(entry, observedAt) {
  const windows = [];
  const visit = (value, id) => {
    if (!value || typeof value !== 'object') return;
    if (Object.hasOwn(value, 'usedPercent')) windows.push({ id: value.id ?? id,
      usedPercent: typeof value.usedPercent === 'number' ? value.usedPercent : null,
      resetsAt: timestamp(value.resetsAt ?? value.resetAt),
      observedAt: observedOrParent(value.observedAt ?? value.updatedAt, observedAt),
      windowMinutes: value.windowMinutes ?? value.windowDurationMins ?? null });
    for (const [key, nested] of Object.entries(value)) if (nested && typeof nested === 'object') visit(nested, id ? `${id}.${key}` : key);
  };
  visit(entry, '');
  return windows;
}
const seconds = (ms) => Math.round(ms / 1000);
/** Names how old the observation is and the limit it failed, so a stale rejection explains itself. */
const staleDetail = (observedAt, now, limitMs, { by, hostPolled }) => {
  const source = by ? ` by ${by}` : '', limit = `limit ${seconds(limitMs)} s`;
  const remedy = hostPolled && by ? `; ${by} refreshes usage while its window is focused` : '';
  if (observedAt === null) return `quota has no observation time${source}; ${limit}${remedy}`;
  if (observedAt > now) return `quota observation is ${seconds(observedAt - now)} s in the future${source}; ${limit}${remedy}`;
  return `quota observed ${seconds(now - observedAt)} s ago${source}, ${limit}${remedy}`;
};
/** The provider-window verdict chain: dead auth, stale evidence, exhaustion, admission blocks, then limited/ok. */
const providerWindowVerdict = (input, auth, result, valid, inspected, stale) => {
  if (input.state === 'dead' || auth === 'unavailable') return { ...result, state: 'dead', detail: input.detail ?? 'provider authentication unavailable' };
  if ((!valid && inspected.codes.some((code) => code !== 'quota-exhausted')) || input.state === 'unknown' || input.fresh === false)
    return { ...result, fresh: false, detail: input.detail ?? stale ?? 'quota missing, stale or invalid' };
  if (inspected.exhausted) return { ...result, state: 'dead', detail: 'a provider quota window is exhausted' };
  if (!inspected.limited && (input.normalAdmission === false || input.allowLaunchAttempt === false))
    return { ...result, detail: input.detail ?? 'provider observation blocks normal admission' };
  const limited = inspected.limited;
  return { ...result, state: limited ? 'limited' : 'ok', normalAdmission: !limited, allowLaunchAttempt: !limited,
    detail: input.detail ?? (limited ? 'a quota window is reserved for scoped recovery' : 'all observed quota windows have normal headroom') };
};
const normalizeWindow = (window, observedAt) => ({
  id: window?.id, usedPercent: typeof window?.usedPercent === 'number' ? window.usedPercent : null,
  resetsAt: timestamp(window?.resetsAt ?? window?.resetAt), observedAt: observedOrParent(window?.observedAt, observedAt),
  windowMinutes: window?.windowMinutes ?? null,
});
const windowsOf = (input, observedAt) => Array.isArray(input.windows)
  ? input.windows.map((window) => normalizeWindow(window, observedAt)) : quotaWindows(input.entry, observedAt);
const ownerGrantSnapshot = (evidence, input, valid, inspected) => {
  const available = valid && input.fresh !== false && !['dead', 'unknown'].includes(input.state)
    && input.normalAdmission !== false && input.allowLaunchAttempt !== false;
  return { ...evidence, fresh: inspected.fresh && valid, state: available ? 'ok' : 'unknown',
    normalAdmission: available, allowLaunchAttempt: available };
};
const providerWindowSnapshot = (base, windows, input, auth, valid, inspected, stale) => {
  const usedPercent = inspected.pressure;
  const resets = windows.map((window) => window.resetsAt).filter((at) => at !== null).sort((a, b) => a - b);
  const result = { ...base, windows, usedPercent, resetsAt: resets.length ? new Date(resets[0]).toISOString() : null,
    fresh: inspected.fresh && inspected.codes.every((code) => code === 'quota-exhausted') };
  return providerWindowVerdict(input, auth, result, valid, inspected, stale);
};
/** Policy numbers come from allocation.admission; unknown/stale evidence never becomes available. */
export function normalizeQuotaSnapshot(input = {}, { policy, now = Date.now() } = {}) {
  const observedAt = timestamp(input.observedAt), auth = input.auth ?? 'unknown';
  const parsedExpiry = timestamp(input.expiresAt);
  const expiresAt = input.expiresAt != null && parsedExpiry === null ? input.expiresAt : parsedExpiry;
  const base = { schema: 'starci/quota-snapshot@1', policyVersion: policy?.version ?? null, provider: input.provider ?? null, account: input.account ?? 'default',
    authority: input.authority ?? 'provider-windows', auth,
    observation: input.observation === 'host-polled' && input.authority !== 'owner-grant' ? 'host-polled' : 'direct', failureKind: input.failureKind ?? null,
    observedAt, expiresAt, windows: [], fresh: false, normalAdmission: false, allowLaunchAttempt: false,
    usedPercent: null, resetsAt: null, state: 'unknown', detail: input.detail ?? 'quota observation unknown' };
  const windows = windowsOf(input, observedAt);
  const evidence = { ...base, windows, ...(input.authority === 'owner-grant' ? { grant: input.grant ?? null } : {}) };
  const inspected = inspectQuotaEvidence(evidence, { policy, now });
  const valid = inspected.codes.length === 0;
  if (input.authority === 'owner-grant') return ownerGrantSnapshot(evidence, input, valid, inspected);
  const isStale = inspected.codes.some((code) => code === 'quota-stale' || code === 'quota-window-stale');
  const stale = isStale && quotaPolicyValid(policy) ? staleDetail(observedAt, now, quotaMaxAgeMs(evidence, policy), { by: input.observedBy, hostPolled: evidence.observation === 'host-polled' }) : null;
  return providerWindowSnapshot(base, windows, input, auth, valid, inspected, stale);
}
