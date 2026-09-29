import { ArrowRight } from 'lucide-react';
import type { WorkflowRowV2 } from '../../contract';
import { StatusChip } from '../status-chip';
import { statusFromUi, type Status } from '../status';
import { TimeAgo } from '../time-ago';
import { PipelineDots } from './pipeline-dots';
import type { Concept } from '../concept';

export const concept: Concept = 'C2';

const numeric = (value: number) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(value);
export const workflowHref = (row: Pick<WorkflowRowV2, 'project' | 'id'>) => `#/w/${encodeURIComponent(row.project)}/${encodeURIComponent(row.id)}`;

function overall(row: WorkflowRowV2): { status: Status; label?: string } {
  if (row.phase === 'paused') return { status: 'queued', label: 'Tạm dừng' };
  if (row.phase === 'stopped') return { status: 'dropped', label: 'Đã dừng' };
  if (row.phase === 'finished' || row.phase === 'archived') return { status: 'success', label: 'Đã xong' };
  if (row.ui === 'bad') return { status: 'failed', label: 'Kẹt' };
  if (row.ui === 'warn') return { status: 'retry', label: 'Chậm' };
  if (row.phase === 'running') return { status: 'running', label: 'Đang chạy' };
  return { status: statusFromUi(row.ui), label: row.phase };
}

export function WorkflowCard({ row }: { row: WorkflowRowV2 }) {
  const pipeline = row.pipeline;
  const state = overall(row);
  const legs = pipeline?.legs ?? [];
  const currentLegs = legs.filter(leg => leg.current);
  const waiting = legs.filter(leg => !leg.current && (leg.status === 'queued' || leg.status === 'retry')).map(leg => leg.op);
  return <a href={workflowHref(row)} className="block min-w-0 rounded-xl border bg-card p-4 shadow-sm transition-colors hover:border-[var(--primary)] focus-visible:outline focus-visible:outline-2 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs text-muted-foreground">{row.project} · <span className="font-mono">{row.id}</span></p>
        <h3 className="mt-1 inline-flex max-w-full items-center gap-1 font-semibold"><span className="truncate">{row.name}</span><ArrowRight className="size-3.5 shrink-0" aria-hidden="true" /></h3>
      </div>
      <StatusChip status={state.status} label={state.label} />
    </div>
    {pipeline && <div className="mt-4 space-y-2">
      <PipelineDots pipeline={pipeline} />
      <p className="text-sm"><strong className="tabular-nums">{pipeline.progress.done}/{pipeline.progress.total}</strong> chặng đạt</p>
    </div>}
    <dl className="mt-3 space-y-1.5 text-sm">
      {currentLegs.map(leg => <div key={leg.op} className="flex flex-wrap items-center gap-x-2">
        <dt className="text-muted-foreground">Đang ở</dt>
        <dd className="font-mono text-[13px]">{leg.op}<span className="text-muted-foreground"> · {leg.tries > 0 ? `lần ${leg.tries}/5` : 'chưa có lần thử'}{leg.units > 1 ? ` · ${leg.units} unit song song` : ''}</span></dd>
      </div>)}
      {waiting.length > 0 && <div className="flex flex-wrap items-center gap-x-2"><dt className="text-muted-foreground">Chờ</dt><dd className="font-mono text-[13px]">{waiting.join(', ')}</dd></div>}
    </dl>
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-3 text-xs text-muted-foreground">
      <span>Sự kiện cuối: <TimeAgo at={pipeline?.lastEventAt ?? row.updatedAt} /></span>
      <span data-tone={pipeline && pipeline.failures > 0 ? 'failed' : undefined} style={pipeline && pipeline.failures > 0 ? { color: 'var(--tone)' } : undefined}>{pipeline?.failures ?? 0} lần hỏng</span>
      <span>{pipeline?.attempts ?? 0} lần thử</span>
      {row.ratePerHour > 0 && <span>{numeric(row.ratePerHour)} unit/giờ</span>}
    </div>
  </a>;
}
