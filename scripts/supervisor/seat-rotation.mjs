// seat-rotation.mjs — when the idle Supervisor seat is replaced by a fresh session, and the handover its boot text carries.
//
// The Supervisor's context grows about a thousand tokens per turn and every turn re-reads it: one session of 619 turns spent 270 M tokens
// (context 50 k at the first turn, 718 k at the last). Its memory is the stores, not its transcript: the menu, the open Decision Items,
// the channel inbox and replies, and the action log are rows of machine.sqlite that the boot text tells it to read first. A seat that has
// received `afterWakes` wakes or spent `afterTokens` tokens since its boot (modules/reconciler/seat-cost.yaml rotation.supervisor) is
// therefore stopped and started again with the standing prompt, the seat staying enabled. It rotates only while idle with nothing in
// flight (no claimed Decision Item, no running worker job, no running land) and never twice inside `minIntervalMs`.
import { seatCostConfig, supervisorWakeLog } from '../kernel/seat-wakes.mjs';
import { rotationDue, sessionOf } from '../kernel/seat-rotation.mjs';
import { clipLine } from '../lib/clip.mjs';
import { supervisorEvent } from '../machine/home.mjs';

const DEFAULT_CLAIM_TTL_MS = 15 * 60_000;
const LIVE_JOB = ['spawning', 'running', 'dispatched', 'reported'];
const RECENT_ACTIONS = 5;
const OPEN_ITEMS = 6;

/** The rotation rule of the Supervisor: {afterWakes, afterTokens, minIntervalMs, event, bootEvents}. */
export const supervisorRule = () => seatCostConfig().rotation.supervisor;

const marks = (list) => list.map(() => '?').join(',');

/** What the seat has received and spent since its latest boot: {bootAt, wakes, tokens}. Machine store reads only. */
export function supervisorSinceBoot(db, rule = supervisorRule()) {
  const bootAt = Number(db.prepare(`SELECT MAX(created_at) AS at FROM sup_events WHERE kind IN (${marks(rule.bootEvents)})`).get(...rule.bootEvents)?.at ?? 0);
  const wakes = supervisorWakeLog(db).filter((wake) => wake.at >= bootAt).length;
  const rows = db.prepare("SELECT turn_ref, at, COALESCE(input_tokens,0)+COALESCE(output_tokens,0)+COALESCE(cache_read_tokens,0)+COALESCE(cache_write_tokens,0) AS tokens FROM llm_usage WHERE subject_type='supervisor-turn'").all();
  const older = new Set(rows.filter((row) => Number(row.at) < bootAt).map((row) => sessionOf(row.turn_ref, 1)));
  const tokens = rows.filter((row) => Number(row.at) >= bootAt && !older.has(sessionOf(row.turn_ref, 1))).reduce((sum, row) => sum + Number(row.tokens), 0);
  return { bootAt, wakes, tokens };
}

/** What the seat has in flight: {claimed: [di ids], jobs: [job ids], lands: [ticket ids]}. A rotation waits for all three to be empty. */
export function inFlightOf(db, now) {
  const claimed = db.prepare("SELECT di_id FROM sup_decision_items WHERE status='claimed' AND COALESCE(claim_at,0)+COALESCE(claim_ttl_ms,?)>?").all(DEFAULT_CLAIM_TTL_MS, now).map((row) => row.di_id);
  const jobs = db.prepare(`SELECT job_id FROM sup_jobs WHERE status IN (${marks(LIVE_JOB)})`).all(...LIVE_JOB).map((row) => row.job_id);
  const lands = db.prepare("SELECT ticket_id FROM land_queue WHERE state='running' AND finished_at IS NULL").all().map((row) => row.ticket_id);
  return { claimed, jobs, lands };
}

/** Why a due rotation waits, or null: the minimum interval since the last one, or what is in flight. */
function blockOf(db, now, rule) {
  const last = Number(db.prepare('SELECT MAX(created_at) AS at FROM sup_events WHERE kind=?').get(rule.event)?.at ?? 0);
  if (last && now - last < rule.minIntervalMs) return `minimum-interval (last rotation ${Math.round((now - last) / 60_000)} min ago)`;
  const flight = inFlightOf(db, now);
  const busy = Object.entries(flight).filter(([, ids]) => ids.length).map(([kind, ids]) => `${ids.length} ${kind}`);
  return busy.length ? `in-flight (${busy.join(', ')})` : null;
}

/** The verdict of one watchdog pass: {due, reason, blocked, since}. Pure over the store handle `db`. */
export function rotationVerdict(db, now, rule = supervisorRule()) {
  const since = supervisorSinceBoot(db, rule);
  const due = rotationDue(since, rule);
  return { ...due, since, blocked: due.due ? blockOf(db, now, rule) : null };
}

/** The boot text of the fresh seat, generated from the stores: the open Decision Items and the last actions of the seat it replaces. */
export function rotationHandover(db, { reason, now }) {
  const items = db.prepare("SELECT di_id, kind, summary FROM sup_decision_items WHERE status IN ('open','claimed') ORDER BY COALESCE(due_at, opened_at) LIMIT ?").all(OPEN_ITEMS);
  const actions = db.prepare("SELECT created_at, payload_json FROM sup_events WHERE kind='supervisor-action' ORDER BY seq DESC LIMIT ?").all(RECENT_ACTIONS).map((row) => {
    const payload = JSON.parse(row.payload_json ?? '{}');
    return `${new Date(Number(row.created_at)).toISOString().slice(11, 16)}Z ${clipLine(payload.item, 60)} ${clipLine(payload.action, 20)}`;
  });
  const itemLines = items.map((item) => `${item.di_id} [${item.kind}] ${clipLine(item.summary, 70)}`);
  return [`rotation of a long session (${reason}) at ${new Date(now).toISOString()}`,
    'the previous seat kept nothing outside the stores: read the menu first (starci supervisor status --json), then starci supervisor actions digest',
    items.length ? `open Decision Items: ${itemLines.join('; ')}` : 'no Decision Item is open',
    actions.length ? `its last actions: ${actions.join('; ')}` : 'it recorded no action'].join('. ');
}

/**
 * The rotation to run now, or null: the seat is past its bound, nothing is in flight and the minimum interval holds. Writes the
 * `supervisor-rotated` event (so a failed launch is not retried before the interval) and returns {reason, handover, since}.
 */
export function planRotation(m, now) {
  const rule = supervisorRule();
  const verdict = rotationVerdict(m.db, now, rule);
  if (!verdict.due || verdict.blocked) return null;
  const handover = rotationHandover(m.db, { reason: verdict.reason, now });
  m.transaction(() => supervisorEvent(m, { kind: rule.event, payload: { reason: verdict.reason, since: verdict.since }, now }));
  return { reason: verdict.reason, handover, since: verdict.since };
}
