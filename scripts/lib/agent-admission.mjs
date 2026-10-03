// Pure new-admission rules; contract owner: modules/models/selection.yaml.
// Live probes, owner provenance and fenced reservations belong to the caller.
import { isPlainObject } from '../../engine/plain-object.mjs';
import { quotaTimestamp, quotaPolicyValid, inspectQuotaEvidence } from './quota-evidence.mjs';

const ADMISSION_REASONS = Object.freeze([
  'admitted-plan',
  'allow-group-invalid',
  'author-invalid',
  'author-model-unverifiable',
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
  'outside-allow-group',
  'owner-avoided',
  'owner-grant-full',
  'policy-invalid',
  'provider-blocked',
  'quality-floor-invalid',
  'quality-floor-not-met',
  'quota-exhausted',
  'quota-identity-mismatch',
  'quota-launch-blocked',
  'quota-normal-blocked',
  'quota-reserved',
  'quota-stale',
  'quota-unknown',
  'request-invalid',
  'require-avoid-conflict',
  'required-identity-mismatch',
  'required-model-unverifiable',
  'required-unavailable',
  'reserve-override-invalid',
]);
const ADMISSION_REASON = Object.freeze(Object.fromEntries(ADMISSION_REASONS.map((code) => [code.replaceAll('-', '_').toUpperCase(), code])));

export const admissionSelectorFields = Object.freeze(['pool', 'provider', 'model']);
const text = (value) => typeof value === 'string' && value.trim().length > 0;
const accountOf = (value) => value ?? 'default';
const selectableModel = (value) => value === 'supported-model-argument';
const selectorValid = (value) => isPlainObject(value) && Object.keys(value).length > 0
  && Object.keys(value).every((key) => admissionSelectorFields.includes(key) && text(value[key]));
const matches = (candidate, selector) => Object.entries(selector).every(([key, value]) => candidate[key] === value);
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
    && quotaPolicyValid(policy)
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

function quotaReasons(candidate, request, policy, now, override) {
  const quota = candidate.quota;
  const evidence = inspectQuotaEvidence(quota, { policy, now, role: request.role, scopeId: request.scopeId });
  const codes = [...evidence.codes];
  if (!isPlainObject(quota)) return { codes, pressure: null, overrideApplied: false };
  if (quota.provider !== candidate.provider || accountOf(quota.account) !== accountOf(candidate.account)) codes.push(ADMISSION_REASON.QUOTA_IDENTITY_MISMATCH);
  if (quota.fresh !== true) codes.push(ADMISSION_REASON.QUOTA_STALE);
  if (!['ok', 'limited'].includes(quota.state)) codes.push(quota.state === 'dead' ? ADMISSION_REASON.QUOTA_EXHAUSTED : ADMISSION_REASON.QUOTA_UNKNOWN);
  if (quota.authority === 'owner-grant') {
    const grant = quota.grant;
    if (Number.isInteger(grant?.slots) && candidate.capacity?.running >= grant.slots) codes.push(ADMISSION_REASON.OWNER_GRANT_FULL);
    if (quota.normalAdmission === false) codes.push(ADMISSION_REASON.QUOTA_NORMAL_BLOCKED);
    if (quota.allowLaunchAttempt === false) codes.push(ADMISSION_REASON.QUOTA_LAUNCH_BLOCKED);
    return { codes, pressure: null, overrideApplied: false };
  }
  const { pressure, limited: inReserve } = evidence;
  const scopedOverride = override && override.provider === candidate.provider && override.model === candidate.model
    && (override.account === undefined || accountOf(override.account) === accountOf(candidate.account));
  const overrideApplied = Boolean(inReserve && scopedOverride && codes.length === 0);
  if (inReserve && !overrideApplied) codes.push(ADMISSION_REASON.QUOTA_RESERVED);
  if (quota.normalAdmission === false && !overrideApplied) codes.push(ADMISSION_REASON.QUOTA_NORMAL_BLOCKED);
  if (quota.allowLaunchAttempt === false && !overrideApplied) codes.push(ADMISSION_REASON.QUOTA_LAUNCH_BLOCKED);
  return { codes, pressure, overrideApplied };
}

function concrete(candidate) {
  return Object.fromEntries(['id', 'pool', 'target', 'agent', 'provider', 'account', 'model', 'modelAuthority', 'effort', 'qualityFloor', 'eligibility', 'quota', 'capacity']
    .filter((key) => candidate[key] !== undefined).map((key) => [key, candidate[key]]));
}

/** A deterministic plan. The runtime adapter must reserve before launch. Inputs are never mutated. */
export function selectAdmission({ request, candidates, policy, now } = {}) {
  const receipt = { schema: 'starci/agent-admission@1', policyVersion: policy?.version ?? null, ok: false, reason: null,
    request: { attemptId: request?.attemptId ?? null, scopeId: request?.scopeId ?? null, role: request?.role ?? null,
      kind: request?.kind ?? null, difficulty: request?.difficulty ?? null, qualityFloor: request?.qualityFloor ?? null },
    selected: null, eligible: [], rejected: [], overrideApplied: false };
  const refuse = (reason) => ({ ...receipt, reason });
  if (!isPlainObject(request) || !admissionRoles(policy).includes(request.role) || !text(request.scopeId) || !text(request.attemptId)
    || !Number.isFinite(now)) return refuse(ADMISSION_REASON.REQUEST_INVALID);
  if (!policyValid(policy, request.role)) return refuse(ADMISSION_REASON.POLICY_INVALID);
  const rolePolicy = policy.roles[request.role];
  const minimum = admissionQualityFloor(request.role, request.difficulty, policy);
  const floor = request.qualityFloor ?? minimum;
  const minimumRank = policy.qualityOrder.indexOf(minimum);
  const floorRank = policy.qualityOrder.indexOf(floor);
  if (minimumRank < 0 || floorRank < minimumRank) return refuse(ADMISSION_REASON.QUALITY_FLOOR_INVALID);
  receipt.request.qualityFloor = floor;
  if (!Array.isArray(request.allowGroup) || request.allowGroup.length === 0
    || request.allowGroup.some((pair) => !isPlainObject(pair) || !text(pair.provider) || !text(pair.model))) return refuse(ADMISSION_REASON.ALLOW_GROUP_INVALID);
  const prefer = request.prefer ?? [], avoid = request.avoid ?? [], required = request.require ?? null;
  if (!Array.isArray(prefer) || !prefer.every(selectorValid) || !Array.isArray(avoid) || !avoid.every(selectorValid)
    || (required !== null && !selectorValid(required))) return refuse(ADMISSION_REASON.CONSTRAINT_INVALID);
  // An avoid that covers every match of require is a contradictory hard constraint.
  if (required && avoid.some((selector) => selectorsOverlap(required, selector)
    && Object.keys(selector).every((key) => required[key] === selector[key]))) return refuse(ADMISSION_REASON.REQUIRE_AVOID_CONFLICT);
  const override = request.reserveOverride ?? null;
  if (override !== null && !overrideValid(override, request)) return refuse(ADMISSION_REASON.RESERVE_OVERRIDE_INVALID);
  let independence = request.independence ?? rolePolicy.independence ?? null;
  if (request.role === 'critic') {
    const mandated = rolePolicy.independence;
    if (!['provider', 'model', 'both'].includes(mandated) || !['provider', 'model', 'both'].includes(independence)
      || (mandated === 'provider' && independence === 'model') || (mandated === 'both' && independence !== 'both')
      || !text(request.author?.provider) || (independence !== 'provider' && !text(request.author?.model))) return refuse(ADMISSION_REASON.CRITIC_INDEPENDENCE_INVALID);
  } else if (independence !== null && !['provider', 'model', 'both'].includes(independence)) return refuse(ADMISSION_REASON.INDEPENDENCE_INVALID);
  if (independence !== null && ((independence !== 'model' && !text(request.author?.provider))
    || (independence !== 'provider' && !text(request.author?.model)))) return refuse(ADMISSION_REASON.AUTHOR_INVALID);
  if ((independence === 'model' || independence === 'both') && !selectableModel(request.author?.modelAuthority))
    return refuse(request.role === 'critic' ? ADMISSION_REASON.CRITIC_MODEL_UNVERIFIABLE : ADMISSION_REASON.AUTHOR_MODEL_UNVERIFIABLE);
  if (!Array.isArray(candidates)) return refuse(ADMISSION_REASON.CANDIDATES_INVALID);
  const ids = new Set(), eligible = [];
  for (const [index, candidate] of candidates.entries()) {
    const codes = [];
    if (!isPlainObject(candidate)) { receipt.rejected.push({ id: null, provider: null, model: null, codes: [ADMISSION_REASON.CANDIDATE_INVALID] }); continue; }
    if (!text(candidate.id) || !text(candidate.provider) || !text(candidate.model)
      || (candidate.account !== undefined && !text(candidate.account))) codes.push(ADMISSION_REASON.CANDIDATE_INVALID);
    if (ids.has(candidate.id)) codes.push(ADMISSION_REASON.CANDIDATE_DUPLICATE);
    ids.add(candidate.id);
    if (!request.allowGroup.some((pair) => candidate.provider === pair.provider && candidate.model === pair.model)) codes.push(ADMISSION_REASON.OUTSIDE_ALLOW_GROUP);
    const rank = policy.qualityOrder.indexOf(candidate.qualityFloor);
    if (rank < floorRank) codes.push(ADMISSION_REASON.QUALITY_FLOOR_NOT_MET);
    if (candidate.eligibility?.eligible !== true || !policy.eligibilityModes.includes(candidate.eligibility?.mode)) codes.push(ADMISSION_REASON.ELIGIBILITY_NOT_PROVEN);
    if (required && !matches(candidate, required)) codes.push(ADMISSION_REASON.REQUIRED_IDENTITY_MISMATCH);
    if (required?.model && !selectableModel(candidate.modelAuthority)) codes.push(ADMISSION_REASON.REQUIRED_MODEL_UNVERIFIABLE);
    if (avoid.some((selector) => matches(candidate, selector))) codes.push(ADMISSION_REASON.OWNER_AVOIDED);
    if ((independence === 'provider' || independence === 'both') && candidate.provider === request.author?.provider) codes.push(ADMISSION_REASON.CRITIC_PROVIDER_CONFLICT);
    if ((independence === 'model' || independence === 'both') && candidate.model === request.author?.model) codes.push(ADMISSION_REASON.CRITIC_MODEL_CONFLICT);
    if ((independence === 'model' || independence === 'both') && !selectableModel(candidate.modelAuthority)) codes.push(ADMISSION_REASON.CRITIC_MODEL_UNVERIFIABLE);
    const capacity = candidate.capacity;
    if (!isPlainObject(capacity) || !Number.isInteger(capacity.running) || capacity.running < 0
      || !Number.isInteger(capacity.maxParallel) || capacity.maxParallel < 0) codes.push(ADMISSION_REASON.CAPACITY_UNKNOWN);
    else if (capacity.maxParallel === 0 || capacity.running >= capacity.maxParallel) codes.push(ADMISSION_REASON.CAPACITY_FULL);
    if (capacity?.openIncident === true) codes.push(ADMISSION_REASON.INCIDENT_OPEN);
    if (capacity?.blockedUntil !== undefined && (quotaTimestamp(capacity.blockedUntil) === null
      || quotaTimestamp(capacity.blockedUntil) > now)) codes.push(ADMISSION_REASON.PROVIDER_BLOCKED);
    const quota = quotaReasons(candidate, request, policy, now, override);
    codes.push(...quota.codes);
    if (codes.length) receipt.rejected.push({ id: candidate.id ?? null, provider: candidate.provider ?? null,
      model: candidate.model ?? null, codes: [...new Set(codes)] });
    else {
      const preferredAt = prefer.findIndex((selector) => matches(candidate, selector));
      eligible.push({ candidate, index, preferredAt: preferredAt < 0 ? prefer.length : preferredAt, ...quota });
    }
  }
  // Rank real observed pressure; owner grants contribute slots only, never synthetic quota percentages.
  const pressureOf = ({ candidate, pressure }) => {
    const slots = candidate.quota?.authority === 'owner-grant'
      ? Math.min(candidate.capacity.maxParallel, candidate.quota.grant.slots) : candidate.capacity.maxParallel;
    const load = candidate.capacity.running / slots;
    return pressure === null ? load : Math.max(load, pressure / policy.exhaustedPercent);
  };
  eligible.sort((left, right) => left.preferredAt - right.preferredAt || pressureOf(left) - pressureOf(right)
    || left.index - right.index || left.candidate.id.localeCompare(right.candidate.id));
  receipt.eligible = eligible.map(({ candidate }) => concrete(candidate));
  if (!eligible.length) return { ...receipt, reason: required ? ADMISSION_REASON.REQUIRED_UNAVAILABLE : ADMISSION_REASON.NO_ELIGIBLE_CANDIDATE };
  return { ...receipt, ok: true, reason: ADMISSION_REASON.ADMITTED_PLAN, selected: concrete(eligible[0].candidate),
    overrideApplied: eligible[0].overrideApplied };
}
