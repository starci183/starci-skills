// seat-wakes.mjs — the wakes a long-lived seat received and what it decided after each, read from the rows the runtime already writes.
//
// A Kernel wake is one of three ledger events (modules/reconciler/seat-cost.yaml kernel.wakes): the watchdog's stall wake, a durable
// transition wake, a Decision Item doorbell. A Supervisor wake is a supervisor-wake event of machine.sqlite whose delivery was proven.
// The seat DECIDED after a wake when it authored a work event (kernel.work / supervisor.work) before the next wake; a wake followed by
// another within wakeActMs shares that next wake's decisions, because the seat answers once. A wake with no decision read its whole
// session for nothing: the seat-cost view counts those per seat and cause, and the wake gate (wake-menu-gate.mjs) withholds them.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../engine/yaml.mjs';
import { parseJsonOr } from '../lib/json.mjs';

const FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'modules', 'reconciler', 'seat-cost.yaml');
let cached = null;

/** The seat cost numbers and tables (modules/reconciler/seat-cost.yaml). */
export const seatCostConfig = () => (cached ??= parseYaml(fs.readFileSync(FILE, 'utf8')));

const quoted = (list) => list.map(() => '?').join(',');

/** The cause a Kernel wake event names: its table cause, and for a transition the first word of its transition. */
function kernelCauseOf(kind, payload) {
  const cause = seatCostConfig().kernel.wakes[kind];
  if (cause !== 'transition') return cause;
  return `transition:${String(payload.transition ?? 'unknown').split(':')[0]}`;
}

/** The delivered wakes of a workflow's Kernel as [{seq, at, kind, cause}] oldest first (ledger `events`). */
export function kernelWakeLog(db, workflowId) {
  const kinds = Object.keys(seatCostConfig().kernel.wakes);
  return db.prepare(`SELECT seq, created_at AS at, kind, payload_json FROM events WHERE workflow_id=? AND kind IN (${quoted(kinds)}) ORDER BY created_at, seq`).all(workflowId, ...kinds)
    .map((row) => ({ seq: Number(row.seq), at: Number(row.at), kind: row.kind, cause: kernelCauseOf(row.kind, parseJsonOr(row.payload_json)) }));
}

/** The wakes the runtime withheld because the menu held no item, as [{at, cause}] (event kernel.skipped). */
export function kernelSkippedLog(db, workflowId) {
  return db.prepare('SELECT created_at AS at, payload_json FROM events WHERE workflow_id=? AND kind=? ORDER BY seq').all(workflowId, seatCostConfig().kernel.skipped)
    .map((row) => ({ at: Number(row.at), cause: parseJsonOr(row.payload_json).cause ?? 'unknown' }));
}

const byPrefix = (row, work) => !work.by || String(parseJsonOr(row.payload_json).by ?? '').startsWith(work.by);

/** The instants a Kernel authored a decision (kernel.work), oldest first. */
export function kernelWorkAts(db, workflowId) {
  const work = seatCostConfig().kernel.work;
  const rows = db.prepare(`SELECT created_at AS at, kind, payload_json FROM events WHERE workflow_id=? AND kind IN (${quoted(work)}) ORDER BY created_at`)
    .all(workflowId, ...work.map((item) => item.kind));
  return rows.filter((row) => byPrefix(row, work.find((item) => item.kind === row.kind))).map((row) => Number(row.at));
}

/** The delivered wakes of the Supervisor as [{seq, at, kind, cause}] oldest first (machine.sqlite sup_events). */
export function supervisorWakeLog(db) {
  const kind = seatCostConfig().supervisor.wake;
  return db.prepare('SELECT seq, created_at AS at, payload_json FROM sup_events WHERE kind=? ORDER BY created_at, seq').all(kind)
    .map((row) => ({ row, payload: parseJsonOr(row.payload_json) }))
    .filter(({ payload }) => payload.delivered === true)
    .map(({ row, payload }) => ({ seq: Number(row.seq), at: Number(row.at), kind, cause: (payload.tags ?? []).join('+') || 'tick' }));
}

/** The instants the Supervisor authored a decision (supervisor.work and the replies it sent), oldest first. */
export function supervisorWorkAts(db) {
  const work = seatCostConfig().supervisor.work;
  const events = db.prepare(`SELECT created_at AS at FROM sup_events WHERE kind IN (${quoted(work)})`).all(...work).map((row) => Number(row.at));
  const replies = db.prepare("SELECT at FROM sup_messages WHERE direction='out'").all().map((row) => Number(row.at));
  return [...events, ...replies].sort((a, b) => a - b);
}

/**
 * Each wake with `worked`: whether the seat decided something between this wake and the next (or `now` for the newest). A wake followed by
 * another within `shareMs` also counts the next wake's window. Pure over the wakes [{at, ...}] and the work instants.
 */
export function withWorked(wakes, workAts, { now = Date.now(), shareMs = seatCostConfig().wakeActMs } = {}) {
  const worked = (from, to) => workAts.some((at) => at >= from && at < to);
  return wakes.map((wake, index) => {
    const next = wakes[index + 1];
    const end = next?.at ?? now + 1;
    const gap = (next?.at ?? Infinity) - wake.at;
    const shared = gap <= shareMs ? (wakes[index + 2]?.at ?? now + 1) : end;
    return { ...wake, worked: worked(wake.at, end) || (shared !== end && worked(end, shared)) };
  });
}
