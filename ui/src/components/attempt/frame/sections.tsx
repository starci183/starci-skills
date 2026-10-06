import { CircleAlert } from 'lucide-react';
import { useApiQuery } from '../../../api/query';
import type { ActionRow, AttemptDetailV2, RecordedDecision, LogRow } from '../../../contract';
import { formatAbsolute } from '../../../i18n/vi';
import { statusFromUi } from '../../status';
import { StatusChip } from '../../status-chip';
import { TranscriptViewer } from '../transcript';
import { DiffView, type JobDiff } from '../evidence';
import { PathLink } from '../../path-link';
import { CopyId, ShaId } from '../../infra/rows';
import { BareCards, Card, Empty } from './card';
import { formatBytes, formatClock, formatSpan, jsonText } from './util';
import type { Concept } from '../../concept';
import { t } from '../../../i18n/t';
import { workflowLandStatus } from '../land-state';
import { ReadWarning } from './read-warning';

export const concept: Concept = 'C7';

const timelineLabels: Record<string, string> = {
  routed: t('Routed'), dispatched: t('Dispatched'), started: t('Started'), attested: t('Agent attested'), reported: t('Reported'), consumed: t('Report consumed'),
  checked: t('Checked'), settled: t('Settled'), released: t('Slot released'), 'terminal-closed': t('Terminal closed'), 'worktree-removed': t('Worktree removed'),
};

export function TranscriptSection({ project, attemptId, attempt }: Readonly<{ project: string; attemptId: string; attempt: AttemptDetailV2 }>) {
  const logsUrl = `/api/logs?project=${encodeURIComponent(project)}&job=${encodeURIComponent(attempt.job)}&limit=100`;
  const logs = useApiQuery<LogRow[]>(logsUrl, { topics: [`attempt:${project}:${attemptId}`], intervalMs: 30_000 });
  const terminal = attempt.terminal;
  return <Card id="attempt-step-run" concept="C7" title={t('Run · transcript')} hint={t('redacted scrollback, not a terminal screenshot')}
    right={terminal ? <span className="font-mono text-[11px] text-muted-foreground">{terminal.handle} · {terminal.snapshots} snapshot{terminal.live ? ` · ${t('open')}` : ''}</span> : null}>
    <TranscriptViewer project={project} attemptId={attemptId} live={attempt.verdict == null && attempt.endState == null} />
    <details className="mt-4"><summary className="cursor-pointer text-sm font-medium">{t('Job system log · {n}', { n: logs.data?.length ?? '—' })}</summary>
      <p className="text-xs text-muted-foreground">{t('Job logs may include several dispatches; they are not exclusive Attempt evidence.')}</p>
      <ReadWarning read={logs} url={logsUrl} retained={Boolean(logs.data)} />
      {!logs.data && !logs.error ? <Empty>{t('Reading job logs…')}</Empty> : null}
      <div className="mt-2 divide-y">{logs.data?.map(item => <div key={item.key} className="py-2 text-xs"><span className="text-muted-foreground">{formatAbsolute(item.at)} · {item.level} · {item.actor}</span><p className="break-words">{item.msg}</p></div>)}</div>
      {logs.meta?.next ? <p className="text-xs text-muted-foreground">{t('This is one page of job logs; more rows are available.')}</p> : null}
      {logs.data && !logs.data.length ? <Empty>{t('No log lines for this job.')}</Empty> : null}
    </details>
  </Card>;
}

export function DiffSection({ project, attemptId, attempt }: Readonly<{ project: string; attemptId: string; attempt: AttemptDetailV2 }>) {
  const diffUrl = `/api/attempts/${encodeURIComponent(project)}/${encodeURIComponent(attemptId)}/diff`;
  const diff = useApiQuery<JobDiff | null>(diffUrl, { intervalMs: 60_000 });
  const where = attempt.where;
  const fileCount = diff.data?.files?.length ?? 0;
  const baseSha = diff.data?.baseSha ?? null, headSha = diff.data?.headSha ?? null;
  const mismatch = Boolean(baseSha && where.baseSha && baseSha !== where.baseSha) || Boolean(headSha && where.headSha && headSha !== where.headSha);
  return <Card id="attempt-step-diff" concept="C11" title="Diff" hint={fileCount ? t('{n} files changed', { n: fileCount }) : t('changes the op wrote to the repo')}
    right={baseSha || headSha ? <span className="font-mono text-[11px] text-muted-foreground">{baseSha?.slice(0, 8) ?? '—'} → {headSha?.slice(0, 8) ?? '—'}</span> : null}>
    <ReadWarning read={diff} url={diffUrl} retained={Boolean(diff.data)} />
    {diff.data ? <p className="text-xs text-muted-foreground">{baseSha || headSha ? t('Diff base and head are recorded in the patch artifact.') : t('The patch artifact has no recorded base or head.')}{mismatch ? ` ${t('Patch provenance differs from the Attempt checkout SHA.')}` : ''}</p> : null}
    {diff.data?.files?.length ? <DiffView diff={diff.data} /> : !diff.meta && !diff.error ? <Empty>{t('Reading diff…')}</Empty> : !diff.error ? <Empty>{t('No diff recorded yet. A diff exists only when the runtime kept the op\'s changes{extra}.', { extra: where.mainCheckout ? t('; this op ran on the main checkout so there is no separate worktree to compare') : '' })}</Empty> : null}
  </Card>;
}

export function LandSection({ attempt }: Readonly<{ attempt: AttemptDetailV2 }>) {
  const land = attempt.land;
  return <Card id="attempt-step-land" concept="C11" title={t('Workflow integration (Land)')} hint={t('the workflow integration record, separate from this attempt verdict')}
    right={<StatusChip status={workflowLandStatus(land)} label={land?.result ?? t('No workflow land record')} />}>
    <dl className="m-0 grid gap-4 text-sm sm:grid-cols-2">
      <div className="flex flex-col gap-1"><dt className="text-xs text-muted-foreground">{t('Workflow')}</dt><dd className="m-0 break-all"><a href={`#/w/${encodeURIComponent(attempt.project)}/${encodeURIComponent(attempt.wf)}`} className="text-primary hover:underline">{attempt.wf}</a></dd></div>
      <div className="flex flex-col gap-1"><dt className="text-xs text-muted-foreground">{t('Workflow repo / branch')}</dt><dd className="m-0"><PathLink path={land?.repo ?? null} kind="dir" /><span className="mt-1 block break-all font-mono text-xs">{land?.branch ?? t('Not recorded')}</span></dd></div>
      <div className="flex flex-col gap-1"><dt className="text-xs text-muted-foreground">{t('SHA after land')}</dt><dd className="m-0"><ShaId sha={land?.mergedSha} /></dd></div>
      <div className="flex flex-col gap-1"><dt className="text-xs text-muted-foreground">{t('At')}</dt><dd className="m-0">{formatAbsolute(land?.at)}</dd></div>
      <div className="flex flex-col gap-1"><dt className="text-xs text-muted-foreground">{t('Receipt association')}</dt><dd className="m-0">{land?.attemptAssociation === 'head-match' ? t('Recorded attempt head matches the land head.') : t('Attempt inclusion is unproven.')}</dd></div>
      <div className="flex flex-col gap-1"><dt className="text-xs text-muted-foreground">{t('Push')}</dt><dd className="m-0">{land?.pushed === true ? t('Recorded as pushed') : land?.pushed === false ? t('Recorded as not pushed') : t('Not recorded')}</dd></div>
      <div className="flex flex-col gap-1"><dt className="text-xs text-muted-foreground">{t('Land receipt source')}</dt><dd className="m-0">{land?.source ?? t('Not recorded')}</dd></div>
    </dl>
    {land?.reason ? <p className="mb-0 mt-3 break-words text-sm text-muted-foreground">{land.reason}</p> : null}
    {land?.output ? <a href={land.output.href} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm text-primary hover:underline">{t('Open land output ({size})', { size: formatBytes(land.output.bytes) })}</a> : null}
    <p className="mt-3 text-xs text-muted-foreground">{t('Attempt pass, workflow land, push and deployment are separate records. A matching head does not establish ancestry or deployment.')}</p>
    {land?.steps?.length ? <details className="mt-3"><summary className="cursor-pointer text-xs font-medium">{t('Recorded land steps')}</summary><pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md border bg-muted/30 p-2 font-mono text-xs">{jsonText(land.steps)}</pre></details> : null}
  </Card>;
}

export function TimelineCard({ attempt }: Readonly<{ attempt: AttemptDetailV2 }>) {
  const first = attempt.timeline.find(item => item.at)?.at ?? null;
  return <Card concept="C7" title={t('Timeline')} hint={t('milestones measured from the ledger, with SLA deadlines')}>
    <ol className="m-0 grid list-none gap-x-6 p-0 sm:grid-cols-2">{attempt.timeline.map(item => <li key={item.step} className="flex items-center gap-2 border-b py-2 text-sm" data-tone={item.late ? 'warning' : item.at ? 'success' : 'queued'}>
      <span className="size-2 shrink-0 rounded-full bg-[var(--tone)]" aria-hidden="true" />
      <span className="min-w-0 flex-1">{timelineLabels[item.step] ?? item.step}</span>
      {item.late ? <span className="inline-flex items-center gap-1 text-xs" style={{ color: 'var(--tone)' }}><CircleAlert className="size-3.5" aria-hidden="true" />{t('over SLA')}{item.slaMs ? ` ${formatSpan(item.slaMs)}` : ''}</span> : null}
      <span className="font-mono text-xs text-muted-foreground">{item.at ? `${formatClock(item.at)}${first ? ` · +${formatSpan(item.at - first)}` : ''}` : '—'}</span>
    </li>)}</ol>
  </Card>;
}

function ActionRowView({ action }: Readonly<{ action: ActionRow }>) {
  return <li className="flex flex-wrap items-center gap-2 py-2 text-sm"><StatusChip status={statusFromUi(action.ui)} label={action.state} /><span>{action.controller} · {action.duty ?? action.verb ?? action.state}</span>{action.exitCode != null ? <span className="text-xs text-muted-foreground">exit {action.exitCode}</span> : null}<span className="ml-auto text-xs text-muted-foreground">{formatAbsolute(action.startedAt)}</span></li>;
}

function DecisionRowView({ decision }: Readonly<{ decision: RecordedDecision }>) {
  return <li className="min-w-0 py-2 text-sm">
    <div className="flex flex-wrap items-center gap-2"><span className="rounded border px-2 py-1 text-[11px] text-muted-foreground">{decision.decider}</span><span className="min-w-0 flex-1 break-words">{decision.choice ?? t('Choice not recorded')}</span><span className="text-xs text-muted-foreground">{formatAbsolute(decision.at)}</span></div>
    <p className="mb-0 mt-1 text-xs text-muted-foreground">{decision.association === 'attempt' ? t('Exact Attempt association') : t('Job-wide association')}</p>
    <p className="mb-0 mt-2 break-words text-xs text-muted-foreground">{decision.rationale ?? t('Rationale not recorded')}</p>
    <details className="mt-2"><summary className="cursor-pointer text-xs text-muted-foreground">{t('Recorded decision result')}</summary><div className="mt-2"><CopyId value={decision.id} /></div><pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md border bg-muted/30 p-2 font-mono text-xs">{decision.result == null ? t('Not recorded') : jsonText(decision.result)}</pre></details>
  </li>;
}

/** Controller actions, decisions and lessons tied to this attempt (three framed cards). */
export function AttemptDecisions({ attempt }: Readonly<{ attempt: AttemptDetailV2 }>) {
  return <BareCards value={false}>
    <div className="grid min-w-0 gap-4 lg:grid-cols-3">
      <Card concept="C13" title={t('Who touched it')} hint={t('Recorded actions for this job; may span dispatches')}>{attempt.actions.length ? <ul className="m-0 list-none divide-y p-0">{attempt.actions.map(action => <ActionRowView key={action.id} action={action} />)}</ul> : <Empty>{t('No controller action recorded yet.')}</Empty>}</Card>
      <Card concept="C12" title={t('Decisions')} hint={t('recorded choices and rationale')}>{attempt.decisions.length ? <ul className="m-0 list-none divide-y p-0">{attempt.decisions.map(decision => <DecisionRowView key={decision.id} decision={decision} />)}</ul> : <Empty>{t('No related recorded decision.')}</Empty>}</Card>
      <Card concept="C16" title={t('Related lessons')} hint={t('Global lesson matches by operation or failure text; not exact evidence')}>{attempt.lessons.length ? <ul className="m-0 list-none divide-y p-0">{attempt.lessons.map(lesson => <li key={lesson.id} className="py-2 text-sm"><strong>{lesson.title}</strong><span className="ml-2 text-xs text-muted-foreground">{lesson.state}{lesson.landedSha ? ` · ${lesson.landedSha.slice(0, 10)}` : ''}</span></li>)}</ul> : <Empty>{t('No related lesson yet.')}</Empty>}</Card>
    </div>
  </BareCards>;
}

/** Timeline, controller actions, decisions and lessons tied to this attempt. */
export function AttemptTrail({ attempt }: Readonly<{ attempt: AttemptDetailV2 }>) {
  return <div className="grid min-w-0 gap-4">
    <TimelineCard attempt={attempt} />
    <AttemptDecisions attempt={attempt} />
  </div>;
}
