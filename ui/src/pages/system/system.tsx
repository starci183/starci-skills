import { useState, type ReactNode } from 'react';
import { ArrowUpRight, Clock3, ExternalLink } from 'lucide-react';
import { Advanced } from '../../components/motion';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { ConceptBlock, type Concept } from '../../components/concept';
import { DataTable, type DataColumn } from '../../components/data-table';
import { FeedbackState, PageSkeleton } from '../../components/feedback-state';
import { Drawer } from '../../components/drawer';
import { BlobText } from '../../components/blob-text';
import { StateChip } from '../../components/state-chip';
import { useApiQuery, type QuerySnapshot } from '../../api/query';
import { formatAbsolute, formatRelative, learningKindLabels, learningStateLabels } from '../../i18n/vi';
import { useRoute, systemTabs, type SystemTab } from '../../router';
import { HostCard } from '../../components/host/host-card';
import type { ActionRow, BlobLink, HealthSummary, LandRun, ReconcilerView, Ref, ResourcesView, UiState } from '../../contract';

export const concept: Concept = 'C13';

type Service = { name: string; kind: string; state: string; ui: UiState; since: number; restarts24h: number; failedProbes24h: number; lastProbe: { at: number; ok: boolean; latencyMs: number | null; detail: unknown } | null; port: number | null; url: string | null; quarantinedUntil: number | null };
type Seat = { id: string; role: string; project: string | null; wf: string | null; state: string; parkedReason: string | null; ui: UiState; terminal: Ref | null; agent: string | null; model: string | null; bootedAt: number | null; lastSeenAt: number | null; replacedCount: number; inputFailuresConsecutive: number; deaf: boolean; lastSnapshotAt: number | null; transcript: BlobLink | null };
type Terminal = { handle: string; title: string; role: string; openedAt: number; closedAt: number | null; closeVerifiedAt: number | null; closedBy: string | null; ui: UiState };
type SlaClock = { id: string; entity: string; state: string; code: string; severity: string; project: string | null; wf: string | null; enteredAt: number; slaMs: number; dueAt: number; violatedAt: number | null; clearedAt: number | null; clearReason: string | null; di: Ref | null; ui: UiState };
type Violation = { id: string; code: string; severity: 'warn' | 'critical'; entity: Ref | { text: string }; project: string | null; violatedAt: number; clearedAt: number | null; di: Ref | null; lesson: Ref | null; detail: unknown };
type Catalog = { code: string; state: string; slaMs: number | null; warnMs: number | null; severity: string; owner: string; autoAction: string };
type GcRun = { id: number; startedAt: number; finishedAt: number | null; trigger: string; freedBytes: number; counts: Record<string, number>; errors: number; report: BlobLink | null; ui: UiState };
type Leak = { kind: string; target: string; project: string | null; since: number; owner: Ref | null };
type LandView = { queue: { ticket: string; lane: string; commit: string; state: string; enqueuedAt: number; gateAt: number | null; busyHolder: string | null; startedAt: number | null; ui: UiState }[]; recent: LandRun[]; pushes: { repo: string; branch: string; head: string; from: string; to: string; result: string; reason: string | null; failureSignature: string | null; stdout: BlobLink | null; stderr: BlobLink | null; at: number; ui: UiState }[] };
type Lane = { name: string; worktree: string | null; branch: string; baseSha: string | null; headSha: string | null; owner: string | null; supJob: Ref | null; state: string; ui: UiState; createdAt: number; landedAt: number | null; removedAt: number | null; report: BlobLink | null };
type Supervisor = { seat: Seat | null; decisionsOpen: number; overdue: number; undelivered: number; owed: { id: string; kind: string; subject: string; openedAt: number; dueAt: number | null; acked: boolean; ui: UiState }[]; workersActive: number; lastDigestAt: number | null; urgent24h: number };
type SupervisorWorker = { job: string; lane: string | null; kind: string; title: string; status: string; attempt: { agent: string | null; model: string | null; terminal: string | null; worktree: string | null; branch: string | null; spawnedAt: number | null; reportedAt: number | null; landedAt: number | null; verdict: string | null; landedSha: string | null; tokensIn: number | null; tokensOut: number | null; costUsd: number | null; transcript: BlobLink | null } | null; ui: UiState };
type Lesson = { id: string; kind: string; parent: string | null; title: string; state: string; source: Ref | null; lane: string | null; landedSha: string | null; createdAt: number; updatedAt: number };
type Ruling = { id: string; saidAt: number; channel: string; verbatim: string; paraphrase: string; appliesTo: string | null; contractRef: string | null };
type Score = { op: string; agent: string; model: string; attempts: number; pass: number; fail: number; blocked: number; workerDead: number; passRate: number | null; p50CycleMs: number | null; p90QueueMs: number | null; topFailure: { class: string; n: number }[]; tokensIn: number | null; tokensOut: number | null; costUsd: number | null };

const tabLabels: Record<SystemTab, string> = { engine: 'Engine', sla: 'SLA', resources: 'Tài nguyên', services: 'Dịch vụ', cleanup: 'Dọn dẹp', land: 'Land', supervisor: 'Supervisor', learning: 'Học' };
const tabConcepts: Record<SystemTab, Concept> = { engine: 'C13', sla: 'C13', resources: 'C14', services: 'C3', cleanup: 'C15', land: 'C11', supervisor: 'C3', learning: 'C16' };
const isIssue = (state: UiState | null | undefined) => state === 'bad' || state === 'warn';
const dash = (value: unknown): string => value == null || value === '' ? '—' : String(value);
const at = (value: number | null | undefined) => value == null ? '—' : formatAbsolute(value);
const number = (value: number | null | undefined, digits = 0) => value == null ? '—' : new Intl.NumberFormat('vi-VN', { maximumFractionDigits: digits }).format(value);
const stateOf = (rows: { ui: UiState }[]): UiState => rows.some((row) => row.ui === 'bad') ? 'bad' : rows.some((row) => row.ui === 'warn') ? 'warn' : 'ok';

function RefLink({ refValue }: { refValue: Ref | null }) { return refValue ? <a className="inline-flex items-center gap-1 text-primary hover:underline" href={refValue.href}>{refValue.id}<ArrowUpRight size={12} /></a> : <span>—</span>; }
function BlobLinkButton({ blob, label }: { blob: BlobLink | null; label: string }) { return blob ? <a className="inline-flex items-center gap-1 text-primary hover:underline" href={blob.href} target="_blank" rel="noreferrer">{label}<ExternalLink size={12} /></a> : <span className="text-muted-foreground">Chưa có {label.toLowerCase()}</span>; }
function QueryView<T>({ query, children, empty = 'Chưa có dữ liệu.' }: { query: QuerySnapshot<T>; children: (data: T) => ReactNode; empty?: string }) {
  if (query.data == null) return query.error ? <FeedbackState error>{`Không đọc được nguồn: ${query.error}`}</FeedbackState> : query.loading ? <PageSkeleton label="Đang đọc dữ liệu…" /> : <FeedbackState>{empty}</FeedbackState>;
  return <>{query.error && <p className="shell-error mb-3" role="status">Nguồn đang lỗi; hiển thị bản đã đọc gần nhất. {query.error}</p>}{query.meta?.stale?.length ? <p className="shell-error mb-3" role="status">Nguồn chưa đồng bộ: {query.meta.stale.join(', ')}</p> : null}{children(query.data)}</>;
}
function Panel({ title, summary, ui = 'ok', concept: blockConcept, children }: { title: string; summary?: string; ui?: UiState; concept: Concept; children: ReactNode }) {
  return <ConceptBlock concept={blockConcept}><Advanced key={isIssue(ui) ? 'issue' : 'calm'} variant="card" defaultOpen={ui === 'bad'} summary={summary}
    title={<span className="inline-flex items-center gap-3">{title}<StateChip state={ui} compact /></span>}>{children}</Advanced></ConceptBlock>;
}
function QueryPanel<T>({ title, summary, ui = 'ok', concept: blockConcept, query, children }: { title: string; summary?: string; ui?: UiState; concept: Concept; query: QuerySnapshot<T>; children: (data: T) => ReactNode }) {
  if (query.data == null) return <ConceptBlock concept={blockConcept}><Card><CardContent><h2 className="mb-3 text-sm font-medium">{title}</h2><QueryView query={query}>{children}</QueryView></CardContent></Card></ConceptBlock>;
  return <Panel title={title} summary={summary} ui={query.error ? 'warn' : ui} concept={blockConcept}><QueryView query={query}>{children}</QueryView></Panel>;
}
function Metric({ label, value, help }: { label: string; value: ReactNode; help?: string }) { return <div className="flex flex-col gap-1 border-t p-4 min-[760px]:p-6"><div className="text-xs text-muted-foreground">{label}</div><div className="text-lg font-semibold tabular-nums">{value}</div>{help && <div className="text-xs text-muted-foreground">{help}</div>}</div>; }

const tabItemKeys: Partial<Record<SystemTab, HealthSummary['items'][number]['key'][]>> = { sla: ['sla'], services: ['services', 'seats'], cleanup: ['leaks', 'gc'], land: ['land'] };
function TabSummary({ items }: { items: HealthSummary['items'] }) {
  if (!items.length) return null;
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{items.map((item) => <Metric key={item.key} label={item.key} value={<StateChip state={item.ui} label={item.value} />} />)}</div>;
}

function EngineTab() {
  const view = useApiQuery<ReconcilerView>('/api/reconciler', { topics: ['system'], intervalMs: 15_000 });
  const actions = useApiQuery<ActionRow[]>('/api/reconciler/actions?limit=50', { topics: ['system'], intervalMs: 30_000 });
  const queue = useApiQuery<{ controller: string; key: string; dueAt: number; reason: string | null; tries: number; lastError: string | null }[]>('/api/reconciler/queue', { topics: ['system'], intervalMs: 15_000 });
  const [selected, setSelected] = useState<ActionRow | null>(null);
  const columns: DataColumn<ReconcilerView['controllers'][number]>[] = [
    { key: 'controller', header: 'Controller', render: (row) => <span className="font-medium">{row.name}</span> },
    { key: 'mode', header: 'Chế độ', render: (row) => <span><Badge variant="outline">{row.mode}</Badge><small className="block text-muted-foreground" title={row.modeSetBy ?? undefined}>{at(row.modeSetAt)}</small></span> },
    { key: 'queue', header: 'Hàng đợi', numeric: true, render: (row) => number(row.queue.depth) },
    { key: 'actions', header: '24 giờ xong / lỗi', numeric: true, render: (row) => `${number(row.actions24h.done)} / ${number(row.actions24h.failed + row.actions24h.unknown)}` },
    { key: 'error', header: 'Lỗi gần nhất', render: (row) => row.lastError?.text ?? '—' },
    { key: 'state', header: 'Trạng thái', render: (row) => <StateChip state={row.ui} compact /> },
  ];
  return <ConceptBlock concept="C13" className="flex flex-col gap-6"><QueryView query={view}>{(data) => <>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label="Leader epoch" value={data.leader?.epoch ?? '—'} help={data.leader ? `Nhịp cuối ${formatRelative(data.leader.heartbeatAt)}` : 'Chưa có leader'} />
      <Metric label="Hàng đợi" value={data.queueDepth} />
      <Metric label="Khởi động / 1 giờ" value={data.startsLastHour} help={data.crashLoop ? 'Có dấu hiệu lặp khởi động' : undefined} />
      <Metric label="Vi phạm mở" value={data.openViolations} />
    </div>
    {data.leader?.lastError && <p className="shell-error">Lỗi engine: {data.leader.lastError}</p>}
    <div className="flex flex-col gap-4">
      <Panel title="Bảy controller" concept="C13" ui={stateOf(data.controllers)} summary={`${data.controllers.length} controller · ${data.controllers.filter((row) => row.mode === 'active').length} active`}><DataTable rows={data.controllers} columns={columns} getKey={(row) => row.name} /></Panel>
      <Panel title="Lịch chạy" concept="C13" ui={stateOf(data.schedules)} summary={`${data.schedules.length} duty`}><DataTable rows={data.schedules} getKey={(row) => `${row.controller}:${row.duty}`} columns={[
        { key: 'duty', header: 'Duty', render: (row) => `${row.controller} · ${row.duty}` }, { key: 'interval', header: 'Chu kỳ', render: (row) => `${number(row.intervalMs / 1000, 1)} giây` },
        { key: 'last', header: 'Chạy gần nhất', render: (row) => at(row.lastStartedAt) }, { key: 'next', header: 'Lần tới', render: (row) => at(row.nextDueAt) }, { key: 'state', header: 'Trạng thái', render: (row) => <StateChip state={row.ui} compact /> },
      ]} /></Panel>
      <Panel title="Khởi động engine" concept="C13" ui={data.crashLoop || data.badExits24h ? 'warn' : 'ok'} summary={`${data.starts24h.length} lần / 24 giờ`}><DataTable rows={data.starts24h} getKey={(row) => `${row.at}:${row.reason}`} columns={[
        { key: 'at', header: 'Bắt đầu', render: (row) => at(row.at) }, { key: 'reason', header: 'Lý do', render: (row) => row.reason }, { key: 'end', header: 'Kết thúc', render: (row) => at(row.endedAt) }, { key: 'exit', header: 'Lý do dừng', render: (row) => dash(row.exitReason) },
      ]} /></Panel>
    </div>
  </>}</QueryView>
    <QueryPanel title="Hành động gần đây" concept="C13" query={actions} ui={actions.data ? stateOf(actions.data) : 'unknown'} summary={actions.data ? `${actions.data.length} hành động` : undefined}>{(rows) => <DataTable rows={rows} getKey={(row) => row.id} columns={[
      { key: 'at', header: 'Bắt đầu', render: (row) => at(row.startedAt) }, { key: 'controller', header: 'Controller', render: (row) => row.controller }, { key: 'action', header: 'Hành động', render: (row) => row.duty ?? row.verb ?? row.id },
      { key: 'mode', header: 'Mode', render: (row) => row.mode ?? '—' }, { key: 'state', header: 'Kết quả', render: (row) => <StateChip state={row.ui} compact /> }, { key: 'open', header: '', render: (row) => <Button variant="ghost" size="sm" onClick={() => setSelected(row)}>Chi tiết</Button> },
    ]} />}</QueryPanel>
    <QueryPanel title="Hàng đợi engine" concept="C13" query={queue} ui={queue.data?.some((row) => row.lastError) ? 'warn' : 'ok'} summary={queue.data ? `${queue.data.length} mục` : undefined}>{(rows) => <DataTable rows={rows} getKey={(row) => `${row.controller}:${row.key}`} columns={[
      { key: 'controller', header: 'Controller', render: (row) => row.controller }, { key: 'key', header: 'Khóa', render: (row) => row.key }, { key: 'due', header: 'Đến hạn', render: (row) => at(row.dueAt) }, { key: 'tries', header: 'Lần thử', numeric: true, render: (row) => row.tries }, { key: 'error', header: 'Lỗi', render: (row) => dash(row.lastError) },
    ]} />}</QueryPanel>
    <Drawer open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null); }} title={selected ? `Hành động ${selected.id}` : 'Hành động'} description={selected ? `${selected.controller} · ${selected.state}` : undefined}>
      {selected && <div className="flex flex-col gap-4 text-sm"><div className="grid grid-cols-2 gap-3"><Metric label="Bắt đầu" value={at(selected.startedAt)} /><Metric label="Kết thúc" value={at(selected.finishedAt)} /></div>
        <div>Đích: <RefLink refValue={selected.target} /></div>{selected.errorSignature && <p className="shell-error">{selected.errorSignature}</p>}
        {selected.steps.length > 0 && <DataTable rows={selected.steps} getKey={(row) => row.stepNo} columns={[{ key: 'step', header: 'Bước', render: (row) => row.step }, { key: 'at', header: 'Thời điểm', render: (row) => at(row.startedAt) }, { key: 'result', header: 'Kết quả', render: (row) => row.ok == null ? 'Chưa rõ' : row.ok ? 'Đạt' : 'Lỗi' }]} />}
        {selected.result != null && <details><summary>Kết quả cấu trúc</summary><pre className="blob-text">{JSON.stringify(selected.result, null, 2)}</pre></details>}
        <div><h3 className="mb-2 font-medium">Stdout</h3><BlobText blob={selected.stdout} /></div><div><h3 className="mb-2 font-medium">Stderr</h3><BlobText blob={selected.stderr} /></div><BlobLinkButton blob={selected.resultBlob} label="Blob kết quả" />
      </div>}
    </Drawer>
  </ConceptBlock>;
}

function SlaTab() {
  const clocks = useApiQuery<SlaClock[]>('/api/sla/clocks?open=1', { topics: ['system'], intervalMs: 30_000 });
  const violations = useApiQuery<Violation[]>('/api/sla/violations?open=1', { topics: ['system'], intervalMs: 30_000 });
  const catalog = useApiQuery<Catalog[]>('/api/sla/catalog', { intervalMs: 300_000 });
  const explain = (code: string) => catalog.data?.find((item) => item.code === code);
  return <ConceptBlock concept="C13" className="flex flex-col gap-6">
    <QueryPanel title="Đợt SLA đang mở" concept="C13" query={clocks} ui={clocks.data ? stateOf(clocks.data) : 'unknown'} summary={clocks.data ? `${clocks.data.length} đợt` : undefined}>{(rows) => <DataTable rows={rows} getKey={(row) => row.id} columns={[
      { key: 'code', header: 'Mã / thực thể', render: (row) => <span title={explain(row.code)?.autoAction ?? row.code}><strong>{row.code}</strong><span className="block text-xs text-muted-foreground">{row.entity}</span></span> },
      { key: 'scope', header: 'Dự án / workflow', render: (row) => `${dash(row.project)} / ${dash(row.wf)}` }, { key: 'due', header: 'Đến hạn', render: (row) => at(row.dueAt) }, { key: 'violation', header: 'Vi phạm', render: (row) => at(row.violatedAt) }, { key: 'status', header: 'Trạng thái', render: (row) => <StateChip state={row.ui} compact /> }, { key: 'di', header: 'Quyết định', render: (row) => <RefLink refValue={row.di} /> },
    ]} />}</QueryPanel>
    <QueryPanel title="Bất biến đang vi phạm" concept="C13" query={violations} ui={violations.data?.some((row) => row.severity === 'critical') ? 'bad' : violations.data?.length ? 'warn' : 'ok'} summary={violations.data ? `${violations.data.length} vi phạm` : undefined}>{(rows) => <DataTable rows={rows} getKey={(row) => row.id} columns={[
      { key: 'code', header: 'Mã', render: (row) => <span title={explain(row.code)?.autoAction ?? row.code}>{row.code}</span> }, { key: 'severity', header: 'Mức', render: (row) => row.severity }, { key: 'project', header: 'Dự án', render: (row) => dash(row.project) }, { key: 'at', header: 'Từ lúc', render: (row) => at(row.violatedAt) }, { key: 'di', header: 'Quyết định', render: (row) => <RefLink refValue={row.di} /> }, { key: 'lesson', header: 'Bài học', render: (row) => <RefLink refValue={row.lesson} /> },
    ]} />}</QueryPanel>
    <QueryPanel title="Danh mục SLA" concept="C13" query={catalog} summary={catalog.data ? `${catalog.data.length} quy tắc` : undefined}>{(rows) => <DataTable rows={rows} getKey={(row) => row.code} columns={[
      { key: 'code', header: 'Mã', render: (row) => row.code }, { key: 'sla', header: 'Hạn', render: (row) => row.slaMs == null ? '—' : `${number(row.slaMs / 1000)} giây` }, { key: 'owner', header: 'Chủ trách nhiệm', render: (row) => row.owner }, { key: 'auto', header: 'Hành động tự động', render: (row) => row.autoAction },
    ]} />}</QueryPanel>
  </ConceptBlock>;
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return <span className="text-xs text-muted-foreground">Chưa đủ mẫu</span>;
  const max = Math.max(...values, 1), min = Math.min(...values, 0), span = Math.max(1, max - min);
  return <svg viewBox="0 0 300 64" role="img" aria-label="Xu hướng mẫu máy" className="h-16 w-full text-primary"><polyline fill="none" stroke="currentColor" strokeWidth="2" points={values.map((value, index) => `${index * 300 / (values.length - 1)},${60 - (value - min) * 56 / span}`).join(' ')} /></svg>;
}
function ResourcesTab() {
  const resources = useApiQuery<ResourcesView>('/api/resources', { topics: ['system'], intervalMs: 15_000 });
  const samples = useApiQuery<{ at: number; ramMb: number | null; cpuPct: number | null; freeRamMb: number | null; freeRamPct: number | null; freeDiskGb: number | null; subject: string | null }[]>('/api/resources/samples?kind=host&step=5', { topics: ['system'], intervalMs: 60_000 });
  return <ConceptBlock concept="C14" className="flex flex-col gap-6"><HostCard /><QueryView query={resources}>{(data) => <>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Chế độ giới hạn" value={<StateChip state={data.throttle.ui} label={data.throttle.mode} />} help={data.throttle.reason ?? undefined} /><Metric label="Giới hạn thực" value={number(data.throttle.effectiveCap)} /><Metric label="Đang chạy" value={number(data.throttle.running)} /><Metric label="RAM trống" value={data.throttle.freeRamPct == null ? '—' : `${number(data.throttle.freeRamPct, 1)}%`} /></div>
    <div className="grid gap-4 xl:grid-cols-2"><Panel title="CPU máy" concept="C14" summary="Mẫu từ host_samples"><QueryView query={samples}>{(rows) => <Sparkline values={rows.map((row) => row.cpuPct).filter((value): value is number => value != null)} />}</QueryView><div className="mt-2 text-xs text-muted-foreground">{data.throttle.cpuPct == null ? 'Chưa có số đo CPU' : `${number(data.throttle.cpuPct, 1)}% ở quan sát gần nhất`}</div></Panel><Panel title="RAM máy" concept="C14" summary="Mẫu từ host_samples"><QueryView query={samples}>{(rows) => <Sparkline values={rows.map((row) => row.freeRamPct).filter((value): value is number => value != null)} />}</QueryView></Panel></div>
    <div className="flex flex-col gap-4">
      <Panel title="Provider" concept="C14" ui={stateOf(data.providers)} summary={`${data.providers.length} provider`}><DataTable rows={data.providers} getKey={(row) => row.provider} columns={[{ key: 'provider', header: 'Provider', render: (row) => row.provider }, { key: 'state', header: 'Tình trạng', render: (row) => <StateChip state={row.ui} label={row.status} compact /> }, { key: 'strikes', header: 'Lần lỗi', numeric: true, render: (row) => row.strikes }, { key: 'circuit', header: 'Circuit mở đến', render: (row) => at(row.circuitOpenUntil) }, { key: 'reason', header: 'Lý do', mobileStack: true, render: (row) => dash(row.reason) }]} /></Panel>
      <Panel title="Pool backoff" concept="C14" ui={stateOf(data.pools)} summary={`${data.pools.length} pool`}><DataTable rows={data.pools} getKey={(row) => row.pool} columns={[{ key: 'pool', header: 'Pool', render: (row) => row.pool }, { key: 'until', header: 'Chờ đến', render: (row) => at(row.untilAt) }, { key: 'strikes', header: 'Lần lỗi', render: (row) => row.strikes }, { key: 'reason', header: 'Lý do', render: (row) => dash(row.reason) }]} /></Panel>
      <Panel title="Quota" concept="C14" ui={stateOf(data.quotas)} summary={`${data.quotas.length} hạn mức`}><DataTable rows={data.quotas} getKey={(row) => `${row.provider}:${row.window}`} columns={[{ key: 'provider', header: 'Provider', render: (row) => row.provider }, { key: 'window', header: 'Cửa sổ', render: (row) => row.window }, { key: 'used', header: 'Đã dùng / giới hạn', render: (row) => `${number(row.used)} / ${number(row.limit)}` }, { key: 'reset', header: 'Đặt lại', render: (row) => at(row.resetAt) }, { key: 'state', header: 'Trạng thái', render: (row) => <StateChip state={row.ui} compact /> }]} /></Panel>
      <Panel title="Lease" concept="C14" summary={`${data.leases.length} tài nguyên`}><DataTable rows={data.leases} getKey={(row) => row.resource} columns={[{ key: 'resource', header: 'Tài nguyên', render: (row) => row.resource }, { key: 'usage', header: 'Đang dùng / sức chứa', render: (row) => `${number(row.used)} / ${number(row.capacity)}` }, { key: 'holders', header: 'Giữ bởi', render: (row) => row.holders.map((holder) => <span key={holder.id} className="mr-2"><RefLink refValue={holder} /></span>) }]} /></Panel>
      <Panel title="Ngân sách" concept="C14" ui={stateOf(data.budgets)} summary={`${data.budgets.length} phạm vi`}><DataTable rows={data.budgets} getKey={(row) => row.scope} columns={[{ key: 'scope', header: 'Phạm vi', render: (row) => row.scope }, { key: 'usage', header: 'Đã dùng / dự trữ / giới hạn', render: (row) => `${number(row.used)} / ${number(row.reserved)} / ${number(row.limit)}` }, { key: 'window', header: 'Cửa sổ', render: (row) => dash(row.window) }, { key: 'state', header: 'Trạng thái', render: (row) => <StateChip state={row.ui} compact /> }]} /></Panel>
      <Panel title="Lần ghìm gần đây" concept="C14" ui={data.deferred.length ? 'warn' : 'ok'} summary={`${data.deferred.length} quyết định`}><DataTable rows={data.deferred} getKey={(row) => `${row.at}:${row.job ?? ''}`} columns={[{ key: 'at', header: 'Thời điểm', render: (row) => at(row.at) }, { key: 'job', header: 'Job', render: (row) => dash(row.job) }, { key: 'reason', header: 'Lý do', render: (row) => row.reason }, { key: 'wait', header: 'Đã chờ', render: (row) => row.waitedMs == null ? '—' : `${number(row.waitedMs / 1000, 1)} giây` }]} /></Panel>
    </div>
  </>}</QueryView></ConceptBlock>;
}

function ServicesTab() {
  const services = useApiQuery<Service[]>('/api/services', { topics: ['system'], intervalMs: 15_000 });
  const seats = useApiQuery<Seat[]>('/api/seats', { topics: ['system'], intervalMs: 15_000 });
  const terminals = useApiQuery<Terminal[]>('/api/terminals?open=1', { topics: ['system'], intervalMs: 15_000 });
  const [selected, setSelected] = useState<Service | null>(null);
  const probes = useApiQuery<{ probes: { at: number; ok: boolean; latencyMs: number | null; detail: unknown }[]; events: { at: number; from: string; to: string; probeMs: number | null; probeError: string | null; action: string | null }[] }>(`/api/services/${encodeURIComponent(selected?.name ?? '')}/probes`, { topics: ['system'], intervalMs: 60_000, enabled: Boolean(selected) });
  return <ConceptBlock concept="C3" className="flex flex-col gap-6">
    <QueryPanel title="Dịch vụ" concept="C3" query={services} ui={services.data ? stateOf(services.data) : 'unknown'} summary={services.data ? `${services.data.length} dịch vụ` : undefined}>{(rows) => <DataTable rows={rows} getKey={(row) => row.name} columns={[{ key: 'name', header: 'Dịch vụ', render: (row) => <span className="font-medium">{row.name}</span> }, { key: 'state', header: 'Trạng thái', render: (row) => <StateChip state={row.ui} label={row.state} compact /> }, { key: 'probe', header: 'Probe cuối', render: (row) => row.lastProbe ? `${row.lastProbe.ok ? 'Đạt' : 'Lỗi'} · ${at(row.lastProbe.at)}` : 'Chưa có' }, { key: 'failed', header: 'Probe lỗi / 24 giờ', render: (row) => row.failedProbes24h }, { key: 'open', header: '', render: (row) => <Button variant="ghost" size="sm" onClick={() => setSelected(row)}>Chi tiết</Button> }]} />}</QueryPanel>
    <QueryPanel title="Ghế agent" concept="C3" query={seats} ui={seats.data ? stateOf(seats.data) : 'unknown'} summary={seats.data ? `${seats.data.filter((row) => row.role === 'supervisor').length} Supervisor · ${seats.data.filter((row) => row.role === 'kernel').length} Kernel` : undefined}>{(rows) => <><p className="mb-3 text-xs text-muted-foreground">Một ghế Supervisor toàn cục; Kernel gắn với từng workflow. Op thực thi nằm trong lần thử.</p><DataTable rows={rows} getKey={(row) => row.id} columns={[{ key: 'seat', header: 'Ghế', render: (row) => <span className="font-medium">{row.id}</span> }, { key: 'role', header: 'Vai trò / workflow', render: (row) => `${row.role} · ${dash(row.wf)}` }, { key: 'model', header: 'Agent / model', render: (row) => `${dash(row.agent)} / ${dash(row.model)}` }, { key: 'state', header: 'Trạng thái', render: (row) => <><StateChip state={row.ui} label={row.state} compact />{row.deaf && <span className="ml-2 text-destructive">Mất tín hiệu</span>}</> }, { key: 'seen', header: 'Thấy lần cuối', render: (row) => at(row.lastSeenAt) }, { key: 'transcript', header: 'Bản ghi', render: (row) => <BlobLinkButton blob={row.transcript} label="Bản ghi" /> }]} /></>}</QueryPanel>
    <QueryPanel title="Terminal đang mở" concept="C3" query={terminals} ui={terminals.data ? stateOf(terminals.data) : 'unknown'} summary={terminals.data ? `${terminals.data.length} terminal` : undefined}>{(rows) => <DataTable rows={rows} getKey={(row) => row.handle} columns={[{ key: 'title', header: 'Terminal', render: (row) => row.title }, { key: 'role', header: 'Vai trò', render: (row) => row.role }, { key: 'seen', header: 'Thấy lần đầu', render: (row) => at(row.openedAt) }, { key: 'state', header: 'Trạng thái', render: (row) => <StateChip state={row.ui} compact /> }]} />}</QueryPanel>
    <Drawer open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null); }} title={selected?.name ?? 'Dịch vụ'} description="Probe và chuyển trạng thái từ nguồn runtime">
      <QueryView query={probes}>{(data) => <div className="flex flex-col gap-4"><h3 className="font-medium">Probe gần đây</h3><DataTable rows={data.probes} getKey={(row) => row.at} columns={[{ key: 'at', header: 'Thời điểm', render: (row) => at(row.at) }, { key: 'result', header: 'Kết quả', render: (row) => row.ok ? 'Đạt' : 'Lỗi' }, { key: 'latency', header: 'Độ trễ', render: (row) => row.latencyMs == null ? '—' : `${number(row.latencyMs)} ms` }]} /><h3 className="font-medium">Sự kiện</h3><DataTable rows={data.events} getKey={(row) => `${row.at}:${row.to}`} columns={[{ key: 'at', header: 'Thời điểm', render: (row) => at(row.at) }, { key: 'transition', header: 'Chuyển', render: (row) => `${row.from} → ${row.to}` }, { key: 'action', header: 'Hành động', render: (row) => dash(row.action) }]} /></div>}</QueryView>
    </Drawer>
  </ConceptBlock>;
}

function CleanupTab() {
  const runs = useApiQuery<GcRun[]>('/api/gc/runs', { topics: ['system'], intervalMs: 60_000 });
  const leaks = useApiQuery<Leak[]>('/api/leaks', { topics: ['system'], intervalMs: 60_000 });
  const [selected, setSelected] = useState<GcRun | null>(null);
  const details = useApiQuery<{ run: GcRun; items: { collector: string; kind: string; target: string; owner: Ref | null; ageMs: number | null; action: string; reason: string | null; bytes: number | null; tries: number; outcome: string; lastError: string | null; verifiedGoneAt: number | null; at: number }[] }>(`/api/gc/runs/${selected?.id ?? 0}`, { enabled: Boolean(selected), intervalMs: 60_000 });
  return <ConceptBlock concept="C15" className="flex flex-col gap-6"><QueryPanel title="Rò rỉ mở" concept="C15" query={leaks} ui={leaks.data?.length ? 'warn' : 'ok'} summary={leaks.data ? `${leaks.data.length} mục` : undefined}>{(rows) => <DataTable rows={rows} getKey={(row) => `${row.kind}:${row.target}`} columns={[{ key: 'kind', header: 'Loại', render: (row) => row.kind }, { key: 'target', header: 'Đích', render: (row) => row.target }, { key: 'project', header: 'Dự án', render: (row) => dash(row.project) }, { key: 'since', header: 'Từ lúc', render: (row) => at(row.since) }, { key: 'owner', header: 'Chủ', render: (row) => <RefLink refValue={row.owner} /> }]} />}</QueryPanel>
    <QueryPanel title="Lần dọn dẹp" concept="C15" query={runs} ui={runs.data ? stateOf(runs.data) : 'unknown'} summary={runs.data ? `${runs.data.length} lần` : undefined}>{(rows) => <DataTable rows={rows} getKey={(row) => row.id} columns={[{ key: 'id', header: 'Lần', render: (row) => row.id }, { key: 'start', header: 'Bắt đầu', render: (row) => at(row.startedAt) }, { key: 'trigger', header: 'Nguồn', render: (row) => row.trigger }, { key: 'freed', header: 'Giải phóng', render: (row) => `${number(row.freedBytes)} byte` }, { key: 'errors', header: 'Lỗi', render: (row) => row.errors }, { key: 'state', header: 'Trạng thái', render: (row) => <StateChip state={row.ui} compact /> }, { key: 'open', header: '', render: (row) => <Button variant="ghost" size="sm" onClick={() => setSelected(row)}>Chi tiết</Button> }]} />}</QueryPanel>
    <Drawer open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null); }} title={selected ? `Dọn dẹp #${selected.id}` : 'Dọn dẹp'} description={selected ? `${selected.trigger} · ${at(selected.startedAt)}` : undefined}><QueryView query={details}>{(data) => <div className="flex flex-col gap-4"><BlobLinkButton blob={data.run.report} label="Báo cáo" /><DataTable rows={data.items} getKey={(row) => `${row.collector}:${row.target}:${row.at}`} columns={[{ key: 'kind', header: 'Loại', render: (row) => `${row.collector} · ${row.kind}` }, { key: 'target', header: 'Đích', render: (row) => row.target }, { key: 'action', header: 'Hành động', render: (row) => row.action }, { key: 'outcome', header: 'Kết quả', render: (row) => row.outcome }, { key: 'error', header: 'Lỗi', render: (row) => dash(row.lastError) }]} /></div>}</QueryView></Drawer>
  </ConceptBlock>;
}

function LandTab() {
  const land = useApiQuery<LandView>('/api/land', { topics: ['system'], intervalMs: 30_000 });
  const runs = useApiQuery<LandRun[]>('/api/land/runs?limit=50', { topics: ['system'], intervalMs: 60_000 });
  const lanes = useApiQuery<Lane[]>('/api/lanes', { topics: ['system'], intervalMs: 60_000 });
  const [selected, setSelected] = useState<LandRun | null>(null);
  return <ConceptBlock concept="C11" className="flex flex-col gap-6"><QueryView query={land}>{(data) => <>
    <Panel title="Hàng đợi land" concept="C11" ui={stateOf(data.queue)} summary={`${data.queue.length} ticket`}><DataTable rows={data.queue} getKey={(row) => row.ticket} columns={[{ key: 'ticket', header: 'Ticket', render: (row) => row.ticket }, { key: 'lane', header: 'Lane', render: (row) => row.lane }, { key: 'commit', header: 'Commit', render: (row) => row.commit.slice(0, 10) }, { key: 'enqueued', header: 'Xếp hàng lúc', render: (row) => at(row.enqueuedAt) }, { key: 'state', header: 'Trạng thái', render: (row) => <StateChip state={row.ui} label={row.state} compact /> }]} /></Panel>
    <div><Panel title="Push" concept="C11" ui={stateOf(data.pushes)} summary={`${data.pushes.length} lần gần đây`}><DataTable rows={data.pushes} getKey={(row) => `${row.repo}:${row.at}`} columns={[{ key: 'repo', header: 'Repository', render: (row) => row.repo }, { key: 'branch', header: 'Nhánh', render: (row) => row.branch }, { key: 'at', header: 'Thời điểm', render: (row) => at(row.at) }, { key: 'result', header: 'Kết quả', render: (row) => <StateChip state={row.ui} label={row.result} compact /> }, { key: 'reason', header: 'Lý do', render: (row) => dash(row.reason) }, { key: 'stderr', header: 'Stderr', render: (row) => <BlobLinkButton blob={row.stderr} label="Stderr" /> }]} /></Panel></div>
  </>}</QueryView>
    <QueryPanel title="Kết quả land" concept="C11" query={runs} ui={runs.data ? stateOf(runs.data) : 'unknown'} summary={runs.data ? `${runs.data.length} lần gần đây` : undefined}>{(rows) => <DataTable rows={rows} getKey={(row) => row.id} columns={[{ key: 'id', header: 'Lần', render: (row) => row.id }, { key: 'lane', header: 'Lane', render: (row) => dash(row.lane) }, { key: 'commit', header: 'Commit', render: (row) => row.commit.slice(0, 10) }, { key: 'result', header: 'Kết quả', render: (row) => <StateChip state={row.ui} label={row.result} compact /> }, { key: 'reason', header: 'Lý do', render: (row) => dash(row.reason) }, { key: 'open', header: '', render: (row) => <Button variant="ghost" size="sm" onClick={() => setSelected(row)}>Bằng chứng</Button> }]} />}</QueryPanel>
    <QueryPanel title="Lane" concept="C11" query={lanes} ui={lanes.data ? stateOf(lanes.data) : 'unknown'} summary={lanes.data ? `${lanes.data.length} lane` : undefined}>{(rows) => <DataTable rows={rows} getKey={(row) => row.name} columns={[{ key: 'name', header: 'Lane', render: (row) => row.name }, { key: 'branch', header: 'Nhánh', render: (row) => row.branch }, { key: 'state', header: 'Trạng thái', render: (row) => <StateChip state={row.ui} label={row.state} compact /> }, { key: 'head', header: 'Head', render: (row) => row.headSha?.slice(0, 10) ?? '—' }, { key: 'report', header: 'Báo cáo', render: (row) => <BlobLinkButton blob={row.report} label="Báo cáo" /> }]} />}</QueryPanel>
    <Drawer open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null); }} title={selected ? `Land #${selected.id}` : 'Land'} description={selected ? `${selected.result} · ${selected.lane ?? 'không có lane'}` : undefined}>
      {selected && <div className="flex flex-col gap-4"><div className="grid grid-cols-2 gap-3"><Metric label="Commit" value={selected.commit.slice(0, 12)} /><Metric label="SHA sau land" value={selected.landedSha?.slice(0, 12) ?? '—'} /></div>{selected.reason && <p className="shell-error">{selected.reason}</p>}<div><h3 className="mb-2 font-medium">Stderr</h3><BlobText blob={selected.stderr} /></div><div><h3 className="mb-2 font-medium">Stdout</h3><BlobText blob={selected.stdout} /></div></div>}
    </Drawer>
  </ConceptBlock>;
}

function SupervisorTab() {
  const supervisor = useApiQuery<Supervisor>('/api/supervisor', { topics: ['system'], intervalMs: 30_000 });
  const workers = useApiQuery<SupervisorWorker[]>('/api/supervisor/workers?state=active', { topics: ['system'], intervalMs: 30_000 });
  const notices = useApiQuery<{ id: string; channel: string; kind: string; text: string; sentAt: number; delivery: string; media: BlobLink | null }[]>('/api/notifications', { topics: ['system'], intervalMs: 60_000 });
  return <ConceptBlock concept="C3" className="flex flex-col gap-6"><QueryView query={supervisor}>{(data) => <>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Ghế Supervisor toàn cục" value={data.seat ? <StateChip state={data.seat.ui} label={data.seat.state} /> : 'Chưa có ghế'} help={data.seat ? `${dash(data.seat.agent)} · ${dash(data.seat.model)}` : undefined} /><Metric label="Quyết định mở" value={data.decisionsOpen} help={`${data.overdue} quá hạn`} /><Metric label="Chưa giao tới ghế" value={data.undelivered} /><Metric label="Worker Supervisor" value={data.workersActive} /></div>
    <p className="text-xs text-muted-foreground">Supervisor là một ghế toàn cục; worker Supervisor xử lý việc giám sát. Kernel theo workflow và Op theo attempt được hiển thị riêng ở trang tương ứng.</p>
    <div><Panel title="Việc Supervisor còn nợ" concept="C3" ui={stateOf(data.owed)} summary={`${data.owed.length} mục`}><DataTable rows={data.owed} getKey={(row) => row.id} columns={[{ key: 'subject', header: 'Việc', render: (row) => row.subject }, { key: 'kind', header: 'Loại', render: (row) => row.kind }, { key: 'open', header: 'Mở lúc', render: (row) => at(row.openedAt) }, { key: 'due', header: 'Hạn', render: (row) => at(row.dueAt) }, { key: 'state', header: 'Trạng thái', render: (row) => <StateChip state={row.ui} label={row.acked ? 'Đã nhận' : 'Đang mở'} compact /> }]} /></Panel></div>
  </>}</QueryView>
    <QueryPanel title="Worker của Supervisor" concept="C3" query={workers} ui={workers.data ? stateOf(workers.data) : 'unknown'} summary={workers.data ? `${workers.data.length} worker đang hoạt động` : undefined}>{(rows) => <DataTable rows={rows} getKey={(row) => row.job} columns={[{ key: 'title', header: 'Việc', render: (row) => row.title }, { key: 'agent', header: 'Agent / model', render: (row) => row.attempt ? `${dash(row.attempt.agent)} / ${dash(row.attempt.model)}` : 'Chưa giao' }, { key: 'lane', header: 'Lane', render: (row) => dash(row.lane) }, { key: 'state', header: 'Trạng thái', render: (row) => <StateChip state={row.ui} label={row.status} compact /> }, { key: 'transcript', header: 'Bản ghi', render: (row) => <BlobLinkButton blob={row.attempt?.transcript ?? null} label="Bản ghi" /> }]} />}</QueryPanel>
    <QueryPanel title="Thông báo" concept="C17" query={notices} summary={notices.data ? `${notices.data.length} thông báo` : undefined}>{(rows) => <DataTable rows={rows} getKey={(row) => row.id} columns={[{ key: 'at', header: 'Thời điểm', render: (row) => at(row.sentAt) }, { key: 'kind', header: 'Loại / kênh', render: (row) => `${row.kind} · ${row.channel}` }, { key: 'text', header: 'Nội dung', render: (row) => row.text }, { key: 'delivery', header: 'Giao', render: (row) => row.delivery }]} />}</QueryPanel>
  </ConceptBlock>;
}

function LearningTab() {
  const lessons = useApiQuery<Lesson[]>('/api/supervisor/lessons', { topics: ['system'], intervalMs: 300_000 });
  const rulings = useApiQuery<Ruling[]>('/api/supervisor/rulings', { topics: ['system'], intervalMs: 300_000 });
  const scores = useApiQuery<Score[]>('/api/metrics/ops?window=7d', { topics: ['system'], intervalMs: 300_000 });
  return <ConceptBlock concept="C16" className="flex flex-col gap-6">
    <QueryPanel title="Bài học và thí nghiệm" concept="C16" query={lessons} summary={lessons.data ? `${lessons.data.length} mục` : undefined}>{(rows) => <DataTable rows={rows} getKey={(row) => row.id} columns={[{ key: 'title', header: 'Bài học', render: (row) => <span className="font-medium">{row.title}</span> }, { key: 'kind', header: 'Loại', render: (row) => <span title={row.kind}>{learningKindLabels[row.kind] ?? row.kind}</span> }, { key: 'state', header: 'Kết quả', render: (row) => <span title={row.state}>{learningStateLabels[row.state] ?? row.state}</span> }, { key: 'landed', header: 'Đã land', render: (row) => row.landedSha?.slice(0, 10) ?? '—' }, { key: 'updated', header: 'Cập nhật', render: (row) => at(row.updatedAt) }, { key: 'source', header: 'Nguồn', render: (row) => <RefLink refValue={row.source} /> }]} />}</QueryPanel>
    <QueryPanel title="Ruling của thầy" concept="C16" query={rulings} summary={rulings.data ? `${rulings.data.length} ruling` : undefined}>{(rows) => <DataTable rows={rows} getKey={(row) => row.id} columns={[{ key: 'at', header: 'Thời điểm', render: (row) => at(row.saidAt) }, { key: 'summary', header: 'Diễn giải', render: (row) => row.paraphrase }, { key: 'channel', header: 'Kênh', render: (row) => row.channel }, { key: 'contract', header: 'Tham chiếu', render: (row) => dash(row.contractRef) }]} />}</QueryPanel>
    <QueryPanel title="Hiệu năng model × op / 7 ngày" concept="C16" query={scores} summary={scores.data ? `${scores.data.length} cặp` : undefined}>{(rows) => <DataTable rows={rows} getKey={(row) => `${row.op}:${row.agent}:${row.model}`} columns={[{ key: 'op', header: 'Op', render: (row) => row.op }, { key: 'model', header: 'Agent / model', render: (row) => `${row.agent} / ${row.model}` }, { key: 'attempts', header: 'Lần thử', render: (row) => row.attempts }, { key: 'pass', header: 'Đạt / trượt / chặn', render: (row) => `${row.pass} / ${row.fail} / ${row.blocked}` }, { key: 'rate', header: 'Tỷ lệ đạt', render: (row) => row.passRate == null ? '—' : `${number(row.passRate * 100, 1)}%` }, { key: 'cost', header: 'Chi phí', render: (row) => row.costUsd == null ? '—' : `$${number(row.costUsd, 2)}` }]} />}</QueryPanel>
  </ConceptBlock>;
}

export default function SystemPage() {
  const route = useRoute();
  const tab = route.kind === 'system' ? route.tab : 'engine';
  const health = useApiQuery<HealthSummary>('/api/health', { topics: ['system'], intervalMs: 15_000 });
  const itemState = (keys: HealthSummary['items'][number]['key'][]): UiState => {
    const items = health.data?.items.filter((item) => keys.includes(item.key)) ?? [];
    return items.length ? stateOf(items) : 'unknown';
  };
  const tabStates: Record<SystemTab, UiState> = { engine: itemState(['engine']), sla: itemState(['sla']), resources: itemState(['ram', 'providers']), services: itemState(['services', 'seats']), cleanup: itemState(['leaks', 'gc']), land: itemState(['land']), supervisor: itemState(['seats']), learning: 'unknown' };
  return <ConceptBlock concept="C13" className="flex flex-col gap-6 md:gap-8"><div><p className="text-xs text-muted-foreground">StarCi / Vận hành</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Hệ thống</h1><p className="mt-1 text-sm text-muted-foreground">Engine, SLA, tài nguyên, dịch vụ, dọn dẹp, land, Supervisor và học từ nguồn runtime.</p></div>
    <nav className="-mx-1 overflow-x-auto border-b px-1" aria-label="Các phần hệ thống"><div className="flex min-w-max gap-1">{systemTabs.map((key) => <a key={key} href={`#/system/${key}`} data-concept={tabConcepts[key]} aria-current={tab === key ? 'page' : undefined} className={`inline-flex items-center gap-2 border-b-2 px-3 py-2 text-sm ${tab === key ? 'border-primary font-medium text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>{tabLabels[key]}{isIssue(tabStates[key]) && <span className={`size-1.5 rounded-full ${tabStates[key] === 'bad' ? 'bg-destructive' : 'bg-[var(--status-warning)]'}`} aria-label={tabStates[key] === 'bad' ? 'Có lỗi' : 'Có cảnh báo'} />}</a>)}</div></nav>
    {tab !== 'engine' && tab !== 'resources' && tab !== 'supervisor' && tab !== 'learning' && <TabSummary items={health.data?.items.filter((item) => tabItemKeys[tab]?.includes(item.key)) ?? []} />}
    {health.error && <p className="shell-error" role="status">Không đọc được trạng thái chung: {health.error}</p>}
    {tab === 'engine' && <EngineTab />}{tab === 'sla' && <SlaTab />}{tab === 'resources' && <ResourcesTab />}{tab === 'services' && <ServicesTab />}{tab === 'cleanup' && <CleanupTab />}{tab === 'land' && <LandTab />}{tab === 'supervisor' && <SupervisorTab />}{tab === 'learning' && <LearningTab />}
    <div className="flex items-center gap-2 text-xs text-muted-foreground"><Clock3 size={13} aria-hidden="true" />{health.meta ? `Nguồn hệ thống ${formatAbsolute(health.meta.at)}` : 'Chưa có thời điểm nguồn'}{health.meta?.stale?.length ? ` · chậm: ${health.meta.stale.join(', ')}` : ''}</div>
  </ConceptBlock>;
}
