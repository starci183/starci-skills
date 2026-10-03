// Quota dispatch returns a normalized provider/account observation. All available windows and
// their freshness participate in allocation.admission; unknown is never normal admission.
// Direct probes preserve their external API contracts; this dispatch adds no token estimates.
import { isMain } from '../../lib/is-main.mjs';
import { probe as probeClaude } from './claude.mjs';
import { probe as probeCodex } from './codex.mjs';
import { probe as probeDevin } from './devin.mjs';
import { normalizeProvider } from '../../lib/provider.mjs';
import { allocationSettings } from '../../../engine/config.mjs';
import { normalizeQuotaSnapshot } from './snapshot.mjs';

const PROBES = {
  claude: probeClaude,
  codex: probeCodex,
  devin: probeDevin,
};

export function probeQuota(provider, opts = {}) {
  const key = normalizeProvider(provider);
  const policy = opts.policy ?? allocationSettings()?.admission;
  const clock = typeof opts.now === 'function' ? opts.now : () => opts.now ?? Date.now();
  const normalized = (result) => {
    const now = clock();
    return normalizeQuotaSnapshot({ provider: key, account: opts.account ?? 'default', observedAt: now, ...result }, { policy, now });
  };
  const fn = PROBES[key];
  if (!fn) {
    return normalized({ state: 'unknown', detail: `no quota probe registered for provider '${provider}'` });
  }
  try {
    return normalized(fn(opts));
  } catch (e) {
    return normalized({ state: 'unknown', detail: `quota probe for '${key}' threw: ${e?.message ?? e}` });
  }
}

export function probeAll(opts = {}) {
  const out = {};
  for (const name of Object.keys(PROBES)) out[name] = probeQuota(name, opts);
  return out;
}

// Internal entry: spawned by scripts/agent/credential-probe.mjs; not invoked directly.
// Args: [provider|--all] -> JSON.
const entry = isMain(import.meta.url);
if (entry) {
  const target = process.argv[2];
  if (!target || target === '--all') console.log(JSON.stringify(probeAll(), null, 2));
  else console.log(JSON.stringify(probeQuota(target), null, 2));
}
