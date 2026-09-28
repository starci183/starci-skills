// time.mjs — the duration and timestamp spellings the reports, digests and logs share.
//
// One spelling per concept, so two findings of the same age read alike wherever they print:
//   minutes(120_000) -> 2            whole elapsed minutes, never negative (stall.mjs, owed.mjs)
//   fmtMs(86_400_000) -> '1.0d'      a compact duration for a metric or a wait (op-metrics.mjs)
//   fmtGb(2 ** 33)   -> '8 GB'       a byte count for a GC line (gc.mjs)
//   fmtAgo(at, now)  -> '12m'/'1h05' how long ago a timestamp is (status-block.mjs)
//   stampMinute(at)  -> '2026-09-28 15:30Z'   the stamp on a digest or alert head
//   stampMinuteShort -> '09-28 15:30Z'        the same stamp without the year (status-block.mjs)
//   hhmm(at)         -> '15:30Z'              a time-of-day for a log line
//   hhmmss(at)       -> '15:30:45'            the same with seconds, no zone letter (poll.mjs)

/** `ms` in whole minutes, never below 0. */
export const minutes = (ms) => Math.max(0, Math.round(ms / 60_000));

/** A duration for a human: 45s, 12m, 3.2h, 2.1d; '-' for null. */
export function fmtMs(ms) {
  if (!Number.isFinite(ms)) return '-';
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
  if (ms < 86_400_000) return `${(ms / 3_600_000).toFixed(1)}h`;
  return `${(ms / 86_400_000).toFixed(1)}d`;
}

const GB = 1024 ** 3;
/** A byte count as GB: '8.5 GB' under 10, '12 GB' above. */
export const fmtGb = (b) => `${(b / GB).toFixed(b >= 10 * GB ? 0 : 1)} GB`;

/** How long ago `ms` is against `now`: minutes under an hour, else 'HhMM'. */
export const fmtAgo = (ms, now = Date.now()) => {
  const m = minutes(now - ms);
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`;
};

/** 'YYYY-MM-DD HH:mmZ' — the stamp on a digest or alert head. */
export const stampMinute = (ms) => `${new Date(ms).toISOString().slice(0, 16).replace('T', ' ')}Z`;
/** 'MM-DD HH:mmZ' — stampMinute without the year. */
export const stampMinuteShort = (ms) => `${new Date(ms).toISOString().slice(5, 16).replace('T', ' ')}Z`;
/** 'HH:mmZ' — a time-of-day for a log line. */
export const hhmm = (ms) => `${new Date(ms).toISOString().slice(11, 16)}Z`;
/** 'HH:mm:ss' — the same with seconds, no zone letter. */
export const hhmmss = (ms) => new Date(ms).toISOString().slice(11, 19);
