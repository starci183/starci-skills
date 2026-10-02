import type { WorkersSummary } from '../../contract';
import type { Tone } from '../status';
import type { Concept } from '../concept';
import { compactVi, costVi } from '../usage-view';
import { Stagger, StaggerItem, Ticker } from '../motion';
import { t } from '../../i18n/t';

export const concept: Concept = 'C2';

type Kpi = { tone: Tone; value: number; label: string; note: string };

/** Essentials: four big numbers (ops running, workflows needing attention, passed / failed in 24 h) that count up on first view. */
export function KpiStrip({ summary, needsAttention }: { summary: WorkersSummary | undefined; needsAttention: number | undefined }) {
  const items: Kpi[] = summary ? [
    { tone: 'running', value: summary.opsRunning, label: t('ops running'), note: t('Dispatched attempts the agent has not reported yet.') },
    { tone: 'failed', value: needsAttention ?? 0, label: t('workflows needing attention'), note: t('Workflows that are stuck or slow and need a person.') },
    { tone: 'success', value: summary.passed24h, label: t('passed in 24 h'), note: t('Attempts settled with a passing result.') },
    { tone: 'failed', value: summary.failed24h, label: t('failed / blocked in 24 h'), note: t('Attempts settled with a failing result.') },
  ] : [];
  if (!summary) return <section aria-label={t('Worker metrics')} className="kpi-strip grid grid-cols-2 lg:grid-cols-4">
    {Array.from({ length: 4 }, (_, index) => <div key={index} className="kpi-cell"><div className="h-8 w-12 rounded bg-muted" /><div className="mt-3 h-4 w-24 rounded bg-muted" /><div className="mt-2 h-3 w-full rounded bg-muted" /></div>)}
  </section>;
  return <Stagger className="kpi-strip grid grid-cols-2 lg:grid-cols-4">
    {items.map(item => <StaggerItem key={item.label} className="kpi-cell min-w-0"><div data-tone={item.tone} className="flex h-full min-w-0 flex-col gap-1" aria-label={item.label}>
      <div className="text-3xl font-semibold tabular-nums leading-none"><Ticker value={item.value} /></div>
      <div className="mt-2 flex items-center gap-2 text-sm font-medium"><span className="status-dot" aria-hidden="true" />{item.label}</div>
      <p className="text-xs leading-snug text-muted-foreground">{item.note}</p>
    </div></StaggerItem>)}
  </Stagger>;
}

/** Secondary numbers (settling ops, queued units, 24 h tokens) shown inside "Advanced". */
export function KpiExtras({ summary }: { summary: WorkersSummary | undefined }) {
  if (!summary) return null;
  const usage = summary.usage24h;
  const tokens = usage.recorded ? usage.inputTokens + usage.outputTokens : null;
  const number = (value: number) => new Intl.NumberFormat('vi-VN').format(value);
  const items = [
    { label: t('settling'), value: number(summary.opsSettling), note: t('Agents have reported and are waiting for the Kernel to settle.') },
    { label: t('units queued'), value: number(summary.unitsQueued), note: t('Not yet their turn or waiting for a slot, in a running workflow.') },
    tokens != null ? { label: t('Tokens in 24 h'), value: compactVi(tokens), note: t('in {input} · out {output} · {cost}', { input: compactVi(usage.inputTokens), output: compactVi(usage.outputTokens), cost: costVi(usage.costUsd) }) }
      : { label: t('Tokens in 24 h'), value: t('not recorded'), note: t('The runtime has not written tokens to llm_usage in the last 24 hours.') },
  ];
  return <dl className="grid gap-3 sm:grid-cols-3">{items.map(item => <div key={item.label} className="flex min-w-0 flex-col gap-1 p-3">
    <dt className="text-xs text-muted-foreground">{item.label}</dt><dd className="text-lg font-semibold tabular-nums leading-tight">{item.value}</dd><p className="text-xs leading-snug text-muted-foreground">{item.note}</p>
  </div>)}</dl>;
}
