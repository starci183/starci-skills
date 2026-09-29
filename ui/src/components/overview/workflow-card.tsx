import { ArrowRight } from 'lucide-react';
import type { WorkflowRowV2 } from '../../contract';
import { StatusChip } from '../status-chip';
import { statusFromUi, type Status } from '../status';
import { formatAbsolute, formatReason } from '../../i18n/vi';
import { TimeAgo } from '../time-ago';
import { PipelineDots } from './pipeline-dots';
import type { Concept } from '../concept';
import { AgentAvatar, AgentStack } from '../agent/agent-avatar';
import { attemptAgent, isRunningAttempt, useAttemptAgents } from '../agent/use-running-agents';
import { Advanced, Lift, Swap } from '../motion';
import { WhyOwnerBadge } from '../why/why-block';

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

/** Essentials: name, status, one "vì sao / đang làm" line, leg dots, x/y and one next action. The rest sits in "Nâng cao". */
export function WorkflowCard({ row }: { row: WorkflowRowV2 }) {
  const pipeline = row.pipeline;
  const { rows: attempts } = useAttemptAgents();
  const mine = attempts.filter(item => item.project === row.project && item.wf === row.id);
  const runningAgents = mine.filter(isRunningAttempt).map(item => attemptAgent(item, true));
  const ranBy = (op: string) => { const list = mine.filter(item => item.op === op); return list.find(isRunningAttempt) ?? list[0]; };
  const state = overall(row);
  const legs = pipeline?.legs ?? [];
  const currentLegs = legs.filter(leg => leg.current);
  const waiting = legs.filter(leg => !leg.current && (leg.status === 'queued' || leg.status === 'retry')).map(leg => leg.op);
  const troubled = row.ui === 'bad' || row.ui === 'warn';
  const why = row.onIt?.reason ?? row.reason;
  const lead = currentLegs[0];
  const legWhy = pipeline?.why ?? null;
  const headline = legWhy
    ? <><strong>Vì sao:</strong> {legWhy.headline} <WhyOwnerBadge owner={legWhy.owner} /></>
    : troubled || row.onIt
    ? <><strong>Vì sao:</strong> {formatReason(why)}</>
    : lead ? <><strong>Đang làm:</strong> <span className="font-mono text-[13px]">{lead.op}</span> {lead.tries > 0 ? `(lần ${lead.tries}/5)` : '(chưa có lần thử)'}</>
      : <><strong>Trạng thái:</strong> {state.label}</>;
  const base = workflowHref(row);
  const next = row.onIt?.who === 'owner' ? { label: 'Trả lời quyết định', href: row.onIt.ref?.href ?? base }
    : lead ? { label: troubled ? `Xem chặng ${lead.op}` : `Mở chặng ${lead.op}`, href: `${base}?leg=${encodeURIComponent(lead.op)}` }
      : { label: 'Mở workflow', href: base };
  return <Lift className="min-w-0"><article className="flex h-full min-w-0 flex-col gap-4 rounded-xl border bg-card p-4 shadow-sm transition-colors hover:border-[var(--primary)] sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs text-muted-foreground">{row.project}</p>
        <h3 className="mt-1 font-semibold"><a href={base} className="inline-flex max-w-full items-center gap-2 hover:text-primary focus-visible:outline focus-visible:outline-2"><span className="truncate">{row.name}</span></a></h3>
      </div>
      <Swap keyValue={`${state.status}-${state.label}`}><StatusChip status={state.status} label={state.label} /></Swap>
    </div>
    <p className="text-sm">{headline}</p>
    {pipeline && <div className="flex flex-col gap-2">
      <PipelineDots pipeline={pipeline} />
      <p className="text-sm"><strong className="tabular-nums">{pipeline.progress.done}/{pipeline.progress.total}</strong> chặng đạt</p>
    </div>}
    <div className="mt-auto flex items-center justify-between gap-3">
      <a href={next.href} className="inline-flex min-w-0 items-center gap-2 text-sm font-medium text-primary hover:underline"><span className="truncate">{next.label}</span><ArrowRight className="size-4 shrink-0" aria-hidden="true" /></a>
    </div>
    <Advanced summary={`${pipeline?.attempts ?? 0} lần thử · ${pipeline?.failures ?? 0} hỏng`}>
      <dl className="flex flex-col gap-2 text-sm">
        <div className="flex flex-wrap items-center gap-x-2"><dt className="text-muted-foreground">Mã workflow</dt><dd className="font-mono text-[13px]">{row.id}</dd></div>
        {currentLegs.map(leg => { const who = ranBy(leg.op); return <div key={leg.op} className="flex flex-wrap items-center gap-x-2">
          <dt className="text-muted-foreground">Đang ở</dt>
          <dd className="font-mono text-[13px]">{leg.op}<span className="text-muted-foreground"> · {leg.tries > 0 ? `lần ${leg.tries}/5` : 'chưa có lần thử'}{leg.units > 1 ? ` · ${leg.units} unit song song` : ''}</span></dd>
          {who ? <dd className="inline-flex items-center gap-2 text-xs text-muted-foreground"><AgentAvatar agent={attemptAgent(who)} size={18} withLabel /></dd> : null}
        </div>; })}
        {waiting.length > 0 && <div className="flex flex-wrap items-center gap-x-2"><dt className="text-muted-foreground">Chờ</dt><dd className="font-mono text-[13px]">{waiting.join(', ')}</dd></div>}
        {runningAgents.length ? <div className="flex flex-wrap items-center gap-x-2"><dt className="text-muted-foreground">Agent đang chạy</dt><dd><AgentStack agents={runningAgents} max={4} size={22} /></dd></div> : null}
      </dl>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-3 text-xs text-muted-foreground">
        <span>Sự kiện cuối: <TimeAgo at={pipeline?.lastEventAt ?? row.updatedAt} /></span>
        <span data-tone={pipeline && pipeline.failures > 0 ? 'failed' : undefined} style={pipeline && pipeline.failures > 0 ? { color: 'var(--tone)' } : undefined}>{pipeline?.failures ?? 0} lần hỏng</span>
        <span>{pipeline?.attempts ?? 0} lần thử</span>
        {row.ratePerHour > 0 && <span>{numeric(row.ratePerHour)} unit/giờ</span>}
        {row.etaAt ? <span>ETA: {formatAbsolute(row.etaAt)}</span> : null}
      </div>
    </Advanced>
  </article></Lift>;
}
