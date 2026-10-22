import type { Concept } from '../concept';
import type { CSSProperties } from 'react';
import { Link, Meter, ProgressBar } from '@heroui/react';
/** Names the C16 analytics concept this module belongs to, for the per-workflow progress strip. */
export const concept: Concept = 'C16';
import type { WorkersViewV2, PipelineView, WorkflowRowV2 } from '../../contract';
import { useApiQuery, type QuerySnapshot } from '../../api/query';
import { statusLabels, statusTone, type Status } from '../status';
import { ChartCard, ReadQuality, partialSources } from './chart-card';
import { num } from './analytics-data';
import { t } from '../../i18n/t';
import { FeedbackState } from '../feedback-state';
import { Advanced } from '../motion';

type RowProps = Readonly<{ row: WorkflowRowV2 }>;
type WorkflowProgressProps = Readonly<{ workers: QuerySnapshot<WorkersViewV2>; project: string }>;
type RecordedLeg = { op: string; status: Status; tries: number; inPlan: boolean; goalRevision: number | null; binding: string };

const LEG_FILL: CSSProperties = { flex: 1 };
const EXCLUDED: ReadonlySet<Status> = new Set<Status>(['deferred', 'external', 'dropped']);
const WAITING: ReadonlySet<Status> = new Set<Status>(['planned', 'queued', 'unknown']);

/** Stable identity of a leg: its op within its goal revision and binding. */
const legKey = (leg: RecordedLeg): string => `${leg.op}:${leg.goalRevision ?? 'none'}:${leg.binding}`;

/** Classes of one progress cell: dashed when excluded from the count, outlined while waiting, solid in its tone otherwise. */
const legClass = (status: Status): string => {
  const base = 'relative h-full min-w-1 rounded-sm';
  if (EXCLUDED.has(status)) return `${base} border border-dashed border-[var(--tone-line)] bg-transparent`;
  if (WAITING.has(status)) return `${base} bg-[var(--tone-bg)] ring-1 ring-inset ring-[var(--tone-line)]`;
  return `${base} bg-[var(--tone)]`;
};

/** One workflow's progress line: its leg cells, legs-passed count, excluded legs and operation history. */
const Row = ({ row }: RowProps) => {
  const url = `/api/workflows/${encodeURIComponent(row.project)}/${encodeURIComponent(row.id)}/pipeline`;
  const q = useApiQuery<PipelineView>(url, { topics: [`wf:${row.project}:${row.id}`], intervalMs: 30_000 });
  const pipe = q.data, mini = row.pipeline;
  const recordedLegs: RecordedLeg[] = (pipe ? pipe.legs.map(l => ({ op: l.op, status: l.status, tries: Math.max(0, ...l.units.map(u => u.tries)), inPlan: l.inPlan, goalRevision: l.goalRevision, binding: l.binding })) : mini?.legs ?? []);
  const legs = recordedLegs.filter(leg => leg.inPlan);
  const history = recordedLegs.filter(leg => !leg.inPlan);
  const progress = pipe?.progress ?? mini?.progress;
  const available = progress?.available === true;
  const label = t('Progress of {name}: {progress}', { name: row.name, progress: available ? t('{done}/{total} legs passed', { done: progress.done, total: progress.total }) : t('Unknown') });
  return <li className="grid gap-2 py-3 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_auto] sm:items-center sm:gap-4">
    <span className="min-w-0" title={`${row.name} · ${row.id}`}><Link href={`#/w/${encodeURIComponent(row.project)}/${encodeURIComponent(row.id)}`} className="min-w-0 break-words text-sm font-medium">{row.name}</Link>{pipe || mini ? <span className="mt-1 block text-xs text-muted-foreground">{t('Goal revision {n}', { n: pipe?.goalRevision ?? mini?.goalRevision ?? '—' })} · {(pipe?.approvalState ?? mini?.approvalState) === 'recorded' ? t('Recorded approval') : t('Approval has not been proven.')}</span> : null}</span>
    {available && progress.total > 0 ? <Meter value={progress.done} maxValue={progress.total} aria-label={label} aria-valuetext={label} size="sm" className="min-w-0">
      <Meter.Track className="flex h-3 min-w-0 gap-1 bg-transparent">{legs.map(leg => <Meter.Fill key={legKey(leg)} style={LEG_FILL} data-tone={statusTone[leg.status]} title={`${leg.op} · ${statusLabels[leg.status]}${leg.tries > 1 ? t(' · {n} tries', { n: leg.tries }) : ''}`} aria-hidden="true"
        className={legClass(leg.status)} />)}</Meter.Track>
    </Meter> : <ProgressBar isIndeterminate aria-label={label} size="sm" className="min-w-0"><ProgressBar.Track className="h-3 bg-default" /></ProgressBar>}
    <span className="text-sm font-semibold tabular-nums sm:text-right">{available ? `${num(progress.done, 0)}/${num(progress.total, 0)}` : '—'}<span className="ml-1 text-xs font-normal text-muted-foreground">{t('legs passed')}</span></span>
    {progress && (['deferred', 'external', 'dropped'] as const).some(status => (progress.byStatus[status] ?? 0) > 0) ? <p className="m-0 text-xs text-muted-foreground sm:col-span-3">{t('Excluded:')} {(['deferred', 'external', 'dropped'] as const).filter(status => (progress.byStatus[status] ?? 0) > 0).map(status => `${progress.byStatus[status]} ${statusLabels[status]}`).join(' · ')}</p> : null}
    {history.length ? <Advanced className="sm:col-span-3" title={t('Operation-scope history')}><ul className="m-0 grid list-none gap-2 p-0 text-xs">{history.map(leg => <li key={legKey(leg)} className="min-w-0 break-words"><code className="break-all">{leg.op}</code> · {statusLabels[leg.status]}{leg.tries > 0 ? t(' · {n} tries', { n: leg.tries }) : ''}</li>)}</ul></Advanced> : null}
    {q.error || partialSources(q).length ? <div className="sm:col-span-3"><ReadQuality query={q} url={url} /></div> : null}
  </li>;
};

/** Lists every workflow with a segmented bar of its legs, so the whole chain's progress is comparable across workflows. */
export const WorkflowProgress = ({ workers, project }: WorkflowProgressProps) => {
  const rows = (workers.data?.workflows ?? []).filter(w => !project || w.project === project || w.ledgerId === project);
  return <ChartCard title={t('Workflow progress')} hint={t('One row per workflow; each cell is a leg of the chain, x/y is legs passed over total.')}
    legend={[{ tone: 'success', label: t('Passed') }, { tone: 'running', label: t('Running') }, { tone: 'queued', label: t('Waiting / not reached') }, { tone: 'failed', label: t('Failed/blocked') }, { tone: 'warning', label: t('Waiting to retry') }, { tone: 'skipped', label: t('Deferred / external') }]}
    empty={false} className="lg:col-span-2">
    <ReadQuality query={workers} url="/api/workers" />
    {workers.data && !rows.length && !workers.error && !partialSources(workers).length ? <FeedbackState>{t('No workflows yet.')}</FeedbackState> : null}
    <ul className="divide-y">{rows.map(row => <Row key={`${row.project}/${row.id}`} row={row} />)}</ul>
  </ChartCard>;
};
