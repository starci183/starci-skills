import { useState } from 'react';
import { ArrowRight, Activity, CircleAlert, Radio } from 'lucide-react';
import { useApiQuery } from '../../api/query';
import type { AttemptRow, FleetView, WorkflowRow } from '../../contract';
import { formatReason, formatAbsolute } from '../../i18n/vi';
import { Card, CardContent } from '../../components/ui/card';
import { ConceptBlock, type Concept } from '../../components/concept';
import { LifecycleBar } from '../../components/lifecycle-bar';
import { ReasonLine } from '../../components/reason-line';
import { StateChip } from '../../components/state-chip';

export const concept: Concept = 'C2';

const href = (row: WorkflowRow, params = '') => `#/w/${encodeURIComponent(row.project)}/${encodeURIComponent(row.id)}${params}`;
const numeric = (value: number) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(value);
const healthNames: Record<string, string> = { engine: 'Engine', services: 'Dịch vụ', seats: 'Ghế', ram: 'RAM', sla: 'SLA', leaks: 'Rò rỉ', gc: 'Dọn dẹp', land: 'Land', providers: 'Nhà cung cấp' };
const whoNames: Record<string, string> = { owner: 'Thầy', supervisor: 'Supervisor', kernel: 'Kernel', controller: 'Controller' };

function WorkflowCard({ row }: { row: WorkflowRow }) {
  const active = row.phase === 'running';
  return <ConceptBlock concept="C2" as="article" className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1"><p className="text-xs text-muted-foreground">{row.project}</p>
        <a href={href(row)} className="mt-1 inline-flex max-w-full items-center gap-1 font-semibold hover:underline"><span className="truncate">{row.name}</span><ArrowRight className="size-3.5 shrink-0" aria-hidden="true" /></a>
      </div><StateChip state={row.ui} label={active ? row.ui === 'warn' ? 'Chậm' : row.ui === 'bad' ? 'Kẹt' : undefined : row.phase === 'paused' ? 'Tạm dừng' : row.phase === 'stopped' ? 'Đã dừng' : row.phase} />
    </div>
    <div className="mt-4 flex flex-wrap items-baseline gap-x-5 gap-y-1 text-sm"><span><strong className="text-lg tabular-nums">{numeric(row.units.done)}/{numeric(row.units.total)}</strong> đơn vị đạt</span>
      <span className="text-muted-foreground">{numeric(row.ratePerHour)}/giờ</span>
      {row.etaAt != null && <span className="text-muted-foreground">ETA {formatAbsolute(row.etaAt)}</span>}
      {row.onIt && <span className="text-muted-foreground">{whoNames[row.onIt.who] ?? row.onIt.who} đang lo</span>}</div>
    {row.units.total > 0 ? <div className="mt-4" data-concept="C4"><LifecycleBar counts={row.unitStates} onSelect={state => { window.location.hash = href(row, `?tab=units&state=${state}`); }} /></div> : <p data-concept="C4" className="mt-2 text-xs text-muted-foreground">Chưa có đơn vị</p>}
    {active && ['bad', 'warn'].includes(row.ui) && <ReasonLine reason={row.reason} className="mt-3" />}
    {!active && row.reason && <ReasonLine reason={row.reason} prefix="Lý do" className="mt-3" />}
  </ConceptBlock>;
}

export function FleetPage() {
  const [project, setProject] = useState('all');
  const fleet = useApiQuery<FleetView>('/api/fleet', { topics: ['fleet', 'decisions', 'system'], intervalMs: 20_000 });
  const projects = useApiQuery<{ id: string; name: string; product: string | null }[]>('/api/projects', { topics: ['fleet'], intervalMs: 60_000 });
  const workflows = useApiQuery<WorkflowRow[]>('/api/workflows?phase=all&limit=200', { topics: ['fleet'], intervalMs: 20_000 });
  const attempts = useApiQuery<AttemptRow[]>('/api/attempts?active=1&limit=200', { topics: ['fleet'], intervalMs: 20_000 });
  const data = fleet.data;
  const allWorkflows = workflows.data ?? data?.workflows ?? [];
  const visibleWorkflows = allWorkflows.filter(row => project === 'all' || row.project === project);
  const activeAttempts = (attempts.data ?? []).filter(item => item.settledAt == null && item.dispatchedAt != null);
  const summary = data ? `${data.counts.live} luồng đang chạy · ${data.counts.bad} cần xử lý · ${data.counts.ownerDecisions} việc chờ thầy` : 'Đang đọc tình hình…';
  return <div className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-6 p-4 pb-24 sm:p-6 lg:p-8">
    <header className="space-y-2"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">StarCi / tổng quan</p><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Tổng quan</h1><p className="text-sm text-muted-foreground">{summary}</p></header>
    {fleet.error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">{fleet.error}</p>}
    <ConceptBlock concept="C13" as="section" className="rounded-xl border bg-card p-4"><div className="mb-3 flex items-center gap-2 text-sm font-medium"><Activity className="size-4" aria-hidden="true" /> Sức khỏe hệ thống</div>
      <div className="flex flex-wrap gap-2">{data?.health.items.map(item => <a key={item.key} href={item.href} className="inline-flex min-w-0 items-center gap-2 rounded-lg border px-3 py-2 text-xs hover:bg-muted/50"><StateChip state={item.ui} compact /><span className="font-medium">{healthNames[item.key]}</span><span className="truncate text-muted-foreground">{item.value}</span></a>) ?? <span className="text-sm text-muted-foreground">Đang đọc…</span>}</div>
    </ConceptBlock>
    <ConceptBlock concept="C12" as="section"><div className="mb-3 flex items-center gap-2"><CircleAlert className="size-4" aria-hidden="true" /><h2 className="font-semibold">Cần chú ý</h2><span className="text-sm text-muted-foreground">{data?.attention.length ?? '—'}</span></div>
      <Card><CardContent className="divide-y">{data?.attention.length ? data.attention.map((item, index) => <a href={item.ref.href} key={`${item.ref.kind}-${item.ref.id}-${index}`} className="flex min-w-0 items-center gap-3 py-3 first:pt-0 last:pb-0 hover:text-primary"><StateChip state={item.ui} compact /><span className="min-w-0 flex-1 truncate text-sm">{formatReason(item.reason)}</span><span className="hidden text-xs text-muted-foreground sm:block">{whoNames[item.who] ?? item.who}</span><ArrowRight className="size-4 shrink-0" aria-hidden="true" /></a>) : <p className="py-3 text-sm text-muted-foreground">{fleet.loading ? 'Đang đọc…' : 'Không có việc cần chú ý.'}</p>}</CardContent></Card>
    </ConceptBlock>
    <ConceptBlock concept="C7" as="section"><div className="mb-3 flex items-center gap-2"><Radio className="size-4" aria-hidden="true" /><h2 className="font-semibold">Đang thực thi</h2><span className="text-sm text-muted-foreground">{activeAttempts.length}{attempts.meta?.next ? '+' : ''}</span></div>
      <Card><CardContent className="divide-y">{activeAttempts.map(item => <a key={`${item.project}-${item.id}`} href={item.href} className="flex min-w-0 items-center gap-3 py-3 first:pt-0 last:pb-0 hover:text-primary"><StateChip state={item.ui} compact /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{item.op} · {item.unit ?? item.job}</span><span className="block truncate text-xs text-muted-foreground">{item.project} / {item.wf} · {item.agent ?? 'agent chưa rõ'} / {item.model ?? 'model chưa rõ'}</span></span><ArrowRight className="size-4 shrink-0" aria-hidden="true" /></a>)}{!activeAttempts.length && <p className="py-3 text-sm text-muted-foreground">{attempts.loading ? 'Đang đọc…' : 'Không có lần thử đang thực thi.'}</p>}</CardContent></Card>
    </ConceptBlock>
    <ConceptBlock concept="C2" as="section"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">Workflow</h2><div className="flex items-center gap-2"><span className="text-xs text-muted-foreground">{visibleWorkflows.length}{workflows.meta?.next ? '+' : ''} luồng</span><label className="sr-only" htmlFor="fleet-project">Dự án</label><select id="fleet-project" value={project} onChange={event => setProject(event.target.value)} className="h-8 rounded-lg border bg-background px-2 text-xs"><option value="all">Mọi dự án</option>{projects.data?.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div></div>
      <div className="grid gap-3">{visibleWorkflows.map(row => <WorkflowCard key={`${row.project}/${row.id}`} row={row} />)}
        {(workflows.data || data) && visibleWorkflows.length === 0 && <p className="rounded-xl border p-5 text-sm text-muted-foreground">Không có workflow phù hợp.</p>}</div>
    </ConceptBlock>
  </div>;
}

export default FleetPage;
