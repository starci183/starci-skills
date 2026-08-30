import crypto from 'node:crypto';
import { validatorFor } from '../operators/validation.mjs';

export const RECEIPT_TYPES = Object.freeze(['CALL','RETURN','TRANSITION','WAIT','RESUME','SKIP','ERROR']);
export const MATERIAL_AI_OPERATORS = Object.freeze(new Set([
  'architecture/alternatives',
  'business/model-challenge',
  'fe/design-critique',
  'fe/direction-generate',
  'fe/direction-rank',
  'fe/independent-review',
  'fe/product-potential',
  'fe/semantic-audit',
  'fe/ui-audit',
  'fe/ui-direction',
  'fe/ux-audit',
  'fe/ux-flow',
  'fe/visual-fidelity',
]));
const validate = validatorFor(new URL('./receipt.schema.json', import.meta.url));
const issuedReceipts = new WeakSet();
const issuedReceiptDigests = new WeakMap();
const routableReturnReceipts = new WeakSet();
const operatorLifecycles = new Map();
const executionOwners = new Map();
const invocationOwners = new Map();
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

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function planOperatorLifecycle(type, normalized) {
  const invocationRef = normalized.context?.invocationRef;
  if (!invocationRef) throw new Error(`${normalized.operatorId}: operator lifecycle requires one invocationRef`);
  const lifecycleKey = `${normalized.missionId}:${normalized.operatorId}:${invocationRef}`;
  const executionRef = normalized.aiActivity?.executionRef ?? normalized.context?.executionRef;
  if (!/^execution:\/\/[0-9a-f]{64}$/.test(executionRef ?? '')) throw new Error(`${normalized.operatorId}: operator lifecycle requires one executionRef`);
  const identity = {
    executionRef,
    inputFingerprint: fingerprint(normalized.input ?? null),
    expectedOutputFingerprint: fingerprint(normalized.expectedOutput ?? null),
    principalFingerprint: normalized.aiActivity?.principalFingerprint ?? null,
    contextFingerprint: normalized.aiActivity?.contextFingerprint ?? null,
    aiKind: normalized.aiActivity?.kind ?? null,
  };
  const current = operatorLifecycles.get(lifecycleKey);
  if (type === 'CALL') {
    if (current) throw new Error(`${normalized.operatorId}: operator lifecycle CALL is duplicate or already closed`);
    const invocationOwner = invocationOwners.get(invocationRef);
    if (invocationOwner && invocationOwner !== lifecycleKey) throw new Error(`${normalized.operatorId}: invocation identity is already bound to another mission or operator`);
    const executionOwner = executionOwners.get(executionRef);
    if (executionOwner && executionOwner !== lifecycleKey) throw new Error(`${normalized.operatorId}: execution identity is already bound to another invocation`);
    return { lifecycleKey, invocationRef, phase: 'CALL', ...identity };
  }
  const requiredPhase = type === 'RETURN' ? 'CALL' : 'RETURN';
  if (!current || current.phase !== requiredPhase) throw new Error(`${normalized.operatorId}: operator lifecycle requires ${requiredPhase} before ${type}`);
  for (const field of ['executionRef','inputFingerprint','expectedOutputFingerprint','principalFingerprint','contextFingerprint','aiKind']) {
    if (current[field] !== identity[field]) throw new Error(`${normalized.operatorId}: operator lifecycle ${field} changed between ${requiredPhase} and ${type}`);
  }
  return { ...current, phase: type };
}

function inspectionLines(actualOutput, operatorId) {
  const result = (actualOutput?.output ?? actualOutput)?.result;
  const records = result?.inspectionRecords ?? [];
  if (operatorId === 'fe/independent-review' && (result?.inspectionVerdicts?.length ?? 0) > 0) {
    return result.inspectionVerdicts.flatMap((record) => [
      `[AI REVIEW][image: ${record.inspectionRef}]`,
      `[FINDING][independent-review][${record.verdict === 'finding' ? 'PROBLEM' : 'PASSED'}] ${record.observation}`,
      `[VERDICT] ${record.verdict === 'finding' ? 'FINDING' : 'PASSED'}`,
    ]);
  }
  if (records.length === 0 && ['fe/visual-fidelity', 'fe/independent-review'].includes(operatorId)) return [
    '[AI REVIEW][image: missing]',
    '[FINDING][inspection][MISSING] No concrete raster inspection record was supplied.',
    '[VERDICT] BLOCKED',
  ];
  return records.flatMap((record) => {
    const findings = [
      ...(record.lensVerdicts ?? []).map(({ lens, verdict, observation }) => `[FINDING][${lens}][${String(verdict).toUpperCase()}] ${observation}`),
      ...(record.challengeRecords ?? []).map(({ family, disposition, pixelObservation }) => `[FINDING][${family}][${String(disposition).toUpperCase()}] ${pixelObservation}`),
    ];
    return [
      `[AI REVIEW][image: ${record.imageRef ?? 'unknown'}]`,
      ...(findings.length > 0 ? findings : ['[FINDING][inspection][MISSING] No concrete raster inspection record was supplied.']),
      `[VERDICT] ${String(record.verdict ?? 'blocked').toUpperCase()}`,
    ];
  });
}

export function renderAiDebug(receipt) {
  const activity = receipt.trace?.aiActivity;
  if (!activity) return [];
  const header = `[AI ${String(activity.kind ?? 'activity').toUpperCase()}][${receipt.type}] model=${activity.model} execution=${activity.executionRef} isolation=${activity.isolation}`;
  const contract = JSON.stringify({
    input: receipt.trace.input,
    expectedOutput: receipt.trace.expectedOutput,
    actualOutput: receipt.trace.actualOutput,
    evidenceRefs: receipt.trace.evidenceRefs,
  });
  return [header, `[CONTRACT] ${contract}`, ...inspectionLines(receipt.trace.actualOutput, receipt.operatorId)];
}

export function createReceipt(type, fields, { debug = true, now = () => new Date().toISOString(), writeDebug = console.log } = {}) {
  if (!RECEIPT_TYPES.includes(type)) throw new Error(`unsupported receipt type: ${type}`);
  const normalized = redact(fields);
  const aiRequired = MATERIAL_AI_OPERATORS.has(normalized.operatorId) && ['CALL', 'RETURN', 'TRANSITION'].includes(type);
  const lifecycleRequired = Boolean(normalized.operatorId) && ['CALL', 'RETURN', 'TRANSITION'].includes(type);
  if (aiRequired && debug !== true) throw new Error(`${normalized.operatorId}: material AI receipts require runtime debug=true`);
  if (aiRequired && !normalized.aiActivity) throw new Error(`${normalized.operatorId}: debug AI activity is required for ${type}`);
  if (normalized.aiActivity && (
    normalized.aiActivity.model !== 'gpt-5.6-sol' ||
    normalized.aiActivity.count !== 1 ||
    normalized.aiActivity.isolation !== 'fresh' ||
    normalized.aiActivity.forkTurns !== 'none' ||
    !/^execution:\/\/[0-9a-f]{64}$/.test(normalized.aiActivity.executionRef ?? '') ||
    !/^sha256:[0-9a-f]{64}$/.test(normalized.aiActivity.principalFingerprint ?? '') ||
    !/^sha256:[0-9a-f]{64}$/.test(normalized.aiActivity.contextFingerprint ?? '')
  )) throw new Error('AI activity must bind one fresh gpt-5.6-sol execution with no forked turns');
  const operatorLifecycle = lifecycleRequired ? planOperatorLifecycle(type, normalized) : null;
  const fullTrace = { missionContext: normalized.missionContext ?? null, context: normalized.context ?? null, input: normalized.input ?? null, expectedOutput: normalized.expectedOutput ?? null, actualOutput: normalized.actualOutput ?? null, payloadRef: normalized.payloadRef ?? null, authorityRefs: normalized.authorityRefs ?? [], evidenceRefs: normalized.evidenceRefs ?? [], sourceHeads: normalized.sourceHeads ?? [], transitionRule: normalized.transitionRule ?? null, resumeState: normalized.resumeState ?? null, skip: normalized.skip ?? null, error: normalized.error ?? null, aiActivity: normalized.aiActivity ?? null };
  const progressFingerprint = fingerprint({ type, skillId: normalized.skillId, operatorId: normalized.operatorId, actualOutput: fullTrace.actualOutput, transitionRule: fullTrace.transitionRule, resumeState: fullTrace.resumeState });
  const receipt = { version:'7.2.0', receiptId: normalized.receiptId, type, missionId: normalized.missionId, skillId: normalized.skillId ?? null, operatorId: normalized.operatorId ?? null, parentId: normalized.parentId ?? null, childId: normalized.childId ?? null, timestamp: now(), progressFingerprint, trace: debug ? fullTrace : { authorityRefs: fullTrace.authorityRefs, evidenceRefs: fullTrace.evidenceRefs, sourceHeads: fullTrace.sourceHeads } };
  const result = validate(receipt); if (!result.valid) throw new Error(result.errors.join('; '));
  deepFreeze(receipt);
  if (operatorLifecycle) {
    operatorLifecycles.set(operatorLifecycle.lifecycleKey, operatorLifecycle);
    executionOwners.set(operatorLifecycle.executionRef, operatorLifecycle.lifecycleKey);
    invocationOwners.set(operatorLifecycle.invocationRef, operatorLifecycle.lifecycleKey);
    if (type === 'RETURN') routableReturnReceipts.add(receipt);
  }
  issuedReceipts.add(receipt);
  issuedReceiptDigests.set(receipt, fingerprint(receipt));
  if (debug && fullTrace.aiActivity) for (const line of renderAiDebug(receipt)) writeDebug(line);
  return receipt;
}
export function isCanonicalReceipt(receipt) {
  return issuedReceipts.has(receipt) && issuedReceiptDigests.get(receipt) === fingerprint(receipt) && validate(receipt).valid;
}
export function assertCanonicalReceipts(receipts, label = 'receipts') {
  const invalidIndex = receipts.findIndex((receipt) => !isCanonicalReceipt(receipt));
  if (invalidIndex >= 0) throw new Error(`${label}[${invalidIndex}] is not a runtime-issued immutable receipt`);
  return true;
}
export function isRoutableOperatorReturnReceipt(receipt) {
  return isCanonicalReceipt(receipt) && routableReturnReceipts.has(receipt);
}
export function assertProgress(receipts) { const seen = new Set(); for (const item of receipts) { const key = `${item.type}:${item.progressFingerprint}`; if (seen.has(key)) throw new Error('no-progress cycle'); seen.add(key); } return true; }
