import { useEffect, useState } from 'react';
import { ArrowRight, ChevronRight, Layers3 } from 'lucide-react';
import { useApiQuery } from '../../api/query';
import type { AttemptRow, DecisionRow, LegRow, MediaItem, PipelineView, TimelineItem, UnitRow, WorkflowDetailV2 } from '../../contract';
import { formatAbsolute, formatReason, unitStateLabels } from '../../i18n/vi';
import { StatusChip, StatusDot } from '../../components/status-chip';
import { statusFromUi, statusFromUnit } from '../../components/status';
import { WorkflowHeader } from '../../components/work/pipeline/header';
import { PipelineGraph } from '../../components/work/pipeline-graph';
import { AttemptGantt } from '../../components/work/attempt-gantt';
import { LegDrawer } from '../../components/work/leg-drawer';
import { WorkflowInfraCard } from '../../components/work/infra-card';
import { WorkGraphSlices } from '../../components/work/work-graph-slices';
import { ReasonLine } from '../../components/reason-line';
import { ConceptBlock, type Concept } from '../../components/concept';
import { LifecycleBar, type UnitState } from '../../components/lifecycle-bar';
import type { WorkGraph } from '../../components/work/graph';
import { useRoute, type WorkflowTab } from '../../router';

export const concept: Concept = 'C2';

const tabs: { id: WorkflowTab; label: string; concept: string }[] = [
  { id: 'units', label: 'Đơn vị', concept: 'C4' },
  { id: 'attempts', label: 'Lần thử', concept: 'C7' }, { id: 'decisions', label: 'Quyết định', concept: 'C5' },
  { id: 'why', label: 'Vì sao', concept: 'C2' }, { id: 'timeline', label: 'Diễn biến', concept: 'C17' },
  { id: 'evidence', label: 'Bằng chứng', concept: 'C11' }, { id: 'infra', label: 'Hạ tầng', concept: 'C15' },
];
const rootHref = (project: string, wf: string) => `#/w/${encodeURIComponent(project)}/${encodeURIComponent(wf)}`;
const query = () => new URL(window.location.hash.slice(1) || '/', window.location.origin).searchParams;
type DecisionLog = { id: string; decider: string; choice: string; rationale: string | null; at: number; di: { href: string } | null };
type Rca = { at: number; attempts24h: number; clusters: { cause: string; count: number; open: number; reason: { code: string; params: Record<string, string | number> } }[]; actions: { rank: number; key: string; unblocks: number; reason: { code: string; params: Record<string, string | number> } }[] };
type Worktree = { kind: string; branch: string | null; path: string | null; ui: 'bad' | 'warn' | 'running' | 'waiting' | 'ok' | 'done' | 'unknown'; createdAt: number; removedAt: number | null };

function Panel({ title, children, concept }: { title: string; children: React.ReactNode; concept: 'C1' | 'C2' | 'C4' | 'C5' | 'C12' | 'C15' | 'C17' | 'C11' | 'C7' }) {
  return <ConceptBlock concept={concept} as="section" className="min-w-0 rounded-xl border bg-card p-4 shadow-sm sm:p-5"><h2 className="mb-3 font-semibold">{title}</h2>{children}</ConceptBlock>;
}

function UnitDetail({ project, wf, selected, state }: { project: string; wf: string; selected: string | null; state: string | null }) {
  const detail = useApiQuery<{ unit: UnitRow; attempts: AttemptRow[]; blockedBy: { reason: { code: string; params: Record<string, string | number> }; ui: UnitRow['ui'] }[] }>(selected ? `/api/workflows/${encodeURIComponent(project)}/${encodeURIComponent(wf)}/units/${encodeURIComponent(selected)}` : '', { enabled: Boolean(selected), topics: [`wf:${project}:${wf}`], intervalMs: 20_000 });
  if (!selected) return <p className="text-sm text-muted-foreground">Chọn một nhóm Op hoặc đơn vị để xem chi tiết.</p>;
  return <div className="rounded-lg border bg-muted/30 p-4"><a href={`${rootHref(project, wf)}?tab=units${state ? `&state=${state}` : ''}`} className="text-xs text-muted-foreground hover:underline">Đóng chi tiết</a>
    {detail.data && <><div className="mt-2 flex flex-wrap items-center gap-2"><strong className="min-w-0 break-words">{detail.data.unit.title}</strong><StatusChip status={statusFromUnit(detail.data.unit.state)} /></div>
      <p className="mt-2 text-sm text-muted-foreground">{detail.data.unit.op} · {unitStateLabels[detail.data.unit.state]} · {detail.data.unit.attempts} lần giao</p>
      {detail.data.blockedBy.map((blocker, i) => <ReasonLine key={i} reason={blocker.reason} className="mt-2" />)}
      {detail.data.attempts.map(attempt => <a key={attempt.id} href={attempt.href} className="mt-2 flex items-center gap-2 text-sm hover:underline"><StatusDot status={statusFromUi(attempt.ui)} /> Lần thử {attempt.attempt} · {attempt.agent ?? 'agent chưa rõ'} <ArrowRight className="size-3" /></a>)}
    </>}{detail.loading && <p className="mt-2 text-sm text-muted-foreground">Đang đọc đơn vị…</p>}</div>;
}

function UnitsTab({ project, wf, graph }: { project: string; wf: string; graph: WorkGraph | null }) {
  const url = `/api/workflows/${encodeURIComponent(project)}/${encodeURIComponent(wf)}/units?limit=200`;
  const units = useApiQuery<UnitRow[]>(url, { topics: [`wf:${project}:${wf}`], intervalMs: 20_000 });
  const state = query().get('state');
  const selected = query().get('unit');
  const rank: Record<UnitRow['ui'], number> = { bad: 0, running: 1, warn: 2, waiting: 3, unknown: 4, ok: 5, done: 6 };
  const rows = (units.data ?? []).filter(unit => !state || unit.state === state).sort((a, b) => rank[a.ui] - rank[b.ui] || b.updatedAt - a.updatedAt);
  const counts = graph ? Object.fromEntries(['planned', 'queued', 'running', 'reported', 'deciding', 'done', 'failed', 'dropped'].map(value => [value, graph.nodes.filter(node => node.state === value).length])) as Record<UnitState, number> : null;
  return <Panel title={`Đơn vị · ${rows.length}`} concept="C4">
    {counts && <LifecycleBar counts={counts} selected={state as UnitState | null} onSelect={value => { window.location.hash = `${rootHref(project, wf)}?tab=units${state === value ? '' : `&state=${value}`}`; }} />}
    {state && <a className="mt-2 inline-block text-xs text-primary hover:underline" href={`${rootHref(project, wf)}?tab=units`}>Bỏ lọc {unitStateLabels[state as UnitState] ?? state}</a>}
    <div className="mt-4 divide-y">{rows.map(unit => <a key={unit.unit} href={`${rootHref(project, wf)}?tab=units&unit=${encodeURIComponent(unit.unit)}${state ? `&state=${state}` : ''}`} className="flex min-w-0 items-center gap-3 py-3 hover:text-primary">
      <StatusDot status={statusFromUnit(unit.state)} /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{unit.title}</span><span className="block truncate text-xs text-muted-foreground">{unit.op} · {unitStateLabels[unit.state]} · lần {unit.tries}/{unit.tryBudget}</span></span><ChevronRight className="size-4 shrink-0" aria-hidden="true" />
    </a>)}</div>
    {!units.loading && !rows.length && <p className="mt-4 text-sm text-muted-foreground">Không có đơn vị phù hợp.</p>}
    {selected && <div className="mt-4"><UnitDetail project={project} wf={wf} selected={selected} state={state} /></div>}
  </Panel>;
}

function AttemptsTab({ project, wf }: { project: string; wf: string }) {
  const attempts = useApiQuery<AttemptRow[]>(`/api/attempts?project=${encodeURIComponent(project)}&wf=${encodeURIComponent(wf)}&limit=200`, { topics: [`wf:${project}:${wf}`], intervalMs: 30_000 });
  return <Panel title="Lần thử" concept="C7"><div className="divide-y">{attempts.data?.map(item => <a key={item.id} href={item.href} className="flex min-w-0 items-center gap-3 py-3 text-sm hover:text-primary"><StatusDot status={statusFromUi(item.ui)} /><span className="min-w-0 flex-1 truncate">{item.op} · {item.unit ?? item.job} · lần {item.attempt}</span><span className="hidden text-muted-foreground sm:block">{item.agent ?? '—'} · {formatAbsolute(item.dispatchedAt)}</span><ArrowRight className="size-4 shrink-0" /></a>)}</div>{!attempts.data?.length && <p className="text-sm text-muted-foreground">Chưa có lần thử.</p>}</Panel>;
}

function DecisionsTab({ project, wf }: { project: string; wf: string }) {
  const open = useApiQuery<DecisionRow[]>(`/api/decisions?project=${encodeURIComponent(project)}&wf=${encodeURIComponent(wf)}&limit=200`, { topics: ['decisions'], intervalMs: 20_000 });
  const log = useApiQuery<DecisionLog[]>(`/api/decisions/log?project=${encodeURIComponent(project)}&wf=${encodeURIComponent(wf)}&limit=200`, { topics: [`wf:${project}:${wf}`], intervalMs: 60_000 });
  return <div className="space-y-4"><Panel title="Chờ quyết" concept="C12"><div className="divide-y">{open.data?.map(item => <a key={item.id} href={`#/decisions?id=${encodeURIComponent(item.id)}`} className="flex min-w-0 items-center gap-2 py-3 text-sm hover:text-primary"><StatusDot status={statusFromUi(item.ui)} /><span className="min-w-0 flex-1 truncate">{item.summary}</span><span className="text-xs text-muted-foreground">{item.decider}</span><ArrowRight className="size-4 shrink-0" /></a>)}</div>{!open.data?.length && <p className="text-sm text-muted-foreground">Không có quyết định đang chờ.</p>}</Panel>
    <Panel title="Nhật ký quyết định" concept="C5"><div className="divide-y">{log.data?.map(item => <div key={item.id} className="py-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><strong>{item.choice}</strong><span className="text-xs text-muted-foreground">{item.decider} · {formatAbsolute(item.at)}</span></div>{item.rationale && <p className="mt-1 text-muted-foreground">{item.rationale}</p>}{item.di && <a href={item.di.href} className="text-xs text-primary hover:underline">Mở quyết định</a>}</div>)}</div>{!log.data?.length && <p className="text-sm text-muted-foreground">Chưa có quyết định đã chốt.</p>}</Panel></div>;
}

function WhyTab({ project, wf }: { project: string; wf: string }) {
  const rca = useApiQuery<Rca | null>(`/api/workflows/${encodeURIComponent(project)}/${encodeURIComponent(wf)}/rca`, { topics: [`wf:${project}:${wf}`], intervalMs: 60_000 });
  return <Panel title="Vì sao · phân tích nguyên nhân" concept="C2">{rca.data ? <><p className="mb-4 text-xs text-muted-foreground">{rca.data.attempts24h} lần thử trong 24 giờ · cập nhật {formatAbsolute(rca.data.at)}</p>
    <div className="space-y-3">{rca.data.clusters.map((cluster, index) => <div key={`${cluster.cause}-${index}`} className="rounded-lg border p-3"><div className="flex justify-between gap-2 text-sm"><strong>{cluster.cause}</strong><span>{cluster.open}/{cluster.count} đang mở</span></div><ReasonLine reason={cluster.reason} className="mt-2" /></div>)}</div>
    {rca.data.actions.length > 0 && <h3 className="mb-2 mt-5 text-sm font-semibold">Hành động gợi ý</h3>}{rca.data.actions.map(action => <div key={action.key} className="flex gap-3 border-t py-3 text-sm"><span className="font-mono text-muted-foreground">{action.rank}</span><span className="min-w-0"><strong>{action.key}</strong><span className="block text-muted-foreground">{formatReason(action.reason)} · gỡ {action.unblocks}</span></span></div>)}
  </> : <p className="text-sm text-muted-foreground">Chưa có bản phân tích.</p>}</Panel>;
}

function TimelineTab({ project, wf }: { project: string; wf: string }) {
  const timeline = useApiQuery<TimelineItem[]>(`/api/timeline?project=${encodeURIComponent(project)}&wf=${encodeURIComponent(wf)}&limit=200`, { topics: [`wf:${project}:${wf}`], intervalMs: 30_000 });
  return <Panel title="Diễn biến" concept="C17"><div className="divide-y">{timeline.data?.map((item, index) => <div key={`${item.at}-${index}`} className="flex min-w-0 items-start gap-3 py-3 text-sm"><StatusDot status={statusFromUi(item.ui)} /><div className="min-w-0 flex-1"><p className="break-words">{item.title}</p><p className="text-xs text-muted-foreground">{item.source} · {formatAbsolute(item.at)}</p></div>{item.ref && <a href={item.ref.href} aria-label="Mở chi tiết"><ArrowRight className="size-4" /></a>}</div>)}</div>{!timeline.data?.length && <p className="text-sm text-muted-foreground">Chưa có diễn biến.</p>}</Panel>;
}

function EvidenceTab({ project, wf }: { project: string; wf: string }) {
  const media = useApiQuery<MediaItem[]>(`/api/media?project=${encodeURIComponent(project)}&wf=${encodeURIComponent(wf)}&limit=200`, { topics: [`wf:${project}:${wf}`], intervalMs: 60_000 });
  const coverage = useApiQuery<{ at: number; [key: string]: unknown } | null>(`/api/workflows/${encodeURIComponent(project)}/${encodeURIComponent(wf)}/coverage`, { topics: [`wf:${project}:${wf}`], intervalMs: 60_000 });
  const verify = useApiQuery<{ at: number; ageMs?: number; status?: string } | null>(`/api/workflows/${encodeURIComponent(project)}/${encodeURIComponent(wf)}/verify`, { topics: [`wf:${project}:${wf}`], intervalMs: 60_000 });
  return <Panel title="Bằng chứng" concept="C11"><div className="mb-4 grid gap-2 text-xs sm:grid-cols-2"><div className="rounded-lg border p-3"><strong className="block text-sm">Coverage</strong><span className="text-muted-foreground">{coverage.data ? `Cập nhật ${formatAbsolute(coverage.data.at)}` : 'Chưa có snapshot coverage'}</span></div><div className="rounded-lg border p-3"><strong className="block text-sm">Verify</strong><span className="text-muted-foreground">{verify.data ? `${verify.data.status ?? 'Chưa rõ trạng thái'} · ${formatAbsolute(verify.data.at)}${verify.data.ageMs != null ? ` · ${Math.round(verify.data.ageMs / 3_600_000)} giờ trước` : ''}` : 'Chưa có snapshot verify'}</span></div></div><div className="divide-y">{media.data?.map(item => <a key={item.artifactId} href={item.blob.href} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-2 py-3 text-sm hover:text-primary"><Layers3 className="size-4 shrink-0" /><span className="min-w-0 flex-1 truncate">{item.label ?? item.name}</span><span className="text-xs text-muted-foreground">{item.role}</span><ArrowRight className="size-4 shrink-0" /></a>)}</div>{!media.data?.length && <p className="text-sm text-muted-foreground">Chưa có media.</p>}</Panel>;
}

function InfraTab({ project, wf }: { project: string; wf: string }) {
  const worktrees = useApiQuery<Worktree[]>(`/api/workflows/${encodeURIComponent(project)}/${encodeURIComponent(wf)}/worktrees`, { topics: ['system'], intervalMs: 60_000 });
  return <Panel title="Hạ tầng · worktree" concept="C15"><div className="divide-y">{worktrees.data?.map((item, index) => <div key={`${item.branch}-${index}`} className="flex min-w-0 items-center gap-3 py-3 text-sm"><StatusDot status={statusFromUi(item.ui)} /><div className="min-w-0 flex-1"><p className="truncate font-medium">{item.branch ?? item.kind}</p><p className="truncate text-xs text-muted-foreground">{item.path ?? item.kind} · {formatAbsolute(item.createdAt)}</p></div></div>)}</div>{!worktrees.data?.length && <p className="text-sm text-muted-foreground">Không có worktree được ghi nhận.</p>}</Panel>;
}

export function WorkflowPage({ project, wf, tab = 'units' }: { project: string; wf: string; tab?: WorkflowTab }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(timer); }, []);
  const base = `/api/workflows/${encodeURIComponent(project)}/${encodeURIComponent(wf)}`;
  const detail = useApiQuery<WorkflowDetailV2>(base, { topics: [`wf:${project}:${wf}`], intervalMs: 20_000 });
  const pipeline = useApiQuery<PipelineView>(`${base}/pipeline`, { topics: [`wf:${project}:${wf}`], intervalMs: 20_000 });
  const graph = useApiQuery<WorkGraph>(`${base}/graph`, { topics: [`wf:${project}:${wf}`], intervalMs: 30_000, enabled: tab === 'units' || tab === 'graph' });
  const decisions = useApiQuery<DecisionRow[]>(`/api/decisions?project=${encodeURIComponent(project)}&wf=${encodeURIComponent(wf)}&limit=200`, { topics: ['decisions'], intervalMs: 20_000 });
  const row = detail.data;
  const legOp = query().get('leg');
  const pipe = pipeline.data ?? null;
  const selectedLeg: LegRow | null = pipe && legOp ? pipe.legs.find(leg => leg.op === legOp) ?? null : null;
  const withLeg = (op: string | null) => {
    const params = query(); params.delete('leg'); if (op) params.set('leg', op);
    if (!params.get('tab')) params.set('tab', tab);
    window.location.hash = `${rootHref(project, wf)}?${params}`;
  };
  if (detail.error) return <div className="mx-auto max-w-6xl p-6"><a href="#/" className="text-sm hover:underline">← Tổng quan</a><p role="alert" className="mt-4 rounded-xl border p-5">{detail.error}</p></div>;
  if (!row) return <div className="mx-auto max-w-6xl p-6 text-sm text-muted-foreground">Đang đọc workflow…</div>;
  const tabActive = (id: WorkflowTab) => tab === id || (id === 'units' && tab === 'graph');
  return <div className="mx-auto flex w-full max-w-[1600px] min-w-0 flex-col gap-5 p-4 pb-24 sm:p-6 lg:p-8">
    <WorkflowHeader row={row} pipeline={pipe} />
    <Panel title="Chuỗi op" concept="C4">
      <p className="-mt-2 mb-3 text-xs text-muted-foreground">Mỗi ô là một chặng của kế hoạch. Cột là thứ tự, ô xếp dọc chạy song song. Bấm vào ô để xem chi tiết.</p>
      {pipe ? <PipelineGraph pipeline={pipe} selected={legOp} onSelect={leg => withLeg(legOp === leg.op ? null : leg.op)} /> : <p className="text-sm text-muted-foreground">{pipeline.error ?? 'Đang đọc chuỗi op…'}</p>}
    </Panel>
    {selectedLeg && pipe && <LegDrawer project={project} wf={wf} leg={selectedLeg} pipeline={pipe} onClose={() => withLeg(null)} />}
    <WorkflowInfraCard where={row.where} usage={row.usage} />
    {pipe && <div className="grid min-w-0 gap-5"><Panel title="Lần thử theo chặng" concept="C7"><AttemptGantt pipeline={pipe} now={now} /></Panel><Panel title="Lát cắt công việc" concept="C4"><WorkGraphSlices graph={pipe.workGraph} /></Panel></div>}
    <div className="grid min-w-0 gap-5 lg:grid-cols-2">
      <Panel title={`Chờ quyết · ${row.counts.decisionsOpen}`} concept="C12"><div className="divide-y">{decisions.data?.map(item => <a key={item.id} href={`#/decisions?id=${encodeURIComponent(item.id)}`} className="flex min-w-0 items-center gap-2 py-3 text-sm hover:text-primary"><StatusDot status={statusFromUi(item.ui)} /><span className="min-w-0 flex-1 truncate">{item.summary}</span><span className="hidden text-xs text-muted-foreground sm:block">{item.decider}{item.overdue ? ' · quá hạn' : ''}</span><ArrowRight className="size-4 shrink-0" /></a>)}</div>{!decisions.data?.length && <p className="text-sm text-muted-foreground">Không có quyết định đang chờ.</p>}</Panel>
      <Panel title={`Đang chặn · ${row.blockedBy.length}`} concept="C4"><div className="divide-y">{row.blockedBy.map((item, index) => <a key={`${item.ref.kind}-${item.ref.id}-${index}`} href={item.ref.href} className="flex min-w-0 items-start gap-3 py-3 text-sm hover:text-primary"><span className="text-xs tabular-nums text-muted-foreground">{index + 1}.</span><StatusDot status={statusFromUi(item.ui)} /><span className="min-w-0 flex-1 break-words">{formatReason(item.reason)}<span className="block text-xs text-muted-foreground">{item.who} · từ {formatAbsolute(item.since)}</span></span><ArrowRight className="size-4 shrink-0" /></a>)}</div>{row.blockedBy.length === 0 && <p className="text-sm text-muted-foreground">Không có chặn được ghi nhận.</p>}</Panel>
    </div>
    <nav aria-label="Nội dung workflow" className="flex gap-1 overflow-x-auto border-b pb-2">{tabs.map(item => <a key={item.id} href={`${rootHref(project, wf)}?tab=${item.id}${legOp ? `&leg=${encodeURIComponent(legOp)}` : ''}`} data-concept={item.concept} aria-current={tabActive(item.id) ? 'page' : undefined} className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted ${tabActive(item.id) ? 'bg-muted text-foreground' : 'text-muted-foreground'}`}>{item.label}{item.id === 'units' && ` ${row.units.total}`}{item.id === 'attempts' && ` ${row.counts.attempts24h}`}</a>)}</nav>
    <div id="workflow-tab-panel" className="scroll-mt-4">
      {(tab === 'units' || tab === 'graph') && <UnitsTab project={project} wf={wf} graph={graph.data} />}
      {tab === 'attempts' && <AttemptsTab project={project} wf={wf} />}
      {tab === 'decisions' && <DecisionsTab project={project} wf={wf} />}
      {tab === 'why' && <WhyTab project={project} wf={wf} />}
      {tab === 'timeline' && <TimelineTab project={project} wf={wf} />}
      {tab === 'evidence' && <EvidenceTab project={project} wf={wf} />}
      {tab === 'infra' && <InfraTab project={project} wf={wf} />}
    </div>
  </div>;
}

export default function WorkflowRoutePage() {
  const route = useRoute();
  return route.kind === 'workflow' ? <WorkflowPage project={route.project} wf={route.wf} tab={route.tab} /> : null;
}
