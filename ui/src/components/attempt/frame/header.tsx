import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useApiQuery } from '../../../api/query';
import type { AttemptDetailV3, ContractInfo, Ref } from '../../../contract';
import { formatOpLabel } from '../../../i18n/vi';
import { compactVi } from '../../usage-view';
import { formatSpan } from './util';
import { statusFromOutcome, statusFromVerdict, statusTone, type Tone } from '../../status';
import { StatusChip, StatusDot } from '../../status-chip';
import { isOpen } from './steps';
import type { Concept } from '../../concept';
import { Advanced, Swap } from '../../motion';
import { AgentAvatar, agentOf } from '../../agent/agent-avatar';
import { WhyBlock } from '../../why/why-block';
import { t } from '../../../i18n/t';

export const concept: Concept = 'C6';

const verdictWords: Record<string, string> = { pass: t('passed'), fail: t('failed'), partial: t('partial'), blocked: t('blocked'), dropped: t('dropped'), cancelled: t('cancelled') };
const outcomeWords: Record<string, string> = { done: t('done'), partial: t('partial'), failed: t('failed'), ask: t('needs a question'), blocked: t('blocked') };

function Crumb({ href, children }: { href: string; children: React.ReactNode }) {
  return <a className="hover:text-foreground hover:underline" href={href}>{children}</a>;
}

function SiblingLink({ target, label, dir }: { target: Ref; label: string; dir: 'prev' | 'next' }) {
  return <a href={target.href} className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs text-muted-foreground hover:border-primary hover:text-foreground">
    {dir === 'prev' ? <ArrowLeft className="size-3.5" aria-hidden="true" /> : null}{label} #{target.id}{dir === 'next' ? <ArrowRight className="size-3.5" aria-hidden="true" /> : null}
  </a>;
}

/** Job try and dispatch sequence are distinct; the unit's current budget is reference metadata. */
export function AttemptHeader({ attempt, project }: { attempt: AttemptDetailV3; project: string }) {
  const open = isOpen(attempt);
  const outcome = statusFromOutcome(attempt.reportOutcome);
  const verdict = statusFromVerdict(attempt.verdict, open && Boolean(attempt.reportedAt), attempt.ui);
  const previous = attempt.retry.redispatchOf ?? attempt.retry.retryOf ?? attempt.retry.resumeOf;
  const outcomeLabel = attempt.reportOutcome ? t('Op self-reported: {outcome}', { outcome: outcomeWords[attempt.reportOutcome] ?? attempt.reportOutcome }) : attempt.reportedAt ? t('Op self-reported: unclear') : t('Op self-reported: not reported');
  const verdictLabel = verdict === 'awaiting-owner' ? t('Verdict: awaiting the owner') : verdict === 'rejected' ? t('Rejected at dispatch') : attempt.verdict ? t('Recorded verdict: {verdict}', { verdict: verdictWords[attempt.verdict] ?? attempt.verdict }) : open && attempt.reportedAt ? t('Verdict: settling') : t('No recorded verdict');
  const tone: Tone = statusTone[verdict === 'unknown' ? outcome : verdict];
  const enc = encodeURIComponent;
  const agent = agentOf({ ...attempt, model: attempt.modelAuthority === 'attested' ? attempt.model : null });
  const contract = useApiQuery<ContractInfo>('/api/contract', { topics: ['system'], intervalMs: 60_000 });
  const name = formatOpLabel(attempt.op, contract.data?.opLabels);
  const end = attempt.settledAt ?? attempt.reportedAt ?? (open ? Date.now() : null);
  const duration = attempt.dispatchedAt && end ? end - attempt.dispatchedAt : null;
  const total = attempt.usage?.total;
  const partialTokens = (attempt.tokensIn == null) !== (attempt.tokensOut == null);
  const totalComplete = total?.completeness?.fields.input.complete && total.completeness.fields.output.complete;
  const tokens = attempt.tokensIn != null && attempt.tokensOut != null ? attempt.tokensIn + attempt.tokensOut : !partialTokens && totalComplete && total?.input != null && total.output != null ? total.input + total.output : null;
  const tokenText = tokens != null ? `${compactVi(tokens)} token` : partialTokens || total?.input != null || total?.output != null ? t('tokens partially recorded') : attempt.usageSource === 'unavailable' ? t('tokens not measurable{reason}', { reason: attempt.usageReason ? ` · ${attempt.usageReason}` : '' }) : t('tokens not recorded');
  return <header className="flex min-w-0 flex-col gap-4" data-tone={tone}>
    <nav aria-label={t('Breadcrumb')} className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
      <Crumb href="#/">{t('Overview')}</Crumb><span aria-hidden="true">/</span>
      <Crumb href={`#/w/${enc(project)}/${enc(attempt.wf)}?tab=attempts`}>{attempt.wf}</Crumb><span aria-hidden="true">/</span>
      <span>{name}</span><span aria-hidden="true">/</span><span className="text-foreground">{t('attempt #{id}', { id: attempt.id })}</span>
    </nav>
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
      <div className="flex min-w-0 items-start gap-3">
        <AgentAvatar agent={agent} size={52} live={open && !attempt.reportedAt} />
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="m-0 text-2xl font-semibold tracking-tight sm:text-3xl">{name} <span className="whitespace-nowrap text-lg font-normal text-muted-foreground sm:text-xl">· {t('job try {n}', { n: attempt.attempt })}</span></h1>
          <p className="m-0 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>Agent: <strong className="font-medium text-foreground">{agent.label}</strong></span>
            <span>{t('Duration:')} <strong className="font-medium text-foreground">{formatSpan(duration)}</strong></span>
            <span>{t('dispatch #{id}', { id: attempt.dispatchSeq })}</span>
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Swap keyValue={verdictLabel}><StatusChip status={verdict} label={verdictLabel} /></Swap>
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><StatusDot status={outcome} />{outcomeLabel}</span>
      </div>
    </div>
    {attempt.why ? <><WhyBlock why={attempt.why} compact className="max-w-[80ch]" />{attempt.why.provenance?.source === 'computed' ? <p className="m-0 text-xs text-muted-foreground">{t('Explanation computed from current reference data; it is not a stored settlement receipt.')}</p> : null}</> : null}
    {previous || attempt.retry.next ? <div className="flex flex-wrap items-center gap-2">
      {previous ? <SiblingLink target={previous} label={attempt.retry.redispatchOf ? t('Previous dispatch of this job') : attempt.retry.resumeOf && !attempt.retry.retryOf ? t('Resumed from') : t('Previous')} dir="prev" /> : null}
      {attempt.retry.next ? <SiblingLink target={attempt.retry.next} label={t('Next')} dir="next" /> : null}
    </div> : null}
    <Advanced summary={`${attempt.job} · ${tokenText}`}>
      <div className="flex min-w-0 flex-col gap-2 text-xs text-muted-foreground">
        <p className="m-0 break-all font-mono">{attempt.op} · {attempt.job} · attempt {attempt.id} · {t('dispatch #{id}', { id: attempt.dispatchSeq })}</p>
        <p className="m-0 flex flex-wrap gap-x-4 gap-y-1">
          <span>Agent: <strong className="font-medium text-foreground">{agent.label}</strong>{[attempt.pool, attempt.effort ? `effort ${attempt.effort}` : null].filter(Boolean).map(part => <span key={part}> · {part}</span>)}</span>
          <span>{tokens != null ? <>Token: <strong className="font-medium text-foreground">{compactVi(tokens)}</strong></> : tokenText}</span>
          {attempt.retry.class ? <span>{t('Retry reason:')} {attempt.retry.class}</span> : null}
          {attempt.tryBudget != null ? <span>{t('Current unit try budget: {n}', { n: attempt.tryBudget })}</span> : null}
        </p>
      </div>
    </Advanced>
  </header>;
}
