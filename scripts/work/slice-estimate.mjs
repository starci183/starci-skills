// slice-estimate.mjs — the deterministic slice sizing `api estimate` reports and the work-graph validator
// bounds slices with. Every number lives in modules/models/runtimes.yaml allocation.slicing; this module
// holds only the computation.
import { allocationSettings, slicingGears } from '../../engine/config.mjs';

// The plural `from:` keys of allocation.slicing.size.<class> against the singular count names the weights use.
export const SIZE_MEASURE_KEYS = Object.freeze({ files: 'file', assertions: 'assertion', components: 'component', records: 'record' });
// Size classes that never fan out, whatever the gear: the owner's table applies to the declared classes only.
const SINGLE_AGENT_SIZES = ['s', 'm'];

const refuse = (message, code) => Object.assign(new Error(message), { code });

/** allocation.slicing, checked whole; refuses slicing-undeclared when a part is missing. */
export function slicingContract() {
  const slicing = allocationSettings().slicing ?? {};
  const target = Array.isArray(slicing.targetMinutes) ? slicing.targetMinutes.map(Number) : [];
  const maxSlices = Number(slicing.maxSlices);
  const sizes = slicing.size;
  if (target.length !== 2 || target.some((n) => !Number.isFinite(n) || n <= 0)
    || !Number.isFinite(maxSlices) || maxSlices < 1
    || !sizes || typeof sizes !== 'object' || Array.isArray(sizes) || !Object.keys(sizes).length) {
    throw refuse('modules/models/runtimes.yaml allocation.slicing must declare {weights, targetMinutes:[lo,hi], maxSlices, gears, size}', 'slicing-undeclared');
  }
  return { weights: slicing.weights ?? {}, target, maxSlices, sizes, gears: slicingGears() };
}

/** Counts keyed by the singular measure names from {files, assertions, components, records} (plural or singular keys). */
export function countsOf(measure = {}) {
  const out = {};
  for (const [plural, single] of Object.entries(SIZE_MEASURE_KEYS)) out[single] = Math.max(0, Number(measure[plural] ?? measure[single]) || 0);
  return out;
}

/**
 * W = sum(weight * count) agent-minutes; size = the largest declared class any one count reaches, else `s`
 * inside targetMinutes[0] and `m` above it.
 */
export function sizeOf(counts, contract = slicingContract()) {
  const { weights, target, sizes } = contract;
  if (!Object.values(counts).some((n) => n > 0)) throw refuse('estimate needs at least one of --files/--assertions/--components/--records', 'estimate-no-measure');
  const unweighted = Object.entries(counts).filter(([k, n]) => n > 0 && !Number.isFinite(Number(weights[k])));
  if (unweighted.length) throw refuse(`modules/models/runtimes.yaml allocation.slicing.weights declares no weight for ${unweighted.map(([k]) => k).join(', ')}`, 'slicing-undeclared');
  const minutes = Object.entries(counts).reduce((sum, [k, n]) => sum + (Number(weights[k]) || 0) * n, 0);
  let size = minutes <= target[0] ? 's' : 'm';
  for (const [name, card] of Object.entries(sizes)) {
    if (Object.entries(card?.from ?? {}).some(([key, bound]) => {
      const measure = SIZE_MEASURE_KEYS[key];
      return measure && Number.isFinite(Number(bound)) && counts[measure] >= Number(bound);
    })) size = name;
  }
  return { minutes, size };
}

/** agentsRequested: 1 for s/m, else allocation.slicing.size.<class>.agents[gear]. */
export function agentsFor(size, gear, contract = slicingContract()) {
  if (SINGLE_AGENT_SIZES.includes(size)) return 1;
  const declared = Number(contract.sizes[size]?.agents?.[gear]);
  if (!Number.isInteger(declared) || declared < 1) throw refuse(`modules/models/runtimes.yaml allocation.slicing.size.${size}.agents declares no agent count for gear ${gear}`, 'slicing-undeclared');
  return declared;
}

/**
 * One slice's bound: the estimate at the widest declared gear with no path closure. `overTarget` means that
 * even then each agent's share exceeds targetMinutes[1], so the slice is cut before it is built.
 */
export function sliceBound(measure, contract = slicingContract()) {
  const gear = Math.max(...contract.gears);
  const { minutes, size } = sizeOf(countsOf(measure), contract);
  const agents = Math.max(1, Math.min(agentsFor(size, gear, contract), contract.maxSlices));
  const perSliceMinutes = Math.round((minutes / agents) * 10) / 10;
  return { minutes, size, gear, agents, perSliceMinutes, targetMinutes: contract.target, overTarget: perSliceMinutes > contract.target[1] };
}
