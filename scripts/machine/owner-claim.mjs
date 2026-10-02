// owner-claim.mjs — an incident resolution that says the owner decided must prove it.
//
// Defect (a workspace-provision workflow): the Kernel resolved two
// foreign-file-committed incidents with "Owner confirmed: ..."
// while the ledger held no owner answer, and a settle then took those resolved incidents as the proof
// that the file owner confirmed the paths. `api incident --resolve` took free
// text and recorded no resolver.
//
// Now a resolution records who resolved it (by: kernel | owner | supervisor) and, when its text claims
// an owner confirmation/approval/ruling (English and Vietnamese, accented or not) or it resolves as the
// owner (--by owner, the default for an owner-gate), it must name a VERIFIED owner answer: an
// `ask-answered` event and its starci/ask-answer@1 receipt that both say answeredBy owner - the check
// handover.mjs handoverAsks makes for the handover approval. foreignAcceptProof rejects a resolution
// whose owner claim is unproven, and ownerClaimAudit lists the past ones (read-only; history is never
// rewritten). notOwnerWorkOf names an owner-gate whose own text says it is runtime / not-owner work.
// Reads only; every write stays in cli.mjs.
import { parseJson, readJsonFile } from '../lib/json.mjs';

export const OWNER = 'owner';
export const RESOLVERS = Object.freeze(['kernel', 'owner', 'supervisor']);
export const OWNER_CLAIM_UNPROVEN = 'owner-claim-unproven';
export const OWNER_GATE_KINDS = Object.freeze(['owner-gate', 'owner-gate-pending']);

/** Lower case, whitespace collapsed, Vietnamese diacritics folded (the d-stroke letter, U+0110/U+0111, folds to d explicitly, since NFD never decomposes it), so an accented claim and its unaccented form read alike. */
export const foldText = (text) => String(text ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[\u0110\u0111]/g, 'd').toLowerCase().replace(/\s+/g, ' ');

const SUBJECT_VI = '(?:owner|chu du an|chu so huu|thay)';
const OWNER_CLAIM_PATTERNS = [
  // owner confirmed / Owner has approved / owner's answer ... (not "owner has not ...")
  /\bowner(?:'s)?(?:\/supervisor)?\s+(?:(?:has|had|have|already|explicitly|then)\s+)*(?:confirmed|approved|accepted|agreed|ruled|answered|decided|signed off|authori[sz]ed|okayed|ok'?d|chose|picked|granted|allowed|relayed)\b/,
  /\b(?:confirmed|approved|accepted|authori[sz]ed|signed off|ruled|answered|decided|granted)\s+by\s+(?:the\s+)?owner\b/,
  /\bowner[- ](?:approved|confirmed|accepted|authori[sz]ed|sanctioned|ruled)\b/,
  /(?<!\bno )(?<!\bwithout )(?<!\bawaiting )(?<!\bpending )\bowner(?:'s)?\s+(?:ruling|approval|confirmation|sign-?off|consent|answer|go-ahead)\b(?!\s+(?:is\s+)?(?:pending|required|needed|missing|owed|outstanding))/,
  // Vietnamese (folded, as matched): owner da / chu du an xac nhan / thay duyet / duoc owner duyet / xac nhan cua chu so huu
  /\bowner da\b/,
  new RegExp(`\\b${SUBJECT_VI}(?:\\/supervisor)?\\s+(?:da\\s+)?(?:xac nhan|duyet|phe duyet|dong y|chap nhan|tra loi|chon|quyet dinh|cho phep|phan quyet)\\b`),
  new RegExp(`\\bduoc\\s+${SUBJECT_VI}\\s+(?:xac nhan|duyet|phe duyet|dong y|chap nhan|tra loi|cho phep)\\b`),
  new RegExp(`\\b(?:xac nhan|phe duyet|phan quyet|quyet dinh) cua ${SUBJECT_VI}\\b`),
].map((re) => new RegExp(re.source, 'g'));

// A phrase just after a wait, a condition or a negation is not a claim: "cho chu so huu duyet", "until the
// owner approved", "gate khong cho cau tra loi cua owner".
const NOT_A_CLAIM_BEFORE = /\b(?:cho|chua|can|doi|neu|khi|de|khong|until|awaiting|await|waits?|waiting|pending|if|once|unless|needs?|before|no|not|without)\b[^.;:!?]{0,12}$/;

/** The owner-claim phrase `text` makes (folded), or null. */
export function ownerClaimOf(text) {
  const folded = foldText(text);
  for (const re of OWNER_CLAIM_PATTERNS) {
    re.lastIndex = 0;
    for (let m = re.exec(folded); m; m = re.exec(folded)) {
      const before = folded.slice(Math.max(0, m.index - 24), m.index).replace(/[(\[]/g, ' ');
      if (!NOT_A_CLAIM_BEFORE.test(before)) return m[0].trim();
      if (m[0].length === 0) re.lastIndex += 1;
    }
  }
  return null;
}

// An owner-gate whose own text says the wait is not the owner's: a runtime limit or defect, a settle the
// Kernel defers, a supervisor's step (inc-1d6e73af51cc RUNTIME LIMIT, inc-c85f3b0c1603 "khong phai
// viec owner thuc hien").
const NOT_OWNER_WORK = /\bruntime limit\b|\bruntime[- ]defect\b|\bruntime fix\b|\bcho sua (?:source )?runtime\b|\bnot an? owner(?:'s)? (?:step|ask|action|work|task|wait)\b|\bnot owner work\b|\bkhong phai (?:la )?(?:viec|buoc)(?: cua)? (?:owner|chu)|\bkhong phai owner\b|\bdeferred settle\b|\bcho supervisor\b|\bwaits? (?:on|for) (?:the )?supervisor\b/;

/** The phrase that marks an owner-gate's text as not owner work, or null. */
export function notOwnerWorkOf(text) {
  const m = NOT_OWNER_WORK.exec(foldText(text));
  return m ? m[0].trim() : null;
}

/** The kind an incident was raised with, read from its `[kind] detail` last_progress. */
export const incidentKindOf = (lastProgress) => /^\[([^\]]+)\]/.exec(String(lastProgress ?? ''))?.[1] ?? null;

const readReceipt = readJsonFile;

/**
 * Whether ask `dispatchId` holds an owner answer: {ok, dispatchId, workflowId?, receiptPath?, answeredBy?,
 * reason?}. Verified as handover.mjs handoverAsks verifies the handover approval: the newest `ask-answered`
 * event for the dispatch and its starci/ask-answer@1 receipt (bound to that dispatch and workflow) must both
 * say answeredBy owner. Any workflow of the ledger (a foundation ask lives in its owner's workflow).
 */
export function ownerAnswerProof(db, dispatchId) {
  const id = String(dispatchId ?? '').trim();
  if (!id) return { ok: false, dispatchId: null, reason: 'no owner answer named' };
  const event = db.prepare("SELECT workflow_id,payload_json FROM events WHERE kind='ask-answered' AND json_extract(payload_json,'$.dispatchId')=? ORDER BY seq DESC LIMIT 1").get(id);
  if (!event) return { ok: false, dispatchId: id, reason: `ask ${id} has no ask-answered event` };
  const payload = parseJson(event.payload_json, {}) ?? {};
  const receipt = readReceipt(payload.receiptPath);
  const base = { dispatchId: id, workflowId: event.workflow_id, receiptPath: payload.receiptPath ?? null, answeredBy: receipt?.answeredBy ?? payload.answeredBy ?? null };
  if (!receipt) return { ok: false, ...base, reason: `ask ${id}'s answer receipt is missing or unreadable` };
  if (receipt.dispatchId !== id || receipt.workflowId !== event.workflow_id) return { ok: false, ...base, reason: `ask ${id}'s receipt is bound to another ask` };
  if (payload.answeredBy !== OWNER || receipt.answeredBy !== OWNER) return { ok: false, ...base, reason: `ask ${id} was answered by ${receipt.answeredBy ?? payload.answeredBy ?? 'nobody named'}, not the owner` };
  return { ok: true, ...base };
}

const ASK_IDS = /\bctx_[0-9a-z]{6,}\b/gi;

/**
 * The owner-answer proof for a resolution: the named --owner-answer ids first, then every ask id the text
 * cites. {proven, proof|null, tried[]}.
 */
export function provenOwnerAnswer(db, { ownerAnswer = [], detail = '' } = {}) {
  const ids = [...new Set([...(Array.isArray(ownerAnswer) ? ownerAnswer : [ownerAnswer]).map((x) => String(x ?? '').trim()).filter(Boolean), ...(String(detail ?? '').match(ASK_IDS) ?? [])])];
  const tried = [];
  for (const id of ids) {
    const proof = ownerAnswerProof(db, id);
    if (proof.ok) return { proven: true, proof, tried };
    tried.push(proof);
  }
  return { proven: false, proof: null, tried };
}

/**
 * Whether a resolution needs an owner answer and, when it does, whether it has one:
 * {needs, why|null, claim|null, proven, proof|null, tried[]}. It needs one when its text claims an owner
 * decision, when it resolves as the owner (by owner), or when it resolves an owner-gate without naming
 * a non-owner resolver (by defaults to owner there).
 */
export function resolutionOwnerCheck(db, { kind = null, detail = '', by = null, ownerAnswer = [] } = {}) {
  const claim = ownerClaimOf(detail);
  const ownerGate = OWNER_GATE_KINDS.includes(kind);
  const resolver = by ?? (ownerGate ? OWNER : 'kernel');
  const why = claim ? `the resolution text claims an owner decision ("${claim}")`
    : resolver === OWNER ? (by ? 'it resolves as the owner (--by owner)' : `it resolves an ${kind} (an owner gate resolves as the owner unless --by kernel|supervisor says the owner did not)`)
    : null;
  if (!why) return { needs: false, why: null, claim: null, by: resolver, proven: false, proof: null, tried: [] };
  const { proven, proof, tried } = provenOwnerAnswer(db, { ownerAnswer, detail });
  return { needs: true, why, claim, by: resolver, proven, proof, tried };
}

/** The newest incident-resolved event of an incident: {seq, createdAt, payload}, or null. */
export function resolutionOf(db, workflowId, incidentId) {
  const row = db.prepare("SELECT seq,created_at,payload_json FROM events WHERE workflow_id=? AND entity_type='incident' AND entity_id=? AND kind='incident-resolved' ORDER BY seq DESC LIMIT 1").get(workflowId, incidentId);
  return row ? { seq: row.seq, createdAt: row.created_at, payload: parseJson(row.payload_json, {}) ?? {} } : null;
}

/**
 * Whether a recorded resolution's owner claim is unproven: {unproven, claim, by, reason} (unproven false
 * when it claims nothing). A resolution recorded with a verified ownerAnswer, or whose text cites an ask
 * the owner answered, is proven. A runtime release (by until-conditions) claims nothing of the owner.
 */
export function resolutionClaimOf(db, resolution) {
  const payload = resolution?.payload ?? {};
  if (payload.by === 'until-conditions') return { unproven: false, claim: null, by: payload.by, reason: null };
  const claim = ownerClaimOf(payload.detail);
  const byOwner = payload.by === OWNER;
  if (!claim && !byOwner) return { unproven: false, claim: null, by: payload.by ?? null, reason: null };
  const { proven, proof, tried } = provenOwnerAnswer(db, { ownerAnswer: payload.ownerAnswer?.dispatchId ?? payload.ownerAnswer ?? [], detail: payload.detail });
  return {
    unproven: !proven, claim: claim ?? '(by owner)', by: payload.by ?? null,
    ...(proof ? { proof: proof.dispatchId } : {}),
    reason: proven ? null : (tried.length ? tried.map((t) => t.reason).join('; ') : 'no owner answer is recorded or cited'),
  };
}

/**
 * Every past incident resolution whose owner claim is unproven, oldest first (read-only):
 * [{workflowId, incidentId, kind, resolvedAt, by, claim, detail, reason}]. `workflowId` narrows it.
 */
export function ownerClaimAudit(db, { workflowId = null } = {}) {
  const rows = db.prepare(`SELECT e.workflow_id,e.entity_id,e.seq,e.created_at,e.payload_json,i.last_progress FROM events e
    LEFT JOIN incidents i ON i.incident_id=e.entity_id
    WHERE e.kind='incident-resolved' AND e.entity_type='incident' ${workflowId ? 'AND e.workflow_id=?' : ''} ORDER BY e.seq`).all(...(workflowId ? [workflowId] : []));
  const out = [];
  for (const row of rows) {
    const resolution = { seq: row.seq, createdAt: row.created_at, payload: parseJson(row.payload_json, {}) ?? {} };
    const verdict = resolutionClaimOf(db, resolution);
    if (!verdict.unproven) continue;
    out.push({
      workflowId: row.workflow_id, incidentId: row.entity_id, kind: incidentKindOf(row.last_progress),
      resolvedAt: new Date(Number(row.created_at)).toISOString(), by: verdict.by, claim: verdict.claim,
      detail: String(resolution.payload.detail ?? '').slice(0, 240), reason: verdict.reason,
    });
  }
  return out;
}

/** Open owner-gate incidents whose own text says they are not owner work: [{incidentId, kind, marker, detail}]. */
export function ownerGatesNotOwnerWork(db, workflowId) {
  return db.prepare("SELECT incident_id,last_progress FROM incidents WHERE workflow_id=? AND status='open' ORDER BY updated_at").all(workflowId)
    .map((row) => ({ row, kind: incidentKindOf(row.last_progress) }))
    .filter(({ kind }) => OWNER_GATE_KINDS.includes(kind))
    .map(({ row, kind }) => ({ incidentId: row.incident_id, kind, marker: notOwnerWorkOf(row.last_progress), detail: String(row.last_progress ?? '').replace(/^\[[^\]]+\]\s*/, '').slice(0, 200) }))
    .filter((item) => item.marker);
}
