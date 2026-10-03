// Smoke routes obey the same role floors and independent Critic configuration as real launchers.
import { runtimeProfile } from '../../engine/config.mjs';
import { loadPrices, priceOf } from '../lib/llm-usage.mjs';
import { admissionQualityFloor } from '../lib/agent-admission.mjs';
import { criticFor } from '../work/draw-critic.mjs';

const TIER_ORDER = ['easy', 'medium', 'hard', 'insane'];

/** The cheapest priced, pinned model meeting all smoke control-plane role floors, with its tier effort. */
export function noopAgent({ runtimes = runtimeProfile(), prices = loadPrices() } = {}) {
  const policy = runtimes?.allocation?.admission, order = policy?.qualityOrder ?? [];
  const floors = ['kernel', 'supervisor', 'worker'].map((role) => order.indexOf(admissionQualityFloor(role, null, policy)));
  if (floors.some((rank) => rank < 0)) return { error: 'smoke role quality floors are not configured' };
  const minimum = Math.max(...floors), found = [];
  for (const [pool, def] of Object.entries(runtimes?.runtimes ?? {})) {
    for (const [tier, model] of Object.entries(def?.models ?? {})) {
      if (order.indexOf(runtimes?.models?.[model]?.tier) < minimum) continue;
      const price = priceOf(model, prices);
      if (!price || !Number.isFinite(Number(price.input)) || !Number.isFinite(Number(price.output)) || price.input == null || price.output == null) continue;
      found.push({ provider: def.provider, model, effort: def.effort?.[tier] ?? null, pool, tier, usdPerMTok: Number(price.input) + Number(price.output) });
    }
  }
  const rank = (tier) => { const i = TIER_ORDER.indexOf(tier); return i < 0 ? TIER_ORDER.length : i; };
  found.sort((a, b) => a.usdPerMTok - b.usdPerMTok || rank(a.tier) - rank(b.tier) || a.pool.localeCompare(b.pool));
  return found[0] ?? { error: 'no registry.yaml pool pins a priced model meeting smoke role quality floors' };
}

/** The smoke's Op is the known author; the existing draw-loop owner chooses its independent Critic. */
export const smokeCriticOf = (author) => criticFor(runtimeProfile()?.allocation?.drawLoop, author);
