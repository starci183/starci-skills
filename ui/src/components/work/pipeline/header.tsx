import type { Concept } from '../../concept';
export const concept: Concept = 'C2';
import { ArrowLeft } from 'lucide-react';
import type { PipelineView, WorkflowDetailV2 } from '../../../contract';
import { formatAbsolute, formatReason } from '../../../i18n/vi';
import { StatusChip } from '../../status-chip';
import { statusLabels, statusTone, type Status } from '../../status';
import { statusFromUi } from '../../status';

const order: Status[] = ['success', 'running', 'settling', 'queued', 'retry', 'failed', 'blocked', 'planned', 'deferred', 'external', 'dropped', 'unknown'];
const fmt = (value: number) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(value);

/** Overall progress: one segment per leg in chain order, coloured by status, with a counted legend. */
export function LegProgress({ pipeline }: { pipeline: PipelineView }) {
  const { done, total, byStatus } = pipeline.progress;
  const legs = [...pipeline.legs].sort((a, b) => a.seq - b.seq);
  return <div>
    <div className="mb-2 flex items-baseline justify-between gap-3"><span className="text-sm"><strong className="text-lg tabular-nums">{done}/{total}</strong> chặng đạt</span>
      <span className="text-xs text-muted-foreground">{legs.length} chặng trong chuỗi · {pipeline.attempts} lần thử · {pipeline.failures} lần hỏng</span></div>
    <div className="flex h-3 gap-0.5" role="img" aria-label={`${done} trên ${total} chặng đạt`}>{legs.map(leg => <span key={leg.op} title={`${leg.seq}. ${leg.op} · ${statusLabels[leg.status]}`} data-tone={statusTone[leg.status]}
      className={`min-w-0 flex-1 rounded-sm border bg-[var(--tone)] ${statusTone[leg.status] === 'skipped' ? 'border-dashed border-[var(--tone-line)] bg-transparent' : 'border-transparent'} ${leg.current ? 'outline outline-2 outline-offset-1 outline-[var(--status-running)]' : ''} ${leg.status === 'queued' || leg.status === 'planned' ? 'opacity-40' : ''}`} />)}</div>
    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">{order.filter(status => (byStatus[status] ?? 0) > 0 || legs.some(leg => leg.status === status)).map(status => {
      const n = legs.filter(leg => leg.status === status).length;
      return <li key={status} data-tone={statusTone[status]} className="inline-flex items-center gap-1.5"><span className="status-dot" />{statusLabels[status]} <strong className="text-foreground tabular-nums">{n}</strong></li>;
    })}</ul>
  </div>;
}

export function WorkflowHeader({ row, pipeline }: { row: WorkflowDetailV2; pipeline: PipelineView | null }) {
  const problems = [
    row.blockedBy.length > 0 && { key: 'b', status: 'blocked' as Status, text: `${row.blockedBy.length} điểm đang chặn` },
    (pipeline?.failures ?? 0) > 0 && { key: 'f', status: 'failed' as Status, text: `${pipeline!.failures} lần thử hỏng` },
    row.counts.decisionsOpen > 0 && { key: 'd', status: 'retry' as Status, text: `${row.counts.decisionsOpen} quyết định đang chờ` },
  ].filter(Boolean) as { key: string; status: Status; text: string }[];
  const phaseStatus: Status = row.phase === 'paused' || row.phase === 'stopped' ? 'queued' : statusFromUi(row.ui);
  const phaseText = row.phase === 'paused' ? 'Tạm dừng' : row.phase === 'stopped' ? 'Đã dừng' : row.phase === 'running' ? 'Đang chạy' : row.phase;
  return <header className="space-y-3">
    <nav aria-label="Vị trí" className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground"><a href="#/" className="inline-flex items-center gap-1 hover:text-foreground"><ArrowLeft className="size-4" /> Tổng quan</a><span aria-hidden="true">/</span><span>{row.project}</span></nav>
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2"><h1 className="min-w-0 break-words text-2xl font-semibold tracking-tight sm:text-3xl">{row.name}</h1>
      <StatusChip status={phaseStatus} label={phaseText} />{problems.map(item => <StatusChip key={item.key} status={item.status} label={item.text} />)}</div>
    <details className="rounded-lg border bg-card px-4 py-2.5 text-sm"><summary className="cursor-pointer list-none"><span className="font-medium">Mục tiêu · bản {row.goal.revision}</span><span className="ml-2 text-muted-foreground line-clamp-1 inline">{row.goal.text ? row.goal.text.slice(0, 160) : 'Chưa có mục tiêu được ghi nhận.'}</span></summary>
      <p className="mt-2 whitespace-pre-wrap break-words border-t pt-2 leading-relaxed">{row.goal.text || 'Chưa có mục tiêu được ghi nhận.'}</p></details>
    {pipeline && <div className="rounded-xl border bg-card p-4 shadow-sm"><LegProgress pipeline={pipeline} />
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t pt-3 text-xs text-muted-foreground">
        <span>Tốc độ <strong className="text-foreground tabular-nums">{fmt(row.ratePerHour)}/giờ</strong>{row.minRatePerHour != null ? ` (tối thiểu ${fmt(row.minRatePerHour)})` : ''}</span>
        <span>Đang chạy <strong className="text-foreground tabular-nums">{row.running}/{row.allowedParallel ?? '—'}</strong></span>
        <span>ETA <strong className="text-foreground">{row.etaAt != null ? formatAbsolute(row.etaAt) : 'chưa ước tính được'}</strong></span>
        <span>{row.onIt ? `${row.onIt.who} đang lo · ${formatReason(row.onIt.reason)}` : 'Chưa ghi người xử lý'}</span>
        <span data-concept="C3">Ghế Kernel · {row.seat?.state ?? 'chưa rõ'}</span>
        {row.phase !== 'running' && <span>{phaseText}: {row.phaseReason ?? 'chưa ghi lý do'}</span>}
      </div></div>}
  </header>;
}
