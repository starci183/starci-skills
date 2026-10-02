import type { Concept } from '../concept';
export const concept: Concept = 'C16';
import { motion } from 'motion/react';
import { EASE } from '../motion';
import type { FleetSummary } from '../../contract';
import { useApiQuery } from '../../api/query';
import { ChartCard } from './chart-card';
import { compactVi, costVi, sourceLabel, TokenBar, type UsageRow } from '../usage-view';
import { t } from '../../i18n/t';

export type OpsMetric = { op: string; agent: string | null; model: string | null; attempts: number; tokensIn: number; tokensOut: number; costUsd: number | null };
type Group = UsageRow & { k: string };
type UsageWindow = { window: '24h' | '7d'; recorded: boolean; byModel: Group[]; byOp: Group[]; byProvider: Group[]; byDay: Group[]; sources: string[] };

const tokens = (row: UsageRow) => (row.input ?? 0) + (row.output ?? 0);
const projectOfHash = () => { try { return new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('project') ?? ''; } catch { return ''; } };
const dayLabel = (key: string) => { const [, m, d] = key.split('-'); return `${d}/${m}`; };

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return <div className="min-w-0 rounded-lg bg-muted/50 p-3"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 truncate text-xl font-semibold tabular-nums" title={hint}>{value}</div></div>;
}

/** Horizontal bars: input (blue) and output (green) per row, sorted by the server. */
function TokenRows({ title, rows, name }: { title: string; rows: Group[]; name: (k: string) => string }) {
  const max = Math.max(1, ...rows.map(tokens));
  return <div className="min-w-0">
    <h4 className="m-0 mb-2 text-xs font-medium text-muted-foreground">{title}</h4>
    <ul className="m-0 flex list-none flex-col gap-2 p-0">
      {rows.map(row => <li key={row.k} className="min-w-0 text-xs">
        <div className="flex flex-wrap items-baseline justify-between gap-x-2"><span className="min-w-0 max-w-full break-all font-mono" title={name(row.k)}>{name(row.k)}</span>
          <span className="shrink-0 tabular-nums text-muted-foreground">{t('in {input} · out {output} · {cost}', { input: compactVi(row.input), output: compactVi(row.output), cost: costVi(row.costUsd) })}</span></div>
        <motion.div className="mt-1 flex h-2 overflow-hidden rounded-full bg-muted" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.24, ease: EASE }} style={{ width: `${Math.max(4, (tokens(row) / max) * 100)}%`, transformOrigin: 'left center' }} role="img" aria-label={t('{name}: in {input}, out {output}', { name: name(row.k), input: compactVi(row.input), output: compactVi(row.output) })}>
          <span data-tone="running" className="h-full bg-[var(--tone)]" style={{ flex: row.input ?? 0 }} /><span data-tone="success" className="h-full bg-[var(--tone)]" style={{ flex: row.output ?? 0 }} />
        </motion.div>
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
    <h4 className="m-0 mb-2 text-xs font-medium text-muted-foreground">{hasCost ? t('Cost per day (USD, Vietnam time)') : t('Tokens per day (no provider-reported cost yet)')}</h4>
    <div className="flex h-32 items-end gap-2" role="img" aria-label={t('Columns per day')}>
      {rows.map(r => <div key={r.k} data-tone="running" className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`${dayLabel(r.k)}: ${hasCost ? costVi(r.costUsd) : compactVi(tokens(r))}`}>
        <span className="text-[10px] tabular-nums text-muted-foreground">{hasCost ? costVi(r.costUsd) : compactVi(tokens(r))}</span>
        <motion.div className="w-full max-w-10 rounded-t bg-[var(--tone)]" initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ duration: 0.24, ease: EASE }} style={{ height: `${Math.max(3, (value(r) / max) * 88)}px`, transformOrigin: 'bottom' }} />
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
  const windowText = win === '24h' ? t('24 hours') : t('7 days');
  return <ChartCard title={t('Tokens and cost')} hint={t('Totals over the last {window} from the llm_usage table: by model, by op and by day.', { window: windowText })} empty={false}>
    {recorded ? <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label={t('Input tokens')} value={compactVi(tin)} hint={String(tin)} /><Stat label={t('Output tokens')} value={compactVi(tout)} hint={String(tout)} />
        <Stat label={t('Cache read + write')} value={fromLog ? compactVi(cache) : '—'} hint={fromLog ? String(cache) : undefined} /><Stat label={t('Cost')} value={cost == null ? t('not reported') : costVi(cost)} />
      </div>
      <TokenBar input={tin} output={tout} cache={cache} />
      {usage?.sources?.length ? <p className="m-0 text-xs text-muted-foreground">{t('Data sources: {list}', { list: usage.sources.map(sourceLabel).join(' · ') })}</p> : null}
      {fromLog ? <div className="grid gap-6 lg:grid-cols-2">
        <TokenRows title={t('Tokens by model')} rows={usage!.byModel} name={k => k ?? t('unknown model')} />
        <TokenRows title={t('Tokens by op')} rows={usage!.byOp} name={k => k === 'kernel' ? t('Kernel (coordinator turns)') : k} />
      </div> : list.length ? <p className="m-0 text-xs text-muted-foreground">{t('Figures summed over each attempt; per-model and per-op detail is unavailable because llm_usage is empty.')}</p> : null}
      {fromLog && usage!.byProvider.length > 1 ? <TokenRows title={t('Tokens by provider')} rows={usage!.byProvider} name={k => k} /> : null}
      {fromLog && usage!.byDay.length ? <PerDay rows={usage!.byDay} /> : null}
    </div> : <div className="rounded-lg border p-4 text-sm"><p className="font-medium">{t('Nothing recorded yet')}</p>
      <p className="mt-1 text-muted-foreground">{t('No attempt in this range has reported token or cost figures yet. Once the provider returns them the numbers will show here.')}</p>
      {summary?.usage24h && !summary.usage24h.recorded ? <p className="mt-1 text-xs text-muted-foreground">{t('The whole system also has no usage record for the last 24 hours.')}</p> : null}</div>}
  </ChartCard>;
}
