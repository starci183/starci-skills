import type { ReactNode } from 'react';
import { Meter, ProgressBar } from '@heroui/react';
import type { Usage } from '../contract';
import type { Concept } from './concept';
import { InfoChip } from './infra/rows';
import { t } from '../i18n/t';
import { Advanced } from './motion';
import { Table } from './ui/table';

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
  const distribution = parts.map(part => `${part.label} ${compactVi(part.value)}`).join(', ');
  return <div>
    {total != null ? <Meter value={total} maxValue={total > 0 ? total : 1} size="lg" aria-label={distribution} valueLabel={distribution}>
      <Meter.Track className="flex gap-px rounded-full">
        {total > 0 ? parts.filter(part => part.value != null && part.value > 0).map(part => <Meter.Fill key={part.key} data-tone={part.tone} title={`${part.label}: ${vi(part.value, 0)}`} style={{ flex: part.value!, position: 'relative', minWidth: 3, background: 'var(--tone)' }} />) : null}
      </Meter.Track>
    </Meter> : <ProgressBar isIndeterminate size="lg" aria-label={distribution}><ProgressBar.Track className="rounded-full" /></ProgressBar>}
    <ul className="m-0 mt-2 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-[13px] text-muted-foreground">
      {parts.map(p => <li key={p.key} data-tone={p.tone} className="inline-flex items-center gap-2"><span className="status-dot" />{p.label} <strong className="font-mono text-foreground">{compactVi(p.value)}</strong> {total != null && total > 0 ? <span className="tabular-nums">({vi((p.value! / total) * 100, 0)}%)</span> : null}</li>)}
    </ul>
  </div>;
}

function Sources({ sources }: { readonly sources?: string[] }) {
  if (!sources?.length) return null;
  return <span className="inline-flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">{t('Data sources:')} {sources.map(s => <InfoChip key={s} tone={s === 'provider-report' ? 'success' : 'running'}>{sourceLabel(s)}</InfoChip>)}</span>;
}

const td = 'font-mono tabular-nums';
const tools = (row: UsageRow) => `${compactVi(row.toolCalls)}${row.toolErrors ? t(' / {n} errors', { n: row.toolErrors }) : ''}`;
const cacheOf = (row: Pick<UsageRow, 'cacheRead' | 'cacheWrite'>) => row.cacheRead == null || row.cacheWrite == null ? null : row.cacheRead + row.cacheWrite;

const byModelLabel = (row: Usage['byModel'][number] & { provider?: string }) => <>{row.model}<span className="ml-1 text-muted-foreground">{row.subject_type === 'kernel-turn' ? t('Kernel turn') : t('attempt')}{row.provider && row.provider !== row.model ? ` · ${row.provider}` : ''}</span></>;
const byRecordLabel = (row: NonNullable<UsageV3['rows']>[number]) => <><span>{row.provider} · #{row.id}</span><span className="block text-muted-foreground">{t('Requested model')}: {row.requestModel ?? '—'}</span><span className="block text-muted-foreground">{t('Response model')}: {row.responseModel ?? '—'}</span><span className="block text-muted-foreground">{sourceLabel(row.source)}</span></>;

function UsageTable({ title, first, rows, label, getKey }: { readonly title: string; readonly first: string; readonly rows: (UsageRow & { extra?: string })[]; readonly label: (row: never, index: number) => ReactNode; readonly getKey: (row: never) => string }) {
  return <div className="min-w-0">
    <p className="m-0 mb-2 text-[13px] font-medium text-muted-foreground">{title}</p>
    <Table variant="secondary"><Table.ScrollContainer><Table.Content aria-label={title} className="min-w-[520px]">
      <Table.Header>{[["label", first], ["input", t('In')], ["output", t('Out')], ["cache", t('Cache')], ["reasoning", t('Reasoning')], ["cost", t('Cost')], ["turns", t('Turns')], ["tools", t('Tools')]].map(([id, heading], index) => <Table.Column key={id} id={id} isRowHeader={index === 0}>{heading}</Table.Column>)}</Table.Header>
      <Table.Body>{rows.map((row, index) => <Table.Row id={getKey(row as never)} key={getKey(row as never)}>
        <Table.Cell className="font-mono whitespace-normal [overflow-wrap:anywhere]">{label(row as never, index)}</Table.Cell>
        <Table.Cell className={td}>{compactVi(row.input)}</Table.Cell><Table.Cell className={td}>{compactVi(row.output)}</Table.Cell><Table.Cell className={td}><span title={t('read {read} · write {write}', { read: vi(row.cacheRead, 0), write: vi(row.cacheWrite, 0) })}>{compactVi(cacheOf(row))}</span></Table.Cell>
        <Table.Cell className={td}>{compactVi(row.reasoning)}</Table.Cell><Table.Cell className={td}><span title={row.completeness?.fields.costUsd?.complete === false ? t('Recorded part') : undefined}>{costVi(row.costUsd)}{row.costUsd != null && row.completeness?.fields.costUsd?.complete === false ? ' *' : ''}</span></Table.Cell><Table.Cell className={td}>{compactVi(row.turns)}</Table.Cell><Table.Cell className={td}>{tools(row)}</Table.Cell>
      </Table.Row>)}</Table.Body>
    </Table.Content></Table.ScrollContainer></Table>
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
    {total.completeness ? <Advanced title={t('Measurement coverage')} keepMounted className="text-xs text-muted-foreground"><dl className="m-0 grid grid-cols-2 gap-2">{Object.entries(total.completeness.fields).map(([field, coverage]) => <div key={field}><dt className="font-mono">{field}</dt><dd className="m-0">{coverage.known}/{coverage.total}</dd></div>)}</dl></Advanced> : null}
    {usage.byModel.length ? <UsageTable title={t('By model')} first="Model" rows={usage.byModel} getKey={((row: Usage['byModel'][number]) => `${row.subject_type}:${row.model}`) as never}
      label={byModelLabel as never} /> : null}
    {byOp.length > 0 && (byOp.length > 1 || byOp[0].op !== 'kernel') ? <UsageTable title={t('By op (leg)')} first="Op" rows={byOp} getKey={((row: UsageRow & { op: string }) => row.op) as never}
      label={((row: (typeof byOp)[number]) => row.op === 'kernel' ? t('Kernel (coordinator turns)') : row.op) as never} /> : null}
    {rows.length > 0 ? <UsageTable title={t('By record')} first={t('Record')} rows={rows} getKey={((row: NonNullable<UsageV3['rows']>[number]) => String(row.id)) as never}
      label={byRecordLabel as never} /> : null}
  </div>;
}
