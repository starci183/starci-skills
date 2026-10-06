import type { ReactNode } from 'react';
import type { Usage } from '../contract';
import type { Concept } from './concept';
import { InfoChip } from './infra/rows';
import { t } from '../i18n/t';

export const concept: Concept = 'C16';

const NOT_RECORDED = t('The llm_usage table has no rows for this section yet: the runtime has not recorded tokens.');

/** Row shape shared by every grouped usage table (the server adds the v3 fields; the v2 ones stay). */
export type UsageRow = { input: number | null; output: number | null; cacheRead: number | null; cacheWrite: number | null; reasoning: number | null;
  costUsd: number | null; turns: number | null; toolCalls: number | null; toolErrors: number | null; n?: number;
  completeness?: { rows: number; fields: Record<string, { known: number; total: number; complete: boolean }>; complete: boolean } };
export type UsageV3 = Omit<Usage, 'total'> & {
  total: (NonNullable<Usage['total']> & Pick<UsageRow, 'completeness'> & { toolErrors?: number | null }) | null;
  byOp?: (UsageRow & { op: string })[];
  rows?: (UsageRow & { id: number; subject_type: string; provider: string; requestModel: string | null; responseModel: string | null; source: string; at: number })[];
  sources?: string[];
};

const vi = (value: number | null | undefined, digits = 1) => value == null || !Number.isFinite(value) ? '—' : new Intl.NumberFormat('vi-VN', { maximumFractionDigits: digits }).format(value);
/** Compact vi-VN numbers: 1 234 567 -> "1,2M", 34 500 -> "34,5k" (Vietnamese suffixes via the i18n catalog). */
export function compactVi(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  if (abs >= 1e9) return t('{n}B', { n: vi(value / 1e9) });
  if (abs >= 1e6) return t('{n}M', { n: vi(value / 1e6) });
  if (abs >= 1e3) return t('{n}k', { n: vi(value / 1e3) });
  return vi(value, 0);
}
export const costVi = (value: number | null | undefined): string => value == null || !Number.isFinite(value) ? t('not reported') : `$${new Intl.NumberFormat('vi-VN', { minimumFractionDigits: value < 100 ? 2 : 0, maximumFractionDigits: value < 100 ? 2 : 0 }).format(value)}`;
export const sourceLabel = (source: string): string => source === 'cli-transcript' ? t('from the CLI transcript') : source === 'provider-report' ? t('reported by the provider') : source;

/** Stacked bar of input / output / cache tokens with a legend; segments use status tones, not literal colours. */
export function TokenBar({ input, output, cache, complete: measurementsComplete = true }: { readonly input: number | null; readonly output: number | null; readonly cache: number | null; readonly complete?: boolean }) {
  const complete = measurementsComplete && [input, output, cache].every(value => value != null && Number.isFinite(value) && value >= 0);
  const total = complete ? input! + output! + cache! : null;
  const parts: { key: string; label: string; value: number | null; tone: 'running' | 'success' | 'queued' }[] = [
    { key: 'in', label: t('in'), value: input, tone: 'running' }, { key: 'out', label: t('out'), value: output, tone: 'success' }, { key: 'cache', label: 'cache', value: cache, tone: 'queued' },
  ];
  return <div>
    <div className="flex h-3 w-full gap-px overflow-hidden rounded-full bg-muted" role="img" aria-label={parts.map(p => `${p.label} ${compactVi(p.value)}`).join(', ')}>
      {total != null && total > 0 ? parts.filter(p => p.value != null && p.value > 0).map(p => <span key={p.key} data-tone={p.tone} title={`${p.label}: ${vi(p.value, 0)}`} className="h-full bg-[var(--tone)]" style={{ width: `${(p.value! / total) * 100}%`, minWidth: 3 }} />) : null}
    </div>
    <ul className="m-0 mt-2 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-[11px] text-muted-foreground">
      {parts.map(p => <li key={p.key} data-tone={p.tone} className="inline-flex items-center gap-2"><span className="status-dot" />{p.label} <strong className="font-mono text-foreground">{compactVi(p.value)}</strong> {total != null && total > 0 ? <span className="tabular-nums">({vi((p.value! / total) * 100, 0)}%)</span> : null}</li>)}
    </ul>
  </div>;
}

function Sources({ sources }: { readonly sources?: string[] }) {
  if (!sources?.length) return null;
  return <span className="inline-flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">{t('Data sources:')} {sources.map(s => <InfoChip key={s} tone={s === 'provider-report' ? 'success' : 'running'}>{sourceLabel(s)}</InfoChip>)}</span>;
}

const th = 'border-b border-border px-2 py-1 font-medium';
const td = 'px-2 py-1 font-mono tabular-nums';
const tools = (row: UsageRow) => `${compactVi(row.toolCalls)}${row.toolErrors ? t(' / {n} errors', { n: row.toolErrors }) : ''}`;
const cacheOf = (row: Pick<UsageRow, 'cacheRead' | 'cacheWrite'>) => row.cacheRead == null || row.cacheWrite == null ? null : row.cacheRead + row.cacheWrite;

const byModelLabel = (row: Usage['byModel'][number] & { provider?: string }) => <>{row.model}<span className="ml-1 text-muted-foreground">{row.subject_type === 'kernel-turn' ? t('Kernel turn') : t('attempt')}{row.provider && row.provider !== row.model ? ` · ${row.provider}` : ''}</span></>;
const byRecordLabel = (row: NonNullable<UsageV3['rows']>[number]) => <><span>{row.provider} · #{row.id}</span><span className="block text-muted-foreground">{t('Requested model')}: {row.requestModel ?? '—'}</span><span className="block text-muted-foreground">{t('Response model')}: {row.responseModel ?? '—'}</span><span className="block text-muted-foreground">{sourceLabel(row.source)}</span></>;

function UsageTable({ title, first, rows, label, getKey }: { readonly title: string; readonly first: string; readonly rows: (UsageRow & { extra?: string })[]; readonly label: (row: never, index: number) => ReactNode; readonly getKey: (row: never) => string }) {
  return <div className="overflow-x-auto">
    <p className="m-0 mb-2 text-[11px] font-medium text-muted-foreground">{title}</p>
    <table className="w-full min-w-[520px] border-collapse text-xs">
      <thead><tr className="text-left text-muted-foreground">{[first, t('In'), t('Out'), t('Cache'), t('Reasoning'), t('Cost'), t('Turns'), t('Tools')].map(h => <th key={h} className={th}>{h}</th>)}</tr></thead>
      <tbody>{rows.map((row, index) => <tr key={getKey(row as never)} className="border-b border-border last:border-b-0">
        <td className="px-2 py-1 font-mono [overflow-wrap:anywhere]">{label(row as never, index)}</td>
        <td className={td}>{compactVi(row.input)}</td><td className={td}>{compactVi(row.output)}</td><td className={td} title={t('read {read} · write {write}', { read: vi(row.cacheRead, 0), write: vi(row.cacheWrite, 0) })}>{compactVi(cacheOf(row))}</td>
        <td className={td}>{compactVi(row.reasoning)}</td><td className={td} title={row.completeness?.fields.costUsd?.complete === false ? t('Recorded part') : undefined}>{costVi(row.costUsd)}{row.costUsd != null && row.completeness?.fields.costUsd?.complete === false ? ' *' : ''}</td><td className={td}>{compactVi(row.turns)}</td><td className={td}>{tools(row)}</td>
      </tr>)}</tbody>
    </table>
  </div>;
}

/** Token / cost usage block; shows "not recorded" honestly when llm_usage is empty. */
export function UsageView({ usage: raw, compact = false }: { readonly usage: Usage; readonly compact?: boolean }) {
  const usage = raw as UsageV3;
  const total = usage.recorded ? usage.total : null;
  if (!usage.recorded || !total) {
    return compact
      ? <span className="inline-flex flex-wrap items-center gap-2 text-xs"><InfoChip tone="warning">{t('not recorded')}</InfoChip><span className="text-muted-foreground">{NOT_RECORDED}</span></span>
      : <div className="flex flex-col gap-2 text-[13px]"><span><InfoChip tone="warning">{t('not recorded')}</InfoChip></span><p className="m-0 text-muted-foreground">{NOT_RECORDED}</p></div>;
  }
  const toolErrors = total.toolErrors;
  const incomplete = total.completeness != null && !total.completeness.complete;
  if (compact) {
    return <span className="text-xs text-muted-foreground">{incomplete ? `${t('Recorded part')} · ` : ''}{t('in {input} · out {output} · {cost} · {turns} turns', { input: compactVi(total.input), output: compactVi(total.output), cost: costVi(total.costUsd), turns: compactVi(total.turns) })}</span>;
  }
  const cells: [string, string, string?][] = [
    [t('Input tokens'), compactVi(total.input), vi(total.input, 0)], [t('Output tokens'), compactVi(total.output), vi(total.output, 0)],
    [t('Cache read'), compactVi(total.cacheRead), vi(total.cacheRead, 0)], [t('Cache write'), compactVi(total.cacheWrite), vi(total.cacheWrite, 0)],
    [t('Reasoning'), compactVi(total.reasoning), vi(total.reasoning, 0)], [t('Cost (USD)'), costVi(total.costUsd)],
    [t('Turns'), compactVi(total.turns)], [t('Tool calls'), `${compactVi(total.toolCalls)}${toolErrors ? t(' · {n} errors', { n: toolErrors }) : ''}`],
  ];
  const byOp = usage.byOp ?? [];
  const rows = usage.rows ?? [];
  return <div className="flex flex-col gap-3">
    {incomplete ? <p className="m-0 text-xs text-muted-foreground">{t('Totals show the recorded part; some measurements are missing.')}</p> : null}
    <TokenBar input={total.input} output={total.output} cache={cacheOf(total)} complete={!incomplete} />
    <dl className="m-0 grid grid-cols-2 gap-2 sm:grid-cols-4">
      {cells.map(([label, value, exact]) => <div key={label} className="min-w-0 px-3 py-2">
        <dt className="text-xs text-muted-foreground">{label}</dt><dd className="m-0 truncate text-sm font-semibold tabular-nums" title={exact}>{value}</dd>
      </div>)}
    </dl>
    <Sources sources={usage.sources} />
    {total.completeness ? <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">{t('Measurement coverage')}</summary><dl className="mt-2 grid grid-cols-2 gap-2">{Object.entries(total.completeness.fields).map(([field, coverage]) => <div key={field}><dt className="font-mono">{field}</dt><dd className="m-0">{coverage.known}/{coverage.total}</dd></div>)}</dl></details> : null}
    {usage.byModel.length ? <UsageTable title={t('By model')} first="Model" rows={usage.byModel} getKey={((row: Usage['byModel'][number]) => `${row.subject_type}:${row.model}`) as never}
      label={byModelLabel as never} /> : null}
    {byOp.length > 0 && (byOp.length > 1 || byOp[0].op !== 'kernel') ? <UsageTable title={t('By op (leg)')} first="Op" rows={byOp} getKey={((row: UsageRow & { op: string }) => row.op) as never}
      label={((row: (typeof byOp)[number]) => row.op === 'kernel' ? t('Kernel (coordinator turns)') : row.op) as never} /> : null}
    {rows.length > 0 ? <UsageTable title={t('By record')} first={t('Record')} rows={rows} getKey={((row: NonNullable<UsageV3['rows']>[number]) => String(row.id)) as never}
      label={byRecordLabel as never} /> : null}
  </div>;
}
