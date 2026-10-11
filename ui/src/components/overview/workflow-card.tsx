import { ArrowRight } from 'lucide-react';
import { Card, Link } from '@heroui/react';
import type { ContractInfo, WorkflowRowV2 } from '../../contract';
import { useApiQuery } from '../../api/query';
import { StatusChip, StatusDot } from '../status-chip';
import { statusLabels, type Status } from '../status';
import { formatAbsolute, formatOpLabel, formatReason } from '../../i18n/vi';
import { TimeAgo } from '../time-ago';
import { legTry, PipelineDots } from './pipeline-dots';
import type { Concept } from '../concept';
import { AgentStack } from '../agent/agent-avatar';
import { attemptAgent, useAttemptAgents } from '../agent/use-running-agents';
import { hasUnavailableSources } from './read-state';
import { Advanced, Lift, Swap } from '../motion';
import { WhyOwnerBadge } from '../why/why-block';
import { t } from '../../i18n/t';
import { SourceWarning } from '../feedback-state';

export const concept: Concept = 'C2';

const numeric = (value: number) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(value);
const count = (value: number | null | undefined) => value == null || !Number.isFinite(value) ? '—' : numeric(value);
export const workflowHref = (row: Pick<WorkflowRowV2, 'project' | 'id'>) => `#/w/${encodeURIComponent(row.project)}/${encodeURIComponent(row.id)}`;

function overall(row: WorkflowRowV2): { status: Status; label?: string } {
  if (row.phase === 'paused') return { status: 'paused', label: t('Paused') };
  if (row.phase === 'stopped') return { status: 'stopped', label: t('Stopped') };
  if (row.phase === 'finished') return { status: 'success', label: t('Finished') };
  if (row.phase === 'archived') return { status: 'dropped', label: t('Archived') };
  if (row.phase === 'awaiting-approval') return { status: 'awaiting-owner', label: t('Awaiting approval') };
  if (row.phase === 'running') return { status: 'running', label: t('Running') };
  if (row.phase === 'queued') return { status: 'queued', label: t('Queued') };
  return { status: 'unknown', label: row.phase || t('Unknown') };
}

/** Recorded lifecycle, current legs, scoped explanation and acting role stay independent of goal progress and approval. */
export function WorkflowCard({ row }: Readonly<{ row: WorkflowRowV2 }>) {
  const pipeline = row.pipeline;
  const contract = useApiQuery<ContractInfo>('/api/contract', { topics: ['system'], intervalMs: 60_000 });
  const opLabel = (op: string) => formatOpLabel(op, contract.data?.opLabels);
  const agents = useAttemptAgents();
  const { running: activeAttempts, settling: reportedAttempts } = agents;
  const runningAgents = activeAttempts.filter(item => item.project === row.project && item.wf === row.id).map(item => attemptAgent(item, true));
  const settlingAgents = reportedAttempts.filter(item => item.project === row.project && item.wf === row.id).map(item => attemptAgent(item));
  const state = overall(row);
  const legs = pipeline?.legs ?? [];
  const planLegs = legs.filter(leg => leg.inPlan);
  const historyLegs = legs.filter(leg => !leg.inPlan);
  const unboundLegs = planLegs.filter(leg => leg.binding === 'unbound');
  const currentLegs = legs.filter(leg => leg.current);
  const waiting = planLegs.filter(leg => !leg.current && (leg.status === 'queued' || leg.status === 'retry')).map(leg => leg.op);
  const troubled = row.ui === 'bad' || row.ui === 'warn';
  const why = row.onIt?.reason ?? row.reason;
  const legWhy = pipeline?.why ?? null;
  const role = legWhy?.owner ?? row.onIt?.who ?? null;
  const leadOp = legWhy?.op ?? currentLegs[0]?.op;
  const base = workflowHref(row);
  const next = row.onIt?.who === 'owner' ? { label: t('Inspect decision'), href: row.onIt.ref?.href ?? base }
    : leadOp ? { label: troubled ? t('View leg {op}', { op: opLabel(leadOp) }) : t('Open leg {op}', { op: opLabel(leadOp) }), href: `${base}?leg=${encodeURIComponent(leadOp)}` }
      : { label: t('Open workflow'), href: base };
  const excluded = planLegs.filter(leg => ['deferred', 'external', 'dropped'].includes(leg.status));
  return <Lift className="h-full min-w-0"><Card className="workflow-card h-full min-w-0 p-4 min-[760px]:p-6">
    <Card.Header className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <Card.Description className="truncate text-xs" title={row.project}>{row.project}</Card.Description>
        <Card.Title><Link href={base} className="max-w-full break-words text-base font-semibold">{row.name}</Link></Card.Title>
      </div>
      <Swap keyValue={`${state.status}-${state.label}`}><StatusChip status={state.status} label={state.label} /></Swap>
    </Card.Header>
    <Card.Content className="flex min-w-0 flex-col gap-4">
    {troubled && <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><StatusDot status={row.ui === 'bad' ? 'failed' : 'warning'} />{row.ui === 'bad' ? t('Stuck') : t('Slow')}</p>}
    <dl className="workflow-card-facts grid min-w-0 gap-3 text-sm">
      <div className="grid min-w-0 grid-cols-[88px_minmax(0,1fr)] items-start gap-3 min-[760px]:grid-cols-[96px_minmax(0,1fr)]">
        <dt className="text-muted-foreground">{t('Current legs')}</dt>
        <dd className="min-w-0">{currentLegs.length ? <ul className="flex list-none flex-col gap-1 p-0">{currentLegs.map(leg => <li key={leg.op} className="break-words">
          <span title={leg.op}><Link href={`${base}?leg=${encodeURIComponent(leg.op)}`} className="inline break-words font-medium">{opLabel(leg.op)}</Link></span>
          <span className="text-muted-foreground"> · {statusLabels[leg.status]}{!leg.inPlan ? ` · ${t('Operation-scope history')}` : ''}</span>
        </li>)}</ul> : <span className="text-muted-foreground">{t('No current leg recorded.')}</span>}</dd>
      </div>
      <div className="grid min-w-0 grid-cols-[88px_minmax(0,1fr)] items-start gap-3 min-[760px]:grid-cols-[96px_minmax(0,1fr)]">
        <dt className="text-muted-foreground">{t('Why:')}</dt>
        <dd className="min-w-0 whitespace-pre-wrap break-words leading-relaxed">{legWhy ? <><span title={legWhy.op}><Link href={`${base}?leg=${encodeURIComponent(legWhy.op)}`} className="inline break-words font-medium">{opLabel(legWhy.op)}</Link></span><span className="text-muted-foreground"> · </span>{legWhy.headline}</> : formatReason(why)}</dd>
      </div>
      <div className="grid min-w-0 grid-cols-[88px_minmax(0,1fr)] items-start gap-3 min-[760px]:grid-cols-[96px_minmax(0,1fr)]">
        <dt className="text-muted-foreground">{role === 'owner' || role?.startsWith('other-op:') ? t('Waiting for') : t('Handling role')}</dt>
        <dd><WhyOwnerBadge owner={role} /></dd>
      </div>
      <div className="grid min-w-0 grid-cols-[88px_minmax(0,1fr)] items-start gap-3 min-[760px]:grid-cols-[96px_minmax(0,1fr)]">
        <dt className="text-muted-foreground">{t('Goal progress')}</dt>
        <dd className="min-w-0">{pipeline ? <>
          <p>{pipeline.progress?.available ? <><strong className="tabular-nums">{count(pipeline.progress.done)}/{count(pipeline.progress.total)}</strong> {t('legs passed')}</> : t('Plan progress is unavailable.')}</p>
          <p className="text-xs text-muted-foreground">{t('Goal revision {n}', { n: pipeline.goalRevision ?? '—' })}{pipeline.progress?.available ? ` · ${t('{n} counted legs', { n: count(pipeline.progress.total) })}` : ''}</p>
          {excluded.length > 0 && <p className="text-xs text-muted-foreground">{t('Excluded:')} {(['deferred', 'external', 'dropped'] as const).filter(status => excluded.some(leg => leg.status === status)).map(status => `${count(excluded.filter(leg => leg.status === status).length)} ${statusLabels[status]}`).join(' · ')}</p>}
        </> : <span className="text-muted-foreground">{t('The recorded plan has not been observed.')}</span>}</dd>
      </div>
      <div className="grid min-w-0 grid-cols-[88px_minmax(0,1fr)] items-start gap-3 min-[760px]:grid-cols-[96px_minmax(0,1fr)]">
        <dt className="text-muted-foreground">{t('Approval:')}</dt>
        <dd className="min-w-0">{pipeline ? pipeline.approvalState === 'recorded' ? t('Recorded approval') : t('Approval has not been proven.') : <span aria-label={t('Not observed.')}>—</span>}</dd>
      </div>
    </dl>
    {pipeline && <PipelineDots pipeline={pipeline} opLabels={contract.data?.opLabels} />}
    {contract.error && <SourceWarning>{t('Operation labels are unavailable: {error}', { error: contract.error })}</SourceWarning>}
    {row.progressReadError && <SourceWarning>{t('Progress observations are unavailable: {error}', { error: row.progressReadError })}</SourceWarning>}
    {agents.error && <SourceWarning>{t('The source is failing; showing the last read. {error}', { error: agents.error })}</SourceWarning>}
    {hasUnavailableSources(agents.meta) && <SourceWarning>{t('Some sources are unavailable; showing the recorded part.')}</SourceWarning>}
    </Card.Content>
    <Card.Footer className="mt-auto flex min-w-0 flex-col items-stretch gap-4">
    <Advanced summary={t('Workflow history: {attempts} attempts · {failures} settled failures', { attempts: count(pipeline?.attempts), failures: count(pipeline?.failures) })}>
      <dl className="flex flex-col gap-2 text-sm">
        <div className="flex flex-wrap items-center gap-x-2"><dt className="text-muted-foreground">{t('Workflow id')}</dt><dd className="font-mono text-[13px]">{row.id}</dd></div>
        <div className="flex flex-wrap items-center gap-x-2"><dt className="text-muted-foreground">{t('Goal plan')}</dt><dd>{pipeline ? `${t('Goal revision {n}', { n: pipeline.goalRevision ?? '—' })} · ${pipeline.chainStatus} · ${pipeline.approvalState === 'recorded' ? t('Recorded approval') : t('Approval has not been proven.')}` : '—'}</dd></div>
        <div className="flex flex-wrap items-center gap-x-2"><dt className="text-muted-foreground">{t('Recorded plan')}</dt><dd>{t('{n} recorded plan legs', { n: count(planLegs.length) })}</dd></div>
        <div className="flex flex-wrap items-center gap-x-2"><dt className="text-muted-foreground">{t('Workflow units')}</dt><dd>{t('{done}/{total} workflow units · all goal revisions', { done: count(row.units.done), total: count(row.units.total) })}</dd></div>
        {pipeline?.approvedBy && <div className="flex flex-wrap items-center gap-x-2"><dt className="text-muted-foreground">{t('Approved by')}</dt><dd>{pipeline.approvedBy}{pipeline.approvalRef ? ` · ${pipeline.approvalRef}` : ''}</dd></div>}
        <div className="flex flex-wrap items-center gap-x-2"><dt className="text-muted-foreground">{t('Kernel seat')}</dt><dd>{row.seat ? <>{row.seat.state}<span className="ml-2 text-xs text-muted-foreground">{t('Last seen:')} <TimeAgo at={row.seat.lastSeenAt} /></span></> : t('No seat recorded')}</dd></div>
        {currentLegs.map(leg => <div key={leg.op} className="flex flex-wrap items-center gap-x-2">
          <dt className="text-muted-foreground">{t('Currently at')}</dt>
          <dd className="font-mono text-[13px]">{leg.op}<span className="text-muted-foreground"> · {legTry(leg)}{leg.units > 1 ? t(' · {n} parallel units', { n: leg.units }) : ''}</span></dd>
        </div>)}
        {waiting.length > 0 && <div className="flex flex-wrap items-center gap-x-2"><dt className="text-muted-foreground">{t('Waiting')}</dt><dd className="font-mono text-[13px]">{waiting.join(', ')}</dd></div>}
        {unboundLegs.length > 0 && <div className="flex flex-wrap items-center gap-x-2"><dt className="text-muted-foreground">{t('Unbound planner instances')}</dt><dd className="break-words font-mono text-[13px]">{unboundLegs.map(leg => leg.op).join(', ')}</dd></div>}
        {historyLegs.map(leg => <div key={`history-${leg.op}`} className="flex flex-wrap items-center gap-x-2"><dt className="text-muted-foreground">{leg.runtimeAggregate ? t('Operation-scope history') : t('Recorded operation outside this plan')}</dt><dd className="break-words font-mono text-[13px]"><Link href={`${base}?leg=${encodeURIComponent(leg.op)}`} className="inline break-words">{leg.op}</Link><span className="text-muted-foreground"> · {t('{n} workflow-history attempts', { n: count(leg.attempts) })}</span></dd></div>)}
        <div className="flex flex-wrap items-center gap-x-2"><dt className="text-muted-foreground">{t('Loaded executing attempts')}</dt><dd>{agents.activeObserved ? count(runningAgents.length) : '—'}{runningAgents.length ? <span className="ml-2 inline-flex"><AgentStack agents={runningAgents} max={4} size={22} /></span> : null}</dd></div>
        {settlingAgents.length > 0 && <div className="flex flex-wrap items-center gap-x-2"><dt className="text-muted-foreground">{t('Loaded reported attempts awaiting settlement')}</dt><dd>{count(settlingAgents.length)}<span className="ml-2 inline-flex"><AgentStack agents={settlingAgents} max={4} size={22} /></span></dd></div>}
      </dl>
      <p className="mt-3 text-xs text-muted-foreground">{t('Try values are recorded ordinals; budgets do not show spent business retries.')}</p>
      {(historyLegs.length > 0 || unboundLegs.length > 0) && <p className="mt-2 text-xs text-muted-foreground">{t('Workflow history does not prove completion of the current goal plan or an unbound planner instance.')}</p>}
      <p className="mt-2 text-xs text-muted-foreground">{t('Progress snapshot:')} {row.progressSnapshot ? <><TimeAgo at={row.progressSnapshot.at} /> · #{row.progressSnapshot.id}</> : t('Not observed.')}</p>
      {agents.meta?.next && <p className="mt-2 text-xs text-muted-foreground">{t('More active attempts are available in the attempt list.')}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-3 text-xs text-muted-foreground">
        <span>{t('Last event:')} <TimeAgo at={pipeline?.lastEventAt} /></span>
        <span data-tone={pipeline?.failures != null && pipeline.failures > 0 ? 'failed' : undefined} style={pipeline?.failures != null && pipeline.failures > 0 ? { color: 'var(--tone)' } : undefined}>{t('{n} settled failures in workflow history', { n: count(pipeline?.failures) })}</span>
        <span>{t('{n} workflow-history attempts', { n: count(pipeline?.attempts) })}</span>
        <span>{t('{n} units/hour', { n: count(row.ratePerHour) })}</span>
        {row.etaAt ? <span>ETA: {formatAbsolute(row.etaAt)}</span> : null}
      </div>
    </Advanced>
    <Link href={next.href} className="min-w-0 items-start gap-2 self-end text-sm font-medium"><span className="min-w-0 break-words">{next.label}</span><ArrowRight className="mt-0.5 size-4 shrink-0" aria-hidden="true" /></Link>
    </Card.Footer>
  </Card></Lift>;
}
