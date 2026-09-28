#!/usr/bin/env node
// decisions.mjs — Decision Items (DI) and the doorbell (reconciler DESIGN §10.3-10.4, lane rc-decisions).
//
// A DI is the durable message a decider acts on; the doorbell is only a reminder that DIs wait. Nobody types a
// notice into a Kernel terminal any more: a controller, the SLA layer or the Supervisor OPENS a DI and rings.
//
//   store     rows in the `inbox` table of a ledger, kind 'decision', key = idempotencyKey, payload_json = the DI
//             (schema starci/decision-item@1), status = the DI status. Product ledger: the workflow's own rows,
//             events decision-opened|claimed|resolved|escalated|expired|superseded. Supervisor ledger: the same
//             rows on workflow wf-supervisor, events supervisor-decision-*.
//   verb      `api decisions` (scripts/kernel/api-verbs/decisions.mjs) is the only writer of product DIs; this
//             module's openDecision(repo, di) runs it as a child; the functions taking a `ledger` are its core.
//   doorbell  ringDoorbell: one fixed line through wake-delivery.mjs, ONLY when the seat reads turn-idle; a busy
//             seat is `deferred` (the DI is not lost), at most one ring per RING_MIN_GAP_MS per seat, never the
//             same text twice in a row.
//   ladder    escalateDue: a Kernel DI past dueAt is escalated once (a reminder, still the Kernel's); past dueAt x2
//             it is marked escalated and becomes a Supervisor DI in the supervisor ledger.
//
//   node scripts/reconciler/decisions.mjs ring --repo <r> --workflow <wf> [--json]
//   node scripts/reconciler/decisions.mjs escalate-due [--apply] [--json]          (default: plan only, shadow)
//   node scripts/reconciler/decisions.mjs supervisor --list [--all] [--json]
//   node scripts/reconciler/decisions.mjs supervisor --claim <id> --by <actor> | --resolve <id> --by <actor> --verb <text> [--decision <id>]
//   node scripts/reconciler/decisions.mjs supervisor --ring [--json]
import crypto from 'node:crypto';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseJsonOr } from '../lib/json.mjs';

const selfFile = fileURLToPath(import.meta.url);
const SKILL_ROOT = path.resolve(path.dirname(selfFile), '..', '..');
const API_FILE = path.join(SKILL_ROOT, 'scripts', 'kernel', 'api.mjs');

export const DI_SCHEMA = 'starci/decision-item@1';
export const DI_ROW_KIND = 'decision';
export const DI_KINDS = Object.freeze(['settle-nongreen', 'worker-question', 'checks-needed', 'graph-edit-needed', 'progress-stall',
  'stale-gate', 'stale-wait', 'unread-peer', 'orphaned-frontier', 'rev-ack', 'supervisor-ruling', 'cross-workflow', 'deadlock',
  'runtime-defect', 'kernel-proposal', 'seat-unrecoverable', 'service-quarantined', 'quota-exhausted', 'experiment-revert',
  'push-refused', 'retry-decision', 'dispatch-refused', 'cap-starved', 'hypothesis']);
export const DECIDERS = Object.freeze(['kernel', 'supervisor', 'owner']);
/**
 * Kinds the Supervisor decides unless the opener names another decider (DESIGN §6.4 escalation column: resource,
 * host, fleet and learning controllers open these for the Supervisor). `cap-starved` is resource policy (lane
 * rc-gc-resource's Resource controller), next to `quota-exhausted`.
 */
export const SUPERVISOR_KINDS = Object.freeze(['cap-starved', 'quota-exhausted', 'runtime-defect', 'cross-workflow', 'deadlock',
  'seat-unrecoverable', 'service-quarantined', 'experiment-revert', 'hypothesis', 'push-refused', 'kernel-proposal']);
export const defaultDeciderOf = (kind) => (SUPERVISOR_KINDS.includes(kind) ? 'supervisor' : 'kernel');
/** Kinds the Supervisor may claim from a Kernel without an escalation (DESIGN §11.3 rule 1). */
export const CROSS_WORKFLOW_KINDS = Object.freeze(['cross-workflow', 'deadlock']);
export const LIVE = Object.freeze(['open', 'claimed', 'escalated']);
export const CLAIM_TTL_MS = 15 * 60_000;
export const DEFAULT_DUE_MS = Object.freeze({ kernel: 30 * 60_000, supervisor: 60 * 60_000, owner: 24 * 3_600_000 });
export const RING_MIN_GAP_MS = 2 * 60_000;
export const RING_TAG = '[decide]';
const PASS_THROUGH = ['productLedger', 'productWorkflowId', 'code', 'escalatedFrom'];
export const SUPERVISOR_WF = 'wf-supervisor';

const one = (s, n = 300) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
export const refuse = (message, code, extra = {}) => Object.assign(new Error(message), { code, ...extra });
export const diIdOf = (workflowId, key) => `di-${crypto.createHash('sha256').update(`${workflowId}\0${key}`).digest('hex').slice(0, 8)}`;
const isSupervisorActor = (by) => /^supervisor\b/i.test(String(by ?? ''));

/* ------------------------------------------------------------ the store (any ledger: {db, appendEvent, transaction}) */

const rowToDi = (r) => {
  const p = parseJsonOr(r.payload_json, {}) ?? {};
  return { ...p, status: r.status, inboxId: r.inbox_id, key: r.key };
};

/** The DI as a decider sees it now: a claim past its TTL reads open again (claimExpired). Pure. */
export function effective(di, now = Date.now()) {
  if (di?.status === 'claimed' && di.claim && di.claim.at + (di.claim.ttlMs ?? CLAIM_TTL_MS) <= now) return { ...di, status: 'open', claimExpired: true };
  return di;
}

const byUrgency = (a, b) => (b.severity === 'critical') - (a.severity === 'critical') || (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity) || String(a.id).localeCompare(String(b.id));

/** DIs of one workflow (live ones unless `all`), critical first, then by dueAt. */
export function listDecisions(db, { workflowId, all = false, decider = null, now = Date.now() } = {}) {
  const rows = workflowId
    ? db.prepare('SELECT * FROM inbox WHERE workflow_id=? AND kind=? ORDER BY inbox_id').all(workflowId, DI_ROW_KIND)
    : db.prepare('SELECT * FROM inbox WHERE kind=? ORDER BY inbox_id').all(DI_ROW_KIND);
  return rows.map(rowToDi).map((d) => effective(d, now))
    .filter((d) => (all || LIVE.includes(d.status)) && (!decider || d.decider === decider)).sort(byUrgency);
}

export function getDecision(db, id, { now = Date.now() } = {}) {
  const r = db.prepare("SELECT * FROM inbox WHERE kind=? AND json_extract(payload_json,'$.id')=? ORDER BY inbox_id DESC LIMIT 1").get(DI_ROW_KIND, id);
  return r ? effective(rowToDi(r), now) : null;
}

const write = (ledger, di, now) => {
  const { inboxId, key: _k, claimExpired: _c, ...payload } = di;
  ledger.db.prepare('UPDATE inbox SET status=?, payload_json=?, applied_at=? WHERE inbox_id=?')
    .run(payload.status, JSON.stringify(payload), ['resolved', 'superseded', 'expired'].includes(payload.status) ? now : null, inboxId);
};
const event = (ledger, prefix, di, verb, payload, now) => ledger.appendEvent({ workflowId: di.workflowId, entityType: 'decision-item', entityId: di.id,
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
  const by = one(spec.by ?? spec.openedBy ?? 'unknown', 120);
  let out = null;
  ledger.transaction(() => {
    const prior = ledger.db.prepare('SELECT * FROM inbox WHERE workflow_id=? AND kind=? AND key=? ORDER BY inbox_id DESC LIMIT 1').get(workflowId, DI_ROW_KIND, key);
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
    if (kind === 'supervisor-ruling') {
      for (const r of ledger.db.prepare('SELECT * FROM inbox WHERE workflow_id=? AND kind=? AND status IN (\'open\',\'claimed\',\'escalated\') ORDER BY inbox_id').all(workflowId, DI_ROW_KIND)) {
        const old = rowToDi(r);
        if (old.decider !== 'kernel' || old.kind === 'supervisor-ruling' || old.entity?.type !== entity.type || old.entity?.id !== entity.id) continue;
        const next = { ...old, status: 'superseded', supersededBy: di.id, resolution: { by, verb: 'superseded', decisionId: null, at: now } };
        write(ledger, next, now);
        event(ledger, prefix, next, 'superseded', { by: di.id }, now);
        superseded.push(old.id);
      }
    }
    ledger.db.prepare("INSERT INTO inbox(workflow_id,kind,key,payload_json,status,created_at) VALUES(?,?,?,?,'open',?)").run(workflowId, DI_ROW_KIND, key, JSON.stringify(di), now);
    event(ledger, prefix, di, 'opened', { key, summary, by, dueAt: di.dueAt, severity: di.severity, ...(superseded.length ? { supersedes: superseded } : {}) }, now);
    out = { di, created: true, existing: false, superseded };
  });
  return out;
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
export const verbAllowed = (di, verb) => {
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

/* ------------------------------------------------------------ the verb as a child (controllers, notify.mjs) */

/** Run `api decisions <argv>` against `repo`: {ok, json, status, err}. `env.STARCI_ACTOR` names the opener. */
export function runDecisionsVerb(repo, argv, { env = process.env, timeoutMs = 60_000 } = {}) {
  const r = spawnSync(process.execPath, [API_FILE, 'decisions', '--repo', repo, ...argv, '--json'], { cwd: SKILL_ROOT, encoding: 'utf8', windowsHide: true, timeout: timeoutMs, env });
  let json = null;
  for (const text of [r.stdout, String(r.stderr ?? '').trim().split(/\r?\n/).pop()]) { try { json = JSON.parse(String(text ?? '').trim()); break; } catch { /* next */ } }
  return { ok: r.status === 0 && json?.ok !== false, status: r.status, json, err: String(r.stderr ?? '').slice(0, 1000) };
}

/**
 * Open a DI (lane rc-engine ctx.openDecision). `di` uses the schema field names, as the controllers build it. A DI
 * whose `ledger` is 'supervisor' goes to the supervisor ledger (openSupervisorDecision; `repo` unused); any other goes
 * to the product ledger at `repo` through `api decisions --open` (a child). Returns {ok, json: {decision, ...}}.
 */
export function openDecision(repo, di, { env = process.env, run = runDecisionsVerb, now = Date.now() } = {}) {
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

export const doorbellText = (n, workflowId) => `${RING_TAG} ${n} việc chờ: api decisions --workflow ${workflowId}`;
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
 * `ledger` (an open write handle) or `repo`; `wake` replaces wake-delivery.mjs wakeKernel in specs.
 */
export async function ringDoorbell(first = {}, second = null) {
  // The engine form (lane rc-sla-workflow controllers/workflow.mjs): ringDoorbell(ctx, {ledgerId, workflowId, decider}).
  if (second) {
    const ctx = first ?? {};
    if (ctx.mode && ctx.mode !== 'active') return { action: 'shadow', delivered: false };
    if (second.decider === 'supervisor') return ringSupervisor({ env: ctx.env ?? process.env, now: ctx.now?.() ?? Date.now() });
    const repo = (ctx.ledgers ?? []).find((l) => l.ledgerId === second.ledgerId)?.repo;
    if (!repo) return { action: 'ledger-unknown', delivered: false };
    return ringDoorbell({ repo, workflowId: second.workflowId, now: ctx.now?.() ?? Date.now() });
  }
  const { repo = null, workflowId, ledger = null, wake = null, now = Date.now(), minGapMs = RING_MIN_GAP_MS } = first;
  const wakeFn = wake ?? (await import('../kernel/wake-delivery.mjs')).wakeKernel;
  if (ledger) return ringDoorbellWith({ ledger, workflowId, wake: wakeFn, now, minGapMs });
  const { openLedger, ledgerFileFor } = await import('../../engine/ledger-db.mjs');
  const own = openLedger({ file: ledgerFileFor(path.resolve(repo)) });
  try { return ringDoorbellWith({ ledger: own, workflowId, wake: wakeFn, now, minGapMs }); } finally { own.close(); }
}

/** ringDoorbell's synchronous core over an open write handle; `wake` is wake-delivery.mjs wakeKernel (or a spec stub). */
export function ringDoorbellWith({ ledger, workflowId, wake, now = Date.now(), minGapMs = RING_MIN_GAP_MS }) {
  const open = listDecisions(ledger.db, { workflowId, decider: 'kernel', now }).filter((d) => d.status === 'open').length;
  const last = lastRingOf(ledger.db, RING_SCOPE, workflowId);
  const plan = planRing({ open, workflowId, last, now, minGapMs });
  if (!plan.ring) return { action: plan.reason, delivered: false, open, ...(plan.nextAt ? { nextAt: plan.nextAt } : {}) };
  const woke = wake({ db: ledger.db, workflowId, text: plan.text, pending: 'hold' });
  if (woke?.action !== 'kernel-woken' || woke.delivered !== true) return { action: 'deferred', delivered: false, open, text: plan.text, wake: woke?.action ?? null, state: woke?.state ?? null };
  saveRing(ledger, RING_SCOPE, workflowId, { at: now, text: plan.text, count: plan.count, open }, now);
  try { ledger.transaction(() => ledger.appendEvent({ workflowId, entityType: 'workflow', entityId: workflowId, kind: 'decision-doorbell', payload: { open, text: plan.text, terminal: woke.terminal ?? null }, createdAt: now })); } catch { /* the ring stands */ }
  return { action: 'rung', delivered: true, open, text: plan.text, terminal: woke.terminal ?? null };
}

/* ------------------------------------------------------------ the Supervisor's DIs (supervisor ledger) */

const SUP_PREFIX = 'supervisor-decision';
const withSup = async (fn, { env = process.env } = {}) => {
  const { openSupervisorLedger } = await import('../supervisor/home.mjs');
  const ledger = openSupervisorLedger({ env });
  try { return fn(ledger); } finally { ledger.close(); }
};

/** Open a Supervisor DI (decider supervisor, workflow wf-supervisor) in the supervisor ledger. */
export const openSupervisorDecision = (spec, { env = process.env, now = Date.now() } = {}) => withSup((ledger) =>
  openDecisionRow(ledger, { decider: 'supervisor', ...spec, productWorkflowId: spec.productWorkflowId ?? (spec.workflowId && spec.workflowId !== SUPERVISOR_WF ? spec.workflowId : null),
    productLedger: spec.productLedger ?? null, entity: spec.entity ?? { type: 'supervisor', id: 'main' }, workflowId: SUPERVISOR_WF }, { now, prefix: SUP_PREFIX, ledgerName: 'supervisor' }), { env });
export const listSupervisorDecisions = ({ env = process.env, all = false, now = Date.now() } = {}) => withSup((ledger) => listDecisions(ledger.db, { workflowId: SUPERVISOR_WF, all, now }), { env });
export const claimSupervisorDecision = (id, opts = {}) => withSup((ledger) => claimDecision(ledger, id, { ...opts, prefix: SUP_PREFIX }), opts);
export const resolveSupervisorDecision = (id, opts = {}) => withSup((ledger) => resolveDecision(ledger, id, { ...opts, prefix: SUP_PREFIX }), opts);

export const supervisorDoorbellText = (n) => `${RING_TAG} ${n} việc chờ: node scripts/reconciler/decisions.mjs supervisor --list`;

/**
 * Ring the Supervisor seat (the scripts/supervisor/watchdog.mjs wake path: stall-alert.mjs wakeKernel over the seat's
 * terminal). Same rules as ringDoorbell; a chat-mode Supervisor has no seat terminal: `deferred` (seat-absent).
 */
export async function ringSupervisor({ env = process.env, wake = null, now = Date.now(), minGapMs = RING_MIN_GAP_MS } = {}) {
  const home = await import('../supervisor/home.mjs');
  const ledger = home.openSupervisorLedger({ env });
  try {
    const open = listDecisions(ledger.db, { workflowId: SUPERVISOR_WF, now }).filter((d) => d.status === 'open').length;
    const last = lastRingOf(ledger.db, RING_SCOPE, SUPERVISOR_WF);
    const plan = planRing({ open, workflowId: SUPERVISOR_WF, last, now, minGapMs, textOf: (n) => supervisorDoorbellText(n) });
    if (!plan.ring) return { action: plan.reason, delivered: false, open };
    const terminal = home.seatOf(ledger.db, now)?.value?.terminal ?? null;
    if (!terminal) return { action: 'deferred', delivered: false, open, wake: 'seat-absent' };
    const wakeFn = wake ?? (await import('../supervisor/stall-alert.mjs')).wakeKernel;
    const woke = wakeFn({ db: home.terminalSignalDb(terminal), workflowId: SUPERVISOR_WF, text: plan.text });
    home.supervisorEvent(ledger, { kind: 'supervisor-wake', now, payload: { tags: ['decide'], inbox: [], land: [], report: [], text: plan.text, delivered: woke?.delivered === true, action: woke?.action ?? null } });
    if (woke?.delivered !== true) return { action: 'deferred', delivered: false, open, text: plan.text, wake: woke?.action ?? null };
    saveRing(ledger, RING_SCOPE, SUPERVISOR_WF, { at: now, text: plan.text, count: plan.count, open }, now);
    return { action: 'rung', delivered: true, open, text: plan.text, terminal };
  } finally { ledger.close(); }
}

/* ------------------------------------------------------------ the escalation ladder */

/**
 * What escalateDue does to one Kernel DI now, pure: null, {step: 'remind'} (past dueAt, first time) or
 * {step: 'supervisor'} (past openedAt + 2 x (dueAt - openedAt), still the Kernel's).
 */
export function dueStep(di, now = Date.now()) {
  if (di.decider !== 'kernel' || di.status !== 'open' || !Number.isFinite(di.dueAt)) return null;
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
  const { openLedger, ledgerFileFor } = await import('../../engine/ledger-db.mjs');
  const fs = await import('node:fs');
  if (!repos) { const home = await import('../supervisor/home.mjs'); repos = home.productRepos(); }
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

if (process.argv[1] && path.resolve(process.argv[1]) === selfFile) {
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
