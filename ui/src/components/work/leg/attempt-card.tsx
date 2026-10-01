import { ArrowRight } from 'lucide-react';
import type { AttemptBrief } from '../../../contract';
import { StatusChip, StatusDot } from '../../status-chip';
import { statusFromOutcome, statusFromVerdict } from '../../status';
import type { Concept } from '../../concept';
import { AgentAvatar, agentOf } from '../../agent/agent-avatar';
import { formatDayTime, formatDuration } from './time';
import { t } from '../../../i18n/t';

export const concept: Concept = 'C7';

const outcomeLabel: Record<string, string> = { done: t('Op reported done'), partial: t('Op reported partial'), failed: t('Op reported failed'), ask: t('Op asked back'), blocked: t('Op reported blocked') };
const verdictLabel: Record<string, string> = { pass: t('Kernel: pass'), fail: t('Kernel: fail'), partial: t('Kernel: partial'), blocked: t('Kernel: blocked'), dropped: t('Kernel: dropped'), cancelled: t('Kernel: cancelled') };

const fmt = (n: number | null) => n == null ? '–' : n.toLocaleString('vi-VN');

/** One attempt inside the leg drawer: who ran it, what the Op said, what the Kernel decided. */
export function AttemptCard({ attempt, now }: { attempt: AttemptBrief; now: number }) {
  const open = attempt.open;
  const end = attempt.settledAt ?? now;
  const outcome = statusFromOutcome(attempt.reportOutcome);
  const verdict = statusFromVerdict(attempt.verdict, open, attempt.status);
  const green = Math.max(0, attempt.checks - attempt.checksRed);
  const who = [attempt.model, attempt.agent, attempt.pool].filter(Boolean).join(' · ');
  return <li className="border-b py-4 last:border-b-0">
    <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
      <strong className="text-sm">#{attempt.id}</strong><span className="text-xs text-muted-foreground">{t('try {n}', { n: attempt.try })}{attempt.unit ? ` · ${attempt.unit}` : ''}</span>
      <span className="ml-auto flex flex-wrap items-center gap-2">
        <span title={t('Kernel verdict')}><StatusChip status={verdict} label={attempt.verdict ? verdictLabel[attempt.verdict] : open ? t('Kernel: not settled') : t('Kernel: unknown')} /></span>
        <span title={t('Outcome the Op reported')} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><StatusDot status={outcome} />{attempt.reportOutcome ? outcomeLabel[attempt.reportOutcome] : t('Op has not reported')}</span>
      </span>
    </div>
    <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 break-words text-xs text-muted-foreground">
      {who ? <><AgentAvatar agent={agentOf(attempt)} withLabel /><span>{who}</span></> : t('Unknown model / agent')}
      {attempt.tokensIn != null || attempt.tokensOut != null ? <span className="font-mono" title={t('tokens in / out')}>· {t('{in} in · {out} out', { in: fmt(attempt.tokensIn), out: fmt(attempt.tokensOut) })}</span> : null}
    </p>
    <p className="mt-2 text-xs">
      {attempt.dispatchedAt == null ? t('Not dispatched') : <>{formatDayTime(attempt.dispatchedAt)} → {attempt.open ? <span className="text-[var(--status-running)]">{t('running')}</span> : attempt.settledAt != null ? formatDayTime(attempt.settledAt) : t('stopped')}</>}
      {attempt.dispatchedAt != null && <span className="text-muted-foreground"> · {open ? t('running for {n} min', { n: Math.max(0, Math.round((end - attempt.dispatchedAt) / 60000)) }) : formatDuration(end - attempt.dispatchedAt)}</span>}
    </p>
    {attempt.checks > 0 && <div className="mt-2 flex items-center gap-2" title={t('{green} pass, {red} red', { green, red: attempt.checksRed })}>
      <div className="flex h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
        <span style={{ width: `${(green / attempt.checks) * 100}%`, background: 'var(--status-success)' }} />
        <span style={{ width: `${(attempt.checksRed / attempt.checks) * 100}%`, background: 'var(--status-failed)' }} />
      </div>
      <span className="text-xs text-muted-foreground">{attempt.checksRed ? t('{green}/{checks} checks pass, {red} red', { green, checks: attempt.checks, red: attempt.checksRed }) : t('{green}/{checks} checks pass', { green, checks: attempt.checks })}</span>
    </div>}
    {attempt.summary && <p className="mt-2 whitespace-pre-wrap break-words text-xs">{attempt.summary}</p>}
    <a href={attempt.href} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">{t('Open attempt')} <ArrowRight className="size-3" aria-hidden="true" /></a>
  </li>;
}
