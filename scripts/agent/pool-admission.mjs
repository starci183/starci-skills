import { loadModelRegistry, loadAdapter, adapterModelAuthority } from './model-registry.mjs';
import { selectAdmission, admissionQualityFloor } from '../lib/agent-admission.mjs';

export function selectPoolAdmission({ rt, targets, allowTargets, capacity, bias, kind, role,
  difficulty, scopeId, attemptId, now, modelRegistry, modelsDir, qualityFloor, backoffCaps, launchModel }) {
  if (!capacity) {
    const constrained = bias?.require || bias?.reserveOverride
      || [...(bias?.prefer ?? []), ...(bias?.avoid ?? [])].some((item) => typeof item !== 'string');
    return { admission: { ok: false, reason: 'live-evidence-required', planOnly: true },
      constraintError: constrained ? 'concrete owner constraints need live admission evidence' : null };
  }
  const catalog = modelRegistry ?? loadModelRegistry(modelsDir);
  const candidates = targets.map((target) => {
    const pool = rt.runtimes[target], cap = capacity[target];
    const { modelId, effort } = launchModel(target);
    const registered = catalog?.models?.[modelId];
    return { id: target, pool: target, target: pool.target ?? target, agent: pool.provider,
      provider: pool.provider, account: cap?.quota?.account ?? 'default', model: modelId, effort,
      modelAuthority: adapterModelAuthority(loadAdapter(pool.provider, modelsDir).card),
      qualityFloor: registered?.provider === pool.provider ? registered.tier : null,
      eligibility: { eligible: true, mode: 'operation-policy' }, quota: cap?.quota,
      capacity: { running: cap?.running, maxParallel: Math.min(pool.maxParallel,
        Number.isInteger(backoffCaps[target]) ? backoffCaps[target] : pool.maxParallel),
        openIncident: cap?.openIncident === true, ...(cap?.blockedUntil === undefined ? {} : { blockedUntil: cap.blockedUntil }) } };
  });
  const selector = (item) => typeof item === 'string' ? { pool: item } : item;
  const admission = selectAdmission({ request: { role: 'op', kind, difficulty,
    scopeId: scopeId ?? bias?.reserveOverride?.scopeId ?? `pool-plan:${kind ?? role}`,
    attemptId: attemptId ?? scopeId ?? `pool-plan:${kind ?? role}`,
    qualityFloor: qualityFloor ?? admissionQualityFloor('op', difficulty, rt?.allocation?.admission),
    allowGroup: allowTargets.flatMap((target) => {
      const provider = rt.runtimes?.[target]?.provider;
      const model = launchModel(target).modelId;
      return provider && model ? [{ provider, model }] : [];
    }),
    prefer: (bias?.prefer ?? []).map(selector), avoid: (bias?.avoid ?? []).map(selector),
    require: bias?.require ?? null, reserveOverride: bias?.reserveOverride ?? null }, candidates,
    policy: rt?.allocation?.admission, now });
  return { admission, constraintError: null };
}
