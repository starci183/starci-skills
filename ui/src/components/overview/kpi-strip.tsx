import type { FleetSummary } from '../../contract';
import type { Tone } from '../status';
import type { Concept } from '../concept';
import { compactVi, costVi } from '../usage-view';

export const concept: Concept = 'C2';

const number = (value: number) => new Intl.NumberFormat('vi-VN').format(value);

type Kpi = { tone: Tone; value: number | string; label: string; note: string; muted?: boolean };

/** Fleet summary strip: six big tabular numbers, each with a one-line explanation. */
export function KpiStrip({ summary }: { summary: FleetSummary | undefined }) {
  const usage = summary?.usage24h;
  const tokens = usage?.recorded ? usage.inputTokens + usage.outputTokens : null;
  const items: Kpi[] = summary ? [
    { tone: 'running', value: summary.opsRunning, label: 'op đang chạy', note: 'Lần thử đã giao, agent chưa báo kết quả.' },
    { tone: 'running', value: summary.opsSettling, label: 'đang chốt', note: 'Agent đã báo, đang chờ Kernel chốt.' },
    { tone: 'queued', value: summary.unitsQueued, label: 'unit đang chờ', note: 'Chưa tới lượt hoặc chờ slot, ở workflow đang chạy.' },
    { tone: 'failed', value: summary.failed24h, label: 'hỏng / chặn 24 giờ', note: 'Lần thử đã chốt với kết quả không đạt.' },
    { tone: 'success', value: summary.passed24h, label: 'đạt 24 giờ', note: 'Lần thử đã chốt với kết quả đạt.' },
    tokens != null ? { tone: 'queued', value: compactVi(tokens), label: 'Token 24 giờ', note: `vào ${compactVi(usage!.inputTokens)} · ra ${compactVi(usage!.outputTokens)} · ${costVi(usage!.costUsd)}` }
      : { tone: 'queued', value: 'chưa ghi nhận', label: 'Token 24 giờ', note: 'Runtime chưa ghi token vào llm_usage trong 24 giờ qua.', muted: true },
  ] : [];
  return <section aria-label="Số liệu toàn hệ thống" className="grid grid-cols-2 gap-3 lg:grid-cols-6">
    {summary ? items.map(item => <div key={item.label} data-tone={item.tone} className="min-w-0 rounded-xl border bg-card p-4 shadow-sm">
      <div className={item.muted ? 'text-lg font-semibold leading-tight text-muted-foreground' : 'text-3xl font-semibold tabular-nums leading-none'} style={item.muted ? undefined : { color: 'var(--tone)' }}>{typeof item.value === 'number' ? number(item.value) : item.value}</div>
      <div className="mt-2 text-sm font-medium">{item.label}</div>
      <p className="mt-1 text-xs leading-snug text-muted-foreground">{item.note}</p>
    </div>) : Array.from({ length: 6 }, (_, index) => <div key={index} className="h-28 animate-pulse rounded-xl border bg-muted/40" />)}
  </section>;
}
