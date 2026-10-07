// Tier lookups over modules/models/tiers.yaml (+ config.yaml `models`): which chain a seat, an operation or a
// caller takes. The data lives there; this module turns it into concrete members and never states a model.
import { effectiveTiers } from '../../engine/model-config.mjs';
import { inspectOwnerConfig, runtimeProfile } from '../../engine/config.mjs';
import { loadModelRegistry } from './model-registry.mjs';

/** The effective tier settings: shipped tiers.yaml with the owner's `models` block (tolerant read: an invalid file reads as absent). */
export function tierSettings({ config, registry } = {}) {
  const owner = config === undefined ? inspectOwnerConfig().config : config;
  const profile = registry ? { ...runtimeProfile(), ...registry, runtimes: registry.pools ?? {} } : runtimeProfile();
  try { return effectiveTiers(owner, profile); } catch { return effectiveTiers(null, profile); }
}

const poolOf = (registry, provider) => Object.entries(registry?.pools ?? {}).find(([, pool]) => pool.provider === provider);

/** One tier's ordered members as launch targets: {id, provider, agent, model, effort, pool, target, tier}. */
export function tierMembers(tier, { settings = tierSettings(), registry = loadModelRegistry() } = {}) {
  const chain = settings.tiers[tier];
  if (!Array.isArray(chain)) return [];
  return chain.map((member) => {
    const found = poolOf(registry, member.agent);
    return { id: `${member.agent}/${member.model}`, provider: member.agent, agent: member.agent, model: member.model, effort: member.effort ?? null,
      pool: found?.[0] ?? null, target: found?.[1]?.target ?? found?.[0] ?? null, tier };
  });
}

/** The tier a seat takes (supervisor, kernel, planner, validator, kernelManager), or null when the seat is not mapped. */
export const tierOfSeat = (seat, settings = tierSettings()) => settings.seats[seat] ?? null;

/** The tier an operation takes: its kind's declared tier (drawing), else the tier of its difficulty. */
export const tierOfOp = ({ kind, difficulty }, settings = tierSettings()) => settings.kindTiers[kind] ?? settings.difficulty[difficulty] ?? null;

/**
 * The member core-debug runs on for the chat provider that started the workflow: that provider's member of the first
 * tier of callerSeatTiers that has one, else of the highest tier (tierOrder) that has one. Null when the provider sits in no tier.
 */
export function callerMember(provider, { settings = tierSettings(), registry = loadModelRegistry() } = {}) {
  const order = [...settings.callerSeatTiers, ...settings.tierOrder.filter((tier) => !settings.callerSeatTiers.includes(tier))];
  for (const tier of order) {
    const found = tierMembers(tier, { settings, registry }).find((member) => member.provider === provider);
    if (found) return found;
  }
  return null;
}
