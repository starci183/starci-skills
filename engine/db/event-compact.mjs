// event-compact.mjs — the bounded inline view of an event payload, and the one place the event size bound is declared.
// A launch admission decision (every candidate with its quota snapshot, the pick record) and an admission refusal grow with the number of
// candidates, so no event may carry one whole: appendEvent (ledger.mjs) stores the full payload as a blob (events.payload_sha) and keeps this
// summary inline. Readers that need the whole decision read the blob behind the row's payload_sha.
import { isPlainObject } from '../plain-object.mjs';
import { list } from '../../scripts/lib/list.mjs';
import { redactData } from '../../scripts/lib/redact.mjs';

/** Declared sizes: the ledger event bound and the inline summary caps (every cap keeps the summary far below the bound). */
export const EVENT_LIMITS = Object.freeze({ payloadBytes: 16384, rows: 8, ids: 8, stringChars: 200, lineChars: 600, depth: 8 });
export const ADMISSION_SCHEMA = 'starci/agent-admission@1';
export const REFUSAL_SCHEMA = 'starci/admission-refusal@1';

const clip = (value, max = EVENT_LIMITS.stringChars) => (typeof value === 'string' && value.length > max ? `${value.slice(0, max)}...` : value);

/** The primitive fields of an object, long strings clipped: quota snapshots and other nested records are dropped. */
function scalars(value) {
  if (!isPlainObject(value)) return value ?? null;
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v === null || ['string', 'number', 'boolean'].includes(typeof v)).map(([k, v]) => [k, clip(v)]));
}
const rowOf = (row) => ({ id: row?.id ?? null, provider: row?.provider ?? null, model: row?.model ?? null, codes: list(row?.codes).slice(0, EVENT_LIMITS.rows).map((code) => clip(code, 80)) });

function admissionSummary(a) {
  const receipt = isPlainObject(a.receipt) ? { ...scalars(a.receipt), ...(isPlainObject(a.receipt.scope) ? { scope: scalars(a.receipt.scope) } : {}) } : null;
  return { schema: a.schema, ok: a.ok === true, reason: clip(a.reason ?? null), policyVersion: a.policyVersion ?? null, chosenBy: clip(a.chosenBy ?? null),
    overrideApplied: a.overrideApplied === true, resetAt: a.resetAt ?? null, request: scalars(a.request), selected: scalars(a.selected),
    eligibleCount: list(a.eligible).length, eligible: list(a.eligible).slice(0, EVENT_LIMITS.ids).map((row) => row?.id ?? null),
    rejectedCount: list(a.rejected).length, rejected: list(a.rejected).slice(0, EVENT_LIMITS.rows).map(rowOf),
    ...(receipt ? { receipt } : {}), summarized: true };
}

function refusalSummary(r) {
  const rows = list(r.rejected), alternatives = list(r.alternatives);
  return { schema: r.schema, class: r.class ?? null, queuedBecause: r.queuedBecause ?? null, line: clip(r.line ?? null, EVENT_LIMITS.lineChars),
    rejectedCount: rows.length, rejected: rows.slice(0, EVENT_LIMITS.rows).map(rowOf),
    alternativesCount: alternatives.length, alternatives: alternatives.slice(0, EVENT_LIMITS.ids).map((entry) => clip(String(entry))), summarized: true };
}

const SUMMARIES = Object.freeze({ [ADMISSION_SCHEMA]: admissionSummary, [REFUSAL_SCHEMA]: refusalSummary });

/** `{payload, compacted}`: every admission-shaped record in `payload` replaced by its bounded summary; `compacted` says whether one was. */
function compactEventPayload(payload, depth = 0) {
  if (depth > EVENT_LIMITS.depth || payload === null || typeof payload !== 'object') return { payload, compacted: false };
  if (isPlainObject(payload) && typeof payload.schema === 'string' && payload.summarized !== true && SUMMARIES[payload.schema])
    return { payload: SUMMARIES[payload.schema](payload), compacted: true };
  let compacted = false;
  const visit = (value) => { const inner = compactEventPayload(value, depth + 1); compacted ||= inner.compacted; return inner.payload; };
  const copy = Array.isArray(payload) ? payload.map((item) => visit(item)) : Object.fromEntries(Object.entries(payload).map(([k, v]) => [k, visit(v)]));
  return { payload: compacted ? copy : payload, compacted };
}

/** A payload's bounded inline view when it went whole to the blob store: its top-level scalars (long strings clipped) and where the rest is. */
function spilledView(redacted, bytes, sha) {
  const flat = isPlainObject(redacted) ? scalars(redacted) : {};
  return { ...flat, spilled: true, sha256: sha, bytes };
}

/**
 * The stored form of an event payload: `{payloadJson, payloadSha}`. The payload is redacted. It goes whole to the blob store (`spill(bytes)`
 * stores it and returns its sha, kept when the caller already holds one) when it carries an admission record (the bounded summary is the inline
 * JSON) or when it is over the inline bound (the inline JSON is its top-level scalars and the sha). This is the one path of every event writer:
 * a payload that grows with its input (a file list, a manifest, a critique, a menu) never fails the write, and a reader that needs the whole
 * payload goes through engine/db/event-payload.mjs.
 */
export function eventPayloadRecord(payload, payloadSha, spill) {
  if (payload === null || payload === undefined) return { payloadJson: null, payloadSha };
  const redacted = redactData(payload);
  const { payload: inline, compacted } = compactEventPayload(redacted);
  const json = JSON.stringify(inline);
  if (compacted || payloadSha || json.length <= EVENT_LIMITS.payloadBytes) return { payloadJson: json, payloadSha: compacted && !payloadSha ? spill(Buffer.from(JSON.stringify(redacted))) : payloadSha };
  const sha = spill(Buffer.from(JSON.stringify(redacted)));
  return { payloadJson: JSON.stringify(spilledView(redacted, json.length, sha)), payloadSha: sha };
}
