import type { WorkersSummary } from '../../contract';
import type { Tone } from '../status';
import type { Concept } from '../concept';
import { compactVi, costVi } from '../usage-view';
import { Stagger, StaggerItem, Ticker } from '../motion';
import { t } from '../../i18n/t';

export const concept: Concept = 'C2';

type Kpi = { tone: Tone; value: number | null; label: string; note: string };
const observed = (value: number | null | undefined) => typeof value === 'number' && Number.isFinite(value) ? value : null;

/** Essentials: four big numbers (ops running, workflows needing attention, passed / failed in 24 h) that count up on first view. */
export function KpiStrip({ summary, needsAttention, loading = false }: { summary: WorkersSummary | null | undefined; needsAttention: number | null | undefined; loading?: boolean }) {
  const items: Kpi[] = [
    { tone: 'running', value: observed(summary?.opsRunning), label: t('ops running'), note: t('Dispatched attempts the agent has not reported yet.') },
    { tone: 'failed', value: observed(needsAttention), label: t('workflows needing attention'), note: t('Workflows that are stuck or slow and need a person.') },
    { tone: 'success', value: observed(summary?.passed24h), label: t('settled passes in 24 h'), note: t('Attempts settled with a passing result.') },
    { tone: 'failed', value: observed(summary?.failed24h), label: t('settled failures in 24 h'), note: t('Attempts settled with a failing result.') },
  ];
  if (!summary && loading) return <section aria-label={t('Worker metrics')} className="kpi-strip grid grid-cols-2 lg:grid-cols-4">
    {Array.from({ length: 4 }, (_, index) => <div key={index} className="kpi-cell"><div className="h-8 w-12 rounded bg-muted" /><div className="mt-3 h-4 w-24 rounded bg-muted" /><div className="mt-2 h-3 w-full rounded bg-muted" /></div>)}
  </section>;
  return <Stagger className="kpi-strip grid grid-cols-2 lg:grid-cols-4">
    {items.map(item => <StaggerItem key={item.label} className="kpi-cell min-w-0"><div data-tone={item.value == null ? 'queued' : item.tone} className="flex h-full min-w-0 flex-col gap-1" aria-label={item.label}>
      <div className="text-3xl font-semibold tabular-nums leading-none">{item.value == null ? <span aria-label={t('Not observed.')}>—</span> : <Ticker value={item.value} />}</div>
      <div className="mt-2 flex items-center gap-2 text-sm font-medium"><span className="status-dot" aria-hidden="true" />{item.label}</div>
      <p className="text-xs leading-snug text-muted-foreground">{item.note}</p>
    </div></StaggerItem>)}
  </Stagger>;
}

/** Secondary numbers (settling ops, queued units, 24 h tokens) shown inside "Advanced". */
export function KpiExtras({ summary }: { summary: WorkersSummary | undefined }) {
  if (!summary) return null;
  const usage = summary.usage24h;
  const tokens = usage.recorded && observed(usage.inputTokens) != null && observed(usage.outputTokens) != null ? usage.inputTokens! + usage.outputTokens! : null;
  const tokensComplete = usage.completeness?.fields.input.complete && usage.completeness?.fields.output.complete;
  const number = (value: number | null | undefined) => observed(value) == null ? '—' : new Intl.NumberFormat('vi-VN').format(value!);
  const items = [
    { label: t('settling'), value: number(summary.opsSettling), note: t('Agents have reported and are waiting for the Kernel to settle.') },
    { label: t('planned / queued units'), value: number(summary.unitsQueued), note: t('Recorded planned or queued units in running workflows; this is not the ready frontier.') },
    tokens != null ? { label: t('Tokens in 24 h'), value: `${compactVi(tokens)}${tokensComplete ? '' : ` · ${t('recorded part')}`}`, note: t('in {input} · out {output} · {cost}', { input: compactVi(usage.inputTokens), output: compactVi(usage.outputTokens), cost: costVi(usage.costUsd) }) }
      : { label: t('Tokens in 24 h'), value: usage.recorded ? '—' : t('not recorded'), note: t('Project-ledger usage in the last 24 hours.') },
  ];
  return <dl className="grid gap-3 sm:grid-cols-3">{items.map(item => <div key={item.label} className="flex min-w-0 flex-col gap-1 p-3">
    <dt className="text-xs text-muted-foreground">{item.label}</dt><dd className="text-lg font-semibold tabular-nums leading-tight">{item.value}</dd><p className="text-xs leading-snug text-muted-foreground">{item.note}</p>
  </div>)}</dl>;
}
