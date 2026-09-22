// scripts/api/quota/index.mjs — per-provider quota/viability probe dispatch.
//
// Pinned contract (o2 consumes):
//   probeQuota(provider) -> { state, usedPercent, detail, auth?, failureKind?,
//                             allowLaunchAttempt? }
//     state: 'ok' | 'limited' | 'dead' | 'unknown'
//       'dead'    = hard-ineligible, router must not select the provider
//       'limited' = usable but constrained (near cap / refreshable auth fault)
//       'unknown' = probe could not decide; NEVER blocks routing
//     A refreshable stale token reports limited/auth=refreshable and may receive
//     one real launch. A confirmed launch auth rejection is persisted by the
//     kernel's provider-health circuit, which overrides this preflight probe
//     for every pool sharing the provider credential.
//     usedPercent: number | null (weekly window percent when the probe sees it)
//     detail: human-readable reason string
//
// Provider names are normalized: lowercase, '-agent' suffix stripped.
import { pathToFileURL } from 'node:url';
import { probe as probeClaude } from './claude.mjs';
import { probe as probeCodex } from './codex.mjs';
import { probe as probeDevin } from './devin.mjs';
import { probe as probeQwen } from './qwen.mjs';

const PROBES = {
  claude: probeClaude,
  codex: probeCodex,
  devin: probeDevin,
  qwen: probeQwen,
};

export function normalizeProvider(provider) {
  const p = String(provider ?? '').trim().toLowerCase();
  return p.replace(/-agent$/, '');
}

export function probeQuota(provider) {
  const key = normalizeProvider(provider);
  const fn = PROBES[key];
  if (!fn) {
    return { state: 'unknown', usedPercent: null, detail: `no quota probe registered for provider '${provider}'` };
  }
  try {
    return fn();
  } catch (e) {
    return { state: 'unknown', usedPercent: null, detail: `quota probe for '${key}' threw: ${e?.message ?? e}` };
  }
}

export function probeAll() {
  const out = {};
  for (const name of Object.keys(PROBES)) out[name] = probeQuota(name);
  return out;
}

// CLI: node scripts/api/quota/index.mjs [provider|--all] -> JSON
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const target = process.argv[2];
  if (!target || target === '--all') console.log(JSON.stringify(probeAll(), null, 2));
  else console.log(JSON.stringify(probeQuota(target), null, 2));
}
