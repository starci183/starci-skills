import type { Concept } from '../concept';
export const concept: Concept = 'C16';
import type { AttemptRow } from '../../contract';
import type { Tone } from '../status';
import { t } from '../../i18n/t';

/** Chart-level state of an attempt. `dropped` = cancelled/dropped (shown apart from red). */
export type AttemptState = 'pass' | 'bad' | 'run' | 'dropped';

export const attemptState = (row: AttemptRow): AttemptState => {
  if (row.verdict === 'pass') return 'pass';
  if (row.verdict === 'fail' || row.verdict === 'partial' || row.verdict === 'blocked') return 'bad';
  if (row.verdict === 'dropped' || row.verdict === 'cancelled') return 'dropped';
  // Ended without a verdict (refused launch, dead worker, unknown effect) is not running.
  if (row.endState === 'worker-dead') return 'bad';
  if (row.endState != null && row.endState !== 'settled') return 'dropped';
  return 'run';
};
export const stateTone: Record<AttemptState, Tone> = { pass: 'success', bad: 'failed', run: 'running', dropped: 'skipped' };
export const stateLabel: Record<AttemptState, string> = { pass: t('Passed'), bad: t('Failed/blocked'), run: t('Running'), dropped: t('Dropped') };

export const num = (value: number, digits = 1) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: digits }).format(value);
export const minutes = (ms: number) => ms / 60_000;
export const fmtMin = (min: number) => min < 1 ? t('{n} sec', { n: num(min * 60, 0) }) : t('{n} min', { n: num(min) });
const zone = 'Asia/Bangkok';
export const fmtClock = (at: number) => new Intl.DateTimeFormat('vi-VN', { timeZone: zone, hour: '2-digit', minute: '2-digit' }).format(at);
export const fmtDay = (at: number) => new Intl.DateTimeFormat('vi-VN', { timeZone: zone, day: '2-digit', month: '2-digit' }).format(at);
export const fmtDayClock = (at: number) => `${fmtDay(at)} ${fmtClock(at)}`;

export const median = (values: number[]) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) / 2))];
};

export const counts = (rows: AttemptRow[]) => {
  const out = { pass: 0, bad: 0, run: 0, dropped: 0, total: rows.length };
  for (const row of rows) out[attemptState(row)] += 1;
  return out;
};

export function groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) { const k = key(row); const list = map.get(k); if (list) list.push(row); else map.set(k, [row]); }
  return map;
}

/** Nice axis step so that max/step stays around `target` ticks. */
export function niceStep(max: number, target = 4): number {
  if (max <= 0) return 1;
  const raw = max / target, pow = 10 ** Math.floor(Math.log10(raw)), frac = raw / pow;
  return (frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10) * pow;
}

const STEPS_MS = [60e3, 2 * 60e3, 5 * 60e3, 10 * 60e3, 15 * 60e3, 30 * 60e3, 3600e3, 2 * 3600e3, 3 * 3600e3, 6 * 3600e3, 12 * 3600e3, 24 * 3600e3];
export type Bucket = { start: number; end: number; dispatched: number; settled: number };
export function throughput(rows: AttemptRow[], since: number, now: number, maxBuckets = 24): { step: number; buckets: Bucket[] } {
  const times = rows.flatMap(row => [row.dispatchedAt, row.settledAt]).filter((t): t is number => t != null && t >= since);
  const from = times.length ? Math.min(...times) : since;
  const span = Math.max(now - from, 60e3);
  const step = STEPS_MS.find(s => Math.ceil(span / s) <= maxBuckets) ?? STEPS_MS[STEPS_MS.length - 1];
  const zoneShift = 7 * 3600e3;
  const first = Math.floor((from + zoneShift) / step) * step - zoneShift;
  const buckets: Bucket[] = [];
  for (let start = first; start <= now && buckets.length < 200; start += step) buckets.push({ start, end: start + step, dispatched: 0, settled: 0 });
  const at = (t: number) => buckets[Math.floor((t - first) / step)];
  for (const row of rows) {
    if (row.dispatchedAt != null && row.dispatchedAt >= since) { const b = at(row.dispatchedAt); if (b) b.dispatched += 1; }
    if (row.settledAt != null && row.settledAt >= since) { const b = at(row.settledAt); if (b) b.settled += 1; }
  }
  return { step, buckets };
}

/** Tries per work unit = highest try number seen for that unit. */
export function triesPerUnit(rows: AttemptRow[]): Map<number, number> {
  const perUnit = new Map<string, number>();
  for (const row of rows) {
    if (!row.unit) continue;
    const key = `${row.project}\u0000${row.wf}\u0000${row.unit}`;
    perUnit.set(key, Math.max(perUnit.get(key) ?? 0, row.attempt || 1));
  }
  const dist = new Map<number, number>();
  for (const tries of perUnit.values()) dist.set(tries, (dist.get(tries) ?? 0) + 1);
  return dist;
}
