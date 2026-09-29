import type { Concept } from '../concept';
export const concept: Concept = 'C16';
import type { FleetSummary } from '../../contract';
import { useApiQuery } from '../../api/query';
import { ChartCard } from './chart-card';
import { compactVi, costVi, sourceLabel, TokenBar, type UsageRow } from '../usage-view';

export type OpsMetric = { op: string; agent: string | null; model: string | null; attempts: number; tokensIn: number; tokensOut: number; costUsd: number | null };
type Group = UsageRow & { k: string };
type UsageWindow = { window: '24h' | '7d'; recorded: boolean; byModel: Group[]; byOp: Group[]; byProvider: Group[]; byDay: Group[]; sources: string[] };

const tokens = (row: UsageRow) => (row.input ?? 0) + (row.output ?? 0);
const projectOfHash = () => { try { return new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('project') ?? ''; } catch { return ''; } };
const dayLabel = (key: string) => { const [, m, d] = key.split('-'); return `${d}/${m}`; };

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return <div className="min-w-0 rounded-lg bg-muted/50 p-3"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-0.5 truncate text-xl font-semibold tabular-nums" title={hint}>{value}</div></div>;
}

/** Horizontal bars: input (blue) and output (green) per row, sorted by the server. */
function TokenRows({ title, rows, name }: { title: string; rows: Group[]; name: (k: string) => string }) {
  const max = Math.max(1, ...rows.map(tokens));
  return <div className="min-w-0">
    <h4 className="m-0 mb-1.5 text-xs font-medium text-muted-foreground">{title}</h4>
    <ul className="m-0 flex list-none flex-col gap-2 p-0">
      {rows.map(row => <li key={row.k} className="min-w-0 text-xs">
        <div className="flex flex-wrap items-baseline justify-between gap-x-2"><span className="min-w-0 max-w-full break-all font-mono" title={name(row.k)}>{name(row.k)}</span>
          <span className="shrink-0 tabular-nums text-muted-foreground">vào {compactVi(row.input)} · ra {compactVi(row.output)} · {costVi(row.costUsd)}</span></div>
        <div className="mt-1 flex h-2 overflow-hidden rounded-full bg-muted" style={{ width: `${Math.max(4, (tokens(row) / max) * 100)}%` }} role="img" aria-label={`${name(row.k)}: vào ${compactVi(row.input)}, ra ${compactVi(row.output)}`}>
          <span data-tone="running" className="h-full bg-[var(--tone)]" style={{ flex: row.input ?? 0 }} /><span data-tone="success" className="h-full bg-[var(--tone)]" style={{ flex: row.output ?? 0 }} />
        </div>
      </li>)}
    </ul>
  </div>;
}

/** Cost (or, when no cost was reported, token) per day as columns. */
function PerDay({ rows }: { rows: Group[] }) {
  const hasCost = rows.some(r => r.costUsd != null);
  const value = (r: Group) => hasCost ? (r.costUsd ?? 0) : tokens(r);
  const max = Math.max(1e-9, ...rows.map(value));
  return <div>
    <h4 className="m-0 mb-1.5 text-xs font-medium text-muted-foreground">{hasCost ? 'Chi phí theo ngày (USD, giờ Việt Nam)' : 'Token theo ngày (chưa có chi phí do nhà cung cấp báo)'}</h4>
    <div className="flex h-32 items-end gap-1.5" role="img" aria-label="Cột theo ngày">
      {rows.map(r => <div key={r.k} data-tone="running" className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`${dayLabel(r.k)}: ${hasCost ? costVi(r.costUsd) : compactVi(tokens(r))}`}>
        <span className="text-[10px] tabular-nums text-muted-foreground">{hasCost ? costVi(r.costUsd) : compactVi(tokens(r))}</span>
        <div className="w-full max-w-10 rounded-t bg-[var(--tone)]" style={{ height: `${Math.max(3, (value(r) / max) * 88)}px` }} />
        <span className="text-[10px] tabular-nums text-muted-foreground">{dayLabel(r.k)}</span>
      </div>)}
    </div>
  </div>;
}

export function UsagePanel({ metrics, window: win, summary }: { metrics: OpsMetric[] | null; window: '24h' | '7d'; summary: FleetSummary | null }) {
  const project = projectOfHash();
  const url = `/api/metrics/usage?window=${win}${project ? `&project=${encodeURIComponent(project)}` : ''}`;
  const usage = useApiQuery<UsageWindow>(url, { topics: ['fleet'], intervalMs: 30_000 }).data;
  const list = metrics ?? [];
  const legacyIn = list.reduce((s, m) => s + (m.tokensIn ?? 0), 0), legacyOut = list.reduce((s, m) => s + (m.tokensOut ?? 0), 0);
  const legacyCost = list.some(m => m.costUsd != null) ? list.reduce((s, m) => s + (m.costUsd ?? 0), 0) : null;
  const sum = (key: keyof UsageRow) => (usage?.byModel ?? []).reduce((s, r) => s + ((r[key] as number | null) ?? 0), 0);
  const fromLog = Boolean(usage?.recorded);
  const tin = fromLog ? sum('input') : legacyIn, tout = fromLog ? sum('output') : legacyOut;
  const cache = fromLog ? sum('cacheRead') + sum('cacheWrite') : 0;
  const cost = fromLog ? ((usage?.byModel ?? []).some(r => r.costUsd != null) ? sum('costUsd') : null) : legacyCost;
  const recorded = fromLog || tin + tout > 0 || (legacyCost ?? 0) > 0;
  const windowText = win === '24h' ? '24 giờ' : '7 ngày';
  return <ChartCard title="Token và chi phí" hint={`Cộng dồn trong ${windowText} qua từ bảng llm_usage: theo model, theo op và theo ngày.`} empty={false}>
    {recorded ? <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Token vào" value={compactVi(tin)} hint={String(tin)} /><Stat label="Token ra" value={compactVi(tout)} hint={String(tout)} />
        <Stat label="Cache đọc + ghi" value={fromLog ? compactVi(cache) : '—'} hint={fromLog ? String(cache) : undefined} /><Stat label="Chi phí" value={cost == null ? 'chưa báo' : costVi(cost)} />
      </div>
      <TokenBar input={tin} output={tout} cache={cache} />
      {usage?.sources?.length ? <p className="m-0 text-xs text-muted-foreground">Nguồn số liệu: {usage.sources.map(sourceLabel).join(' · ')}</p> : null}
      {fromLog ? <div className="grid gap-5 lg:grid-cols-2">
        <TokenRows title="Token theo model" rows={usage!.byModel} name={k => k ?? 'chưa rõ model'} />
        <TokenRows title="Token theo op" rows={usage!.byOp} name={k => k === 'kernel' ? 'Kernel (lượt điều phối)' : k} />
      </div> : list.length ? <p className="m-0 text-xs text-muted-foreground">Số liệu tóm tắt trên từng lần thử; chi tiết theo model và op chưa có vì llm_usage trống.</p> : null}
      {fromLog && usage!.byProvider.length > 1 ? <TokenRows title="Token theo nhà cung cấp" rows={usage!.byProvider} name={k => k} /> : null}
      {fromLog && usage!.byDay.length ? <PerDay rows={usage!.byDay} /> : null}
    </div> : <div className="rounded-lg border border-dashed p-4 text-sm"><p className="font-medium">Chưa ghi nhận</p>
      <p className="mt-1 text-muted-foreground">Chưa có lần thử nào trong khoảng này báo số token hoặc chi phí. Khi nhà cung cấp trả về, số liệu sẽ hiện ở đây.</p>
      {summary?.usage24h && !summary.usage24h.recorded ? <p className="mt-1 text-xs text-muted-foreground">Toàn hệ thống 24 giờ qua cũng chưa có bản ghi sử dụng.</p> : null}</div>}
  </ChartCard>;
}
