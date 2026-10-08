import { ArrowRight } from 'lucide-react';
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
import { Card, CardContent } from '../ui/card';

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
  return <Lift className="h-full min-w-0"><Card className="h-full"><CardContent className="flex h-full min-w-0 flex-col gap-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs text-muted-foreground">{row.project}</p>
        <h3 className="mt-1 font-semibold"><a href={base} className="inline-flex max-w-full items-center gap-2 hover:text-primary focus-visible:outline focus-visible:outline-2"><span className="truncate">{row.name}</span></a></h3>
      </div>
      <Swap keyValue={`${state.status}-${state.label}`}><StatusChip status={state.status} label={state.label} /></Swap>
    </div>
    {troubled && <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><StatusDot status={row.ui === 'bad' ? 'failed' : 'warning'} />{row.ui === 'bad' ? t('Stuck') : t('Slow')}</p>}
    <dl className="flex min-w-0 flex-col gap-3 text-sm">
      <div className="flex min-w-0 flex-col gap-1">
        <dt className="font-medium">{t('Current legs')}</dt>
        <dd>{currentLegs.length ? <ul className="flex list-none flex-col gap-1 p-0">{currentLegs.map(leg => <li key={leg.op} className="break-words">
          <a href={`${base}?leg=${encodeURIComponent(leg.op)}`} title={leg.op} className="font-medium hover:text-primary hover:underline">{opLabel(leg.op)}</a>
          <span className="text-muted-foreground"> · {statusLabels[leg.status]}{!leg.inPlan ? ` · ${t('Operation-scope history')}` : ''}</span>
        </li>)}</ul> : <span className="text-muted-foreground">{t('No current leg recorded.')}</span>}</dd>
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <dt className="font-medium">{t('Why:')}</dt>
        <dd className="break-words">{legWhy ? <><a href={`${base}?leg=${encodeURIComponent(legWhy.op)}`} title={legWhy.op} className="font-medium hover:text-primary hover:underline">{opLabel(legWhy.op)}</a><span className="text-muted-foreground"> · </span>{legWhy.headline}</> : formatReason(why)}</dd>
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <dt className="font-medium">{role === 'owner' || role?.startsWith('other-op:') ? t('Waiting for') : t('Handling role')}</dt>
        <dd><WhyOwnerBadge owner={role} /></dd>
      </div>
    </dl>
    {pipeline && <div className="flex flex-col gap-2">
      <PipelineDots pipeline={pipeline} opLabels={contract.data?.opLabels} />
      <p className="text-sm">{pipeline.progress?.available ? <><strong className="tabular-nums">{count(pipeline.progress.done)}/{count(pipeline.progress.total)}</strong> {t('legs passed')}</> : t('Plan progress is unavailable.')}<span className="ml-2 text-xs text-muted-foreground">{t('Goal revision {n}', { n: pipeline.goalRevision ?? '—' })}</span></p>
      <p className="text-xs text-muted-foreground">{t('Approval:')} {pipeline.approvalState === 'recorded' ? t('Recorded approval') : t('Approval has not been proven.')}</p>
      {pipeline.progress?.available && <p className="text-xs text-muted-foreground">{t('{n} counted legs', { n: count(pipeline.progress.total) })}{excluded.length ? <> · {t('Excluded:')} {(['deferred', 'external', 'dropped'] as const).filter(status => excluded.some(leg => leg.status === status)).map(status => `${count(excluded.filter(leg => leg.status === status).length)} ${statusLabels[status]}`).join(' · ')}</> : null}</p>}
    </div>}
    {!pipeline && <p className="text-xs text-muted-foreground">{t('The recorded plan has not been observed.')}</p>}
    <div className="mt-auto flex items-center justify-between gap-3">
      <a href={next.href} className="inline-flex min-w-0 items-center gap-2 text-sm font-medium text-primary hover:underline"><span className="truncate">{next.label}</span><ArrowRight className="size-4 shrink-0" aria-hidden="true" /></a>
    </div>
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
        {historyLegs.map(leg => <div key={`history-${leg.op}`} className="flex flex-wrap items-center gap-x-2"><dt className="text-muted-foreground">{leg.runtimeAggregate ? t('Operation-scope history') : t('Recorded operation outside this plan')}</dt><dd className="break-words font-mono text-[13px]"><a href={`${base}?leg=${encodeURIComponent(leg.op)}`} className="hover:text-primary hover:underline">{leg.op}</a><span className="text-muted-foreground"> · {t('{n} workflow-history attempts', { n: count(leg.attempts) })}</span></dd></div>)}
        <div className="flex flex-wrap items-center gap-x-2"><dt className="text-muted-foreground">{t('Loaded executing attempts')}</dt><dd>{agents.activeObserved ? count(runningAgents.length) : '—'}{runningAgents.length ? <span className="ml-2 inline-flex"><AgentStack agents={runningAgents} max={4} size={22} /></span> : null}</dd></div>
        {settlingAgents.length > 0 && <div className="flex flex-wrap items-center gap-x-2"><dt className="text-muted-foreground">{t('Loaded reported attempts awaiting settlement')}</dt><dd>{count(settlingAgents.length)}<span className="ml-2 inline-flex"><AgentStack agents={settlingAgents} max={4} size={22} /></span></dd></div>}
      </dl>
      <p className="mt-3 text-xs text-muted-foreground">{t('Try values are recorded ordinals; budgets do not show spent business retries.')}</p>
      {(historyLegs.length > 0 || unboundLegs.length > 0) && <p className="mt-2 text-xs text-muted-foreground">{t('Workflow history does not prove completion of the current goal plan or an unbound planner instance.')}</p>}
      {contract.error && <output className="shell-error mt-3 block">{t('Operation labels are unavailable: {error}', { error: contract.error })}</output>}
      {row.progressReadError && <output className="shell-error mt-3 block">{t('Progress observations are unavailable: {error}', { error: row.progressReadError })}</output>}
      <p className="mt-2 text-xs text-muted-foreground">{t('Progress snapshot:')} {row.progressSnapshot ? <><TimeAgo at={row.progressSnapshot.at} /> · #{row.progressSnapshot.id}</> : t('Not observed.')}</p>
      {agents.error && <output className="shell-error mt-3 block">{t('The source is failing; showing the last read. {error}', { error: agents.error })}</output>}
      {hasUnavailableSources(agents.meta) && <output className="shell-error mt-3 block">{t('Some sources are unavailable; showing the recorded part.')}</output>}
      {agents.meta?.next && <p className="mt-2 text-xs text-muted-foreground">{t('More active attempts are available in the attempt list.')}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-3 text-xs text-muted-foreground">
        <span>{t('Last event:')} <TimeAgo at={pipeline?.lastEventAt} /></span>
        <span data-tone={pipeline?.failures != null && pipeline.failures > 0 ? 'failed' : undefined} style={pipeline?.failures != null && pipeline.failures > 0 ? { color: 'var(--tone)' } : undefined}>{t('{n} settled failures in workflow history', { n: count(pipeline?.failures) })}</span>
        <span>{t('{n} workflow-history attempts', { n: count(pipeline?.attempts) })}</span>
        <span>{t('{n} units/hour', { n: count(row.ratePerHour) })}</span>
        {row.etaAt ? <span>ETA: {formatAbsolute(row.etaAt)}</span> : null}
      </div>
    </Advanced>
  </CardContent></Card></Lift>;
}
