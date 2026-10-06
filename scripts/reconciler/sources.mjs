// scripts/reconciler/sources.mjs — the events cursor of every ledger and the event routing (DESIGN §7.4).
//
// Ledgers: config.yaml supervisor.repos (ledgerId = the repository folder name) plus the Supervisor (ledgerId
// 'supervisor': its events are machine.sqlite sup_events, scripts/machine/home.mjs). Every pollMs, per product
// ledger, read-only (openLedgerReader):
//   SELECT seq, workflow_id, entity_type, entity_id, kind, payload_json FROM events WHERE seq > ? ORDER BY seq LIMIT 1000
// An event is {ledgerId, repo, seq, workflowId, entityType, entityId, jobId?, kind, payload} (payload: the parsed
// payload_json, {} when absent; jobId: the entity id of a job event, else payload.jobId).
// The cursor of a product ledger lives in machine.sqlite `engine_cursors`, keyed by the ledger's own meta.ledger_id
// (machine.ledgers); a ledger the registry does not know, and the Supervisor's sup_events, keep theirs in process
// memory. The first run of a ledger starts at MAX(seq): no replay, the resync covers the state. The cursor is a hint
// only: level-triggered controllers re-read the ledger.
//
// Routing: every controller's `routes` maps an event kind to key(s) (string | string[] | null). A route key ending
// in '*' matches a kind prefix ('land-*'). One throwing route never stops the others.
import fs from 'node:fs';
import path from 'node:path';
import { openLedgerReader, ledgerFileFor } from '../../engine/db/ledger.mjs';
import { supervisorSettings } from '../machine/home.mjs';

const EVENT_BATCH = 1000;

/**
 * [{ledgerId, repo, file}]: the product ledgers of config.yaml supervisor.repos, then the Supervisor (file null:
 * machine.sqlite sup_events). A repo whose ledger file does not exist yet (a fresh repo with no workflow) is left out:
 * it is not corrupt, and a consumer that writes through the kernel api would create it. The engine re-reads this list
 * every pass, so the ledger joins the pass after its file appears.
 */
export function ledgersOf({ env = process.env, repos = null, exists = fs.existsSync } = {}) {
  let list = repos;
  if (!list) { try { list = supervisorSettings().repos; } catch { list = []; } }
  const out = [];
  const taken = new Set(['supervisor']);
  for (const repo of list ?? []) {
    const root = path.resolve(String(repo));
    let file;
    try { file = ledgerFileFor(root); } catch { continue; }
    if (!exists(file)) continue;
    let id = path.basename(root) || 'repo';
    let n = 2; while (taken.has(id)) { id = `${path.basename(root)}-${n}`; n += 1; }
    taken.add(id);
    out.push({ ledgerId: id, repo: root, file });
  }
  out.push({ ledgerId: 'supervisor', repo: null, file: null });
  return out;
}

/** The keys one route resolves `event` to: [] on null, a thrown error or a bad value. */
function keysOfRoute(route, event) {
  let value;
  try { value = typeof route === 'function' ? route(event) : route; } catch { return []; }
  const list = Array.isArray(value) ? value : value == null ? [] : [value];
  return list.filter((k) => typeof k === 'string' && k);
}

/** The routes of `routes` matching `kind`: the exact one, then every 'prefix*' one. */
function routesFor(routes, kind) {
  const out = [];
  if (!routes || typeof routes !== 'object') return out;
  if (Object.hasOwn(routes, kind)) out.push(routes[kind]);
  for (const [pattern, route] of Object.entries(routes)) {
    if (pattern.endsWith('*') && pattern !== kind && kind.startsWith(pattern.slice(0, -1))) out.push(route);
  }
  return out;
}

/** Route one event through every controller: [{controller, key, reason}]. */
export function routeEvent(event, controllers) {
  const out = [];
  for (const c of controllers) {
    for (const route of routesFor(c.routes, event.kind)) {
      for (const key of keysOfRoute(route, event)) out.push({ controller: c.name, key, reason: `event:${event.kind}:${event.ledgerId}:${event.seq}` });
    }
  }
  return out;
}

/** Cursors kept in process memory, per machine handle: the Supervisor's sup_events and ledgers the registry does not know. */
const memoryCursors = new WeakMap();
const memoryOf = (m) => { if (!memoryCursors.has(m)) memoryCursors.set(m, new Map()); return memoryCursors.get(m); };
const payloadOf = (text) => { try { const p = text ? JSON.parse(text) : null; return p && typeof p === 'object' ? p : {}; } catch { return {}; } };

/** One poll of the Supervisor's sup_events (machine.sqlite). */
function pollSupervisor(m, ledger, { batch = EVENT_BATCH } = {}) {
  const { ledgerId } = ledger;
  const memory = memoryOf(m);
  if (!memory.has(ledgerId)) {
    const max = Number(m.db.prepare('SELECT COALESCE(MAX(seq),0) AS m FROM sup_events').get().m) || 0;
    memory.set(ledgerId, max);
    return { ledgerId, events: [], first: true, seq: max };
  }
  const rows = m.db.prepare('SELECT seq, entity_type, entity_id, kind, payload_json FROM sup_events WHERE seq > ? ORDER BY seq LIMIT ?').all(memory.get(ledgerId), batch);
  const events = rows.map((r) => {
    const payload = payloadOf(r.payload_json);
    const jobId = r.entity_type === 'job' || r.entity_type === 'sup-job' ? r.entity_id : typeof payload.jobId === 'string' ? payload.jobId : null;
    return { ledgerId, repo: ledger.repo, seq: Number(r.seq), workflowId: null, entityType: r.entity_type, entityId: r.entity_id, ...(jobId ? { jobId } : {}), kind: r.kind, payload };
  });
  if (events.length) memory.set(ledgerId, events.at(-1).seq);
  return { ledgerId, events, seq: events.at(-1)?.seq ?? memory.get(ledgerId) };
}

/**
 * One poll of one ledger. `m` is the engine's machine.sqlite handle (engine_cursors). Returns
 * {ledgerId, events: [...], first?, error?}. `reader` is the seam (openLedgerReader).
 */
export function pollLedger(m, ledger, { now = Date.now(), reader = openLedgerReader, batch = EVENT_BATCH } = {}) {
  const { ledgerId, file } = ledger;
  if (ledgerId === 'supervisor' && !file) {
    try { return pollSupervisor(m, ledger, { batch }); } catch (error) { return { ledgerId, events: [], error: String(error?.message ?? error).slice(0, 300) }; }
  }
  if (!file || !fs.existsSync(file)) return { ledgerId, events: [], missing: true };
  let db = null;
  try {
    db = reader(file);
    // The cursor key is the ledger's own meta.ledger_id when machine.ledgers knows it (engine_cursors FK), else memory.
    let registryId = null;
    try { registryId = db.prepare("SELECT value FROM meta WHERE key='ledger_id'").get()?.value ?? null; } catch { registryId = null; }
    const durable = Boolean(registryId && m.db.prepare('SELECT 1 FROM ledgers WHERE ledger_id=?').get(registryId));
    const memory = memoryOf(m), memKey = `${ledgerId}\u0000${file}`;
    const last = durable ? m.cursorOf(registryId) : memory.get(memKey) ?? null;
    const save = (seq) => { if (durable) m.setCursor(registryId, seq); else memory.set(memKey, seq); };
    if (last == null) {
      const max = Number(db.prepare('SELECT COALESCE(MAX(seq),0) AS m FROM events').get().m) || 0;
      save(max);
      return { ledgerId, events: [], first: true, seq: max };
    }
    const rows = db.prepare('SELECT seq, workflow_id, entity_type, entity_id, kind, payload_json FROM events WHERE seq > ? ORDER BY seq LIMIT ?').all(Number(last), batch);
    const events = rows.map((r) => {
      const payload = payloadOf(r.payload_json);
      const jobId = r.entity_type === 'job' ? r.entity_id : typeof payload.jobId === 'string' ? payload.jobId : null;
      return { ledgerId, repo: ledger.repo, seq: Number(r.seq), workflowId: r.workflow_id, entityType: r.entity_type, entityId: r.entity_id, ...(jobId ? { jobId } : {}), kind: r.kind, payload };
    });
    if (events.length) save(events.at(-1).seq);
    return { ledgerId, events, seq: events.at(-1)?.seq ?? Number(last) };
  } catch (error) {
    return { ledgerId, events: [], error: String(error?.message ?? error).slice(0, 300) };
  } finally { try { db?.close(); } catch { /* closed */ } }
}

/** Poll every ledger and route: {routed: [{controller,key,reason}], polls: [...]}. */
export function pollAll(m, ledgers, controllers, options = {}) {
  const polls = [];
  const routed = [];
  for (const ledger of ledgers) {
    const p = pollLedger(m, ledger, options);
    polls.push({ ledgerId: p.ledgerId, count: p.events.length, ...(p.first ? { first: true } : {}), ...(p.missing ? { missing: true } : {}), ...(p.error ? { error: p.error } : {}) });
    for (const ev of p.events) routed.push(...routeEvent(ev, controllers));
  }
  return { routed, polls };
}
