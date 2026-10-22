import type { ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { Card, Link } from '@heroui/react';
import type { ContractInfo, MiniPipeline, Reason, WorkflowRowV2 } from '../../contract';
import { useApiQuery } from '../../api/query';
import { StatusChip, StatusDot } from '../status-chip';
import { statusLabels, type Status } from '../status';
import { formatAbsolute, formatOpLabel, formatReason } from '../../i18n/vi';
import { TimeAgo } from '../time-ago';
import { legTry, PipelineDots } from './pipeline-dots';
import type { Concept } from '../concept';
import { AgentStack, type LinkedAgent } from '../agent/agent-avatar';
import { attemptAgent, useAttemptAgents } from '../agent/use-running-agents';
import { hasUnavailableSources } from './read-state';
import { Advanced, Lift, Swap } from '../motion';
import { WhyOwnerBadge } from '../why/why-block';
import { t } from '../../i18n/t';
import { SourceWarning } from '../feedback-state';

/** Names the C2 overview concept this module belongs to, for the workflow summary card. */
export const concept: Concept = 'C2';

const numeric = (value: number) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(value);
const count = (value: number | null | undefined) => value == null || !Number.isFinite(value) ? '—' : numeric(value);
/** The hash route of a workflow's page, built from its project and id. */
export const workflowHref = (row: Pick<WorkflowRowV2, 'project' | 'id'>) => `#/w/${encodeURIComponent(row.project)}/${encodeURIComponent(row.id)}`;

const overall = (row: WorkflowRowV2): { status: Status; label?: string } => {
  if (row.phase === 'paused') return { status: 'paused', label: t('Paused') };
  if (row.phase === 'stopped') return { status: 'stopped', label: t('Stopped') };
  if (row.phase === 'finished') return { status: 'success', label: t('Finished') };
  if (row.phase === 'archived') return { status: 'dropped', label: t('Archived') };
  if (row.phase === 'awaiting-approval') return { status: 'awaiting-owner', label: t('Awaiting approval') };
  if (row.phase === 'running') return { status: 'running', label: t('Running') };
  if (row.phase === 'queued') return { status: 'queued', label: t('Queued') };
  return { status: 'unknown', label: row.phase || t('Unknown') };
};

type Pipeline = MiniPipeline | undefined;
type Leg = MiniPipeline['legs'][number];
type OpLabel = (op: string) => string;
const factRowClass = 'grid min-w-0 grid-cols-[88px_minmax(0,1fr)] items-start gap-3 min-[760px]:grid-cols-[96px_minmax(0,1fr)]';
const detailRowClass = 'flex flex-wrap items-center gap-x-2';
const legHref = (base: string, op: string) => `${base}?leg=${encodeURIComponent(op)}`;
const approvalLabel = (pipeline: MiniPipeline) => pipeline.approvalState === 'recorded' ? t('Recorded approval') : t('Approval has not been proven.');

const Fact = ({ label, ddClassName, children }: Readonly<{ label: string; ddClassName?: string; children: ReactNode }>) => {
  return <div className={factRowClass}>
    <dt className="text-muted-foreground">{label}</dt>
    <dd className={ddClassName}>{children}</dd>
  </div>;
};

const DetailRow = ({ label, ddClassName, children }: Readonly<{ label: string; ddClassName?: string; children: ReactNode }>) => {
  return <div className={detailRowClass}><dt className="text-muted-foreground">{label}</dt><dd className={ddClassName}>{children}</dd></div>;
};

const LegLink = ({ base, op, opLabel }: Readonly<{ base: string; op: string; opLabel: OpLabel }>) => {
  return <span title={op}><Link href={legHref(base, op)} className="inline break-words font-medium">{opLabel(op)}</Link></span>;
};

const CurrentLegsList = ({ legs, base, opLabel }: Readonly<{ legs: readonly Leg[]; base: string; opLabel: OpLabel }>) => {
  if (!legs.length) return <span className="text-muted-foreground">{t('No current leg recorded.')}</span>;
  return <ul className="flex list-none flex-col gap-1 p-0">{legs.map(leg => <li key={leg.op} className="break-words">
    <LegLink base={base} op={leg.op} opLabel={opLabel} />
    <span className="text-muted-foreground"> · {statusLabels[leg.status]}{!leg.inPlan ? ` · ${t('Operation-scope history')}` : ''}</span>
  </li>)}</ul>;
};

const excludedSummary = (excluded: readonly Leg[]): string => {
  return (['deferred', 'external', 'dropped'] as const)
    .filter(status => excluded.some(leg => leg.status === status))
    .map(status => `${count(excluded.filter(leg => leg.status === status).length)} ${statusLabels[status]}`)
    .join(' · ');
};

const GoalProgress = ({ pipeline, excluded }: Readonly<{ pipeline: Pipeline; excluded: readonly Leg[] }>) => {
  if (!pipeline) return <span className="text-muted-foreground">{t('The recorded plan has not been observed.')}</span>;
  const progress = pipeline.progress;
  const countedNote = progress?.available ? ` · ${t('{n} counted legs', { n: count(progress.total) })}` : '';
  return <>
    <p>{progress?.available ? <><strong className="tabular-nums">{count(progress.done)}/{count(progress.total)}</strong> {t('legs passed')}</> : t('Plan progress is unavailable.')}</p>
    <p className="text-xs text-muted-foreground">{t('Goal revision {n}', { n: pipeline.goalRevision ?? '—' })}{countedNote}</p>
    {excluded.length > 0 && <p className="text-xs text-muted-foreground">{t('Excluded:')} {excludedSummary(excluded)}</p>}
  </>;
};

const approvalFact = (pipeline: Pipeline) => {
  if (!pipeline) return <span aria-label={t('Not observed.')}>—</span>;
  return <>{approvalLabel(pipeline)}</>;
};

type Groups = { planLegs: Leg[]; historyLegs: Leg[]; unboundLegs: Leg[]; currentLegs: Leg[]; waiting: string[]; excluded: Leg[] };

const groupLegs = (legs: readonly Leg[]): Groups => {
  const planLegs = legs.filter(leg => leg.inPlan);
  return {
    planLegs,
    historyLegs: legs.filter(leg => !leg.inPlan),
    unboundLegs: planLegs.filter(leg => leg.binding === 'unbound'),
    currentLegs: legs.filter(leg => leg.current),
    waiting: planLegs.filter(leg => !leg.current && (leg.status === 'queued' || leg.status === 'retry')).map(leg => leg.op),
    excluded: planLegs.filter(leg => ['deferred', 'external', 'dropped'].includes(leg.status)),
  };
};

const nextAction = (row: WorkflowRowV2, base: string, leadOp: string | undefined, opLabel: OpLabel): { label: string; href: string } => {
  if (row.onIt?.who === 'owner') return { label: t('Inspect decision'), href: row.onIt.ref?.href ?? base };
  if (!leadOp) return { label: t('Open workflow'), href: base };
  const troubled = row.ui === 'bad' || row.ui === 'warn';
  const label = troubled ? t('View leg {op}', { op: opLabel(leadOp) }) : t('Open leg {op}', { op: opLabel(leadOp) });
  return { label, href: legHref(base, leadOp) };
};

const WhyFact = ({ legWhy, base, why, opLabel }: Readonly<{ legWhy: MiniPipeline['why']; base: string; why: Reason | null | undefined; opLabel: OpLabel }>) => {
  if (!legWhy) return <>{formatReason(why)}</>;
  return <><LegLink base={base} op={legWhy.op} opLabel={opLabel} /><span className="text-muted-foreground"> · </span>{legWhy.headline}</>;
};

const Facts = ({ row, pipeline, groups, base, opLabel }: Readonly<{ row: WorkflowRowV2; pipeline: Pipeline; groups: Groups; base: string; opLabel: OpLabel }>) => {
  const why = row.onIt?.reason ?? row.reason;
  const legWhy = pipeline?.why ?? null;
  const role = legWhy?.owner ?? row.onIt?.who ?? null;
  const waitingFor = role === 'owner' || role?.startsWith('other-op:');
  return <dl className="workflow-card-facts grid min-w-0 gap-3 text-sm">
    <Fact label={t('Current legs')} ddClassName="min-w-0"><CurrentLegsList legs={groups.currentLegs} base={base} opLabel={opLabel} /></Fact>
    <Fact label={t('Why:')} ddClassName="min-w-0 whitespace-pre-wrap break-words leading-relaxed"><WhyFact legWhy={legWhy} base={base} why={why} opLabel={opLabel} /></Fact>
    <Fact label={waitingFor ? t('Waiting for') : t('Handling role')}><WhyOwnerBadge owner={role} /></Fact>
    <Fact label={t('Goal progress')} ddClassName="min-w-0"><GoalProgress pipeline={pipeline} excluded={groups.excluded} /></Fact>
    <Fact label={t('Approval:')} ddClassName="min-w-0">{approvalFact(pipeline)}</Fact>
  </dl>;
};

const Warnings = ({ row, contractError, agents }: Readonly<{ row: WorkflowRowV2; contractError: string | null | undefined; agents: ReturnType<typeof useAttemptAgents> }>) => {
  return <>
    {contractError && <SourceWarning>{t('Operation labels are unavailable: {error}', { error: contractError })}</SourceWarning>}
    {row.progressReadError && <SourceWarning>{t('Progress observations are unavailable: {error}', { error: row.progressReadError })}</SourceWarning>}
    {agents.error && <SourceWarning>{t('The source is failing; showing the last read. {error}', { error: agents.error })}</SourceWarning>}
    {hasUnavailableSources(agents.meta) && <SourceWarning>{t('Some sources are unavailable; showing the recorded part.')}</SourceWarning>}
  </>;
};

const GoalPlanText = ({ pipeline }: Readonly<{ pipeline: Pipeline }>) => {
  if (!pipeline) return <>—</>;
  return <>{`${t('Goal revision {n}', { n: pipeline.goalRevision ?? '—' })} · ${pipeline.chainStatus} · ${approvalLabel(pipeline)}`}</>;
};

const HistoryFacts = ({ row, pipeline, groups, base, agents, runningAgents, settlingAgents }: Readonly<{
  row: WorkflowRowV2; pipeline: Pipeline; groups: Groups; base: string;
  agents: ReturnType<typeof useAttemptAgents>; runningAgents: LinkedAgent[]; settlingAgents: LinkedAgent[];
}>) => {
  const { planLegs, historyLegs, unboundLegs, currentLegs, waiting } = groups;
  return <dl className="flex flex-col gap-2 text-sm">
    <DetailRow label={t('Workflow id')} ddClassName="font-mono text-[13px]">{row.id}</DetailRow>
    <DetailRow label={t('Goal plan')}><GoalPlanText pipeline={pipeline} /></DetailRow>
    <DetailRow label={t('Recorded plan')}>{t('{n} recorded plan legs', { n: count(planLegs.length) })}</DetailRow>
    <DetailRow label={t('Workflow units')}>{t('{done}/{total} workflow units · all goal revisions', { done: count(row.units.done), total: count(row.units.total) })}</DetailRow>
    {pipeline?.approvedBy && <DetailRow label={t('Approved by')}>{pipeline.approvedBy}{pipeline.approvalRef ? ` · ${pipeline.approvalRef}` : ''}</DetailRow>}
    <DetailRow label={t('Kernel seat')}>{row.seat ? <>{row.seat.state}<span className="ml-2 text-xs text-muted-foreground">{t('Last seen:')} <TimeAgo at={row.seat.lastSeenAt} /></span></> : t('No seat recorded')}</DetailRow>
    {currentLegs.map(leg => <DetailRow key={leg.op} label={t('Currently at')} ddClassName="font-mono text-[13px]">{leg.op}<span className="text-muted-foreground"> · {legTry(leg)}{leg.units > 1 ? t(' · {n} parallel units', { n: leg.units }) : ''}</span></DetailRow>)}
    {waiting.length > 0 && <DetailRow label={t('Waiting')} ddClassName="font-mono text-[13px]">{waiting.join(', ')}</DetailRow>}
    {unboundLegs.length > 0 && <DetailRow label={t('Unbound planner instances')} ddClassName="break-words font-mono text-[13px]">{unboundLegs.map(leg => leg.op).join(', ')}</DetailRow>}
    {historyLegs.map(leg => <DetailRow key={`history-${leg.op}`} label={leg.runtimeAggregate ? t('Operation-scope history') : t('Recorded operation outside this plan')} ddClassName="break-words font-mono text-[13px]"><Link href={legHref(base, leg.op)} className="inline break-words">{leg.op}</Link><span className="text-muted-foreground"> · {t('{n} workflow-history attempts', { n: count(leg.attempts) })}</span></DetailRow>)}
    <DetailRow label={t('Loaded executing attempts')}>{agents.activeObserved ? count(runningAgents.length) : '—'}{runningAgents.length ? <span className="ml-2 inline-flex"><AgentStack agents={runningAgents} max={4} size={22} /></span> : null}</DetailRow>
    {settlingAgents.length > 0 && <DetailRow label={t('Loaded reported attempts awaiting settlement')}>{count(settlingAgents.length)}<span className="ml-2 inline-flex"><AgentStack agents={settlingAgents} max={4} size={22} /></span></DetailRow>}
  </dl>;
};

const HistoryFooter = ({ row, pipeline }: Readonly<{ row: WorkflowRowV2; pipeline: Pipeline }>) => {
  const failing = pipeline?.failures != null && pipeline.failures > 0;
  return <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-3 text-xs text-muted-foreground">
    <span>{t('Last event:')} <TimeAgo at={pipeline?.lastEventAt} /></span>
    <span data-tone={failing ? 'failed' : undefined} style={failing ? { color: 'var(--tone)' } : undefined}>{t('{n} settled failures in workflow history', { n: count(pipeline?.failures) })}</span>
    <span>{t('{n} workflow-history attempts', { n: count(pipeline?.attempts) })}</span>
    <span>{t('{n} units/hour', { n: count(row.ratePerHour) })}</span>
    {row.etaAt ? <span>ETA: {formatAbsolute(row.etaAt)}</span> : null}
  </div>;
};

type WorkflowScoped = { project: string; wf: string | null };

const matchesWorkflow = (row: WorkflowRowV2) => (item: WorkflowScoped) => item.project === row.project && item.wf === row.id;

/** Recorded lifecycle, current legs, scoped explanation and acting role stay independent of goal progress and approval. */
export const WorkflowCard = ({ row }: Readonly<{ row: WorkflowRowV2 }>) => {
  const pipeline: Pipeline = row.pipeline;
  const contract = useApiQuery<ContractInfo>('/api/contract', { topics: ['system'], intervalMs: 60_000 });
  const opLabel: OpLabel = op => formatOpLabel(op, contract.data?.opLabels);
  const agents = useAttemptAgents();
  const { running: activeAttempts, settling: reportedAttempts } = agents;
  const ofThisWorkflow = matchesWorkflow(row);
  const runningAgents = activeAttempts.filter(ofThisWorkflow).map(item => attemptAgent(item, true));
  const settlingAgents = reportedAttempts.filter(ofThisWorkflow).map(item => attemptAgent(item));
  const state = overall(row);
  const groups = groupLegs(pipeline?.legs ?? []);
  const troubled = row.ui === 'bad' || row.ui === 'warn';
  const base = workflowHref(row);
  const leadOp = pipeline?.why?.op ?? groups.currentLegs[0]?.op;
  const next = nextAction(row, base, leadOp, opLabel);
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
    <Facts row={row} pipeline={pipeline} groups={groups} base={base} opLabel={opLabel} />
    {pipeline && <PipelineDots pipeline={pipeline} opLabels={contract.data?.opLabels} />}
    <Warnings row={row} contractError={contract.error} agents={agents} />
    </Card.Content>
    <Card.Footer className="mt-auto flex min-w-0 flex-col items-stretch gap-4">
    <Advanced summary={t('Workflow history: {attempts} attempts · {failures} settled failures', { attempts: count(pipeline?.attempts), failures: count(pipeline?.failures) })}>
      <HistoryFacts row={row} pipeline={pipeline} groups={groups} base={base} agents={agents} runningAgents={runningAgents} settlingAgents={settlingAgents} />
      <p className="mt-3 text-xs text-muted-foreground">{t('Try values are recorded ordinals; budgets do not show spent business retries.')}</p>
      {(groups.historyLegs.length > 0 || groups.unboundLegs.length > 0) && <p className="mt-2 text-xs text-muted-foreground">{t('Workflow history does not prove completion of the current goal plan or an unbound planner instance.')}</p>}
      <p className="mt-2 text-xs text-muted-foreground">{t('Progress snapshot:')} {row.progressSnapshot ? <><TimeAgo at={row.progressSnapshot.at} /> · #{row.progressSnapshot.id}</> : t('Not observed.')}</p>
      {agents.meta?.next && <p className="mt-2 text-xs text-muted-foreground">{t('More active attempts are available in the attempt list.')}</p>}
      <HistoryFooter row={row} pipeline={pipeline} />
    </Advanced>
    <Link href={next.href} className="min-w-0 items-start gap-2 self-end text-sm font-medium"><span className="min-w-0 break-words">{next.label}</span><ArrowRight className="mt-0.5 size-4 shrink-0" aria-hidden="true" /></Link>
    </Card.Footer>
  </Card></Lift>;
};
