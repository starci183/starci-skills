import type { FleetSummary } from '../../contract';
import type { Tone } from '../status';
import type { Concept } from '../concept';
import { compactVi, costVi } from '../usage-view';
import { Stagger, StaggerItem, Ticker } from '../motion';

export const concept: Concept = 'C2';

type Kpi = { tone: Tone; value: number; label: string; note: string };

/** Essentials: four big numbers (ops running, workflows needing attention, passed / failed in 24 h) that count up on first view. */
export function KpiStrip({ summary, needsAttention }: { summary: FleetSummary | undefined; needsAttention: number | undefined }) {
  const items: Kpi[] = summary ? [
    { tone: 'running', value: summary.opsRunning, label: 'op đang chạy', note: 'Lần thử đã giao, agent chưa báo kết quả.' },
    { tone: 'failed', value: needsAttention ?? 0, label: 'workflow cần xử lý', note: 'Workflow đang kẹt hoặc chậm, cần người xem.' },
    { tone: 'success', value: summary.passed24h, label: 'đạt 24 giờ', note: 'Lần thử đã chốt với kết quả đạt.' },
    { tone: 'failed', value: summary.failed24h, label: 'hỏng / chặn 24 giờ', note: 'Lần thử đã chốt với kết quả không đạt.' },
  ] : [];
  if (!summary) return <section aria-label="Số liệu toàn hệ thống" className="kpi-strip grid grid-cols-2 lg:grid-cols-4">
    {Array.from({ length: 4 }, (_, index) => <div key={index} className="kpi-cell"><div className="h-8 w-12 rounded bg-muted" /><div className="mt-3 h-4 w-24 rounded bg-muted" /><div className="mt-2 h-3 w-full rounded bg-muted" /></div>)}
  </section>;
  return <Stagger className="kpi-strip grid grid-cols-2 lg:grid-cols-4">
    {items.map(item => <StaggerItem key={item.label} className="kpi-cell min-w-0"><div data-tone={item.tone} className="flex h-full min-w-0 flex-col gap-1" aria-label={item.label}>
      <div className="text-3xl font-semibold tabular-nums leading-none"><Ticker value={item.value} /></div>
      <div className="mt-2 flex items-center gap-2 text-sm font-medium"><span className="status-dot" aria-hidden="true" />{item.label}</div>
      <p className="text-xs leading-snug text-muted-foreground">{item.note}</p>
    </div></StaggerItem>)}
  </Stagger>;
}

/** Secondary numbers (settling ops, queued units, 24 h tokens) shown inside "Nâng cao". */
export function KpiExtras({ summary }: { summary: FleetSummary | undefined }) {
  if (!summary) return null;
  const usage = summary.usage24h;
  const tokens = usage.recorded ? usage.inputTokens + usage.outputTokens : null;
  const number = (value: number) => new Intl.NumberFormat('vi-VN').format(value);
  const items = [
    { label: 'đang chốt', value: number(summary.opsSettling), note: 'Agent đã báo, đang chờ Kernel chốt.' },
    { label: 'unit đang chờ', value: number(summary.unitsQueued), note: 'Chưa tới lượt hoặc chờ slot, ở workflow đang chạy.' },
    tokens != null ? { label: 'Token 24 giờ', value: compactVi(tokens), note: `vào ${compactVi(usage.inputTokens)} · ra ${compactVi(usage.outputTokens)} · ${costVi(usage.costUsd)}` }
      : { label: 'Token 24 giờ', value: 'chưa ghi nhận', note: 'Runtime chưa ghi token vào llm_usage trong 24 giờ qua.' },
  ];
  return <dl className="grid gap-3 sm:grid-cols-3">{items.map(item => <div key={item.label} className="flex min-w-0 flex-col gap-1 p-3">
    <dt className="text-xs text-muted-foreground">{item.label}</dt><dd className="text-lg font-semibold tabular-nums leading-tight">{item.value}</dd><p className="text-xs leading-snug text-muted-foreground">{item.note}</p>
  </div>)}</dl>;
}
