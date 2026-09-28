import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, ChevronRight, Layers3 } from 'lucide-react';
import { useApiQuery } from '../../api/query';
import type { AttemptRow, DecisionRow, MediaItem, TimelineItem, UnitRow, WorkflowDetail } from '../../contract';
import { formatAbsolute, formatReason, unitStateLabels } from '../../i18n/vi';
import { StateChip } from '../../components/state-chip';
import { ReasonLine } from '../../components/reason-line';
import { ConceptBlock, type Concept } from '../../components/concept';
import { LifecycleBar, type UnitState } from '../../components/lifecycle-bar';
import { Progress } from '../../components/ui/progress';
import { GraphView, type GraphGroup, type WorkGraph } from '../../components/work/graph';
import { useRoute, type WorkflowTab } from '../../router';

export const concept: Concept = 'C2';

const tabs: { id: WorkflowTab; label: string; concept: string }[] = [
  { id: 'units', label: 'Đơn vị', concept: 'C4' }, { id: 'graph', label: 'Đồ thị', concept: 'C4' },
  { id: 'attempts', label: 'Lần thử', concept: 'C7' }, { id: 'decisions', label: 'Quyết định', concept: 'C5' },
  { id: 'why', label: 'Vì sao', concept: 'C2' }, { id: 'timeline', label: 'Diễn biến', concept: 'C17' },
  { id: 'evidence', label: 'Bằng chứng', concept: 'C11' }, { id: 'infra', label: 'Hạ tầng', concept: 'C15' },
];
const rootHref = (project: string, wf: string) => `#/w/${encodeURIComponent(project)}/${encodeURIComponent(wf)}`;
const query = () => new URL(window.location.hash.slice(1) || '/', window.location.origin).searchParams;
const formatCount = (value: number) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(value);
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
    {detail.data && <><div className="mt-2 flex flex-wrap items-center gap-2"><strong className="min-w-0 break-words">{detail.data.unit.title}</strong><StateChip state={detail.data.unit.ui} /></div>
      <p className="mt-2 text-sm text-muted-foreground">{detail.data.unit.op} · {unitStateLabels[detail.data.unit.state]} · {detail.data.unit.attempts} lần giao</p>
      {detail.data.blockedBy.map((blocker, i) => <ReasonLine key={i} reason={blocker.reason} className="mt-2" />)}
      {detail.data.attempts.map(attempt => <a key={attempt.id} href={attempt.href} className="mt-2 flex items-center gap-2 text-sm hover:underline"><StateChip state={attempt.ui} compact /> Lần thử {attempt.attempt} · {attempt.agent ?? 'agent chưa rõ'} <ArrowRight className="size-3" /></a>)}
    </>}{detail.loading && <p className="mt-2 text-sm text-muted-foreground">Đang đọc đơn vị…</p>}</div>;
}

function UnitsTab({ project, wf, graph, desktopSplit = false }: { project: string; wf: string; graph: WorkGraph | null; desktopSplit?: boolean }) {
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
      <StateChip state={unit.ui} compact /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{unit.title}</span><span className="block truncate text-xs text-muted-foreground">{unit.op} · {unitStateLabels[unit.state]} · lần {unit.tries}/{unit.tryBudget}</span></span><ChevronRight className="size-4 shrink-0" aria-hidden="true" />
    </a>)}</div>
    {!units.loading && !rows.length && <p className="mt-4 text-sm text-muted-foreground">Không có đơn vị phù hợp.</p>}
    {selected && <div className={desktopSplit ? 'mt-4 lg:hidden' : 'mt-4'}><UnitDetail project={project} wf={wf} selected={selected} state={state} /></div>}
  </Panel>;
}

function WorkflowInspector({ project, wf, group }: { project: string; wf: string; group: GraphGroup | null }) {
  const selected = query().get('unit');
  if (selected) return <Panel title="Chi tiết đơn vị" concept="C4"><UnitDetail project={project} wf={wf} selected={selected} state={query().get('state')} /></Panel>;
  return <Panel title="Chi tiết nhóm Op" concept="C4">{group ? <><div className="flex items-center gap-2"><strong className="min-w-0 break-words">{group.op} ×{group.nodes.length}</strong><StateChip state={group.ui} compact /></div><p className="mt-2 text-xs text-muted-foreground">{group.incoming.length ? `${group.incoming.length} phụ thuộc đầu vào` : 'Bước đầu'}</p><div className="mt-3 divide-y">{group.nodes.map(node => <a key={node.unit} href={`${rootHref(project, wf)}?tab=units&unit=${encodeURIComponent(node.unit)}`} className="flex min-w-0 items-center gap-2 py-2 text-sm hover:text-primary"><span className="min-w-0 flex-1 truncate">{node.title}</span><StateChip state={node.ui} compact /></a>)}</div></> : <p className="text-sm text-muted-foreground">Chọn một nhóm Op trong đồ thị để xem các đơn vị.</p>}</Panel>;
}

function AttemptsTab({ project, wf }: { project: string; wf: string }) {
  const attempts = useApiQuery<AttemptRow[]>(`/api/attempts?project=${encodeURIComponent(project)}&wf=${encodeURIComponent(wf)}&limit=200`, { topics: [`wf:${project}:${wf}`], intervalMs: 30_000 });
  return <Panel title="Lần thử" concept="C7"><div className="divide-y">{attempts.data?.map(item => <a key={item.id} href={item.href} className="flex min-w-0 items-center gap-3 py-3 text-sm hover:text-primary"><StateChip state={item.ui} compact /><span className="min-w-0 flex-1 truncate">{item.op} · {item.unit ?? item.job} · lần {item.attempt}</span><span className="hidden text-muted-foreground sm:block">{item.agent ?? '—'} · {formatAbsolute(item.dispatchedAt)}</span><ArrowRight className="size-4 shrink-0" /></a>)}</div>{!attempts.data?.length && <p className="text-sm text-muted-foreground">Chưa có lần thử.</p>}</Panel>;
}

function DecisionsTab({ project, wf }: { project: string; wf: string }) {
  const open = useApiQuery<DecisionRow[]>(`/api/decisions?project=${encodeURIComponent(project)}&wf=${encodeURIComponent(wf)}&limit=200`, { topics: ['decisions'], intervalMs: 20_000 });
  const log = useApiQuery<DecisionLog[]>(`/api/decisions/log?project=${encodeURIComponent(project)}&wf=${encodeURIComponent(wf)}&limit=200`, { topics: [`wf:${project}:${wf}`], intervalMs: 60_000 });
  return <div className="space-y-4"><Panel title="Chờ quyết" concept="C12"><div className="divide-y">{open.data?.map(item => <a key={item.id} href={`#/decisions?id=${encodeURIComponent(item.id)}`} className="flex min-w-0 items-center gap-2 py-3 text-sm hover:text-primary"><StateChip state={item.ui} compact /><span className="min-w-0 flex-1 truncate">{item.summary}</span><span className="text-xs text-muted-foreground">{item.decider}</span><ArrowRight className="size-4 shrink-0" /></a>)}</div>{!open.data?.length && <p className="text-sm text-muted-foreground">Không có quyết định đang chờ.</p>}</Panel>
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
  return <Panel title="Diễn biến" concept="C17"><div className="divide-y">{timeline.data?.map((item, index) => <div key={`${item.at}-${index}`} className="flex min-w-0 items-start gap-3 py-3 text-sm"><StateChip state={item.ui} compact /><div className="min-w-0 flex-1"><p className="break-words">{item.title}</p><p className="text-xs text-muted-foreground">{item.source} · {formatAbsolute(item.at)}</p></div>{item.ref && <a href={item.ref.href} aria-label="Mở chi tiết"><ArrowRight className="size-4" /></a>}</div>)}</div>{!timeline.data?.length && <p className="text-sm text-muted-foreground">Chưa có diễn biến.</p>}</Panel>;
}

function EvidenceTab({ project, wf }: { project: string; wf: string }) {
  const media = useApiQuery<MediaItem[]>(`/api/media?project=${encodeURIComponent(project)}&wf=${encodeURIComponent(wf)}&limit=200`, { topics: [`wf:${project}:${wf}`], intervalMs: 60_000 });
  const coverage = useApiQuery<{ at: number; [key: string]: unknown } | null>(`/api/workflows/${encodeURIComponent(project)}/${encodeURIComponent(wf)}/coverage`, { topics: [`wf:${project}:${wf}`], intervalMs: 60_000 });
  const verify = useApiQuery<{ at: number; ageMs?: number; status?: string } | null>(`/api/workflows/${encodeURIComponent(project)}/${encodeURIComponent(wf)}/verify`, { topics: [`wf:${project}:${wf}`], intervalMs: 60_000 });
  return <Panel title="Bằng chứng" concept="C11"><div className="mb-4 grid gap-2 text-xs sm:grid-cols-2"><div className="rounded-lg border p-3"><strong className="block text-sm">Coverage</strong><span className="text-muted-foreground">{coverage.data ? `Cập nhật ${formatAbsolute(coverage.data.at)}` : 'Chưa có snapshot coverage'}</span></div><div className="rounded-lg border p-3"><strong className="block text-sm">Verify</strong><span className="text-muted-foreground">{verify.data ? `${verify.data.status ?? 'Chưa rõ trạng thái'} · ${formatAbsolute(verify.data.at)}${verify.data.ageMs != null ? ` · ${Math.round(verify.data.ageMs / 3_600_000)} giờ trước` : ''}` : 'Chưa có snapshot verify'}</span></div></div><div className="divide-y">{media.data?.map(item => <a key={item.artifactId} href={item.blob.href} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-2 py-3 text-sm hover:text-primary"><Layers3 className="size-4 shrink-0" /><span className="min-w-0 flex-1 truncate">{item.label ?? item.name}</span><span className="text-xs text-muted-foreground">{item.role}</span><ArrowRight className="size-4 shrink-0" /></a>)}</div>{!media.data?.length && <p className="text-sm text-muted-foreground">Chưa có media.</p>}</Panel>;
}

function InfraTab({ project, wf }: { project: string; wf: string }) {
  const worktrees = useApiQuery<Worktree[]>(`/api/workflows/${encodeURIComponent(project)}/${encodeURIComponent(wf)}/worktrees`, { topics: ['system'], intervalMs: 60_000 });
  return <Panel title="Hạ tầng · worktree" concept="C15"><div className="divide-y">{worktrees.data?.map((item, index) => <div key={`${item.branch}-${index}`} className="flex min-w-0 items-center gap-3 py-3 text-sm"><StateChip state={item.ui} compact /><div className="min-w-0 flex-1"><p className="truncate font-medium">{item.branch ?? item.kind}</p><p className="truncate text-xs text-muted-foreground">{item.path ?? item.kind} · {formatAbsolute(item.createdAt)}</p></div></div>)}</div>{!worktrees.data?.length && <p className="text-sm text-muted-foreground">Không có worktree được ghi nhận.</p>}</Panel>;
}

export function WorkflowPage({ project, wf, tab = 'units' }: { project: string; wf: string; tab?: WorkflowTab }) {
  const [selectedGroup, setSelectedGroup] = useState<GraphGroup | null>(null);
  const base = `/api/workflows/${encodeURIComponent(project)}/${encodeURIComponent(wf)}`;
  const detail = useApiQuery<WorkflowDetail>(base, { topics: [`wf:${project}:${wf}`], intervalMs: 20_000 });
  const graph = useApiQuery<WorkGraph>(`${base}/graph`, { topics: [`wf:${project}:${wf}`], intervalMs: 30_000, enabled: tab === 'units' || tab === 'graph' });
  const decisions = useApiQuery<DecisionRow[]>(`/api/decisions?project=${encodeURIComponent(project)}&wf=${encodeURIComponent(wf)}&limit=200`, { topics: ['decisions'], intervalMs: 20_000 });
  const row = detail.data;
  useEffect(() => {
    if (row && tab === 'graph') document.getElementById('workflow-tab-panel')?.scrollIntoView({ block: 'start' });
  }, [project, wf, tab, Boolean(row)]);
  if (detail.error) return <div className="mx-auto max-w-6xl p-6"><a href="#/" className="text-sm hover:underline">← Tổng quan</a><p role="alert" className="mt-4 rounded-xl border p-5">{detail.error}</p></div>;
  if (!row) return <div className="mx-auto max-w-6xl p-6 text-sm text-muted-foreground">Đang đọc workflow…</div>;
  const pct = row.units.total ? Math.round(row.units.done / row.units.total * 100) : 0;
  return <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-5 p-4 pb-24 sm:p-6 lg:p-8">
    <header className="space-y-4"><a href="#/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Tổng quan</a><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs text-muted-foreground">{row.project} / workflow</p><h1 className="break-words text-2xl font-semibold tracking-tight sm:text-3xl">{row.name}</h1></div><StateChip state={row.ui} label={row.phase === 'paused' ? 'Tạm dừng' : row.phase === 'stopped' ? 'Đã dừng' : row.ui === 'warn' ? 'Chậm' : row.ui === 'bad' ? 'Kẹt' : undefined} /></div></header>
    <Panel title="Tiến độ" concept="C2"><div className="flex flex-wrap items-baseline gap-x-5 gap-y-2 text-sm lg:justify-between"><span><strong className="text-2xl tabular-nums">{formatCount(row.units.done)}/{formatCount(row.units.total)}</strong> đơn vị đạt</span><span>{formatCount(row.ratePerHour)}/giờ{row.minRatePerHour != null ? ` · tối thiểu ${formatCount(row.minRatePerHour)}` : ''}</span><span>Đang chạy {row.running}/{row.allowedParallel ?? '—'}</span>{row.etaAt != null && <span>ETA {formatAbsolute(row.etaAt)}</span>}</div>
      <Progress className="mt-4" value={pct} aria-label={`${pct}% đơn vị đạt`} /><div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground"><span>{row.counts.failed24h} hỏng / 24 giờ</span><span>{row.counts.attempts24h} lần thử / 24 giờ</span>{row.counts.costUsd24h != null && <span>{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(row.counts.costUsd24h)} / 24 giờ</span>}</div>
      {row.phase !== 'running' ? <p className="mt-3 text-sm">{row.phase === 'paused' ? 'Tạm dừng' : row.phase === 'stopped' ? 'Đã dừng' : row.phase}: {row.phaseReason ?? 'Chưa ghi lý do'}</p> : row.reason && <ReasonLine reason={row.reason} className="mt-3" />}
      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm"><span>{row.onIt ? `${row.onIt.who} đang lo · ${formatReason(row.onIt.reason)}` : 'Chưa có người xử lý được ghi nhận'}</span><span data-concept="C3" className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs">Ghế Kernel · {row.seat?.state ?? 'chưa rõ'}</span></div>
    </Panel>
    <div className="hidden min-w-0 gap-5 lg:grid lg:grid-cols-3"><Panel title={`Mục tiêu · bản ${row.goal.revision}`} concept="C1"><p className="line-clamp-3 break-words text-sm leading-relaxed" title={row.goal.text}>{row.goal.text || 'Chưa có mục tiêu được ghi nhận.'}</p></Panel><Panel title={`Chờ quyết · ${row.counts.decisionsOpen}`} concept="C12"><div className="max-h-24 divide-y overflow-auto">{decisions.data?.map(item => <a key={item.id} href={`#/decisions?id=${encodeURIComponent(item.id)}`} className="flex min-w-0 items-center gap-2 py-2 text-sm hover:text-primary"><StateChip state={item.ui} compact /><span className="min-w-0 flex-1 truncate">{item.summary}</span><ArrowRight className="size-4 shrink-0" /></a>)}</div>{!decisions.data?.length && <a href="#/decisions" className="text-sm text-muted-foreground hover:text-primary">{row.counts.decisionsOpen ? 'Mở danh sách quyết định' : 'Không có quyết định đang chờ.'}</a>}</Panel><Panel title={`Đang chặn · ${row.blockedBy.length}`} concept="C4"><div className="max-h-24 divide-y overflow-auto">{row.blockedBy.map((item, index) => <a key={`${item.ref.kind}-${item.ref.id}-${index}`} href={item.ref.href} className="flex min-w-0 items-center gap-2 py-2 text-sm hover:text-primary"><StateChip state={item.ui} compact /><span className="min-w-0 flex-1 truncate">{formatReason(item.reason)}</span><ArrowRight className="size-4 shrink-0" /></a>)}</div>{row.blockedBy.length === 0 && <p className="text-sm text-muted-foreground">Không có chặn được ghi nhận.</p>}</Panel></div>
    <div className="grid min-w-0 gap-5 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:hidden"><Panel title={`Mục tiêu · bản ${row.goal.revision}`} concept="C1"><div className="whitespace-pre-wrap break-words text-sm leading-relaxed">{row.goal.text || 'Chưa có mục tiêu được ghi nhận.'}</div></Panel><div className="grid min-w-0 gap-5 sm:grid-cols-1">
      <Panel title={`Chờ quyết · ${row.counts.decisionsOpen}`} concept="C12"><div className="divide-y">{decisions.data?.map(item => <a key={item.id} href={`#/decisions?id=${encodeURIComponent(item.id)}`} className="flex min-w-0 items-center gap-2 py-3 text-sm hover:text-primary"><StateChip state={item.ui} compact /><span className="min-w-0 flex-1 truncate">{item.summary}</span><span className="hidden text-xs text-muted-foreground sm:block">{item.decider}{item.overdue ? ' · quá hạn' : ''}</span><ArrowRight className="size-4 shrink-0" /></a>)}</div>{!decisions.data?.length && <p className="text-sm text-muted-foreground">Không có quyết định đang chờ.</p>}</Panel>
      <Panel title={`Đang chặn · ${row.blockedBy.length}`} concept="C4"><div className="divide-y">{row.blockedBy.map((item, index) => <a key={`${item.ref.kind}-${item.ref.id}-${index}`} href={item.ref.href} className="flex min-w-0 items-start gap-3 py-3 text-sm hover:text-primary"><span className="text-xs tabular-nums text-muted-foreground">{index + 1}.</span><StateChip state={item.ui} compact /><span className="min-w-0 flex-1 break-words">{formatReason(item.reason)}<span className="block text-xs text-muted-foreground">{item.who} · từ {formatAbsolute(item.since)}</span></span><ArrowRight className="size-4 shrink-0" /></a>)}</div>{row.blockedBy.length === 0 && <p className="text-sm text-muted-foreground">Không có chặn được ghi nhận.</p>}</Panel>
    </div></div>
    <nav aria-label="Nội dung workflow" className="flex flex-wrap gap-1 border-b pb-2">{tabs.map(item => <a key={item.id} href={`${rootHref(project, wf)}?tab=${item.id}`} data-concept={item.concept} aria-current={tab === item.id ? 'page' : undefined} className={`rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted ${tab === item.id ? 'bg-muted text-foreground' : 'text-muted-foreground'}`}>{item.label}{item.id === 'units' && ` ${row.units.total}`}{item.id === 'attempts' && ` ${row.counts.attempts24h}`}</a>)}</nav>
    <div id="workflow-tab-panel" className={tab === 'graph' ? 'min-h-[100vh] scroll-mt-4' : 'scroll-mt-4'}>
      {(tab === 'units' || tab === 'graph') && <><div className="hidden min-w-0 gap-5 lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]"><div className="min-w-0 space-y-5"><Panel title="Đồ thị công việc" concept="C4">{graph.data ? <GraphView graph={graph.data} onGroupSelect={setSelectedGroup} selectionInInspector onUnit={unit => { window.location.hash = `${rootHref(project, wf)}?tab=units&unit=${encodeURIComponent(unit)}`; }} /> : <p className="text-sm text-muted-foreground">Đang đọc đồ thị…</p>}</Panel><UnitsTab project={project} wf={wf} graph={graph.data} desktopSplit /></div><div className="min-w-0"><div className="sticky top-5"><WorkflowInspector project={project} wf={wf} group={selectedGroup} /></div></div></div><div className="lg:hidden">{tab === 'units' ? <UnitsTab project={project} wf={wf} graph={graph.data} /> : <Panel title="Đồ thị công việc" concept="C4">{graph.data ? <GraphView graph={graph.data} onUnit={unit => { window.location.hash = `${rootHref(project, wf)}?tab=units&unit=${encodeURIComponent(unit)}`; }} /> : <p className="text-sm text-muted-foreground">Đang đọc đồ thị…</p>}</Panel>}</div></>}
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
