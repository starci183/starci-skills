const hm = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hour12: false });
const dhm = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

/** HH:MM in Asia/Ho_Chi_Minh. */
export const formatHm = (at: number) => hm.format(at);
/** DD/MM HH:MM:SS in Asia/Ho_Chi_Minh. */
export const formatDayTime = (at: number | null | undefined) => at == null || !Number.isFinite(at) ? '—' : dhm.format(at);

export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s} giây`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} phút${s % 60 ? ` ${s % 60} giây` : ''}`;
  const h = Math.floor(m / 60);
  return `${h} giờ ${m % 60} phút`;
}
