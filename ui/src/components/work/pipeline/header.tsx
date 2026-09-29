import type { Concept } from '../../concept';
export const concept: Concept = 'C2';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import type { PipelineView, WorkflowDetailV2 } from '../../../contract';
import { formatAbsolute, formatReason } from '../../../i18n/vi';
import { StatusChip } from '../../status-chip';
import { statusLabels, statusTone, type Status } from '../../status';
import { statusFromUi } from '../../status';
import { Advanced, Grow, Swap, Ticker } from '../../motion';

const order: Status[] = ['success', 'running', 'settling', 'queued', 'retry', 'failed', 'blocked', 'awaiting-owner', 'planned', 'deferred', 'external', 'dropped', 'unknown'];
const stuckReasons: Record<string, string> = {
  STALLED: 'đứng yên, không có tiến triển', OWNER_DECISION_OPEN: 'đang chờ chủ quyết định', SEAT_VACANT: 'ghế Kernel đang trống', SLA_CRITICAL: 'vi phạm SLA nghiêm trọng',
};
const fmt = (value: number) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(value);

/** Overall progress: one segment per leg in chain order, coloured by status, with a counted legend. */
export function LegProgress({ pipeline, eta, action }: { pipeline: PipelineView; eta?: string; action?: { href: string; label: string } | null }) {
  const { done, total, byStatus } = pipeline.progress;
  const legs = [...pipeline.legs].sort((a, b) => a.seq - b.seq);
  return <div>
    <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1"><span className="text-sm"><strong className="text-lg tabular-nums"><Ticker value={done} />/{total}</strong> chặng đạt{eta ? <span className="ml-3 text-xs text-muted-foreground">ETA <strong className="text-foreground">{eta}</strong></span> : null}</span>
      {action ? <a href={action.href} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">{action.label} <ArrowRight className="size-3.5" aria-hidden="true" /></a> : null}</div>
    <div className="flex h-3 gap-1" role="img" aria-label={`${done} trên ${total} chặng đạt`}>{legs.map((leg, index) => <span key={leg.op} title={`${leg.seq}. ${leg.op} · ${statusLabels[leg.status]}`} data-tone={statusTone[leg.status]} className="block min-w-0 flex-1">
      <Grow delay={index * 0.02} className={`block size-full rounded-sm border bg-[var(--tone)] ${statusTone[leg.status] === 'skipped' ? 'border-dashed border-[var(--tone-line)] bg-transparent' : 'border-transparent'} ${leg.current ? 'outline outline-2 outline-offset-1 outline-[var(--status-running)]' : ''} ${leg.status === 'queued' || leg.status === 'planned' ? 'opacity-40' : ''}`} /></span>)}</div>
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">{order.filter(status => (byStatus[status] ?? 0) > 0 || legs.some(leg => leg.status === status)).map(status => {
      const n = legs.filter(leg => leg.status === status).length;
      return <li key={status} data-tone={statusTone[status]} className="inline-flex items-center gap-2"><span className="status-dot" />{statusLabels[status]} <strong className="text-foreground tabular-nums">{n}</strong></li>;
    })}</ul>
  </div>;
}

export function WorkflowHeader({ row, pipeline }: { row: WorkflowDetailV2; pipeline: PipelineView | null }) {
  const problems = [
    row.blockedBy.length > 0 && { key: 'b', status: 'blocked' as Status, text: `${row.blockedBy.length} điểm đang chặn` },
    (pipeline?.failures ?? 0) > 0 && { key: 'f', status: 'failed' as Status, text: `${pipeline!.failures} lần thử hỏng` },
    row.counts.decisionsOpen > 0 && { key: 'd', status: 'retry' as Status, text: `${row.counts.decisionsOpen} quyết định đang chờ` },
  ].filter(Boolean) as { key: string; status: Status; text: string }[];
  // A running workflow keeps the blue "Đang chạy" phase; being stuck or slow is a separate chip so red never mislabels the phase.
  const running = row.phase === 'running';
  const phaseStatus: Status = row.phase === 'paused' || row.phase === 'stopped' ? 'queued' : running ? 'running' : statusFromUi(row.ui);
  const healthChip = running && (row.ui === 'bad' || row.ui === 'warn')
    ? { status: (row.ui === 'bad' ? 'failed' : 'warning') as Status, text: `${row.ui === 'bad' ? 'Kẹt' : 'Cảnh báo'} · ${row.reason ? (stuckReasons[row.reason.code] ?? formatReason(row.reason)) : 'chưa ghi lý do'}` } : null;
  const phaseText = row.phase === 'paused' ? 'Tạm dừng' : row.phase === 'stopped' ? 'Đã dừng' : row.phase === 'running' ? 'Đang chạy' : row.phase;
  const root = `#/w/${encodeURIComponent(row.project)}/${encodeURIComponent(row.id)}`;
  const currentLeg = pipeline?.legs.find(leg => leg.current) ?? null;
  const action = row.blockedBy[0] ? { href: row.blockedBy[0].ref.href, label: 'Xem chỗ đang chặn' }
    : row.counts.decisionsOpen > 0 ? { href: `${root}?tab=decisions`, label: 'Xem quyết định đang chờ' }
    : currentLeg ? { href: `${root}?leg=${encodeURIComponent(currentLeg.op)}`, label: 'Xem chặng đang chạy' } : null;
  const why = row.reason ? formatReason(row.reason) : row.phase !== 'running' ? row.phaseReason : row.onIt ? `${row.onIt.who} đang lo · ${formatReason(row.onIt.reason)}` : null;
  return <header className="flex flex-col gap-4">
    <nav aria-label="Vị trí" className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground"><a href="#/" className="inline-flex items-center gap-1 hover:text-foreground"><ArrowLeft className="size-4" /> Tổng quan</a><span aria-hidden="true">/</span><span>{row.project}</span></nav>
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2"><h1 className="min-w-0 break-words text-2xl font-semibold tracking-tight sm:text-3xl">{row.name}</h1>
        <Swap keyValue={`${phaseStatus}-${phaseText}`}><StatusChip status={phaseStatus} label={phaseText} /></Swap>{healthChip && <StatusChip status={healthChip.status} label={healthChip.text} />}{problems.map(item => <StatusChip key={item.key} status={item.status} label={item.text} />)}</div>
      {why ? <p className="text-sm text-muted-foreground">{why}</p> : null}
    </div>
    <details className="rounded-lg border bg-card px-4 py-3 text-sm"><summary className="cursor-pointer list-none"><span className="font-medium">Mục tiêu · bản {row.goal.revision}</span><span className="ml-2 text-muted-foreground line-clamp-1 inline">{row.goal.text ? row.goal.text.slice(0, 160) : 'Chưa có mục tiêu được ghi nhận.'}</span></summary>
      <p className="mt-2 whitespace-pre-wrap break-words border-t pt-2 leading-relaxed">{row.goal.text || 'Chưa có mục tiêu được ghi nhận.'}</p></details>
    {pipeline && <div className="flex flex-col gap-4 rounded-xl border bg-card p-4 shadow-sm md:p-6"><LegProgress pipeline={pipeline} eta={row.etaAt != null ? formatAbsolute(row.etaAt) : 'chưa ước tính được'} action={action} />
      <Advanced summary="tốc độ · song song · người xử lý · ghế Kernel · số lần thử">
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
          <span>{pipeline.legs.length} chặng trong chuỗi · {pipeline.attempts} lần thử · {pipeline.failures} lần hỏng</span>
          <span>Tốc độ <strong className="text-foreground tabular-nums">{fmt(row.ratePerHour)}/giờ</strong>{row.minRatePerHour != null ? ` (tối thiểu ${fmt(row.minRatePerHour)})` : ''}</span>
          <span>Đang chạy <strong className="text-foreground tabular-nums">{row.running}/{row.allowedParallel ?? '—'}</strong></span>
          <span>{row.onIt ? `${row.onIt.who} đang lo · ${formatReason(row.onIt.reason)}` : 'Chưa ghi người xử lý'}</span>
          <span data-concept="C3">Ghế Kernel · {row.seat?.state ?? 'chưa rõ'}</span>
          {row.phase !== 'running' && <span>{phaseText}: {row.phaseReason ?? 'chưa ghi lý do'}</span>}
        </div></Advanced></div>}
  </header>;
}
