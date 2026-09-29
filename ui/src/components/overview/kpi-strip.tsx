import type { FleetSummary } from '../../contract';
import type { Tone } from '../status';
import type { Concept } from '../concept';

export const concept: Concept = 'C2';

const number = (value: number) => new Intl.NumberFormat('vi-VN').format(value);

type Kpi = { tone: Tone; value: number; label: string; note: string };

/** Fleet summary strip: five big tabular numbers, each with a one-line explanation. */
export function KpiStrip({ summary }: { summary: FleetSummary | undefined }) {
  const items: Kpi[] = summary ? [
    { tone: 'running', value: summary.opsRunning, label: 'op đang chạy', note: 'Lần thử đã giao, agent chưa báo kết quả.' },
    { tone: 'running', value: summary.opsSettling, label: 'đang chốt', note: 'Agent đã báo, đang chờ Kernel chốt.' },
    { tone: 'queued', value: summary.unitsQueued, label: 'unit đang chờ', note: 'Chưa tới lượt hoặc chờ slot, ở workflow đang chạy.' },
    { tone: 'failed', value: summary.failed24h, label: 'hỏng / chặn 24 giờ', note: 'Lần thử đã chốt với kết quả không đạt.' },
    { tone: 'success', value: summary.passed24h, label: 'đạt 24 giờ', note: 'Lần thử đã chốt với kết quả đạt.' },
  ] : [];
  return <section aria-label="Số liệu toàn hệ thống" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
    {summary ? items.map(item => <div key={item.label} data-tone={item.tone} className="min-w-0 rounded-xl border bg-card p-4 shadow-sm last:col-span-2 lg:last:col-span-1">
      <div className="text-3xl font-semibold tabular-nums leading-none" style={{ color: 'var(--tone)' }}>{number(item.value)}</div>
      <div className="mt-2 text-sm font-medium">{item.label}</div>
      <p className="mt-1 text-xs leading-snug text-muted-foreground">{item.note}</p>
    </div>) : Array.from({ length: 5 }, (_, index) => <div key={index} className="h-28 animate-pulse rounded-xl border bg-muted/40" />)}
  </section>;
}
