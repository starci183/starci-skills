// Pure new-admission rules; contract owner: modules/models/selection.yaml.
// Live probes, owner provenance and fenced reservations belong to the caller.
import { isPlainObject } from '../../engine/plain-object.mjs';
import { quotaTimestamp, quotaPolicyValid, inspectQuotaEvidence } from './quota-evidence.mjs';
import { pickFromTier } from './tier-pick.mjs';
import { LOGIN_EXPIRED_KIND } from './login-expired.mjs';

const ADMISSION_REASONS = Object.freeze([
  'admitted-plan',
  'allow-group-invalid',
  'author-invalid',
  'author-model-unverifiable',
  'bias-empties-chain',
  'candidate-duplicate',
  'candidate-invalid',
  'candidates-invalid',
  'capacity-full',
  'capacity-unknown',
  'constraint-invalid',
  'critic-independence-invalid',
  'critic-model-conflict',
  'critic-model-unverifiable',
  'critic-provider-conflict',
  'eligibility-not-proven',
  'incident-open',
  'independence-invalid',
  'no-eligible-candidate',
  'only-avoid-conflict',
  'only-model-unverifiable',
  'outside-allow-group',
  'owner-grant-full',
  'policy-invalid',
  'provider-blocked',
  'quality-floor-invalid',
  'quality-floor-not-met',
  'quota-exhausted',
  'quota-identity-mismatch',
  'quota-launch-blocked',
  'quota-normal-blocked',
  'quota-stale',
  'quota-unknown',
  'tokens-out',
  'request-invalid',
  'reserve-override-invalid',
]);
const ADMISSION_REASON = Object.freeze(Object.fromEntries(ADMISSION_REASONS.map((code) => [code.replaceAll('-', '_').toUpperCase(), code])));

export const admissionSelectorFields = Object.freeze(['pool', 'provider', 'model']);
const text = (value) => typeof value === 'string' && value.trim().length > 0;
const accountOf = (value) => value ?? 'default';
const selectableModel = (value) => value === 'supported-model-argument';
const selectorValid = (value) => isPlainObject(value) && Object.keys(value).length > 0
  && Object.keys(value).every((key) => admissionSelectorFields.includes(key) && text(value[key]));
export const matches = (candidate, selector) => Object.entries(selector).every(([key, value]) => candidate[key] === value);
const selectorsOverlap = (left, right) => admissionSelectorFields.every((key) => !left[key] || !right[key] || left[key] === right[key]);

/** Role names and model floors are declared once in allocation.admission. */
export const admissionRoles = (policy) => isPlainObject(policy?.roles) ? Object.keys(policy.roles) : [];
export function admissionQualityFloor(role, difficulty, policy) {
  const rolePolicy = policy?.roles?.[role], order = policy?.qualityOrder;
  if (!Array.isArray(order) || !order.includes(rolePolicy?.qualityFloor)) return null;
  if (difficulty == null || rolePolicy.difficultyFloors === undefined) return rolePolicy.qualityFloor;
  if (!isPlainObject(rolePolicy.difficultyFloors) || !Object.hasOwn(rolePolicy.difficultyFloors, difficulty)
    || !order.includes(rolePolicy.difficultyFloors[difficulty])) return null;
  return order[Math.max(order.indexOf(rolePolicy.qualityFloor), order.indexOf(rolePolicy.difficultyFloors[difficulty]))];
}

function policyValid(policy, role) {
  return isPlainObject(policy) && policy.schema === 'starci/agent-admission-policy@1'
    && Number.isInteger(policy.version) && policy.version > 0
    && Array.isArray(policy.qualityOrder) && policy.qualityOrder.length > 0
    && policy.qualityOrder.every(text) && new Set(policy.qualityOrder).size === policy.qualityOrder.length
    && Array.isArray(policy.eligibilityModes) && policy.eligibilityModes.length > 0 && policy.eligibilityModes.every(text)
    && quotaPolicyValid(policy) && Number.isFinite(policy.biasPercent) && policy.biasPercent >= policy.reservePercent
    && policy.biasPercent < policy.exhaustedPercent
    && isPlainObject(policy.roles?.[role]) && policy.qualityOrder.includes(policy.roles[role].qualityFloor)
    && (policy.roles[role].difficultyFloors === undefined || (isPlainObject(policy.roles[role].difficultyFloors)
      && Object.values(policy.roles[role].difficultyFloors).every((floor) => policy.qualityOrder.includes(floor))));
}

function overrideValid(override, request) {
  return isPlainObject(override) && override.authorized === true
    && override.scopeId === request.scopeId && override.role === request.role
    && text(override.provider) && text(override.model) && text(override.reason)
    && (override.account === undefined || text(override.account));
}

// Token use is a step of the picker (scripts/lib/tier-pick.mjs), never a hard filter: reserve and exhaustion carry pressure.
const TOKEN_CODES = new Set([ADMISSION_REASON.QUOTA_EXHAUSTED]);

function ownerGrantQuotaReasons(candidate, quota, codes) {
  const grant = quota.grant;
  if (Number.isInteger(grant?.slots) && candidate.capacity?.running >= grant.slots) codes.push(ADMISSION_REASON.OWNER_GRANT_FULL);
  if (quota.normalAdmission === false) codes.push(ADMISSION_REASON.QUOTA_NORMAL_BLOCKED);
  if (quota.allowLaunchAttempt === false) codes.push(ADMISSION_REASON.QUOTA_LAUNCH_BLOCKED);
  return { codes, pressure: null };
}

function regularQuotaReasons(quota, evidence, codes) {
  const blocking = quota.state !== 'limited' && !evidence.exhausted;
  if (blocking && quota.normalAdmission === false) codes.push(ADMISSION_REASON.QUOTA_NORMAL_BLOCKED);
  if (blocking && quota.allowLaunchAttempt === false) codes.push(ADMISSION_REASON.QUOTA_LAUNCH_BLOCKED);
  return { codes, pressure: evidence.pressure };
}

function quotaReasons(candidate, request, policy, now) {
  const quota = candidate.quota;
  const evidence = inspectQuotaEvidence(quota, { policy, now, role: request.role, scopeId: request.scopeId });
  const codes = evidence.codes.filter((code) => !TOKEN_CODES.has(code));
  if (!isPlainObject(quota)) return { codes, pressure: null };
  if (quota.provider !== candidate.provider || accountOf(quota.account) !== accountOf(candidate.account)) codes.push(ADMISSION_REASON.QUOTA_IDENTITY_MISMATCH);
  if (quota.fresh !== true) codes.push(ADMISSION_REASON.QUOTA_STALE);
  const usable = ['ok', 'limited'].includes(quota.state) || (quota.state === 'dead' && evidence.exhausted);
  if (!usable) codes.push(quota.state === 'dead' ? ADMISSION_REASON.QUOTA_EXHAUSTED : ADMISSION_REASON.QUOTA_UNKNOWN);
  if (quota.authority === 'owner-grant') return ownerGrantQuotaReasons(candidate, quota, codes);
  return regularQuotaReasons(quota, evidence, codes);
}

function concrete(candidate) {
  return Object.fromEntries(['id', 'pool', 'target', 'agent', 'provider', 'account', 'model', 'modelAuthority', 'effort', 'qualityFloor', 'tier', 'eligibility', 'quota', 'capacity']
    .filter((key) => candidate[key] !== undefined).map((key) => [key, candidate[key]]));
}

function requestReason(request, policy, now) {
  if (!isPlainObject(request) || !admissionRoles(policy).includes(request.role) || !text(request.scopeId) || !text(request.attemptId)
    || !Number.isFinite(now)) return ADMISSION_REASON.REQUEST_INVALID;
  if (!policyValid(policy, request.role)) return ADMISSION_REASON.POLICY_INVALID;
  return null;
}

function qualitySelection(request, policy, receipt) {
  const rolePolicy = policy.roles[request.role];
  const minimum = admissionQualityFloor(request.role, request.difficulty, policy);
  const floor = request.qualityFloor ?? minimum;
  const minimumRank = policy.qualityOrder.indexOf(minimum);
  const floorRank = policy.qualityOrder.indexOf(floor);
  if (minimumRank < 0 || floorRank < minimumRank) return { reason: ADMISSION_REASON.QUALITY_FLOOR_INVALID };
  receipt.request.qualityFloor = floor;
  return { rolePolicy, floor, floorRank };
}

function selectionConstraints(request) {
  if (!Array.isArray(request.allowGroup) || request.allowGroup.length === 0
    || request.allowGroup.some((pair) => !isPlainObject(pair) || !text(pair.provider) || !text(pair.model)))
    return { reason: ADMISSION_REASON.ALLOW_GROUP_INVALID };
  const prefer = request.prefer ?? [], avoid = request.avoid ?? [], only = request.only ?? [];
  if (![prefer, avoid, only].every((list) => Array.isArray(list) && list.every(selectorValid))) return { reason: ADMISSION_REASON.CONSTRAINT_INVALID };
  if (only.some((named) => avoid.some((selector) => selectorsOverlap(named, selector)
    && Object.keys(selector).every((key) => named[key] === selector[key])))) return { reason: ADMISSION_REASON.ONLY_AVOID_CONFLICT };
  const override = request.reserveOverride ?? null;
  if (override !== null && !overrideValid(override, request)) return { reason: ADMISSION_REASON.RESERVE_OVERRIDE_INVALID };
  return { prefer, avoid, only, override };
}

const validIndependence = (value) => ['provider', 'model', 'both'].includes(value);
const criticIndependenceValid = (mandated, independence, request) => validIndependence(mandated) && validIndependence(independence)
  && !(mandated === 'provider' && independence === 'model') && !(mandated === 'both' && independence !== 'both')
  && text(request.author?.provider) && (independence === 'provider' || text(request.author?.model));

function independenceSelection(request, rolePolicy) {
  let independence = request.independence ?? rolePolicy.independence ?? null;
  if (request.role === 'critic') {
    if (!criticIndependenceValid(rolePolicy.independence, independence, request)) return { reason: ADMISSION_REASON.CRITIC_INDEPENDENCE_INVALID };
  } else if (independence !== null && !validIndependence(independence)) return { reason: ADMISSION_REASON.INDEPENDENCE_INVALID };
  if (independence !== null && ((independence !== 'model' && !text(request.author?.provider))
    || (independence !== 'provider' && !text(request.author?.model)))) return { reason: ADMISSION_REASON.AUTHOR_INVALID };
  if ((independence === 'model' || independence === 'both') && !selectableModel(request.author?.modelAuthority))
    return { reason: request.role === 'critic' ? ADMISSION_REASON.CRITIC_MODEL_UNVERIFIABLE : ADMISSION_REASON.AUTHOR_MODEL_UNVERIFIABLE };
  return { independence };
}

function candidateIdentityCodes(candidate, request, ids) {
  const codes = [];
  if (!text(candidate.id) || !text(candidate.provider) || !text(candidate.model)
    || (candidate.account !== undefined && !text(candidate.account))) codes.push(ADMISSION_REASON.CANDIDATE_INVALID);
  if (ids.has(candidate.id)) codes.push(ADMISSION_REASON.CANDIDATE_DUPLICATE);
  ids.add(candidate.id);
  if (!request.allowGroup.some((pair) => candidate.provider === pair.provider && candidate.model === pair.model)) codes.push(ADMISSION_REASON.OUTSIDE_ALLOW_GROUP);
  return codes;
}

function candidateQualityCodes(candidate, policy, floorRank, only) {
  const codes = [];
  const rank = policy.qualityOrder.indexOf(candidate.qualityFloor);
  if (rank < floorRank) codes.push(ADMISSION_REASON.QUALITY_FLOOR_NOT_MET);
  if (candidate.eligibility?.eligible !== true || !policy.eligibilityModes.includes(candidate.eligibility?.mode)) codes.push(ADMISSION_REASON.ELIGIBILITY_NOT_PROVEN);
  if (only.some((selector) => selector.model && matches(candidate, selector) && !selectableModel(candidate.modelAuthority))) codes.push(ADMISSION_REASON.ONLY_MODEL_UNVERIFIABLE);
  return codes;
}

function candidateIndependenceCodes(candidate, request, independence) {
  const codes = [];
  if ((independence === 'provider' || independence === 'both') && candidate.provider === request.author?.provider) codes.push(ADMISSION_REASON.CRITIC_PROVIDER_CONFLICT);
  if ((independence === 'model' || independence === 'both') && candidate.model === request.author?.model) codes.push(ADMISSION_REASON.CRITIC_MODEL_CONFLICT);
  if ((independence === 'model' || independence === 'both') && !selectableModel(candidate.modelAuthority)) codes.push(ADMISSION_REASON.CRITIC_MODEL_UNVERIFIABLE);
  return codes;
}

function candidateCapacityCodes(candidate, now) {
  const codes = [];
  const capacity = candidate.capacity;
  if (!isPlainObject(capacity) || !Number.isInteger(capacity.running) || capacity.running < 0
    || !Number.isInteger(capacity.maxParallel) || capacity.maxParallel < 0) codes.push(ADMISSION_REASON.CAPACITY_UNKNOWN);
  else if (capacity.maxParallel === 0 || capacity.running >= capacity.maxParallel) codes.push(ADMISSION_REASON.CAPACITY_FULL);
  if (capacity?.openIncident === true) codes.push(ADMISSION_REASON.INCIDENT_OPEN);
  if (capacity?.blockedUntil !== undefined && (quotaTimestamp(capacity.blockedUntil) === null
    || quotaTimestamp(capacity.blockedUntil) > now)) codes.push(ADMISSION_REASON.PROVIDER_BLOCKED);
  return codes;
}

function candidateAssessment(candidate, state, ids, now) {
  const { request, policy, floorRank, only, independence } = state;
  const codes = [
    ...candidateIdentityCodes(candidate, request, ids),
    ...candidateQualityCodes(candidate, policy, floorRank, only),
    ...candidateIndependenceCodes(candidate, request, independence),
    ...candidateCapacityCodes(candidate, now),
    ...(candidate.extraHard ?? []),
  ];
  const quota = quotaReasons(candidate, request, policy, now);
  codes.push(...quota.codes);
  return { codes: [...new Set(codes)], pressure: quota.pressure };
}

// A quota rejection carries the observation's own explanation (its age and the limit it failed).
const loginExpiredCandidate = (candidate) => candidate.quota?.failureKind === LOGIN_EXPIRED_KIND;
const quotaDetailOf = (candidate, codes) => (codes.some((code) => code.startsWith('quota-')) || loginExpiredCandidate(candidate)) && text(candidate.quota?.detail)
  ? { detail: candidate.quota.detail, ...(loginExpiredCandidate(candidate) ? { failureKind: LOGIN_EXPIRED_KIND } : {}) } : {};
/** One line naming why each quota-rejected candidate was refused, or null when no rejection carries a detail. */
export const rejectionSummary = (decision) => {
  const lines = (decision?.rejected ?? []).filter((row) => text(row.detail)).map((row) => `${row.id}: ${row.detail}`);
  return lines.length ? lines.join('; ') : null;
};

const resetOf = (candidate) => quotaTimestamp(candidate.quota?.resetsAt ?? candidate.quota?.windows?.find((window) => window?.resetsAt)?.resetsAt);

// Every candidate assessed in order: the picker's members carry their hard-filter codes and token use.
function assessCandidates(candidates, { state, now, receipt }) {
  const ids = new Set(), members = [];
  for (const [index, candidate] of candidates.entries()) {
    if (!isPlainObject(candidate)) { receipt.rejected.push({ id: null, provider: null, model: null, codes: [ADMISSION_REASON.CANDIDATE_INVALID] }); continue; }
    const { codes, pressure } = candidateAssessment(candidate, state, ids, now);
    if (codes.length) receipt.rejected.push({ id: candidate.id ?? null, provider: candidate.provider ?? null,
      model: candidate.model ?? null, codes, ...quotaDetailOf(candidate, codes) });
    members.push({ ...candidate, id: candidate.id ?? `candidate-${index}`, hard: codes, pressure, resetsAt: resetOf(candidate) });
  }
  return members;
}

// The picker's refusal, as one typed reason.
function pickReason(picked) {
  const steps = picked.record.steps;
  if (!steps.find((row) => row.step === 'hard-filter')?.chain.length) return ADMISSION_REASON.NO_ELIGIBLE_CANDIDATE;
  if (!steps.find((row) => row.step === 'bias')?.chain.length) return ADMISSION_REASON.BIAS_EMPTIES_CHAIN;
  return ADMISSION_REASON.TOKENS_OUT;
}

function pickRequest(request, constraints, members, policy) {
  return { tier: request.tier ?? null, members, liveSeat: request.liveSeat ?? null, history: request.history ?? {},
    bias: { prefer: constraints.prefer, avoid: constraints.avoid, only: constraints.only, trusted: request.biasTrusted === true },
    override: constraints.override, balance: request.balance ?? { maxStreak: Infinity, maxSharePercent: 100 },
    usage: { reservePercent: policy.reservePercent, biasPercent: policy.biasPercent, exhaustedPercent: policy.exhaustedPercent } };
}

/** A deterministic plan. The runtime adapter must reserve before launch. Inputs are never mutated. */
export function selectAdmission({ request, candidates, policy, now } = {}) {
  const receipt = { schema: 'starci/agent-admission@1', policyVersion: policy?.version ?? null, ok: false, reason: null,
    request: { attemptId: request?.attemptId ?? null, scopeId: request?.scopeId ?? null, role: request?.role ?? null,
      kind: request?.kind ?? null, difficulty: request?.difficulty ?? null, qualityFloor: request?.qualityFloor ?? null, tier: request?.tier ?? null },
    selected: null, eligible: [], rejected: [], overrideApplied: false, pick: null };
  const refuse = (reason) => ({ ...receipt, reason });
  const invalidRequest = requestReason(request, policy, now);
  if (invalidRequest) return refuse(invalidRequest);
  const quality = qualitySelection(request, policy, receipt);
  if (quality.reason) return refuse(quality.reason);
  const constraints = selectionConstraints(request);
  if (constraints.reason) return refuse(constraints.reason);
  const independenceResult = independenceSelection(request, quality.rolePolicy);
  if (independenceResult.reason) return refuse(independenceResult.reason);
  if (!Array.isArray(candidates)) return refuse(ADMISSION_REASON.CANDIDATES_INVALID);
  const state = { request, policy, floorRank: quality.floorRank, only: constraints.only, independence: independenceResult.independence };
  const members = assessCandidates(candidates, { state, now, receipt });
  const picked = pickFromTier(pickRequest(request, constraints, members, policy));
  receipt.pick = picked.record;
  receipt.resetAt = picked.resetAt ?? null;
  receipt.eligible = picked.order.map(concrete);
  if (!picked.ok) return { ...receipt, reason: pickReason(picked) };
  const used = Number.isFinite(picked.selected.pressure) ? picked.selected.pressure : 0;
  return { ...receipt, ok: true, reason: ADMISSION_REASON.ADMITTED_PLAN, selected: concrete(picked.selected), chosenBy: picked.chosenBy,
    overrideApplied: used >= policy.reservePercent };
}
