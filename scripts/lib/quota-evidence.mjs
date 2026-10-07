import { isPlainObject } from '../../engine/plain-object.mjs';

const QUOTA_CODES = Object.freeze([
  'auth-unavailable',
  'auth-unknown',
  'owner-grant-invalid',
  'quota-authority-unknown',
  'quota-exhausted',
  'quota-expiry-invalid',
  'quota-policy-invalid',
  'quota-stale',
  'quota-unknown',
  'quota-window-invalid',
  'quota-window-stale',
  'quota-windows-missing',
]);
const QUOTA_CODE = Object.freeze(Object.fromEntries(QUOTA_CODES.map((code) => [code.replaceAll('-', '_').toUpperCase(), code])));

/** Provider epochs may be Unix seconds, epoch milliseconds or ISO dates. Invalid epochs stay unknown. */
export function quotaTimestamp(value) {
  if (value === null || value === undefined || value === '') return null;
  let at = Number.NaN;
  if (typeof value === 'number') at = value < 1e12 ? value * 1000 : value;
  else if (typeof value === 'string') at = Date.parse(value);
  return Number.isFinite(at) && Number.isFinite(new Date(at).getTime()) ? at : null;
}
export const quotaFreshAt = (value, now, maxAgeMs) => {
  const at = quotaTimestamp(value);
  return at !== null && Number.isFinite(now) && at <= now && now - at <= maxAgeMs;
};
export const quotaPolicyValid = (policy) => isPlainObject(policy)
  && Number.isFinite(policy.reservePercent) && policy.reservePercent >= 0
  && Number.isFinite(policy.exhaustedPercent) && policy.exhaustedPercent > policy.reservePercent && policy.exhaustedPercent <= 100
  && Number.isFinite(policy.maxAgeMs) && policy.maxAgeMs > 0;
const text = (value) => typeof value === 'string' && value.trim().length > 0;

const quotaAuthReason = (auth) => ['dead', 'unavailable'].includes(auth) ? QUOTA_CODE.AUTH_UNAVAILABLE : QUOTA_CODE.AUTH_UNKNOWN;

function freshQuotaOf(quota, now, policy, codes) {
  const expiry = quotaTimestamp(quota.expiresAt);
  const expiryValid = quota.expiresAt == null || expiry !== null;
  if (!expiryValid) codes.push(QUOTA_CODE.QUOTA_EXPIRY_INVALID);
  const fresh = quotaFreshAt(quota.observedAt, now, policy.maxAgeMs) && expiryValid && (expiry === null || expiry > now);
  if (!fresh) codes.push(QUOTA_CODE.QUOTA_STALE);
  return fresh;
}

function ownerGrantInvalid(grant, { scopeId, role, now, maxAgeMs }) {
  return !isPlainObject(grant) || !text(grant.owner) || !text(grant.scopeId)
    || (scopeId !== undefined && grant.scopeId !== scopeId)
    || !Array.isArray(grant.roles) || grant.roles.length === 0 || !grant.roles.every(text)
    || (role !== undefined && !grant.roles.includes(role))
    || !Number.isInteger(grant.slots) || grant.slots <= 0
    || !quotaFreshAt(grant.observedAt, now, maxAgeMs);
}

function appendQuotaWindowCodes(window, now, maxAgeMs, codes) {
  const reset = quotaTimestamp(window?.resetsAt);
  if (!isPlainObject(window) || !text(window.id) || !Number.isFinite(window.usedPercent)
    || window.usedPercent < 0 || window.usedPercent > 100 || reset === null || reset <= now) codes.push(QUOTA_CODE.QUOTA_WINDOW_INVALID);
  if (!quotaFreshAt(window?.observedAt, now, maxAgeMs)) codes.push(QUOTA_CODE.QUOTA_WINDOW_STALE);
}

const pressureOf = (windows) => windows.every((window) => Number.isFinite(window?.usedPercent))
  ? Math.max(...windows.map((window) => window.usedPercent)) : null;

/** One validation owner for normalized quota evidence; scope parameters bind grants at admission. */
export function inspectQuotaEvidence(quota, { policy, now, role, scopeId } = {}) {
  const codes = [];
  const result = (pressure = null, fresh = false) => ({ codes: [...new Set(codes)], pressure, fresh,
    limited: pressure !== null && pressure >= policy?.reservePercent && pressure < policy?.exhaustedPercent,
    exhausted: pressure !== null && pressure >= policy?.exhaustedPercent });
  if (!quotaPolicyValid(policy)) { codes.push(QUOTA_CODE.QUOTA_POLICY_INVALID); return result(); }
  if (!isPlainObject(quota)) { codes.push(QUOTA_CODE.QUOTA_UNKNOWN); return result(); }
  if (quota.auth !== 'ok') codes.push(quotaAuthReason(quota.auth));
  const fresh = freshQuotaOf(quota, now, policy, codes);
  if (quota.authority === 'owner-grant') {
    const grant = quota.grant;
    if (ownerGrantInvalid(grant, { scopeId, role, now, maxAgeMs: policy.maxAgeMs })) codes.push(QUOTA_CODE.OWNER_GRANT_INVALID);
    return result(null, fresh);
  }
  if (quota.authority != null && !['windows', 'provider-windows'].includes(quota.authority)) codes.push(QUOTA_CODE.QUOTA_AUTHORITY_UNKNOWN);
  const windows = quota.windows;
  if (!Array.isArray(windows) || windows.length === 0) { codes.push(QUOTA_CODE.QUOTA_WINDOWS_MISSING); return result(null, fresh); }
  if (new Set(windows.map((window) => window?.id)).size !== windows.length) codes.push(QUOTA_CODE.QUOTA_WINDOW_INVALID);
  for (const window of windows) appendQuotaWindowCodes(window, now, policy.maxAgeMs, codes);
  const pressure = pressureOf(windows);
  if (pressure !== null && pressure >= policy.exhaustedPercent) codes.push(QUOTA_CODE.QUOTA_EXHAUSTED);
  return result(pressure, fresh);
}
