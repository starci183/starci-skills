#!/usr/bin/env node
// sla.mjs — the reconciler's SLA / Invariant layer (DESIGN.md §8.8, Appendix A; lane rc-sla-workflow).
//
// Controllers record how long an entity has been in a state (machine.sqlite sla_episodes, DBTREE.sql B2 / G3, through
// ctx.clock / ctx.clear): one episode per stay, APPEND-ONLY — violated_at, reported_at and cleared_at (+ clear_reason)
// are each filled once, nothing is deleted or overwritten; the open clocks are the view v_sla_open. slaPass(ctx) is the
// engine's built-in pass (every modules/reconciler/sla.yaml passMs): an open episode past its sla_ms that is not yet
// violated becomes ONE `runtime-invariant-violated` Supervisor event (sup_events), one invariant_violations row and one
// typed machine_logs row; a violated episode whose entity left the state becomes ONE `runtime-invariant-cleared` event
// (and its invariant_violations rows are cleared). A `critical` code opens a Decision Item `runtime-defect` for the
// Supervisor (ctx.openDecision: a would-row in shadow). The layer only reports (concern sla.report): it runs in every
// mode, shadow included, and never acts on a product ledger.
//
// The catalogue (code -> {slaMs | slaKey (+plusMs), criticalKey, severity, owner, autoAction}) is
// modules/reconciler/sla.yaml; a slaKey is a dotted key under modules/models/runtimes.yaml `allocation:`, cited
// instead of copied.
//
// Internal entry: spawned by scripts/reconciler/engine.mjs; not invoked directly.
// Args: --once [--json]     one pass against machine.sqlite (writes violations)
//       --list [--json]     the open clocks and the catalogue, read only.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../engine/yaml.mjs';
import { openLedgerReader } from '../../engine/db/ledger.mjs';
import { machineFileFor, openMachine, readMachine, withMachine } from '../../engine/db/machine.mjs';
import { allocationSettings } from '../../engine/config.mjs';
import { readSupervisor, supervisorEvent } from '../machine/home.mjs';
import { SETTLED_JOB_LIST } from '../../engine/admission.mjs';
import { isMain } from '../lib/is-main.mjs';
import { dotGet } from '../lib/dot-path.mjs';
import { hasTable as sqliteHasTable } from '../lib/sqlite.mjs';
import { positiveNumber } from '../lib/number.mjs';

const selfFile = fileURLToPath(import.meta.url);
const skillRoot = path.resolve(path.dirname(selfFile), '..', '..');
export const SLA_FILE = path.join(skillRoot, 'modules', 'reconciler', 'sla.yaml');
export const VIOLATED_KIND = 'runtime-invariant-violated';
export const CLEARED_KIND = 'runtime-invariant-cleared';
const TYPED_EVENT = 'invariant.violated';
export const CRITICAL_SUFFIX = '/critical';
/** A violated episode cleared within this window still gets its runtime-invariant-cleared event (the pass looks no further back). */
const CLEAR_REPORT_WINDOW_MS = 7 * 86_400_000;

/* ------------------------------------------------------------------------------------------------ catalogue */

const dotted = dotGet;
const positiveOrZero = (v) => positiveNumber(v, null, { orZero: true });

/**
 * The catalogue with every number resolved: {passMs, codes: {CODE: {slaMs, criticalMs, severity, owner, autoAction,
 * slaKey?}}, states: {state: CODE}}. A slaKey the runtime profile does not declare leaves slaMs null (the clock's
 * own sla_ms still decides). Never throws: an unreadable file is an empty catalogue.
 */
export function slaCatalog({ file = SLA_FILE, allocation = null } = {}) {
  let doc = {};
  try { doc = parseYaml(fs.readFileSync(file, 'utf8')) ?? {}; } catch { doc = {}; }
  let alloc = allocation;
  if (!alloc) { try { alloc = allocationSettings(); } catch { alloc = {}; } }
  const codes = {};
  for (const [code, raw] of Object.entries(doc.codes ?? {})) {
    const c = raw ?? {};
    const base = c.slaKey ? positiveOrZero(dotted(alloc, c.slaKey)) : positiveOrZero(c.slaMs);
    codes[code] = {
      code, severity: c.severity === 'critical' ? 'critical' : 'warn', owner: c.owner ?? null, autoAction: c.autoAction ?? null,
      slaMs: base == null ? null : base + (positiveOrZero(c.plusMs) ?? 0),
      criticalMs: c.criticalKey ? positiveOrZero(dotted(alloc, c.criticalKey)) : positiveOrZero(c.criticalMs),
      ...(c.slaKey ? { slaKey: c.slaKey } : {}), ...(c.criticalKey ? { criticalKey: c.criticalKey } : {}),
    };
  }
  return { passMs: positiveOrZero(doc.passMs) ?? 30_000, codes, states: { ...doc.states } };
}

/** {code, severity, spec} of one clock state: `CODE`, `CODE/critical`, a mapped state, or the state itself (warn). Pure. */
export function codeOf(state, catalog = slaCatalog()) {
  const s = String(state ?? '');
  const critical = s.endsWith(CRITICAL_SUFFIX);
  const bare = critical ? s.slice(0, -CRITICAL_SUFFIX.length) : s;
  const code = catalog.codes[bare] ? bare : catalog.states?.[bare] ?? bare;
  const spec = catalog.codes[code] ?? null;
  return { code, severity: critical ? 'critical' : spec?.severity ?? 'warn', spec, critical };
}

/** An entity string -> {type, id, ledger, workflowId}: `workflow:<ledger>:<wf>`, `stuck:<ledger>:<wf>:<kind>:<id>`, `<type>:<rest>`. Pure. */
export function entityOf(entity, ledgerId = null) {
  const parts = String(entity ?? '').split(':');
  const type = parts[0] || 'unknown';
  if (type === 'workflow' && parts.length >= 3) return { type, id: parts.slice(2).join(':'), ledger: parts[1] || ledgerId, workflowId: parts.slice(2).join(':') };
  if (type === 'stuck' && parts.length >= 4) return { type, id: parts.slice(3).join(':'), ledger: parts[1] || ledgerId, workflowId: parts[2] };
  const rest = parts.slice(1).join(':');
  const wf = /\bwf-[a-z0-9][a-z0-9-]*[a-z0-9]\b/i.exec(rest)?.[0] ?? null;
  return { type, id: rest || String(entity ?? ''), ledger: ledgerId, workflowId: wf };
}

const dedupeKeyOf = (code, entity, critical = false) => `${code}|${entity}${critical ? '|critical' : ''}`;

/** The §8.8 violation event of one clock row. Pure. */
function violationEvent(row, { catalog = slaCatalog(), now = Date.now() } = {}) {
  const { code, severity, spec, critical } = codeOf(row.state, catalog);
  const entity = entityOf(row.entity, row.ledger_id ?? null);
  return {
    kind: VIOLATED_KIND, code, severity,
    entity: { type: entity.type, id: entity.id, ledger: entity.ledger ?? row.ledger_id ?? null, workflowId: entity.workflowId ?? null },
    state: row.state, enteredAt: Number(row.entered_at), ageMs: Math.max(0, now - Number(row.entered_at)), slaMs: Number(row.sla_ms),
    owner: spec?.owner ?? null, autoAction: spec?.autoAction ?? null,
    evidence: [`clock ${row.entity} ${row.state}`, `entered ${new Date(Number(row.entered_at)).toISOString()}`, `sla ${Number(row.sla_ms)}ms`],
    dedupeKey: dedupeKeyOf(code, row.entity, critical),
  };
}

/** The runtime-defect DI a critical violation opens for the Supervisor (DESIGN §10.3). Pure. */
const runtimeDefectDecision = (ev, { now = Date.now() } = {}) => ({
  schema: 'starci/decision-item@1', idempotencyKey: `runtime-defect:${ev.dedupeKey}`, kind: 'runtime-defect', decider: 'supervisor',
  ledger: 'supervisor', workflowId: ev.entity.workflowId ?? null, entity: { type: ev.entity.type, id: ev.entity.id },
  summary: `${ev.code} ${ev.entity.type} ${ev.entity.id}: ${ev.state} for ${Math.round(ev.ageMs / 60_000)}m (SLA ${Math.round(ev.slaMs / 60_000)}m)${ev.autoAction ? `; auto: ${ev.autoAction}` : ''}`,
  evidence: [{ ref: `invariant:${ev.dedupeKey}` }, ...ev.evidence.map((line) => ({ ref: line }))],
  openedBy: 'sla-layer', openedAt: now, escalateTo: 'owner', code: ev.code, severity: ev.severity,
});

/* ------------------------------------------------------------------------------------------------ state DB */

/** The store of the clocks: ctx.stateFile (the engine's machine.sqlite), else machine.sqlite of ctx.env. */
export const stateFileOf = (ctx = {}, env = ctx.env ?? process.env) => ctx.stateFile ?? machineFileFor(env);

/**
 * Run fn(m) over machine.sqlite: the engine's own handle when ctx exposes one (ctx.machine), else a short-lived handle
 * of our own (a writer when `write`, else a reader; a missing store reads as `fallback`). Never throws.
 */
function withStateDb(ctx, fn, fallback = null, { write = false } = {}) {
  const env = ctx?.env ?? process.env;
  const borrowed = ctx?.machine && typeof ctx.machine.openSlaEpisode === 'function' ? ctx.machine : null;
  try {
    if (borrowed) return fn(borrowed);
    return write ? withMachine(fn, { env, file: ctx?.stateFile ?? null }) : readMachine(fn, fallback, { env, file: ctx?.stateFile ?? null });
  } catch { return fallback; }
}

/**
 * Open (or keep) the episode of (entity, state) on `m`: a running one keeps its entered_at (fill-once) and takes the new
 * sla_ms; code and severity come from the catalogue (codeOf). Returns true.
 */
export function openClock(m, { entity, state, slaMs, ledgerId = null, workflowId = null, code = null, enteredAt = m.now(), catalog = slaCatalog() }) {
  const c = codeOf(state, catalog);
  const sla = Math.max(0, Math.round(Number(slaMs) || 0));
  const episodeId = m.openSlaEpisode({ entity: String(entity), state: String(state), code: String(code ?? c.code), severity: c.severity, ledgerId, workflowId, slaMs: sla, enteredAt });
  m.db.prepare('UPDATE sla_episodes SET sla_ms=? WHERE episode_id=? AND sla_ms<>?').run(sla, episodeId, sla);
  return true;
}

const clockRow = (r) => ({ episodeId: Number(r.episode_id), entity: r.entity, state: r.state, ledgerId: r.ledger_id, enteredAt: Number(r.entered_at), slaMs: Number(r.sla_ms),
  violatedAt: r.violated_at ?? null, clearedAt: r.cleared_at ?? null, clearReason: r.clear_reason ?? null });

/** Clock episodes whose entity starts with one of `prefixes` (open: cleared_at NULL, the default; else every episode): [{episodeId, entity, state, ledgerId, enteredAt, slaMs, violatedAt, clearedAt, clearReason}]. */
export function clocksOf(ctx, { prefixes = [], open = true } = {}) {
  return withStateDb(ctx, (m) => {
    const where = prefixes.length ? `(${prefixes.map(() => 'substr(entity,1,?)=?').join(' OR ')})` : '1=1';
    const args = prefixes.flatMap((p) => [p.length, p]);
    return m.db.prepare(`SELECT * FROM sla_episodes WHERE ${where}${open ? ' AND cleared_at IS NULL' : ''} ORDER BY entity, state, episode_id`).all(...args).map(clockRow);
  }, []);
}

/**
 * Start (or keep) a clock. Prefers the engine's ctx.clock(entity, state, slaMs, meta), meta {ledgerId, enteredAt};
 * without one, opens the episode itself (openClock): a new or re-entered clock takes enteredAt, a running one keeps
 * its entered_at and takes the new sla_ms.
 */
export async function setClock(ctx, { entity, state, slaMs, ledgerId = null, enteredAt = null, meta = {} }) {
  const at = Number.isFinite(Number(enteredAt)) && Number(enteredAt) > 0 ? Number(enteredAt) : ctx.now();
  if (typeof ctx.clock === 'function') return ctx.clock(entity, state, slaMs, { ...meta, ledgerId, enteredAt: at });
  return withStateDb(ctx, (m) => openClock(m, { entity, state, slaMs, ledgerId, workflowId: meta?.workflowId ?? null, code: meta?.code ?? null, enteredAt: at }), false, { write: true });
}

/** Stop a clock: ctx.clear(entity, state), else close its open episode (clear_reason `resolved`). */
export async function clearClock(ctx, { entity, state }) {
  if (typeof ctx.clear === 'function') return ctx.clear(entity, state);
  return withStateDb(ctx, (m) => m.clearSla({ entity, state, reason: 'resolved' }), 0, { write: true });
}

/* ------------------------------------------------------------------------------------------------ the pass */

/** The newest violated/cleared Supervisor event (sup_events) per dedupeKey: Map(dedupeKey -> kind). */
const lastInvariantKinds = (m, keys) => {
  const out = new Map();
  const q = m.db.prepare("SELECT kind FROM sup_events WHERE entity_type='invariant' AND entity_id=? AND kind IN (?,?) ORDER BY seq DESC LIMIT 1");
  for (const k of keys) { const r = q.get(k, VIOLATED_KIND, CLEARED_KIND); if (r) out.set(k, r.kind); }
  return out;
};

/** refs of a typed row: workflow, then the extra refs, deduped. Pure. */
const refsOf = ({ workflowId = null, extra = [] } = {}) => [...new Set([...String(workflowId ?? '').split(',').filter(Boolean).map((wf) => `workflow:${wf}`), ...extra.filter(Boolean).map(String)])];

// The typed rows are the kinds invariant.violated / invariant.cleared (scripts/kernel/typed-logs.mjs), machine_logs actor 'reconciler'.
const typedRow = (ev, { now, cleared = false }) => {
  const kind = cleared ? 'invariant.cleared' : TYPED_EVENT;
  let level = 'warn';
  if (cleared) level = 'info';
  else if (ev.severity === 'critical') level = 'error';
  let detail = '';
  if (cleared) {
    if (ev.clearedBy) {
      const reason = ev.clearedWhy ? `: ${ev.clearedWhy}` : '';
      detail = ` (${ev.clearedBy}${reason})`;
    }
  } else detail = ` age ${Math.round(ev.ageMs / 60_000)}m > sla ${Math.round(ev.slaMs / 60_000)}m`;
  const clearWhy = cleared && ev.clearedWhy ? `: ${ev.clearedWhy}` : '';
  const message = `${ev.state} ${ev.entity.type}:${ev.entity.id}${clearWhy}`;
  return {
    kind, at: now, level,
    msg: `${kind} ${ev.code} ${ev.entity.type} ${ev.entity.id}${detail}`,
    workflowId: ev.entity.workflowId ?? null,
    data: { code: ev.code, message, severity: ev.severity, dedupeKey: ev.dedupeKey,
      ...(ev.owner ? { owner: ev.owner } : {}), state: String(ev.state), entity: ev.entity, ...(cleared ? {} : { ageMs: ev.ageMs, slaMs: ev.slaMs }) },
    refs: refsOf({ workflowId: ev.entity.workflowId, extra: [`invariant:${ev.dedupeKey}`, ...(ev.entity.ledger ? [`ledger:${ev.entity.ledger}`] : [])] }),
  };
};

/* ------------------------------------------------------------------------------------------------ truth */
// Every pass re-checks each open clock against the ledger / host truth, independent of the controller that set it: a
// clear that depended on a state-transition event (or on a controller pass that has not run yet, or on a probe that
// timed out once) never leaves a violation standing. A check answers {holds: false, why} when the condition is gone,
// {holds: true} when it still holds, null when it cannot tell (the clock is left to its controller). A clock the check
// clears gets cleared_at here, and the cleared path of the pass writes ONE runtime-invariant-cleared event and ONE
// invariant.cleared row when it had been violated. Ledger checks run for every open clock; a host probe (SERVICE_DOWN)
// only for a clock that is violated or due, so a pass never probes a healthy worker set. A controller that re-sets a clock
// the truth cleared is cleared again on the next pass before it can re-violate.

const SETTLED_JOB = new Set(SETTLED_JOB_LIST);
const LIVE_DECISION = new Set(['open', 'claimed', 'escalated']);
const KEY_SEP = '\u0000';
/** job clock code -> the job statuses in which its condition can still hold (null: any unsettled status). */
const JOB_TRUTH = Object.freeze({
  LEASE_STUCK: ['leased'], QUESTION_OVERDUE: ['answering'], EFFECT_UNKNOWN_STUCK: ['effect_unknown'],
  DEAD_WORKER_UNRECONCILED: ['running', 'answering', 'effect_unknown'], SETTLE_OVERDUE: null, DECISION_OVERDUE: null,
});
const PROBE_CODES = new Set(['SERVICE_DOWN']);

/** Per-pass readers: product ledger handles by ledgerId, the service registry, the decisions module. */
function truthSources(ctx) {
  const handles = new Map();
  let registry, decisions;
  const ledgerOf = (ledgerId) => {
    if (handles.has(ledgerId)) return handles.get(ledgerId);
    let db = null;
    const list = typeof ctx?.ledgers === 'function' ? ctx.ledgers() : ctx?.ledgers ?? [];
    const l = list.find((x) => x?.ledgerId === ledgerId && x.file);
    try { if (l && fs.existsSync(l.file)) db = (ctx.openReader ?? openLedgerReader)(l.file); } catch { db = null; }
    handles.set(ledgerId, db);
    return db;
  };
  return {
    ledgerOf,
    state: (fn) => withStateDb(ctx, (m) => fn(m.db), null),
    registry: async () => {
      if (registry === undefined) {
        try { registry = ctx?.serviceRegistry ? await ctx.serviceRegistry() : (await import('./services.mjs')).serviceRegistry(); } catch { registry = null; }
      }
      return registry;
    },
    decisions: async () => {
      if (decisions === undefined) { try { decisions = ctx?.decisionsModule ?? await import('../machine/decisions.mjs'); } catch { decisions = null; } }
      return decisions;
    },
    close: () => { for (const db of handles.values()) { try { db?.close(); } catch { /* closed */ } } },
  };
}

/** Whether one clock's condition still holds: {holds, why?} or null (unknown). Never throws. */
async function clockTruth(row, code, src, { now = Date.now() } = {}) {
  try {
    const p = String(row.entity ?? '').split(':');
    if (code === 'SERVICE_DOWN' && p[0] === 'service') {
      const entry = (await src.registry())?.find((e) => e.name === p.slice(1).join(':'));
      if (typeof entry?.probe !== 'function') return null;
      // Two tries: the first request after idle can miss a short probe timeout while the service is up.
      for (let i = 0; i < 2; i++) {
        const r = await entry.probe();
        if (r?.ok === true || r?.unmanaged === true) return { holds: false, why: `probe ok${r?.status ? ` (http ${r.status})` : ''}${i ? ' on the second try' : ''}` };
      }
      return { holds: true };
    }
    if (p[0] === 'job' && p.length >= 3 && Object.hasOwn(JOB_TRUTH, code)) {
      const db = src.ledgerOf(p[1]);
      if (!db) return null;
      const jobId = p.slice(2).join(':');
      const job = db.prepare('SELECT status, workflow_id FROM jobs WHERE job_id=?').get(jobId);
      if (!job) return { holds: false, why: 'job gone' };
      if (SETTLED_JOB.has(job.status)) return { holds: false, why: `job ${job.status}` };
      const allowed = JOB_TRUTH[code];
      if (allowed && !allowed.includes(job.status)) return { holds: false, why: `job ${job.status}` };
      if (code === 'DECISION_OVERDUE') {
        const mod = await src.decisions();
        if (typeof mod?.listDecisions !== 'function') return null;
        const mine = mod.listDecisions(db, { workflowId: job.workflow_id, all: true, now }).filter((d) => d?.entity?.id === jobId);
        // Only a decision that existed and is no longer live clears it: before its DI opens, the clock is the job controller's.
        if (mine.length && !mine.some((d) => LIVE_DECISION.has(d.status))) {
          const last = mine[mine.length - 1];
          return { holds: false, why: `decision ${last.id ?? last.idempotencyKey ?? ''} ${last.status}` };
        }
      }
      return { holds: true };
    }
    if (code === TRANSCRIPT_CODE && p[0] === 'attempt' && p.length >= 3) {
      const db = src.ledgerOf(p[1]);
      if (!db) return null;
      const a = db.prepare('SELECT transcript_sha FROM op_attempts WHERE attempt_id=?').get(p.slice(2).join(':'));
      if (!a) return { holds: false, why: 'attempt gone' };
      return a.transcript_sha ? { holds: false, why: 'transcript captured' } : { holds: true };
    }
    if (code === TRANSCRIPT_CODE && p[0] === 'seat-turn' && p.length >= 2) {
      const t = src.state?.((db) => db.prepare('SELECT t.seat_id, t.ended_at, EXISTS(SELECT 1 FROM seat_transcript_snapshots s WHERE s.seat_id=t.seat_id AND s.at >= t.ended_at) AS captured FROM seat_turns t WHERE t.turn_id=?').get(Number(p[1])));
      if (t == null) return null;
      return t.captured ? { holds: false, why: 'transcript captured' } : { holds: true };
    }
    // MB-08 / Q14: a seat or workflow clock of a workflow that is no longer running (paused, stopped, finished,
    // archived) is gone: a stopped workflow's seat is not vacant, and no controller ever brings it back.
    if ((p[0] === 'workflow' && p.length >= 3) || (p[0] === 'stuck' && p.length >= 4) || (p[0] === 'seat' && p[1] === 'kernel' && p.length >= 4)) {
      const db = src.ledgerOf(p[0] === 'seat' ? p[2] : p[1]);
      if (!db) return null;
      const wf = p[0] === 'workflow' ? p.slice(2).join(':') : p[0] === 'seat' ? p.slice(3).join(':') : p[2];
      const w = db.prepare('SELECT phase, archived_at FROM workflows WHERE workflow_id=?').get(wf);
      if (w?.phase !== 'running' || w?.archived_at != null) return { holds: false, why: `workflow ${w ? (w.archived_at != null ? 'archived' : w.phase ?? 'not running') : 'gone'}` };
      return { holds: true };
    }
    return null;
  } catch { return null; }
}

/* ------------------------------------------------------------------------------------------------ transcripts */
// TRANSCRIPT_MISSING (ui/CONTRACT.md): a closed op attempt (op_attempts.terminal_closed_at set) whose full scrollback
// never became a blob (transcript_sha NULL), or an ended seat turn (machine seat_turns.ended_at) with no seat transcript
// snapshot taken at or after its end. The clock starts at the close/end; the catalogue's grace (slaMs) is how long the
// capture (close-op-terminal.mjs, orca-runs.mjs) may take. A ledger or state DB without those tables is skipped. The truth check clears the clock once the transcript exists.

const TRANSCRIPT_CODE = 'TRANSCRIPT_MISSING';
const TRANSCRIPT_WINDOW_MS = 86_400_000;
const TRANSCRIPT_LIMIT = 200;
const hasTable = (db, name) => sqliteHasTable(db, name, { views: true });

/** The closed attempts of one ledger that lack a transcript: [{attemptId, workflowId, closedAt}]. Pure over the handle. */
function attemptsWithoutTranscript(db, { now = Date.now(), windowMs = TRANSCRIPT_WINDOW_MS, limit = TRANSCRIPT_LIMIT } = {}) {
  if (!hasTable(db, 'op_attempts')) return [];
  const cols = new Set(db.prepare('PRAGMA table_info(op_attempts)').all().map((c) => c.name));
  if (!cols.has('transcript_sha') || !cols.has('terminal_closed_at')) return [];
  return db.prepare('SELECT attempt_id, workflow_id, terminal_closed_at FROM op_attempts WHERE terminal_closed_at IS NOT NULL AND transcript_sha IS NULL AND terminal_closed_at > ? ORDER BY terminal_closed_at DESC LIMIT ?')
    .all(now - windowMs, limit).map((r) => ({ attemptId: r.attempt_id, workflowId: r.workflow_id ?? null, closedAt: Number(r.terminal_closed_at) }));
}

/** The ended seat turns (machine.sqlite) with no transcript snapshot at or after their end: [{turnId, seatId, endedAt}]. */
function seatTurnsWithoutTranscript(db, { now = Date.now(), windowMs = TRANSCRIPT_WINDOW_MS, limit = TRANSCRIPT_LIMIT } = {}) {
  if (!hasTable(db, 'seat_turns') || !hasTable(db, 'seat_transcript_snapshots')) return [];
  return db.prepare(`SELECT t.turn_id, t.seat_id, t.ended_at FROM seat_turns t WHERE t.ended_at IS NOT NULL AND t.ended_at > ?
      AND NOT EXISTS(SELECT 1 FROM seat_transcript_snapshots s WHERE s.seat_id=t.seat_id AND s.at >= t.ended_at) ORDER BY t.ended_at DESC LIMIT ?`)
    .all(now - windowMs, limit).map((r) => ({ turnId: r.turn_id, seatId: r.seat_id, endedAt: Number(r.ended_at) }));
}

/** Start a TRANSCRIPT_MISSING clock per attempt / seat turn found. Returns the number of clocks set. Never throws. */
export async function transcriptPass(ctx, { catalog, now }) {
  const graceMs = catalog?.codes?.[TRANSCRIPT_CODE]?.slaMs ?? 120_000;
  const found = [];
  const list = typeof ctx?.ledgers === 'function' ? ctx.ledgers() : ctx?.ledgers ?? [];
  for (const l of list.filter((x) => x?.ledgerId && x.ledgerId !== 'supervisor' && x.file)) {
    let db = null;
    try {
      if (!fs.existsSync(l.file)) continue;
      db = (ctx.openReader ?? openLedgerReader)(l.file);
      for (const a of attemptsWithoutTranscript(db, { now })) found.push({ entity: `attempt:${l.ledgerId}:${a.attemptId}`, ledgerId: l.ledgerId, enteredAt: a.closedAt, meta: { workflowId: a.workflowId } });
    } catch { /* unreadable ledger: its own clocks cover it */ } finally { try { db?.close(); } catch { /* closed */ } }
  }
  for (const t of withStateDb(ctx, (m) => seatTurnsWithoutTranscript(m.db, { now }), []) ?? []) found.push({ entity: `seat-turn:${t.turnId}`, ledgerId: 'supervisor', enteredAt: t.endedAt, meta: { seatId: t.seatId } });
  for (const f of found) {
    try { await setClock(ctx, { entity: f.entity, state: TRANSCRIPT_CODE, slaMs: graceMs, ledgerId: f.ledgerId, enteredAt: f.enteredAt, meta: { code: TRANSCRIPT_CODE, owner: 'gc-controller', ...f.meta } }); } catch { /* next */ }
  }
  return found.length;
}

/** The clear_reason of a truth check's `why`: the entity is gone, its workflow stopped, or the condition resolved. Pure. */
const clearReasonOf = (why) => (/\bgone$/.test(String(why ?? '')) ? 'entity-gone' : /^workflow (?:archived|stopped|finished|paused|not running)|^workflow \w+$/.test(String(why ?? '')) ? 'workflow-stopped' : 'resolved');

/** Clear every open clock whose condition is gone. Returns Map(entity KEY_SEP state -> why). */
async function truthPass(ctx, { catalog, now }) {
  const open = withStateDb(ctx, (m) => m.db.prepare('SELECT * FROM v_sla_open').all(), []);
  const src = truthSources(ctx);
  const cleared = new Map();
  try {
    for (const row of open) {
      const { code } = codeOf(row.state, catalog);
      const due = row.violated_at != null || Number(row.entered_at) + Number(row.sla_ms) < now;
      if (PROBE_CODES.has(code) && !due) continue;
      const t = await clockTruth(row, code, src, { now });
      if (t?.holds === false) cleared.set(`${row.entity}${KEY_SEP}${row.state}`, t.why ?? 'condition gone');
    }
  } finally { src.close(); }
  if (cleared.size) {
    withStateDb(ctx, (m) => m.transaction(() => {
      for (const [k, why] of cleared) { const [entity, state] = k.split(KEY_SEP); m.clearSla({ entity, state, reason: clearReasonOf(why) }); }
    }), null, { write: true });
  }
  return cleared;
}

/**
 * One SLA pass. Returns {ok, violated: [event], cleared: [event], decisions, skipped}. Every violation and clear is
 * written in every mode (the layer reports; ctx.openDecision carries the shadow gate for the DI). Never throws.
 */
export async function slaPass(ctx, { catalog = null, env = ctx?.env ?? process.env } = {}) {
  const now = typeof ctx?.now === 'function' ? ctx.now() : Date.now();
  const cat = catalog ?? slaCatalog();
  const out = { ok: true, violated: [], cleared: [], decisions: 0, skipped: [], truthCleared: [] };
  try { out.transcriptClocks = await transcriptPass(ctx, { catalog: cat, now }); } catch { out.transcriptClocks = 0; }
  const truth = await truthPass(ctx, { catalog: cat, now });
  out.truthCleared = [...truth.entries()].map(([k, why]) => ({ clock: k.split(KEY_SEP).join(' '), why }));
  const due = withStateDb(ctx, (m) => m.db.prepare('SELECT * FROM v_sla_open WHERE violated_at IS NULL AND due_at < ? ORDER BY entered_at').all(now), null);
  if (due == null) return { ...out, ok: true, skipped: ['no-state-db'] };
  // Episodes are never deleted: a violated episode cleared lately whose clear is not reported yet (the newest event of
  // its dedupeKey is still the violation) gets its cleared event now.
  const done = withStateDb(ctx, (m) => m.db.prepare('SELECT * FROM sla_episodes WHERE violated_at IS NOT NULL AND cleared_at IS NOT NULL AND cleared_at > ? ORDER BY episode_id').all(now - CLEAR_REPORT_WINDOW_MS), []);

  const events = due.map((row) => ({ row, ev: violationEvent(row, { catalog: cat, now }) }));
  const clears = done.map((row) => {
    const why = truth.get(`${row.entity}${KEY_SEP}${row.state}`);
    return { row, ev: { ...violationEvent(row, { catalog: cat, now }), kind: CLEARED_KIND, clearedAt: Number(row.cleared_at), clearedBy: why ? 'sla-truth' : 'controller', ...(why ? { clearedWhy: why } : {}) } };
  });
  // One transaction: the Supervisor events, the invariant_violations rows, the typed log rows and the episode marks.
  const written = withStateDb(ctx, (m) => m.transaction(() => {
    // A clear already reported (or an episode re-violated after one) is not reported twice: newest event per dedupeKey.
    const last = lastInvariantKinds(m, [...new Set([...events, ...clears].map((x) => x.ev.dedupeKey))]);
    const toViolate = [], toClear = [];
    for (const x of events) if (last.get(x.ev.dedupeKey) !== VIOLATED_KIND) { toViolate.push(x); last.set(x.ev.dedupeKey, VIOLATED_KIND); }
    for (const x of clears) if (last.get(x.ev.dedupeKey) === VIOLATED_KIND) { toClear.push(x); last.set(x.ev.dedupeKey, CLEARED_KIND); }
    for (const { row, ev } of toViolate) {
      supervisorEvent(m, { entityType: 'invariant', entityId: ev.dedupeKey, kind: VIOLATED_KIND, payload: ev, now });
      m.recordViolation({ code: ev.code, severity: ev.severity, entity: row.entity, ledgerId: row.ledger_id ?? null, workflowId: row.workflow_id ?? ev.entity.workflowId ?? null,
        episodeId: Number(row.episode_id), detail: ev });
    }
    for (const { row, ev } of toClear) {
      supervisorEvent(m, { entityType: 'invariant', entityId: ev.dedupeKey, kind: CLEARED_KIND, payload: ev, now });
      m.db.prepare('UPDATE invariant_violations SET cleared_at=? WHERE entity=? AND code=? AND cleared_at IS NULL').run(now, row.entity, ev.code);
    }
    m.log([...toViolate.map(({ ev }) => typedRow(ev, { now })), ...toClear.map(({ ev }) => typedRow(ev, { now, cleared: true }))].map((r) => ({ actor: 'reconciler', ...r })));
    // Critical delivery stays pending until an actual DI acknowledgement; invariant history remains deduped.
    for (const { row, ev } of events) { m.markSlaViolated(Number(row.episode_id)); if (ev.severity !== 'critical') m.markSlaReported(Number(row.episode_id)); }
    return { toViolate, toClear };
  }), null, { write: true });
  if (!written) return { ...out, ok: false, error: 'sla pass: machine.sqlite write failed' };
  const { toViolate, toClear } = written;
  out.violated = toViolate.map((x) => x.ev);
  out.cleared = toClear.map((x) => x.ev);
  const pending = withStateDb(ctx, (m) => m.db.prepare('SELECT * FROM sla_episodes WHERE violated_at IS NOT NULL AND reported_at IS NULL AND cleared_at IS NULL ORDER BY episode_id').all(), null);
  if (pending == null) return { ...out, ok: false, error: 'sla pass: pending decision read failed' };
  for (const row of pending) {
    const ev = violationEvent(row, { catalog: cat, now });
    if (ev.severity !== 'critical') continue;
    try {
      if (typeof ctx?.openDecision !== 'function') throw new Error('decision owner unavailable');
      const acknowledged = await ctx.openDecision(runtimeDefectDecision(ev, { now }));
      if (ctx.mode === 'shadow') { out.wouldDecisions = (out.wouldDecisions ?? 0) + 1; continue; }
      if (acknowledged?.ok !== true || acknowledged.shadow || acknowledged.recordedOnly) throw new Error('decision delivery was not acknowledged');
      const marked = withStateDb(ctx, (m) => m.transaction(() => {
        m.markSlaReported(Number(row.episode_id));
        return m.db.prepare('SELECT reported_at FROM sla_episodes WHERE episode_id=?').get(row.episode_id)?.reported_at != null;
      }), false, { write: true });
      if (!marked) throw new Error('decision acknowledgement write failed');
      out.decisions += 1;
    } catch (error) { out.ok = false; out.skipped.push(`decision:${ev.dedupeKey}: ${String(error?.message ?? error).slice(0, 120)}`); }
  }
  if (typeof ctx?.log === 'function' && (out.violated.length || out.cleared.length)) {
    try { await ctx.log('reconciler.sla', `sla pass: ${out.violated.length} violated, ${out.cleared.length} cleared`, { violated: out.violated.map((e) => e.dedupeKey), cleared: out.cleared.map((e) => e.dedupeKey) }); } catch { /* best effort */ }
  }
  return out;
}

/** The open violations (the newest Supervisor event per dedupeKey is a violation): [{dedupeKey, code, severity, entity, at}]. */
export const openViolations = ({ env = process.env, limit = 2000 } = {}) => readSupervisor((m) => {
  const seen = new Map();
  for (const r of m.supEvents({ kinds: [VIOLATED_KIND, CLEARED_KIND], entityType: 'invariant', limit })) {
    if (seen.has(r.entity_id)) continue;
    const { code, severity, entity } = r.payload ?? {}; seen.set(r.entity_id, r.kind === VIOLATED_KIND ? { dedupeKey: r.entity_id, code, severity, entity, at: Number(r.created_at) } : null);
  }
  return [...seen.values()].filter(Boolean);
}, [], { env });

if (isMain(import.meta.url)) {
  const argv = new Set(process.argv.slice(2));
  const json = argv.has('--json');
  const ctx = { mode: 'shadow', now: () => Date.now(), env: process.env,
    openDecision: async (di) => { console.error(`would open DI ${di.idempotencyKey}`); return { ok: true, shadow: true }; } };
  if (argv.has('--list')) {
    const out = { stateFile: stateFileOf(ctx), clocks: clocksOf(ctx), open: openViolations(), catalog: slaCatalog() };
    console.log(json ? JSON.stringify(out, null, 2) : [`state ${out.stateFile}`, ...out.clocks.map((c) => `${c.entity} ${c.state} entered ${new Date(c.enteredAt).toISOString()} sla ${c.slaMs}${c.violatedAt ? ' VIOLATED' : ''}`),
      `${out.open.length} open violation(s)`, ...out.open.map((v) => `  ${v.dedupeKey} ${v.severity}`)].join('\n'));
  } else if (argv.has('--once')) {
    const m = openMachine();
    let out;
    try { out = await slaPass({ ...ctx, machine: m, stateFile: m.file }); } finally { m.close(); }
    console.log(json ? JSON.stringify(out, null, 2) : `sla pass: ${out.violated.length} violated, ${out.cleared.length} cleared${out.skipped.length ? `; skipped ${out.skipped.join(', ')}` : ''}`);
  } else {
    console.log('args: --once|--list [--json]');
  }
}
