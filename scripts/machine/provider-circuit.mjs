// provider-circuit.mjs — the provider-health circuit lives in machine.sqlite provider_health (DBTREE §4.5 B4).
//
// One provider credential is one fleet-wide availability fact, so the circuit is a machine row, not a per-ledger signal
// (the runtime signals table only takes kernel|stop|launch|decision-doorbell). `value` is the circuit shape the kernel
// used to store in the provider-health signal ({status, failureKind, provider, model, strikes, credentialFingerprint,
// ...}); it rides in provider_health.detail_json, `expiresAt` in circuit_open_until. Every change of status appends one
// provider_health_events row (engine/db/machine.mjs setProviderHealth). Reads never throw: no machine, no circuit.
import { openMachine, openMachineReader, providerHealth, setProviderHealth } from '../../engine/db/machine.mjs';
import { parseJsonOr } from '../lib/json.mjs';
import { normalizeProvider } from '../lib/provider.mjs';

export const CIRCUIT_PROVIDERS = Object.freeze(['devin', 'codex', 'claude']);
const STATUS_OF = { unavailable: 'unavailable', recovered: 'recovered', healthy: 'healthy', striking: 'striking' };

/** The stored circuit of `provider` as {value, at, expiresAt}, or null. */
export function readProviderCircuit(provider, { machine = null } = {}) {
  const key = normalizeProvider(provider);
  if (!CIRCUIT_PROVIDERS.includes(key)) return null;
  let m = machine, own = false;
  try {
    if (!m) { m = openMachineReader(); own = true; }
    const row = providerHealth(m).find((r) => r.provider === key);
    if (!row) return null;
    const detail = parseJsonOr(row.detail_json) ?? {};
    return { value: { ...detail, provider: key, status: row.status, failureKind: row.failure_kind ?? detail.failureKind ?? null, strikes: row.strikes }, at: row.updated_at, expiresAt: row.circuit_open_until ?? null };
  } catch { return null; } finally { if (own) try { m?.close(); } catch { /* closed */ } }
}

/** Store the circuit of `provider` (value.status unavailable|recovered|striking|healthy). Returns true when written. */
export function writeProviderCircuit(provider, { value, expiresAt = null, ledgerId = null, attemptId = null, machine = null } = {}) {
  const key = normalizeProvider(provider);
  if (!CIRCUIT_PROVIDERS.includes(key)) return false;
  let m = machine, own = false;
  try {
    if (!m) { m = openMachine(); own = true; }
    setProviderHealth(m, { provider: key, status: STATUS_OF[value?.status] ?? 'unavailable', failureKind: value?.failureKind ?? null,
      strikes: Number(value?.strikes ?? 0) || 0, strikeLimit: value?.strikeLimit ?? null, circuitOpenUntil: expiresAt,
      reason: value?.reason ?? value?.signal ?? value?.error ?? null, ledgerId, attemptId, detail: value ?? null });
    return true;
  } finally { if (own) try { m?.close(); } catch { /* closed */ } }
}

/** Every stored circuit: [{provider, value, at, expiresAt}]. */
export function providerCircuits() {
  let m;
  try { m = openMachineReader(); return providerHealth(m).map((r) => ({ provider: r.provider, value: { ...(parseJsonOr(r.detail_json) ?? {}), status: r.status, failureKind: r.failure_kind }, at: r.updated_at, expiresAt: r.circuit_open_until ?? null })); }
  catch { return []; } finally { try { m?.close(); } catch { /* closed */ } }
}
