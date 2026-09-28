// kernel-authority.mjs — what the Kernel may do INSIDE its own workflow without escalating, and the api-enforced
// guardrails around it (owner 2026-09-28: "sao workflows không tự điều phối dc mà đợi supervisor", "kernel phải
// brainstorm dc, xử lý lỗi dc ... làm mọi thứ để workflows tiến", refined: ops draw the graph, the Kernel only makes
// LIGHT unit edits and dispatches the owning op for a heavy redesign). Shared by the api verbs graph-edit,
// dispatch-ready, decide, redesign, op-override and kernel-proposal (scripts/kernel/api-verbs/).
//
// Guardrails enforced here, never only in a prompt:
//   (a) progress counts only units that passed their gates (progress-rca.mjs unitsOf: a succeeded job)
//   (b) no verb weakens a gate (an override is additive; a note that says skip/disable/relax a check is refused), changes
//       the goal, edits owner rulings, or touches another workflow's open paths or leases (foreignOverlap)
//   (c) credentials and real money stay deferred (every new unit goes through `api enqueue`, whose autopilot refusal
//       holds; no verb dispatches a provision.ask)
//   (d) every mutating verb names an OPEN decision of the Kernel's decision log (hypothesis -> action -> metric ->
//       keep/revert); a reverted action key is refused as a new decision, a failing unit shape is never re-dispatched
//   (e) every graph edit is an event with its inverse; `graph-edit --undo <edit>` reverts it
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../engine/yaml.mjs';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { parseJsonOr } from '../lib/json.mjs';
import { clipLine } from '../lib/clip.mjs';
import { leaseCanonicalizer } from './lease-canon.mjs';
import { familyGuardOf, familyViolations } from './write-families.mjs';
import { openLogs, appendLog } from './typed-logs.mjs';
import { OPEN_JOB, causesOf, decisionsOf, isShapeCause, progressSettings, reportsOf, unitsOf, opJobsOf } from './progress-rca.mjs';
import { kernelDecisionItems } from '../reconcile/job-settle.mjs';
import { CHILD_ENV, refuseDecisionsFirst } from '../reconciler/decisions.mjs';

export const API_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'api.mjs');
export const OVERRIDE_KIND = 'kernel-op-override';
export const PROPOSAL_KIND = 'kernel-proposal';
export const PUSH_KIND = 'kernel-dispatch-push';
const parse = (s, d = {}) => parseJsonOr(s, d) ?? d;
const one = (s, n = 300) => clipLine(String(s ?? '').replace(/\s+/g, ' ').trim(), n);
export const refuse = (message, code, extra = {}) => Object.assign(new Error(message), { code, ...extra });
export const csv = (v) => [...new Set(String(v ?? '').split(',').map((s) => s.trim()).filter(Boolean))];
export const newId = (prefix) => `${prefix}-${crypto.randomBytes(5).toString('hex')}`;
const slash = (p) => String(p ?? '').replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '');

/* ------------------------------------------------------------ the api, as a subprocess */

/** Run one api verb against the same repo: {ok, status, json, out, err}. The caller's env (Kernel identity) passes. */
export function apiRun(argv, { repo, timeoutMs = 240_000, env = process.env } = {}) {
  // CHILD_ENV: a child of a resolving verb (graph-edit, redesign) passes the decisions-first guard (scripts/reconciler/decisions.mjs).
  const r = spawnSync(process.execPath, [API_FILE, ...argv, '--repo', repo, '--json'], { cwd: skillRoot, encoding: 'utf8', windowsHide: true, timeout: timeoutMs, env: { ...env, [CHILD_ENV]: '1' }, maxBuffer: 64 * 1024 * 1024 });
  let json = null;
  const text = String(r.stdout ?? '').trim();
  try { json = JSON.parse(text); } catch { const i = text.indexOf('{'); if (i >= 0) { try { json = JSON.parse(text.slice(i)); } catch { json = null; } } }
  if (!json) { try { json = JSON.parse(String(r.stderr ?? '').trim().split(/\r?\n/).pop()); } catch { json = null; } }
  return { ok: r.status === 0 && json?.ok !== false, status: r.status, json, out: text.slice(0, 4000), err: String(r.stderr ?? '').slice(0, 2000) };
}

/* ------------------------------------------------------------ jobs */

export const jobRow = (db, jobId) => {
  const r = db.prepare('SELECT * FROM jobs WHERE job_id=?').get(jobId);
  return r ? { ...r, payload: parse(r.payload_json), result: parse(r.result_json) } : null;
};
export const dispatchedEver = (db, jobId) => Boolean(db.prepare("SELECT 1 FROM events WHERE entity_type='job' AND entity_id=? AND kind IN ('op-dispatched','dispatch-attested','worker-attested') LIMIT 1").get(jobId));

/** A queued, never-dispatched op job of this workflow, or a refusal. */
export function editableJob(db, workflowId, jobId) {
  const j = jobRow(db, jobId);
  if (!j || j.workflow_id !== workflowId || j.kind !== 'op') throw refuse(`${jobId} is not an op job of ${workflowId}`, 'job-foreign');
  if (j.status !== 'queued' || dispatchedEver(db, jobId)) throw refuse(`${jobId} is ${j.status}${j.status === 'queued' ? ' but was dispatched before' : ''}: only a queued, never-dispatched unit is edited (a running unit is never interrupted)`, 'job-not-editable');
  return j;
}

export function setPayload(ledger, job, payload, now = Date.now()) {
  ledger.db.prepare('UPDATE jobs SET payload_json=?, updated_at=? WHERE job_id=? AND status=?').run(JSON.stringify(payload), now, job.job_id, 'queued');
}

export function dropJob(ledger, job, { reason, editId, now = Date.now() }) {
  ledger.db.prepare("UPDATE jobs SET status='cancelled', result_json=?, updated_at=? WHERE job_id=? AND status='queued'")
    .run(JSON.stringify({ verdict: 'dropped', reason, by: editId, at: now }), now, job.job_id);
  ledger.appendEvent({ workflowId: job.workflow_id, entityType: 'job', entityId: job.job_id, kind: 'job-dropped', payload: { reason, by: editId, kernelEdit: true } });
}

/** Undo a drop this edit made: back to queued when nothing replaced it since. */
export function restoreJob(ledger, jobId, { editId, now = Date.now() }) {
  const j = jobRow(ledger.db, jobId);
  if (!j || j.status !== 'cancelled' || j.result?.by !== editId) return false;
  ledger.db.prepare("UPDATE jobs SET status='queued', result_json=NULL, updated_at=? WHERE job_id=? AND status='cancelled'").run(now, jobId);
  ledger.appendEvent({ workflowId: j.workflow_id, entityType: 'job', entityId: jobId, kind: 'job-restored', payload: { undo: editId } });
  return true;
}

/* ------------------------------------------------------------ paths and leases */

const overlaps = (a, b) => { const x = a.toLowerCase(), y = b.toLowerCase(); return x === y || x.startsWith(`${y}/`) || y.startsWith(`${x}/`); };

/**
 * Paths of `paths` that overlap an OPEN job or a held lease of ANOTHER workflow in this ledger: [{path, workflowId,
 * jobId}]. Compared in the lease spelling (lease-canon.mjs), case-insensitively. (guardrail b)
 */
export function foreignOverlap(db, { repo, workflowId, op, payload = {}, paths }) {
  const canon = leaseCanonicalizer({ repo, db });
  const mine = paths.map((p) => ({ p, c: slash(canon.canonical(p, { op, payload })) }));
  const hits = [];
  const others = db.prepare(`SELECT job_id, workflow_id, op_id, payload_json FROM jobs WHERE workflow_id<>? AND kind='op' AND status IN (${OPEN_JOB.map(() => '?').join(',')})`).all(workflowId, ...OPEN_JOB);
  for (const o of others) {
    const pl = parse(o.payload_json);
    for (const theirs of pl.owned_paths ?? []) {
      const c = slash(canon.canonical(theirs, { op: o.op_id, payload: pl }));
      for (const m of mine) if (overlaps(m.c, c)) hits.push({ path: m.p, workflowId: o.workflow_id, jobId: o.job_id });
    }
  }
  for (const l of db.prepare("SELECT resource_key, job_id, workflow_id FROM leases WHERE workflow_id<>? AND resource_key LIKE 'path:%'").all(workflowId)) {
    const c = slash(canon.canonicalOf(l.resource_key.replace(/^path:/, ''), { job_id: l.job_id }));
    for (const m of mine) if (overlaps(m.c, c)) hits.push({ path: m.p, workflowId: l.workflow_id, jobId: l.job_id });
  }
  return hits;
}

/**
 * The widen guard: every added path stays in the unit's repository (the same repository qualifier as its current
 * paths), is no kernel custody and no `..` escape, lies in the op's write families, and overlaps no other workflow.
 */
export function checkPaths(db, { repo, workflowId, op, payload = {}, current = [], add = [] }) {
  if (!add.length) throw refuse('no path given', 'paths-empty');
  const heads = new Set(current.map((p) => slash(p).split('/')[0]));
  for (const p of add) {
    const s = slash(p);
    if (!s || s.split('/').includes('..') || path.isAbsolute(p)) throw refuse(`${p}: an added path is repository-relative, never absolute or ../ (it stays in the workflow's source roots)`, 'path-outside-roots');
    if (/(^|\/)\.starciwork\/(kernel-evidence|kernel-strays|kernel-approvals)(\/|$)/.test(s)) throw refuse(`${p} is kernel custody`, 'path-kernel-custody');
    if (/(^|\/)\.claude(\/|$)|modules\/kernel\/owner-rulings\.yaml$/.test(s)) throw refuse(`${p} is the shared runtime (.claude): a tier-2 kernel-proposal, never a unit's owned path`, 'path-shared-runtime');
    if (current.length && heads.size === 1 && !heads.has(s.split('/')[0]) && !/^(apps|packages|src|libs|e2e)$/.test(s.split('/')[0])) throw refuse(`${p} leaves the unit's repository ${[...heads][0]}`, 'path-outside-repository');
  }
  const briefFile = path.join(skillRoot, 'modules', 'ops', 'ops', `${op}.yaml`);
  try {
    const guard = familyGuardOf(parseYaml(fs.readFileSync(briefFile, 'utf8')));
    const wrong = familyViolations(guard, add);
    if (wrong.length) throw refuse(`outside ${op}'s writes: ${wrong.map((v) => `${v.path} (${v.why})`).join('; ')}`, 'owned-paths-outside-writes');
  } catch (e) { if (e.code) throw e; }
  const qualified = add.map((p) => (heads.size === 1 && !slash(p).startsWith(`${[...heads][0]}/`) && /^(apps|packages|src|libs|e2e)\//.test(slash(p)) ? `${[...heads][0]}/${slash(p)}` : slash(p)));
  const hits = foreignOverlap(db, { repo, workflowId, op, payload, paths: qualified });
  if (hits.length) throw refuse(`another workflow holds ${hits.slice(0, 4).map((h) => `${h.path} (${h.workflowId} ${h.jobId})`).join(', ')}: never take its paths - message it (api notify) or wait`, 'path-held-by-other-workflow', { hits });
  return qualified;
}

/* ------------------------------------------------------------ shapes (never the same failing shape) */

/** The shape of one unit attempt: op, sorted owned paths, params, per-job override, pinned model. */
export const shapeOf = (op, payload = {}) => crypto.createHash('sha1').update(JSON.stringify([op,
  [...(payload.owned_paths ?? [])].map(slash).sort(), payload.params ?? {}, payload.kernelOverride ?? {}, payload.kernelModel ?? null])).digest('hex').slice(0, 12);

/** The shapes this unit already failed with for a shape-related cause (a dead worker is no shape verdict). */
export function failedShapesOf(db, workflowId, job) {
  const jobs = opJobsOf(db, workflowId);
  const anchor = job.job_id === '__new__' ? null : job.job_id;
  const unit = unitsOf(jobs).find((u) => u.jobs.some((j) => j.job_id === (anchor ?? job.payload?.retry?.retryOf ?? job.payload?.kernelEdit?.unitOf)) || (!anchor && job.payload?.cut && u.cut?.id === job.payload.cut.id && u.cut?.ordinal === job.payload.cut.ordinal && u.op === job.op_id));
  if (!unit) return new Map();
  const reports = reportsOf(db, workflowId);
  const out = new Map();
  for (const j of unit.jobs) {
    if (j.status !== 'failed' || j.job_id === job.job_id) continue;
    const causes = causesOf({ status: j.status, result: j.result, report: reports.get(`${j.op_id}|${j.attempt}`) ?? null });
    if (causes.includes('partial-commit')) continue; // the base moved: a continuation of the same shape is new work
    if (causes.some(isShapeCause)) out.set(shapeOf(j.op_id, j.payload), { jobId: j.job_id, causes });
  }
  return out;
}

/* ------------------------------------------------------------ the decision log (guardrail d) */

export function requireDecision(db, workflowId, id) {
  if (!id) throw refuse('this edit needs --decision <id>: log it first (api decide --workflow <wf> --hypothesis <why> --action-key <key from api status rca.actions> --metric <what you will measure>)', 'decision-required');
  const d = decisionsOf(db, workflowId).find((x) => x.id === id);
  if (!d) throw refuse(`decision ${id} is not in ${workflowId}'s decision log`, 'decision-unknown');
  if (d.status !== 'open') throw refuse(`decision ${id} is closed (${d.status}); open a new one`, 'decision-closed');
  return d;
}

/* ------------------------------------------------------------ overrides (local op variants) */

const WEAKEN = /\b(skip|disable|ignore|bypass|weaken|relax|suppress|turn off|comment out|eslint-disable|no-verify)\b[^.]{0,60}\b(check|gate|test|lint|scan|validator|canon|rule|typecheck|tsc|spec|proof)s?\b/i;
const DIFFICULTIES = ['easy', 'medium', 'hard', 'insane'];

/** Validate an override: additive keys only (guardrail b). Returns the clean object or throws. */
export function validateOverride(o) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) throw refuse('--set must be a JSON object', 'override-invalid');
  const out = {};
  for (const [k, v] of Object.entries(o)) {
    if (k === 'notes') {
      const notes = (Array.isArray(v) ? v : [v]).map((n) => String(n ?? '').trim()).filter(Boolean);
      if (notes.length > 8 || notes.some((n) => n.length > 600)) throw refuse('notes: at most 8 notes of 600 characters', 'override-invalid');
      const bad = notes.find((n) => WEAKEN.test(n));
      if (bad) throw refuse(`a note may add guidance, never weaken a gate: "${one(bad, 120)}"`, 'override-weakens-gate');
      out.notes = notes;
    } else if (k === 'commandTimeoutMs') {
      if (!Number.isInteger(v) || v < 30_000 || v > 3_600_000) throw refuse('commandTimeoutMs: an integer 30000..3600000', 'override-invalid');
      out.commandTimeoutMs = v;
    } else if (k === 'difficulty') {
      if (!DIFFICULTIES.includes(v)) throw refuse(`difficulty: one of ${DIFFICULTIES.join('|')}`, 'override-invalid');
      out.difficulty = v;
    } else if (k === 'model') {
      if (typeof v !== 'string' || !/^[a-z0-9-]+$/.test(v)) throw refuse('model: a pool target such as claude-agent', 'override-invalid');
      out.model = v;
    } else if (k === 'effort') {
      if (!['low', 'medium', 'high'].includes(v)) throw refuse('effort: low|medium|high', 'override-invalid');
      out.effort = v;
    } else throw refuse(`${k}: an override may set only notes, commandTimeoutMs, difficulty, model, effort - never checks, writes, steps or gates`, 'override-key-refused');
  }
  return out;
}

/** The workflow's current local override of one op, or null. */
export function opOverrideOf(db, workflowId, op) {
  const r = db.prepare('SELECT payload_json FROM events WHERE workflow_id=? AND kind=? AND entity_id=? ORDER BY seq DESC LIMIT 1').get(workflowId, OVERRIDE_KIND, op);
  const p = r ? parse(r.payload_json) : null;
  return p && !p.cleared ? p.override ?? null : null;
}

/**
 * What api dispatch puts in packet.context.kernel_override for one job: the workflow's op override merged with the
 * job's own (graph-edit params, redesign). Null when there is none. Never throws.
 */
export function kernelOverrideFor(db, workflowId, op, payload = {}) {
  try {
    const wfo = opOverrideOf(db, workflowId, op) ?? {};
    const own = payload.kernelOverride ?? {};
    const notes = [...(wfo.notes ?? []), ...(own.notes ?? [])];
    const merged = { ...wfo, ...own, ...(notes.length ? { notes } : {}) };
    if (payload.redesign) merged.redesign = payload.redesign;
    return Object.keys(merged).length ? merged : null;
  } catch { return null; }
}

/* ------------------------------------------------------------ records */

/** One kernel event plus its typed log row (kind decision). Call inside no transaction; opens its own. */
export function recordKernel(ledger, { workflowId, entityType, entityId, kind, payload, repo, msg, markdown, refs = [], level = 'info' }) {
  ledger.transaction(() => ledger.appendEvent({ workflowId, entityType, entityId, kind, payload }));
  let logs = null;
  try {
    logs = openLogs(repo);
    appendLog(logs, { workflowId, actor: 'kernel', kind: 'decision', level, msg: one(msg, 300), data: { markdown: String(markdown ?? msg).slice(0, 4000), event: kind, id: entityId }, refs }, { clip: true });
  } catch { /* the event stands without its log row */ } finally { try { logs?.close(); } catch { /* closed */ } }
}

export const settingsN = () => progressSettings().maxUnitsPerEdit;

/**
 * Refuse a route/dispatch while >= settleBacklog.max filed reports wait unconsumed (an api guard, not a prompt rule).
 * SETTLE-FIRST, the Kernel's half (owner 2026-09-28; narrowed by owner ruling settle-runtime-service): the runtime
 * settles green reports itself (scripts/reconcile/job-settle.mjs), so the backlog counts only the reported jobs of this
 * workflow older than allocation.progress.settleBacklog.ageMs that wait on the Kernel's decision - non-green outcomes
 * and done reports the settler handed over - consumed or not (job-settle.mjs kernelDecisionItems).
 */
export function refuseSettleBacklog(db, workflowId, verb, { now = Date.now() } = {}) {
  // DECISIONS FIRST (coordinator 2026-09-28, fe-canon): an open, unclaimed Kernel Decision Item older than 2 min refuses
  // route/dispatch too, with the item's exact commands (scripts/reconciler/decisions.mjs refuseDecisionsFirst).
  refuseDecisionsFirst(db, workflowId, verb, { now });
  const s = progressSettings().settleBacklog;
  const backlog = kernelDecisionItems(db, workflowId, { now, ageMs: s.ageMs });
  if (backlog.length >= s.max) {
    throw Object.assign(new Error(`settle-backlog: ${backlog.length} reported job(s) of ${workflowId} wait on your settle decision for more than ${Math.round(s.ageMs / 60_000)}m - DECIDE THEM FIRST (driver-loop.yaml progress.settleFirst; api status settleDecisions): api settle --job <id> --verdict <fail|blocked from its report>, or re-run its checks (api check) and settle pass, for ${backlog.slice(0, 12).map((b) => `${b.jobId ?? `${b.op}#${b.attempt}`} (${b.outcome}${b.reason ? `, ${b.reason}` : ''}, ${b.ageMin}m)`).join(', ')}; then ${verb} again`), { code: 'settle-backlog', backlog });
  }
}
