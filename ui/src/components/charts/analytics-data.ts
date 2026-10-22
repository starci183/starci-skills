import type { Concept } from '../concept';
/** Names the C16 analytics concept this module belongs to, for the attempt-state, formatting and bucketing helpers that every chart shares. */
export const concept: Concept = 'C16';
import type { AttemptRow } from '../../contract';
import type { Tone } from '../status';
import { t } from '../../i18n/t';

/** Chart-level state of an attempt. `dropped` = cancelled/dropped (shown apart from red). */
export type AttemptState = 'pass' | 'bad' | 'run' | 'settling' | 'retry' | 'dropped' | 'unknown';

/** True only when an attempt carries a recorded settlement time, a final verdict and no abnormal end state, so charts never count unsettled work as an outcome. */
export const isVerdictSettled = (row: AttemptRow): boolean => Number.isFinite(row.settledAt) && ['pass', 'fail', 'partial', 'blocked'].includes(row.verdict ?? '') && (row.endState == null || row.endState === 'settled');

/** Collapses an attempt row's verdict, end state and timestamps into the single chart-level state every chart colours and counts by. */
export const attemptState = (row: AttemptRow): AttemptState => {
  if (row.endState === 'worker-dead' || row.endState === 'effect-unknown') return 'bad';
  if (row.endState === 'requeued') return 'retry';
  if (row.endState === 'cancelled') return 'dropped';
  if (row.settledAt != null) {
    if (row.verdict === 'pass') return 'pass';
    if (row.verdict === 'fail' || row.verdict === 'partial' || row.verdict === 'blocked') return 'bad';
    if (row.verdict === 'dropped' || row.verdict === 'cancelled') return 'dropped';
    return 'unknown';
  }
  // Ended without a verdict (refused launch, dead worker, unknown effect) is not running.
  if (row.endState != null) return 'unknown';
  if (row.reportedAt != null || row.reportOutcome != null) return 'settling';
  // Terminal closure ends execution without establishing a report or runtime verdict.
  if (row.terminalEndedAt != null) return 'unknown';
  return row.dispatchedAt != null ? 'run' : 'unknown';
};
/** Maps each chart attempt state to the status tone that paints it, so all charts share one colour meaning. */
export const stateTone: Record<AttemptState, Tone> = { pass: 'success', bad: 'failed', run: 'running', settling: 'warning', retry: 'warning', dropped: 'skipped', unknown: 'skipped' };
/** Maps each chart attempt state to the translated word shown in legends and tooltips. */
export const stateLabel: Record<AttemptState, string> = { pass: t('Passed'), bad: t('Failed/blocked'), run: t('Running'), settling: t('Settling'), retry: t('Requeued'), dropped: t('Dropped'), unknown: t('Unknown') };

/** Formats a number in the viewer's locale with a bounded number of decimals for chart labels. */
export const num = (value: number, digits = 1) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: digits }).format(value);
/** Converts a millisecond duration to minutes, the unit every duration axis uses. */
export const minutes = (ms: number) => ms / 60_000;
/** Renders a duration given in minutes as seconds when under a minute, otherwise as minutes. */
export const fmtMin = (min: number) => min < 1 ? t('{n} sec', { n: num(min * 60, 0) }) : t('{n} min', { n: num(min) });
const zone = 'Asia/Bangkok';
/** Formats an instant as hour and minute in the harness time zone for axis ticks. */
export const fmtClock = (at: number) => new Intl.DateTimeFormat('vi-VN', { timeZone: zone, hour: '2-digit', minute: '2-digit' }).format(at);
/** Formats an instant as day and month in the harness time zone for axis ticks. */
export const fmtDay = (at: number) => new Intl.DateTimeFormat('vi-VN', { timeZone: zone, day: '2-digit', month: '2-digit' }).format(at);
/** Formats an instant as day and month in the harness time zone for axis ticks. */
export const fmtDayClock = (at: number) => `${fmtDay(at)} ${fmtClock(at)}`;

/** Picks the lower median of a list of numbers, or null when the list is empty so the caller must show it as unknown. */
export const median = (values: number[]) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) / 2))];
};

/** Tallies attempt rows per chart state plus the total, the shape the outcome bars draw from. */
export const counts = (rows: AttemptRow[]) => {
  const out = { pass: 0, bad: 0, run: 0, settling: 0, retry: 0, dropped: 0, unknown: 0, total: rows.length };
  for (const row of rows) out[attemptState(row)] += 1;
  return out;
};

/** Buckets rows by a string key while preserving first-seen order, used to split attempts per op or model. */
export const groupBy = <T>(rows: T[], key: (row: T) => string): Map<string, T[]> => {
  const map = new Map<string, T[]>();
  for (const row of rows) { const k = key(row); const list = map.get(k); if (list) list.push(row); else map.set(k, [row]); }
  return map;
};

/** Rounds a raw axis step fraction (1..10) up to the nearest 1, 2, 5 or 10 multiplier. */
const niceMultiplier = (frac: number): number => {
  if (frac <= 1) return 1;
  if (frac <= 2) return 2;
  if (frac <= 5) return 5;
  return 10;
};

/** Nice axis step so that max/step stays around `target` ticks. */
export const niceStep = (max: number, target = 4): number => {
  if (max <= 0) return 1;
  const raw = max / target, pow = 10 ** Math.floor(Math.log10(raw)), frac = raw / pow;
  return niceMultiplier(frac) * pow;
};

const STEPS_MS = [60e3, 2 * 60e3, 5 * 60e3, 10 * 60e3, 15 * 60e3, 30 * 60e3, 3600e3, 2 * 3600e3, 3 * 3600e3, 6 * 3600e3, 12 * 3600e3, 24 * 3600e3];
/** One time slice of the throughput chart with how many attempts were dispatched and settled inside it. */
export type Bucket = { start: number; end: number; dispatched: number; settled: number };
/** Builds the evenly sized time buckets, and the chosen step, that the throughput chart counts dispatches and settlements into. */
export const throughput = (rows: AttemptRow[], since: number, now: number, maxBuckets = 24): { step: number; buckets: Bucket[] } => {
  const times = rows.flatMap(row => [row.dispatchedAt, row.settledAt]).filter((t): t is number => t != null && t >= since);
  const from = times.length ? Math.min(...times) : since;
  const span = Math.max(now - from, 60e3);
  const step = STEPS_MS.find(s => Math.ceil(span / s) <= maxBuckets) ?? STEPS_MS.at(-1)!;
  const zoneShift = 7 * 3600e3;
  const first = Math.floor((from + zoneShift) / step) * step - zoneShift;
  const buckets: Bucket[] = [];
  for (let start = first; start <= now && buckets.length < 200; start += step) buckets.push({ start, end: start + step, dispatched: 0, settled: 0 });
  const bump = (time: number | null | undefined, key: 'dispatched' | 'settled') => {
    if (time == null || time < since) return;
    const bucket = buckets[Math.floor((time - first) / step)];
    if (bucket) bucket[key] += 1;
  };
  for (const row of rows) {
    bump(row.dispatchedAt, 'dispatched');
    if (isVerdictSettled(row)) bump(row.settledAt, 'settled');
  }
  return { step, buckets };
};

/** Tries per work unit = highest try number seen for that unit. */
export const triesPerUnit = (rows: AttemptRow[]): Map<number, number> => {
  const perUnit = new Map<string, number>();
  for (const row of rows) {
    if (!row.unit) continue;
    const key = `${row.project}\u0000${row.wf}\u0000${row.unit}`;
    if (!Number.isInteger(row.attempt) || row.attempt < 1) continue;
    perUnit.set(key, Math.max(perUnit.get(key) ?? 0, row.attempt));
  }
  const dist = new Map<number, number>();
  for (const tries of perUnit.values()) dist.set(tries, (dist.get(tries) ?? 0) + 1);
  return dist;
};
