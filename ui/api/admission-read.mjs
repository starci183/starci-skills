// Read captured admission evidence; this projection never evaluates launch eligibility.
import { hasTable } from '../../scripts/lib/sqlite.mjs';
import { many, one, parse } from './query.mjs';

const number = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
const text = value => typeof value === 'string' ? value : null;
const epoch = value => {
  if (number(value) != null) return value;
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : null;

function quotaOf(value) {
  const quota = object(value);
  if (!quota) return null;
  return { authority: text(quota.authority), auth: text(quota.auth) ?? 'unknown', state: text(quota.state) ?? 'unknown',
    fresh: typeof quota.fresh === 'boolean' ? quota.fresh : null,
    observedAt: epoch(quota.observedAt), expiresAt: epoch(quota.expiresAt), usedPercent: number(quota.usedPercent), detail: text(quota.detail),
    windows: (Array.isArray(quota.windows) ? quota.windows : []).filter(object).map(window => ({
      id: text(window.id) ?? 'unknown', usedPercent: number(window.usedPercent), resetsAt: epoch(window.resetsAt),
      observedAt: epoch(window.observedAt), windowMinutes: number(window.windowMinutes) })) };
}

/** Supports the recorded camel-case contract receipt and the additive machine SQL row. */
export function admissionReservation(value) {
  const row = object(value);
  if (!row) return null;
  const quota = row.quota ?? parse(row.quota_json);
  const attemptId = row.attemptId ?? row.attempt_id;
  if (!text(row.id) || !number(row.fence) || !text(attemptId) || !text(row.provider) || !text(row.account) || !text(row.model)
    || !['kernel', 'op', 'supervisor', 'worker', 'critic'].includes(row.role)
    || !['reserved', 'launching', 'live', 'unknown', 'released'].includes(row.state)) return null;
  // Required receipt timestamps are recorded by the engine. Malformed evidence is unavailable.
  const createdAt = epoch(row.createdAt ?? row.created_at), updatedAt = epoch(row.updatedAt ?? row.updated_at);
  if (createdAt == null || updatedAt == null || number(row.slots) == null || number(row.maxParallel ?? row.max_parallel) == null) return null;
  return { id: row.id, fence: row.fence, attemptId, provider: row.provider, account: row.account, model: row.model,
    role: row.role, state: row.state, slots: row.slots, maxParallel: row.maxParallel ?? row.max_parallel,
    scope: row.scope ?? parse(row.scope_json), handle: text(row.handle), pid: number(row.pid),
    launchIdentity: text(row.launchIdentity ?? row.launch_identity), hostRequestId: text(row.hostRequestId ?? row.host_request_id),
    createdAt, updatedAt, releasedAt: epoch(row.releasedAt ?? row.released_at),
    estimate: row.estimate ?? parse(row.estimate_json), override: row.override ?? parse(row.override_json), proof: row.proof ?? parse(row.proof_json),
    quota: quotaOf(quota), quotaCodes: (Array.isArray(row.quotaCodes) ? row.quotaCodes : Array.isArray(quota?.codes) ? quota.codes : []).filter(code => typeof code === 'string') };
}

export const admissionObserved = db => hasTable(db, 'provider_reservations');

export function admissionView(db) {
  if (!admissionObserved(db)) return { observed: false, running: null, unknown: null, reservations: [] };
  const rows = many(db, 'SELECT * FROM provider_reservations ORDER BY updated_at DESC,fence DESC');
  const reservations = rows.map(admissionReservation).filter(Boolean);
  // Unknown launch outcomes retain slots. Released history is visible but occupies no capacity.
  return { observed: true, running: rows.filter(row => row.state !== 'released').reduce((sum, row) => sum + row.slots, 0),
    unknown: rows.filter(row => row.state === 'unknown').reduce((sum, row) => sum + row.slots, 0), reservations };
}

export function attemptAdmission(db, machine, attemptId) {
  const contract = one(db, 'SELECT context_json,created_at FROM contracts WHERE attempt_id=?', attemptId);
  const context = parse(contract?.context_json);
  const captured = object(context?.managed?.admission);
  const capturedReceipt = admissionReservation(captured?.receipt);
  const observed = admissionObserved(machine);
  const current = observed && capturedReceipt ? admissionReservation(one(machine, 'SELECT * FROM provider_reservations WHERE id=? AND fence=? AND attempt_id=?',
    capturedReceipt.id, capturedReceipt.fence, capturedReceipt.attemptId)) : null;
  const same = current && ['provider', 'account', 'model', 'role'].every(key => current[key] === capturedReceipt[key]);
  return { observed, source: captured ? 'contract' : null, recordedAt: captured ? epoch(contract.created_at) : null,
    selection: captured?.selected ?? captured?.decision ?? null, receipt: same ? current : null, capturedReceipt };
}
