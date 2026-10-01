// api provider-backoff — open a provider circuit when a rate limit persists (reconciler Resource controller, adaptive
// per-pool concurrency; lane rc-gc-resource). The controller halves a rate-limited pool's parallelism down to a floor
// (scripts/machine/pool-backoff.mjs); when the provider still rate-limits at the floor for persistMs it opens the circuit
// here, the same provider-health row `api dispatch` and `api route` already refuse on, so no new launch reaches the
// provider until it expires (allocation.cooldownMs.<kind>) or its quota probe / the Kernel's --recover clears it.
//
//   provider-backoff --provider <p> --open-circuit [--kind quota|rate-limited] --reason <text> --by <actor>
//
// Idempotent: an open circuit of the provider is left as it is (answer alreadyOpen). The circuit is the machine.sqlite
// provider_health row (scripts/machine/provider-circuit.mjs; alpha.3), written once per episode with its
// provider_health_events row; the pools' backoff rows (pool_backoff, the controller's AIMD caps) are read back into the
// answer. A caller may inject the machine handle (`machine`); otherwise the machine.sqlite of this host is opened.
import { allocationMs } from '../../../engine/config.mjs';
import { openMachine, poolBackoff } from '../../../engine/db/machine.mjs';
import { readProviderCircuit, writeProviderCircuit } from '../../machine/provider-circuit.mjs';
import { refuse } from '../kernel-authority.mjs';

const KINDS = new Set(['quota', 'rate-limited']);
const providerKey = (p) => String(p ?? '').trim().toLowerCase().replace(/-agent$/, '');

export default {
  verb: 'provider-backoff',
  required: ['provider', 'reason', 'by'],
  kernelOnly: true,
  flags: ['open-circuit'],
  usage: '  provider-backoff --provider <p> --open-circuit [--kind quota|rate-limited] --reason <text> --by <actor>   open the provider circuit a persisting rate limit calls for (idempotent)',
  run({ args, emit, machine = null }) {
    const now = Date.now();
    const key = providerKey(args.provider);
    if (!key) throw refuse('--provider names no provider', 'provider-missing');
    if (!args['open-circuit']) throw refuse('provider-backoff needs --open-circuit', 'action-missing');
    const kind = String(args.kind ?? 'quota');
    if (!KINDS.has(kind)) throw refuse(`--kind must be one of ${[...KINDS].join(', ')}`, 'kind-invalid');
    const m = machine ?? openMachine();
    try {
    const pools = (poolBackoff(m) ?? []).filter((r) => providerKey(r.pool) === key).map((r) => ({ pool: r.pool, untilAt: r.until_at, strikes: r.strikes, reason: r.reason }));
    const stored = readProviderCircuit(key, { machine: m });
    const open = stored && stored.value?.status === 'unavailable' && (stored.expiresAt == null || stored.expiresAt > now)
      ? { ...stored.value, expiresAt: stored.expiresAt } : null;
    if (open) {
      const out = { ok: true, provider: key, alreadyOpen: true, failureKind: open.failureKind ?? null, expiresAt: open.expiresAt ?? null, pools };
      emit(out, `provider-backoff ${key}: circuit already open (${open.failureKind ?? '?'}) until ${open.expiresAt ? new Date(open.expiresAt).toISOString() : 'explicit recovery'}`, args.json);
      return;
    }
    const cooldownMs = allocationMs(`cooldownMs.${kind}`);
    const recover = kind === 'quota' ? `api provider-health --provider ${key} --quota-probe` : `api provider-health --provider ${key} --recover --reason <text> --probe`;
    const value = { schema: 'starci/provider-health@1', provider: key, status: 'unavailable', failureKind: kind, strikeLimit: 1, model: null, jobId: null,
      step: 'reconciler-pool-backoff', signal: null, detail: String(args.reason).slice(0, 400), observedAt: now, failures: 1, trips: 1, cooldownMs,
      openedBy: String(args.by).slice(0, 80), recover };
    writeProviderCircuit(key, { value, expiresAt: now + cooldownMs, machine: m });
    const out = { ok: true, provider: key, opened: true, failureKind: kind, expiresAt: now + cooldownMs, pools };
    emit(out, `provider-backoff ${key}: ${kind} circuit opened until ${new Date(now + cooldownMs).toISOString()} (${value.detail}); clears with ${recover}`, args.json);
    } finally { if (!machine) m.close(); }
  },
};
