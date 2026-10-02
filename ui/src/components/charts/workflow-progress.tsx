import type { Concept } from '../concept';
export const concept: Concept = 'C16';
import { motion } from 'motion/react';
import { EASE } from '../motion';
import type { WorkersViewV2, PipelineView, WorkflowRowV2 } from '../../contract';
import { useApiQuery } from '../../api/query';
import { statusLabels, statusTone, type Status } from '../status';
import { ChartCard } from './chart-card';
import { num } from './analytics-data';
import { t } from '../../i18n/t';

function Row({ row }: { row: WorkflowRowV2 }) {
  const url = `/api/workflows/${encodeURIComponent(row.project)}/${encodeURIComponent(row.id)}/pipeline`;
  const q = useApiQuery<PipelineView>(url, { topics: [`wf:${row.project}:${row.id}`], intervalMs: 30_000 });
  const pipe = q.data, mini = row.pipeline;
  const legs: { op: string; status: Status; tries: number }[] = pipe ? pipe.legs.map(l => ({ op: l.op, status: l.status, tries: Math.max(0, ...l.units.map(u => u.tries)) })) : mini?.legs ?? [];
  const progress = pipe?.progress ?? mini?.progress;
  return <li className="grid gap-2 py-3 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_auto] sm:items-center sm:gap-4">
    <a href={`#/w/${encodeURIComponent(row.project)}/${encodeURIComponent(row.id)}`} className="min-w-0 truncate text-sm font-medium hover:underline" title={`${row.name} · ${row.id}`}>{row.name}</a>
    <div className="flex h-3 min-w-0 gap-1" role="img" aria-label={t('Progress of {name}: {progress}', { name: row.name, progress: progress ? t('{done}/{total} legs passed', { done: progress.done, total: progress.total }) : t('loading') })}>
      {legs.length ? legs.map((leg, i) => <motion.span key={`${leg.op}-${i}`} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.24, ease: EASE, delay: Math.min(i, 12) * 0.03 }} style={{ transformOrigin: 'left center' }} data-tone={statusTone[leg.status]} title={`${leg.op} · ${statusLabels[leg.status]}${leg.tries > 1 ? t(' · {n} tries', { n: leg.tries }) : ''}`}
        className={`h-full min-w-1 flex-1 rounded-sm ${['deferred', 'external', 'dropped'].includes(leg.status) ? 'border border-dashed border-[var(--tone-line)]' : leg.status === 'planned' || leg.status === 'queued' || leg.status === 'unknown' ? 'bg-[var(--tone-bg)] ring-1 ring-inset ring-[var(--tone-line)]' : 'bg-[var(--tone)]'}`} />)
        : <span className="h-full flex-1 rounded-sm bg-muted" title={t('No legs yet')} />}
    </div>
    <span className="text-sm font-semibold tabular-nums sm:text-right">{progress ? `${num(progress.done, 0)}/${num(progress.total, 0)}` : '—'}<span className="ml-1 text-xs font-normal text-muted-foreground">{t('legs passed')}</span></span>
  </li>;
}

export function WorkflowProgress({ workers, project }: { workers: WorkersViewV2 | null; project: string }) {
  const rows = (workers?.workflows ?? []).filter(w => !project || w.project === project);
  return <ChartCard title={t('Workflow progress')} hint={t('One row per workflow; each cell is a leg of the chain, x/y is legs passed over total.')}
    legend={[{ tone: 'success', label: t('Passed') }, { tone: 'running', label: t('Running') }, { tone: 'queued', label: t('Waiting / not reached') }, { tone: 'failed', label: t('Failed/blocked') }, { tone: 'warning', label: t('Waiting to retry') }, { tone: 'skipped', label: t('Deferred / external') }]}
    empty={!rows.length && t('No workflows yet.')} className="lg:col-span-2">
    <ul className="divide-y">{rows.map(row => <Row key={`${row.project}/${row.id}`} row={row} />)}</ul>
  </ChartCard>;
}
