import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Link } from '@heroui/react';
import { useApiQuery } from '../../../api/query';
import type { AttemptDetailV3, ContractInfo, Ref } from '../../../contract';
import { formatOpLabel } from '../../../i18n/vi';
import { compactVi, costVi } from '../../usage-view';
import { formatSpan } from './util';
import { statusFromOutcome, statusFromVerdict, statusTone, type Status } from '../../status';
import { StatusChip, StatusDot } from '../../status-chip';
import { isOpen } from './steps';
import type { Concept } from '../../concept';
import { Advanced, Swap } from '../../motion';
import { AgentAvatar, agentOf, type LinkedAgent } from '../../agent/agent-avatar';
import { WhyBlock } from '../../why/why-block';
import { t } from '../../../i18n/t';

export const concept: Concept = 'C6';

const verdictWords: Record<string, string> = { pass: t('passed'), fail: t('failed'), partial: t('partial'), blocked: t('blocked'), dropped: t('dropped'), cancelled: t('cancelled') };
const outcomeWords: Record<string, string> = { done: t('done'), partial: t('partial'), failed: t('failed'), ask: t('needs a question'), blocked: t('blocked') };

function Crumb({ href, children }: Readonly<{ href: string; children: React.ReactNode }>) {
  return <Link className="text-xs text-muted-foreground" href={href}>{children}</Link>;
}

function SiblingLink({ target, label, dir }: Readonly<{ target: Ref; label: string; dir: 'prev' | 'next' }>) {
  return <Link href={target.href} className="gap-1 text-xs">
    {dir === 'prev' ? <ArrowLeft className="size-3.5" aria-hidden="true" /> : null}{label} #{target.id}{dir === 'next' ? <ArrowRight className="size-3.5" aria-hidden="true" /> : null}
  </Link>;
}

function outcomeLabelOf(attempt: AttemptDetailV3): string {
  if (attempt.reportOutcome) return t('Op self-reported: {outcome}', { outcome: outcomeWords[attempt.reportOutcome] ?? attempt.reportOutcome });
  if (attempt.reportedAt) return t('Op self-reported: unclear');
  return t('Op self-reported: not reported');
}

function verdictLabelOf(attempt: AttemptDetailV3, verdict: Status, open: boolean): string {
  if (verdict === 'awaiting-owner') return t('Verdict: awaiting the owner');
  if (verdict === 'rejected') return t('Rejected at dispatch');
  if (attempt.verdict) return t('Recorded verdict: {verdict}', { verdict: verdictWords[attempt.verdict] ?? attempt.verdict });
  if (open && attempt.reportedAt) return t('Verdict: settling');
  return t('No recorded verdict');
}

function tokenTextOf(attempt: AttemptDetailV3): string {
  // The Attempt summary includes cache tokens; llm_usage input/output measurements have a different scope.
  if (attempt.tokensIn != null && attempt.tokensOut != null) return `${compactVi(attempt.tokensIn + attempt.tokensOut)} token`;
  if ((attempt.tokensIn == null) !== (attempt.tokensOut == null)) return t('tokens partially recorded');
  if (attempt.usageSource === 'unavailable') {
    const reason = attempt.usageReason ? ` · ${attempt.usageReason}` : '';
    return t('tokens not measurable{reason}', { reason });
  }
  return t('tokens not recorded');
}

function previousLabelOf(retry: AttemptDetailV3['retry']): string {
  if (retry.redispatchOf) return t('Previous dispatch of this job');
  if (retry.resumeOf && !retry.retryOf) return t('Resumed from');
  return t('Previous');
}

/** Elapsed time of an attempt; open attempts count up to `now`. */
function durationOf(attempt: AttemptDetailV3, open: boolean, now: number): number | null {
  const end = attempt.settledAt ?? attempt.terminalEndedAt ?? attempt.reportedAt ?? (open ? now : null);
  return attempt.dispatchedAt && end ? end - attempt.dispatchedAt : null;
}

/** Wall clock that ticks once a second while `active`, so render stays pure. */
function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}

function HeaderBreadcrumb({ attempt, project, name }: Readonly<{ attempt: AttemptDetailV3; project: string; name: string }>) {
  const enc = encodeURIComponent;
  return <nav aria-label={t('Breadcrumb')} className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
    <Crumb href="#/">{t('Overview')}</Crumb><span aria-hidden="true">/</span>
    <Crumb href={`#/w/${enc(project)}/${enc(attempt.wf)}?tab=attempts`}>{attempt.wf}</Crumb><span aria-hidden="true">/</span>
    <span>{name}</span><span aria-hidden="true">/</span><span className="text-foreground">{t('attempt #{id}', { id: attempt.id })}</span>
  </nav>;
}

function HeaderIdentity({ attempt, agent, name, duration, modelText, live }: Readonly<{ attempt: AttemptDetailV3; agent: LinkedAgent; name: string; duration: number | null; modelText: string; live: boolean }>) {
  return <div className="flex min-w-0 items-start gap-3">
    <AgentAvatar agent={agent} size={52} live={live} />
    <div className="flex min-w-0 flex-col gap-2">
      <h1 className="m-0 text-2xl font-semibold tracking-tight sm:text-[28px] sm:leading-[34px]">{t('Attempt #{id}', { id: attempt.id })}</h1>
      <p className="m-0 break-words text-base font-medium leading-6">{name}</p>
      <p className="m-0 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>Agent: <strong className="font-medium text-foreground">{attempt.agent ?? attempt.provider ?? t('unknown')}</strong></span>
        <span>{t('Requested model: {model}', { model: attempt.requestedModel ?? t('Not recorded') })}</span>
        <span>{modelText}</span>
      </p>
      <p className="m-0 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>{t('Duration:')} <strong className="font-medium text-foreground">{formatSpan(duration)}</strong></span>
        <span>{t('job try {n}', { n: attempt.attempt })}</span>
        <span>{t('dispatch #{id}', { id: attempt.dispatchSeq })}</span>
      </p>
    </div>
  </div>;
}

function SiblingLinks({ retry }: Readonly<{ retry: AttemptDetailV3['retry'] }>) {
  const previous = retry.redispatchOf ?? retry.retryOf ?? retry.resumeOf;
  if (!previous && !retry.next) return null;
  return <div className="flex flex-wrap items-center gap-2">
    {previous ? <SiblingLink target={previous} label={previousLabelOf(retry)} dir="prev" /> : null}
    {retry.next ? <SiblingLink target={retry.next} label={t('Next')} dir="next" /> : null}
  </div>;
}

function Coverage({ total }: Readonly<{ total: NonNullable<AttemptDetailV3['usage']>['total'] }>) {
  if (!total?.completeness) return null;
  const fields = total.completeness.fields;
  return <p className="m-0 flex flex-wrap gap-x-4 gap-y-1"><span>{t('Measurement coverage')} · <code>llm_usage</code>: {t('Input tokens')} {fields.input.known}/{fields.input.total}</span><span>{t('Output tokens')} {fields.output.known}/{fields.output.total}</span><span>{t('Cost')} {fields.costUsd.known}/{fields.costUsd.total}</span></p>;
}

type Texts = Readonly<{ modelText: string; tokenText: string; costText: string }>;

function HeaderProvenance({ attempt, agent, texts }: Readonly<{ attempt: AttemptDetailV3; agent: LinkedAgent; texts: Texts }>) {
  const { modelText, tokenText, costText } = texts;
  return <Advanced summary={`${attempt.job} · ${attempt.op}`}>
    <div className="flex min-w-0 flex-col gap-2 text-xs text-muted-foreground">
      <p className="m-0 break-all font-mono">{attempt.op} · {attempt.job} · attempt {attempt.id} · {t('dispatch #{id}', { id: attempt.dispatchSeq })}</p>
      <p className="m-0 flex flex-wrap gap-x-4 gap-y-1">
        <span>Agent: <strong className="font-medium text-foreground">{agent.label}</strong>{[attempt.pool, attempt.effort ? `effort ${attempt.effort}` : null].filter(Boolean).map(part => <span key={part}> · {part}</span>)}</span>
        <span>{t('Requested model: {model}', { model: attempt.requestedModel ?? t('Not recorded') })}</span>
        <span>{modelText}</span>
        <span>{tokenText}</span>
        <span>{t('Cost')}: {costText}</span>
        {attempt.retry.class ? <span>{t('Retry reason:')} {attempt.retry.class}</span> : null}
        {attempt.tryBudget != null ? <span>{t('Current unit try budget: {n}', { n: attempt.tryBudget })}</span> : null}
      </p>
      <Coverage total={attempt.usage?.total} />
    </div>
  </Advanced>;
}

/** Displays the native Attempt identity; job try, dispatch sequence and model provenance remain separate facts. */
export function AttemptHeader({ attempt, project }: Readonly<{ attempt: AttemptDetailV3; project: string }>) {
  const open = isOpen(attempt);
  const now = useNow(open);
  const outcome = statusFromOutcome(attempt.reportOutcome);
  const verdict = statusFromVerdict(attempt.verdict, open && Boolean(attempt.reportedAt), attempt.ui);
  const verdictLabel = verdictLabelOf(attempt, verdict, open);
  const agent = agentOf({ ...attempt, model: attempt.modelAuthority === 'attested' ? attempt.model : null });
  const contract = useApiQuery<ContractInfo>('/api/contract', { topics: ['system'], intervalMs: 60_000 });
  const name = formatOpLabel(attempt.op, contract.data?.opLabels);
  const texts: Texts = {
    modelText: attempt.modelAuthority === 'attested' && attempt.model ? t('Attested model: {model}', { model: attempt.model }) : t('Model attestation has not been observed.'),
    tokenText: tokenTextOf(attempt),
    costText: attempt.costUsd != null ? costVi(attempt.costUsd) : t('Cost not recorded'),
  };
  return <header className="flex min-w-0 flex-col gap-4" data-tone={statusTone[verdict]}>
    <HeaderBreadcrumb attempt={attempt} project={project} name={name} />
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
      <HeaderIdentity attempt={attempt} agent={agent} name={name} duration={durationOf(attempt, open, now)} modelText={texts.modelText} live={open && attempt.terminalEndedAt == null && !attempt.reportedAt} />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Swap keyValue={verdictLabel}><StatusChip status={verdict} label={verdictLabel} /></Swap>
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><StatusDot status={outcome} />{outcomeLabelOf(attempt)}</span>
      </div>
    </div>
    {attempt.why ? <><WhyBlock why={attempt.why} compact className="max-w-[80ch]" />{attempt.why.provenance?.source === 'computed' ? <p className="m-0 text-xs text-muted-foreground">{t('Explanation computed from current reference data; it is not a stored settlement receipt.')}</p> : null}</> : null}
    <SiblingLinks retry={attempt.retry} />
    <p className="m-0 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"><span>{texts.tokenText}</span><span>{t('Cost')}: {texts.costText}</span></p>
    <HeaderProvenance attempt={attempt} agent={agent} texts={texts} />
  </header>;
}
