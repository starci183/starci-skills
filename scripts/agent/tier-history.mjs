// The picks of one tier the balance step reads: the newest picks (ids newest first) and the seats running now, per member.
// Seats (Kernel, Supervisor, worker, critic, op launches) are fenced provider reservations tagged with their tier; an op
// routed but not yet launched is a job whose payload.pick names the tier, counted while its route hold lasts.
import { readMachine } from '../../engine/db/machine.mjs';
import { openLedgerReader } from '../../engine/db/ledger.mjs';
import { isFixtureLedgerPath, machineLedgerFiles } from '../machine/ledger-files.mjs';
import { parseJsonOr } from '../lib/json.mjs';

const RECENT_LIMIT = 24;
const memberId = (row) => `${row.provider}/${row.model}`;

/** Reservation rows of a tier, newest first: {id, at, active}. Launch-time truth for every seat; an op's pick is counted from its job. */
function seatPicks(tier, { env, machineFile }) {
  const rows = readMachine((m) => m.providerReservations({ tier, limit: RECENT_LIMIT * 2 }), [], { env, ...(machineFile ? { file: machineFile } : {}) });
  return rows.map((row) => ({ id: memberId(row), at: row.createdAt, active: row.state !== 'released', op: row.role === 'op' }));
}

/** Routed op jobs of a tier in one open ledger: {id, at, queued}. */
function jobPicks(db, tier) {
  const rows = db.prepare(`SELECT status, payload_json FROM jobs WHERE kind='op' AND json_extract(payload_json,'$.pick.tier')=?
    ORDER BY CAST(json_extract(payload_json,'$.routedAt') AS INTEGER) DESC LIMIT ?`).all(tier, RECENT_LIMIT);
  return rows.map((row) => {
    const payload = parseJsonOr(row.payload_json);
    return { id: payload.pick.member, at: Number(payload.routedAt) || 0, queued: row.status === 'queued' };
  });
}

function ledgerPicks(tier, { db, ledgerFile, machine, env, machineFile }) {
  const picks = [];
  if (db) { try { picks.push(...jobPicks(db, tier)); } catch { /* an unreadable ledger contributes nothing */ } }
  if (!machine || isFixtureLedgerPath(ledgerFile, { env })) return picks;
  for (const file of machineLedgerFiles({ env, exclude: [ledgerFile], machineFile })) {
    let other = null;
    try { other = openLedgerReader(file); picks.push(...jobPicks(other, tier)); }
    catch { /* unreadable */ }
    finally { try { other?.close(); } catch { /* read-only */ } }
  }
  return picks;
}

/**
 * {recent: [id, ...] newest first, running: {id: n}} for one tier. `db`/`ledgerFile` is the routing ledger; with `machine`
 * the other registered product ledgers count too.
 */
export function tierHistory({ tier, db = null, ledgerFile = null, machine = true, env = process.env, machineFile = null, now = Date.now(), routeHoldMs = 0 } = {}) {
  const seats = seatPicks(tier, { env, machineFile });
  const jobs = ledgerPicks(tier, { db, ledgerFile, machine, env, machineFile });
  const recent = [...seats.filter((pick) => !pick.op), ...jobs].sort((a, b) => b.at - a.at).slice(0, RECENT_LIMIT).map((pick) => pick.id);
  const running = {};
  const add = (id) => { running[id] = (running[id] ?? 0) + 1; };
  for (const pick of seats) if (pick.active) add(pick.id);
  for (const pick of jobs) if (pick.queued && now - pick.at < routeHoldMs) add(pick.id);
  return { recent, running };
}
