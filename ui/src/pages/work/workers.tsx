import { useState } from 'react';
import { ArrowRight, CircleAlert } from 'lucide-react';
import { refreshQuery, useApiQuery } from '../../api/query';
import type { WorkersViewV2, HostView } from '../../contract';
import { formatReason } from '../../i18n/vi';
import { t } from '../../i18n/t';
import { Card, CardContent } from '../../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { ConceptBlock, type Concept } from '../../components/concept';
import { StatusChip, StatusDot } from '../../components/status-chip';
import { statusFromUi } from '../../components/status';
import { KpiExtras, KpiStrip } from '../../components/overview/kpi-strip';
import { WorkflowCard } from '../../components/overview/workflow-card';
import { LiveFeed } from '../../components/overview/live-feed';
import { ModelsPanel } from '../../components/overview/models-panel';
import { hasUnavailableSources } from '../../components/overview/read-state';
import { HostCard } from '../../components/host/host-card';
import { FeedbackState, PageSkeleton } from '../../components/feedback-state';
import { Advanced, Stagger, StaggerItem } from '../../components/motion';

export const concept: Concept = 'C2';

const healthNames: Record<string, string> = { engine: 'Engine', services: t('Services'), seats: t('Seats'), ram: 'RAM', sla: 'SLA', leaks: t('Leaks'), gc: t('Cleanup'), land: t('Runtime integration'), providers: t('Providers') };
const whoNames: Record<string, string> = { owner: t('The owner'), supervisor: 'Supervisor', kernel: 'Kernel', controller: 'Controller' };
const count = (value: number | null | undefined) => value == null || !Number.isFinite(value) ? '—' : value;

export function WorkersPage() {
  const [project, setProject] = useState('all');
  const workers = useApiQuery<WorkersViewV2>('/api/workers?phase=all', { topics: ['workers', 'decisions', 'system'], intervalMs: 20_000 });
  const projects = useApiQuery<{ id: string; name: string; product: string | null }[]>('/api/projects', { topics: ['workers'], intervalMs: 60_000 });
  const host = useApiQuery<HostView>('/api/host', { topics: ['system'], intervalMs: 10_000 });
  const data = workers.data ?? undefined;
  const visibleWorkflows = (data?.workflows ?? []).filter(row => project === 'all' || row.project === project);
  const needsAttention = data && data.counts.bad != null && data.counts.warn != null ? data.counts.bad + data.counts.warn : undefined;
  const summary = data ? t('{live} workflows running · {bad} need handling · {owner} waiting for the owner', { live: count(data.counts.live), bad: count(needsAttention), owner: count(data.counts.ownerDecisions) }) : workers.error ? t('The source is unavailable.') : workers.meta ? t('Workflow observations have not been recorded.') : t('Reading the situation…');
  const healthCount = data?.health.items.length ?? 0;
  const healthAttention = data?.health.items.filter(item => item.ui === 'bad' || item.ui === 'warn').length ?? 0;
  const healthUnknown = data?.health.items.filter(item => item.ui === 'unknown').length ?? 0;
  const sourceStale = hasUnavailableSources(workers.meta);
  const incomplete = sourceStale || Boolean(workers.error);
  return <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-6 pb-24 md:gap-8">
    <header className="flex flex-col gap-2"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{t('StarCi / overview')}</p><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('Overview')}</h1><p className="text-sm text-muted-foreground">{summary}<span className="block text-xs">{t('Host scope · registered project ledgers')}{incomplete ? ` · ${t('recorded part')}` : ''}</span></p></header>
    {workers.error && <FeedbackState error onRetry={() => refreshQuery('/api/workers?phase=all')}>{workers.error}</FeedbackState>}
    {sourceStale && <p className="shell-error" role="status">{t('Some sources are unavailable; showing the recorded part.')}{workers.meta?.stale?.length ? ` ${workers.meta.stale.join(', ')}` : ''}</p>}
    <KpiStrip summary={data?.summary} needsAttention={needsAttention} loading={!data && !workers.error && !workers.meta} />
    <ConceptBlock concept="C12" as="section"><div className="mb-3 flex flex-wrap items-center gap-2"><CircleAlert className="size-4" aria-hidden="true" /><h2 className="font-semibold">{t('Needs attention')}</h2><span className="text-sm text-muted-foreground">{data?.attention.length ?? '—'}</span><span className="text-xs text-muted-foreground">{t('Host scope · capped attention preview')}</span></div>
      <Card><CardContent>{data?.attention.length ? <Stagger className="divide-y">{data.attention.map((item, index) => <StaggerItem key={`${item.ref.project ?? 'machine'}-${item.ref.kind}-${item.ref.id}-${index}`} className="py-3 first:pt-0 last:pb-0"><a href={item.ref.href} className="flex min-w-0 items-center gap-3 hover:text-primary"><StatusChip status={statusFromUi(item.ui)} /><span className="min-w-0 flex-1 truncate text-sm" title={formatReason(item.reason)}>{formatReason(item.reason)}</span><span className="hidden text-xs text-muted-foreground sm:block">{whoNames[item.who] ?? item.who}</span><ArrowRight className="size-4 shrink-0" aria-hidden="true" /></a></StaggerItem>)}</Stagger> : !data ? workers.error ? <FeedbackState>{t('The source is unavailable.')}</FeedbackState> : workers.meta ? <FeedbackState>{t('Attention observations have not been recorded.')}</FeedbackState> : <PageSkeleton label={t('Loading…')} /> : <FeedbackState>{workers.error || sourceStale ? t('No attention items were observed in the last read.') : t('Nothing needs attention.')}</FeedbackState>}</CardContent></Card>
    </ConceptBlock>
    <ConceptBlock concept="C2" as="section" className="min-w-0"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">Workflow</h2><div className="flex min-w-0 items-center gap-2"><span className="shrink-0 text-xs text-muted-foreground">{t('Loaded workflows: {n}', { n: data ? visibleWorkflows.length : '—' })}</span><label className="sr-only" htmlFor="workers-project">{t('Project')}</label><Select value={project} onValueChange={setProject}><SelectTrigger id="workers-project" size="sm" className="min-w-0 max-w-48 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{t('All projects')}</SelectItem>{projects.data?.map(item => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div></div>
      <Stagger key={project} className="grid gap-4 md:grid-cols-2">{visibleWorkflows.map(row => <StaggerItem key={`${row.project}/${row.id}`} className="min-w-0"><WorkflowCard row={row} /></StaggerItem>)}</Stagger>
      <p className="mt-2 text-xs text-muted-foreground">{project !== 'all' ? t('Workflow list filtered to {project}', { project }) : t('Workflow cards · all registered projects and phases')}</p>
      {!data && !workers.error && (!workers.meta ? <PageSkeleton label={t('Loading…')} /> : <FeedbackState>{t('Workflow observations have not been recorded.')}</FeedbackState>)}
      {data && visibleWorkflows.length === 0 && <FeedbackState>{incomplete ? t('No matching workflows were observed in the last read.') : t('No matching workflows.')}</FeedbackState>}
      {projects.error && <p className="shell-error" role="status">{t('The source is failing; showing the last read. {error}', { error: projects.error })}</p>}
      {hasUnavailableSources(projects.meta) && <p className="shell-error" role="status">{t('Some sources are unavailable; showing the recorded part.')}</p>}
    </ConceptBlock>
    <section className="flex min-w-0 flex-col gap-4" aria-label={t('System details')}>
      <Advanced variant="card" title={t('Host')} summary={host.data ? `CPU ${count(host.data.cpu.loadPct)} % · RAM ${host.data.ram.usedPct == null ? '—' : count(Math.round(host.data.ram.usedPct))} %` : t('CPU, RAM, GPU, disks')}>{host.error && <p className="shell-error mb-3" role="status">{t('The source is failing; showing the last read. {error}', { error: host.error })}</p>}<HostCard bare /></Advanced>
      <Advanced variant="card" title={t('Models and tokens')} summary={t('Executing and reported attempts · project-ledger tokens')}><div className="flex flex-col gap-4"><ModelsPanel summary={data?.summary} readError={workers.error} sourcePartial={sourceStale} sourceLoaded={workers.meta != null} bare /><KpiExtras summary={data?.summary} /></div></Advanced>
      <Advanced variant="card" title={t('Happening now')} summary={t('Latest recorded events · host scope')}><div className="overflow-hidden"><LiveFeed /></div></Advanced>
      <Advanced variant="card" title={t('System health')} summary={data && healthCount ? <>{t('{n} items · {m} need handling', { n: healthCount, m: healthAttention })}{healthUnknown > 0 ? t(' · {n} unknown', { n: healthUnknown }) : null}</> : t('Health has not been observed.')}>
        <p className="mb-3 text-xs text-muted-foreground">{t('Recorded engine and SLA observations · host scope')}</p>
        <ConceptBlock concept="C13" as="div" className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">{data?.health.items.length ? data.health.items.map(item => <a key={item.key} href={item.href} className="flex min-w-0 items-center gap-2 rounded-lg px-3 py-2 text-xs hover:bg-muted/50"><StatusDot status={statusFromUi(item.ui)} /><span className="font-medium">{healthNames[item.key]}</span><span className="min-w-0 truncate text-muted-foreground" title={item.reason ? formatReason(item.reason) : item.value}>{item.value}</span></a>) : <span className="text-sm text-muted-foreground">{t('Health has not been observed.')}</span>}</ConceptBlock>
      </Advanced>
    </section>
  </div>;
}

export default WorkersPage;
