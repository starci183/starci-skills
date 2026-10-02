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
import { t } from '../../i18n/t';

export const concept: Concept = 'C2';

const numeric = (value: number) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(value);
export const workflowHref = (row: Pick<WorkflowRowV2, 'project' | 'id'>) => `#/w/${encodeURIComponent(row.project)}/${encodeURIComponent(row.id)}`;

function overall(row: WorkflowRowV2): { status: Status; label?: string } {
  if (row.phase === 'paused') return { status: 'queued', label: t('Paused') };
  if (row.phase === 'stopped') return { status: 'dropped', label: t('Stopped') };
  if (row.phase === 'finished' || row.phase === 'archived') return { status: 'success', label: t('Finished') };
  if (row.ui === 'bad') return { status: 'failed', label: t('Stuck') };
  if (row.ui === 'warn') return { status: 'retry', label: t('Slow') };
  if (row.phase === 'running') return { status: 'running', label: t('Running') };
  return { status: statusFromUi(row.ui), label: row.phase };
}

/** Essentials: name, status, one "why / working on" line, leg dots, x/y and one next action. The rest sits in "Advanced". */
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
    ? <><strong>{t('Why:')}</strong> {legWhy.headline} <WhyOwnerBadge owner={legWhy.owner} /></>
    : troubled || row.onIt
    ? <><strong>{t('Why:')}</strong> {formatReason(why)}</>
    : lead ? <><strong>{t('Working on:')}</strong> <span className="text-muted-foreground" title={lead.op}>{lead.op}</span> {lead.tries > 0 ? t('(try {n}/5)', { n: lead.tries }) : t('(no attempts yet)')}</>
      : <><strong>{t('State:')}</strong> {state.label}</>;
  const base = workflowHref(row);
  const next = row.onIt?.who === 'owner' ? { label: t('Answer the decision'), href: row.onIt.ref?.href ?? base }
    : lead ? { label: troubled ? t('View leg {op}', { op: lead.op }) : t('Open leg {op}', { op: lead.op }), href: `${base}?leg=${encodeURIComponent(lead.op)}` }
      : { label: t('Open workflow'), href: base };
  return <Lift className="min-w-0"><article className="flex h-full min-w-0 flex-col gap-4 rounded-xl border bg-card p-4 transition-colors hover:border-[var(--border)] sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs text-muted-foreground">{row.project}</p>
        <h3 className="mt-1 font-semibold"><a href={base} className="inline-flex max-w-full items-center gap-2 hover:text-primary focus-visible:outline focus-visible:outline-2"><span className="truncate">{row.name}</span></a></h3>
      </div>
      <Swap keyValue={`${state.status}-${state.label}`}><StatusChip status={state.status} label={state.label} /></Swap>
    </div>
    <p className="line-clamp-4 text-sm" title={legWhy?.headline ?? (troubled || row.onIt ? formatReason(why) : undefined)}>{headline}</p>
    {pipeline && <div className="flex flex-col gap-2">
      <PipelineDots pipeline={pipeline} />
      <p className="text-sm"><strong className="tabular-nums">{pipeline.progress.done}/{pipeline.progress.total}</strong> {t('legs passed')}</p>
    </div>}
    <div className="mt-auto flex items-center justify-between gap-3">
      <a href={next.href} className="inline-flex min-w-0 items-center gap-2 text-sm font-medium text-primary hover:underline"><span className="truncate">{next.label}</span><ArrowRight className="size-4 shrink-0" aria-hidden="true" /></a>
    </div>
    <Advanced summary={t('{attempts} attempts · {failures} failed', { attempts: pipeline?.attempts ?? 0, failures: pipeline?.failures ?? 0 })}>
      <dl className="flex flex-col gap-2 text-sm">
        <div className="flex flex-wrap items-center gap-x-2"><dt className="text-muted-foreground">{t('Workflow id')}</dt><dd className="font-mono text-[13px]">{row.id}</dd></div>
        {currentLegs.map(leg => { const who = ranBy(leg.op); return <div key={leg.op} className="flex flex-wrap items-center gap-x-2">
          <dt className="text-muted-foreground">{t('Currently at')}</dt>
          <dd className="font-mono text-[13px]">{leg.op}<span className="text-muted-foreground"> · {leg.tries > 0 ? t('try {n}/5', { n: leg.tries }) : t('no attempts yet')}{leg.units > 1 ? t(' · {n} parallel units', { n: leg.units }) : ''}</span></dd>
          {who ? <dd className="inline-flex items-center gap-2 text-xs text-muted-foreground"><AgentAvatar agent={attemptAgent(who)} size={18} withLabel /></dd> : null}
        </div>; })}
        {waiting.length > 0 && <div className="flex flex-wrap items-center gap-x-2"><dt className="text-muted-foreground">{t('Waiting')}</dt><dd className="font-mono text-[13px]">{waiting.join(', ')}</dd></div>}
        {runningAgents.length ? <div className="flex flex-wrap items-center gap-x-2"><dt className="text-muted-foreground">{t('Agents running')}</dt><dd><AgentStack agents={runningAgents} max={4} size={22} /></dd></div> : null}
      </dl>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-3 text-xs text-muted-foreground">
        <span>{t('Last event:')} <TimeAgo at={pipeline?.lastEventAt ?? row.updatedAt} /></span>
        <span data-tone={pipeline && pipeline.failures > 0 ? 'failed' : undefined} style={pipeline && pipeline.failures > 0 ? { color: 'var(--tone)' } : undefined}>{t('{n} failures', { n: pipeline?.failures ?? 0 })}</span>
        <span>{t('{n} attempts', { n: pipeline?.attempts ?? 0 })}</span>
        {row.ratePerHour > 0 && <span>{t('{n} units/hour', { n: numeric(row.ratePerHour) })}</span>}
        {row.etaAt ? <span>ETA: {formatAbsolute(row.etaAt)}</span> : null}
      </div>
    </Advanced>
  </article></Lift>;
}
