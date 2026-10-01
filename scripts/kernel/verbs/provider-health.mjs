// api provider-health: inspect and recover provider circuits, including quota probes.
import { parseJson } from '../../lib/json.mjs';
import { readProviderCircuit, writeProviderCircuit } from '../../machine/provider-circuit.mjs';
import { QUOTA_FAILURE_KIND, quotaSpecOf, quotaProbeProviders } from '../../agent/provider-outage.mjs';
import { credentialRotated } from '../../agent/credential-fingerprint.mjs';

const quotaProbeDue = (circuit, now, everyMs) => {
  const last = Number(circuit?.quotaProbe?.at) || 0;
  if (!last) return { due: true, why: 'first-probe' };
  if (now - last >= everyMs) return { due: true, why: 'interval' };
  return { due: false, why: 'throttled', nextAt: last + everyMs };
};

const kernelCallerProof = (db, env = process.env) => {
  const handle = env.ORCA_TERMINAL_HANDLE || null;
  if (!handle) return null;
  const hit = db.prepare("SELECT job_id,workflow_id,worker_id,payload_json FROM jobs WHERE kind='kernel' AND status='running' ORDER BY updated_at DESC").all()
    .find((r) => r.worker_id === handle || parseJson(r.payload_json, {})?.hierarchy?.runtime?.terminalHandle === handle);
  return hit ? { jobId: hit.job_id, workflowId: hit.workflow_id, handle } : null;
};
const refuseProviderRecover = (out, human) => {
  console.error(JSON.stringify(out));
  console.log(human);
  process.exit(1);
};
async function quotaProbe(ledger, args, emit, internals) {
  const { normalizeProviderId, providerHealthOf } = internals;
  const db = ledger.db, now = Date.now();
  const providers = args.provider ? [normalizeProviderId(args.provider)] : quotaProbeProviders();
  const { probeProviderQuota } = await import('../../agent/credential-probe.mjs');
  const results = [];
  for (const key of providers) {
    const spec = quotaSpecOf(key);
    if (!spec?.probe) { results.push({ provider: key, probed: false, reason: 'no-quota-probe' }); continue; }
    const circuit = providerHealthOf(db, key, now);
    if (!circuit || circuit.failureKind !== QUOTA_FAILURE_KIND) {
      results.push({ provider: key, probed: false, reason: circuit ? `circuit-open-${circuit.failureKind ?? 'auth'}` : 'no-open-quota-circuit' });
      continue;
    }
    const due = quotaProbeDue(circuit, now, spec.probe.everyMs);
    if (!due.due && !args.force) { results.push({ provider: key, probed: false, reason: 'throttled', nextAt: due.nextAt }); continue; }
    const probe = await probeProviderQuota(key);
    const summary = { at: now, ok: probe.ok, state: probe.state, status: probe.status ?? null, ...(probe.code ? { code: probe.code } : {}), detail: probe.detail, why: args.force ? 'forced' : due.why };
    const workflowId = args.workflow
      ?? (circuit.jobId ? db.prepare('SELECT workflow_id FROM jobs WHERE job_id=?').get(circuit.jobId)?.workflow_id : null) ?? null;
    const previous = { status: circuit.status, failureKind: circuit.failureKind, jobId: circuit.jobId ?? null, step: circuit.step ?? null,
      signal: circuit.signal ?? null, detail: circuit.detail ?? null, observedAt: circuit.observedAt ?? null, expiresAt: circuit.expiresAt ?? null };
    const { at: _at, expiresAt: _exp, ...stored } = circuit;
    ledger.transaction(() => {
      if (probe.ok) {
        const recovered = { schema: 'starci/provider-health@1', provider: key, status: 'recovered', recoveredAt: now,
          reason: 'quota probe passed', failures: 0, trips: 0, probe: summary, recoveredBy: { quotaProbe: true, workflowId }, previous };
        writeProviderCircuit(key, { value: recovered, expiresAt: now });
        if (workflowId) ledger.appendEvent({ workflowId, entityType: 'provider', entityId: key, kind: 'provider-health-recovered',
          payload: { provider: key, reason: 'quota probe passed', probe: summary, previous } });
        return;
      }
      // Still spent: the circuit keeps its own expiry.
      const expiresAt = circuit.expiresAt;
      writeProviderCircuit(key, { value: { ...stored, quotaProbe: summary }, expiresAt: expiresAt ?? null });
      if (workflowId) ledger.appendEvent({ workflowId, entityType: 'provider', entityId: key, kind: 'provider-quota-probe-failed',
        payload: { provider: key, probe: summary, circuitUntil: expiresAt ?? null } });
    });
    results.push({ provider: key, probed: true, recovered: probe.ok, probe: summary });
  }
  emit({ ok: true, now, results },
    results.length ? results.map((r) => r.probed
      ? `quota-probe ${r.provider}: ${r.recovered ? 'PASSED - circuit cleared' : `still unavailable (${r.probe.state}) - circuit kept`}; ${r.probe.detail}`
      : `quota-probe ${r.provider}: not probed (${r.reason}${r.nextAt ? `, next at ${new Date(r.nextAt).toISOString()}` : ''})`).join('\n')
      : 'quota-probe: no provider declares a quota probe', args.json);

}


export default {
  verb: 'provider-health',
  required: [],
  kernelOnly: true,
  usageInCore: true,
  validate(args, need) {
    if (!args['quota-probe']) need(args.provider, 'provider-health needs --provider');
    if (args.recover) need(typeof args.reason === 'string' && args.reason.trim(), 'provider-health --recover needs --reason <text>');
    if (args.probe) need(args.recover, 'provider-health --probe goes with --recover');
  },
  async run({ ledger, args, emit, internals }) {
    const { normalizeProviderId, currentCredentialOf, providerHealthOf,
      providerQuotaProbeCommand, providerRecoverCommand } = internals;
  if (args['quota-probe']) return quotaProbe(ledger, args, emit, internals);
  const db = ledger.db, key = normalizeProviderId(args.provider), now = Date.now();
  if (!key) throw Object.assign(new Error('provider-health needs a provider id'), { code: 'provider-unknown' });
  // The circuit is machine.sqlite provider_health (scripts/machine/provider-circuit.mjs), fleet-wide.
  const stored = readProviderCircuit(key);
  const raw = stored ? { at: stored.at, expires_at: stored.expiresAt } : null;
  const value = stored ? stored.value : null;
  const current = currentCredentialOf(key);
  const rotated = Boolean(value?.failureKind === 'auth' && credentialRotated(value, current));
  const circuit = providerHealthOf(db, key, now);
  const row = raw ? { ...value, at: raw.at, expiresAt: raw.expires_at, expired: raw.expires_at != null && raw.expires_at <= now } : null;
  const credential = { fingerprint: current.fingerprint, source: current.source, resolved: current.resolved,
    recorded: value?.credentialFingerprint ?? null, rotated };
  const until = (at) => (at ? new Date(at).toISOString() : 'explicit recovery');
  const state = circuit ? `OPEN (${circuit.failureKind ?? 'auth'}) until ${until(circuit.expiresAt)}`
    : !row ? 'no row' : row.expired ? `closed (${row.status ?? '-'} row expired ${until(row.expiresAt)})`
      : rotated ? `closed (credential rotated ${credential.recorded} -> ${credential.fingerprint}; row ${row.status})`
        : `closed (${row.status ?? '-'})`;
  if (!args.recover) {
    emit({ ok: true, provider: key, open: Boolean(circuit), row, credential },
      `provider-health ${key}: ${state}${row?.jobId ? `; opened by ${row.jobId} at ${row.step ?? '-'}: ${row.detail ?? row.signal ?? '-'}` : ''}; credential ${credential.fingerprint ?? 'unresolved'} (${credential.source ?? 'no source'})`
      + (circuit ? `; clear with ${circuit.failureKind === QUOTA_FAILURE_KIND ? `${providerQuotaProbeCommand(key)} (runs by itself every watchdog tick, at most once per probe interval)` : providerRecoverCommand(key)}` : ''), args.json);
    return;
  }
  const kernel = kernelCallerProof(db);
  if (!kernel) {
    refuseProviderRecover({ ok: false, code: 'kernel-proof-required', provider: key, terminal: process.env.ORCA_TERMINAL_HANDLE || null,
      error: `provider-health --recover runs only from a running Kernel terminal of this ledger (ORCA_TERMINAL_HANDLE bound to a running kernel job); the Kernel runs ${providerRecoverCommand(key)}` },
    `provider-health --recover REFUSED for ${key}: kernel-proof-required`);
  }
  if (!circuit) {
    emit({ ok: true, provider: key, recovered: false, reason: 'no-open-circuit', row, credential },
      `provider-health ${key}: nothing to recover - ${state}`, args.json);
    return;
  }
  let probe = null;
  if (args.probe) {
    const { probeProviderCredential, probeProviderQuota } = await import('../../agent/credential-probe.mjs');
    const accountsOnce = internals.accountsOnceOf();
    // A quota circuit needs the quota proof (a real completion); the credential probe proves only the key.
    probe = circuit.failureKind === QUOTA_FAILURE_KIND && quotaSpecOf(key)?.probe
      ? await probeProviderQuota(key)
      : await probeProviderCredential(key, { accounts: accountsOnce?.ok ? accountsOnce : undefined });
    if (!probe.ok) {
      ledger.transaction(() => ledger.appendEvent({ workflowId: kernel.workflowId, entityType: 'provider', entityId: key,
        kind: 'provider-health-recover-refused', payload: { provider: key, reason: args.reason, probe, kernelJob: kernel.jobId } }));
      refuseProviderRecover({ ok: false, code: 'probe-failed', provider: key, probe,
        error: `the ${probe.kind ?? 'credential'} probe failed (${probe.detail}); the circuit stays open until ${until(circuit.expiresAt)}` },
      `provider-health --recover REFUSED for ${key}: probe-failed - ${probe.detail}`);
    }
  }
  const previous = { status: circuit.status, failureKind: circuit.failureKind ?? null, jobId: circuit.jobId ?? null, step: circuit.step ?? null,
    signal: circuit.signal ?? null, detail: circuit.detail ?? null, observedAt: circuit.observedAt ?? null, expiresAt: circuit.expiresAt ?? null,
    trips: circuit.trips ?? null, credentialFingerprint: circuit.credentialFingerprint ?? null };
  const probeSummary = probe ? { ok: probe.ok, kind: probe.kind, status: probe.status ?? null, detail: probe.detail } : null;
  const recovered = {
    schema: 'starci/provider-health@1', provider: key, status: 'recovered', recoveredAt: now, reason: args.reason,
    failures: 0, trips: 0, credentialFingerprint: current.fingerprint, credentialSource: current.source, probe: probeSummary,
    recoveredBy: { kernelJob: kernel.jobId, workflowId: kernel.workflowId, terminal: kernel.handle }, previous,
  };
  ledger.transaction(() => {
    writeProviderCircuit(key, { value: recovered, expiresAt: now });
    ledger.appendEvent({ workflowId: kernel.workflowId, entityType: 'provider', entityId: key, kind: 'provider-health-recovered',
      payload: { provider: key, reason: args.reason, probe: probeSummary, previous, credential, kernelJob: kernel.jobId } });
  });
  emit({ ok: true, provider: key, recovered: true, previous, probe, credential },
    `provider-health ${key}: circuit cleared (was ${previous.failureKind} until ${until(previous.expiresAt)}, opened by ${previous.jobId ?? '-'})${probe ? `; probe: ${probe.detail}` : ' without a probe'}; reason: ${args.reason}`, args.json);

  },
};
