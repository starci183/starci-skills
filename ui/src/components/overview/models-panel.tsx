import type { FleetSummary } from '../../contract';
import type { Concept } from '../concept';

export const concept: Concept = 'C2';

const number = (value: number) => new Intl.NumberFormat('vi-VN').format(value);

/** Running ops per model as bars, plus 24 h token usage. */
export function ModelsPanel({ summary }: { summary: FleetSummary | undefined }) {
  if (!summary) return <p className="p-4 text-sm text-muted-foreground">Đang đọc…</p>;
  const max = Math.max(1, ...summary.models.map(item => item.running));
  const usage = summary.usage24h;
  return <div className="space-y-4 p-4">
    {summary.models.length ? <ul className="space-y-3">
      {summary.models.map((item, index) => <li key={`${item.model ?? item.pool ?? 'unknown'}-${index}`} data-tone="running">
        <div className="flex items-baseline justify-between gap-2 text-sm"><span className="min-w-0 truncate font-medium">{item.model ?? item.pool ?? 'Chưa rõ mô hình'}</span><span className="tabular-nums">{item.running} op</span></div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${(item.running / max) * 100}%`, background: 'var(--tone)' }} /></div>
        <p className="mt-1 truncate text-xs text-muted-foreground">{[item.agent, item.pool].filter(Boolean).join(' · ') || 'agent chưa rõ'}</p>
      </li>)}
    </ul> : <p className="text-sm text-muted-foreground">Không có op nào đang chạy.</p>}
    <div className="border-t pt-3">
      <p className="text-xs font-medium text-muted-foreground">Token 24 giờ</p>
      {usage.recorded ? <p className="mt-1 text-sm tabular-nums">vào {number(usage.inputTokens)} · ra {number(usage.outputTokens)}{usage.costUsd != null ? ` · $${usage.costUsd.toFixed(2)}` : ''}</p>
        : <p className="mt-1 text-sm text-muted-foreground">chưa ghi nhận</p>}
    </div>
  </div>;
}
