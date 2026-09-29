import { ArrowRight, CircleAlert, MessageCircleQuestion, ShieldAlert } from 'lucide-react';
import { refreshQuery, useApiQuery } from '../../api/query';
import { ConceptBlock, type Concept } from '../../components/concept';
import { Advanced, Stagger, StaggerItem } from '../../components/motion';
import { FeedbackState, PageSkeleton } from '../../components/feedback-state';
import { StateChip } from '../../components/state-chip';
import { TimeAgo } from '../../components/time-ago';
import type { DecisionRow, Ref, UiState } from '../../contract';
import { formatAbsolute } from '../../i18n/vi';
import { useRoute } from '../../router';
import { DecisionDrawer } from './decision-drawer';

export const concept: Concept = 'C12';

type AskRow = { id: string; project: string | null; wf: string | null; di: Ref | null; channel: string | null;
  question: string | null; credential: boolean; askedAt: number; answeredAt: number | null; state: string };
type IncidentRow = { id: string; project: string; wf: string; op: string | null; kind: string; owner: string;
  status: string; resolvedReason: string | null; ui: UiState; dueAt: number | null; attempts: number;
  modelCalls: number; tokens: number; elapsedMs: number; lastProgress: string | null; updatedAt: number };

const deciderLabel = (value: string) => ({ kernel: 'Kernel', supervisor: 'Supervisor', owner: 'Thầy' } as Record<string, string>)[value] ?? value;
const channelLabel = (value: string | null) => ({ 'kernel-seat': 'Ghế Kernel', 'supervisor-seat': 'Ghế Supervisor', telegram: 'Telegram', 'serve-ask': 'Kênh hỏi thầy' } as Record<string, string>)[value ?? ''] ?? 'Chưa rõ';
const statusLabel = (value: string) => ({ open: 'Đang mở', claimed: 'Đã nhận', escalated: 'Đã leo thang', resolved: 'Đã giải', superseded: 'Đã thay thế', expired: 'Hết hạn', answered: 'Đã trả lời', retired: 'Đã đóng' } as Record<string, string>)[value] ?? value;
const escalation = (row: DecisionRow) => row.decider === 'owner' && row.escalations > 0 ? 'Kernel → Supervisor → Thầy'
  : row.escalations > 0 ? 'Kernel → Supervisor' : deciderLabel(row.decider);

function hashParams(): URLSearchParams {
  try { return new URL(window.location.hash.slice(1) || '/decisions', window.location.origin).searchParams; }
  catch { return new URLSearchParams(); }
}
function href(changes: Record<string, string | null>): string {
  const params = hashParams();
  for (const [key, value] of Object.entries(changes)) value ? params.set(key, value) : params.delete(key);
  return `#/decisions${params.size ? `?${params}` : ''}`;
}
function navigate(changes: Record<string, string | null>): void { window.location.hash = href(changes).slice(1); }
function SelectFilter({ label, value, options, onChange }: { label: string; value: string;
  options: { value: string; label: string }[]; onChange: (value: string) => void }) {
  return <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-muted-foreground"><span>{label}</span>
    <select value={value} onChange={event => onChange(event.target.value)} className="h-9 min-w-0 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  </label>;
}

function DecisionCard({ row }: { row: DecisionRow }) {
  const credential = row.kind === 'credential-missing';
  return <div className="flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-primary/40 min-[760px]:p-6">
    <a href={href({ id: row.id })} className="group flex min-w-0 flex-col gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-row sm:items-center sm:gap-4">
      <StateChip state={row.ui} compact />
      <span className="flex min-w-0 flex-1 flex-col gap-1"><span className="flex flex-wrap items-center gap-2"><strong className="break-all text-sm">{row.kind}</strong>{row.overdue && <span className="text-xs font-semibold text-destructive">Quá hạn</span>}</span>
        <span className="block break-words text-sm text-muted-foreground">{credential ? 'Yêu cầu xác thực · nội dung được ẩn.' : row.summary}</span>
        <span className="block break-words text-xs text-muted-foreground">Người quyết: {escalation(row)}</span>
      </span>
      <span className={`shrink-0 text-xs text-muted-foreground sm:text-right ${row.overdue ? 'font-semibold text-destructive' : ''}`}>Hạn {formatAbsolute(row.dueAt)}</span>
      <ArrowRight className="hidden size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary sm:block" aria-hidden="true" />
    </a>
    <Advanced summary="Dự án, workflow, kênh và thời điểm mở">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"><span>{row.project ?? 'Máy'}{row.wf ? ` · ${row.wf}` : ''}</span><span>Mở <TimeAgo at={row.openedAt} /></span><span>Kênh: {channelLabel(row.channel)}</span>{row.escalations > 0 && <span>Leo thang {row.escalations} lần</span>}</div>
    </Advanced>
  </div>;
}

function AskCard({ row }: { row: AskRow }) {
  return <ConceptBlock concept="C12" as="article" className="flex flex-col gap-3 rounded-xl border bg-card p-4 min-[760px]:p-6">
    <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><MessageCircleQuestion className="size-4 text-primary" aria-hidden="true" /><strong className="text-sm">{row.credential ? 'credential' : 'Hỏi thầy'}</strong></div>
      <span className="rounded-full border px-2 py-1 text-xs">{statusLabel(row.state)}</span></div>
    <p className="break-words text-sm">{row.credential ? 'Có mục xác thực cần xử lý qua kênh riêng. Nội dung được ẩn.' : row.question ?? 'Không có nội dung được phép hiển thị.'}</p>
    {row.di && <a href={row.di.href} className="inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline">Xem quyết định liên quan<ArrowRight className="size-3.5" aria-hidden="true" /></a>}
    <Advanced summary="Dự án, kênh và thời điểm hỏi"><div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"><span>{row.project ?? 'Máy'}{row.wf ? ` · ${row.wf}` : ''}</span><span>Kênh: {channelLabel(row.channel)}</span><span><TimeAgo at={row.askedAt} /></span></div></Advanced>
  </ConceptBlock>;
}

function IncidentCard({ row }: { row: IncidentRow }) {
  return <ConceptBlock concept="C12" as="article" className="flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-4 min-[760px]:p-6">
    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
      <StateChip state={row.ui} compact /><div className="flex min-w-0 flex-1 flex-col gap-1"><div className="flex flex-wrap items-center gap-2"><strong className="break-all text-sm">{row.kind}</strong><span className="text-xs text-muted-foreground">{statusLabel(row.status)}</span></div>
        {row.lastProgress && <p className="break-words text-sm text-muted-foreground">{row.lastProgress}</p>}
      </div><div className="shrink-0 text-xs text-muted-foreground sm:text-right"><p>Phụ trách: {deciderLabel(row.owner)}</p><p>Hạn: {formatAbsolute(row.dueAt)}</p></div>
    </div>
    <Advanced summary="Dự án, workflow, op và thời điểm cập nhật"><p className="break-words text-xs text-muted-foreground">{row.project} · {row.wf}{row.op ? ` · ${row.op}` : ''} · Cập nhật <TimeAgo at={row.updatedAt} /></p></Advanced>
  </ConceptBlock>;
}

export function DecisionsPage() {
  const route = useRoute();
  const params = hashParams();
  const tab = route.kind === 'decisions' ? route.tab : 'di';
  const selectedId = params.get('id');
  const decider = params.get('decider') ?? '', status = params.get('status') ?? '', kind = params.get('kind') ?? '';
  const overdue = params.get('overdue') === '1';
  const decisionParams = new URLSearchParams();
  if (decider) decisionParams.set('decider', decider);
  if (status) decisionParams.set('status', status);
  if (kind) decisionParams.set('kind', kind);
  if (overdue) decisionParams.set('overdue', '1');
  if (params.get('project')) decisionParams.set('project', params.get('project')!);
  if (params.get('wf')) decisionParams.set('wf', params.get('wf')!);
  const decisionsUrl = `/api/decisions${decisionParams.size ? `?${decisionParams}` : ''}`;
  const asksUrl = '/api/asks?state=open';
  const incidentsUrl = `/api/incidents?status=${tab === 'incidents' && status ? encodeURIComponent(status) : 'open'}`;
  const decisions = useApiQuery<DecisionRow[]>(decisionsUrl, { topics: ['decisions'], intervalMs: 20_000 });
  const asks = useApiQuery<AskRow[]>(asksUrl, { topics: ['decisions'], intervalMs: 30_000 });
  const incidents = useApiQuery<IncidentRow[]>(incidentsUrl, { topics: ['decisions'], intervalMs: 30_000 });
  const kinds = [...new Set([kind, ...(decisions.data ?? []).map(row => row.kind)].filter(Boolean))].sort();
  const tabs = [
    { key: 'di', label: 'DI', count: decisions.data?.length ?? null, icon: CircleAlert },
    { key: 'asks', label: 'Hỏi thầy', count: asks.data?.length ?? null, icon: MessageCircleQuestion },
    { key: 'incidents', label: 'Sự cố', count: incidents.data?.length ?? null, icon: ShieldAlert },
  ] as const;
  return <ConceptBlock concept="C12" className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-6 pb-24 md:gap-8">
    <header className="flex flex-col gap-2"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">StarCi / quyết định</p><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Quyết định</h1>
      <p className="text-sm text-muted-foreground">Theo dõi việc đang chờ quyết, câu hỏi gửi thầy và sự cố. Trang này chỉ đọc.</p></header>
    <nav aria-label="Mục quyết định" className="flex min-w-0 gap-1 overflow-x-auto border-b">
      {tabs.map(item => <a key={item.key} href={href({ tab: item.key, id: null, status: null, kind: null, overdue: null })} aria-current={tab === item.key ? 'page' : undefined}
        className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium ${tab === item.key ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
        <item.icon className="size-4" aria-hidden="true" />{item.label}<span className="text-xs text-muted-foreground tabular-nums">{item.count ?? '—'}</span>
      </a>)}
    </nav>
    {tab === 'di' && <div className="grid gap-4 rounded-xl border bg-card p-4 min-[760px]:p-6 sm:grid-cols-2 lg:grid-cols-4">
      <SelectFilter label="Người quyết" value={decider} options={[{ value: '', label: 'Tất cả' }, { value: 'kernel', label: 'Kernel' }, { value: 'supervisor', label: 'Supervisor' }, { value: 'owner', label: 'Thầy' }]} onChange={value => navigate({ decider: value, id: null })} />
      <SelectFilter label="Trạng thái" value={status} options={[{ value: '', label: 'Đang mở' }, { value: 'all', label: 'Tất cả' }, ...['open', 'claimed', 'escalated', 'resolved', 'expired', 'superseded'].map(value => ({ value, label: statusLabel(value) }))]} onChange={value => navigate({ status: value, id: null })} />
      <SelectFilter label="Loại" value={kind} options={[{ value: '', label: 'Tất cả' }, ...kinds.map(value => ({ value, label: value }))]} onChange={value => navigate({ kind: value, id: null })} />
      <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" checked={overdue} onChange={event => navigate({ overdue: event.target.checked ? '1' : null, id: null })} className="size-4 accent-primary" /><span>Chỉ quá hạn</span></label>
    </div>}
    {tab === 'incidents' && <div className="max-w-xs"><SelectFilter label="Trạng thái sự cố" value={status} options={[{ value: '', label: 'Đang mở' }, { value: 'all', label: 'Tất cả' }, { value: 'open', label: 'Đang mở' }, { value: 'resolved', label: 'Đã giải' }, { value: 'superseded', label: 'Đã thay thế' }]} onChange={value => navigate({ status: value })} /></div>}
    {tab === 'di' && <div className="grid gap-4" aria-live="polite">{decisions.error && <FeedbackState error onRetry={() => refreshQuery(decisionsUrl)}>{decisions.error}</FeedbackState>}
      <Stagger className="grid gap-4">{decisions.data?.map(row => <StaggerItem key={`${row.project ?? 'machine'}:${row.id}`}><DecisionCard row={row} /></StaggerItem>)}</Stagger>
      {!decisions.error && !decisions.data?.length && (decisions.loading ? <PageSkeleton label="Đang đọc quyết định…" /> : <FeedbackState>Không có quyết định phù hợp.</FeedbackState>)}</div>}
    {tab === 'asks' && <div className="grid gap-4" aria-live="polite">{asks.error && <FeedbackState error onRetry={() => refreshQuery(asksUrl)}>{asks.error}</FeedbackState>}
      <Stagger className="grid gap-4">{asks.data?.map(row => <StaggerItem key={row.id}><AskCard row={row} /></StaggerItem>)}</Stagger>
      {!asks.error && !asks.data?.length && (asks.loading ? <PageSkeleton label="Đang đọc câu hỏi…" /> : <FeedbackState>Không có câu hỏi đang mở.</FeedbackState>)}</div>}
    {tab === 'incidents' && <div className="grid gap-4" aria-live="polite">{incidents.error && <FeedbackState error onRetry={() => refreshQuery(incidentsUrl)}>{incidents.error}</FeedbackState>}
      <Stagger className="grid gap-4">{incidents.data?.map(row => <StaggerItem key={`${row.project}:${row.id}`}><IncidentCard row={row} /></StaggerItem>)}</Stagger>
      {!incidents.error && !incidents.data?.length && (incidents.loading ? <PageSkeleton label="Đang đọc sự cố…" /> : <FeedbackState>Không có sự cố phù hợp.</FeedbackState>)}</div>}
    <DecisionDrawer id={selectedId} onClose={() => navigate({ id: null })} />
  </ConceptBlock>;
}

export default DecisionsPage;
