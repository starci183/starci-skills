import type { Concept } from '../concept';
export const concept: Concept = 'C16';
import type { FleetSummary } from '../../contract';
import { ChartCard } from './chart-card';
import { num } from './analytics-data';

export type OpsMetric = { op: string; agent: string | null; model: string | null; attempts: number; tokensIn: number; tokensOut: number; costUsd: number | null };

const compact = (n: number) => new Intl.NumberFormat('vi-VN', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
const usd = (n: number) => `$${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(n)}`;

export function UsagePanel({ metrics, window, summary }: { metrics: OpsMetric[] | null; window: '24h' | '7d'; summary: FleetSummary | null }) {
  const list = metrics ?? [];
  const tin = list.reduce((s, m) => s + (m.tokensIn ?? 0), 0), tout = list.reduce((s, m) => s + (m.tokensOut ?? 0), 0);
  const cost = list.some(m => m.costUsd != null) ? list.reduce((s, m) => s + (m.costUsd ?? 0), 0) : null;
  const recorded = tin + tout > 0 || (cost ?? 0) > 0;
  const byModel = [...new Map(list.map(m => [m.model ?? 'chưa rõ mô hình', 0])).keys()].map(model => {
    const own = list.filter(m => (m.model ?? 'chưa rõ mô hình') === model);
    return { model, tin: own.reduce((s, m) => s + m.tokensIn, 0), tout: own.reduce((s, m) => s + m.tokensOut, 0), cost: own.some(m => m.costUsd != null) ? own.reduce((s, m) => s + (m.costUsd ?? 0), 0) : null };
  }).filter(m => m.tin + m.tout > 0 || m.cost).sort((a, b) => b.tin + b.tout - (a.tin + a.tout));
  const stat = (label: string, value: string) => <div className="rounded-lg bg-muted/50 p-3"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-0.5 text-xl font-semibold tabular-nums">{value}</div></div>;
  return <ChartCard title="Token và chi phí" hint={`Cộng dồn từ các lần thử trong ${window === '24h' ? '24 giờ' : '7 ngày'} qua, theo số liệu nhà cung cấp trả về.`}
    empty={false}>
    {recorded ? <>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">{stat('Token vào', compact(tin))}{stat('Token ra', compact(tout))}{stat('Chi phí', cost == null ? 'chưa ghi nhận' : usd(cost))}</div>
      {byModel.length ? <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[420px] text-sm"><thead><tr className="text-left text-xs text-muted-foreground"><th className="py-1 pr-3 font-medium">Mô hình</th><th className="py-1 pr-3 text-right font-medium">Token vào</th><th className="py-1 pr-3 text-right font-medium">Token ra</th><th className="py-1 text-right font-medium">Chi phí</th></tr></thead>
        <tbody>{byModel.map(m => <tr key={m.model} className="border-t"><td className="py-1.5 pr-3 font-mono text-xs">{m.model}</td><td className="py-1.5 pr-3 text-right tabular-nums">{num(m.tin, 0)}</td><td className="py-1.5 pr-3 text-right tabular-nums">{num(m.tout, 0)}</td><td className="py-1.5 text-right tabular-nums">{m.cost == null ? '—' : usd(m.cost)}</td></tr>)}</tbody></table></div> : null}
    </> : <div className="rounded-lg border border-dashed p-4 text-sm"><p className="font-medium">Chưa ghi nhận</p>
      <p className="mt-1 text-muted-foreground">Chưa có lần thử nào trong khoảng này báo số token hoặc chi phí. Khi nhà cung cấp trả về, số liệu sẽ hiện ở đây.</p>
      {summary?.usage24h && !summary.usage24h.recorded ? <p className="mt-1 text-xs text-muted-foreground">Toàn hệ thống 24 giờ qua cũng chưa có bản ghi sử dụng.</p> : null}</div>}
  </ChartCard>;
}
