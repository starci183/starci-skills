// critic-pick.mjs — the Critic's model comes from its tier, never from a hand pin. The tier is the one tiers.yaml seats names
// for the critic seat; the independence rule is a hard filter on top of the picker's own: no member of the maker's provider
// is a candidate. A tier with no independent member refuses the critique with a typed code, and the maker's provider never
// judges. The remaining members go to the one picker (scripts/agent/admission.mjs through startAgent) as the allow group.
import { adapterModelAuthority, loadAdapter } from '../agent/model-registry.mjs';
import { tierMembers, tierOfSeat, tierSettings } from '../agent/tiers.mjs';
import { criticContract } from './critic-contract.mjs';

const identityOf = (maker) => (typeof maker === 'string' ? { provider: maker.toLowerCase(), model: null } : maker);

/**
 * The independent Critic for a product made by `maker` (a provider name, or {provider, model}; null when unknown):
 * {critic: {provider, model, effort, timeoutMs, tier, author, allowGroup}} or {error, code}. `drawLoop` is allocation.drawLoop.
 */
export function criticFor(drawLoop, maker = null, { settings = tierSettings(), contract = criticContract() } = {}) {
  const identity = identityOf(maker);
  const author = identity?.provider ? { ...identity, provider: identity.provider.toLowerCase(), modelAuthority: adapterModelAuthority(loadAdapter(identity.provider).card) } : null;
  if (!author) return { code: contract.codes.authorUnknown, error: 'the maker provider is unknown; independent critique cannot be admitted' };
  const tier = tierOfSeat(contract.seat, settings);
  if (!tier) return { code: contract.codes.noIndependentMember, error: `tiers.yaml seats names no tier for the ${contract.seat} seat` };
  const members = tierMembers(tier, { settings });
  const independent = members.filter((member) => member.provider !== author.provider);
  if (!independent.length) {
    return { code: contract.codes.noIndependentMember,
      error: `no independent critic available: the ${tier} tier holds no member of another provider than the maker (${author.provider}); the maker's provider never judges its own product` };
  }
  const [first] = independent;
  return { critic: { provider: first.provider, model: first.model, effort: first.effort, timeoutMs: Number(drawLoop?.criticTimeoutMs), tier, author,
    allowGroup: independent.map(({ provider, model, effort, pool }) => ({ provider, model, effort, pool })) } };
}
