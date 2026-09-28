import { ArrowUpRight, Check, Clock3, Star } from 'lucide-react';
import { useApiQuery } from '../../api/query';
import { ConceptBlock, type Concept } from '../../components/concept';
import { Drawer } from '../../components/drawer';
import { StateChip } from '../../components/state-chip';
import { TimeAgo } from '../../components/time-ago';
import type { DecisionRow, Ref } from '../../contract';
import { formatAbsolute } from '../../i18n/vi';

export const concept: Concept = 'C12';

type Evidence = Ref | { text: string };
type DecisionDetail = DecisionRow & {
  evidence: Evidence[];
  options: { key: string; verb: string; recommended: boolean }[];
  allowedVerbs: string[];
  history: { kind: string; at: number; by: string | null; from?: string | null; to?: string | null }[];
  resolution: { by: string | null; verb: string | null; decision: Ref | null; result: unknown } | null;
  payload: unknown;
};

const actor = (value: string | null | undefined) => value === 'owner' ? 'Thầy' : value === 'kernel' ? 'Kernel' : value === 'supervisor' ? 'Supervisor' : value ?? 'Chưa rõ';
const channel = (value: DecisionRow['channel']) => ({ 'kernel-seat': 'Ghế Kernel', 'supervisor-seat': 'Ghế Supervisor', telegram: 'Telegram', 'serve-ask': 'Kênh hỏi thầy' } as Record<string, string>)[value ?? ''] ?? 'Chưa rõ';
const isRef = (item: Evidence): item is Ref => 'href' in item;

function EvidenceList({ items, credential }: { items: Evidence[]; credential: boolean }) {
  if (!items.length) return <p className="text-sm text-muted-foreground">Chưa có bằng chứng liên kết.</p>;
  return <ul className="space-y-2">{items.map((item, index) => <li key={index}>
    {isRef(item) ? <a href={item.href} className="inline-flex max-w-full items-center gap-1 rounded-md text-sm font-medium text-primary underline-offset-4 hover:underline">
      <span className="truncate">{item.kind} · {item.id}</span><ArrowUpRight className="size-3.5 shrink-0" aria-hidden="true" />
    </a> : <span className="text-sm text-muted-foreground">{credential ? 'Chi tiết xác thực được ẩn.' : item.text}</span>}
  </li>)}</ul>;
}

export function DecisionDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const detail = useApiQuery<DecisionDetail>(`/api/decisions/${encodeURIComponent(id ?? '')}`, { topics: ['decisions'], enabled: Boolean(id), intervalMs: 20_000 });
  const row = detail.data;
  const credential = row?.kind === 'credential-missing';
  return <Drawer open={Boolean(id)} onOpenChange={open => { if (!open) onClose(); }} title={id ? `Quyết định ${id}` : 'Quyết định'} description="Bản ghi chỉ đọc · trả lời qua kênh đang hiển thị">
    <ConceptBlock concept="C12" className="space-y-6" aria-live="polite">
      {detail.loading && <p className="text-sm text-muted-foreground">Đang đọc quyết định…</p>}
      {detail.error && <p role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">{detail.error}</p>}
      {row && <>
        <div className="flex flex-wrap items-center gap-2"><StateChip state={row.ui} /><span className="rounded-full border px-2 py-0.5 text-xs">{row.kind}</span><span className="text-xs text-muted-foreground">{row.status}</span></div>
        <div><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tóm tắt</p>
          <p className="mt-2 break-words text-sm leading-relaxed">{credential ? 'Yêu cầu xác thực · nội dung được ẩn.' : row.summary}</p></div>
        <dl className="grid grid-cols-1 gap-3 rounded-xl border p-4 text-sm sm:grid-cols-2">
          <div><dt className="text-muted-foreground">Người quyết</dt><dd className="font-medium">{actor(row.decider)}</dd></div>
          <div><dt className="text-muted-foreground">Kênh trả lời</dt><dd className="font-medium">{channel(row.channel)}</dd></div>
          <div><dt className="text-muted-foreground">Mở lúc</dt><dd>{formatAbsolute(row.openedAt)} · <TimeAgo at={row.openedAt} /></dd></div>
          <div><dt className="text-muted-foreground">Hạn</dt><dd className={row.overdue ? 'font-medium text-destructive' : ''}>{formatAbsolute(row.dueAt)}</dd></div>
          {row.claim && <div className="sm:col-span-2"><dt className="text-muted-foreground">Đã nhận xử lý</dt><dd>{actor(row.claim.by)} · {formatAbsolute(row.claim.at)} · hết hạn {formatAbsolute(row.claim.expiresAt)}</dd></div>}
        </dl>
        {row.project && row.wf && <a href={`#/w/${encodeURIComponent(row.project)}/${encodeURIComponent(row.wf)}?tab=decisions`} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">Xem workflow {row.wf}<ArrowUpRight className="size-3.5" aria-hidden="true" /></a>}
        <section className="space-y-2"><h3 className="font-semibold">Bằng chứng</h3><EvidenceList items={row.evidence ?? []} credential={credential} /></section>
        <section className="space-y-2"><h3 className="font-semibold">Lựa chọn đã ghi</h3>
          {row.options?.length ? <ul className="space-y-2">{row.options.map((option, index) => <li key={`${option.key}-${index}`} className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm">
            {option.recommended && <Star className="size-4 text-amber-500" fill="currentColor" aria-label="Đề xuất" />}
            <span className="font-medium">{option.key}</span><span className="text-muted-foreground">{option.verb}</span>
            {option.recommended && <span className="text-xs text-muted-foreground">Đề xuất</span>}
          </li>)}</ul> : <p className="text-sm text-muted-foreground">Chưa có lựa chọn được ghi.</p>}
        </section>
        <section className="space-y-2"><h3 className="font-semibold">Lịch sử nhận và leo thang</h3>
          {row.history?.length ? <ol className="space-y-2 border-l pl-4">{row.history.map((entry, index) => <li key={`${entry.kind}-${entry.at}-${index}`} className="relative text-sm before:absolute before:-left-[1.28rem] before:top-1.5 before:size-2 before:rounded-full before:bg-primary">
            <div className="flex flex-wrap items-center gap-2"><span className="font-medium">{entry.kind === 'decision-escalated' ? 'Leo thang' : entry.kind === 'decision-opened' ? 'Mở quyết định' : entry.kind}</span>
              <span className="text-xs text-muted-foreground">{formatAbsolute(entry.at)}</span></div>
            <p className="text-muted-foreground">{entry.from && entry.to ? `${actor(entry.from)} → ${actor(entry.to)}` : actor(entry.by)}</p>
          </li>)}</ol> : <p className="text-sm text-muted-foreground">Chưa có sự kiện lịch sử.</p>}
        </section>
        <section className="space-y-2"><h3 className="font-semibold">Kết quả</h3>{row.resolution ? <div className="rounded-lg border p-3 text-sm"><p className="flex items-center gap-2 font-medium"><Check className="size-4" aria-hidden="true" />{row.resolution.verb ?? 'Đã quyết'}</p><p className="mt-1 text-muted-foreground">Bởi {actor(row.resolution.by)} · {formatAbsolute(row.resolvedAt)}</p></div>
          : <p className="flex items-center gap-2 text-sm text-muted-foreground"><Clock3 className="size-4" aria-hidden="true" />Đang chờ quyết qua {channel(row.channel)}.</p>}</section>
      </>}
    </ConceptBlock>
  </Drawer>;
}
