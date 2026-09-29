import type { Concept } from '../concept';
export const concept: Concept = 'C16';
import type { AttemptRow } from '../../contract';
import { toneVar, type Tone } from '../status';
import { groupBy, num, triesPerUnit } from './analytics-data';
import { ChartCard } from './chart-card';
import { useWidth } from './use-width';

const ROW = 30;
/** The ledger sometimes stores the class as a JSON object; show its `class` field. */
function failureName(raw: string): string {
  if (!raw.startsWith('{')) return raw;
  try { const parsed = JSON.parse(raw) as { class?: unknown }; return typeof parsed.class === 'string' ? parsed.class : raw; } catch { return raw; }
}
type Bar = { key: string; label: string; n: number; tone: Tone; title: string };

function Bars({ bars, width, aria }: { bars: Bar[]; width: number; aria: string }) {
  const max = Math.max(1, ...bars.map(b => b.n)), labelW = Math.min(150, width * 0.4), valueW = 36, plotW = Math.max(40, width - labelW - valueW - 10);
  const chars = Math.floor(labelW / 6.4);
  return <svg width={width} height={bars.length * ROW} role="img" aria-label={aria} className="block max-w-full">
    {bars.map((b, i) => <g key={b.key} transform={`translate(0 ${i * ROW})`}>
      <text x={0} y={ROW / 2 + 4} className="fill-foreground text-[12px]"><title>{b.label}</title>{b.label.length > chars ? `${b.label.slice(0, chars - 1)}…` : b.label}</text>
      <rect x={labelW + 6} y={6} width={Math.max(3, (b.n / max) * plotW)} height={16} rx={4} fill={toneVar(b.tone)}><title>{b.title}</title></rect>
      <text x={width} y={ROW / 2 + 4} textAnchor="end" className="fill-foreground text-[12px] font-semibold tabular-nums">{num(b.n, 0)}</text>
    </g>)}
  </svg>;
}

export function Retries({ rows }: { rows: AttemptRow[] }) {
  const [ref, width] = useWidth();
  const dist = [...triesPerUnit(rows).entries()].sort((a, b) => a[0] - b[0]);
  const tryBars: Bar[] = dist.map(([tries, n]) => ({ key: `t${tries}`, label: tries === 1 ? 'Xong ở lần 1' : `Cần ${tries} lần`, n, tone: tries === 1 ? 'success' : tries === 2 ? 'warning' : 'failed',
    title: `${n} đơn vị cần ${tries} lần thử` }));
  const classes = [...groupBy(rows.filter(r => r.failureClass), r => failureName(r.failureClass as string)).entries()].map(([k, list]) => ({ k, n: list.length })).sort((a, b) => b.n - a.n).slice(0, 6);
  const failBars: Bar[] = classes.map(c => ({ key: c.k, label: c.k, n: c.n, tone: 'failed', title: `${c.k}: ${c.n} lần thử` }));
  return <ChartCard title="Thử lại" hint="Số lần thử mỗi đơn vị cần, và các lớp lỗi hay gặp nhất."
    legend={[{ tone: 'success', label: 'Lần 1' }, { tone: 'warning', label: 'Lần 2' }, { tone: 'failed', label: 'Lần 3 trở lên / lớp lỗi' }]}
    empty={!tryBars.length && !failBars.length && 'Chưa có đơn vị nào được thử trong khoảng này.'}>
    <div ref={ref}>
      <h3 className="mb-2 text-sm font-medium">Số lần thử mỗi đơn vị</h3>
      {tryBars.length ? <Bars bars={tryBars} width={width} aria="Phân bố số lần thử mỗi đơn vị" /> : <p className="text-xs text-muted-foreground">Chưa có đơn vị nào.</p>}
      <h3 className="mb-2 mt-4 text-sm font-medium">Lớp lỗi hay gặp</h3>
      {failBars.length ? <Bars bars={failBars} width={width} aria="Các lớp lỗi hay gặp" /> : <p className="text-xs text-muted-foreground">Không có lớp lỗi nào được ghi nhận.</p>}
    </div>
  </ChartCard>;
}
