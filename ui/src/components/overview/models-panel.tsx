import type { WorkersSummary } from '../../contract';
import { Meter, ProgressBar } from '@heroui/react';
import type { Concept } from '../concept';
import { AgentAvatar, AgentStack, agentOf } from '../agent/agent-avatar';
import { attemptAgent, useAttemptAgents } from '../agent/use-running-agents';
import { familyTint } from '../agent/agent-marks';
import { t } from '../../i18n/t';
import { FeedbackState, SourceWarning } from '../feedback-state';
import { hasUnavailableSources } from './read-state';
import { costVi } from '../usage-view';

export const concept: Concept = 'C2';

const number = (value: number | null | undefined) => value == null || !Number.isFinite(value) ? '—' : new Intl.NumberFormat('vi-VN').format(value);

/** Running ops per model as bars, plus 24 h token usage. */
export function ModelsPanel({ summary, bare = false, readError, sourcePartial = false, sourceLoaded = false }: Readonly<{ summary: WorkersSummary | null | undefined; bare?: boolean; readError?: string | null; sourcePartial?: boolean; sourceLoaded?: boolean }>) {
  const { running, settling, error, meta, activeObserved } = useAttemptAgents();
  const partial = hasUnavailableSources(meta);
  const families = new Map<string, ReturnType<typeof attemptAgent>[]>();
  for (const item of running) { const agent = attemptAgent(item, true); const list = families.get(agent.family); if (list) list.push(agent); else families.set(agent.family, [agent]); }
  const models = summary?.models ?? [];
  const max = Math.max(1, ...models.flatMap(item => item.running != null && Number.isFinite(item.running) ? [item.running] : []));
  const usage = summary?.usage24h;
  const coverage = usage?.completeness?.fields;
  return <div className={`flex flex-col gap-4 ${bare ? '' : 'p-4 sm:p-6'}`}>
    <div>
      <p className="text-xs font-medium text-muted-foreground">{t('Loaded executing attempts · host scope')}</p>
      {error && <SourceWarning className="mt-2">{t('The source is failing; showing the last read. {error}', { error })}</SourceWarning>}
      {partial ? <SourceWarning className="mt-2">{t('Some sources are unavailable; showing the recorded part.')}</SourceWarning> : null}
      {families.size ? <div className="mt-2 flex flex-col gap-2">{[...families.entries()].map(([family, list]) => <div key={family} className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="w-14 shrink-0 text-xs font-medium">{familyTint[list[0].family].name}</span>
        <span className="flex flex-wrap items-center gap-2">{list.map(agent => <AgentAvatar key={agent.href} agent={agent} size={26} live />)}</span>
        <span className="text-xs tabular-nums text-muted-foreground">{list.length}</span>
      </div>)}</div> : !activeObserved ? <FeedbackState>{error ? t('The source is unavailable.') : meta ? t('Not observed.') : t('Loading…')}</FeedbackState> : <p className="mt-1 text-sm text-muted-foreground">{error || partial || meta?.next ? t('No executing agents were observed in the last read.') : t('No agents running.')}</p>}
      {settling.length > 0 && <div className="mt-3 flex flex-wrap items-center gap-2"><span className="text-xs text-muted-foreground">{t('Loaded reported attempts awaiting settlement: {n}', { n: settling.length })}</span><AgentStack agents={settling.map(item => attemptAgent(item))} max={6} size={22} /></div>}
      {meta?.next ? <p className="mt-2 text-xs text-muted-foreground">{t('More active attempts are available in the attempt list.')}</p> : null}
    </div>
    <div><p className="mb-2 text-xs font-medium text-muted-foreground">{t('Executing operations by recorded model · host scope')}</p>
    {readError && <SourceWarning className="mb-2">{t('The source is failing; showing the last read. {error}', { error: readError })}</SourceWarning>}
    {sourcePartial && <SourceWarning className="mb-2">{t('Some sources are unavailable; showing the recorded part.')}</SourceWarning>}
    {models.length ? <ul className="flex flex-col gap-3">
      {models.map((item, index) => {
        const known = typeof item.running === 'number' && Number.isFinite(item.running) && item.running >= 0;
        const label = `${t('Executing operations by recorded model · host scope')} · ${item.model ?? item.pool ?? t('Unknown model')}`;
        return <li key={`${item.model ?? item.pool ?? 'unknown'}-${index}`} data-tone={known ? 'running' : 'queued'}>
        <div className="flex items-baseline justify-between gap-2 text-sm"><span className="flex min-w-0 items-center gap-2"><AgentAvatar agent={agentOf(item)} size={22} /><span className="min-w-0 truncate font-medium">{item.model ?? item.pool ?? t('Unknown model')}</span></span><span className="shrink-0 text-right tabular-nums">{t('{n} executing', { n: number(item.running) })}<span className="block text-xs text-muted-foreground">{t('{n} reported', { n: number(item.settling) })}</span></span></div>
        {known ? <Meter value={item.running} maxValue={max} size="sm" color="accent" aria-label={label} valueLabel={t('{n} executing', { n: number(item.running) })} className="mt-1 gap-0"><Meter.Track><Meter.Fill style={{ background: 'var(--tone)' }} /></Meter.Track></Meter>
          : <ProgressBar isIndeterminate size="sm" aria-label={label} className="mt-1 gap-0"><ProgressBar.Track /></ProgressBar>}
        <p className="mt-1 truncate text-xs text-muted-foreground">{[item.agent, item.pool].filter(Boolean).join(' · ') || t('unknown agent')}</p>
      </li>; })}
    </ul> : <p className="text-sm text-muted-foreground">{!summary ? readError ? t('The source is unavailable.') : sourceLoaded ? t('Not observed.') : t('Loading…') : sourcePartial || readError ? t('No executing operations were observed in the last read.') : t('No ops running.')}</p>}</div>
    <div className="border-t pt-3">
      <p className="text-xs font-medium text-muted-foreground">{t('Project-ledger usage in the last 24 hours.')}</p>
      {usage?.recorded ? <p className="mt-1 text-sm tabular-nums">{t('in {input} · out {output} · {cost}', { input: number(usage.inputTokens), output: number(usage.outputTokens), cost: costVi(usage.costUsd) })}</p>
        : <p className="mt-1 text-sm text-muted-foreground">{usage ? t('not recorded') : '—'}</p>}
      {usage?.recorded && <p className="mt-1 text-xs text-muted-foreground">{coverage ? t('Recorded usage coverage: in {input}; out {output}; cost {cost}', {
        input: `${coverage.input.known}/${coverage.input.total}`,
        output: `${coverage.output.known}/${coverage.output.total}`,
        cost: `${coverage.costUsd.known}/${coverage.costUsd.total}`,
      }) : t('Usage coverage has not been observed.')}</p>}
    </div>
  </div>;
}
