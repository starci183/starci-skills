// call-admission.mjs — admission of one headless call (tiers.yaml calls): the same picker as a seat or an op (hard filter,
// owner bias, balance, token use) over the chain of the call's call tier, and the same provider reservation for the
// duration of the call, one slot. A refusal is typed (`kind`), never thrown: the op that made the call reports it.
//   admitCall -> beginCall (the reservation crosses to launching) -> liveCall (the child has a pid) -> endCall (released)
import { admitAgent, consumeAgentAdmission, observeAgentAdmission, releaseAgentAdmission } from './admission.mjs';
import { loadModelRegistry } from './model-registry.mjs';
import { callSpec, tierMembers, tierSettings } from './tiers.mjs';

const QUOTA_REASONS = new Set(['tokens-out', 'quota-exhausted', 'quota-normal-blocked', 'quota-launch-blocked', 'quota-reserve', 'quota-ineligible']);
const CAPACITY_REASONS = new Set(['provider-capacity', 'capacity-full', 'owner-grant-full', 'capacity']);

/** The refusal kind of an admission reason: `quota` (the chain is out of tokens), `capacity` (no free provider slot), else `unavailable`. */
export function refusalKind(reason) {
  if (QUOTA_REASONS.has(reason)) return 'quota';
  return CAPACITY_REASONS.has(reason) ? 'capacity' : 'unavailable';
}

const CAPACITY_CODES = new Set(['capacity-full', 'owner-grant-full']);
const QUOTA_CODES = new Set(['quota-exhausted', 'quota-normal-blocked', 'quota-launch-blocked']);

/** The kind of a refused admission: the reason's own kind, else the one every dropped member shares (all out of slots, all out of tokens). */
function decisionKind(reason, rejected) {
  const direct = refusalKind(reason);
  if (direct !== 'unavailable' || !rejected.length) return direct;
  const sharedBy = (codes) => rejected.every((row) => row.codes.some((code) => codes.has(code)));
  if (sharedBy(CAPACITY_CODES)) return 'capacity';
  return sharedBy(QUOTA_CODES) ? 'quota' : 'unavailable';
}

const rejectedText = (rejected) => rejected.map((row) => `${row.id} ${row.codes.join('+')}`).join('; ');

const allowedMember = (member) => ({ id: member.id, provider: member.provider, agent: member.agent, model: member.model, effort: member.effort,
  pool: member.pool, eligibility: { eligible: true, mode: 'operation-policy' } });

/**
 * Admit the headless call `call`. Input: {call, scopeId, attemptId, kind (the calling op), bias {prefer, avoid, only}, biasTrusted}
 * and options {env, now, io, registry, runtimes}. Output: {ok:true, spec, selected, admission} or
 * {ok:false, kind: quota|capacity|unavailable, reason, detail, resetAt}; a call tiers.yaml does not declare throws.
 */
export function admitCall({ call, scopeId, attemptId = scopeId, kind = null, bias = null, biasTrusted = false } = {}, { env = process.env, now, io = null, registry = null, runtimes = null } = {}) {
  const catalog = registry ?? loadModelRegistry();
  const settings = tierSettings({ registry: catalog });
  const spec = callSpec(call, settings);
  if (!spec) throw new Error(`tiers.yaml calls declares no call ${call}`);
  const allowGroup = tierMembers(spec.tier, { settings, registry: catalog, use: 'call' }).map(allowedMember);
  const admission = admitAgent({ role: 'op', scopeId, attemptId, kind, difficulty: 'medium', tier: spec.tier, allowGroup, bias, biasTrusted,
    scope: { tier: spec.tier }, registry: catalog, ...(runtimes ? { runtimes } : {}) }, { env, now, io });
  if (!admission.ok) {
    const rejected = admission.decision?.rejected ?? [];
    return { ok: false, kind: decisionKind(admission.error, rejected), reason: admission.error, detail: rejectedText(rejected) || admission.detail || null, resetAt: admission.decision?.resetAt ?? null };
  }
  return { ok: true, spec, selected: admission.selected, admission };
}

/** The admitted reservation crosses to `launching` before the child starts; `launchIdentity` names this call. */
export function beginCall(called, { launchIdentity, env = process.env, now, io = null } = {}) {
  const { provider, model } = called.selected;
  return consumeAgentAdmission(called.admission, { provider, model, role: 'op', launchIdentity, env, now, io });
}

/** The child is running with `pid`. */
export const liveCall = (called, { pid, env = process.env, io = null }) => observeAgentAdmission(called.admission, { state: 'live', pid }, { env, io });

/** The slot is released: on the proof that the child with `pid` exited, or, with no pid, that nothing was started. */
export function endCall(called, { pid = null, env = process.env, io = null } = {}) {
  const proof = pid ? { kind: 'process-exited', confirmed: true, pid } : { kind: 'failed-before-launch', confirmed: true };
  return releaseAgentAdmission(called.admission, proof, { env, io });
}
