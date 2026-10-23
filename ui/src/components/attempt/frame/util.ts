import type { AttemptStep } from '../../../router';
import { t } from '../../../i18n/t';

/** "12 min 52 sec" style duration; null when the span is unknown. */
export const formatSpan = (ms: number | null | undefined): string => {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return '—';
  const total = Math.round(ms / 1000);
  if (total < 60) return t('{n} sec', { n: total });
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  if (minutes < 60) return seconds ? t('{m} min {s} sec', { m: minutes, s: seconds }) : t('{m} min', { m: minutes });
  const hours = Math.floor(minutes / 60);
  return t('{h} h {m} min', { h: hours, m: minutes % 60 });
};

/** Wall-clock time of day in the Bangkok zone the harness reports in; a dash when the timestamp is missing. */
export const formatClock = (at: number | null | undefined): string => {
  if (!at) return '—';
  return new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(at);
};

/** Human size with a comma decimal separator (B, KB, MB) for blob and output labels. */
export const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1).replace('.', ',')} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
};

/** Read one `?key=` from the hash route without going through the router (which only knows `step` and `q`). */
export const hashParam = (key: string): string | null => {
  const hash = window.location.hash;
  const at = hash.indexOf('?');
  return at < 0 ? null : new URLSearchParams(hash.slice(at + 1)).get(key);
};

/** Set or clear a hash query param in place (no history entry, no hashchange event). */
export const setHashParam = (key: string, value: string | null): void => {
  const hash = window.location.hash || '#/';
  const at = hash.indexOf('?');
  const path = at < 0 ? hash : hash.slice(0, at);
  const params = new URLSearchParams(at < 0 ? '' : hash.slice(at + 1));
  if (value == null) params.delete(key); else params.set(key, value);
  const query = params.toString();
  const suffix = query ? `?${query}` : '';
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${path}${suffix}`);
};

/** DOM id of an attempt step section, shared by the step bar and the sections it scrolls to. */
export const stepAnchor = (step: AttemptStep) => `attempt-step-${step}`;

/** Pairs each item with a React key made of its own identity plus its occurrence number, so repeated entries (equal strings) stay distinct without keying by position. */
export const keyByOccurrence = <T>(items: readonly T[], identityOf: (item: T) => string): { key: string; item: T }[] => {
  const seen = new Map<string, number>();
  return items.map(item => {
    const identity = identityOf(item);
    const count = seen.get(identity) ?? 0;
    seen.set(identity, count + 1);
    return { key: `${identity}#${count}`, item };
  });
};

/** Pretty-printed JSON for raw-evidence panels that falls back to String() when the value cannot be serialised. */
export const jsonText = (value: unknown): string => {
  try { return JSON.stringify(value, null, 2); } catch { return String(value); }
};
