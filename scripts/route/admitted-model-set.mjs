// Preserve qualification/probation lineage, then project the common admission ordering.
import { resolveLaunchModel } from '../agent/models.mjs';
import { planAgentAdmission } from '../agent/admission.mjs';

export function admittedModelSet({ evaluated, w, args, difficulty, registry, runtimes, effort }) {
  // Quota-aware order among the eligible of one mode: available before limited,
  // declared order otherwise (a stable sort).
  const availabilityRank = e => (e.availability?.state === 'limited' ? 1 : 0);
  const byMode = mode => evaluated.filter(e => e.eligible && e.mode === mode)
    .map((e, i) => ({ e, i })).sort((a, b) => availabilityRank(a.e) - availabilityRank(b.e) || a.i - b.i).map(x => x.e);
  const qualified = byMode('qualified');
  const probationEligible = byMode('probation');
  const kernelFunctionEligible = byMode('kernel-function');
  // providerFilter: qualified set wins outright; else probation admits exactly
  // ONE target per durable job (non-kernel) — the declared chain is still the
  // fallback order — while kernel functions keep all eligible members.
  let pickedSet, rule;
  if (qualified.length) { pickedSet = qualified; rule = 'decisionFlow.qualified-first: measured qualification passed'; }
  else if (probationEligible.length) {
    pickedSet = probationEligible;
    rule = 'decisionFlow.probation-fallback: no qualification evidence; scoped probation admitted';
  } else if (kernelFunctionEligible.length) {
    pickedSet = kernelFunctionEligible;
    rule = 'decisionFlow.kernel-function: kernel function on the sol-think order; no qualification record required';
  } else { pickedSet = []; rule = 'decisionFlow.verdict: no eligible model'; }

  const admission = planAgentAdmission({ role: w.modelFunction ? 'kernel' : 'op', scopeId: `route-model:${args.kind}:${difficulty}`,
    kind: args.kind, difficulty,
    registry, runtimes, allowGroup: pickedSet.map((entry) => ({ provider: entry.c.provider, model: resolveLaunchModel(entry.c.id, difficulty, { runtimes }).modelId,
      pool: entry.c.id, target: entry.c.target, effort, eligibility: { eligible: entry.eligible, mode: entry.mode, reasons: entry.reasons } })) });
  const eligibleIds = admission.eligible.map((candidate) => candidate.pool);
  pickedSet = eligibleIds.map((id) => pickedSet.find((entry) => entry.c.id === id)).filter(Boolean);
  return { pickedSet, rule, admission };
}
