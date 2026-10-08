// Smoke routes obey the same role floors and independent Critic configuration as real launchers.
import { runtimeProfile } from '../../engine/config.mjs';
import { loadPrices, priceOf } from '../lib/llm-usage.mjs';
import { admissionQualityFloor } from '../lib/agent-admission.mjs';
import { criticFor } from '../work/critic-pick.mjs';
import { tierSettings } from '../agent/tiers.mjs';

/** The priced USD per million tokens (input + output) of `model`, or null when it has no complete price. */
function usdPerMTok(model, prices) {
  const price = priceOf(model, prices);
  if (price?.input == null || price.output == null) return null;
  const total = Number(price.input) + Number(price.output);
  return Number.isFinite(Number(price.input)) && Number.isFinite(Number(price.output)) ? total : null;
}

/** The cheapest priced tier member meeting all smoke control-plane role floors, with its tier effort. */
export function noopAgent({ runtimes = runtimeProfile(), prices = loadPrices(), settings = tierSettings() } = {}) {
  const policy = runtimes?.allocation?.admission, order = policy?.qualityOrder ?? [];
  const floors = ['kernel', 'supervisor', 'worker'].map((role) => order.indexOf(admissionQualityFloor(role, null, policy)));
  if (floors.some((rank) => rank < 0)) return { error: 'smoke role quality floors are not configured' };
  const minimum = Math.max(...floors), found = [];
  const poolOf = (provider) => Object.entries(runtimes?.runtimes ?? {}).find(([, def]) => def?.provider === provider)?.[0] ?? null;
  for (const [tier, chain] of Object.entries(settings.tiers)) {
    for (const member of chain) {
      const pool = poolOf(member.agent), cost = usdPerMTok(member.model, prices);
      if (!pool || cost === null || order.indexOf(runtimes?.models?.[member.model]?.tier) < minimum) continue;
      found.push({ provider: member.agent, model: member.model, effort: member.effort ?? null, pool, tier, usdPerMTok: cost });
    }
  }
  // Equal prices take the lowest tier (the smallest effort the owner declared), then the pool name.
  const rank = (tier) => { const i = [...settings.tierOrder].reverse().indexOf(tier); return i < 0 ? settings.tierOrder.length : i; };
  found.sort((a, b) => a.usdPerMTok - b.usdPerMTok || rank(a.tier) - rank(b.tier) || a.pool.localeCompare(b.pool));
  return found[0] ?? { error: 'no tier member of modules/models/tiers.yaml is priced and meets the smoke role quality floors' };
}

/** The smoke's Op is the known author; the existing draw-loop owner chooses its independent Critic. */
export const smokeCriticOf = (author) => criticFor(runtimeProfile()?.allocation?.drawLoop, author);
