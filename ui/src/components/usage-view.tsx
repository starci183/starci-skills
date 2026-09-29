import type { ReactNode } from 'react';
import type { Usage } from '../contract';
import type { Concept } from './concept';
import { InfoChip } from './infra/rows';

export const concept: Concept = 'C16';

const NOT_RECORDED = 'Bảng llm_usage chưa có dòng nào cho mục này: runtime chưa ghi token.';

/** Row shape shared by every grouped usage table (the server adds the v3 fields; the v2 ones stay). */
export type UsageRow = { input: number | null; output: number | null; cacheRead: number | null; cacheWrite: number | null; reasoning: number | null;
  costUsd: number | null; turns: number | null; toolCalls: number | null; toolErrors: number | null; n?: number };
export type UsageV3 = Omit<Usage, 'total'> & {
  total: (NonNullable<Usage['total']> & { toolErrors?: number }) | null;
  byOp?: (UsageRow & { op: string })[];
  rows?: (UsageRow & { id: number; subject_type: string; provider: string; requestModel: string | null; responseModel: string | null; source: string; at: number })[];
  sources?: string[];
};

const vi = (value: number, digits = 1) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: digits }).format(value);
/** Vietnamese compact numbers: 1 234 567 -> "1,2 tr", 34 500 -> "34,5 N", 2,1 tỷ. */
export function compactVi(value: number | null | undefined): string {
  if (value == null) return '—';
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${vi(value / 1e9)} tỷ`;
  if (abs >= 1e6) return `${vi(value / 1e6)} tr`;
  if (abs >= 1e3) return `${vi(value / 1e3)} N`;
  return vi(value, 0);
}
export const costVi = (value: number | null | undefined): string => value == null ? 'chưa báo' : `$${new Intl.NumberFormat('vi-VN', { minimumFractionDigits: value < 100 ? 2 : 0, maximumFractionDigits: value < 100 ? 2 : 0 }).format(value)}`;
export const sourceLabel = (source: string): string => source === 'cli-transcript' ? 'từ transcript CLI' : source === 'provider-report' ? 'nhà cung cấp báo' : source;

/** Stacked bar of input / output / cache tokens with a legend; segments use status tones, not literal colours. */
export function TokenBar({ input, output, cache }: { input: number; output: number; cache: number }) {
  const total = input + output + cache;
  if (!total) return null;
  const parts: { key: string; label: string; value: number; tone: 'running' | 'success' | 'queued' }[] = [
    { key: 'in', label: 'vào', value: input, tone: 'running' }, { key: 'out', label: 'ra', value: output, tone: 'success' }, { key: 'cache', label: 'cache', value: cache, tone: 'queued' },
  ];
  return <div>
    <div className="flex h-3 w-full gap-px overflow-hidden rounded-full bg-muted" role="img" aria-label={parts.map(p => `${p.label} ${compactVi(p.value)}`).join(', ')}>
      {parts.filter(p => p.value > 0).map(p => <span key={p.key} data-tone={p.tone} title={`${p.label}: ${vi(p.value, 0)}`} className="h-full bg-[var(--tone)]" style={{ width: `${(p.value / total) * 100}%`, minWidth: 3 }} />)}
    </div>
    <ul className="m-0 mt-2 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-[11px] text-muted-foreground">
      {parts.map(p => <li key={p.key} data-tone={p.tone} className="inline-flex items-center gap-2"><span className="status-dot" />{p.label} <strong className="font-mono text-foreground">{compactVi(p.value)}</strong> <span className="tabular-nums">({vi((p.value / total) * 100, 0)}%)</span></li>)}
    </ul>
  </div>;
}

function Sources({ sources }: { sources?: string[] }) {
  if (!sources?.length) return null;
  return <span className="inline-flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">Nguồn số liệu: {sources.map(s => <InfoChip key={s} tone={s === 'provider-report' ? 'success' : 'running'}>{sourceLabel(s)}</InfoChip>)}</span>;
}

const th = 'border-b border-border px-2 py-1 font-medium';
const td = 'px-2 py-1 font-mono tabular-nums';
const tools = (row: UsageRow) => `${compactVi(row.toolCalls)}${row.toolErrors ? ` / ${row.toolErrors} lỗi` : ''}`;
const cacheOf = (row: UsageRow) => (row.cacheRead ?? 0) + (row.cacheWrite ?? 0);

function UsageTable({ title, first, rows, label }: { title: string; first: string; rows: (UsageRow & { extra?: string })[]; label: (row: never, index: number) => ReactNode }) {
  return <div className="overflow-x-auto">
    <p className="m-0 mb-2 text-[11px] font-medium text-muted-foreground">{title}</p>
    <table className="w-full min-w-[520px] border-collapse text-xs">
      <thead><tr className="text-left text-muted-foreground">{[first, 'Vào', 'Ra', 'Cache', 'Suy luận', 'Chi phí', 'Lượt', 'Công cụ'].map(h => <th key={h} className={th}>{h}</th>)}</tr></thead>
      <tbody>{rows.map((row, index) => <tr key={index} className="border-b border-border last:border-b-0">
        <td className="px-2 py-1 font-mono [overflow-wrap:anywhere]">{label(row as never, index)}</td>
        <td className={td}>{compactVi(row.input)}</td><td className={td}>{compactVi(row.output)}</td><td className={td} title={`đọc ${vi(row.cacheRead ?? 0, 0)} · ghi ${vi(row.cacheWrite ?? 0, 0)}`}>{compactVi(cacheOf(row))}</td>
        <td className={td}>{compactVi(row.reasoning)}</td><td className={td}>{costVi(row.costUsd)}</td><td className={td}>{compactVi(row.turns)}</td><td className={td}>{tools(row)}</td>
      </tr>)}</tbody>
    </table>
  </div>;
}

/** Token / cost usage block; shows "chưa ghi nhận" honestly when llm_usage is empty. */
export function UsageView({ usage: raw, compact = false }: { usage: Usage; compact?: boolean }) {
  const usage = raw as UsageV3;
  const total = usage.recorded ? usage.total : null;
  if (!usage.recorded || !total) {
    return compact
      ? <span className="inline-flex flex-wrap items-center gap-2 text-xs"><InfoChip tone="warning">chưa ghi nhận</InfoChip><span className="text-muted-foreground">{NOT_RECORDED}</span></span>
      : <div className="flex flex-col gap-2 text-[13px]"><span><InfoChip tone="warning">chưa ghi nhận</InfoChip></span><p className="m-0 text-muted-foreground">{NOT_RECORDED}</p></div>;
  }
  const toolErrors = total.toolErrors ?? usage.byModel.reduce((sum, row) => sum + (row.toolErrors ?? 0), 0);
  if (compact) {
    return <span className="text-xs text-muted-foreground">vào {compactVi(total.input)} · ra {compactVi(total.output)} · {costVi(total.costUsd)} · {total.turns} lượt</span>;
  }
  const cells: [string, string, string?][] = [
    ['Token vào', compactVi(total.input), vi(total.input, 0)], ['Token ra', compactVi(total.output), vi(total.output, 0)],
    ['Cache đọc', compactVi(total.cacheRead), vi(total.cacheRead, 0)], ['Cache ghi', compactVi(total.cacheWrite), vi(total.cacheWrite, 0)],
    ['Suy luận', compactVi(total.reasoning), vi(total.reasoning, 0)], ['Chi phí (USD)', costVi(total.costUsd)],
    ['Lượt', compactVi(total.turns)], ['Gọi công cụ', `${compactVi(total.toolCalls)}${toolErrors ? ` · ${toolErrors} lỗi` : ''}`],
  ];
  const byOp = usage.byOp ?? [];
  const rows = usage.rows ?? [];
  return <div className="flex flex-col gap-3">
    <TokenBar input={total.input} output={total.output} cache={total.cacheRead + total.cacheWrite} />
    <dl className="m-0 grid grid-cols-2 gap-2 sm:grid-cols-4">
      {cells.map(([label, value, exact]) => <div key={label} className="min-w-0 rounded-md border border-border bg-muted/40 px-3 py-2">
        <dt className="text-[11px] text-muted-foreground">{label}</dt><dd className="m-0 truncate font-mono text-sm font-semibold" title={exact}>{value}</dd>
      </div>)}
    </dl>
    <Sources sources={usage.sources} />
    {usage.byModel.length ? <UsageTable title="Theo model" first="Model" rows={usage.byModel}
      label={((row: (typeof usage.byModel)[number] & { provider?: string }) => <>{row.model}<span className="ml-1 text-muted-foreground">{row.subject_type === 'kernel-turn' ? 'lượt Kernel' : 'lần thử'}{row.provider && row.provider !== row.model ? ` · ${row.provider}` : ''}</span></>) as never} /> : null}
    {byOp.length > 0 && (byOp.length > 1 || byOp[0].op !== 'kernel') ? <UsageTable title="Theo op (chặng)" first="Op" rows={byOp}
      label={((row: (typeof byOp)[number]) => row.op === 'kernel' ? 'Kernel (lượt điều phối)' : row.op) as never} /> : null}
    {rows.length > 1 ? <UsageTable title="Theo lượt ghi" first="Bản ghi" rows={rows}
      label={((row: (typeof rows)[number]) => <>{row.responseModel ?? row.requestModel ?? row.provider}<span className="ml-1 text-muted-foreground">{sourceLabel(row.source)}</span></>) as never} /> : null}
  </div>;
}
