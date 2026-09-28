#!/usr/bin/env node
// sla.mjs — the reconciler's SLA / Invariant layer (DESIGN.md §8.8, Appendix A; lane rc-sla-workflow).
//
// Controllers record how long an entity has been in a state (reconciler.sqlite sla_clocks, DESIGN §7.3, through
// ctx.clock / ctx.clear). slaPass(ctx) is the engine's built-in pass (every modules/reconciler/sla.yaml passMs): a
// clock past its sla_ms that is not yet violated becomes ONE `runtime-invariant-violated` event on the supervisor
// ledger plus one typed row; a violated clock whose entity left the state becomes ONE `runtime-invariant-cleared`
// event and the row is removed. A `critical` code opens a Decision Item `runtime-defect` for the Supervisor
// (ctx.openDecision: a would-row in shadow). The layer only reports (concern sla.report): it runs in every mode,
// shadow included, and never acts on a product ledger.
//
// The catalogue (code -> {slaMs | slaKey (+plusMs), criticalKey, severity, owner, autoAction}) is
// modules/reconciler/sla.yaml; a slaKey is a dotted key under modules/models/runtimes.yaml `allocation:`, cited
// instead of copied.
//
//   node scripts/reconciler/sla.mjs --once [--json]     one pass against the live state DB (writes violations)
//   node scripts/reconciler/sla.mjs --list [--json]     the open clocks and the catalogue, read only
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../engine/yaml.mjs';
import { allocationSettings } from '../../engine/config.mjs';
import { parseJsonOr } from '../lib/json.mjs';
import { SUPERVISOR_WF, supervisorHome, withSupervisorLedger, withSupervisorRead, supervisorEvent } from '../supervisor/home.mjs';
import { supLog, refsOf } from '../supervisor/sup-log.mjs';

const require = createRequire(import.meta.url);
const selfFile = fileURLToPath(import.meta.url);
const skillRoot = path.resolve(path.dirname(selfFile), '..', '..');
export const SLA_FILE = path.join(skillRoot, 'modules', 'reconciler', 'sla.yaml');
export const VIOLATED_KIND = 'runtime-invariant-violated';
export const CLEARED_KIND = 'runtime-invariant-cleared';
export const TYPED_EVENT = 'invariant.violated';
export const CRITICAL_SUFFIX = '/critical';
/** The sla_clocks table exactly as DESIGN.md §7.3 declares it (lane rc-engine state.mjs owns the file; specs use this). */
export const SLA_CLOCKS_DDL = `CREATE TABLE IF NOT EXISTS sla_clocks(entity TEXT, state TEXT, ledger_id TEXT, entered_at INTEGER, sla_ms INTEGER,
  violated_at INTEGER, reported_at INTEGER, cleared_at INTEGER, PRIMARY KEY(entity,state))`;

/* ------------------------------------------------------------------------------------------------ catalogue */

const dotted = (root, key) => String(key).split('.').reduce((node, k) => (node == null ? node : node[k]), root);
const positiveOrZero = (v) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : null);

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
  return { passMs: positiveOrZero(doc.passMs) ?? 30_000, codes, states: { ...(doc.states ?? {}) } };
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

export const dedupeKeyOf = (code, entity, critical = false) => `${code}|${entity}${critical ? '|critical' : ''}`;

/** The §8.8 violation event of one clock row. Pure. */
export function violationEvent(row, { catalog = slaCatalog(), now = Date.now() } = {}) {
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
export const runtimeDefectDecision = (ev, { now = Date.now() } = {}) => ({
  schema: 'starci/decision-item@1', idempotencyKey: `runtime-defect:${ev.dedupeKey}`, kind: 'runtime-defect', decider: 'supervisor',
  ledger: 'supervisor', workflowId: ev.entity.workflowId ?? null, entity: { type: ev.entity.type, id: ev.entity.id },
  summary: `${ev.code} ${ev.entity.type} ${ev.entity.id}: ${ev.state} for ${Math.round(ev.ageMs / 60_000)}m (SLA ${Math.round(ev.slaMs / 60_000)}m)${ev.autoAction ? `; auto: ${ev.autoAction}` : ''}`,
  evidence: [{ ref: `invariant:${ev.dedupeKey}` }, ...ev.evidence.map((line) => ({ ref: line }))],
  openedBy: 'sla-layer', openedAt: now, escalateTo: 'owner', code: ev.code, severity: ev.severity,
});

/* ------------------------------------------------------------------------------------------------ state DB */

/** The reconciler state DB file (lane rc-engine state.mjs): ctx.stateFile, else <supervisor home>/reconciler.sqlite. */
export const stateFileOf = (ctx = {}, env = ctx.env ?? process.env) => ctx.stateFile ?? path.join(supervisorHome(env), 'reconciler.sqlite');

/**
 * Run fn(db) over the state DB: the engine's own handle when ctx exposes one (ctx.stateDb, ctx.state.db), else a
 * connection of our own to an EXISTING file that already has sla_clocks (this layer never creates the engine's
 * file or its schema). Returns fallback when there is none. Never throws.
 */
export function withStateDb(ctx, fn, fallback = null) {
  const borrowed = ctx?.stateDb ?? (ctx?.state && typeof ctx.state.db?.prepare === 'function' ? ctx.state.db : null);
  if (borrowed) { try { return fn(borrowed); } catch { return fallback; } }
  const file = stateFileOf(ctx ?? {});
  if (!fs.existsSync(file)) return fallback;
  let db = null;
  try {
    const { DatabaseSync } = require('node:sqlite');
    db = new DatabaseSync(file, { timeout: 5000 });
    if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='sla_clocks'").get()) return fallback;
    return fn(db);
  } catch { return fallback; } finally { try { db?.close(); } catch { /* closed */ } }
}

/** Open clocks (cleared_at NULL) whose entity starts with one of `prefixes`: [{entity, state, ledgerId, enteredAt, slaMs, violatedAt}]. */
export function clocksOf(ctx, { prefixes = [], open = true } = {}) {
  return withStateDb(ctx, (db) => {
    const where = prefixes.length ? `(${prefixes.map(() => 'substr(entity,1,?)=?').join(' OR ')})` : '1=1';
    const args = prefixes.flatMap((p) => [p.length, p]);
    return db.prepare(`SELECT * FROM sla_clocks WHERE ${where}${open ? ' AND cleared_at IS NULL' : ''} ORDER BY entity, state`).all(...args)
      .map((r) => ({ entity: r.entity, state: r.state, ledgerId: r.ledger_id, enteredAt: Number(r.entered_at), slaMs: Number(r.sla_ms), violatedAt: r.violated_at ?? null, clearedAt: r.cleared_at ?? null }));
  }, []);
}

/**
 * Start (or keep) a clock. Prefers the engine's ctx.clock(entity, state, slaMs, meta), meta {ledgerId, enteredAt};
 * without one, writes the row itself: a new or re-entered clock takes enteredAt, a running one keeps its entered_at
 * and takes the new sla_ms.
 */
export async function setClock(ctx, { entity, state, slaMs, ledgerId = null, enteredAt = null, meta = {} }) {
  const at = Number.isFinite(Number(enteredAt)) && Number(enteredAt) > 0 ? Number(enteredAt) : ctx.now();
  if (typeof ctx.clock === 'function') return ctx.clock(entity, state, slaMs, { ...meta, ledgerId, enteredAt: at });
  return withStateDb(ctx, (db) => db.prepare(`INSERT INTO sla_clocks(entity,state,ledger_id,entered_at,sla_ms,violated_at,reported_at,cleared_at)
      VALUES(?,?,?,?,?,NULL,NULL,NULL) ON CONFLICT(entity,state) DO UPDATE SET
        entered_at=CASE WHEN cleared_at IS NOT NULL THEN excluded.entered_at ELSE entered_at END,
        violated_at=CASE WHEN cleared_at IS NOT NULL THEN NULL ELSE violated_at END,
        reported_at=CASE WHEN cleared_at IS NOT NULL THEN NULL ELSE reported_at END,
        cleared_at=NULL, sla_ms=excluded.sla_ms, ledger_id=excluded.ledger_id`).run(entity, state, ledgerId, at, Math.max(0, Math.round(slaMs))).changes, 0);
}

/** Stop a clock: ctx.clear(entity, state), else cleared_at on the row. */
export async function clearClock(ctx, { entity, state }) {
  if (typeof ctx.clear === 'function') return ctx.clear(entity, state);
  return withStateDb(ctx, (db) => db.prepare('UPDATE sla_clocks SET cleared_at=? WHERE entity=? AND state=? AND cleared_at IS NULL').run(ctx.now(), entity, state).changes, 0);
}

/* ------------------------------------------------------------------------------------------------ the pass */

/** The newest violated/cleared event per dedupeKey on the supervisor ledger: Map(dedupeKey -> kind). */
const lastInvariantKinds = (keys, env) => withSupervisorRead((db) => {
  const out = new Map();
  const q = db.prepare("SELECT kind FROM events WHERE workflow_id=? AND entity_type='invariant' AND entity_id=? AND kind IN (?,?) ORDER BY seq DESC LIMIT 1");
  for (const k of keys) { const r = q.get(SUPERVISOR_WF, k, VIOLATED_KIND, CLEARED_KIND); if (r) out.set(k, r.kind); }
  return out;
}, new Map(), { env });

const typedRow = (ev, { now, cleared = false }) => ({
  kind: 'warning', at: now, level: cleared ? 'info' : ev.severity === 'critical' ? 'error' : 'warn',
  msg: `${cleared ? 'invariant.cleared' : TYPED_EVENT} ${ev.code} ${ev.entity.type} ${ev.entity.id}${cleared ? '' : ` age ${Math.round(ev.ageMs / 60_000)}m > sla ${Math.round(ev.slaMs / 60_000)}m`}`,
  data: { code: ev.code, message: `${ev.state} ${ev.entity.type}:${ev.entity.id}`, event: cleared ? 'invariant.cleared' : TYPED_EVENT, severity: ev.severity, dedupeKey: ev.dedupeKey, owner: ev.owner },
  refs: refsOf({ workflowId: ev.entity.workflowId, extra: [`invariant:${ev.dedupeKey}`, ...(ev.entity.ledger ? [`ledger:${ev.entity.ledger}`] : [])] }),
});

/**
 * One SLA pass. Returns {ok, violated: [event], cleared: [event], decisions, skipped}. Every violation and clear is
 * written in every mode (the layer reports; ctx.openDecision carries the shadow gate for the DI). Never throws.
 */
export async function slaPass(ctx, { catalog = null, env = ctx?.env ?? process.env } = {}) {
  const now = typeof ctx?.now === 'function' ? ctx.now() : Date.now();
  const cat = catalog ?? slaCatalog();
  const out = { ok: true, violated: [], cleared: [], decisions: 0, skipped: [] };
  const due = withStateDb(ctx, (db) => db.prepare('SELECT * FROM sla_clocks WHERE violated_at IS NULL AND cleared_at IS NULL AND entered_at + sla_ms < ? ORDER BY entered_at').all(now), null);
  if (due == null) return { ...out, ok: true, skipped: ['no-state-db'] };
  const done = withStateDb(ctx, (db) => db.prepare('SELECT * FROM sla_clocks WHERE violated_at IS NOT NULL AND cleared_at IS NOT NULL').all(), []);

  const events = due.map((row) => ({ row, ev: violationEvent(row, { catalog: cat, now }) }));
  const clears = done.map((row) => ({ row, ev: { ...violationEvent(row, { catalog: cat, now }), kind: CLEARED_KIND, clearedAt: Number(row.cleared_at) } }));
  const last = lastInvariantKinds([...events, ...clears].map((x) => x.ev.dedupeKey), env);
  const toViolate = events.filter(({ ev }) => last.get(ev.dedupeKey) !== VIOLATED_KIND);
  const toClear = clears.filter(({ ev }) => last.get(ev.dedupeKey) === VIOLATED_KIND);

  if (toViolate.length || toClear.length) {
    try {
      withSupervisorLedger((l) => l.transaction(() => {
        for (const { ev } of toViolate) supervisorEvent(l, { entityType: 'invariant', entityId: ev.dedupeKey, kind: VIOLATED_KIND, payload: ev, now });
        for (const { ev } of toClear) supervisorEvent(l, { entityType: 'invariant', entityId: ev.dedupeKey, kind: CLEARED_KIND, payload: ev, now });
      }), { env });
    } catch (error) { return { ...out, ok: false, error: String(error?.message ?? error).slice(0, 200) }; }
    for (const { ev } of toViolate) supLog(typedRow(ev, { now }), { env });
    for (const { ev } of toClear) supLog(typedRow(ev, { now, cleared: true }), { env });
  }
  // Mark every due clock violated (an already-reported one included: its event exists), drop every reported clear.
  withStateDb(ctx, (db) => {
    const mark = db.prepare('UPDATE sla_clocks SET violated_at=?, reported_at=? WHERE entity=? AND state=? AND violated_at IS NULL');
    for (const { row } of events) mark.run(now, now, row.entity, row.state);
    const drop = db.prepare('DELETE FROM sla_clocks WHERE entity=? AND state=? AND cleared_at IS NOT NULL');
    for (const { row } of clears) drop.run(row.entity, row.state);
  });
  out.violated = toViolate.map((x) => x.ev);
  out.cleared = toClear.map((x) => x.ev);
  for (const ev of out.violated.filter((e) => e.severity === 'critical')) {
    if (typeof ctx?.openDecision !== 'function') { out.skipped.push(`decision:${ev.dedupeKey}`); continue; }
    try { await ctx.openDecision(runtimeDefectDecision(ev, { now })); out.decisions += 1; } catch (error) { out.skipped.push(`decision:${ev.dedupeKey}: ${String(error?.message ?? error).slice(0, 120)}`); }
  }
  if (typeof ctx?.log === 'function' && (out.violated.length || out.cleared.length)) {
    try { await ctx.log('reconciler.sla', `sla pass: ${out.violated.length} violated, ${out.cleared.length} cleared`, { violated: out.violated.map((e) => e.dedupeKey), cleared: out.cleared.map((e) => e.dedupeKey) }); } catch { /* best effort */ }
  }
  return out;
}

/** The open violations on the supervisor ledger (latest event per dedupeKey is a violation): [{dedupeKey, code, severity, at}]. */
export const openViolations = ({ env = process.env, limit = 2000 } = {}) => withSupervisorRead((db) => {
  const seen = new Map();
  for (const r of db.prepare('SELECT entity_id, kind, payload_json, created_at FROM events WHERE workflow_id=? AND entity_type=? AND kind IN (?,?) ORDER BY seq DESC LIMIT ?')
    .all(SUPERVISOR_WF, 'invariant', VIOLATED_KIND, CLEARED_KIND, limit)) {
    if (seen.has(r.entity_id)) continue;
    seen.set(r.entity_id, r.kind === VIOLATED_KIND ? { dedupeKey: r.entity_id, ...(({ code, severity, entity }) => ({ code, severity, entity }))(parseJsonOr(r.payload_json, {}) ?? {}), at: Number(r.created_at) } : null);
  }
  return [...seen.values()].filter(Boolean);
}, [], { env });

if (process.argv[1] && path.resolve(process.argv[1]) === selfFile) {
  const argv = process.argv.slice(2);
  const json = argv.includes('--json');
  const ctx = { mode: 'shadow', now: () => Date.now(), env: process.env,
    openDecision: async (di) => { console.error(`would open DI ${di.idempotencyKey}`); return { ok: true, shadow: true }; } };
  if (argv.includes('--list')) {
    const out = { stateFile: stateFileOf(ctx), clocks: clocksOf(ctx), open: openViolations(), catalog: slaCatalog() };
    console.log(json ? JSON.stringify(out, null, 2) : [`state ${out.stateFile}`, ...out.clocks.map((c) => `${c.entity} ${c.state} entered ${new Date(c.enteredAt).toISOString()} sla ${c.slaMs}${c.violatedAt ? ' VIOLATED' : ''}`),
      `${out.open.length} open violation(s)`, ...out.open.map((v) => `  ${v.dedupeKey} ${v.severity}`)].join('\n'));
  } else if (argv.includes('--once')) {
    const out = await slaPass(ctx);
    console.log(json ? JSON.stringify(out, null, 2) : `sla pass: ${out.violated.length} violated, ${out.cleared.length} cleared${out.skipped.length ? `; skipped ${out.skipped.join(', ')}` : ''}`);
  } else {
    console.log('usage: node scripts/reconciler/sla.mjs --once|--list [--json]');
  }
}
