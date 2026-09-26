// ask-recommendation.mjs — which option of an owner ask is the recommended
// one, and whether config.yaml `asks` lets the runtime take it without the
// owner (engine/config.mjs askAutoAcceptPolicy). Pure: no ledger, no files.
//
// A recommendation is `question.recommended` (the 0-based index into
// question.options, validated by report-envelope.mjs) with
// `question.recommendedReason`. An ask filed before that field existed names
// its recommendation in the option text; exactly one option carrying
// "(khuyến nghị)", "(recommended)" or "(đề xuất)" counts, zero or several
// mean none.
//
// The exclusion classes (config.yaml asks.excludes):
//   credential  — an ask with secret fields (custody files, env vars) or of
//                 kind credential, account, access or consent;
//   handover    — any handover.review ask; always excluded, whatever the list
//                 says (the handover approval is the owner's own answer);
//   draw-review — a question of kind draw-review (scripts/work/draw-review.mjs),
//                 when listed: the opt-out. Owner ruling 2026-09-26: a drawing
//                 the owner did not ask to review is accepted without the
//                 owner - its recommendation is the accept option, implicit.
//                 A drawing the owner DID ask for (ownerRequest, read from the
//                 ledger by serve-ask.mjs drawOwnerRequestOf) stays the owner's;
//   <ask kind>  — question.kind equal to it ('decision' reads as
//                 business-decision).
import { HANDOVER_OP } from './handover.mjs';

export const AUTO_ACCEPTED_BY = 'auto-recommended';
export const AUTO_ACCEPT_CONFIG_KEY = 'asks.autoAcceptRecommended';
/** The review of drawn parts (scripts/work/draw-review.mjs DRAW_REVIEW_KIND): auto-accepted unless the owner asked for it. */
export const DRAW_REVIEW_ASK_KIND = 'draw-review';
/** The accept option of a draw-review ask (draw-review.mjs DRAW_REVIEW_DECISIONS[0]): its implicit recommendation. */
export const DRAW_REVIEW_ACCEPT_INDEX = 0;
export const DRAW_REVIEW_ACCEPT_REASON = 'the owner did not ask to review this drawing (owner ruling 2026-09-26: an unrequested drawing is accepted without the owner)';
export const CREDENTIAL_ASK_KINDS = Object.freeze(['credential', 'account', 'access', 'consent']);

const RECOMMENDATION_MARK = /\((?:khuyến nghị|recommended|đề xuất)\)/iu;
const labelOf = (option) => (typeof option === 'string' ? option : option?.label ?? '');
const fold = (text) => String(text ?? '').normalize('NFC');

/** The option text marks one option as recommended: its index, or null when zero or several do. */
export function textRecommendation(options) {
  const hits = (Array.isArray(options) ? options : [])
    .map((option, index) => (RECOMMENDATION_MARK.test(fold(labelOf(option))) ? index : -1))
    .filter((index) => index >= 0);
  return hits.length === 1 ? hits[0] : null;
}

/**
 * The recommended option of a question: {index, label, reason, source: 'structured'|'text'}, or null.
 * A structured `recommended` that does not name an existing option is no recommendation.
 */
export function recommendationOf(question) {
  const options = Array.isArray(question?.options) ? question.options : [];
  if (!options.length) return null;
  const reason = typeof question.recommendedReason === 'string' && question.recommendedReason.trim() ? question.recommendedReason.trim() : null;
  if (question.recommended !== undefined && question.recommended !== null) {
    const index = question.recommended;
    if (!Number.isInteger(index) || index < 0 || index >= options.length) return null;
    return { index, label: labelOf(options[index]), reason, source: 'structured' };
  }
  const index = textRecommendation(options);
  return index === null ? null : { index, label: labelOf(options[index]), reason, source: 'text' };
}

/** The ask kind a question declares (question.kind), 'decision' read as business-decision; null when none. */
export function askKindOf(question) {
  const kind = typeof question?.kind === 'string' ? question.kind.trim().toLowerCase() : '';
  if (!kind) return null;
  return kind === 'decision' ? 'business-decision' : kind;
}

/**
 * The first exclusion class the ask falls in, or null. `secretFields` is serve-ask's field derivation
 * ({files, vars}); `excludes` the policy's list — 'handover' applies whether or not it is listed.
 */
export function askExclusionOf({ question, opId, secretFields, excludes = [] }) {
  if (opId === HANDOVER_OP) return 'handover';
  const kind = askKindOf(question);
  const secret = (secretFields?.files?.length ?? 0) + (secretFields?.vars?.length ?? 0) > 0;
  if (excludes.includes('credential') && (secret || CREDENTIAL_ASK_KINDS.includes(kind))) return 'credential';
  if (kind && excludes.includes(kind)) return kind;
  return null;
}

/**
 * Whether the runtime answers this ask with its recommendation instead of serving the form:
 * {accept:true, recommendation, rule} or {accept:false, why}. `policy` is askAutoAcceptPolicy(config).
 * A question with several pick groups is several decisions; one recommended option cannot answer it.
 * A draw-review ask recommends its accept option (source 'draw-review') unless `ownerRequest` - why the
 * owner asked for this drawing, from the ledger - is set: then it is the owner's (why 'owner-requested').
 */
export function autoAcceptDecision({ question, opId, secretFields, policy, ownerRequest = null }) {
  if (!policy?.autoAcceptRecommended) return { accept: false, why: 'flag-off' };
  const excluded = askExclusionOf({ question, opId, secretFields, excludes: policy.excludes ?? [] });
  if (excluded) return { accept: false, why: `excluded:${excluded}` };
  if (askKindOf(question) === DRAW_REVIEW_ASK_KIND) {
    if (ownerRequest) return { accept: false, why: 'owner-requested', detail: ownerRequest };
    const options = Array.isArray(question?.options) ? question.options : [];
    if (!options[DRAW_REVIEW_ACCEPT_INDEX]) return { accept: false, why: 'no-recommendation' };
    const recommendation = { index: DRAW_REVIEW_ACCEPT_INDEX, label: labelOf(options[DRAW_REVIEW_ACCEPT_INDEX]), reason: DRAW_REVIEW_ACCEPT_REASON, source: 'draw-review' };
    return { accept: true, recommendation, rule: { key: AUTO_ACCEPT_CONFIG_KEY, autoAcceptRecommended: true, excludes: [...policy.excludes], source: 'draw-review' } };
  }
  const picks = Array.isArray(question?.picks) ? question.picks : [];
  const options = Array.isArray(question?.options) ? question.options : [];
  if (picks.length > 1 || (picks.length === 1 && (picks[0]?.choices ?? []).length !== options.length)) return { accept: false, why: 'several-decisions' };
  const recommendation = recommendationOf(question);
  if (!recommendation) return { accept: false, why: 'no-recommendation' };
  return {
    accept: true, recommendation,
    rule: { key: AUTO_ACCEPT_CONFIG_KEY, autoAcceptRecommended: true, excludes: [...policy.excludes], source: recommendation.source },
  };
}
