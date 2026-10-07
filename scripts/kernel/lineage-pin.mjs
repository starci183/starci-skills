// lineage-pin.mjs — the one rule for a Kernel-recorded pool pin against a job's own launch and retry history (modules/kernel/op-incident-policy.yaml
// agentSwitch). The lineage demotes or excludes a pool for a job after pool-attributable failures; a pin the Kernel recorded (a job's kernelModel, or
// the workflow's op-override, starci kernel op-override with its decision) is the Kernel's deliberate acceptance of that history, so it lifts the
// exclusion for the pinned pool (the demotion only reorders the pick, which the pin's `only` selector already settles). route (scripts/kernel/verbs/route.mjs) and dispatch (verbs/shared/dispatch-plan.mjs) both read it:
// the circuit, capacity, role and host-tool filters still apply to the pin, and a pin outside the op's tier chain is still refused.
import { kernelOverrideFor } from './kernel-authority.mjs';

/** The pool the Kernel pinned for this job's op: the job's own kernelModel, else the workflow's op-override model (kernel-authority.mjs), else null. */
export const recordedPinOf = (db, workflowId, op, payload = {}) => payload.kernelModel ?? kernelOverrideFor(db, workflowId, op, payload)?.model ?? null;

/** Whether the recorded `pin` names the pool, by any of its names (pool id, target). */
export const pinNamesPool = (pin, names) => Boolean(pin) && names.filter(Boolean).includes(pin);

/**
 * The lineage adjustment with the pinned pool lifted out of `exclude` and the lifted names in `overridden`; `lineage` itself when nothing is
 * lifted. `names` are the names of the pinned pool (its id and its target).
 */
export function liftPinnedPool(lineage, pin, names) {
  if (!lineage || !pinNamesPool(pin, names)) return lineage;
  const named = (entry) => names.includes(entry);
  const overridden = lineage.exclude.filter(named);
  if (!overridden.length) return lineage;
  return { ...lineage, exclude: lineage.exclude.filter((entry) => !named(entry)), overridden: [...new Set(overridden)] };
}
