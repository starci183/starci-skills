// Kernel launch routing: the Kernel seat takes the chain of its tier (modules/models/tiers.yaml seats.kernel). An owner pin
// (config.yaml kernel.agent / kernel.model) and an explicit `--agent` flag are the bias `only` over that chain: they keep the
// tier's member of that agent. Availability, quota, balance and the pick itself belong to the common picker
// (scripts/lib/tier-pick.mjs through scripts/agent/admission.mjs); this module only names the chain and the pin.
import { inspectOwnerConfig } from '../../engine/config.mjs';
import { loadAdapter } from '../agent/lib.mjs';
import { tierMembers, tierOfSeat, tierSettings } from '../agent/tiers.mjs';
import { matches } from '../lib/agent-admission.mjs';
import { text as trimmedOrNull } from '../lib/stack-declaration.mjs';

const memberLabel = (m) => `${m.agent}/${m.model ?? '(pool model)'}`;
const memberSummary = (m) => ({ agent: m.agent, model: m.model ?? null, effort: m.effort ?? null, runtimePool: m.runtimePool ?? null });

// The kernel's own effort pin; the global config effort is inherited only by a member whose card can pin one
// (start.modelArgument: worker-start takes --effort only with --model) - Devin takes neither.
const pinsEffort = (agent) => { try { return loadAdapter(agent)?.card?.start?.modelArgument !== false; } catch { return true; } };

/** The `only` selector an owner pin or an explicit agent names, or null when nothing pins the seat. */
function pinSelectorOf({ agentOverride, owner }) {
  if (agentOverride) return { routedBy: 'override', only: { provider: agentOverride }, label: `--agent ${agentOverride}` };
  const kc = owner.config?.kernel;
  const agent = trimmedOrNull(kc?.agent), model = trimmedOrNull(kc?.model);
  if (!agent && !model) return null;
  return { routedBy: 'config', only: { ...(agent ? { provider: agent } : {}), ...(model ? { model } : {}) }, label: `kernel pin ${agent ?? ''}${agent && model ? '/' : ''}${model ?? ''}` };
}

/** The goal's routing bias with the seat pin added as `only` (a pin is the owner's bias over the tier chain). */
export const kernelBias = (goalBias, route) => (route?.pin ? { ...goalBias, only: [...(goalBias?.only ?? []), route.pin] } : goalBias);

/**
 * What a Kernel plan reports as its lead: the member the plan's admission selected (a Claude member at 90 percent of its
 * tokens is skipped, so the lead is the next one), else the route; or the typed refusal when no member can start.
 */
export function planLeadOf(route, admission) {
  if (route.error || admission.ok) {
    const picked = admission.ok ? (route.members ?? []).find((member) => member.provider === admission.selected.provider && member.model === admission.selected.model) : null;
    return { lead: picked ?? route, refusal: null };
  }
  const skipped = (admission.pick?.dropped ?? []).map((row) => `${row.id} skipped — ${row.reason}`).join('; ');
  const step = route.pin ? 'kernel-pin-unavailable' : 'kernel-group-unavailable';
  return { lead: route, refusal: { step, error: `no member of tier ${route.tier} can start the Kernel (${admission.reason}): ${skipped || 'every member was refused'}` } };
}

export function createKernelRoute({ skillRoot, agentOverride, ownerRoot }) {
  const ownerFileLabel = (file) => ownerRoot === skillRoot ? file.replace(`${skillRoot}`, '').replace(/^[\\/]/, '') : file;

  function configOf(owner, effort) {
    const kc = owner.config?.kernel;
    return owner.config || owner.error ? { file: owner.config ? ownerFileLabel(owner.file) : null, agent: trimmedOrNull(kc?.agent), model: trimmedOrNull(kc?.model), effort,
      budgets: owner.config?.budgets ?? null, ...(owner.error ? { error: owner.error } : {}), ...(owner.invalid ? { configInvalid: owner.invalid } : {}) } : null;
  }

  async function resolveKernelRoute() {
    const owner = inspectOwnerConfig(ownerRoot);
    const settings = tierSettings({ config: owner.config });
    const tier = tierOfSeat('kernel', settings);
    const pin = pinSelectorOf({ agentOverride, owner });
    const kernelEffort = trimmedOrNull(owner.config?.kernel?.effort), globalEffort = trimmedOrNull(owner.config?.effort);
    const chain = tierMembers(tier, { settings }).map((member) => ({ ...member,
      effort: kernelEffort ?? member.effort ?? (pinsEffort(member.agent) ? globalEffort : null), runtimePool: member.target }));
    const config = configOf(owner, kernelEffort ?? globalEffort);
    const ownerConfig = owner.error || owner.invalid ? null : owner.config;
    const base = { routedBy: pin?.routedBy ?? 'tier', tier, warnings: [], config, ownerConfig, ...(pin ? { pin: pin.only } : {}) };
    const members = pin ? chain.filter((member) => matches(member, pin.only)) : chain;
    if (!members.length) return { ...base, agent: pin?.only.provider ?? null, model: pin?.only.model ?? null, errorStep: 'kernel-pin-unavailable',
      error: `${pin ? pin.label : 'the kernel tier'} names no member of tier ${tier} (${chain.map((member) => member.id).join(', ') || 'empty'}); an explicit agent keeps the tier's model` };
    return { ...base, ...members[0], agent: members[0].agent, members, fallThrough: true };
  }

  return { resolveKernelRoute, memberLabel, memberSummary };
}
