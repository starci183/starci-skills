import type { Concept } from '../concept';
export const concept: Concept = 'C16';
import { Card, Meter, ProgressBar } from '@heroui/react';
import { useApiQuery } from '../../api/query';
import { ChartCard, ReadQuality, partialSources } from './chart-card';
import { compactVi, costVi, sourceLabel, TokenBar, type UsageRow } from '../usage-view';
import { t } from '../../i18n/t';
import { FeedbackState } from '../feedback-state';

type Group = UsageRow & { k: string };
type UsageWindow = { window: '24h' | '7d'; recorded: boolean; byModel: Group[]; byOp: Group[]; byProvider: Group[]; byDay: Group[]; sources: string[] };

const tokens = (row: UsageRow) => (row.input ?? 0) + (row.output ?? 0);
const dayLabel = (key: string) => { const [, m, d] = key.split('-'); return `${d}/${m}`; };

function Stat({ label, value, hint }: Readonly<{ label: string; value: string; hint?: string }>) {
  return <Card variant="transparent" className="min-w-0"><Card.Header><Card.Description className="text-[13px]">{label}</Card.Description></Card.Header><Card.Content><p className="truncate text-xl font-semibold tabular-nums" title={hint}>{value}</p></Card.Content></Card>;
}

/** Horizontal bars: input (blue) and output (green) per row, sorted by the server. */
function TokenRows({ title, rows, name }: Readonly<{ title: string; rows: Group[]; name: (k: string) => string }>) {
  const max = Math.max(1, ...rows.map(tokens));
  return <div className="min-w-0">
    <h4 className="m-0 mb-2 text-[13px] font-medium text-muted-foreground">{title}</h4>
    <ul className="m-0 flex list-none flex-col gap-2 p-0">
      {rows.map(row => <li key={row.k} className="min-w-0 text-[13px]">
        <div className="flex flex-wrap items-baseline justify-between gap-x-2"><span className="min-w-0 max-w-full break-all font-mono" title={name(row.k)}>{name(row.k)}</span>
          <span className="shrink-0 tabular-nums text-muted-foreground">{t('in {input} · out {output} · {cost}', { input: compactVi(row.input), output: compactVi(row.output), cost: costVi(row.costUsd) })}</span></div>
        {row.input != null && row.output != null ? <Meter className="mt-1" value={tokens(row)} minValue={0} maxValue={max}
          aria-label={t('{name}: in {input}, out {output}', { name: name(row.k), input: compactVi(row.input), output: compactVi(row.output) })}
          valueLabel={t('in {input} · out {output} · {cost}', { input: compactVi(row.input), output: compactVi(row.output), cost: costVi(row.costUsd) })}>
          <Meter.Track>{tokens(row) > 0 && <Meter.Fill style={{ background: 'transparent' }}>
            <svg viewBox={`0 0 ${tokens(row)} 1`} preserveAspectRatio="none" className="h-full w-full" aria-hidden="true">
              <rect width={row.input} height="1" data-tone="running" className="fill-[var(--tone)]" />
              <rect x={row.input} width={row.output} height="1" data-tone="success" className="fill-[var(--tone)]" />
            </svg>
          </Meter.Fill>}</Meter.Track>
        </Meter> : <ProgressBar isIndeterminate className="mt-1" aria-label={t('{name}: in {input}, out {output}', { name: name(row.k), input: compactVi(row.input), output: compactVi(row.output) })}><ProgressBar.Track /></ProgressBar>}
      </li>)}
    </ul>
  </div>;
}

/** Cost (or, when no cost was reported, token) per day as columns. */
function PerDay({ rows }: Readonly<{ rows: Group[] }>) {
  const hasCost = rows.some(r => r.costUsd != null);
  const value = (r: Group) => hasCost ? r.costUsd : r.input == null && r.output == null ? null : tokens(r);
  const max = Math.max(1e-9, ...rows.flatMap(r => value(r) == null ? [] : [value(r)!]));
  return <div>
    <h4 className="m-0 mb-2 text-[13px] font-medium text-muted-foreground">{hasCost ? t('Cost per day (USD, Vietnam time)') : t('Tokens per day (no provider-reported cost yet)')}</h4>
    <div className="flex h-36 max-w-full items-end gap-3 overflow-x-auto pb-1" role="img" aria-label={t('Columns per day')}>
      {rows.map(r => <div key={r.k} data-tone="running" className="flex min-w-16 flex-1 flex-col items-center justify-end gap-1" title={`${dayLabel(r.k)}: ${hasCost ? costVi(r.costUsd) : compactVi(value(r))}`}>
        <span className="text-[13px] tabular-nums text-muted-foreground">{hasCost ? costVi(r.costUsd) : compactVi(value(r))}</span>
        {value(r) != null ? <svg viewBox="0 0 40 88" preserveAspectRatio="none" className="w-full max-w-10" style={{ height: `${(value(r)! / max) * 88}px` }} aria-hidden="true"><rect width="40" height="88" className="fill-[var(--tone)]" /></svg> : <span className="text-[13px] text-muted-foreground">—</span>}
        <span className="text-[13px] tabular-nums text-muted-foreground">{dayLabel(r.k)}</span>
      </div>)}
    </div>
  </div>;
}

export function UsagePanel({ window: win, project }: Readonly<{ window: '24h' | '7d'; project: string }>) {
  const url = `/api/metrics/usage?window=${win}${project ? `&project=${encodeURIComponent(project)}` : ''}`;
  const query = useApiQuery<UsageWindow>(url, { topics: ['workers'], intervalMs: 30_000 });
  const usage = query.data;
  const sum = (key: keyof UsageRow) => { const values = (usage?.byModel ?? []).flatMap(r => typeof r[key] === 'number' ? [r[key] as number] : []); return values.length ? values.reduce((s, value) => s + value, 0) : null; };
  const fromLog = Boolean(usage?.recorded);
  const tin = sum('input'), tout = sum('output');
  const cacheRead = sum('cacheRead'), cacheWrite = sum('cacheWrite');
  const cache = cacheRead != null && cacheWrite != null ? cacheRead + cacheWrite : null;
  const cost = (usage?.byModel ?? []).some(r => r.costUsd != null) ? sum('costUsd') : null;
  const coverage = (field: 'input' | 'output' | 'costUsd') => {
    const groups = usage?.byModel ?? [];
    const known = groups.reduce((n, row) => n + (row.completeness?.fields[field]?.known ?? 0), 0);
    const total = groups.reduce((n, row) => n + (row.completeness?.fields[field]?.total ?? row.n ?? 0), 0);
    return { known, total, complete: total > 0 && known === total };
  };
  const inputCoverage = coverage('input'), outputCoverage = coverage('output'), costCoverage = coverage('costUsd');
  const cacheComplete = (usage?.byModel ?? []).every(row => row.completeness?.fields.cacheRead?.complete && row.completeness?.fields.cacheWrite?.complete);
  const windowText = win === '24h' ? t('24 hours') : t('7 days');
  return <ChartCard title={t('Tokens and cost')} hint={t('Recorded project-ledger usage over the last {window}; machine Supervisor and Worker usage is outside this scope.', { window: windowText })} empty={false}>
    <ReadQuality query={query} url={url} />
    <p className="mb-3 text-xs text-muted-foreground">{t('Scope: {scope}', { scope: project || t('Active project ledgers') })}</p>
    {fromLog ? <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label={t('Input tokens')} value={compactVi(tin)} hint={tin != null ? String(tin) : undefined} /><Stat label={t('Output tokens')} value={compactVi(tout)} hint={tout != null ? String(tout) : undefined} />
        <Stat label={t('Cache read + write')} value={compactVi(cache)} hint={cache != null ? String(cache) : undefined} /><Stat label={t('Recorded cost (known part)')} value={cost == null ? t('not reported') : costVi(cost)} />
      </div>
      {tin != null && tout != null && cache != null ? <TokenBar input={tin} output={tout} cache={cache} complete={inputCoverage.complete && outputCoverage.complete && cacheComplete} /> : null}
      <p className="text-xs text-muted-foreground">{t('Totals include reported measurements only; missing measurements remain unknown.')}</p>
      <p className="text-xs text-muted-foreground">{t('Measurement coverage: input {input}, output {output}, cost {cost}.', { input: `${inputCoverage.known}/${inputCoverage.total}`, output: `${outputCoverage.known}/${outputCoverage.total}`, cost: `${costCoverage.known}/${costCoverage.total}` })}</p>
      {usage?.sources?.length ? <p className="m-0 text-xs text-muted-foreground">{t('Data sources: {list}', { list: usage.sources.map(sourceLabel).join(' · ') })}</p> : null}
      <div className="grid gap-6 lg:grid-cols-2">
        <TokenRows title={t('Tokens by model')} rows={usage!.byModel} name={k => k ?? t('unknown model')} />
        <TokenRows title={t('Tokens by op')} rows={usage!.byOp} name={k => k === 'kernel' ? t('Kernel (coordinator turns)') : k} />
      </div>
      {usage!.byProvider.length > 1 ? <TokenRows title={t('Tokens by provider')} rows={usage!.byProvider} name={k => k} /> : null}
      {usage!.byDay.length ? <PerDay rows={usage!.byDay} /> : null}
    </div> : usage !== null && !query.error && !partialSources(query).length ? <FeedbackState>
      <span className="block font-medium">{t('Nothing recorded yet')}</span><span className="mt-1 block">{t('No attempt in this range has reported token or cost figures yet. Once the provider returns them the numbers will show here.')}</span>
      </FeedbackState> : partialSources(query).length ? <FeedbackState>{t('Available sources returned no usage; the full scope is incomplete.')}</FeedbackState> : null}
  </ChartCard>;
}
