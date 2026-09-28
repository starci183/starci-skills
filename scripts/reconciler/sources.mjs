// scripts/reconciler/sources.mjs — the events cursor of every ledger and the event routing (DESIGN §7.4).
//
// Ledgers: config.yaml supervisor.repos (ledgerId = the repository folder name) plus the Supervisor ledger
// (ledgerId 'supervisor', scripts/supervisor/home.mjs). Every pollMs, per ledger, read-only (openLedgerReader):
//   SELECT seq, workflow_id, entity_type, entity_id, kind, payload_json FROM events WHERE seq > ? ORDER BY seq LIMIT 1000
// An event is {ledgerId, repo, seq, workflowId, entityType, entityId, jobId?, kind, payload} (payload: the parsed
// payload_json, {} when absent; jobId: the entity id of a job event, else payload.jobId).
// The cursor lives in reconciler.sqlite `cursors`. The first run of a ledger starts at MAX(seq): no replay, the
// resync covers the state. The cursor is a hint only: level-triggered controllers re-read the ledger.
//
// Routing: every controller's `routes` maps an event kind to key(s) (string | string[] | null). A route key ending
// in '*' matches a kind prefix ('land-*'). One throwing route never stops the others.
import fs from 'node:fs';
import path from 'node:path';
import { openLedgerReader, ledgerFileFor } from '../../engine/ledger-db.mjs';
import { supervisorHome, supervisorLedgerFile, supervisorSettings } from '../supervisor/home.mjs';

export const EVENT_BATCH = 1000;

/** [{ledgerId, repo, file}]: the product ledgers of config.yaml supervisor.repos, then the Supervisor ledger. */
export function ledgersOf({ env = process.env, repos = null } = {}) {
  let list = repos;
  if (!list) { try { list = supervisorSettings().repos; } catch { list = []; } }
  const out = [];
  const taken = new Set(['supervisor']);
  for (const repo of list ?? []) {
    const root = path.resolve(String(repo));
    let file;
    try { file = ledgerFileFor(root); } catch { continue; }
    let id = path.basename(root) || 'repo';
    for (let n = 2; taken.has(id); n += 1) id = `${path.basename(root)}-${n}`;
    taken.add(id);
    out.push({ ledgerId: id, repo: root, file });
  }
  out.push({ ledgerId: 'supervisor', repo: supervisorHome(env), file: supervisorLedgerFile(env) });
  return out;
}

/** The keys one route resolves `event` to: [] on null, a thrown error or a bad value. */
export function keysOfRoute(route, event) {
  let value;
  try { value = typeof route === 'function' ? route(event) : route; } catch { return []; }
  const list = Array.isArray(value) ? value : value == null ? [] : [value];
  return list.filter((k) => typeof k === 'string' && k);
}

/** The routes of `routes` matching `kind`: the exact one, then every 'prefix*' one. */
export function routesFor(routes, kind) {
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

/**
 * One poll of one ledger. `state` is the reconciler.sqlite writer. Returns {ledgerId, events: [...], first?, error?}.
 * `reader` is the seam (openLedgerReader).
 */
export function pollLedger(state, ledger, { now = Date.now(), reader = openLedgerReader, batch = EVENT_BATCH } = {}) {
  const { ledgerId, file } = ledger;
  if (!fs.existsSync(file)) return { ledgerId, events: [], missing: true };
  let db = null;
  try {
    db = reader(file);
    const cursor = state.prepare('SELECT last_seq, file FROM cursors WHERE ledger_id=?').get(ledgerId);
    if (!cursor || cursor.file !== file) {
      const max = Number(db.prepare('SELECT COALESCE(MAX(seq),0) AS m FROM events').get().m) || 0;
      state.prepare('INSERT INTO cursors(ledger_id,file,last_seq,updated_at) VALUES(?,?,?,?) ON CONFLICT(ledger_id) DO UPDATE SET file=excluded.file,last_seq=excluded.last_seq,updated_at=excluded.updated_at')
        .run(ledgerId, file, max, now);
      return { ledgerId, events: [], first: true, seq: max };
    }
    const rows = db.prepare('SELECT seq, workflow_id, entity_type, entity_id, kind, payload_json FROM events WHERE seq > ? ORDER BY seq LIMIT ?').all(Number(cursor.last_seq), batch);
    const events = rows.map((r) => {
      let payload = {};
      try { const p = r.payload_json ? JSON.parse(r.payload_json) : null; if (p && typeof p === 'object') payload = p; } catch { payload = {}; }
      const jobId = r.entity_type === 'job' ? r.entity_id : typeof payload.jobId === 'string' ? payload.jobId : null;
      return { ledgerId, repo: ledger.repo, seq: Number(r.seq), workflowId: r.workflow_id, entityType: r.entity_type, entityId: r.entity_id, ...(jobId ? { jobId } : {}), kind: r.kind, payload };
    });
    if (events.length) state.prepare('UPDATE cursors SET last_seq=?, updated_at=? WHERE ledger_id=?').run(events.at(-1).seq, now, ledgerId);
    return { ledgerId, events, seq: events.at(-1)?.seq ?? Number(cursor.last_seq) };
  } catch (error) {
    return { ledgerId, events: [], error: String(error?.message ?? error).slice(0, 300) };
  } finally { try { db?.close(); } catch { /* closed */ } }
}

/** Poll every ledger and route: {routed: [{controller,key,reason}], polls: [...]}. */
export function pollAll(state, ledgers, controllers, options = {}) {
  const polls = [];
  const routed = [];
  for (const ledger of ledgers) {
    const p = pollLedger(state, ledger, options);
    polls.push({ ledgerId: p.ledgerId, count: p.events.length, ...(p.first ? { first: true } : {}), ...(p.missing ? { missing: true } : {}), ...(p.error ? { error: p.error } : {}) });
    for (const ev of p.events) routed.push(...routeEvent(ev, controllers));
  }
  return { routed, polls };
}
