#!/usr/bin/env node
// decisions.mjs — Decision Items (DI) and the doorbell (reconciler DESIGN §10.3-10.4, lane rc-decisions).
//
// A DI is the durable message a decider acts on; the doorbell is only a reminder that DIs wait. Nobody types a
// notice into a Kernel terminal any more: a controller, the SLA layer or the Supervisor OPENS a DI and rings.
//
//   store     product DIs: runtime.sqlite decision_items through engine/db/ledger.mjs (openDecisionItem,
//             updateDecisionItem; a resolution is a decisions row via recordDecision), keys checked (MB-07),
//             events decision-opened|claimed|resolved|escalated|expired|superseded. The Supervisor's own DIs are
//             machine.sqlite sup_decision_items (+ sup_decisions, sup_events sup-decision-*); its doorbell is a
//             sup_events supervisor-ring and one deliveries row (doorbell, seat supervisor) per attempt.
//   verb      `api decisions` (scripts/kernel/verbs/decisions.mjs) is the only writer of product DIs; this
//             module's openDecision(repo, di) runs it as a child; the functions taking a `ledger` are its core.
//   doorbell  ringDoorbell: one fixed line through wake-delivery.mjs, ONLY when the seat reads turn-idle; a busy
//             seat is `deferred` (the DI is not lost), at most one ring per RING_MIN_GAP_MS per seat, never the
//             same text twice in a row.
//   ladder    escalateDue: a Kernel DI past dueAt is escalated once (a reminder, still the Kernel's); past dueAt x2
//             it is marked escalated and becomes a Supervisor DI in machine.sqlite.
//
//   node scripts/machine/decisions.mjs ring --repo <r> --workflow <wf> [--json]
//   node scripts/machine/decisions.mjs escalate-due [--apply] [--json]          (default: plan only, shadow)
//   node scripts/machine/decisions.mjs supervisor --list [--all] [--json]
//   node scripts/machine/decisions.mjs supervisor --claim <id> --by <actor> | --resolve <id> --by <actor> --verb <text> [--decision <id>]
//   node scripts/machine/decisions.mjs supervisor --ring [--json]
import crypto from 'node:crypto';
import path from 'node:path';
import { runNode } from '../api/node/run-node.mjs';
import { execNode } from '../api/node/exec-node.mjs';
import { fileURLToPath } from 'node:url';
import { parseJsonOr } from '../lib/json.mjs';
import { refuse as refuseError } from '../../engine/refuse.mjs';
import { kernelDecisionItems } from './reported-jobs.mjs';
import { appendEvent, openDecisionItem, recordDecision, updateDecisionItem } from '../../engine/db/ledger.mjs'; import { isMain } from '../lib/is-main.mjs';
import { oneLine } from '../lib/clip.mjs';

const selfFile = fileURLToPath(import.meta.url);
const SKILL_ROOT = path.resolve(path.dirname(selfFile), '..', '..');
const API_FILE = path.join(SKILL_ROOT, 'scripts', 'kernel', 'cli.mjs');

export const DI_SCHEMA = 'starci/decision-item@1';
export const DI_KINDS = Object.freeze(['settle-nongreen', 'worker-question', 'checks-needed', 'graph-edit-needed', 'progress-stall',
  'stale-gate', 'stale-wait', 'unread-peer', 'orphaned-frontier', 'rev-ack', 'supervisor-ruling', 'cross-workflow', 'deadlock',
  'runtime-defect', 'kernel-proposal', 'seat-unrecoverable', 'service-quarantined', 'quota-exhausted', 'experiment-revert',
  'push-refused', 'retry-decision', 'dispatch-refused', 'cap-starved', 'hypothesis', 'rebase-conflict']);
const DECIDERS = Object.freeze(['kernel', 'supervisor', 'owner']);
/**
 * Kinds the Supervisor decides unless the opener names another decider (DESIGN §6.4 escalation column: resource,
 * host, workers and learning controllers open these for the Supervisor). `cap-starved` is resource policy (lane
 * rc-gc-resource's Resource controller), next to `quota-exhausted`.
 */
const SUPERVISOR_KINDS = Object.freeze(['cap-starved', 'quota-exhausted', 'runtime-defect', 'cross-workflow', 'deadlock',
  'seat-unrecoverable', 'service-quarantined', 'experiment-revert', 'hypothesis', 'push-refused', 'kernel-proposal']);
const defaultDeciderOf = (kind) => (SUPERVISOR_KINDS.includes(kind) ? 'supervisor' : 'kernel');
/** Kinds the Supervisor may claim from a Kernel without an escalation (DESIGN §11.3 rule 1). */
const CROSS_WORKFLOW_KINDS = Object.freeze(['cross-workflow', 'deadlock']);
export const LIVE = Object.freeze(['open', 'claimed', 'escalated']);
export const CLAIM_TTL_MS = 15 * 60_000;
export const DEFAULT_DUE_MS = Object.freeze({ kernel: 30 * 60_000, supervisor: 60 * 60_000, owner: 24 * 3_600_000 });
export const RING_MIN_GAP_MS = 2 * 60_000;
const RING_TAG = '[decide]';
const PASS_THROUGH = ['productLedger', 'productWorkflowId', 'code', 'escalatedFrom'];

const one = (s, n = 300) => oneLine(s, n);
export const refuse = (message, code, extra = {}) => refuseError(message, code, extra);
const diIdOf = (workflowId, key) => `di-${crypto.createHash('sha256').update(`${workflowId}\0${key}`).digest('hex').slice(0, 8)}`;
const isSupervisorActor = (by) => /^supervisor\b/i.test(String(by ?? ''));

/* ------------------------------------------------------------ the store: runtime.sqlite decision_items */
// Written only through engine/db/ledger.mjs (openDecisionItem, updateDecisionItem, recordDecision, appendEvent). A DI
// object is the row's columns plus its payload_json: the schema fields no column holds (entity, severity, ledger, item,
// refs, product*, resolution note, ...).

/** decision_items.entity_type's CHECK; any other entity type rides in the payload only. */
const ENTITY_TYPES = new Set(['job', 'unit', 'attempt', 'workflow', 'lane', 'service', 'seat']);
const SUBJECT_TYPES = new Set(['job', 'unit', 'attempt', 'graph', 'workflow']);
/** DI fields that live in columns; everything else is the payload. */
const COLUMN_FIELDS = new Set(['schema', 'id', 'idempotencyKey', 'key', 'keyParts', 'kind', 'decider', 'workflowId', 'summary', 'evidence', 'options', 'allowedVerbs',
  'openedBy', 'openedAt', 'dueAt', 'escalateTo', 'escalations', 'claim', 'status', 'supersededBy', 'claimExpired']);
const payloadOf = (di) => Object.fromEntries(Object.entries(di).filter(([k, v]) => !COLUMN_FIELDS.has(k) && v !== undefined));
const listOf = (text) => { const v = parseJsonOr(text, []); return Array.isArray(v) ? v : []; };

const rowToDi = (r) => {
  const p = parseJsonOr(r.payload_json, {}) ?? {};
  return {
    ...p, schema: DI_SCHEMA, id: r.di_id, idempotencyKey: r.idempotency_key, key: r.idempotency_key, keyParts: parseJsonOr(r.key_parts_json, {}) ?? {},
    kind: r.kind, decider: r.decider, workflowId: r.workflow_id,
    entity: p.entity ?? { type: r.entity_type ?? 'workflow', id: r.entity_id ?? r.workflow_id }, summary: r.summary,
    evidence: listOf(r.evidence_json), options: listOf(r.options_json), allowedVerbs: listOf(r.allowed_verbs_json),
    openedBy: r.opened_by, openedAt: r.opened_at, dueAt: r.due_at ?? null, escalateTo: r.escalate_to ?? null, escalations: Number(r.escalations) || 0,
    claim: r.claim_by ? { by: r.claim_by, at: r.claim_at, ttlMs: r.claim_ttl_ms ?? CLAIM_TTL_MS } : null, status: r.status,
    resolution: r.resolved_by ? { ...(p.resolution ?? {}), by: r.resolved_by, verb: r.resolution_verb, decisionId: r.decision_id ?? null, at: r.resolved_at } : p.resolution ?? null,
    supersededBy: r.superseded_by ?? null,
  };
};

/** The DI as a decider sees it now: a claim past its TTL reads open again (claimExpired). Pure. */
export function effective(di, now = Date.now()) {
  if (di?.status === 'claimed' && di.claim && di.claim.at + (di.claim.ttlMs ?? CLAIM_TTL_MS) <= now) return { ...di, status: 'open', claimExpired: true };
  return di;
}

const byUrgency = (a, b) => (b.severity === 'critical') - (a.severity === 'critical') || (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity) || String(a.id).localeCompare(String(b.id));

// A workflow in an ended phase holds no decidable work: a DI left open on an archived workflow can never be
// resolved (events_refuse_archived refuses every further write), and an ended workflow's leftovers are never
// listed, escalated, rung or digested — they are the rows archive/finish close before the phase flips.
const ENDED = "(w.phase IS NULL OR w.phase NOT IN ('archived','finished'))";

/** A product ledger's DIs (`workflowId` narrows; live ones unless `all`), critical first, then by dueAt. */
export function listDecisions(db, { workflowId, all = false, decider = null, now = Date.now() } = {}) {
  const rows = workflowId
    ? db.prepare(`SELECT d.* FROM decision_items d LEFT JOIN workflows w ON w.workflow_id=d.workflow_id WHERE d.workflow_id=? AND ${ENDED} ORDER BY d.opened_at, d.di_id`).all(workflowId)
    : db.prepare(`SELECT d.* FROM decision_items d LEFT JOIN workflows w ON w.workflow_id=d.workflow_id WHERE ${ENDED} ORDER BY d.opened_at, d.di_id`).all();
  return rows.map(rowToDi).map((d) => effective(d, now))
    .filter((d) => (all || LIVE.includes(d.status)) && (!decider || d.decider === decider)).sort(byUrgency);
}

export function getDecision(db, id, { now = Date.now() } = {}) {
  const r = db.prepare('SELECT * FROM decision_items WHERE di_id=?').get(id);
  return r ? effective(rowToDi(r), now) : null;
}

/** Write a DI object's mutable state back to its row (inside the caller's transaction); a resolution records a decision. */
const write = (ledger, di, now) => {
  const prior = getDecision(ledger.db, di.id, { now });
  let decisionId = di.resolution?.decisionId ?? null;
  if (di.status === 'resolved' && prior?.status !== 'resolved' && !decisionId) {
    const subjectType = SUBJECT_TYPES.has(di.entity?.type) ? di.entity.type : 'workflow';
    decisionId = recordDecision(ledger.db, { workflowId: di.workflowId, decider: di.resolution?.by ?? di.decider, diId: di.id, subjectType,
      subjectId: subjectType === 'workflow' ? di.workflowId : di.entity?.id, choice: di.resolution?.verb ?? 'resolved', rationale: di.resolution?.note ?? null, decidedAt: now });
  }
  updateDecisionItem(ledger.db, { diId: di.id, at: now, status: di.status, dueAt: di.dueAt ?? null, escalateTo: di.escalateTo ?? null, escalations: di.escalations ?? 0,
    claimBy: di.claim?.by ?? null, claimAt: di.claim?.at ?? null, claimTtlMs: di.claim ? di.claim.ttlMs ?? CLAIM_TTL_MS : null,
    resolvedBy: di.resolution?.by ?? null, resolvedAt: di.resolution?.at ?? null, resolutionVerb: di.resolution?.verb ?? null, decisionId: di.resolution ? decisionId : null,
    supersededBy: di.supersededBy ?? null, payload: payloadOf(di) });
};

/** Insert a new DI object (inside the caller's transaction). */
const insert = (ledger, di, keyParts) => {
  const entityType = ENTITY_TYPES.has(di.entity?.type) ? di.entity.type : null;
  openDecisionItem(ledger.db, { diId: di.id, idempotencyKey: di.idempotencyKey, keyParts, workflowId: di.workflowId, kind: di.kind, decider: di.decider, summary: di.summary,
    openedBy: di.openedBy, at: di.openedAt, entityType, entityId: entityType ? di.entity.id : null, jobId: entityType === 'job' ? di.entity.id : null,
    dueAt: di.dueAt, escalateTo: di.escalateTo, evidence: di.evidence, options: di.options, allowedVerbs: di.allowedVerbs, payload: payloadOf(di) });
};

const event = (ledger, prefix, di, verb, payload, now) => appendEvent(ledger.db, { workflowId: di.workflowId, entityType: 'decision', entityId: di.id,
  kind: `${prefix}-${verb}`, payload: { id: di.id, kind: di.kind, decider: di.decider, entity: di.entity, ...payload }, createdAt: now });

/**
 * Open a DI, idempotent on its key: a key already live returns that DI (`existing: true`); a resolved or superseded
 * key returns it too (a new occurrence needs a new key, e.g. with the report id). A `supervisor-ruling` supersedes
 * the live Kernel DIs on the same entity. Returns {di, created, existing, superseded: [ids]}.
 */
export function openDecisionRow(ledger, spec, { now = Date.now(), prefix = 'decision', ledgerName = null } = {}) {
  const kind = String(spec.kind ?? '').trim();
  if (!DI_KINDS.includes(kind)) throw refuse(`--kind must be one of ${DI_KINDS.join('|')}`, 'decision-kind-invalid');
  const decider = String(spec.decider || defaultDeciderOf(kind)).trim();
  if (!DECIDERS.includes(decider)) throw refuse(`--decider must be ${DECIDERS.join('|')}`, 'decision-decider-invalid');
  const workflowId = String(spec.workflowId ?? '').trim();
  const entity = { type: String(spec.entity?.type ?? 'workflow'), id: String(spec.entity?.id ?? workflowId) };
  const summary = one(spec.summary, 600);
  if (!workflowId || !summary) throw refuse('a decision needs --workflow and --summary', 'decision-incomplete');
  if (!ledger.db.prepare('SELECT 1 FROM workflows WHERE workflow_id=?').get(workflowId)) throw refuse(`workflow ${workflowId} is not in this ledger`, 'workflow-unknown');
  const key = String(spec.idempotencyKey ?? '').trim() || `${kind}:${entity.type}:${entity.id}${kind === 'supervisor-ruling' ? `:${crypto.createHash('sha256').update(summary).digest('hex').slice(0, 8)}` : ''}`;
  checkKey(key);
  // MB-07: every DI row carries its key's named parts; a key opened without them is described by its own components.
  const keyParts = checkKeyParts(spec.keyParts ?? Object.fromEntries(key.split(':').map((part, i) => [i ? `part${i}` : 'kind', part])));
  const by = one(spec.by ?? spec.openedBy ?? 'unknown', 120);
  let out = null;
  ledger.transaction(() => {
    const prior = ledger.db.prepare('SELECT * FROM decision_items WHERE idempotency_key=?').get(key);
    if (prior) { out = { di: effective(rowToDi(prior), now), created: false, existing: true, superseded: [] }; return; }
    const asked = Number.isFinite(Number(spec.dueMs)) && Number(spec.dueMs) > 0 ? Number(spec.dueMs)
      : Number.isFinite(spec.dueAt) && spec.dueAt > now ? spec.dueAt - now : null;
    const dueMs = asked ?? DEFAULT_DUE_MS[decider];
    const di = {
      schema: DI_SCHEMA, id: diIdOf(workflowId, key), idempotencyKey: key, kind, decider,
      ledger: ledgerName, workflowId, entity, summary,
      evidence: (Array.isArray(spec.evidence) ? spec.evidence : []).slice(0, 40),
      options: Array.isArray(spec.options) ? spec.options.slice(0, 12) : [],
      allowedVerbs: Array.isArray(spec.allowedVerbs) ? spec.allowedVerbs.map(String) : [],
      severity: spec.severity === 'critical' ? 'critical' : 'normal',
      openedBy: by, openedAt: now, dueAt: now + dueMs,
      escalateTo: decider === 'kernel' ? 'supervisor' : decider === 'supervisor' ? 'owner' : null, escalations: 0,
      claim: null, status: 'open', resolution: null,
      ...(spec.item ? { item: String(spec.item) } : {}), ...(spec.refs ? { refs: spec.refs } : {}),
      // What a controller's DI carries beyond the schema core (lanes rc-gc-resource, rc-host, rc-sla-workflow).
      ...Object.fromEntries(PASS_THROUGH.filter((k) => spec[k] != null).map((k) => [k, spec[k]])),
    };
    const superseded = [];
    insert(ledger, di, keyParts); // first: superseded_by references it
    if (spec.supersedeEntity === true) {
      // MB-07: one live DI per (kind, entity): a new key (a changed failure signature or head) supersedes the older one.
      for (const old of listDecisions(ledger.db, { workflowId, now }).filter((d) => d.idempotencyKey !== key)) {
        if (old.kind !== kind || old.entity?.type !== entity.type || old.entity?.id !== entity.id) continue;
        const next = { ...old, status: 'superseded', supersededBy: di.id, resolution: { by, verb: 'superseded', decisionId: null, at: now } };
        write(ledger, next, now);
        event(ledger, prefix, next, 'superseded', { by: di.id }, now);
        superseded.push(old.id);
      }
    }
    if (kind === 'supervisor-ruling') {
      for (const old of listDecisions(ledger.db, { workflowId, now }).filter((d) => d.idempotencyKey !== key)) {
        if (old.decider !== 'kernel' || old.kind === 'supervisor-ruling' || old.entity?.type !== entity.type || old.entity?.id !== entity.id) continue;
        const next = { ...old, status: 'superseded', supersededBy: di.id, resolution: { by, verb: 'superseded', decisionId: null, at: now } };
        write(ledger, next, now);
        event(ledger, prefix, next, 'superseded', { by: di.id }, now);
        superseded.push(old.id);
      }
    }
    // openDecisionItem wrote the decision-opened event; what it supersedes rides on each superseded event.
    out = { di, created: true, existing: false, superseded };
  });
  return out;
}

/**
 * MB-07: an idempotency key names every identity field: ':'-separated components, none empty ('push-refused:my-app:'
 * with an empty head merged 73 later refusals into the first DI). Throws decision-key-invalid.
 */
function checkKey(key) {
  const k = String(key ?? '');
  if (k.length < 5 || k.split(':').some((part) => !part.trim())) throw refuse(`decision key '${k}' has an empty component`, 'decision-key-invalid');
  return k;
}
/** The key's named components ({kind, repo, signature, head, ...}): each a non-empty string. Throws decision-key-invalid. */
function checkKeyParts(parts) {
  if (!parts || typeof parts !== 'object' || Array.isArray(parts)) throw refuse('keyParts must be an object', 'decision-key-invalid');
  const empty = Object.entries(parts).filter(([, v]) => !String(v ?? '').trim()).map(([k]) => k);
  if (empty.length || !Object.keys(parts).length) throw refuse(`decision keyParts has empty component(s): ${empty.join(', ') || 'none given'}`, 'decision-key-invalid');
  return Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, String(v)]));
}

const liveOrRefuse = (db, id, now) => {
  const di = getDecision(db, id, { now });
  if (!di) throw refuse(`decision ${id} is not in this ledger`, 'decision-unknown');
  if (!LIVE.includes(di.status)) throw refuse(`decision ${id} is ${di.status}`, 'decision-closed', { status: di.status });
  return di;
};
const heldByOther = (di, by, now) => di.status === 'claimed' && di.claim && di.claim.by !== by && di.claim.at + (di.claim.ttlMs ?? CLAIM_TTL_MS) > now;

/** Claim a DI for CLAIM_TTL_MS. Another live claimer is refused decision-held-by-other; the Supervisor claims a Kernel DI only escalated or cross-workflow. */
export function claimDecision(ledger, id, { by, now = Date.now(), prefix = 'decision' } = {}) {
  if (!String(by ?? '').trim()) throw refuse('--claim needs --by <actor>', 'decision-incomplete');
  let out = null;
  ledger.transaction(() => {
    const di = liveOrRefuse(ledger.db, id, now);
    if (heldByOther(di, by, now)) throw refuse(`decision ${id} is claimed by ${di.claim.by} until ${new Date(di.claim.at + (di.claim.ttlMs ?? CLAIM_TTL_MS)).toISOString()}`, 'decision-held-by-other', { holder: di.claim.by });
    if (isSupervisorActor(by) && di.decider === 'kernel' && di.status !== 'escalated' && !CROSS_WORKFLOW_KINDS.includes(di.kind)) {
      throw refuse(`decision ${id} is the Kernel's (${di.kind}, not escalated): the Supervisor claims a Kernel DI only when it is escalated or cross-workflow; rule it with a supervisor-ruling DI instead`, 'decision-not-escalated');
    }
    if (di.claimExpired) event(ledger, prefix, di, 'expired', { claim: di.claim }, now);
    const next = { ...di, status: 'claimed', claim: { by: String(by), at: now, ttlMs: CLAIM_TTL_MS }, ...(di.status === 'escalated' ? { claimedEscalated: true } : {}) };
    write(ledger, next, now);
    event(ledger, prefix, next, 'claimed', { by: String(by), ttlMs: CLAIM_TTL_MS }, now);
    out = next;
  });
  return out;
}

/** The verb's first word must be one of the DI's allowedVerbs (their first words) when it lists any. */
const verbAllowed = (di, verb) => {
  const allowed = (di.allowedVerbs ?? []).map((v) => String(v).trim().replace(/^api\s+/, '').split(/\s+/)[0]).filter(Boolean);
  const head = String(verb ?? '').trim().replace(/^api\s+/, '').split(/\s+/)[0];
  return !allowed.length || allowed.includes(head);
};

export function resolveDecision(ledger, id, { by, verb, decisionId = null, note = null, now = Date.now(), prefix = 'decision' } = {}) {
  if (!String(by ?? '').trim() || !String(verb ?? '').trim()) throw refuse('--resolve needs --by <actor> and --verb <what you ran>', 'decision-incomplete');
  let out = null;
  ledger.transaction(() => {
    const di = liveOrRefuse(ledger.db, id, now);
    if (heldByOther(di, by, now)) throw refuse(`decision ${id} is claimed by ${di.claim.by}`, 'decision-held-by-other', { holder: di.claim.by });
    if (!verbAllowed(di, verb)) throw refuse(`decision ${id} (${di.kind}) is resolved by one of: ${di.allowedVerbs.join(', ')}`, 'decision-verb-not-allowed', { allowedVerbs: di.allowedVerbs });
    const next = { ...di, status: 'resolved', resolution: { by: String(by), verb: one(verb, 400), decisionId: decisionId ?? null, at: now, ...(note ? { note: one(note, 600) } : {}) } };
    write(ledger, next, now);
    event(ledger, prefix, next, 'resolved', next.resolution, now);
    out = next;
  });
  return out;
}

/**
 * Escalate a DI. `final` (the default for an explicit --escalate) marks it escalated to `to` (the claim is dropped,
 * the Supervisor may now claim it); `final: false` is the first, reminder escalation - the DI stays the decider's.
 */
export function escalateDecision(ledger, id, { to = 'supervisor', by = 'unknown', reason = null, final = true, now = Date.now(), prefix = 'decision' } = {}) {
  if (!['supervisor', 'owner', 'kernel'].includes(to)) throw refuse('--to supervisor|owner', 'decision-escalate-target');
  let out = null;
  ledger.transaction(() => {
    const di = liveOrRefuse(ledger.db, id, now);
    const next = final
      ? { ...di, status: 'escalated', escalateTo: to, escalations: (di.escalations ?? 0) + 1, claim: null, escalatedAt: now }
      : { ...di, escalations: (di.escalations ?? 0) + 1, remindedAt: now };
    write(ledger, next, now);
    event(ledger, prefix, next, 'escalated', { to: final ? to : di.decider, by: String(by), final, level: next.escalations, ...(reason ? { reason: one(reason, 400) } : {}) }, now);
    out = next;
  });
  return out;
}

/* ------------------------------------------------------------ decisions first (an api guard, not a prompt rule) */

/** A Kernel DI blocks new work once it is this old, open and unclaimed (coordinator 2026-09-28, fe-canon). */
export const BLOCK_AGE_MS = 2 * 60_000;
const DECISIONS_FIRST = 'decisions-first';
/** Kinds whose entity is a reported job: live only while the settler still hands that job to the Kernel. */
const JOB_KINDS = ['settle-nongreen', 'checks-needed', 'retry-decision'];
/** The env mark apiRun (kernel-authority.mjs) sets on its children: graph-edit / redesign resolve DIs through them. */
export const CHILD_ENV = 'STARCI_API_CHILD';

const pendingJobsOf = (db, workflowId, now) => { try { return new Map(kernelDecisionItems(db, workflowId, { now }).map((i) => [i.jobId, i])); } catch { return null; } };
const liveFor = (d, pending) => !(JOB_KINDS.includes(d.kind) && d.entity?.type === 'job' && pending && !pending.has(d.entity.id));
const lastAckAt = (db, workflowId) => db.prepare("SELECT max(created_at) t FROM events WHERE workflow_id=? AND kind='runtime-rev-acked'").get(workflowId)?.t ?? null;

/**
 * The Kernel DIs that block route / dispatch / enqueue / dispatch-ready now: decider kernel, open (not claimed),
 * older than BLOCK_AGE_MS, never a supervisor-ruling (a notice), and - for a job DI - its job still waits on the
 * Kernel's decision. Oldest first (critical before). Read-only.
 */
export function blockingDecisions(db, workflowId, { now = Date.now(), minAgeMs = BLOCK_AGE_MS } = {}) {
  let items;
  try { items = listDecisions(db, { workflowId, decider: 'kernel', now }); } catch { return []; }
  items = items.filter((d) => d.status === 'open' && d.kind !== 'supervisor-ruling' && now - (d.openedAt ?? now) >= minAgeMs);
  if (!items.length) return [];
  const pending = pendingJobsOf(db, workflowId, now);
  return items.filter((d) => liveFor(d, pending))
    .sort((a, b) => (b.severity === 'critical') - (a.severity === 'critical') || (a.openedAt ?? 0) - (b.openedAt ?? 0));
}

const q = (v) => (/[\s"'|;&<>]/.test(String(v)) ? `'${String(v).replace(/'/g, "'\\''")}'` : String(v));
const lastRefusalsOf = (db, jobId) => db.prepare("SELECT kind, payload_json FROM events WHERE entity_type='job' AND entity_id=? AND (kind LIKE '%-refused' OR kind LIKE '%needs-kernel') ORDER BY seq DESC LIMIT 6").all(jobId)
  .map((e) => ({ kind: e.kind, ...(parseJsonOr(e.payload_json, {}) ?? {}) }));
const reportOf = (db, dispatchId) => {
  if (!dispatchId) return null;
  const r = db.prepare('SELECT outcome, report_json FROM reports WHERE dispatch_id=? ORDER BY rowid DESC LIMIT 1').get(dispatchId);
  return r ? { outcome: r.outcome, ...(parseJsonOr(r.report_json, {}) ?? {}) } : null;
};
const appOf = (p) => String(p).replace(/\\/g, '/').match(/(?:^|\/)((?:apps|packages)\/[^/]+)/)?.[1] ?? '.';

/**
 * One DI in copy-paste form: {id, kind, jobId, code, what, commands: [{key, title, run}], decide, resolve}. For a job DI
 * the commands are filled from the job, its report and its last refusal: continue it on the current base with the
 * failing files added, split it per app when its paths span apps, and accept it again (settle pass re-runs the
 * integration and parity on the current tip) or drop it. Every command is an existing verb; the api refuses a wrong one.
 */
export function resolutionOf(db, di, { repo = '<repo>', now = Date.now() } = {}) {
  const wf = di.workflowId, api = 'node scripts/kernel/cli.mjs', R = `--repo ${q(repo)}`;
  const base = { id: di.id, kind: di.kind, summary: di.summary };
  const resolve = (verb) => `${api} decisions ${R} --resolve ${di.id} --by kernel:${wf} --verb ${q(verb)} --decision <decide id>`;
  if (!(JOB_KINDS.includes(di.kind) && di.entity?.type === 'job')) {
    const opts = (di.options ?? []).slice(0, 3).map((o, i) => ({ key: o.key ?? `option-${i + 1}`, title: o.title ?? o.key ?? '', run: o.verb ?? '' }));
    return { ...base, jobId: null, code: di.kind, what: di.summary, commands: opts, decide: null, resolve: resolve(opts[0]?.run || '<what you ran>') };
  }
  const jobId = di.entity.id;
  const job = db.prepare('SELECT job_id, op_id, status, payload_json FROM jobs WHERE job_id=?').get(jobId);
  const payload = parseJsonOr(job?.payload_json, {}) ?? {};
  const pending = pendingJobsOf(db, wf, now)?.get(jobId) ?? null;
  const refusal = lastRefusalsOf(db, jobId).find((r) => r.kind !== 'job-settle-needs-kernel') ?? null;
  const report = reportOf(db, pending?.dispatchId);
  const code = pending?.reason === 'settle-refused' ? (pending.detail?.[0] ?? refusal?.reason ?? 'settle-refused') : (pending?.reason ?? refusal?.reason ?? 'needs-kernel-decision');
  const outcome = pending?.outcome ?? report?.outcome ?? null;
  const failures = (refusal?.failures ?? []).map(String);
  const owned = (payload.owned_paths ?? []).map(String);
  // Owned paths may carry the product repo's folder (my-app/apps/...) while a report names repo-relative files.
  const repoPrefix = owned.map((p) => p.replace(/\\/g, '/').match(/^([^/]+\/)(?:apps|packages|src)\//)?.[1]).find(Boolean) ?? '';
  const withPrefix = (p) => (repoPrefix && !String(p).startsWith(repoPrefix) && /^(apps|packages|src)\//.test(String(p)) ? `${repoPrefix}${p}` : String(p));
  const failing = [...new Set([...(refusal?.files ?? []), ...(refusal?.continuation?.files ?? []), ...((report?.owedToWire ?? []).map((o) => o?.path).filter(Boolean))].map(withPrefix))].slice(0, 20);
  const paths = [...new Set([...owned, ...failing])];
  const op = job?.op_id ?? pending?.op ?? '<op>';
  const what = String(payload.displayWhat ?? payload.title ?? jobId);
  const params = { ...(payload.params ?? {}), ...(refusal?.continuation?.resumeFrom ? { resumeFrom: refusal.continuation.resumeFrom } : {}) };
  const paramsArg = Object.keys(params).length ? ` --params ${q(JSON.stringify(params))}` : '';
  const oneLine = String(report?.summary ?? di.summary).replace(/\s+/g, ' ').slice(0, 160);
  const whatLine = `${op} ${jobId} reported ${outcome ?? '?'}; refused ${code}${failures.length ? ` (${failures[0].replace(/\s+/g, ' ').slice(0, 80)})` : ''}: ${oneLine}`;
  const decide = `${api} decide ${R} --workflow ${wf} --hypothesis ${q(`${code} on ${jobId}`)} --action-key resolve-${code}-${jobId.slice(-10)} --metric ${q(`${jobId} decided and its unit moves`)}`;
  const failCheck = `${api} check ${R} --job ${jobId} --checks ${q(JSON.stringify([{ name: code, command: 'runtime settle', exitCode: 1, evidence: `${code}: ${failures.join('; ').replace(/\s+/g, ' ').slice(0, 200) || 'refused by the runtime'}` }]))}`;
  const closeOld = outcome === 'done' ? `${failCheck} ; ${api} settle ${R} --job ${jobId} --verdict fail`
    : `${api} settle ${R} --job ${jobId} --verdict ${outcome === 'blocked' || outcome === 'ask' ? 'blocked' : 'fail'}`;
  const enqueue = (ps, tag) => `${api} enqueue ${R} --workflow ${wf} --op ${op} --paths ${q(ps.join(','))} --retry-of ${jobId}${paramsArg} --what ${q(`${tag}: ${what}`.slice(0, 40))} --resolves ${di.id}`;
  const commands = [{ key: 'continue', title: `continue on the current base with the failing files added (${failing.length} file(s))`, run: `${closeOld} ; ${enqueue(paths, 'continue')}` }];
  const apps = [...new Set(paths.map(appOf))];
  if (apps.length > 1) {
    commands.push({ key: 'split-per-app', title: `split it per app (${apps.join(', ')})`, run: [closeOld, ...apps.slice(0, 4).map((a) => enqueue(paths.filter((p) => appOf(p) === a), a.split('/').pop()))].join(' ; ') });
  }
  if (outcome === 'done') {
    commands.push({ key: 'accept', title: 'accept it: settle pass re-runs integration and parity on the current tip (only when the blocker the refusal names has since landed)', run: `${api} settle ${R} --job ${jobId} --verdict pass` });
  } else {
    commands.push({ key: 'drop', title: 'drop the unit (the goal no longer needs it)', run: `${closeOld} ; ${api} reconcile ${R} --job ${jobId} --drop --reason ${q(`${code}: dropped by the Kernel`)}` });
  }
  return { ...base, jobId, code, outcome, what: whatLine, failing, commands: commands.slice(0, 3), decide, resolve: resolve('<the option you ran>') };
}

/** The refusal text of decisions-first: the top item and its exact commands. */
export function decisionsFirstText(verb, workflowId, blocking, top) {
  const step = top.decide ? 2 : 1;
  return [`${DECISIONS_FIRST}: ${blocking.length} Decision Item(s) of ${workflowId} wait on you, open and unclaimed for more than ${Math.round(BLOCK_AGE_MS / 60_000)} min - ${verb} is refused until you decide them (api decisions --workflow ${workflowId}).`,
    `Oldest: ${top.id} - ${top.what}`,
    top.decide ? `1. log it: ${top.decide}` : null,
    ...top.commands.map((c, i) => `${step}${String.fromCharCode(97 + i)}. ${c.title}: ${c.run}`),
    `${step + 1}. ${top.resolve}`,
    `(api decisions --claim ${top.id} --by kernel:${workflowId} holds it 15 min; a command carrying --resolves ${top.id} passes this guard)`].filter(Boolean).join('\n');
}

/**
 * Throw decisions-first when `workflowId` has blocking Kernel DIs. Exempt: a call carrying --resolves <a blocking DI id>
 * (`resolves`), a child of a resolving verb (graph-edit, redesign: env CHILD_ENV), a non-Kernel actor (STARCI_ACTOR
 * reconciler/* or supervisor).
 */
export function refuseDecisionsFirst(db, workflowId, verb, { now = Date.now(), resolves = resolvesArg(), env = process.env, repo = null } = {}) {
  if (!workflowId) return;
  if (env[CHILD_ENV] === '1' || /^(reconciler\/|supervisor)/.test(String(env.STARCI_ACTOR ?? ''))) return;
  const blocking = blockingDecisions(db, workflowId, { now });
  if (!blocking.length) return;
  if (resolves && blocking.some((d) => d.id === resolves)) return;
  const top = resolutionOf(db, blocking[0], { repo: repo ?? argValue('--repo') ?? '<repo>', now });
  throw Object.assign(new Error(decisionsFirstText(verb, workflowId, blocking, top)), { code: DECISIONS_FIRST, decision: top, blocking: blocking.map((d) => d.id) });
}

const argValue = (flag, argv = process.argv) => { const i = argv.indexOf(flag); return i >= 0 ? argv[i + 1] ?? null : null; };

/** --resolves <id> from this process's argv (route/dispatch/enqueue parse it in cli.mjs; the guard reads it here). */
function resolvesArg(argv = process.argv) { const i = argv.indexOf('--resolves'); return i >= 0 ? argv[i + 1] ?? null : null; }

/**
 * Close what no longer needs the Kernel: a supervisor-ruling opened before the Kernel's latest runtime-rev ack (a
 * notice, read), and a job DI whose job the settler no longer hands to the Kernel. Returns the closed ids.
 */
export function sweepDecisions(ledger, workflowId, { now = Date.now(), prefix = 'decision' } = {}) {
  const closed = [];
  const live = listDecisions(ledger.db, { workflowId, now });
  if (!live.length) return closed;
  const ackAt = lastAckAt(ledger.db, workflowId);
  const pending = pendingJobsOf(ledger.db, workflowId, now);
  ledger.transaction(() => {
    for (const d of live) {
      const acked = d.kind === 'supervisor-ruling' && ackAt != null && ackAt >= (d.openedAt ?? Infinity);
      const gone = !liveFor(d, pending);
      if (!acked && !gone) continue;
      const next = { ...d, status: 'resolved', claim: null, resolution: { by: 'runtime', verb: acked ? 'kernel-ack-rev' : 'job-decided', decisionId: null, at: now } };
      write(ledger, next, now);
      event(ledger, prefix, next, 'resolved', { ...next.resolution, auto: true }, now);
      closed.push(d.id);
    }
  });
  return closed;
}

/**
 * api archive / api finish close the workflow's live DIs (open|claimed|escalated) inside their own transaction,
 * BEFORE the phase flips: an archived workflow takes no further writes (events_refuse_archived), so a DI left
 * live there could never be resolved and would keep counting, escalating and digesting forever. Each resolves
 * by 'runtime' (verb workflow-archived | workflow-finished, event decision-resolved auto:true). Rows are read
 * raw, not through listDecisions — that reader already hides an ended workflow's leftovers, and a finished
 * workflow being archived still owes them a close. Returns the closed ids.
 */
export function closeWorkflowDecisions(ledger, workflowId, { verb, now = Date.now(), prefix = 'decision' } = {}) {
  const closed = [];
  const rows = ledger.db.prepare("SELECT * FROM decision_items WHERE workflow_id=? AND status IN ('open','claimed','escalated') ORDER BY opened_at, di_id").all(workflowId);
  for (const r of rows) {
    const d = effective(rowToDi(r), now);
    const next = { ...d, status: 'resolved', claim: null, resolution: { by: 'runtime', verb: one(verb, 400), decisionId: null, at: now } };
    write(ledger, next, now);
    event(ledger, prefix, next, 'resolved', { ...next.resolution, auto: true }, now);
    closed.push(d.id);
  }
  return closed;
}

/* ------------------------------------------------------------ the verb as a child (controllers, notify.mjs) */

/**
 * runDecisionsVerb without blocking the calling thread: the reconciler engine has one thread, and a spawnSync of up to
 * timeoutMs there stops every timer (the lease and the heartbeat) for that long (ENGINE-STALL).
 */
function runDecisionsVerbAsync(repo, argv, { env = process.env, timeoutMs = 60_000 } = {}) {
  return execNode([API_FILE, 'decisions', '--repo', repo, ...argv, '--json'], { cwd: SKILL_ROOT, timeout: timeoutMs, env, maxBuffer: 64 * 1024 * 1024 }).then(({ error, stdout, stderr }) => {
    const status = error ? (typeof error.code === 'number' ? error.code : null) : 0;
    let json = null;
    for (const text of [stdout, String(stderr ?? '').trim().split(/\r?\n/).pop()]) { try { json = JSON.parse(String(text ?? '').trim()); break; } catch { /* next */ } }
    return { ok: status === 0 && json?.ok !== false, status, json, err: String(stderr ?? '').slice(0, 1000) };
  });
}

/**
 * Open a DI (lane rc-engine ctx.openDecision). `di` uses the schema field names, as the controllers build it. A DI
 * whose `ledger` is 'supervisor' goes to machine.sqlite (openSupervisorDecision; `repo` unused); any other goes
 * to the product ledger at `repo` through `api decisions --open` (a child). Returns {ok, json: {decision, ...}}.
 */
export function openDecision(repo, di, { env = process.env, run = runDecisionsVerbAsync, now = Date.now() } = {}) {
  if (di?.ledger === 'supervisor') {
    return openSupervisorDecision(di, { env, now }).then((r) => ({ ok: true, json: { ok: true, created: r.created, existing: r.existing, superseded: r.superseded, decision: r.di } }),
      (error) => ({ ok: false, json: { ok: false, error: String(error?.message ?? error), code: error?.code ?? null } }));
  }
  const argv = ['--open', '--workflow', di.workflowId, '--kind', di.kind, '--summary', di.summary,
    '--entity-type', di.entity?.type ?? 'workflow', '--entity-id', di.entity?.id ?? di.workflowId, '--by', di.by ?? di.openedBy ?? env.STARCI_ACTOR ?? 'reconciler'];
  if (di.decider) argv.push('--decider', di.decider);
  const dueMs = di.dueMs ?? (Number.isFinite(di.dueAt) && di.dueAt > now ? di.dueAt - now : null);
  if (dueMs) argv.push('--due-ms', String(Math.round(dueMs)));
  if (di.idempotencyKey) argv.push('--key', di.idempotencyKey);
  if (di.severity) argv.push('--severity', di.severity);
  if (di.item) argv.push('--item', di.item);
  if (di.allowedVerbs?.length) argv.push('--allowed-verbs', di.allowedVerbs.join(','));
  if (di.evidence?.length) argv.push('--evidence-json', JSON.stringify(di.evidence));
  if (di.options?.length) argv.push('--options-json', JSON.stringify(di.options));
  return run(repo, argv, { env });
}


/* ------------------------------------------------------------ the doorbell */

const doorbellText = (n, workflowId, top = null) => [`${RING_TAG} ${n} waiting: api decisions --workflow ${workflowId}`,
  ...(top ? [`oldest ${top.id}: ${String(top.what).slice(0, 220)}`, top.decide ? `log: ${top.decide}` : null,
    `pick ONE: ${top.commands.map((c, i) => `(${String.fromCharCode(97 + i)}) ${c.title}: ${c.run}`).join(' || ')}`, `then: ${top.resolve}`] : [])].filter(Boolean).join(' | ');
const RING_SCOPE = 'decision-doorbell';

/**
 * The ring plan for one seat, pure: {ring: false, reason} or {ring: true, text}. `last` is the previous ring
 * {at, text, count} (rung ones only). Never within RING_MIN_GAP_MS, never the same text twice in a row.
 */
export function planRing({ open, workflowId, last = null, now = Date.now(), minGapMs = RING_MIN_GAP_MS, textOf = doorbellText }) {
  if (!open) return { ring: false, reason: 'nothing-open' };
  if (last?.at && now - last.at < minGapMs) return { ring: false, reason: 'rate-limited', nextAt: last.at + minGapMs };
  let text = textOf(open, workflowId);
  const count = (last?.count ?? 0) + 1;
  if (last?.text && last.text === text) text = `${text} (#${count})`;
  return { ring: true, text, count };
}

const lastRingOf = (db, scope, key) => parseJsonOr(db.prepare('SELECT value_json FROM signals WHERE scope=? AND key=?').get(scope, key)?.value_json, null);
const saveRing = (ledger, scope, key, value, now) => ledger.transaction(() => ledger.db.prepare(
  'INSERT INTO signals(scope,key,holder_pid,token,value_json,at,expires_at) VALUES(?,?,?,?,?,?,NULL) ON CONFLICT(scope,key) DO UPDATE SET value_json=excluded.value_json,at=excluded.at,holder_pid=excluded.holder_pid')
  .run(scope, key, process.pid, null, JSON.stringify(value), now));

/**
 * Ring one workflow's Kernel seat. Returns {action, delivered, open, text?, wake?}:
 *   rung          the seat read turn-idle and the line was proven on its screen;
 *   deferred      the seat is busy / gated / unavailable: not an error, ring again when it turns idle;
 *   rate-limited  rung less than RING_MIN_GAP_MS ago;  nothing-open  no live Kernel DI.
 * `ledger` (an open write handle) or `repo`; `wake` is wake-delivery.mjs wakeKernel (the caller passes it in; a spec passes a stub).
 */
export async function ringDoorbell(first = {}, second = null) {
  // The engine form (lane rc-sla-workflow controllers/workflow.mjs): ringDoorbell(ctx, {ledgerId, workflowId, decider}).
  if (second) {
    const ctx = first ?? {};
    if (ctx.mode && ctx.mode !== 'active') return { action: 'shadow', delivered: false };
    if (second.decider === 'supervisor') return ringSupervisor({ env: ctx.env ?? process.env, wake: second.wake, now: ctx.now?.() ?? Date.now() });
    const repo = (ctx.ledgers ?? []).find((l) => l.ledgerId === second.ledgerId)?.repo;
    if (!repo) return { action: 'ledger-unknown', delivered: false };
    return ringDoorbell({ repo, workflowId: second.workflowId, wake: second.wake, now: ctx.now?.() ?? Date.now() });
  }
  const { repo = null, workflowId, ledger = null, wake = null, now = Date.now(), minGapMs = RING_MIN_GAP_MS } = first;
  if (typeof wake !== 'function') throw new Error('ringDoorbell: pass `wake` (scripts/kernel/wake-delivery.mjs wakeKernel); machine/ does not import the kernel');
  if (ledger) return ringDoorbellWith({ ledger, workflowId, wake, now, minGapMs });
  const { openLedger, ledgerFileFor } = await import('../../engine/db/ledger.mjs');
  const own = openLedger({ file: ledgerFileFor(path.resolve(repo)) });
  try { return ringDoorbellWith({ ledger: own, workflowId, wake, now, minGapMs }); } finally { own.close(); }
}

/** ringDoorbell's synchronous core over an open write handle; `wake` is wake-delivery.mjs wakeKernel (or a spec stub). */
export function ringDoorbellWith({ ledger, workflowId, wake, now = Date.now(), minGapMs = RING_MIN_GAP_MS, repo = null }) {
  const open = listDecisions(ledger.db, { workflowId, decider: 'kernel', now }).filter((d) => d.status === 'open').length;
  const last = lastRingOf(ledger.db, RING_SCOPE, workflowId);
  // The oldest open decision in copy-paste form rides on the ring, so the Kernel only has to pick one and run it.
  let top = null;
  try {
    const first = blockingDecisions(ledger.db, workflowId, { now, minAgeMs: 0 })[0];
    const repoOf = repo ?? (ledger.file ? path.dirname(path.dirname(ledger.file)) : '<repo>');
    if (first) top = resolutionOf(ledger.db, first, { repo: repoOf, now });
  } catch { top = null; }
  const plan = planRing({ open, workflowId, last, now, minGapMs, textOf: (n, wf) => doorbellText(n, wf, top) });
  if (!plan.ring) return { action: plan.reason, delivered: false, open, ...(plan.nextAt ? { nextAt: plan.nextAt } : {}) };
  const woke = wake({ db: ledger.db, workflowId, text: plan.text, pending: 'hold' });
  if (woke?.action !== 'kernel-woken' || woke.delivered !== true) return { action: 'deferred', delivered: false, open, text: plan.text, wake: woke?.action ?? null, state: woke?.state ?? null };
  saveRing(ledger, RING_SCOPE, workflowId, { at: now, text: plan.text, count: plan.count, open }, now);
  try { ledger.transaction(() => ledger.appendEvent({ workflowId, entityType: 'workflow', entityId: workflowId, kind: 'decision-doorbell', payload: { open, text: plan.text, terminal: woke.terminal ?? null }, createdAt: now })); } catch { /* the ring stands */ }
  return { action: 'rung', delivered: true, open, text: plan.text, terminal: woke.terminal ?? null };
}

/* ------------------------------------------------------------ the Supervisor's DIs (machine.sqlite sup_decision_items) */

const withSup = async (fn, { env = process.env, now = Date.now() } = {}) => {
  const { withMachine } = await import('../../engine/db/machine.mjs');
  return withMachine(fn, { env, now: () => now });
};

/** A sup_decision_items row as the decision-item@1 object the deciders read (the schema payload + the row's state). */
const supDiOf = (r) => {
  const p = parseJsonOr(r.payload_json, {}) ?? {};
  return { ...p, id: r.di_id, idempotencyKey: r.idempotency_key, kind: r.kind, decider: r.decider, summary: r.summary, status: r.status,
    dueAt: r.due_at ?? p.dueAt ?? null, escalations: r.escalations ?? 0, deliveredAt: r.delivered_at ?? null,
    claim: r.claim_by ? { by: r.claim_by, at: r.claim_at, ttlMs: r.claim_ttl_ms ?? CLAIM_TTL_MS } : null,
    resolution: r.resolved_at != null ? { by: r.resolved_by, verb: r.resolution_verb, decisionId: r.decision_id, at: r.resolved_at } : null,
    ...(r.superseded_by ? { supersededBy: r.superseded_by } : {}) };
};
const supRow = (m, id) => m.db.prepare('SELECT * FROM sup_decision_items WHERE di_id=?').get(id) ?? null;

/** The Supervisor's DIs over a machine handle `m` (live ones unless `all`), critical first, then by dueAt. */
export const supervisorDecisions = (m, { all = false, now = Date.now() } = {}) => m.listSupDecisions({ open: !all }).map(supDiOf)
  .map((d) => effective(d, now)).filter((d) => all || LIVE.includes(d.status)).sort(byUrgency);

/**
 * The MB-07 key parts of a Supervisor DI: the opener's named parts (a ':' inside a part becomes '-') or, without them,
 * the ':'-separated components of its key. At least two parts, none empty.
 */
function supKeyParts(key, named) {
  if (named) return Object.fromEntries(Object.entries(checkKeyParts(named)).map(([k, v]) => [k, v.replace(/:/g, '-')]));
  const parts = key.split(':');
  return parts.length > 1 ? Object.fromEntries(parts.map((v, i) => [i === 0 ? 'kind' : `part${i}`, v])) : { kind: 'key', key };
}

/** Open a Supervisor DI (decider supervisor unless the opener names the owner) in machine.sqlite; `m` is a writer. */
function openSupDecisionRow(m, spec, { now = Date.now() } = {}) {
  const kind = String(spec.kind ?? '').trim();
  if (!DI_KINDS.includes(kind)) throw refuse(`--kind must be one of ${DI_KINDS.join('|')}`, 'decision-kind-invalid');
  const decider = String(spec.decider || 'supervisor').trim();
  if (!['supervisor', 'owner'].includes(decider)) throw refuse('a Supervisor decision is decided by supervisor|owner', 'decision-decider-invalid');
  const entity = { type: String(spec.entity?.type ?? 'supervisor'), id: String(spec.entity?.id ?? 'main') };
  const summary = one(spec.summary, 600);
  if (!summary) throw refuse('a decision needs --summary', 'decision-incomplete');
  const key = String(spec.idempotencyKey ?? '').trim() || `${kind}:${entity.type}:${entity.id}${kind === 'supervisor-ruling' ? `:${crypto.createHash('sha256').update(summary).digest('hex').slice(0, 8)}` : ''}`;
  checkKey(key);
  const keyParts = supKeyParts(key, spec.keyParts ?? null);
  const by = one(spec.by ?? spec.openedBy ?? 'unknown', 120);
  const productWorkflowId = spec.productWorkflowId ?? spec.workflowId ?? null;
  const asked = Number.isFinite(Number(spec.dueMs)) && Number(spec.dueMs) > 0 ? Number(spec.dueMs) : Number.isFinite(spec.dueAt) && spec.dueAt > now ? spec.dueAt - now : null;
  const dueAt = now + (asked ?? DEFAULT_DUE_MS[decider]);
  const escalateTo = decider === 'supervisor' ? 'owner' : null;
  const evidence = (Array.isArray(spec.evidence) ? spec.evidence : []).slice(0, 40);
  const options = Array.isArray(spec.options) ? spec.options.slice(0, 12) : [];
  const allowedVerbs = Array.isArray(spec.allowedVerbs) ? spec.allowedVerbs.map(String) : [];
  const payload = { schema: DI_SCHEMA, idempotencyKey: key, kind, decider, ledger: 'supervisor', workflowId: productWorkflowId, entity, summary, evidence, options, allowedVerbs,
    severity: spec.severity === 'critical' ? 'critical' : 'normal', openedBy: by, openedAt: now, dueAt, escalateTo,
    ...(spec.item ? { item: String(spec.item) } : {}), ...(spec.refs ? { refs: spec.refs } : {}), ...(spec.keyParts ? { keyParts: spec.keyParts } : {}),
    ...Object.fromEntries(PASS_THROUGH.filter((k) => spec[k] != null).map((k) => [k, spec[k]])), ...(productWorkflowId ? { productWorkflowId } : {}) };
  let ledgerId = null;
  try { ledgerId = spec.productLedger ? m.resolveLedger({ name: String(spec.productLedger) })?.ledgerId ?? null : null; } catch { ledgerId = null; }
  return m.transaction(() => {
    const r = m.openSupDecision({ keyParts, kind, decider, summary, ledgerId, workflowId: productWorkflowId, entityType: entity.type, entityId: entity.id,
      openedBy: by, dueAt, escalateTo, evidence, options, allowedVerbs, payload });
    const di = effective(supDiOf(supRow(m, r.diId)), now);
    if (!r.created) return { di, created: false, existing: true, superseded: [] };
    const superseded = [];
    if (spec.supersedeEntity === true) {
      // MB-07: one live DI per (kind, entity): a new key (a changed failure signature or head) supersedes the older one.
      for (const old of m.listSupDecisions({ open: true }).map(supDiOf)) {
        if (old.id === r.diId || old.kind !== kind || old.entity?.type !== entity.type || old.entity?.id !== entity.id) continue;
        m.setSupDecision(old.id, { status: 'superseded', by, supersededBy: r.diId });
        superseded.push(old.id);
      }
    }
    return { di, created: true, existing: false, superseded };
  });
}

const liveSupOrRefuse = (m, id, now) => {
  const row = supRow(m, id);
  if (!row) throw refuse(`decision ${id} is not a Supervisor decision`, 'decision-unknown');
  const di = effective(supDiOf(row), now);
  if (!LIVE.includes(di.status)) throw refuse(`decision ${id} is ${di.status}`, 'decision-closed', { status: di.status });
  return di;
};

/** Open a Supervisor DI in machine.sqlite (sup_decision_items). Returns {di, created, existing, superseded}. */
const openSupervisorDecision = (spec, { env = process.env, now = Date.now() } = {}) => withSup((m) => openSupDecisionRow(m, spec, { now }), { env, now });
export const listSupervisorDecisions = ({ env = process.env, all = false, now = Date.now() } = {}) => withSup((m) => supervisorDecisions(m, { all, now }), { env, now });
const claimSupervisorDecision = (id, { by, env = process.env, now = Date.now() } = {}) => withSup((m) => {
  if (!String(by ?? '').trim()) throw refuse('--claim needs --by <actor>', 'decision-incomplete');
  return m.transaction(() => {
    const di = liveSupOrRefuse(m, id, now);
    if (heldByOther(di, by, now)) throw refuse(`decision ${id} is claimed by ${di.claim.by} until ${new Date(di.claim.at + (di.claim.ttlMs ?? CLAIM_TTL_MS)).toISOString()}`, 'decision-held-by-other', { holder: di.claim.by });
    if (di.claimExpired) m.supEvent({ entityType: 'sup-decision', entityId: id, kind: 'sup-decision-claim-expired', payload: { claim: di.claim }, at: now });
    m.setSupDecision(id, { status: 'claimed', by: String(by) });
    m.update('sup_decision_items', { claim_ttl_ms: CLAIM_TTL_MS }, { di_id: id });
    return effective(supDiOf(supRow(m, id)), now);
  });
}, { env, now });
const resolveSupervisorDecision = (id, { by, verb, decisionId = null, note = null, env = process.env, now = Date.now() } = {}) => withSup((m) => {
  if (!String(by ?? '').trim() || !String(verb ?? '').trim()) throw refuse('--resolve needs --by <actor> and --verb <what you ran>', 'decision-incomplete');
  return m.transaction(() => {
    const di = liveSupOrRefuse(m, id, now);
    if (heldByOther(di, by, now)) throw refuse(`decision ${id} is claimed by ${di.claim.by}`, 'decision-held-by-other', { holder: di.claim.by });
    if (!verbAllowed(di, verb)) throw refuse(`decision ${id} (${di.kind}) is resolved by one of: ${di.allowedVerbs.join(', ')}`, 'decision-verb-not-allowed', { allowedVerbs: di.allowedVerbs });
    m.setSupDecision(id, { status: 'resolved', by: String(by), verb: one(verb, 400), rationale: note ? one(note, 600) : null, result: decisionId ? { decisionId } : null });
    return supDiOf(supRow(m, id));
  });
}, { env, now });

const supervisorDoorbellText = (n) => `${RING_TAG} ${n} waiting: node scripts/machine/decisions.mjs supervisor --list`;
/** The sup_events kind of a delivered Supervisor ring ({text, count, open, decisions}); the newest one is the last ring. */
const SUP_RING_KIND = 'supervisor-ring';

/**
 * Ring the Supervisor seat (the scripts/supervisor/supervisor-watchdog.mjs wake path: wake-delivery.mjs wakeKernel over the seat's
 * terminal). Same rules as ringDoorbell; a chat-mode Supervisor has no seat terminal: `deferred` (seat-absent). Every
 * attempt is a deliveries row (doorbell, seat 'supervisor'); a delivered ring marks the open DIs delivered (MB-02).
 */
export async function ringSupervisor({ env = process.env, wake = null, now = Date.now(), minGapMs = RING_MIN_GAP_MS } = {}) {
  const home = await import('./home.mjs');
  if (typeof wake !== 'function') throw new Error('ringSupervisor: pass `wake` (scripts/kernel/wake-delivery.mjs wakeKernel); machine/ does not import the kernel');
  return withSup((m) => {
    const openIds = supervisorDecisions(m, { now }).filter((d) => d.status === 'open').map((d) => d.id);
    const open = openIds.length;
    const plan = planRing({ open, workflowId: home.SEAT_ID, last: home.newestEvent(m, SUP_RING_KIND), now, minGapMs, textOf: (n) => supervisorDoorbellText(n) });
    if (!plan.ring) return { action: plan.reason, delivered: false, open };
    const terminal = home.seatOf(m, now)?.value?.terminal ?? null;
    if (!terminal) return { action: 'deferred', delivered: false, open, wake: 'seat-absent' };
    const woke = wake({ db: home.terminalSignalDb(terminal), workflowId: home.SEAT_ID, text: plan.text });
    const delivered = woke?.delivered === true;
    const ev = home.supervisorEvent(m, { kind: 'supervisor-wake', now, payload: { tags: ['decide'], inbox: [], land: [], report: [], decisions: delivered ? openIds : [], text: plan.text, delivered, action: woke?.action ?? null } });
    m.recordDelivery({ messageKind: 'doorbell', messageRef: ev.eventId, seatId: home.SEAT_ID, terminalHandle: terminal, channel: 'orca-terminal',
      outcome: delivered ? 'delivered' : 'busy-deferred', detail: woke?.action ?? null });
    if (!delivered) return { action: 'deferred', delivered: false, open, text: plan.text, wake: woke?.action ?? null };
    m.transaction(() => {
      home.supervisorEvent(m, { kind: SUP_RING_KIND, now, payload: { text: plan.text, count: plan.count, open, decisions: openIds } });
      for (const id of openIds) m.markSupDecisionDelivered(id);
    });
    return { action: 'rung', delivered: true, open, text: plan.text, terminal };
  }, { env, now });
}

/* ------------------------------------------------------------ the escalation ladder */

/**
 * What escalateDue does to one Kernel DI now, pure: null, {step: 'remind'} (past dueAt, first time) or
 * {step: 'supervisor'} (past openedAt + 2 x (dueAt - openedAt), still the Kernel's).
 */
export function dueStep(di, now = Date.now()) {
  if (di.decider !== 'kernel' || di.status !== 'open' || di.kind === 'supervisor-ruling' || !Number.isFinite(di.dueAt)) return null;
  const span = Math.max(1, di.dueAt - (di.openedAt ?? di.dueAt));
  if (now >= di.dueAt + span) return { step: 'supervisor' };
  if (now >= di.dueAt && !(di.escalations > 0)) return { step: 'remind' };
  return null;
}

/**
 * The SLA ladder over every product ledger: {actions: [{repo, workflowId, id, step, applied, supervisorDi?}]}.
 * `apply: false` (shadow) only plans. `repos` defaults to config.yaml supervisor.repos.
 */
export async function escalateDue({ now = Date.now(), apply = false, repos = null, env = process.env } = {}) {
  const { openLedger, ledgerFileFor } = await import('../../engine/db/ledger.mjs');
  const fs = await import('node:fs');
  if (!repos) { const home = await import('./home.mjs'); repos = home.productRepos(); }
  const actions = [];
  for (const repo of repos) {
    const file = ledgerFileFor(repo);
    if (!fs.existsSync(file)) continue;
    const ledger = openLedger({ file });
    try {
      for (const di of listDecisions(ledger.db, { decider: 'kernel', now })) {
        const step = dueStep(di, now);
        if (!step) continue;
        const act = { repo, workflowId: di.workflowId, id: di.id, kind: di.kind, step: step.step, applied: false };
        actions.push(act);
        if (!apply) continue;
        if (step.step === 'remind') {
          escalateDecision(ledger, di.id, { to: 'kernel', by: 'reconciler/sla', reason: 'past dueAt', final: false, now });
        } else {
          escalateDecision(ledger, di.id, { to: 'supervisor', by: 'reconciler/sla', reason: 'past dueAt x2', final: true, now });
          const ledgerName = path.basename(repo);
          const sup = await openSupervisorDecision({ kind: di.kind === 'supervisor-ruling' ? 'cross-workflow' : di.kind, idempotencyKey: `escalated:${ledgerName}:${di.id}`,
            entity: di.entity, productWorkflowId: di.workflowId, productLedger: ledgerName, summary: `Kernel DI ${di.id} (${di.kind}) in ${di.workflowId} overdue x2: ${di.summary}`,
            evidence: [{ ref: `decision:${ledgerName}/${di.workflowId}/${di.id}` }, ...(di.evidence ?? []).slice(0, 10)], by: 'reconciler/sla',
            item: `di|${ledgerName}|${di.id}`, refs: [di.workflowId, di.id], severity: di.severity }, { env, now });
          act.supervisorDi = sup.di.id;
        }
        act.applied = true;
      }
    } finally { ledger.close(); }
  }
  return { ok: true, apply, actions };
}

/* ------------------------------------------------------------ CLI */

if (isMain(import.meta.url)) {
  const argv = process.argv.slice(2);
  const has = (n) => argv.includes(`--${n}`);
  const value = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] ?? null : null; };
  const json = has('json');
  const print = (out, line) => console.log(json ? JSON.stringify(out) : line);
  const main = async () => {
    const cmd = argv[0];
    if (cmd === 'ring') {
      if (!value('repo') || !value('workflow')) throw refuse('ring --repo <r> --workflow <wf>', 'usage');
      const r = await ringDoorbell({ repo: value('repo'), workflowId: value('workflow') });
      return print({ ok: true, ...r }, `${value('workflow')}: ${r.action} (${r.open} open)`);
    }
    if (cmd === 'escalate-due') {
      const r = await escalateDue({ apply: has('apply') });
      return print(r, r.actions.map((a) => `${a.workflowId} ${a.id} ${a.kind}: ${a.step}${a.applied ? ' (applied)' : ' (plan)'}${a.supervisorDi ? ` -> ${a.supervisorDi}` : ''}`).join('\n') || 'nothing due');
    }
    if (cmd === 'supervisor') {
      if (has('ring')) { const r = await ringSupervisor(); return print({ ok: true, ...r }, `supervisor: ${r.action} (${r.open} open)`); }
      if (value('claim')) { const d = await claimSupervisorDecision(value('claim'), { by: value('by') ?? 'supervisor' }); return print({ ok: true, decision: d }, `${d.id} claimed by ${d.claim.by}`); }
      if (value('resolve')) { const d = await resolveSupervisorDecision(value('resolve'), { by: value('by') ?? 'supervisor', verb: value('verb'), decisionId: value('decision'), note: value('note') }); return print({ ok: true, decision: d }, `${d.id} resolved: ${d.resolution.verb}`); }
      const list = await listSupervisorDecisions({ all: has('all') });
      return print({ ok: true, decisions: list }, list.map((d) => `${d.id} [${d.status}${d.severity === 'critical' ? ' CRITICAL' : ''}] ${d.kind} due ${new Date(d.dueAt).toISOString().slice(0, 16)}Z: ${d.summary}`).join('\n') || 'no open Supervisor decisions');
    }
    throw refuse('use: decisions.mjs ring | escalate-due [--apply] | supervisor [--list|--claim|--resolve|--ring]', 'usage');
  };
  main().catch((error) => { console.error(JSON.stringify({ ok: false, error: String(error?.message ?? error), code: error?.code ?? null })); process.exitCode = error?.code === 'usage' ? 2 : 1; });
}
