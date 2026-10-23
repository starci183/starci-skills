import type { CSSProperties, ReactNode } from 'react';
import { Meter, ProgressBar } from '@heroui/react';
import type { Usage } from '../contract';
import type { Concept } from './concept';
import { InfoChip } from './infra/rows';
import { t } from '../i18n/t';
import { Advanced } from './motion';
import { Table } from './ui/table';

/** The business concept id (C16) under which the token and cost usage view is filed; it is stamped on data-concept so the rendered DOM traces back to its spec. */
export const concept: Concept = 'C16';

const NOT_RECORDED = t('The llm_usage table has no rows for this section yet: the runtime has not recorded tokens.');

/** Row shape shared by every grouped usage table (the server adds the v3 fields; the v2 ones stay). */
export type UsageRow = { input: number | null; output: number | null; cacheRead: number | null; cacheWrite: number | null; reasoning: number | null;
  costUsd: number | null; turns: number | null; toolCalls: number | null; toolErrors: number | null; n?: number;
  completeness?: { rows: number; fields: Record<string, { known: number; total: number; complete: boolean }>; complete: boolean } };
/** The usage payload as the server sends it today: the contract's usage plus per-op and per-record breakdowns and the data sources. */
export type UsageV3 = Omit<Usage, 'total'> & {
  total: (NonNullable<Usage['total']> & Pick<UsageRow, 'completeness'> & { toolErrors?: number | null }) | null;
  byOp?: (UsageRow & { op: string })[];
  rows?: (UsageRow & { id: number; subject_type: string; provider: string; requestModel: string | null; responseModel: string | null; source: string; at: number })[];
  sources?: string[];
};

const vi = (value: number | null | undefined, digits = 1) => value == null || !Number.isFinite(value) ? '—' : new Intl.NumberFormat('vi-VN', { maximumFractionDigits: digits }).format(value);
/** Compact vi-VN numbers: 1 234 567 -> "1,2M", 34 500 -> "34,5k" (Vietnamese suffixes via the i18n catalog). */
export const compactVi = (value: number | null | undefined): string => {
  if (value == null || !Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  if (abs >= 1e9) return t('{n}B', { n: vi(value / 1e9) });
  if (abs >= 1e6) return t('{n}M', { n: vi(value / 1e6) });
  if (abs >= 1e3) return t('{n}k', { n: vi(value / 1e3) });
  return vi(value, 0);
};
/** A dollar cost in vi-VN formatting (cents below $100), or "not reported" when the runtime recorded none. */
export const costVi = (value: number | null | undefined): string => value == null || !Number.isFinite(value) ? t('not reported') : `$${new Intl.NumberFormat('vi-VN', { minimumFractionDigits: value < 100 ? 2 : 0, maximumFractionDigits: value < 100 ? 2 : 0 }).format(value)}`;
/** The translated phrase for where a usage figure was read from, falling back to the raw source name. */
export const sourceLabel = (source: string): string => {
  if (source === 'cli-transcript') return t('from the CLI transcript');
  if (source === 'provider-report') return t('reported by the provider');
  return source;
};

type TokenPart = { key: string; label: string; value: number | null; tone: 'running' | 'success' | 'queued' };
type TokenBarProps = { readonly input: number | null; readonly output: number | null; readonly cache: number | null; readonly complete?: boolean };

const isMeasured = (value: number | null): value is number => value != null && Number.isFinite(value) && value >= 0;

/** A bar segment that takes a share of the track proportional to its token count. */
const fillStyle = (tokens: number): CSSProperties => ({ flex: tokens, position: 'relative', minWidth: 3, background: 'var(--tone)' });

/** Stacked bar of input / output / cache tokens with a legend; segments use status tones, not literal colours. */
export const TokenBar = ({ input, output, cache, complete: measurementsComplete = true }: TokenBarProps) => {
  const total = measurementsComplete && isMeasured(input) && isMeasured(output) && isMeasured(cache) ? input + output + cache : null;
  const parts: TokenPart[] = [
    { key: 'in', label: t('in'), value: input, tone: 'running' }, { key: 'out', label: t('out'), value: output, tone: 'success' }, { key: 'cache', label: 'cache', value: cache, tone: 'queued' },
  ];
  const fills = parts.flatMap(part => part.value != null && part.value > 0 ? [{ ...part, tokens: part.value, style: fillStyle(part.value) }] : []);
  const distribution = parts.map(part => `${part.label} ${compactVi(part.value)}`).join(', ');
  return <div>
    {total != null ? <Meter value={total} maxValue={total > 0 ? total : 1} size="lg" aria-label={distribution} valueLabel={distribution}>
      <Meter.Track className="flex gap-px rounded-full">
        {total > 0 ? fills.map(part => <Meter.Fill key={part.key} data-tone={part.tone} title={`${part.label}: ${vi(part.tokens, 0)}`} style={part.style} />) : null}
      </Meter.Track>
    </Meter> : <ProgressBar isIndeterminate size="lg" aria-label={distribution}><ProgressBar.Track className="rounded-full" /></ProgressBar>}
    <ul className="m-0 mt-2 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-[13px] text-muted-foreground">
      {parts.map(p => <li key={p.key} data-tone={p.tone} className="inline-flex items-center gap-2"><span className="status-dot" />{p.label} <strong className="font-mono text-foreground">{compactVi(p.value)}</strong> {total != null && total > 0 && p.value != null ? <span className="tabular-nums">({vi((p.value / total) * 100, 0)}%)</span> : null}</li>)}
    </ul>
  </div>;
};

type SourcesProps = { readonly sources: readonly string[] | undefined };

const Sources = ({ sources }: SourcesProps) => {
  if (!sources?.length) return null;
  return <span className="inline-flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">{t('Data sources:')} {sources.map(s => <InfoChip key={s} tone={s === 'provider-report' ? 'success' : 'running'}>{sourceLabel(s)}</InfoChip>)}</span>;
};

const td = 'font-mono tabular-nums';
const tools = (row: UsageRow) => `${compactVi(row.toolCalls)}${row.toolErrors ? t(' / {n} errors', { n: row.toolErrors }) : ''}`;
const cacheOf = (row: Pick<UsageRow, 'cacheRead' | 'cacheWrite'>) => row.cacheRead == null || row.cacheWrite == null ? null : row.cacheRead + row.cacheWrite;

type ModelUsageRow = Usage['byModel'][number] & { provider?: string };
type OpUsageRow = UsageRow & { op: string };
type RecordUsageRow = NonNullable<UsageV3['rows']>[number];

const byModelLabel = (row: ModelUsageRow) => <>{row.model}<span className="ml-1 text-muted-foreground">{row.subject_type === 'kernel-turn' ? t('Kernel turn') : t('attempt')}{row.provider && row.provider !== row.model ? ` · ${row.provider}` : ''}</span></>;
const byOpLabel = (row: OpUsageRow) => (row.op === 'kernel' ? t('Kernel (coordinator turns)') : row.op);
const byRecordLabel = (row: RecordUsageRow) => <><span>{row.provider} · #{row.id}</span><span className="block text-muted-foreground">{t('Requested model')}: {row.requestModel ?? '—'}</span><span className="block text-muted-foreground">{t('Response model')}: {row.responseModel ?? '—'}</span><span className="block text-muted-foreground">{sourceLabel(row.source)}</span></>;

type UsageTableProps<T extends UsageRow> = {
  readonly title: string; readonly first: string; readonly rows: readonly T[]; readonly label: (row: T) => ReactNode; readonly getKey: (row: T) => string;
};

const UsageTable = <T extends UsageRow>({ title, first, rows, label, getKey }: UsageTableProps<T>) => {
  const columns = [{ id: 'label', heading: first }, { id: 'input', heading: t('In') }, { id: 'output', heading: t('Out') }, { id: 'cache', heading: t('Cache') },
    { id: 'reasoning', heading: t('Reasoning') }, { id: 'cost', heading: t('Cost') }, { id: 'turns', heading: t('Turns') }, { id: 'tools', heading: t('Tools') }];
  return <div className="min-w-0">
    <p className="m-0 mb-2 text-[13px] font-medium text-muted-foreground">{title}</p>
    <Table variant="secondary"><Table.ScrollContainer><Table.Content aria-label={title} className="min-w-[520px]">
      <Table.Header>{columns.map(({ id, heading }, index) => <Table.Column key={id} id={id} isRowHeader={index === 0}>{heading}</Table.Column>)}</Table.Header>
      <Table.Body>{rows.map(row => <Table.Row id={getKey(row)} key={getKey(row)}>
        <Table.Cell className="font-mono whitespace-normal [overflow-wrap:anywhere]">{label(row)}</Table.Cell>
        <Table.Cell className={td}>{compactVi(row.input)}</Table.Cell><Table.Cell className={td}>{compactVi(row.output)}</Table.Cell><Table.Cell className={td}><span title={t('read {read} · write {write}', { read: vi(row.cacheRead, 0), write: vi(row.cacheWrite, 0) })}>{compactVi(cacheOf(row))}</span></Table.Cell>
        <Table.Cell className={td}>{compactVi(row.reasoning)}</Table.Cell><Table.Cell className={td}><span title={row.completeness?.fields.costUsd?.complete === false ? t('Recorded part') : undefined}>{costVi(row.costUsd)}{row.costUsd != null && row.completeness?.fields.costUsd?.complete === false ? ' *' : ''}</span></Table.Cell><Table.Cell className={td}>{compactVi(row.turns)}</Table.Cell><Table.Cell className={td}>{tools(row)}</Table.Cell>
      </Table.Row>)}</Table.Body>
    </Table.Content></Table.ScrollContainer></Table>
  </div>;
};

type UsageViewProps = { readonly usage: Usage; readonly compact?: boolean };

/** Token / cost usage block; shows "not recorded" honestly when llm_usage is empty. */
export const UsageView = ({ usage: raw, compact = false }: UsageViewProps) => {
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
  const modelRows: ModelUsageRow[] = usage.byModel;
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
    {usage.byModel.length ? <UsageTable title={t('By model')} first="Model" rows={modelRows} getKey={row => `${row.subject_type}:${row.model}`} label={byModelLabel} /> : null}
    {byOp.length > 0 && (byOp.length > 1 || byOp[0]?.op !== 'kernel') ? <UsageTable title={t('By op (leg)')} first="Op" rows={byOp} getKey={row => row.op} label={byOpLabel} /> : null}
    {rows.length > 0 ? <UsageTable title={t('By record')} first={t('Record')} rows={rows} getKey={row => String(row.id)} label={byRecordLabel} /> : null}
  </div>;
};
