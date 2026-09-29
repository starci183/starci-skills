import { useState } from 'react';
import { ArrowRight, Activity, CircleAlert } from 'lucide-react';
import { useApiQuery } from '../../api/query';
import type { FleetViewV2 } from '../../contract';
import { formatReason } from '../../i18n/vi';
import { Card, CardContent } from '../../components/ui/card';
import { ConceptBlock, type Concept } from '../../components/concept';
import { StatusChip, StatusDot } from '../../components/status-chip';
import { statusFromUi } from '../../components/status';
import { KpiStrip } from '../../components/overview/kpi-strip';
import { WorkflowCard } from '../../components/overview/workflow-card';
import { LiveFeed } from '../../components/overview/live-feed';
import { ModelsPanel } from '../../components/overview/models-panel';
import { HostCard } from '../../components/host/host-card';

export const concept: Concept = 'C2';

const healthNames: Record<string, string> = { engine: 'Engine', services: 'Dịch vụ', seats: 'Ghế', ram: 'RAM', sla: 'SLA', leaks: 'Rò rỉ', gc: 'Dọn dẹp', land: 'Land', providers: 'Nhà cung cấp' };
const whoNames: Record<string, string> = { owner: 'Thầy', supervisor: 'Supervisor', kernel: 'Kernel', controller: 'Controller' };

export function FleetPage() {
  const [project, setProject] = useState('all');
  const fleet = useApiQuery<FleetViewV2>('/api/fleet?phase=all', { topics: ['fleet', 'decisions', 'system'], intervalMs: 20_000 });
  const projects = useApiQuery<{ id: string; name: string; product: string | null }[]>('/api/projects', { topics: ['fleet'], intervalMs: 60_000 });
  const data = fleet.data ?? undefined;
  const visibleWorkflows = (data?.workflows ?? []).filter(row => project === 'all' || row.project === project);
  const summary = data ? `${data.counts.live} workflow đang chạy · ${data.counts.bad} cần xử lý · ${data.counts.ownerDecisions} việc chờ thầy` : 'Đang đọc tình hình…';
  return <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-6 p-4 pb-24 sm:p-6 lg:p-8">
    <header className="space-y-2"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">StarCi / tổng quan</p><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Tổng quan</h1><p className="text-sm text-muted-foreground">{summary}</p></header>
    {fleet.error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">{fleet.error}</p>}
    <KpiStrip summary={data?.summary} />
    <ConceptBlock concept="C13" as="section" className="rounded-xl border bg-card p-4"><div className="mb-3 flex items-center gap-2 text-sm font-medium"><Activity className="size-4" aria-hidden="true" /> Sức khỏe hệ thống</div>
      <div className="flex flex-wrap gap-2">{data?.health.items.map(item => <a key={item.key} href={item.href} className="inline-flex min-w-0 items-center gap-2 rounded-lg border px-3 py-2 text-xs hover:bg-muted/50"><StatusDot status={statusFromUi(item.ui)} /><span className="font-medium">{healthNames[item.key]}</span><span className="truncate text-muted-foreground">{item.value}</span></a>) ?? <span className="text-sm text-muted-foreground">Đang đọc…</span>}</div>
    </ConceptBlock>
    <ConceptBlock concept="C12" as="section"><div className="mb-3 flex items-center gap-2"><CircleAlert className="size-4" aria-hidden="true" /><h2 className="font-semibold">Cần chú ý</h2><span className="text-sm text-muted-foreground">{data?.attention.length ?? '—'}</span></div>
      <Card><CardContent className="divide-y">{data?.attention.length ? data.attention.map((item, index) => <a href={item.ref.href} key={`${item.ref.kind}-${item.ref.id}-${index}`} className="flex min-w-0 items-center gap-3 py-3 first:pt-0 last:pb-0 hover:text-primary"><StatusChip status={statusFromUi(item.ui)} /><span className="min-w-0 flex-1 truncate text-sm">{formatReason(item.reason)}</span><span className="hidden text-xs text-muted-foreground sm:block">{whoNames[item.who] ?? item.who}</span><ArrowRight className="size-4 shrink-0" aria-hidden="true" /></a>) : <p className="py-3 text-sm text-muted-foreground">{fleet.loading ? 'Đang đọc…' : 'Không có việc cần chú ý.'}</p>}</CardContent></Card>
    </ConceptBlock>
    <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <ConceptBlock concept="C2" as="section" className="min-w-0"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">Workflow</h2><div className="flex items-center gap-2"><span className="text-xs text-muted-foreground">{visibleWorkflows.length} workflow</span><label className="sr-only" htmlFor="fleet-project">Dự án</label><select id="fleet-project" value={project} onChange={event => setProject(event.target.value)} className="h-8 rounded-lg border bg-background px-2 text-xs"><option value="all">Mọi dự án</option>{projects.data?.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div></div>
        <div className="grid gap-3">{visibleWorkflows.map(row => <WorkflowCard key={`${row.project}/${row.id}`} row={row} />)}
          {data && visibleWorkflows.length === 0 && <p className="rounded-xl border p-5 text-sm text-muted-foreground">Không có workflow phù hợp.</p>}</div>
      </ConceptBlock>
      <div className="grid min-w-0 content-start gap-6">
        <HostCard compact />
        <section className="min-w-0 rounded-xl border bg-card shadow-sm"><div className="flex items-center justify-between border-b px-4 py-3"><h2 className="font-semibold">Đang diễn ra</h2><span data-tone="success" className="inline-flex items-center gap-1.5 text-xs" style={{ color: 'var(--tone)' }}><span className="status-dot" aria-hidden="true" />trực tiếp</span></div><LiveFeed /></section>
        <section className="min-w-0 rounded-xl border bg-card shadow-sm"><div className="flex items-center justify-between border-b px-4 py-3"><h2 className="font-semibold">Mô hình đang dùng</h2><span className="text-xs text-muted-foreground">op đang chạy</span></div><ModelsPanel summary={data?.summary} /></section>
      </div>
    </div>
  </div>;
}

export default FleetPage;
