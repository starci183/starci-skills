import type { Concept } from '../concept';
import { Link, Meter, ProgressBar } from '@heroui/react';
export const concept: Concept = 'C16';
import type { WorkersViewV2, PipelineView, WorkflowRowV2 } from '../../contract';
import { useApiQuery, type QuerySnapshot } from '../../api/query';
import { statusLabels, statusTone, type Status } from '../status';
import { ChartCard, ReadQuality, partialSources } from './chart-card';
import { num } from './analytics-data';
import { t } from '../../i18n/t';
import { FeedbackState } from '../feedback-state';
import { Advanced } from '../motion';

function Row({ row }: { readonly row: WorkflowRowV2 }) {
  const url = `/api/workflows/${encodeURIComponent(row.project)}/${encodeURIComponent(row.id)}/pipeline`;
  const q = useApiQuery<PipelineView>(url, { topics: [`wf:${row.project}:${row.id}`], intervalMs: 30_000 });
  const pipe = q.data, mini = row.pipeline;
  const recordedLegs: { op: string; status: Status; tries: number; inPlan: boolean }[] = pipe ? pipe.legs.map(l => ({ op: l.op, status: l.status, tries: Math.max(0, ...l.units.map(u => u.tries)), inPlan: l.inPlan })) : mini?.legs ?? [];
  const legs = recordedLegs.filter(leg => leg.inPlan);
  const history = recordedLegs.filter(leg => !leg.inPlan);
  const progress = pipe?.progress ?? mini?.progress;
  const available = progress?.available === true;
  const label = t('Progress of {name}: {progress}', { name: row.name, progress: available ? t('{done}/{total} legs passed', { done: progress.done, total: progress.total }) : t('Unknown') });
  return <li className="grid gap-2 py-3 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_auto] sm:items-center sm:gap-4">
    <span className="min-w-0" title={`${row.name} · ${row.id}`}><Link href={`#/w/${encodeURIComponent(row.project)}/${encodeURIComponent(row.id)}`} className="min-w-0 break-words text-sm font-medium">{row.name}</Link>{pipe || mini ? <span className="mt-1 block text-xs text-muted-foreground">{t('Goal revision {n}', { n: pipe?.goalRevision ?? mini?.goalRevision ?? '—' })} · {(pipe?.approvalState ?? mini?.approvalState) === 'recorded' ? t('Recorded approval') : t('Approval has not been proven.')}</span> : null}</span>
    {available && progress.total > 0 ? <Meter value={progress.done} maxValue={progress.total} aria-label={label} aria-valuetext={label} size="sm" className="min-w-0">
      <Meter.Track className="flex h-3 min-w-0 gap-1 bg-transparent">{legs.map((leg, i) => <Meter.Fill key={`${leg.op}-${i}`} style={{ flex: 1 }} data-tone={statusTone[leg.status]} title={`${leg.op} · ${statusLabels[leg.status]}${leg.tries > 1 ? t(' · {n} tries', { n: leg.tries }) : ''}`} aria-hidden="true"
        className={`relative h-full min-w-1 rounded-sm ${['deferred', 'external', 'dropped'].includes(leg.status) ? 'border border-dashed border-[var(--tone-line)] bg-transparent' : leg.status === 'planned' || leg.status === 'queued' || leg.status === 'unknown' ? 'bg-[var(--tone-bg)] ring-1 ring-inset ring-[var(--tone-line)]' : 'bg-[var(--tone)]'}`} />)}</Meter.Track>
    </Meter> : <ProgressBar isIndeterminate aria-label={label} size="sm" className="min-w-0"><ProgressBar.Track className="h-3 bg-default" /></ProgressBar>}
    <span className="text-sm font-semibold tabular-nums sm:text-right">{available ? `${num(progress.done, 0)}/${num(progress.total, 0)}` : '—'}<span className="ml-1 text-xs font-normal text-muted-foreground">{t('legs passed')}</span></span>
    {progress && (['deferred', 'external', 'dropped'] as const).some(status => (progress.byStatus[status] ?? 0) > 0) ? <p className="m-0 text-xs text-muted-foreground sm:col-span-3">{t('Excluded:')} {(['deferred', 'external', 'dropped'] as const).filter(status => (progress.byStatus[status] ?? 0) > 0).map(status => `${progress.byStatus[status]} ${statusLabels[status]}`).join(' · ')}</p> : null}
    {history.length ? <Advanced className="sm:col-span-3" title={t('Operation-scope history')}><ul className="m-0 grid list-none gap-2 p-0 text-xs">{history.map((leg, index) => <li key={`${leg.op}:${index}`} className="min-w-0 break-words"><code className="break-all">{leg.op}</code> · {statusLabels[leg.status]}{leg.tries > 0 ? t(' · {n} tries', { n: leg.tries }) : ''}</li>)}</ul></Advanced> : null}
    {q.error || partialSources(q).length ? <div className="sm:col-span-3"><ReadQuality query={q} url={url} /></div> : null}
  </li>;
}

export function WorkflowProgress({ workers, project }: { readonly workers: QuerySnapshot<WorkersViewV2>; readonly project: string }) {
  const rows = (workers.data?.workflows ?? []).filter(w => !project || w.project === project || w.ledgerId === project);
  return <ChartCard title={t('Workflow progress')} hint={t('One row per workflow; each cell is a leg of the chain, x/y is legs passed over total.')}
    legend={[{ tone: 'success', label: t('Passed') }, { tone: 'running', label: t('Running') }, { tone: 'queued', label: t('Waiting / not reached') }, { tone: 'failed', label: t('Failed/blocked') }, { tone: 'warning', label: t('Waiting to retry') }, { tone: 'skipped', label: t('Deferred / external') }]}
    empty={false} className="lg:col-span-2">
    <ReadQuality query={workers} url="/api/workers" />
    {workers.data && !rows.length && !workers.error && !partialSources(workers).length ? <FeedbackState>{t('No workflows yet.')}</FeedbackState> : null}
    <ul className="divide-y">{rows.map(row => <Row key={`${row.project}/${row.id}`} row={row} />)}</ul>
  </ChartCard>;
}
