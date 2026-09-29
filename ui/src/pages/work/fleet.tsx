import { useState } from 'react';
import { ArrowRight, CircleAlert } from 'lucide-react';
import { useApiQuery } from '../../api/query';
import type { FleetViewV2, HostView } from '../../contract';
import { formatReason } from '../../i18n/vi';
import { Card, CardContent } from '../../components/ui/card';
import { ConceptBlock, type Concept } from '../../components/concept';
import { StatusChip, StatusDot } from '../../components/status-chip';
import { statusFromUi } from '../../components/status';
import { KpiExtras, KpiStrip } from '../../components/overview/kpi-strip';
import { WorkflowCard } from '../../components/overview/workflow-card';
import { LiveFeed } from '../../components/overview/live-feed';
import { ModelsPanel } from '../../components/overview/models-panel';
import { HostCard } from '../../components/host/host-card';
import { Advanced, Stagger, StaggerItem } from '../../components/motion';

export const concept: Concept = 'C2';

const healthNames: Record<string, string> = { engine: 'Engine', services: 'Dịch vụ', seats: 'Ghế', ram: 'RAM', sla: 'SLA', leaks: 'Rò rỉ', gc: 'Dọn dẹp', land: 'Land', providers: 'Nhà cung cấp' };
const whoNames: Record<string, string> = { owner: 'Thầy', supervisor: 'Supervisor', kernel: 'Kernel', controller: 'Controller' };

export function FleetPage() {
  const [project, setProject] = useState('all');
  const fleet = useApiQuery<FleetViewV2>('/api/fleet?phase=all', { topics: ['fleet', 'decisions', 'system'], intervalMs: 20_000 });
  const projects = useApiQuery<{ id: string; name: string; product: string | null }[]>('/api/projects', { topics: ['fleet'], intervalMs: 60_000 });
  const host = useApiQuery<HostView>('/api/host', { topics: ['system'], intervalMs: 10_000 });
  const data = fleet.data ?? undefined;
  const visibleWorkflows = (data?.workflows ?? []).filter(row => project === 'all' || row.project === project);
  const summary = data ? `${data.counts.live} workflow đang chạy · ${data.counts.bad} cần xử lý · ${data.counts.ownerDecisions} việc chờ thầy` : 'Đang đọc tình hình…';
  const healthCount = data?.health.items.length ?? 0;
  return <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-6 pb-24 md:gap-8">
    <header className="flex flex-col gap-2"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">StarCi / tổng quan</p><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Tổng quan</h1><p className="text-sm text-muted-foreground">{summary}</p></header>
    {fleet.error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">{fleet.error}</p>}
    <KpiStrip summary={data?.summary} needsAttention={data?.counts.bad} />
    <ConceptBlock concept="C12" as="section"><div className="mb-3 flex items-center gap-2"><CircleAlert className="size-4" aria-hidden="true" /><h2 className="font-semibold">Cần chú ý</h2><span className="text-sm text-muted-foreground">{data?.attention.length ?? '—'}</span></div>
      <Card><CardContent className="p-4 pt-4 sm:p-6 sm:pt-6">{data?.attention.length ? <Stagger className="divide-y">{data.attention.map((item, index) => <StaggerItem key={`${item.ref.kind}-${item.ref.id}-${index}`} className="py-3 first:pt-0 last:pb-0"><a href={item.ref.href} className="flex min-w-0 items-center gap-3 hover:text-primary"><StatusChip status={statusFromUi(item.ui)} /><span className="min-w-0 flex-1 truncate text-sm">{formatReason(item.reason)}</span><span className="hidden text-xs text-muted-foreground sm:block">{whoNames[item.who] ?? item.who}</span><ArrowRight className="size-4 shrink-0" aria-hidden="true" /></a></StaggerItem>)}</Stagger> : <p className="text-sm text-muted-foreground">{fleet.loading ? 'Đang đọc…' : 'Không có việc cần chú ý.'}</p>}</CardContent></Card>
    </ConceptBlock>
    <ConceptBlock concept="C2" as="section" className="min-w-0"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">Workflow</h2><div className="flex items-center gap-2"><span className="text-xs text-muted-foreground">{visibleWorkflows.length} workflow</span><label className="sr-only" htmlFor="fleet-project">Dự án</label><select id="fleet-project" value={project} onChange={event => setProject(event.target.value)} className="h-8 rounded-lg border bg-background px-2 text-xs"><option value="all">Mọi dự án</option>{projects.data?.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div></div>
      <Stagger key={project} className="grid gap-4 md:grid-cols-2">{visibleWorkflows.map(row => <StaggerItem key={`${row.project}/${row.id}`} className="min-w-0"><WorkflowCard row={row} /></StaggerItem>)}</Stagger>
      {data && visibleWorkflows.length === 0 && <p className="rounded-xl border p-6 text-sm text-muted-foreground">Không có workflow phù hợp.</p>}
    </ConceptBlock>
    <section className="flex min-w-0 flex-col gap-4" aria-label="Chi tiết hệ thống">
      <Advanced variant="card" title="Máy chủ" summary={host.data ? `CPU ${host.data.cpu.loadPct ?? '—'} % · RAM ${Math.round(host.data.ram.usedPct)} %` : 'CPU, RAM, GPU, ổ đĩa'}><HostCard bare /></Advanced>
      <Advanced variant="card" title="Mô hình và token" summary="agent đang chạy · op theo mô hình · token 24 giờ"><div className="flex flex-col gap-4"><ModelsPanel summary={data?.summary} bare /><KpiExtras summary={data?.summary} /></div></Advanced>
      <Advanced variant="card" title="Đang diễn ra" summary="dòng sự kiện trực tiếp"><div className="-mx-4 overflow-hidden rounded-lg border sm:mx-0"><LiveFeed /></div></Advanced>
      <Advanced variant="card" title="Sức khỏe hệ thống" summary={`${healthCount} mục · ${data?.counts.bad ?? 0} cần xử lý`}>
        <ConceptBlock concept="C13" as="div" className="flex flex-wrap gap-2">{data?.health.items.map(item => <a key={item.key} href={item.href} className="inline-flex min-w-0 items-center gap-2 rounded-lg border px-3 py-2 text-xs hover:bg-muted/50"><StatusDot status={statusFromUi(item.ui)} /><span className="font-medium">{healthNames[item.key]}</span><span className="truncate text-muted-foreground">{item.value}</span></a>) ?? <span className="text-sm text-muted-foreground">Đang đọc…</span>}</ConceptBlock>
      </Advanced>
    </section>
  </div>;
}

export default FleetPage;
