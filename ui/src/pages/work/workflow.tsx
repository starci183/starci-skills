import { useEffect, useState } from 'react';
import { ArrowRight, ChevronRight, Layers3 } from 'lucide-react';
import { refreshQuery, useApiQuery, usePagedApiQuery, type QuerySnapshot } from '../../api/query';
import type { AttemptRow, DecisionRow, LegRow, MediaItem, PipelineView, TimelineItem, UnitRow, WorkflowDetailV2 } from '../../contract';
import { formatAbsolute, formatReason, unitStateLabels } from '../../i18n/vi';
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
import { FeedbackState, PageSkeleton } from '../../components/feedback-state';
import { ConceptBlock, type Concept } from '../../components/concept';
import { LifecycleBar, type UnitState } from '../../components/lifecycle-bar';
import { GraphView, type WorkGraph } from '../../components/work/graph';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Advanced, Stagger, StaggerItem } from '../../components/motion';
import { useRoute, type WorkflowTab } from '../../router';

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
type Rca = { schema: string; attempts: number; windowMs: number; clusters: { cause: string; count: number; open: number; why: string; authority: string }[]; actions?: { rank: number; key: string; title: string; expected: string; unblocks: number }[] };
type Coverage = { schema: string; summary: { total: number; proven: number; stale: number; missing: number; mustOwed: number }; graphVersion: number | null };
type Verify = { schema: string; ok: boolean; files: { checked: number; intact: number; unchained: number }; chain: { events: number; ok: boolean } };
type Worktree = { kind: string; branch: string | null; path: string; jobId: string | null; attempt: number | null; ui: 'bad' | 'warn' | 'running' | 'waiting' | 'ok' | 'done' | 'unknown'; createdAt: number; removedAt: number | null };
type UnitEdge = { id: string; href: string; from: string; to: string; kind: string; source: string; createdAt: number };

function Panel({ title, children, concept }: { title: string; children: React.ReactNode; concept: 'C1' | 'C2' | 'C4' | 'C5' | 'C12' | 'C15' | 'C17' | 'C11' | 'C7' }) {
  return <ConceptBlock concept={concept} as="section" className="min-w-0"><Card size="sm"><CardHeader><CardTitle><h2>{title}</h2></CardTitle></CardHeader><CardContent>{children}</CardContent></Card></ConceptBlock>;
}

function ReadState({ snapshot, url, label }: { snapshot: QuerySnapshot<unknown>; url: string; label?: string }) {
  const prefix = label ? `${label} · ` : '';
  return <div className="space-y-2">
    {snapshot.error && <FeedbackState error onRetry={() => refreshQuery(url)}>{prefix}{snapshot.meta ? t('The source is failing; showing the last read. {error}', { error: snapshot.error }) : snapshot.error}</FeedbackState>}
    {!snapshot.meta && !snapshot.error && <p className="text-xs text-muted-foreground" role="status">{prefix}{t('Loading…')}</p>}
    {snapshot.meta?.stale?.length ? <p className="shell-error text-xs" role="status">{prefix}{t('Source out of sync: {list}', { list: snapshot.meta.stale.join(', ') })}</p> : null}
    {snapshot.meta && <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">{prefix}{t('Read observed {at}', { at: formatAbsolute(snapshot.observedAt) })}</summary><p>{t('Response assembled {at}', { at: formatAbsolute(snapshot.meta.at) })}</p><ul className="mt-1 space-y-1 font-mono">{snapshot.meta.sources.map((source, index) => <li key={`${source.db}:${source.rel}:${index}`} className="break-all">{source.db}:{source.rel}{source.at != null ? ` · ${formatAbsolute(source.at)}` : ''}</li>)}</ul></details>}
    {snapshot.meta?.next && <p className="text-xs text-muted-foreground">{t('More rows are available; this view shows one page.')}</p>}
  </div>;
}

function MoreRows({ read }: { read: { data: unknown[] | null; next: string | null; loadingMore: boolean; loadMoreError: string | null; loadMore: () => void } }) {
  return <div className="mt-3 space-y-2 text-xs text-muted-foreground">
    {read.data && <p>{t('Loaded {n} rows · page scope; live data may change.', { n: read.data.length })}</p>}
    {read.loadMoreError && <FeedbackState error onRetry={read.loadMore}>{read.loadMoreError}</FeedbackState>}
    {read.next && <Button size="sm" variant="outline" disabled={read.loadingMore} onClick={read.loadMore}>{read.loadingMore ? t('Loading…') : t('Load more')}</Button>}
  </div>;
}

function SnapshotFacts({ read }: { read: MetricRead<unknown> }) {
  const snapshot = read.snapshot;
  return <p className="break-all text-xs text-muted-foreground">{t('Snapshot #{id} · recorded {at}', { id: snapshot.id, at: formatAbsolute(snapshot.at) })} · {snapshot.payloadSource}{snapshot.windowMs != null ? ` · ${t('Window {n} hours', { n: snapshot.windowMs / 3_600_000 })}` : ''}{snapshot.subject ? ` · ${snapshot.subject}` : ''}{snapshot.dataSha ? ` · SHA ${snapshot.dataSha}` : ''}</p>;
}

function UnitDetail({ project, wf, selected, state, graphMode }: { project: string; wf: string; selected: string | null; state: string | null; graphMode: boolean }) {
  const url = selected ? `/api/workflows/${encodeURIComponent(project)}/${encodeURIComponent(wf)}/units/${encodeURIComponent(selected)}` : '';
  const detail = useApiQuery<{ unit: UnitRow; attempts: AttemptRow[]; edges: { in: UnitEdge[]; out: UnitEdge[] }; decisions: { id: string; choice: string; rationale: string | null; at: number }[]; blockedBy: { reason: { code: string; params: Record<string, string | number> }; ui: UnitRow['ui'] }[] }>(url, { enabled: Boolean(selected), topics: [`wf:${project}:${wf}`, 'system'], intervalMs: 20_000 });
  if (!selected) return <p className="text-sm text-muted-foreground">{t('Pick an Op group or a unit to see details.')}</p>;
  const closeParams = query(); closeParams.set('tab', 'units'); closeParams.delete('unit');
  if (graphMode) closeParams.set('view', 'graph'); else closeParams.delete('view');
  if (state) closeParams.set('state', state); else closeParams.delete('state');
  return <div className="rounded-md border p-3"><a href={`${rootHref(project, wf)}?${closeParams}`} className="text-xs text-muted-foreground hover:underline">{t('Close details')}</a>
    <div className="mt-2"><ReadState snapshot={detail} url={url} /></div>
    {detail.data && <><div className="mt-2 flex flex-wrap items-center gap-2"><strong className="min-w-0 break-words">{detail.data.unit.title}</strong><StatusChip status={statusFromUnit(detail.data.unit.state)} /></div>
      <p className="mt-2 break-all font-mono text-xs text-muted-foreground">{detail.data.unit.unit} · {detail.data.unit.op}</p>
      <p className="mt-2 break-all text-xs text-muted-foreground">{t('Goal revision {n}', { n: detail.data.unit.goalRevision })} · {detail.data.unit.subjectKey} · {t('Current job {job}', { job: detail.data.unit.currentJob ?? '—' })}</p>
      <p className="mt-2 text-xs text-muted-foreground">{unitStateLabels[detail.data.unit.state]} · {t('try {tries}/{budget}', { tries: detail.data.unit.tries, budget: detail.data.unit.tryBudget })} · {t('{n} dispatches', { n: detail.data.unit.attempts })}</p>
      {detail.data.blockedBy.map((blocker, i) => <ReasonLine key={i} reason={blocker.reason} className="mt-2" />)}
      {detail.data.attempts.map(attempt => <a key={attempt.id} href={attempt.href} className="mt-3 flex min-w-0 items-start gap-2 text-sm hover:underline"><StatusDot status={statusFromUi(attempt.ui)} /><span className="min-w-0 flex-1"><span className="block">#{attempt.id} · {t('Business try {n} · dispatch {dispatch}', { n: attempt.attempt, dispatch: attempt.dispatchSeq })}</span><span className="block break-all text-xs text-muted-foreground">{attempt.job} · {attempt.agent ?? t('unknown agent')}</span></span><ArrowRight className="size-3 shrink-0" /></a>)}
      <Advanced className="mt-3" summary={t('Recorded dependencies and decisions')}>
        {(['in', 'out'] as const).map(direction => <div key={direction} className="mt-2"><strong className="text-xs">{direction === 'in' ? t('Predecessors') : t('Dependents')}</strong>{detail.data!.edges[direction].map(edge => <a key={`${edge.from}:${edge.to}:${edge.kind}`} href={edge.href} className="mt-2 block break-all text-xs hover:underline">{edge.from} → {edge.to} · {edge.kind} · {edge.source} · {formatAbsolute(edge.createdAt)}</a>)}</div>)}
        {detail.data.decisions.map(decision => <div key={decision.id} className="mt-3 border-t pt-2 text-xs"><strong>{decision.choice}</strong> · {formatAbsolute(decision.at)}{decision.rationale && <p className="mt-1">{decision.rationale}</p>}</div>)}
      </Advanced>
    </>}</div>;
}

function UnitsTab({ project, wf, graph, legacyGraph }: { project: string; wf: string; graph: QuerySnapshot<WorkGraph>; legacyGraph: boolean }) {
  const state = query().get('state');
  const url = `/api/workflows/${encodeURIComponent(project)}/${encodeURIComponent(wf)}/units?limit=200${state ? `&state=${encodeURIComponent(state)}` : ''}`;
  const units = usePagedApiQuery<UnitRow>(url, { topics: [`wf:${project}:${wf}`, 'system'], intervalMs: 20_000, getKey: unit => `${unit.workflowId}:${unit.unit}` });
  const selected = query().get('unit');
  const graphMode = legacyGraph || query().get('view') === 'graph';
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
    <div className="flex flex-wrap gap-1" role="group" aria-label={t('Units')}><Button size="sm" variant={graphMode ? 'ghost' : 'secondary'} aria-pressed={!graphMode} onClick={() => { window.location.hash = href(selected, state, false); }}>{t('List')}</Button><Button size="sm" variant={graphMode ? 'secondary' : 'ghost'} aria-pressed={graphMode} onClick={() => { window.location.hash = href(selected, null, true); }}>{t('Unit graph')}</Button></div>
    <ReadState snapshot={graph} url={graphUrl} label={t('Unit graph')} />
    {graphMode ? <>{graph.data && <GraphView graph={graph.data} onUnit={unit => { window.location.hash = href(unit, null, true); }} />}</> : <>
    <ReadState snapshot={units} url={url} label={t('List')} />
    {counts && <LifecycleBar counts={counts} selected={state as UnitState | null} onSelect={value => { window.location.hash = href(null, state === value ? null : value); }} />}
    {state && <a className="inline-block text-xs text-primary hover:underline" href={href(null, null)}>{t('Clear the {state} filter', { state: unitStateLabels[state as UnitState] ?? state })}</a>}
    <div className="divide-y">{rows.map(unit => <a key={unit.unit} href={href(unit.unit)} className="flex min-w-0 items-center gap-3 py-3 hover:text-primary">
      <StatusDot status={statusFromUnit(unit.state)} /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{unit.title}</span><span className="block truncate text-xs text-muted-foreground">{unit.op} · {t('Goal revision {n}', { n: unit.goalRevision })} · {unitStateLabels[unit.state]} · {t('try {tries}/{budget}', { tries: unit.tries, budget: unit.tryBudget })}</span></span><ChevronRight className="size-4 shrink-0" aria-hidden="true" />
    </a>)}</div>
    {units.meta && !units.error && !rows.length && <p className="text-sm text-muted-foreground">{t('No matching units.')}</p>}
    <MoreRows read={units} />
    </>}
    {selected && <UnitDetail project={project} wf={wf} selected={selected} state={state} graphMode={graphMode} />}
  </Panel>;
}

function AttemptsTab({ project, wf }: { project: string; wf: string }) {
  const url = `/api/attempts?project=${encodeURIComponent(project)}&wf=${encodeURIComponent(wf)}&limit=200`;
  const attempts = usePagedApiQuery<AttemptRow>(url, { topics: [`wf:${project}:${wf}`, 'system'], intervalMs: 30_000, getKey: attempt => String(attempt.id) });
  return <Panel title={t('Attempts')} concept="C7"><ReadState snapshot={attempts} url={url} /><div className="divide-y">{attempts.data?.map(item => <a key={item.id} href={item.href} className="flex min-w-0 items-start gap-3 py-3 text-sm hover:text-primary"><StatusDot status={statusFromUi(item.ui)} /><span className="min-w-0 flex-1"><span className="block font-medium">#{item.id} · {item.op}</span><span className="mt-1 block break-all font-mono text-xs text-muted-foreground">{t('Unit {unit} · job {job}', { unit: item.unit ?? '—', job: item.job })}</span><span className="mt-1 block text-xs text-muted-foreground">{t('Business try {n} · dispatch {dispatch}', { n: item.attempt, dispatch: item.dispatchSeq })} · {item.agent ?? '—'} · {formatAbsolute(item.dispatchedAt)}</span></span><ArrowRight className="size-4 shrink-0" /></a>)}</div>{attempts.meta && !attempts.error && !attempts.data?.length && <p className="text-sm text-muted-foreground">{t('No attempts yet.')}</p>}<MoreRows read={attempts} /></Panel>;
}

function DecisionsTab({ project, wf }: { project: string; wf: string }) {
  const open = usePagedApiQuery<DecisionRow>(`/api/decisions?project=${encodeURIComponent(project)}&wf=${encodeURIComponent(wf)}&limit=200`, { topics: ['decisions'], intervalMs: 20_000, getKey: item => item.key });
  const log = usePagedApiQuery<DecisionLog>(`/api/decisions/log?project=${encodeURIComponent(project)}&wf=${encodeURIComponent(wf)}&limit=200`, { topics: [`wf:${project}:${wf}`, 'system'], intervalMs: 60_000, getKey: item => item.key });
  return <div className="flex flex-col gap-4"><Panel title={t('Awaiting decision')} concept="C12"><ReadState snapshot={open} url={`/api/decisions?project=${encodeURIComponent(project)}&wf=${encodeURIComponent(wf)}&limit=200`} /><div className="divide-y">{open.data?.map(item => <a key={item.key} href={item.href} className="flex min-w-0 items-center gap-2 py-3 text-sm hover:text-primary"><StatusDot status={statusFromUi(item.ui)} /><span className="min-w-0 flex-1 break-words">{item.summary}<span className="block font-mono text-xs text-muted-foreground">{item.id}</span></span><span className="text-xs text-muted-foreground">{item.decider}</span><ArrowRight className="size-4 shrink-0" /></a>)}</div>{open.meta && !open.error && !open.data?.length && <p className="text-sm text-muted-foreground">{t('No pending decisions.')}</p>}<MoreRows read={open} /></Panel>
    <Panel title={t('Decision log')} concept="C5"><ReadState snapshot={log} url={`/api/decisions/log?project=${encodeURIComponent(project)}&wf=${encodeURIComponent(wf)}&limit=200`} /><div className="divide-y">{log.data?.map(item => <div key={item.key} className="py-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><strong>{item.choice}</strong><span className="text-xs text-muted-foreground">{item.decider} · {formatAbsolute(item.at)}</span></div>{item.rationale && <p className="mt-1 text-muted-foreground">{item.rationale}</p>}{item.di && <a href={item.di.href} className="text-xs text-primary hover:underline">{t('Open the decision')}</a>}</div>)}</div>{log.meta && !log.error && !log.data?.length && <p className="text-sm text-muted-foreground">{t('No settled decisions yet.')}</p>}<MoreRows read={log} /></Panel></div>;
}

function WhyTab({ project, wf }: { project: string; wf: string }) {
  const url = `/api/workflows/${encodeURIComponent(project)}/${encodeURIComponent(wf)}/rca`;
  const rca = useApiQuery<MetricRead<Rca> | null>(url, { topics: [`wf:${project}:${wf}`, 'system'], intervalMs: 60_000 });
  const payload = rca.data?.payload;
  return <Panel title={t('Why · cause analysis')} concept="C2"><ReadState snapshot={rca} url={url} />{rca.data && payload ? <>
    <SnapshotFacts read={rca.data} />
    <p className="mt-2 text-xs text-muted-foreground">{t('{n} recorded attempts · window {hours} hours', { n: payload.attempts, hours: payload.windowMs / 3_600_000 })}</p>
    <div className="flex flex-col divide-y">{payload.clusters.map((cluster, index) => <div key={`${cluster.cause}-${index}`} className="py-3"><div className="flex justify-between gap-2 text-sm"><strong>{cluster.cause}</strong><span>{t('{open}/{count} open', { open: cluster.open, count: cluster.count })}</span></div><p className="mt-2 break-words text-sm text-muted-foreground">{cluster.why}</p><p className="mt-1 text-xs text-muted-foreground">{cluster.authority}</p></div>)}</div>
    {payload.actions?.length ? <h3 className="mb-2 mt-6 text-sm font-semibold">{t('Suggested actions')}</h3> : null}{payload.actions?.map(action => <div key={action.key} className="flex gap-3 border-t py-3 text-sm"><span className="font-mono text-muted-foreground">{action.rank}</span><span className="min-w-0"><strong>{action.title}</strong><span className="block text-muted-foreground">{action.expected} · {t('unblocks {n}', { n: action.unblocks })}</span></span></div>)}
  </> : rca.meta && !rca.error ? <p className="text-sm text-muted-foreground">{t('No analysis yet.')}</p> : null}</Panel>;
}

function TimelineTab({ project, wf }: { project: string; wf: string }) {
  const url = `/api/timeline?project=${encodeURIComponent(project)}&wf=${encodeURIComponent(wf)}&limit=200`;
  const timeline = usePagedApiQuery<TimelineItem>(url, { topics: [`wf:${project}:${wf}`, 'system'], intervalMs: 30_000, getKey: item => item.key });
  return <Panel title={t('Timeline')} concept="C17"><ReadState snapshot={timeline} url={url} /><div className="divide-y">{timeline.data?.map(item => <div key={item.key} className="flex min-w-0 items-start gap-3 py-3 text-sm"><StatusDot status={statusFromUi(item.ui)} /><div className="min-w-0 flex-1"><p className="break-words">{item.title}</p><p className="mt-1 text-xs text-muted-foreground">{item.source} · {item.kind} · {formatAbsolute(item.at)}</p>{item.ref && <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{item.ref.kind}:{item.ref.id}</p>}</div>{item.ref && <a href={item.ref.href} aria-label={t('Open details')}><ArrowRight className="size-4" /></a>}</div>)}</div>{timeline.meta && !timeline.error && !timeline.data?.length && <p className="text-sm text-muted-foreground">{t('No timeline yet.')}</p>}<MoreRows read={timeline} /></Panel>;
}

function EvidenceTab({ project, wf }: { project: string; wf: string }) {
  const base = `/api/workflows/${encodeURIComponent(project)}/${encodeURIComponent(wf)}`;
  const mediaUrl = `/api/media?project=${encodeURIComponent(project)}&wf=${encodeURIComponent(wf)}&limit=200`;
  const media = usePagedApiQuery<MediaItem>(mediaUrl, { topics: [`wf:${project}:${wf}`, 'system'], intervalMs: 60_000, getKey: item => String(item.artifactId) });
  const coverage = useApiQuery<MetricRead<Coverage> | null>(`${base}/coverage`, { topics: [`wf:${project}:${wf}`, 'system'], intervalMs: 60_000 });
  const verify = useApiQuery<MetricRead<Verify> | null>(`${base}/verify`, { topics: [`wf:${project}:${wf}`, 'system'], intervalMs: 60_000 });
  const proof = coverage.data?.payload;
  const integrity = verify.data?.payload;
  return <Panel title={t('Evidence')} concept="C11">
    <div className="grid gap-2 text-xs sm:grid-cols-2">
      <div className="space-y-2 rounded-md border p-3"><strong className="block text-sm">{t('Proof coverage')}</strong><ReadState snapshot={coverage} url={`${base}/coverage`} />{coverage.data && proof ? <><SnapshotFacts read={coverage.data} /><p>{t('{proven}/{total} proven · {stale} stale · {missing} missing · {owed} must-have owed', { proven: proof.summary.proven, total: proof.summary.total, stale: proof.summary.stale, missing: proof.summary.missing, owed: proof.summary.mustOwed })}</p><p>{t('Graph version {n}', { n: proof.graphVersion ?? '—' })}</p></> : coverage.meta && !coverage.error ? <p className="text-muted-foreground">{t('No coverage snapshot yet')}</p> : null}</div>
      <div className="space-y-2 rounded-md border p-3"><strong className="block text-sm">{t('Proof integrity')}</strong><ReadState snapshot={verify} url={`${base}/verify`} />{verify.data && integrity ? <><SnapshotFacts read={verify.data} /><p>{integrity.ok ? t('Proof integrity passed') : t('Proof integrity failed')}</p><p>{t('{intact}/{checked} files intact · {unchained} unchained · {events} chain events', { intact: integrity.files.intact, checked: integrity.files.checked, unchained: integrity.files.unchained, events: integrity.chain.events })}</p></> : verify.meta && !verify.error ? <p className="text-muted-foreground">{t('No verify snapshot yet')}</p> : null}</div>
    </div>
    <ReadState snapshot={media} url={mediaUrl} /><div className="divide-y">{media.data?.map(item => <a key={item.artifactId} href={item.blob.href} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-2 py-3 text-sm hover:text-primary"><Layers3 className="size-4 shrink-0" /><span className="min-w-0 flex-1"><span className="block truncate">{item.label ?? item.name}</span><span className="mt-1 block break-all font-mono text-xs text-muted-foreground">#{item.artifactId} · {item.job} · {item.attempt == null ? t('No attempt association recorded') : t('Attempt #{id}', { id: item.attempt })}</span></span><span className="text-xs text-muted-foreground">{item.role}</span><ArrowRight className="size-4 shrink-0" /></a>)}</div>{media.meta && !media.error && !media.data?.length && <p className="text-sm text-muted-foreground">{t('No media yet.')}</p>}<MoreRows read={media} />
  </Panel>;
}

function InfraTab({ project, wf }: { project: string; wf: string }) {
  const url = `/api/workflows/${encodeURIComponent(project)}/${encodeURIComponent(wf)}/worktrees`;
  const worktrees = usePagedApiQuery<Worktree>(url, { topics: ['system'], intervalMs: 60_000, getKey: item => item.path });
  return <Panel title={t('Infrastructure · worktrees')} concept="C15"><ReadState snapshot={worktrees} url={url} /><div className="divide-y">{worktrees.data?.map(item => <div key={item.path} className="flex min-w-0 items-start gap-3 py-3 text-sm"><StatusDot status={statusFromUi(item.ui)} /><div className="min-w-0 flex-1"><p className="break-words font-medium">{item.branch ?? item.kind}</p><p className="mt-1 break-all font-mono text-xs text-muted-foreground">{item.path ?? item.kind}</p><p className="mt-1 text-xs text-muted-foreground">{formatAbsolute(item.createdAt)}{item.removedAt != null ? ` · ${t('Removed {at}', { at: formatAbsolute(item.removedAt) })}` : ''}</p></div></div>)}</div>{worktrees.meta && !worktrees.error && !worktrees.data?.length && <p className="text-sm text-muted-foreground">{t('No worktrees recorded.')}</p>}<MoreRows read={worktrees} /></Panel>;
}

export function WorkflowPage({ project, wf, tab = 'units' }: { project: string; wf: string; tab?: WorkflowTab }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(timer); }, []);
  const base = `/api/workflows/${encodeURIComponent(project)}/${encodeURIComponent(wf)}`;
  const detail = useApiQuery<WorkflowDetailV2>(base, { topics: [`wf:${project}:${wf}`, 'system'], intervalMs: 20_000 });
  const pipeline = useApiQuery<PipelineView>(`${base}/pipeline`, { topics: [`wf:${project}:${wf}`, 'system'], intervalMs: 20_000 });
  const graph = useApiQuery<WorkGraph>(`${base}/graph`, { topics: [`wf:${project}:${wf}`, 'system'], intervalMs: 30_000, enabled: tab === 'units' || tab === 'graph' });
  const decisions = usePagedApiQuery<DecisionRow>(`/api/decisions?project=${encodeURIComponent(project)}&wf=${encodeURIComponent(wf)}&limit=200`, { topics: ['decisions'], intervalMs: 20_000, getKey: item => item.key });
  const row = detail.data;
  const legOp = query().get('leg');
  const pipe = pipeline.data ?? null;
  const selectedLeg: LegRow | null = pipe && legOp ? pipe.legs.find(leg => leg.op === legOp) ?? null : null;
  const withLeg = (op: string | null) => {
    const params = query(); params.delete('leg'); if (op) params.set('leg', op);
    if (!params.get('tab')) params.set('tab', tab);
    window.location.hash = `${rootHref(project, wf)}?${params}`;
  };
  if (detail.error && !row) return <div className="mx-auto max-w-6xl p-6"><a href="#/" className="text-sm hover:underline">{t('← Overview')}</a><div className="mt-4"><FeedbackState error onRetry={() => refreshQuery(base)}>{detail.error}</FeedbackState></div></div>;
  if (!row) return <div className="mx-auto max-w-6xl p-6"><PageSkeleton label={t('Reading the workflow…')} /></div>;
  const tabActive = (id: WorkflowTab) => tab === id || (id === 'units' && tab === 'graph');
  const advancedSummary = t('infra & cost · attempts per leg · slices · {decisions} awaiting decision · {blocked} blocking', { decisions: row.counts.decisionsOpen, blocked: row.blockedBy.length });
  return <Stagger className="mx-auto flex w-full max-w-[1600px] min-w-0 flex-col gap-5 pb-24 md:gap-6">
    <StaggerItem><WorkflowHeader row={row} pipeline={pipe} /></StaggerItem>
    <ReadState snapshot={detail} url={base} />
    {row.progressReadError && <FeedbackState error onRetry={() => refreshQuery(base)}>{t('Progress snapshot unavailable: {error}', { error: row.progressReadError })}</FeedbackState>}
    <StaggerItem><Panel title={t('Op chain')} concept="C4">
      <p className="text-xs text-muted-foreground">{t('Each box is one leg of the plan. Columns show dependency depth; arrows are actual dependencies. Vertically stacked boxes can run in parallel. Click a box for details.')}</p>
      <ReadState snapshot={pipeline} url={`${base}/pipeline`} />
      {pipe && <p className="text-xs text-muted-foreground">{t('Goal revision {n} · chain status {status}', { n: pipe.goalRevision ?? '—', status: pipe.chainStatus })}</p>}
      {pipe && <p className="text-xs text-muted-foreground">{pipe.approvalState === 'recorded' && pipe.approvedBy ? t('Approval recorded by {who}', { who: pipe.approvedBy }) : t('Approval evidence unproven')}{pipe.approvalRef ? ` · ${pipe.approvalRef}` : ''}</p>}
      {pipe && <PipelineGraph pipeline={pipe} selected={legOp} onSelect={leg => withLeg(legOp === leg.op ? null : leg.op)} />}
      <Advanced className="mt-4" summary={advancedSummary}>
        <div className="flex min-w-0 flex-col gap-6">
          <WorkflowInfraCard where={row.where} usage={row.usage} />
          {pipe && <div className="grid min-w-0 gap-6"><Panel title={t('Attempts per leg')} concept="C7"><AttemptGantt pipeline={pipe} now={now} /></Panel><Panel title={t('Work slice graph')} concept="C4"><WorkGraphSlices graph={pipe.workGraph} /></Panel></div>}
          {pipe && <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">{t('Scheduling graph reference · derivedPlan')}</summary>{pipe.scheduling.readError ? <p className="mt-2 break-words">{pipe.scheduling.readError}</p> : <ul className="mt-2 space-y-1 font-mono">{pipe.scheduling.ops.map(op => <li key={op}>{op}</li>)}{pipe.scheduling.edges.map((edge, index) => <li key={index}>{edge.from} → {edge.to}</li>)}</ul>}</details>}
          <div className="grid min-w-0 gap-6 lg:grid-cols-2">
            <Panel title={t('Awaiting decision · {n}', { n: row.counts.decisionsOpen })} concept="C12"><ReadState snapshot={decisions} url={`/api/decisions?project=${encodeURIComponent(project)}&wf=${encodeURIComponent(wf)}&limit=200`} /><div className="divide-y">{decisions.data?.map(item => <a key={item.key} href={item.href} className="flex min-w-0 items-center gap-2 py-3 text-sm hover:text-primary"><StatusDot status={statusFromUi(item.ui)} /><span className="min-w-0 flex-1 break-words">{item.summary}</span><span className="text-xs text-muted-foreground">{item.decider}{item.overdue ? t(' · overdue') : ''}</span><ArrowRight className="size-4 shrink-0" /></a>)}</div>{decisions.meta && !decisions.error && !decisions.data?.length && <p className="text-sm text-muted-foreground">{t('No pending decisions.')}</p>}<MoreRows read={decisions} /></Panel>
            <Panel title={t('Blocking · {n}', { n: row.blockedBy.length })} concept="C4"><div className="divide-y">{row.blockedBy.map((item, index) => <a key={`${item.ref.kind}-${item.ref.id}-${index}`} href={item.ref.href} className="flex min-w-0 items-start gap-3 py-3 text-sm hover:text-primary"><span className="text-xs tabular-nums text-muted-foreground">{index + 1}.</span><StatusDot status={statusFromUi(item.ui)} /><span className="min-w-0 flex-1 break-words">{formatReason(item.reason)}<span className="block text-xs text-muted-foreground">{t('{who} · since {at}', { who: item.who, at: formatAbsolute(item.since) })}</span></span><ArrowRight className="size-4 shrink-0" /></a>)}</div>{row.blockedBy.length === 0 && <p className="text-sm text-muted-foreground">{t('No blockers recorded.')}</p>}</Panel>
          </div>
        </div>
      </Advanced>
    </Panel></StaggerItem>
    {selectedLeg && pipe && <LegDrawer project={project} wf={wf} leg={selectedLeg} pipeline={pipe} onClose={() => withLeg(null)} />}
    <StaggerItem><nav aria-label={t('Workflow content')} className="flex gap-1 overflow-x-auto border-b pb-2">{tabs.map(item => <a key={item.id} href={`${rootHref(project, wf)}?tab=${item.id}${legOp ? `&leg=${encodeURIComponent(legOp)}` : ''}`} data-concept={item.concept} aria-current={tabActive(item.id) ? 'page' : undefined} className={`shrink-0 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring ${tabActive(item.id) ? 'bg-muted text-foreground' : 'text-muted-foreground'}`}>{item.label}{item.id === 'units' && ` ${row.units.total}`}{item.id === 'attempts' && pipe && ` ${pipe.attempts}`}</a>)}</nav></StaggerItem>
    <StaggerItem><div id="workflow-tab-panel" className="scroll-mt-4">
      {(tab === 'units' || tab === 'graph') && <UnitsTab key={`${project}:${wf}`} project={project} wf={wf} graph={graph} legacyGraph={tab === 'graph'} />}
      {tab === 'attempts' && <AttemptsTab project={project} wf={wf} />}
      {tab === 'decisions' && <DecisionsTab project={project} wf={wf} />}
      {tab === 'why' && <WhyTab project={project} wf={wf} />}
      {tab === 'timeline' && <TimelineTab project={project} wf={wf} />}
      {tab === 'evidence' && <EvidenceTab project={project} wf={wf} />}
      {tab === 'infra' && <InfraTab project={project} wf={wf} />}
    </div></StaggerItem>
  </Stagger>;
}

export default function WorkflowRoutePage() {
  const route = useRoute();
  return route.kind === 'workflow' ? <WorkflowPage project={route.project} wf={route.wf} tab={route.tab} /> : null;
}
