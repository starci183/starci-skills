// route-model-gates.mjs — the qualification and probation gates of route-model.mjs (modules/models/selection.yaml §4-5): why a runtime's
// qualification evidence does not admit a workload, and why a workload cannot run on probation. Pure over the rules route-model loads.

const rank = (order, v) => order.indexOf(v);

function qualificationIdentityReasons(runtime, evidence) {
  const r = [];
  const selModel = runtime.model ?? runtime.target;
  if (!evidence.provider || !evidence.model || !evidence.version) r.push('model identity qualification is incomplete');
  if (evidence.provider !== runtime.provider || evidence.model !== selModel || !runtime.version || evidence.version !== runtime.version)
    r.push('qualification does not match selected runtime identity');
  return r;
}

function qualificationRecordReasons(evidence) {
  const r = [];
  if (!evidence.suite || !evidence.measuredAt || typeof evidence.outcomes !== 'object' || !evidence.outcomes)
    r.push('measurable qualification evidence is incomplete');
  if (evidence.verified !== true || evidence.receipt?.schema !== 'starci/model-evaluation-receipt@1' || !evidence.receipt?.artifact?.sha256)
    r.push('verified evaluator artifact receipt is missing');
  return r;
}

function qualificationTimeReasons(evidence) {
  const r = [];
  const measured = Date.parse(evidence.measuredAt), expires = Date.parse(evidence.expiresAt ?? '');
  if (!Number.isFinite(measured) || measured > Date.now()) r.push('qualification date is invalid');
  if ((evidence.expiresAt && !Number.isFinite(expires)) || (Number.isFinite(expires) && expires <= Date.now())) r.push('qualification is stale');
  return r;
}

function qualificationProvenanceReasons(evidence) {
  const r = [];
  if (!['independent-eval', 'verified-runtime-eval'].includes(evidence.source) || evidence.attestation === 'self-claimed')
    r.push('qualification provenance is not trusted');
  return r;
}

function qualificationWorkloadReasons(evidence, w, rules) {
  const r = [];
  if (!rules.riskOrder.includes(w.risk)) r.push(`unknown workload risk ${w.risk || '(empty)'}`);
  if (!rules.floorOrder.includes(w.qualityFloor)) r.push(`unknown quality floor ${w.qualityFloor || '(empty)'}`);
  if (!(evidence.workloads ?? []).some(x => x === w.kind || x === '*')) r.push(`workload ${w.kind || '(unknown)'} is not qualified`);
  if (!(evidence.domains ?? []).some(x => x === w.domain || x === '*')) r.push(`domain ${w.domain} is not qualified`);
  for (const t of w.tools) if (!(evidence.tools ?? []).includes(t)) r.push(`required tool ${t} is not qualified`);
  if (w.contextTokens > Number(evidence.maxContextTokens ?? 0)) r.push('required context exceeds qualified context');
  if (rank(rules.floorOrder, evidence.qualityFloor) < rank(rules.floorOrder, w.qualityFloor)) r.push(`quality floor ${w.qualityFloor} is not met`);
  if (rank(rules.riskOrder, evidence.maxRisk) < rank(rules.riskOrder, w.risk)) r.push(`risk ${w.risk} is not qualified`);
  return r;
}

function qualificationOutcomeReasons(evidence) {
  const r = [];
  if (evidence.outcomes?.status !== 'pass' || Number(evidence.outcomes?.cases ?? 0) < 1
    || Number(evidence.outcomes?.passRate ?? 0) < Number(evidence.thresholds?.minPassRate ?? 1))
    r.push('qualification outcomes do not pass');
  return r;
}

export function qualificationReasons(runtime, evidence, w, rules) {
  if (evidence?.schema !== 'starci/model-qualification@1') return ['model qualification evidence is missing'];
  return [
    ...qualificationIdentityReasons(runtime, evidence),
    ...qualificationRecordReasons(evidence),
    ...qualificationTimeReasons(evidence),
    ...qualificationProvenanceReasons(evidence),
    ...qualificationWorkloadReasons(evidence, w, rules),
    ...qualificationOutcomeReasons(evidence),
  ];
}

export function probationAdmissionReasons(w, rules) {
  // localProbationAllowed + probation recordGates as they apply to a freshly
  // created record (fresh scope: remainingAttempts 2, workloads [w.kind]).
  const r = [];
  if (w.approved !== true) r.push('probation requires an approved workflow');
  if (w.scope !== 'local') r.push('probation requires local scope');
  if (w.noExternalEffects !== true) r.push('probation forbids external effects');
  if (w.strictMachineGates !== true) r.push('probation requires declared machine gates');
  if (w.freshIndependentReview !== true) r.push('probation requires fresh independent review');
  if (rules.highKinds.has(w.kind) || ['high', 'critical'].includes(w.risk) || rules.probationFloorBan.includes(w.qualityFloor))
    r.push('probation cannot satisfy elevated quality or risk');
  if (!rules.riskOrder.includes(w.risk)) r.push(`unknown workload risk ${w.risk || '(empty)'}`);
  if (!rules.floorOrder.includes(w.qualityFloor)) r.push(`unknown quality floor ${w.qualityFloor || '(empty)'}`);
  if (!w.probationEligible) r.push('workload shape is not probation-eligible (needs machine checks + fresh review, or a kernel function)');
  return r;
}
