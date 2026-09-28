// api provider-backoff — open a provider circuit when a rate limit persists (reconciler Resource controller, adaptive
// per-pool concurrency; lane rc-gc-resource). The controller halves a rate-limited pool's parallelism down to a floor
// (scripts/lib/pool-backoff.mjs); when the provider still rate-limits at the floor for persistMs it opens the circuit
// here, the same provider-health row `api dispatch` and `api route` already refuse on, so no new launch reaches the
// provider until it expires (allocation.cooldownMs.<kind>) or its quota probe / the Kernel's --recover clears it.
//
//   provider-backoff --provider <p> --open-circuit [--kind quota|rate-limited] --reason <text> --by <actor>
//
// Idempotent: an open circuit of the provider is left as it is (answer alreadyOpen). Writes the signals row
// (scope provider-health) and nothing else.
import { allocationMs } from '../../../engine/config.mjs';
import { PROVIDER_HEALTH_SCOPE, providerCircuitOf } from '../../agent/models.mjs';
import { refuse } from '../kernel-authority.mjs';

const KINDS = new Set(['quota', 'rate-limited']);
const providerKey = (p) => String(p ?? '').trim().toLowerCase().replace(/-agent$/, '');

export default {
  verb: 'provider-backoff',
  required: ['provider', 'reason', 'by'],
  kernelOnly: true,
  flags: ['open-circuit'],
  usage: '  provider-backoff --provider <p> --open-circuit [--kind quota|rate-limited] --reason <text> --by <actor>   open the provider circuit a persisting rate limit calls for (idempotent)',
  run({ ledger, args, emit }) {
    const db = ledger.db, now = Date.now();
    const key = providerKey(args.provider);
    if (!key) throw refuse('--provider names no provider', 'provider-missing');
    if (!args['open-circuit']) throw refuse('provider-backoff needs --open-circuit', 'action-missing');
    const kind = String(args.kind ?? 'quota');
    if (!KINDS.has(kind)) throw refuse(`--kind must be one of ${[...KINDS].join(', ')}`, 'kind-invalid');
    const open = providerCircuitOf(db, key, now, { credential: null });
    if (open) {
      const out = { ok: true, provider: key, alreadyOpen: true, failureKind: open.failureKind ?? null, expiresAt: open.expiresAt ?? null };
      emit(out, `provider-backoff ${key}: circuit already open (${open.failureKind ?? '?'}) until ${open.expiresAt ? new Date(open.expiresAt).toISOString() : 'explicit recovery'}`, args.json);
      return;
    }
    const cooldownMs = allocationMs(`cooldownMs.${kind}`);
    const recover = kind === 'quota' ? `api provider-health --provider ${key} --quota-probe` : `api provider-health --provider ${key} --recover --reason <text> --probe`;
    const value = { schema: 'starci/provider-health@1', provider: key, status: 'unavailable', failureKind: kind, strikeLimit: 1, model: null, jobId: null,
      step: 'reconciler-pool-backoff', signal: null, detail: String(args.reason).slice(0, 400), observedAt: now, failures: 1, trips: 1, cooldownMs,
      openedBy: String(args.by).slice(0, 80), recover };
    db.prepare(`INSERT INTO signals(scope,key,holder_pid,token,value_json,at,expires_at) VALUES(?,?,NULL,NULL,?,?,?)
      ON CONFLICT(scope,key) DO UPDATE SET holder_pid=NULL,token=NULL,value_json=excluded.value_json,at=excluded.at,expires_at=excluded.expires_at`)
      .run(PROVIDER_HEALTH_SCOPE, key, JSON.stringify(value), now, now + cooldownMs);
    const out = { ok: true, provider: key, opened: true, failureKind: kind, expiresAt: now + cooldownMs };
    emit(out, `provider-backoff ${key}: ${kind} circuit opened until ${new Date(now + cooldownMs).toISOString()} (${value.detail}); clears with ${recover}`, args.json);
  },
};
