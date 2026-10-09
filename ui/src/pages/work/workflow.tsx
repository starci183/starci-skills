import { useEffect, useState } from 'react';
import { Chip, Link } from '@heroui/react';
import { ArrowRight, ChevronRight, Layers3 } from 'lucide-react';
import { refreshQuery, useApiQuery, usePagedApiQuery, type QuerySnapshot } from '../../api/query';
import type { AttemptRow, ContractInfo, DecisionRow, LegRow, MediaItem, PipelineView, ReadSource, TimelineItem, UnitRow, WorkflowDetailV2 } from '../../contract';
import { formatAbsolute, formatOpLabel, formatReason, unitStateLabels } from '../../i18n/vi';
import { t } from '../../i18n/t';
import { StatusChip, StatusDot } from '../../components/status-chip';
import { statusFromUi, statusFromUnit } from '../../components/status';
import { WorkflowHeader } from '../../components/work/pipeline/header';
import { PipelineGraph } from '../../components/work/pipeline-graph';
import { AttemptGantt } from '../../components/work/attempt-gantt';
import { LegDrawer } from '../../components/work/leg-drawer';
import { WorkflowInfraCard } from '../../components/work/infra-card';
import { WorkGraphSlices } from '../../components/work/work-graph-slices';
import { ReasonLine } from '../../components/reason-line';
import { WhyOwnerBadge } from '../../components/why/why-block';
import { FeedbackState, PageSkeleton } from '../../components/feedback-state';
import { partialSources } from '../../components/charts/chart-card';
import { ConceptBlock, type Concept } from '../../components/concept';
import { LifecycleBar, type UnitState } from '../../components/lifecycle-bar';
import { GraphView, type WorkGraph } from '../../components/work/graph';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Table } from '../../components/ui/table';
import { PathLink } from '../../components/path-link';
import { Button } from '../../components/ui/button';
import { Tabs } from '../../components/ui/tabs';
import { Advanced, Stagger, StaggerItem } from '../../components/motion';
import { routeHref, useRoute, type WorkflowTab } from '../../router';

export const concept: Concept = 'C2';

const tabs: { id: WorkflowTab; label: string; concept: string }[] = [
  { id: 'units', label: t('Units'), concept: 'C4' },
  { id: 'attempts', label: t('Attempts'), concept: 'C7' }, { id: 'decisions', label: t('Decisions'), concept: 'C5' },
  { id: 'why', label: t('Why'), concept: 'C2' }, { id: 'timeline', label: t('Timeline'), concept: 'C17' },
  { id: 'evidence', label: t('Evidence'), concept: 'C11' }, { id: 'infra', label: t('Infrastructure'), concept: 'C15' },
];
const rootHref = (project: string, wf: string) => `#/w/${encodeURIComponent(project)}/${encodeURIComponent(wf)}`;
const query = () => new URL(window.location.hash.slice(1) || '/', window.location.origin).searchParams;
type DecisionLog = { id: string; key: string; store: string; ledgerId: string | null; workflowId: string | null; decider: string; choice: string; rationale: string | null; at: number; di: { href: string } | null };
type MetricRead<T> = { snapshot: { id: number; kind: string; at: number | null; windowMs: number | null; subject: string | null; dataSha: string | null; payloadSource: 'blob' | 'inline'; ageMs: number | null }; payload: T };
type Rca = { schema: string; attempts: number; windowMs: number; clusters: { cause: string; count: number; open: number; why: string; authority: string }[]; actions?: { rank?: number; key: string; title: string; expected: string; unblocks: number }[] };
type Coverage = { schema: string; summary: { total: number; proven: number; stale: number; missing: number; mustOwed: number }; graphVersion: number | null };
type Verify = { schema: string; ok: boolean; files: { checked: number; intact: number; unchained: number }; chain: { events: number; ok: boolean } };
type Worktree = { kind: string; branch: string | null; path: string; repoRoot: string | null; lane: string | null; port: number | null; baseSha: string | null; headSha: string | null; jobId: string | null; attempt: number | null; ui: 'bad' | 'warn' | 'running' | 'waiting' | 'ok' | 'done' | 'unknown'; createdAt: number; removedAt: number | null; removeError: string | null };
type UnitEdge = { id: string; href: string; from: string; to: string; kind: string; source: string; createdAt: number };

function Panel({ title, children, concept, embedded = false }: { readonly title: string; readonly children: React.ReactNode; readonly concept: 'C1' | 'C2' | 'C4' | 'C5' | 'C12' | 'C15' | 'C17' | 'C11' | 'C7'; readonly embedded?: boolean }) {
  return <ConceptBlock concept={concept} as="section" className="min-w-0">
    <Card inset={embedded ? 'none' : undefined} variant={embedded ? 'transparent' : undefined}>
      <CardHeader><CardTitle>{embedded ? <h3>{title}</h3> : <h2>{title}</h2>}</CardTitle></CardHeader>
      <CardContent className="flex min-w-0 flex-col gap-4">{children}</CardContent>
    </Card>
  </ConceptBlock>;
}

function ReadAlerts({ snapshot, url, label }: { readonly snapshot: QuerySnapshot<unknown>; readonly url: string; readonly label?: string }) {
  const prefix = label ? `${label} · ` : '';
  const partial = partialSources(snapshot);
  if (snapshot.meta && !snapshot.error && !partial.length) return null;
  return <div className="space-y-2">
    {snapshot.error && <FeedbackState error onRetry={() => refreshQuery(url)}>{prefix}{snapshot.meta ? t('The source is failing; showing the last read. {error}', { error: snapshot.error }) : snapshot.error}</FeedbackState>}
    {!snapshot.meta && !snapshot.error && !partial.length && <output className="block text-xs text-muted-foreground">{prefix}{t('Loading…')}</output>}
    {partial.length ? <FeedbackState error onRetry={() => refreshQuery(url)}>{prefix}{t('Source out of sync: {list}', { list: partial.join(', ') })}</FeedbackState> : null}
  </div>;
}

function SourceFacts({ sources }: { readonly sources: ReadSource[] }) {
  return <ul className="flex min-w-0 flex-col gap-2 text-xs text-muted-foreground">{sources.map((source, index) => <li key={`${source.db}:${source.rel}:${index}`} className="min-w-0 space-y-1">
    <p className="break-all font-mono">{source.db}:{source.rel} · {source.availability ?? t('Unknown')}{source.code ? ` · ${source.code}` : ''}</p>
    <p>{t('Observed {at}', { at: formatAbsolute(source.at) })} · {t('Read at')} {formatAbsolute(source.readAt)}</p>
    {source.error && <p className="whitespace-pre-wrap break-words">{source.error}</p>}
  </li>)}</ul>;
}

function ReadState({ snapshot, url, label, includeAlerts = true }: { readonly snapshot: QuerySnapshot<unknown>; readonly url: string; readonly label?: string; readonly includeAlerts?: boolean }) {
  const prefix = label ? `${label} · ` : '';
  return <div className="space-y-2">
    {includeAlerts && <ReadAlerts snapshot={snapshot} url={url} label={label} />}
    {snapshot.meta && <>
      <p className="text-xs text-muted-foreground">{prefix}{t('Read observed {at}', { at: formatAbsolute(snapshot.observedAt) })}</p>
      <Advanced keepMounted title={t('Read metadata')} className="text-xs text-muted-foreground"><div className="flex flex-col gap-4"><p>{t('Response assembled {at}', { at: formatAbsolute(snapshot.meta.at) })}</p><SourceFacts sources={snapshot.meta.sources} /></div></Advanced>
    </>}
    {snapshot.errorMeta && <Advanced keepMounted title={`${prefix}${t('Failed read metadata')}`} className="text-xs text-muted-foreground"><div className="flex flex-col gap-4"><p>{t('Response assembled {at}', { at: formatAbsolute(snapshot.errorMeta.at) })}{snapshot.errorCode ? ` · ${snapshot.errorCode}` : ''}</p><SourceFacts sources={snapshot.errorMeta.sources} /></div></Advanced>}
    {snapshot.meta?.next && <p className="text-xs text-muted-foreground">{t('More rows are available; this view shows one page.')}</p>}
  </div>;
}

function MoreRows({ read, includeFailure = true }: { readonly read: { data: unknown[] | null; next: string | null; loadingMore: boolean; loadMoreError: string | null; loadMore: () => void }; readonly includeFailure?: boolean }) {
  return <div className="space-y-2 text-xs text-muted-foreground">
    {read.data && <p>{t('Loaded {n} rows · page scope; live data may change.', { n: read.data.length })}</p>}
    {includeFailure && read.loadMoreError && <FeedbackState error onRetry={read.loadMore}>{read.loadMoreError}</FeedbackState>}
    {read.next && <Button size="sm" variant="outline" disabled={read.loadingMore} onClick={read.loadMore}>{read.loadingMore ? t('Loading…') : t('Load more')}</Button>}
  </div>;
}

function SnapshotFacts({ read }: { readonly read: MetricRead<unknown> }) {
  const snapshot = read.snapshot;
  return <div className="flex min-w-0 flex-col gap-2 text-xs text-muted-foreground">
    <p className="flex flex-wrap gap-x-3 gap-y-1"><span>{t('Snapshot #{id} · recorded {at}', { id: snapshot.id, at: formatAbsolute(snapshot.at) })}</span><span>{snapshot.payloadSource}</span>{snapshot.windowMs != null && <span>{t('Window {n} hours', { n: snapshot.windowMs / 3_600_000 })}</span>}</p>
    <Advanced keepMounted title={t('Snapshot provenance')}><dl className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2">
      <dt>{t('Kind')}</dt><dd className="break-all font-mono">{snapshot.kind}</dd>
      <dt>{t('Subject')}</dt><dd className="break-all font-mono">{snapshot.subject ?? t('not recorded')}</dd>
      <dt>SHA</dt><dd className="break-all font-mono">{snapshot.dataSha ?? t('not recorded')}</dd>
    </dl></Advanced>
  </div>;
}

function RecordedPayload({ value }: { readonly value: unknown }) {
  return <Advanced title={t('Recorded payload')} keepMounted><pre className="min-w-0 whitespace-pre-wrap break-all text-xs text-muted-foreground">{JSON.stringify(value, null, 2)}</pre></Advanced>;
}

function UnitFacts({ unit }: { readonly unit: UnitRow }) {
  return <div className="flex min-w-0 flex-col gap-2 text-xs text-muted-foreground">
    <p className="flex flex-wrap gap-x-3 gap-y-1"><span>{t('Goal revision {n}', { n: unit.goalRevision })}</span><span>{t('Recorded try #{tries} · unit budget {budget}', { tries: unit.tries, budget: unit.tryBudget })}</span><span>{t('{n} dispatches', { n: unit.attempts })}</span></p>
    <dl className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1">
      <dt>{t('Unit')}</dt><dd className="break-all font-mono">{unit.unit}</dd>
      <dt>{t('Op')}</dt><dd className="break-all font-mono">{unit.op}</dd>
      <dt>{t('Subject')}</dt><dd className="break-all font-mono">{unit.subjectKey}</dd>
    </dl>
    <p className="break-all">{t('Current job {job}', { job: unit.currentJob ?? t('not recorded') })}</p>
  </div>;
}

function UnitDetail({ project, wf, selected, state, graphMode }: { readonly project: string; readonly wf: string; readonly selected: string | null; readonly state: string | null; readonly graphMode: boolean }) {
  const url = selected ? `/api/workflows/${encodeURIComponent(project)}/${encodeURIComponent(wf)}/units/${encodeURIComponent(selected)}` : '';
  const detail = useApiQuery<{ unit: UnitRow; attempts: AttemptRow[]; edges: { in: UnitEdge[]; out: UnitEdge[] }; decisions: { id: string; choice: string; rationale: string | null; at: number }[]; blockedBy: { reason: { code: string; params: Record<string, string | number> }; ui: UnitRow['ui'] }[] }>(url, { enabled: Boolean(selected), topics: [`wf:${project}:${wf}`, 'system'], intervalMs: 20_000 });
  const contract = useApiQuery<ContractInfo>('/api/contract', { enabled: Boolean(selected), topics: ['system'], intervalMs: 60_000 });
  if (!selected) return <p className="text-sm text-muted-foreground">{t('Pick an Op group or a unit to see details.')}</p>;
  const closeParams = query(); closeParams.set('tab', 'units'); closeParams.delete('unit');
  if (graphMode) closeParams.set('view', 'graph'); else closeParams.delete('view');
  if (state) closeParams.set('state', state); else closeParams.delete('state');
  return <section className="flex min-w-0 flex-col gap-4 border-t pt-4">
    <Link href={`${rootHref(project, wf)}?${closeParams}`} className="w-fit text-xs text-muted-foreground">{t('Close details')}</Link>
    <ReadState snapshot={detail} url={url} />
    {detail.data && <>
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-wrap items-start justify-between gap-3"><h3 className="min-w-0 break-words text-sm font-semibold">{formatOpLabel(detail.data.unit.op, contract.data?.opLabels)}</h3><StatusChip status={statusFromUnit(detail.data.unit.state)} label={unitStateLabels[detail.data.unit.state]} /></div>
        {detail.data.unit.title !== detail.data.unit.unit && detail.data.unit.title !== detail.data.unit.op && <p className="break-words text-sm text-muted-foreground">{detail.data.unit.title}</p>}
        <UnitFacts unit={detail.data.unit} />
      </div>
      {detail.data.blockedBy.map(blocker => <ReasonLine key={JSON.stringify(blocker.reason)} reason={blocker.reason} />)}
      {detail.data.attempts.length > 0 && <div className="divide-y">{detail.data.attempts.map(attempt => <Link key={attempt.id} href={attempt.href} className="flex w-full min-w-0 items-start gap-3 py-3 text-sm text-foreground"><StatusDot status={statusFromUi(attempt.ui)} /><span className="min-w-0 flex-1"><span className="block">#{attempt.id} · {t('job try {n} · dispatch {dispatch}', { n: attempt.attempt, dispatch: attempt.dispatchSeq })}</span><span className="block break-all text-xs text-muted-foreground">{attempt.job} · {attempt.agent ?? t('unknown agent')}</span></span><ArrowRight className="size-4 shrink-0" aria-hidden="true" /></Link>)}</div>}
      <Advanced summary={t('Recorded dependencies and decisions')}>
        <div className="flex min-w-0 flex-col gap-4">
          {(['in', 'out'] as const).map(direction => <div key={direction} className="flex min-w-0 flex-col gap-2"><strong className="text-xs">{direction === 'in' ? t('Predecessors') : t('Dependents')}</strong>{detail.data!.edges[direction].map(edge => <Link key={`${edge.from}:${edge.to}:${edge.kind}`} href={edge.href} className="block break-all text-xs text-muted-foreground">{edge.from} → {edge.to} · {edge.kind} · {edge.source} · {formatAbsolute(edge.createdAt)}</Link>)}</div>)}
          {detail.data.decisions.map(decision => <div key={decision.id} className="space-y-2 border-t pt-4 text-xs"><p><strong>{decision.choice}</strong> · {formatAbsolute(decision.at)}</p>{decision.rationale && <p>{decision.rationale}</p>}</div>)}
        </div>
      </Advanced>
    </>}
  </section>;
}

function UnitsTab({ project, wf, graph, graphTab }: { readonly project: string; readonly wf: string; readonly graph: QuerySnapshot<WorkGraph>; readonly graphTab: boolean }) {
  const state = query().get('state');
  const url = `/api/workflows/${encodeURIComponent(project)}/${encodeURIComponent(wf)}/units?limit=200${state ? `&state=${encodeURIComponent(state)}` : ''}`;
  const units = usePagedApiQuery<UnitRow>(url, { topics: [`wf:${project}:${wf}`, 'system'], intervalMs: 20_000, getKey: unit => `${unit.workflowId}:${unit.unit}` });
  const contract = useApiQuery<ContractInfo>('/api/contract', { topics: ['system'], intervalMs: 60_000 });
  const selected = query().get('unit');
  const graphMode = graphTab || query().get('view') === 'graph';
  const href = (unit: string | null, filter = state, view = graphMode) => {
    const params = query(); params.set('tab', 'units'); params.delete('unit'); params.delete('state'); params.delete('view');
    if (unit) params.set('unit', unit); if (filter) params.set('state', filter); if (view) params.set('view', 'graph');
    return `${rootHref(project, wf)}?${params}`;
  };
  const rank: Record<UnitRow['ui'], number> = { bad: 0, running: 1, warn: 2, waiting: 3, unknown: 4, ok: 5, done: 6 };
  const rows = [...units.data ?? []].sort((a, b) => rank[a.ui] - rank[b.ui] || b.updatedAt - a.updatedAt);
  const graphData = graph.data;
  const counts = graphData ? Object.fromEntries(['planned', 'queued', 'running', 'reported', 'deciding', 'done', 'failed', 'dropped'].map(value => [value, graphData.nodes.filter(node => node.state === value).length])) as Record<UnitState, number> : null;
  const graphUrl = `/api/workflows/${encodeURIComponent(project)}/${encodeURIComponent(wf)}/graph`;
  return <Panel title={t('Units · {n}', { n: graphMode ? graphData?.nodes.length ?? '—' : units.meta ? rows.length : '—' })} concept="C4">
    <ReadState snapshot={graph} url={graphUrl} label={t('Unit graph')} />
    <Tabs selectedKey={graphMode ? 'graph' : 'list'} variant="secondary" className="min-w-0 gap-4">
      <Tabs.List aria-label={t('Units')}><Tabs.Tab id="list" href={href(selected, state, false)}>{t('List')}<Tabs.Indicator /></Tabs.Tab><Tabs.Tab id="graph" href={href(selected, null, true)}>{t('Unit graph')}<Tabs.Indicator /></Tabs.Tab></Tabs.List>
      <Tabs.Panel id="graph" className="min-w-0">{graphMode && graph.data && <GraphView graph={graph.data} opLabels={contract.data?.opLabels} onUnit={unit => { window.location.hash = href(unit, null, true); }} />}</Tabs.Panel>
      <Tabs.Panel id="list" className="flex min-w-0 flex-col gap-4">{!graphMode && <>
        <ReadState snapshot={units} url={url} label={t('List')} />
        {counts && <LifecycleBar counts={counts} selected={state as UnitState | null} onSelect={value => { window.location.hash = href(null, state === value ? null : value); }} />}
        {state && <Link className="w-fit text-xs" href={href(null, null)}>{t('Clear the {state} filter', { state: unitStateLabels[state as UnitState] ?? state })}</Link>}
        <div className="hidden min-w-0 min-[760px]:block"><Table variant="secondary"><Table.ScrollContainer><Table.Content aria-label={t('Units')} className="min-w-[760px]">
          <Table.Header>
            <Table.Column id="work" isRowHeader>{t('Work')}</Table.Column>
            <Table.Column id="state">{t('State')}</Table.Column>
            <Table.Column id="scope">{t('Scope')}</Table.Column>
            <Table.Column id="dispatches">{t('Dispatches')}</Table.Column>
            <Table.Column id="updated">{t('Updated')}</Table.Column>
          </Table.Header>
          <Table.Body>{rows.map(unit => <Table.Row id={`${unit.workflowId}:${unit.unit}`} key={`${unit.workflowId}:${unit.unit}`} href={href(unit.unit)}>
            <Table.Cell className="max-w-[360px] align-top"><div className="flex min-w-0 flex-col gap-1"><p className="break-words font-medium">{formatOpLabel(unit.op, contract.data?.opLabels)}</p>{unit.title !== unit.unit && unit.title !== unit.op && <p className="whitespace-pre-wrap break-words text-xs text-muted-foreground">{unit.title}</p>}</div></Table.Cell>
            <Table.Cell className="align-top"><StatusChip status={statusFromUnit(unit.state)} label={unitStateLabels[unit.state]} /></Table.Cell>
            <Table.Cell className="max-w-[280px] align-top"><div className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground"><p>{t('Goal revision {n}', { n: unit.goalRevision })}</p><p className="break-words [overflow-wrap:anywhere]">{unit.subjectKey}</p></div></Table.Cell>
            <Table.Cell className="align-top tabular-nums">{unit.attempts}</Table.Cell>
            <Table.Cell className="align-top"><div className="flex items-start justify-between gap-3 text-xs text-muted-foreground"><span>{formatAbsolute(unit.updatedAt)}</span><ChevronRight className="size-4 shrink-0" aria-hidden="true" /></div></Table.Cell>
          </Table.Row>)}</Table.Body>
        </Table.Content></Table.ScrollContainer></Table></div>
        <div className="divide-y min-[760px]:hidden">{rows.map(unit => <Card key={`${unit.workflowId}:${unit.unit}`} inset="none" variant="transparent"><CardContent>
          <Link href={href(unit.unit)} className="flex w-full min-w-0 items-start gap-3 py-4 text-foreground">
            <span className="flex min-w-0 flex-1 flex-col gap-2">
              <span className="flex flex-wrap items-start justify-between gap-3"><span className="min-w-0 break-words text-sm font-medium">{formatOpLabel(unit.op, contract.data?.opLabels)}</span><StatusChip status={statusFromUnit(unit.state)} label={unitStateLabels[unit.state]} /></span>
              {unit.title !== unit.unit && unit.title !== unit.op && <span className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{unit.title}</span>}
              <span className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground"><span>{t('Goal revision {n}', { n: unit.goalRevision })}</span><span className="break-words [overflow-wrap:anywhere]">{unit.subjectKey}</span></span>
              <span className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground"><span>{t('{n} dispatches', { n: unit.attempts })}</span><span>{t('Updated')} {formatAbsolute(unit.updatedAt)}</span></span>
            </span><ChevronRight className="mt-1 size-4 shrink-0" aria-hidden="true" />
          </Link>
        </CardContent></Card>)}</div>
        {units.meta && !units.error && !partialSources(units).length && !rows.length && <p className="text-sm text-muted-foreground">{t('No matching units.')}</p>}
        <MoreRows read={units} />
      </>}</Tabs.Panel>
    </Tabs>
    {selected && <UnitDetail project={project} wf={wf} selected={selected} state={state} graphMode={graphMode} />}
  </Panel>;
}

/** Refine the broad running projection only when recorded report and unsettled attempt custody agree. */
function attemptListStatus(attempt: AttemptRow) {
  const status = statusFromUi(attempt.ui);
  const open = attempt.dispatchedAt != null && attempt.settledAt == null && attempt.endState == null && attempt.verdict == null;
  const reported = attempt.reportedAt != null || attempt.reportOutcome != null;
  return status === 'running' && open && reported ? 'settling' : status;
}

function AttemptsTab({ project, wf }: { readonly project: string; readonly wf: string }) {
  const url = `/api/attempts?project=${encodeURIComponent(project)}&wf=${encodeURIComponent(wf)}&limit=200`;
  const attempts = usePagedApiQuery<AttemptRow>(url, { topics: [`wf:${project}:${wf}`, 'system'], intervalMs: 30_000, getKey: attempt => String(attempt.id) });
  const contract = useApiQuery<ContractInfo>('/api/contract', { topics: ['system'], intervalMs: 60_000 });
  return <Panel title={t('Attempts')} concept="C7">
    <ReadState snapshot={attempts} url={url} />
    <div className="divide-y">{attempts.data?.map(item => {
      const status = attemptListStatus(item);
      return <Link key={item.id} href={item.href} className="flex w-full min-w-0 items-start gap-3 py-4 text-sm text-foreground">
      <span className="flex min-w-0 flex-1 flex-col gap-2">
        <span className="flex flex-wrap items-start justify-between gap-3"><span className="min-w-0 break-words font-medium">{formatOpLabel(item.op, contract.data?.opLabels)}</span><StatusChip status={status} label={status === 'settling' ? t('Awaiting settlement') : undefined} /></span>
        {item.summary && <span className="whitespace-pre-wrap break-words text-muted-foreground">{item.summary}</span>}
        <span className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground"><span>{t('Attempt #{id}', { id: item.id })}</span><span>{t('job try {n} · dispatch {dispatch}', { n: item.attempt, dispatch: item.dispatchSeq })}</span><span>{item.agent ?? t('unknown agent')}</span><span>{formatAbsolute(item.dispatchedAt)}</span></span>
        <span className="break-all font-mono text-xs text-muted-foreground">{t('Unit {unit} · job {job}', { unit: item.unit ?? t('not recorded'), job: item.job })}</span>
        <span className="break-all font-mono text-xs text-muted-foreground">{item.op}</span>
      </span><ArrowRight className="size-4 shrink-0" aria-hidden="true" />
    </Link>;
    })}</div>
    {attempts.meta && !attempts.error && !partialSources(attempts).length && !attempts.data?.length && <p className="text-sm text-muted-foreground">{t('No attempts yet.')}</p>}<MoreRows read={attempts} />
  </Panel>;
}

function DecisionsTab({ project, wf }: { readonly project: string; readonly wf: string }) {
  const open = usePagedApiQuery<DecisionRow>(`/api/decisions?project=${encodeURIComponent(project)}&wf=${encodeURIComponent(wf)}&limit=200`, { topics: ['decisions'], intervalMs: 20_000, getKey: item => item.key });
  const log = usePagedApiQuery<DecisionLog>(`/api/decisions/log?project=${encodeURIComponent(project)}&wf=${encodeURIComponent(wf)}&limit=200`, { topics: [`wf:${project}:${wf}`, 'system'], intervalMs: 60_000, getKey: item => item.key });
  return <div className="flex min-w-0 flex-col gap-6 min-[760px]:gap-8">
    <Panel title={t('Awaiting decision')} concept="C12">
      <ReadState snapshot={open} url={`/api/decisions?project=${encodeURIComponent(project)}&wf=${encodeURIComponent(wf)}&limit=200`} />
      <div className="divide-y">{open.data?.map(item => <article key={item.key} className="flex min-w-0 flex-col gap-3 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3"><div className="flex flex-wrap items-center gap-2"><StatusChip status={statusFromUi(item.ui)} label={item.status} /><Chip size="sm" variant="tertiary"><Chip.Label>{item.kind}</Chip.Label></Chip><WhyOwnerBadge owner={item.decider} /></div><span className="text-xs text-muted-foreground">{formatAbsolute(item.openedAt)}{item.overdue ? t(' · overdue') : ''}</span></div>
        <Link href={item.href} className="flex w-full min-w-0 items-start gap-3 text-sm font-medium text-foreground"><span className="min-w-0 flex-1 whitespace-pre-wrap break-words">{item.summary}</span><ArrowRight className="size-4 shrink-0" aria-hidden="true" /></Link>
        <p className="break-all font-mono text-xs text-muted-foreground">{item.store} · {item.id}</p>
        <RecordedPayload value={item} />
      </article>)}</div>
      {open.meta && !open.error && !partialSources(open).length && !open.data?.length && <p className="text-sm text-muted-foreground">{t('No pending decisions.')}</p>}<MoreRows read={open} />
    </Panel>
    <Panel title={t('Decision log')} concept="C5">
      <ReadState snapshot={log} url={`/api/decisions/log?project=${encodeURIComponent(project)}&wf=${encodeURIComponent(wf)}&limit=200`} />
      <div className="divide-y">{log.data?.map(item => <article key={item.key} className="flex min-w-0 flex-col gap-3 py-4 text-sm">
        <div className="flex flex-wrap items-start justify-between gap-3"><div className="flex flex-wrap items-center gap-2"><Chip size="sm" variant="secondary"><Chip.Label>{item.choice}</Chip.Label></Chip><WhyOwnerBadge owner={item.decider} /></div><span className="text-xs text-muted-foreground">{item.store} · {formatAbsolute(item.at)}</span></div>
        {item.rationale && <p className="whitespace-pre-wrap break-words text-muted-foreground">{item.rationale}</p>}
        <p className="break-all font-mono text-xs text-muted-foreground">{item.id}</p>
        {item.di && <Link href={item.di.href} className="w-fit text-xs">{t('Open the decision')}</Link>}
        <RecordedPayload value={item} />
      </article>)}</div>
      {log.meta && !log.error && !partialSources(log).length && !log.data?.length && <p className="text-sm text-muted-foreground">{t('No settled decisions yet.')}</p>}<MoreRows read={log} />
    </Panel>
  </div>;
}

function WhyTab({ project, wf }: { readonly project: string; readonly wf: string }) {
  const url = `/api/workflows/${encodeURIComponent(project)}/${encodeURIComponent(wf)}/rca`;
  const rca = useApiQuery<MetricRead<Rca> | null>(url, { topics: [`wf:${project}:${wf}`, 'system'], intervalMs: 60_000 });
  const payload = rca.data?.payload;
  return <Panel title={t('Why · cause analysis')} concept="C2">
    <ReadState snapshot={rca} url={url} />
    {rca.data && payload ? <>
      <SnapshotFacts read={rca.data} />
      <p className="text-xs text-muted-foreground">{t('{n} recorded attempts · window {hours} hours', { n: payload.attempts, hours: payload.windowMs / 3_600_000 })}</p>
      <section className="flex min-w-0 flex-col gap-4">
        <h3 className="text-sm font-semibold">{t('Recorded cause analysis')}</h3>
        <div className="divide-y">{payload.clusters.map((cluster, index) => <article key={`${cluster.cause}-${index}`} className="flex min-w-0 flex-col gap-3 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3"><div className="flex min-w-0 flex-wrap items-center gap-2"><Chip size="sm" variant="tertiary"><Chip.Label>{cluster.cause}</Chip.Label></Chip><WhyOwnerBadge owner={cluster.authority} /></div><span className="text-xs tabular-nums text-muted-foreground">{t('{open}/{count} open', { open: cluster.open, count: cluster.count })}</span></div>
          <p className="whitespace-pre-wrap break-words text-sm">{cluster.why}</p>
          <RecordedPayload value={cluster} />
        </article>)}</div>
      </section>
      {payload.actions?.length ? <section className="flex min-w-0 flex-col gap-4 border-t pt-4">
        <h3 className="text-sm font-semibold">{t('Suggested actions')}</h3>
        <p className="text-xs text-muted-foreground">{t('Recorded candidates; execution and results are not established by this snapshot.')}</p>
        <div className="divide-y">{payload.actions.map(action => <article key={action.key} className="flex min-w-0 flex-col gap-3 py-4 text-sm">
          <div className="flex min-w-0 items-start gap-3">{action.rank != null && <span className="shrink-0 tabular-nums text-muted-foreground">#{action.rank}</span>}<h4 className="min-w-0 whitespace-pre-wrap break-words font-medium">{action.title}</h4></div>
          <p className="whitespace-pre-wrap break-words text-muted-foreground">{action.expected}</p>
          <p className="text-xs text-muted-foreground">{t('Recorded unblocks: {n}', { n: action.unblocks })}</p>
          <RecordedPayload value={action} />
        </article>)}</div>
      </section> : null}
      <RecordedPayload value={rca.data} />
    </> : rca.meta && !rca.error && !partialSources(rca).length ? <p className="text-sm text-muted-foreground">{t('No analysis yet.')}</p> : null}
  </Panel>;
}

function TimelineTab({ project, wf }: { readonly project: string; readonly wf: string }) {
  const url = `/api/timeline?project=${encodeURIComponent(project)}&wf=${encodeURIComponent(wf)}&limit=200`;
  const timeline = usePagedApiQuery<TimelineItem>(url, { topics: [`wf:${project}:${wf}`, 'system'], intervalMs: 30_000, getKey: item => item.key });
  return <Panel title={t('Timeline')} concept="C17"><ReadState snapshot={timeline} url={url} />
    <div className="divide-y">{timeline.data?.map(item => {
      const recorded = item.detail != null && typeof item.detail === 'object' && !Array.isArray(item.detail) ? item.detail as Record<string, unknown> : null;
      return <article key={item.key} className="flex min-w-0 flex-col gap-3 py-4 text-sm">
        <div className="flex flex-wrap items-start justify-between gap-3"><div className="flex min-w-0 flex-wrap items-center gap-2"><Chip size="sm" variant="tertiary" className="h-auto max-w-full whitespace-normal"><Chip.Label className="break-words">{item.kind}</Chip.Label></Chip><StatusChip status={statusFromUi(item.ui)} /></div><span className="text-xs text-muted-foreground">{item.source} · {formatAbsolute(item.at)}</span></div>
        <p className="whitespace-pre-wrap break-words">{item.title}</p>
        {item.source === 'decision' && typeof recorded?.rationale === 'string' && <p className="whitespace-pre-wrap break-words text-muted-foreground">{recorded.rationale}</p>}
        {item.source === 'action' && recorded && <div className="flex min-w-0 flex-col gap-2 text-xs text-muted-foreground">
          <p>{t('Recorded result summary')}</p>
          <div className="flex flex-wrap gap-2">{(['ok', 'code', 'timedOut', 'fenced'] as const).map(field => {
            const value = recorded[field];
            return typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string' ? <Chip key={field} size="sm" variant="tertiary"><Chip.Label>{field}: {String(value)}</Chip.Label></Chip> : null;
          })}</div>
          {typeof recorded.error === 'string' && <p className="whitespace-pre-wrap break-words">{recorded.error}</p>}
        </div>}
        {item.ref && <div className="flex min-w-0 flex-wrap items-center justify-between gap-3"><p className="min-w-0 break-all font-mono text-xs text-muted-foreground">{item.ref.kind}:{item.ref.id}</p><Link href={item.ref.href} className="shrink-0 text-xs">{t('Open details')}<ArrowRight className="size-4" aria-hidden="true" /></Link></div>}
        <p className="break-all font-mono text-xs text-muted-foreground">{item.id}</p>
        {item.detail != null && <RecordedPayload value={item.detail} />}
      </article>;
    })}</div>
    {timeline.meta && !timeline.error && !partialSources(timeline).length && !timeline.data?.length && <p className="text-sm text-muted-foreground">{t('No timeline yet.')}</p>}<MoreRows read={timeline} />
  </Panel>;
}

function EvidenceTab({ project, wf }: { readonly project: string; readonly wf: string }) {
  const base = `/api/workflows/${encodeURIComponent(project)}/${encodeURIComponent(wf)}`;
  const mediaUrl = `/api/media?project=${encodeURIComponent(project)}&wf=${encodeURIComponent(wf)}&limit=200`;
  const media = usePagedApiQuery<MediaItem>(mediaUrl, { topics: [`wf:${project}:${wf}`, 'system'], intervalMs: 60_000, getKey: item => String(item.artifactId) });
  const coverage = useApiQuery<MetricRead<Coverage> | null>(`${base}/coverage`, { topics: [`wf:${project}:${wf}`, 'system'], intervalMs: 60_000 });
  const verify = useApiQuery<MetricRead<Verify> | null>(`${base}/verify`, { topics: [`wf:${project}:${wf}`, 'system'], intervalMs: 60_000 });
  const proof = coverage.data?.payload;
  const integrity = verify.data?.payload;
  return <Panel title={t('Evidence')} concept="C11">
    <div className="grid min-w-0 gap-6 text-xs min-[760px]:gap-8 lg:grid-cols-2">
      <Panel embedded title={t('Proof coverage')} concept="C11"><ReadState snapshot={coverage} url={`${base}/coverage`} />{coverage.data && proof ? <>
        <SnapshotFacts read={coverage.data} />
        <p className="text-sm">{t('{proven}/{total} proven · {stale} stale · {missing} missing · {owed} must-have owed', { proven: proof.summary.proven, total: proof.summary.total, stale: proof.summary.stale, missing: proof.summary.missing, owed: proof.summary.mustOwed })}</p>
        <p className="text-muted-foreground">{t('Graph version {n}', { n: proof.graphVersion ?? t('Unknown') })}</p>
        <RecordedPayload value={coverage.data} />
      </> : coverage.meta && !coverage.error && !partialSources(coverage).length ? <p className="text-muted-foreground">{t('No coverage snapshot yet')}</p> : null}</Panel>
      <Panel embedded title={t('Proof integrity')} concept="C11"><ReadState snapshot={verify} url={`${base}/verify`} />{verify.data && integrity ? <>
        <SnapshotFacts read={verify.data} />
        <StatusChip className="w-fit" status={integrity.ok ? 'success' : 'failed'} label={integrity.ok ? t('Proof integrity passed') : t('Proof integrity failed')} />
        <p className="text-sm">{t('{intact}/{checked} files intact · {unchained} unchained · {events} chain events', { intact: integrity.files.intact, checked: integrity.files.checked, unchained: integrity.files.unchained, events: integrity.chain.events })}</p>
        <RecordedPayload value={verify.data} />
      </> : verify.meta && !verify.error && !partialSources(verify).length ? <p className="text-muted-foreground">{t('No verify snapshot yet')}</p> : null}</Panel>
    </div>
    <ReadState snapshot={media} url={mediaUrl} /><div className="divide-y">{media.data?.map(item => <Link key={item.artifactId} href={item.blob.href} target="_blank" rel="noreferrer" className="flex w-full min-w-0 items-start gap-3 py-4 text-sm text-foreground"><Layers3 className="size-4 shrink-0" aria-hidden="true" /><span className="flex min-w-0 flex-1 flex-col gap-2"><span className="whitespace-pre-wrap break-words font-medium">{item.label ?? item.name}</span><span className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground"><span>{item.role}</span><span>{item.attempt == null ? t('No attempt association recorded') : t('Attempt #{id}', { id: item.attempt })}</span></span><span className="break-all font-mono text-xs text-muted-foreground">#{item.artifactId} · {item.job}</span></span><ArrowRight className="size-4 shrink-0" aria-hidden="true" /></Link>)}</div>{media.meta && !media.error && !partialSources(media).length && !media.data?.length && <p className="text-sm text-muted-foreground">{t('No media yet.')}</p>}<MoreRows read={media} />
  </Panel>;
}

function InfraTab({ project, wf }: { readonly project: string; readonly wf: string }) {
  const url = `/api/workflows/${encodeURIComponent(project)}/${encodeURIComponent(wf)}/worktrees?all=1`;
  const worktrees = usePagedApiQuery<Worktree>(url, { topics: ['system'], intervalMs: 60_000, getKey: item => item.path });
  return <Panel title={t('Infrastructure · worktrees')} concept="C15">
    <ReadState snapshot={worktrees} url={url} />
    <div className="flex flex-col gap-2 text-xs text-muted-foreground"><p>{t('Recorded worktrees, including removal history. Current process liveness is unknown.')}</p></div>
    {worktrees.data?.length ? <Table variant="secondary"><Table.ScrollContainer><Table.Content aria-label={t('Recorded worktrees')} className="min-w-[720px]">
      <Table.Header>
        <Table.Column id="worktree" isRowHeader>{t('Worktree')}</Table.Column>
        <Table.Column id="custody">{t('Recorded custody')}</Table.Column>
        <Table.Column id="times">{t('Recorded times')}</Table.Column>
        <Table.Column id="state">{t('Recorded state')}</Table.Column>
      </Table.Header>
      <Table.Body>{worktrees.data.map(item => <Table.Row id={item.path} key={item.path}>
        <Table.Cell className="max-w-[420px] align-top"><div className="flex min-w-0 flex-col gap-2"><p className="whitespace-pre-wrap break-words font-medium">{item.branch ?? item.kind}</p><p className="text-xs text-muted-foreground">{item.kind}</p><PathLink path={item.path} kind="dir" /><RecordedPayload value={item} /></div></Table.Cell>
        <Table.Cell className="align-top"><div className="flex min-w-0 flex-col gap-2 text-xs">
          {item.attempt != null ? <Link href={routeHref({ kind: 'attempt', project, attemptId: String(item.attempt), step: 'run', q: '' })}>{t('Attempt #{id}', { id: item.attempt })}</Link> : <span className="text-muted-foreground">{t('No attempt association recorded')}</span>}
          <p className="break-all font-mono text-muted-foreground">{item.jobId ?? t('not recorded')}</p>
        </div></Table.Cell>
        <Table.Cell className="align-top"><div className="flex flex-col gap-2 text-xs text-muted-foreground"><p>{t('Created {at}', { at: formatAbsolute(item.createdAt) })}</p>{item.removedAt != null && <p>{t('Removed {at}', { at: formatAbsolute(item.removedAt) })}</p>}</div></Table.Cell>
        <Table.Cell className="max-w-[280px] align-top"><div className="flex min-w-0 flex-col gap-2"><Chip size="sm" variant="tertiary"><Chip.Label>{item.removedAt != null ? t('removed') : t('Removal not recorded')}</Chip.Label></Chip>{item.removeError && <p className="whitespace-pre-wrap break-words text-xs text-danger">{item.removeError}</p>}</div></Table.Cell>
      </Table.Row>)}</Table.Body>
    </Table.Content></Table.ScrollContainer></Table> : null}
    {worktrees.meta && !worktrees.error && !partialSources(worktrees).length && !worktrees.data?.length && <p className="text-sm text-muted-foreground">{t('No worktrees recorded.')}</p>}<MoreRows read={worktrees} />
  </Panel>;
}

export function WorkflowPage({ project, wf, tab = 'units' }: { readonly project: string; readonly wf: string; readonly tab?: WorkflowTab }) {
  const [now, setNow] = useState(() => Date.now());
  const [chainOpen, setChainOpen] = useState(() => tab === 'units' || tab === 'graph' || Boolean(query().get('leg')));
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(timer); }, []);
  const base = `/api/workflows/${encodeURIComponent(project)}/${encodeURIComponent(wf)}`;
  const detail = useApiQuery<WorkflowDetailV2>(base, { topics: [`wf:${project}:${wf}`, 'system'], intervalMs: 20_000 });
  const pipeline = useApiQuery<PipelineView>(`${base}/pipeline`, { topics: [`wf:${project}:${wf}`, 'system'], intervalMs: 20_000 });
  const graph = useApiQuery<WorkGraph>(`${base}/graph`, { topics: [`wf:${project}:${wf}`, 'system'], intervalMs: 30_000, enabled: tab === 'units' || tab === 'graph' });
  const decisions = usePagedApiQuery<DecisionRow>(`/api/decisions?project=${encodeURIComponent(project)}&wf=${encodeURIComponent(wf)}&limit=200`, { topics: ['decisions'], intervalMs: 20_000, getKey: item => item.key });
  const row = detail.data;
  const legOp = query().get('leg');
  useEffect(() => { setChainOpen(tab === 'units' || tab === 'graph'); }, [project, wf, tab]);
  // A selected leg opens its graph; closing the drawer preserves the mounted opener and its focus target.
  useEffect(() => { if (legOp) setChainOpen(true); }, [project, wf, tab, legOp]);
  const pipe = pipeline.data ?? null;
  const selectedLeg: LegRow | null = pipe && legOp ? pipe.legs.find(leg => leg.op === legOp) ?? null : null;
  const withLeg = (op: string | null) => {
    const params = query(); params.delete('leg'); if (op) params.set('leg', op);
    if (!params.get('tab')) params.set('tab', tab);
    window.location.hash = `${rootHref(project, wf)}?${params}`;
  };
  if (detail.error && !row) return <div className="mx-auto flex w-full max-w-[1600px] min-w-0 flex-col gap-4"><Link href="#/" className="w-fit text-sm">{t('← Overview')}</Link><FeedbackState error onRetry={() => refreshQuery(base)}>{detail.error}</FeedbackState></div>;
  if (!row) return <div className="mx-auto w-full max-w-[1600px] min-w-0"><PageSkeleton label={t('Reading the workflow…')} /></div>;
  const activeTab = tab === 'graph' ? 'units' : tab;
  const tabHref = (id: WorkflowTab) => `${rootHref(project, wf)}?tab=${id}${legOp ? `&leg=${encodeURIComponent(legOp)}` : ''}`;
  const decisionsUrl = `/api/decisions?project=${encodeURIComponent(project)}&wf=${encodeURIComponent(wf)}&limit=200`;
  const advancedSummary = t('infra & cost · attempts per leg · slices · {decisions} awaiting decision · {blocked} blocking', { decisions: row.counts.decisionsOpen, blocked: row.blockedBy.length });
  return <Stagger className="mx-auto flex w-full max-w-[1600px] min-w-0 flex-col gap-6 min-[760px]:gap-8">
    <StaggerItem><div className="flex min-w-0 flex-col gap-4">
      <WorkflowHeader row={row} pipeline={pipe} />
      <ReadState snapshot={detail} url={base} />
      {row.progressReadError && <FeedbackState error onRetry={() => refreshQuery(base)}>{t('Progress snapshot unavailable: {error}', { error: row.progressReadError })}</FeedbackState>}
    </div></StaggerItem>
    <StaggerItem><ConceptBlock concept="C4" as="section" className="min-w-0"><Card><CardContent className="flex min-w-0 flex-col gap-4">
      <ReadState snapshot={pipeline} url={`${base}/pipeline`} />
      {pipe && <p className="text-xs text-muted-foreground">{t('Goal revision {n} · chain status {status}', { n: pipe.goalRevision ?? '—', status: pipe.chainStatus })}</p>}
      {pipe && <p className="text-xs text-muted-foreground">{pipe.approvalState === 'recorded' && pipe.approvedBy ? t('Approval recorded by {who}', { who: pipe.approvedBy }) : t('Approval evidence unproven')}{pipe.approvalRef ? ` · ${pipe.approvalRef}` : ''}</p>}
      {pipe?.anomalies.length ? <p role="status" className="text-sm text-muted-foreground">{t('Recorded graph anomalies; dependency ordering is unavailable.')}</p> : null}
      <ReadAlerts snapshot={decisions} url={decisionsUrl} label={t('Awaiting decision')} />
      {decisions.loadMoreError && <FeedbackState error onRetry={decisions.loadMore}>{decisions.loadMoreError}</FeedbackState>}
      {pipe?.scheduling.readError && <FeedbackState error onRetry={() => refreshQuery(`${base}/pipeline`)}>{pipe.scheduling.readError}</FeedbackState>}
      <Advanced title={t('Op chain')} open={chainOpen} onOpenChange={setChainOpen}>
        <div className="flex min-w-0 flex-col gap-4">
          <p className="text-xs text-muted-foreground">{t('Each box is one recorded plan leg. Arrows show dependencies; columns show their depth. Runtime conditions govern whether stacked legs run in parallel. Open a box for its bound units, attempts and evidence.')}</p>
          {pipe && <PipelineGraph pipeline={pipe} selected={legOp} onSelect={leg => withLeg(legOp === leg.op ? null : leg.op)} />}
      <Advanced summary={advancedSummary}>
        <div className="flex min-w-0 flex-col gap-6 min-[760px]:gap-8">
          <WorkflowInfraCard embedded where={row.where} usage={row.usage} />
          {pipe && <div className="grid min-w-0 gap-6 min-[760px]:gap-8"><Panel embedded title={t('Attempts per leg')} concept="C7"><AttemptGantt pipeline={pipe} now={now} /></Panel><Panel embedded title={t('Work slice graph')} concept="C4"><WorkGraphSlices graph={pipe.workGraph} /></Panel></div>}
          {pipe && !pipe.scheduling.readError && <Advanced keepMounted title={t('Scheduling graph reference · derivedPlan')} className="text-xs text-muted-foreground"><ul className="space-y-1 font-mono">{pipe.scheduling.ops.map(op => <li key={op} className="break-all">{op}</li>)}{pipe.scheduling.edges.map(edge => <li key={`${edge.from}>${edge.to}`} className="break-all">{edge.from} → {edge.to}</li>)}</ul></Advanced>}
          <div className="grid min-w-0 gap-6 min-[760px]:gap-8 lg:grid-cols-2">
            <Panel embedded title={t('Awaiting decision · {n}', { n: row.counts.decisionsOpen })} concept="C12"><ReadState snapshot={decisions} url={decisionsUrl} includeAlerts={false} /><div className="divide-y">{decisions.data?.map(item => <Link key={item.key} href={item.href} className="flex w-full min-w-0 items-start gap-3 py-3 text-sm text-foreground"><span className="flex min-w-0 flex-1 flex-col gap-2"><span className="flex flex-wrap items-center gap-2"><StatusChip status={statusFromUi(item.ui)} label={item.status} /><WhyOwnerBadge owner={item.decider} /></span><span className="whitespace-pre-wrap break-words">{item.summary}</span><span className="block break-all font-mono text-xs text-muted-foreground">{item.id}{item.overdue ? t(' · overdue') : ''}</span></span><ArrowRight className="size-4 shrink-0" aria-hidden="true" /></Link>)}</div>{decisions.meta && !decisions.error && !partialSources(decisions).length && !decisions.data?.length && <p className="text-sm text-muted-foreground">{t('No pending decisions.')}</p>}<MoreRows read={decisions} includeFailure={false} /></Panel>
            <Panel embedded title={t('Blocking · {n}', { n: row.blockedBy.length })} concept="C4"><div className="divide-y">{row.blockedBy.map((item, index) => <Link key={`${item.ref.kind}-${item.ref.id}-${index}`} href={item.ref.href} className="flex w-full min-w-0 items-start gap-3 py-3 text-sm text-foreground"><span className="text-xs tabular-nums text-muted-foreground">{index + 1}.</span><StatusDot status={statusFromUi(item.ui)} /><span className="min-w-0 flex-1 break-words">{formatReason(item.reason)}<span className="block text-xs text-muted-foreground">{t('{who} · since {at}', { who: item.who, at: formatAbsolute(item.since) })}</span></span><ArrowRight className="size-4 shrink-0" aria-hidden="true" /></Link>)}</div>{row.blockedBy.length === 0 && <p className="text-sm text-muted-foreground">{t('No blockers recorded.')}</p>}</Panel>
          </div>
        </div>
      </Advanced>
        </div>
      </Advanced>
    </CardContent></Card></ConceptBlock></StaggerItem>
    {selectedLeg && pipe && <LegDrawer project={project} wf={wf} leg={selectedLeg} pipeline={pipe} onClose={() => withLeg(null)} />}
    <StaggerItem><Tabs selectedKey={activeTab} variant="secondary" className="min-w-0 gap-4">
      <Tabs.ListContainer><Tabs.List aria-label={t('Workflow content')}>{tabs.map(item => <Tabs.Tab key={item.id} id={item.id} href={tabHref(item.id)} data-concept={item.concept} className="w-auto shrink-0 whitespace-nowrap">{item.label}{item.id === 'units' && ` ${row.units.total}`}{item.id === 'attempts' && pipe && ` ${pipe.attempts}`}<Tabs.Indicator /></Tabs.Tab>)}</Tabs.List></Tabs.ListContainer>
      <Tabs.Panel id="units" className="min-w-0">{(tab === 'units' || tab === 'graph') && <UnitsTab key={`${project}:${wf}`} project={project} wf={wf} graph={graph} graphTab={tab === 'graph'} />}</Tabs.Panel>
      <Tabs.Panel id="attempts" className="min-w-0">{tab === 'attempts' && <AttemptsTab project={project} wf={wf} />}</Tabs.Panel>
      <Tabs.Panel id="decisions" className="min-w-0">{tab === 'decisions' && <DecisionsTab project={project} wf={wf} />}</Tabs.Panel>
      <Tabs.Panel id="why" className="min-w-0">{tab === 'why' && <WhyTab project={project} wf={wf} />}</Tabs.Panel>
      <Tabs.Panel id="timeline" className="min-w-0">{tab === 'timeline' && <TimelineTab project={project} wf={wf} />}</Tabs.Panel>
      <Tabs.Panel id="evidence" className="min-w-0">{tab === 'evidence' && <EvidenceTab project={project} wf={wf} />}</Tabs.Panel>
      <Tabs.Panel id="infra" className="min-w-0">{tab === 'infra' && <InfraTab project={project} wf={wf} />}</Tabs.Panel>
    </Tabs></StaggerItem>
  </Stagger>;
}

export default function WorkflowRoutePage() {
  const route = useRoute();
  return route.kind === 'workflow' ? <WorkflowPage project={route.project} wf={route.wf} tab={route.tab} /> : null;
}
