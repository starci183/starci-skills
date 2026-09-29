import type { AttemptStep } from '../../../router';

/** "12 phút 52 giây" style duration; null when the span is unknown. */
export function formatSpan(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return '—';
  const total = Math.round(ms / 1000);
  if (total < 60) return `${total} giây`;
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  if (minutes < 60) return seconds ? `${minutes} phút ${seconds} giây` : `${minutes} phút`;
  const hours = Math.floor(minutes / 60);
  return `${hours} giờ ${minutes % 60} phút`;
}

export function formatClock(at: number | null | undefined): string {
  if (!at) return '—';
  return new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(at);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1).replace('.', ',')} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}

/** Read one `?key=` from the hash route without going through the router (which only knows `step` and `q`). */
export function hashParam(key: string): string | null {
  const hash = window.location.hash;
  const at = hash.indexOf('?');
  return at < 0 ? null : new URLSearchParams(hash.slice(at + 1)).get(key);
}

/** Set or clear a hash query param in place (no history entry, no hashchange event). */
export function setHashParam(key: string, value: string | null): void {
  const hash = window.location.hash || '#/';
  const at = hash.indexOf('?');
  const path = at < 0 ? hash : hash.slice(0, at);
  const params = new URLSearchParams(at < 0 ? '' : hash.slice(at + 1));
  if (value == null) params.delete(key); else params.set(key, value);
  const query = params.toString();
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${path}${query ? `?${query}` : ''}`);
}

export const stepAnchor = (step: AttemptStep) => `attempt-step-${step}`;

export function jsonText(value: unknown): string {
  try { return JSON.stringify(value, null, 2); } catch { return String(value); }
}
