import { ArrowRight } from 'lucide-react';
import type { AttemptBrief } from '../../../contract';
import { StatusChip } from '../../status-chip';
import { statusFromOutcome, statusFromVerdict } from '../../status';
import type { Concept } from '../../concept';
import { AgentAvatar, agentOf } from '../../agent/agent-avatar';
import { formatDayTime, formatDuration } from './time';

export const concept: Concept = 'C7';

const outcomeLabel: Record<string, string> = { done: 'Op báo xong', partial: 'Op báo một phần', failed: 'Op báo hỏng', ask: 'Op hỏi lại', blocked: 'Op báo bị chặn' };
const verdictLabel: Record<string, string> = { pass: 'Kernel: đạt', fail: 'Kernel: hỏng', partial: 'Kernel: một phần', blocked: 'Kernel: chặn', dropped: 'Kernel: bỏ', cancelled: 'Kernel: huỷ' };

const fmt = (n: number | null) => n == null ? '–' : n.toLocaleString('vi-VN');

/** One attempt inside the leg drawer: who ran it, what the Op said, what the Kernel decided. */
export function AttemptCard({ attempt, now }: { attempt: AttemptBrief; now: number }) {
  const open = attempt.open;
  const end = attempt.settledAt ?? now;
  const outcome = statusFromOutcome(attempt.reportOutcome);
  const verdict = statusFromVerdict(attempt.verdict, open);
  const green = Math.max(0, attempt.checks - attempt.checksRed);
  const who = [attempt.model, attempt.agent, attempt.pool].filter(Boolean).join(' · ');
  return <li className="rounded-lg border bg-card p-3">
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
      <strong className="text-sm">#{attempt.id}</strong><span className="text-xs text-muted-foreground">lần {attempt.try}{attempt.unit ? ` · ${attempt.unit}` : ''}</span>
      <span className="ml-auto flex flex-wrap gap-1.5">
        <span title="Kết quả Op tự báo"><StatusChip status={outcome} label={attempt.reportOutcome ? outcomeLabel[attempt.reportOutcome] : 'Op chưa báo'} /></span>
        <span title="Quyết định của Kernel"><StatusChip status={verdict} label={attempt.verdict ? verdictLabel[attempt.verdict] : open ? 'Kernel: chưa chốt' : 'Kernel: chưa rõ'} /></span>
      </span>
    </div>
    <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 break-words text-xs text-muted-foreground">
      {who ? <><AgentAvatar agent={agentOf(attempt)} withLabel /><span>{who}</span></> : 'Chưa rõ model / agent'}
      {attempt.tokensIn != null || attempt.tokensOut != null ? <span className="font-mono" title="token vào / ra">· {fmt(attempt.tokensIn)} vào · {fmt(attempt.tokensOut)} ra</span> : null}
    </p>
    <p className="mt-1 text-xs">
      {attempt.dispatchedAt == null ? 'Chưa giao' : <>{formatDayTime(attempt.dispatchedAt)} → {attempt.open ? <span className="text-[var(--status-running)]">đang chạy</span> : attempt.settledAt != null ? formatDayTime(attempt.settledAt) : 'đã dừng'}</>}
      {attempt.dispatchedAt != null && <span className="text-muted-foreground"> · {open ? `đang chạy ${Math.max(0, Math.round((end - attempt.dispatchedAt) / 60000))} phút` : formatDuration(end - attempt.dispatchedAt)}</span>}
    </p>
    {attempt.checks > 0 && <div className="mt-2 flex items-center gap-2" title={`${green} đạt, ${attempt.checksRed} đỏ`}>
      <div className="flex h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
        <span style={{ width: `${(green / attempt.checks) * 100}%`, background: 'var(--status-success)' }} />
        <span style={{ width: `${(attempt.checksRed / attempt.checks) * 100}%`, background: 'var(--status-failed)' }} />
      </div>
      <span className="text-xs text-muted-foreground">{green}/{attempt.checks} check đạt{attempt.checksRed ? `, ${attempt.checksRed} đỏ` : ''}</span>
    </div>}
    {attempt.summary && <p className="mt-2 whitespace-pre-wrap break-words text-xs">{attempt.summary}</p>}
    <a href={attempt.href} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">Mở lần thử <ArrowRight className="size-3" aria-hidden="true" /></a>
  </li>;
}
