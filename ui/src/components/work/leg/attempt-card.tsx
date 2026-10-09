import { ArrowRight } from 'lucide-react';
import { Link } from '@heroui/react';
import type { AttemptBrief } from '../../../contract';
import { StatusChip, StatusDot } from '../../status-chip';
import { statusFromOutcome, statusFromVerdict } from '../../status';
import type { Concept } from '../../concept';
import { AgentAvatar, agentOf } from '../../agent/agent-avatar';
import { formatDayTime, formatDuration } from './time';
import { t } from '../../../i18n/t';

export const concept: Concept = 'C7';

const outcomeLabel: Record<string, string> = { done: t('Op reported done'), partial: t('Op reported partial'), failed: t('Op reported failed'), ask: t('Op asked back'), blocked: t('Op reported blocked') };
const verdictLabel: Record<NonNullable<AttemptBrief['verdict']>, string> = { pass: t('Passed'), fail: t('Failed'), partial: t('Partial'), blocked: t('Blocked'), dropped: t('Dropped'), cancelled: t('Cancelled') };
const fmt = (n: number | null) => n == null ? '–' : n.toLocaleString('vi-VN');

/** One dispatch, its Op report and the independently recorded runtime verdict. */
export function AttemptCard({ attempt, now }: Readonly<{ attempt: AttemptBrief; now: number }>) {
  const executing = attempt.open && attempt.endedAt == null && attempt.reportedAt == null && !attempt.reportOutcome;
  const end = attempt.settledAt ?? attempt.endedAt ?? (executing ? now : null);
  const outcome = statusFromOutcome(attempt.reportOutcome);
  const verdict = statusFromVerdict(attempt.verdict, false, attempt.status);
  const who = [attempt.model, attempt.agent, attempt.pool].filter(Boolean).join(' · ');
  return <li className="border-b py-4 last:border-b-0">
    <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
      <strong className="text-sm">#{attempt.id}</strong><span className="text-xs text-muted-foreground">{t('Business try {n} · dispatch {dispatch}', { n: attempt.try, dispatch: attempt.dispatchSeq })}</span>
      <span className="ml-auto flex flex-wrap items-center gap-2">
        <span title={t('Runtime verdict')}><StatusChip status={verdict} label={attempt.verdict ? t('Runtime: {verdict}', { verdict: verdictLabel[attempt.verdict] }) : attempt.open ? t('Runtime: not settled') : t('Runtime: unknown')} /></span>
        <span title={t('Outcome the Op reported')} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><StatusDot status={outcome} />{attempt.reportOutcome ? outcomeLabel[attempt.reportOutcome] : t('Op has not reported')}</span>
      </span>
    </div>
    <p className="mt-2 break-all font-mono text-xs text-muted-foreground">{t('Unit {unit} · job {job}', { unit: attempt.unit ?? '—', job: attempt.job })}</p>
    {attempt.settledBy && <p className="mt-1 text-xs text-muted-foreground">{t('Settled by {who}', { who: attempt.settledBy })}</p>}
    <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 break-words text-xs text-muted-foreground">
      {who ? <><AgentAvatar agent={agentOf(attempt)} withLabel /><span>{who}</span></> : t('Unknown model / agent')}
      {attempt.tokensIn != null || attempt.tokensOut != null ? <span className="font-mono" title={t('tokens in / out')}>· {t('{in} in · {out} out', { in: fmt(attempt.tokensIn), out: fmt(attempt.tokensOut) })}</span> : null}
    </p>
    <p className="mt-2 text-xs">
      {attempt.dispatchedAt == null ? t('Not dispatched') : <>{formatDayTime(attempt.dispatchedAt)} → {executing ? <span className="text-[var(--status-running)]">{t('running')}</span> : end != null ? formatDayTime(end) : attempt.reportedAt != null ? t('Reported {at}', { at: formatDayTime(attempt.reportedAt) }) : attempt.endState ?? t('State unknown')}</>}
      {attempt.dispatchedAt != null && <span className="text-muted-foreground"> · {end == null ? t('Duration not recorded') : executing ? t('running for {n} min', { n: Math.max(0, Math.round((end - attempt.dispatchedAt) / 60000)) }) : formatDuration(end - attempt.dispatchedAt)}</span>}
      {attempt.open && !executing && <span className="text-muted-foreground"> · {t('Awaiting settlement')}</span>}
    </p>
    {attempt.checks > 0 && <p className="mt-2 text-xs text-muted-foreground">{t('{pass} pass · {red} red · {total} checks', { pass: attempt.checksPass, red: attempt.checksRed, total: attempt.checks })}</p>}
    {attempt.summary && <p className="mt-2 whitespace-pre-wrap break-words text-xs">{attempt.summary}</p>}
    <Link href={attempt.href} className="mt-3 gap-1 text-xs font-medium">{t('Open attempt')} <ArrowRight className="size-3" aria-hidden="true" /></Link>
  </li>;
}
