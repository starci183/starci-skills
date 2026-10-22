import { useState } from 'react';
import { Link } from '@heroui/react';
import { ArrowRight, CircleAlert } from 'lucide-react';
import { refreshQuery, useApiQuery } from '../../api/query';
import type { WorkersViewV2, HostView } from '../../contract';
import { formatAbsolute, formatReason } from '../../i18n/vi';
import { t } from '../../i18n/t';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Select, ListBox, Label } from '../../components/ui/select';
import { ConceptBlock, type Concept } from '../../components/concept';
import { StatusChip, StatusDot } from '../../components/status-chip';
import { statusFromUi } from '../../components/status';
import { KpiExtras, KpiStrip } from '../../components/overview/kpi-strip';
import { WorkflowCard } from '../../components/overview/workflow-card';
import { LiveFeed } from '../../components/overview/live-feed';
import { ModelsPanel } from '../../components/overview/models-panel';
import { hasUnavailableSources } from '../../components/overview/read-state';
import { HostCard } from '../../components/host/host-card';
import { FeedbackState, PageSkeleton, SourceWarning } from '../../components/feedback-state';
import { Advanced, Stagger, StaggerItem } from '../../components/motion';
import { keyByOccurrence } from '../../components/attempt/frame/util';

/** The business concept id (C2) under which the workers page is filed; it is stamped on data-concept so the rendered DOM traces back to its spec. */
export const concept: Concept = 'C2';

const healthNames: Record<string, string> = { engine: 'Engine', services: t('Services'), seats: t('Seats'), ram: 'RAM', sla: 'SLA', leaks: t('Leaks'), gc: t('Cleanup'), land: t('Runtime integration'), providers: t('Providers') };
const whoNames: Record<string, string> = { owner: t('The owner'), supervisor: 'Supervisor', kernel: 'Kernel', controller: 'Controller' };
const count = (value: number | null | undefined) => value == null || !Number.isFinite(value) ? '—' : value;

type AttentionItem = WorkersViewV2['attention'][number];

const inScope = (row: WorkersViewV2['workflows'][number], ledgerId: string | null | undefined, project: string | null | undefined): boolean => {
  if (ledgerId) return row.ledgerId === ledgerId;
  return Boolean(project) && row.project === project;
};

const sourceLabelOf = (store: string | null | undefined): string => {
  if (store === 'machine') return t('Host machine record');
  return store === 'ledger' ? t('Project ledger record') : t('Recorded source');
};

const projectLabelOf = (projectName: string | null | undefined, store: string | null | undefined): string => {
  if (projectName) return t('Project: {project}', { project: projectName });
  return store === 'ledger' ? t('Project not recorded') : t('Host scope');
};

/** Keep the recorded Decision Item lifecycle separate from its attention cause. */
const AttentionRow = ({ item, workflows }: Readonly<{ item: AttentionItem; workflows: WorkersViewV2['workflows'] }>) => {
  const isDecision = item.ref.kind === 'di';
  const cause = formatReason(item.reason);
  const recordedSummary = item.detail?.summary;
  const summary = recordedSummary?.trim() ? recordedSummary : cause;
  const projectName = item.detail?.project?.trim() || item.scope?.project || item.ref.project;
  const nativeWorkflow = item.scope?.workflow;
  const nativeLedger = item.scope?.ledgerId || item.ref.ledgerId;
  const nativeProject = item.scope?.project || item.ref.project;
  // Workflow IDs may repeat across ledgers; a display name requires the same native scope.
  const workflow = nativeWorkflow ? workflows.find(row => row.id === nativeWorkflow && inScope(row, nativeLedger, nativeProject)) : undefined;
  const workflowName = workflow?.name?.trim() || nativeWorkflow || item.detail?.workflow?.trim();
  const recordedStatus = item.detail?.status?.trim();
  const decisionStatus = recordedStatus ? t(recordedStatus.charAt(0).toUpperCase() + recordedStatus.slice(1)) : t('Not recorded.');
  const overdue = isDecision && item.reason.code === 'DECISION_OVERDUE';
  const source = sourceLabelOf(item.scope?.store);
  // A decision deadline breach is an attention signal, not an Attempt verdict.
  const status = isDecision && (item.ui === 'bad' || item.ui === 'warn') ? 'warning' : statusFromUi(item.ui);
  return <Link href={item.ref.href} className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2 text-foreground hover:text-primary hover:no-underline sm:grid-cols-[auto_minmax(0,1fr)_auto]">
    <StatusChip status={status} label={isDecision ? t('DI: {status}', { status: decisionStatus }) : undefined} suffix={overdue ? t('Overdue') : undefined} className="mt-0.5 shrink-0" />
    <span className="col-span-2 row-start-2 flex min-w-0 flex-col gap-1 sm:col-span-1 sm:col-start-2 sm:row-start-1">
      <span className="line-clamp-3 break-words text-sm sm:line-clamp-2" title={summary}>{summary}</span>
      <span className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>{projectLabelOf(projectName, item.scope?.store)}</span>
        {isDecision && <span title={nativeWorkflow || item.detail?.workflow || undefined}>{workflowName ? t('Workflow: {workflow}', { workflow: workflowName }) : t('Workflow not recorded')}</span>}
        <span>{t('Decider role: {who}', { who: whoNames[item.who] ?? item.who })}</span>
      </span>
      {isDecision && Boolean(recordedSummary?.trim()) && !overdue && <span className="break-words text-xs text-muted-foreground">{t('Why attention: {reason}', { reason: cause })}</span>}
      <span className="flex min-w-0 flex-wrap gap-x-2 gap-y-1 text-xs text-muted-foreground"><span>{source}</span><span className="max-w-32 truncate font-mono" title={`${item.ref.kind}:${item.ref.id}`}>{item.ref.kind}:{item.ref.id}</span><span>{t('Open source')}</span></span>
    </span>
    <ArrowRight className="col-start-2 row-start-1 mt-1 size-4 shrink-0 sm:col-start-3" aria-hidden="true" />
  </Link>;
};

type WorkersQuery = ReturnType<typeof useApiQuery<WorkersViewV2>>;
type ProjectsQuery = ReturnType<typeof useApiQuery<{ id: string; name: string; product: string | null }[]>>;
type HostQuery = ReturnType<typeof useApiQuery<HostView>>;

const summaryOf = (workers: WorkersQuery, data: WorkersViewV2 | undefined, needsAttention: number | undefined): string => {
  if (data) return t('{live} workflows running · {bad} need handling · {owner} waiting for the owner', { live: count(data.counts.live), bad: count(needsAttention), owner: count(data.counts.ownerDecisions) });
  if (workers.error) return t('The source is unavailable.');
  return workers.meta ? t('Workflow observations have not been recorded.') : t('Reading the situation…');
};

const attentionIdentity = (item: AttentionItem): string => {
  return `${item.scope?.store ?? (item.ref.project ? 'ledger' : 'machine')}-${item.scope?.ledgerId ?? item.ref.project ?? 'machine'}-${item.ref.kind}-${item.ref.id}`;
};

const AttentionBody = ({ data, workers, sourceStale }: Readonly<{ data: WorkersViewV2 | undefined; workers: WorkersQuery; sourceStale: boolean }>) => {
  if (data?.attention.length) {
    return <Stagger className="divide-y">{keyByOccurrence(data.attention, attentionIdentity).map(({ key, item }) => <StaggerItem key={key} className="py-3 first:pt-0 last:pb-0"><AttentionRow item={item} workflows={data.workflows} /></StaggerItem>)}</Stagger>;
  }
  if (!data) {
    if (workers.error) return <FeedbackState>{t('The source is unavailable.')}</FeedbackState>;
    return workers.meta ? <FeedbackState>{t('Attention observations have not been recorded.')}</FeedbackState> : <PageSkeleton label={t('Loading…')} />;
  }
  return <FeedbackState>{workers.error || sourceStale ? t('No attention items were observed in the last read.') : t('Nothing needs attention.')}</FeedbackState>;
};

const AttentionSection = ({ data, workers, sourceStale }: Readonly<{ data: WorkersViewV2 | undefined; workers: WorkersQuery; sourceStale: boolean }>) => {
  return <ConceptBlock concept="C12" as="section"><div className="mb-3 flex flex-wrap items-center gap-2"><CircleAlert className="size-4" aria-hidden="true" /><h2 className="font-semibold">{t('Needs attention')}</h2><span className="text-sm text-muted-foreground">{data?.attention.length ?? '—'}</span><span className="text-xs text-muted-foreground">{t('Host scope · capped attention preview')}</span></div>
    <Card><CardContent><AttentionBody data={data} workers={workers} sourceStale={sourceStale} /></CardContent></Card>
  </ConceptBlock>;
};

const ProjectSelect = ({ project, onProject, projects }: Readonly<{ project: string; onProject: (project: string) => void; projects: ProjectsQuery }>) => {
  return <Select className="w-full min-w-0 sm:w-48" value={project} onChange={selected => { if (selected !== null) onProject(String(selected)); }}>
    <Label className="text-xs">{t('Project')}</Label>
    <Select.Trigger id="workers-project" className="h-9 w-full min-w-0 text-xs"><Select.Value className="min-w-0 truncate" /><Select.Indicator /></Select.Trigger>
    <Select.Popover><ListBox><ListBox.Item id="all" textValue={t('All projects')}>{t('All projects')}<ListBox.ItemIndicator /></ListBox.Item>{projects.data?.map(item => <ListBox.Item key={item.id} id={item.id} textValue={item.name}>{item.name}<ListBox.ItemIndicator /></ListBox.Item>)}</ListBox></Select.Popover>
  </Select>;
};

const WorkflowEmptyState = ({ data, workers, visibleCount, incomplete }: Readonly<{ data: WorkersViewV2 | undefined; workers: WorkersQuery; visibleCount: number; incomplete: boolean }>) => {
  return <>
    {!data && !workers.error && (!workers.meta ? <PageSkeleton label={t('Loading…')} /> : <FeedbackState>{t('Workflow observations have not been recorded.')}</FeedbackState>)}
    {data && visibleCount === 0 && <FeedbackState>{incomplete ? t('No matching workflows were observed in the last read.') : t('No matching workflows.')}</FeedbackState>}
  </>;
};

const WorkflowSection = ({ data, workers, projects, project, onProject, incomplete }: Readonly<{
  data: WorkersViewV2 | undefined; workers: WorkersQuery; projects: ProjectsQuery; project: string; onProject: (project: string) => void; incomplete: boolean;
}>) => {
  const visibleWorkflows = (data?.workflows ?? []).filter(row => project === 'all' || row.project === project);
  return <ConceptBlock concept="C2" as="section" className="min-w-0"><div className="mb-3 flex flex-wrap items-end justify-between gap-3"><h2 className="font-semibold">Workflow</h2><div className="flex w-full min-w-0 flex-wrap items-end justify-between gap-3 sm:w-auto"><span className="text-xs text-muted-foreground">{t('Loaded workflows: {n}', { n: data ? visibleWorkflows.length : '—' })}</span><ProjectSelect project={project} onProject={onProject} projects={projects} /></div></div>
    <Stagger key={project} className="grid gap-4 md:grid-cols-2">{visibleWorkflows.map(row => <StaggerItem key={`${row.project}/${row.id}`} className="min-w-0"><WorkflowCard row={row} /></StaggerItem>)}</Stagger>
    <p className="mt-2 text-xs text-muted-foreground">{project !== 'all' ? t('Workflow list filtered to {project}', { project }) : t('Workflow cards · all registered projects and phases')}</p>
    <WorkflowEmptyState data={data} workers={workers} visibleCount={visibleWorkflows.length} incomplete={incomplete} />
    {projects.error && <SourceWarning>{projects.data !== null ? t('The source is failing; showing the last read. {error}', { error: projects.error }) : t('Could not read the source: {error}', { error: projects.error })}</SourceWarning>}
    {hasUnavailableSources(projects.meta) && <SourceWarning>{t('Some sources are unavailable; showing the recorded part.')}</SourceWarning>}
  </ConceptBlock>;
};

const HostFailure = ({ host }: Readonly<{ host: HostQuery }>) => {
  if (!host.error) return null;
  return <SourceWarning><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><p><strong className="font-medium">{t('Host')}</strong> · {host.data !== null ? t('The source is failing; showing the last read. {error}', { error: host.error }) : t('Could not read the source: {error}', { error: host.error })}</p><p className="mt-1 text-xs">{host.observedAt !== null ? t('Last successful API read: {at}', { at: formatAbsolute(host.observedAt) }) : t('No successful API read yet')}</p></div><Button variant="outline" size="sm" onClick={() => refreshQuery('/api/host')}>{t('Retry')}</Button></div></SourceWarning>;
};

const hostSummary = (host: HostQuery): string => {
  const data = host.data;
  if (!data) return t('CPU, RAM, GPU, disks');
  return `CPU ${count(data.cpu.loadPct)} % · RAM ${data.ram.usedPct == null ? '—' : count(Math.round(data.ram.usedPct))} %`;
};

const HealthSection = ({ data }: Readonly<{ data: WorkersViewV2 | undefined }>) => {
  const items = data?.health.items ?? [];
  const healthAttention = items.filter(item => item.ui === 'bad' || item.ui === 'warn').length;
  const healthUnknown = items.filter(item => item.ui === 'unknown').length;
  const summary = data && items.length ? <>{t('{n} items · {m} need handling', { n: items.length, m: healthAttention })}{healthUnknown > 0 ? t(' · {n} unknown', { n: healthUnknown }) : null}</> : t('Health has not been observed.');
  return <Advanced variant="card" title={t('System health')} summary={summary}>
    <p className="mb-3 text-xs text-muted-foreground">{t('Recorded engine and SLA observations · host scope')}</p>
    <ConceptBlock concept="C13" as="div" className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">{items.length ? items.map(item => <Link key={item.key} href={item.href} className="flex w-full min-w-0 items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-default/50 hover:no-underline"><StatusDot status={statusFromUi(item.ui)} /><span className="font-medium">{healthNames[item.key]}</span><span className="min-w-0 truncate text-muted-foreground" title={item.reason ? formatReason(item.reason) : item.value}>{item.value}</span></Link>) : <span className="text-sm text-muted-foreground">{t('Health has not been observed.')}</span>}</ConceptBlock>
  </Advanced>;
};

const SystemSection = ({ data, workers, host, sourceStale }: Readonly<{ data: WorkersViewV2 | undefined; workers: WorkersQuery; host: HostQuery; sourceStale: boolean }>) => {
  return <section className="flex min-w-0 flex-col gap-4" aria-label={t('System details')}>
    <HostFailure host={host} />
    <Advanced variant="card" title={t('Host')} summary={hostSummary(host)}><HostCard bare /></Advanced>
    <Advanced variant="card" title={t('Models and tokens')} summary={t('Executing and reported attempts · project-ledger tokens')}><div className="flex flex-col gap-4"><ModelsPanel summary={data?.summary} readError={workers.error} sourcePartial={sourceStale} sourceLoaded={workers.meta != null} bare /><KpiExtras summary={data?.summary} /></div></Advanced>
    <Advanced variant="card" title={t('Happening now')} summary={t('Latest recorded events · host scope')}><div className="overflow-hidden"><LiveFeed /></div></Advanced>
    <HealthSection data={data} />
  </section>;
};

/** Overview page of the host: KPIs, items needing attention, workflow cards per project and the host, model, event and health panels. */
export const WorkersPage = () => {
  const [project, setProject] = useState('all');
  const workers = useApiQuery<WorkersViewV2>('/api/workers?phase=all', { topics: ['workers', 'decisions', 'system'], intervalMs: 20_000 });
  const projects = useApiQuery<{ id: string; name: string; product: string | null }[]>('/api/projects', { topics: ['workers'], intervalMs: 60_000 });
  const host = useApiQuery<HostView>('/api/host', { topics: ['system'], intervalMs: 10_000 });
  const data = workers.data ?? undefined;
  const needsAttention = data?.counts.bad != null && data?.counts.warn != null ? data.counts.bad + data.counts.warn : undefined;
  const summary = summaryOf(workers, data, needsAttention);
  const sourceStale = hasUnavailableSources(workers.meta);
  const incomplete = sourceStale || Boolean(workers.error);
  return <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-6 pb-24 md:gap-8">
    <header className="flex flex-col gap-2"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{t('StarCi / overview')}</p><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('Overview')}</h1><p className="text-sm text-muted-foreground">{summary}<span className="block text-xs">{t('Host scope · registered project ledgers')}{incomplete ? ` · ${t('recorded part')}` : ''}</span></p></header>
    <p className="text-xs text-muted-foreground">{workers.observedAt !== null ? t('Last successful API read: {at}', { at: formatAbsolute(workers.observedAt) }) : t('No successful API read yet')}</p>
    {workers.error && <FeedbackState error onRetry={() => refreshQuery('/api/workers?phase=all')}>{workers.error}</FeedbackState>}
    {sourceStale && <SourceWarning>{t('Some sources are unavailable; showing the recorded part.')}{workers.meta?.stale?.length ? ` ${workers.meta.stale.join(', ')}` : ''}</SourceWarning>}
    <KpiStrip summary={data?.summary} needsAttention={needsAttention} loading={!data && !workers.error && !workers.meta} />
    <p className="-mt-4 text-xs text-muted-foreground">{t('Host KPI totals · project filters apply to workflow cards only')}</p>
    <AttentionSection data={data} workers={workers} sourceStale={sourceStale} />
    <WorkflowSection data={data} workers={workers} projects={projects} project={project} onProject={setProject} incomplete={incomplete} />
    <SystemSection data={data} workers={workers} host={host} sourceStale={sourceStale} />
  </div>;
};

export default WorkersPage;
