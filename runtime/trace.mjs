import crypto from 'node:crypto';
import { validatorFor } from '../operators/validation.mjs';

export const RECEIPT_TYPES = Object.freeze(['CALL','RETURN','TRANSITION','WAIT','RESUME','SKIP','ERROR']);
const validate = validatorFor(new URL('./receipt.schema.json', import.meta.url));
const secret = /(?:secret|token|password|authorization|api[-_]?key|credential)/i;
const forbidden = /(?:chain[-_ ]?of[-_ ]?thought|reasoning|hiddenPrompt)/i;
function redactString(value) {
  return value
    .replace(/(https?:\/\/)([^\s/@:]+):([^\s/@]+)@/gi, '$1[REDACTED]@')
    .replace(/([?&](?:token|secret|password|api[_-]?key|access[_-]?token)=)[^&#\s]+/gi, '$1[REDACTED]')
    .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi, '$1 [REDACTED]')
    .replace(/\b(Authorization|X-Api-Key|Cookie|Set-Cookie)\s*:\s*[^\r\n]+/gi, '$1: [REDACTED]');
}
export function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (typeof value === 'string') return redactString(value);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !forbidden.test(key)).map(([key,item]) => [key, secret.test(key) ? '[REDACTED]' : redact(item)]));
}
export function fingerprint(value) { return `sha256:${crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')}`; }
export function createReceipt(type, fields, { debug = true, now = () => new Date().toISOString() } = {}) {
  if (!RECEIPT_TYPES.includes(type)) throw new Error(`unsupported receipt type: ${type}`);
  const normalized = redact(fields);
  const fullTrace = { missionContext: normalized.missionContext ?? null, context: normalized.context ?? null, input: normalized.input ?? null, expectedOutput: normalized.expectedOutput ?? null, actualOutput: normalized.actualOutput ?? null, evidenceRefs: normalized.evidenceRefs ?? [], sourceHeads: normalized.sourceHeads ?? [], transitionRule: normalized.transitionRule ?? null, resumeState: normalized.resumeState ?? null, skip: normalized.skip ?? null, error: normalized.error ?? null };
  const progressFingerprint = fingerprint({ type, skillId: normalized.skillId, operatorId: normalized.operatorId, actualOutput: fullTrace.actualOutput, transitionRule: fullTrace.transitionRule, resumeState: fullTrace.resumeState });
  const receipt = { version:'7.0.0', receiptId: normalized.receiptId, type, missionId: normalized.missionId, skillId: normalized.skillId ?? null, operatorId: normalized.operatorId ?? null, parentId: normalized.parentId ?? null, childId: normalized.childId ?? null, timestamp: now(), progressFingerprint, trace: debug ? fullTrace : { evidenceRefs: fullTrace.evidenceRefs, sourceHeads: fullTrace.sourceHeads } };
  const result = validate(receipt); if (!result.valid) throw new Error(result.errors.join('; ')); return receipt;
}
export function assertProgress(receipts) { const seen = new Set(); for (const item of receipts) { const key = `${item.type}:${item.progressFingerprint}`; if (seen.has(key)) throw new Error('no-progress cycle'); seen.add(key); } return true; }
