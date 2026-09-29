import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useApiQuery } from '../../../api/query';
import type { AttemptDetailV3, ContractInfo, Ref } from '../../../contract';
import { formatOpLabel } from '../../../i18n/vi';
import { compactVi } from '../../usage-view';
import { formatSpan } from './util';
import { statusFromOutcome, statusFromVerdict, statusTone, type Tone } from '../../status';
import { StatusChip } from '../../status-chip';
import { isOpen } from './steps';
import type { Concept } from '../../concept';
import { AgentAvatar, agentOf } from '../../agent/agent-avatar';

export const concept: Concept = 'C6';

const verdictWords: Record<string, string> = { pass: 'đạt', fail: 'hỏng', partial: 'một phần', blocked: 'bị chặn', dropped: 'đã bỏ', cancelled: 'đã huỷ' };
const outcomeWords: Record<string, string> = { done: 'xong', partial: 'một phần', failed: 'hỏng', ask: 'cần hỏi', blocked: 'bị chặn' };

function Crumb({ href, children }: { href: string; children: React.ReactNode }) {
  return <a className="hover:text-foreground hover:underline" href={href}>{children}</a>;
}

function SiblingLink({ target, label, dir }: { target: Ref; label: string; dir: 'prev' | 'next' }) {
  return <a href={target.href} className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs text-muted-foreground hover:border-primary hover:text-foreground">
    {dir === 'prev' ? <ArrowLeft className="size-3.5" aria-hidden="true" /> : null}{label} #{target.id}{dir === 'next' ? <ArrowRight className="size-3.5" aria-hidden="true" /> : null}
  </a>;
}

/** Breadcrumb, title "op · lần n/5", job id, the two separate status chips and previous/next attempt links. */
export function AttemptHeader({ attempt, project }: { attempt: AttemptDetailV3; project: string }) {
  const open = isOpen(attempt);
  const outcome = statusFromOutcome(attempt.reportOutcome);
  const verdict = statusFromVerdict(attempt.verdict, open && Boolean(attempt.reportedAt), attempt.reportOutcome);
  const previous = attempt.retry.retryOf ?? attempt.retry.resumeOf;
  const outcomeLabel = attempt.reportOutcome ? `Op tự báo: ${outcomeWords[attempt.reportOutcome] ?? attempt.reportOutcome}` : attempt.reportedAt ? 'Op tự báo: chưa rõ' : 'Op tự báo: chưa báo cáo';
  const verdictLabel = verdict === 'awaiting-owner' ? 'Kernel chốt: chờ thầy trả lời' : attempt.verdict ? `Kernel chốt: ${verdictWords[attempt.verdict] ?? attempt.verdict}` : open && attempt.reportedAt ? 'Kernel chốt: đang chốt' : 'Kernel chưa chốt';
  const tone: Tone = statusTone[verdict === 'unknown' ? outcome : verdict];
  const enc = encodeURIComponent;
  const agent = agentOf(attempt);
  const contract = useApiQuery<ContractInfo>('/api/contract', { topics: ['system'], intervalMs: 60_000 });
  const name = formatOpLabel(attempt.op, contract.data?.opLabels);
  const end = attempt.settledAt ?? attempt.reportedAt ?? (open ? Date.now() : null);
  const duration = attempt.dispatchedAt && end ? end - attempt.dispatchedAt : null;
  const total = attempt.usage?.total;
  const tokens = total ? total.input + total.output : null;
  return <header className="space-y-3" data-tone={tone}>
    <nav aria-label="Đường dẫn" className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
      <Crumb href="#/">Tổng quan</Crumb><span aria-hidden="true">/</span>
      <Crumb href={`#/w/${enc(project)}/${enc(attempt.wf)}?tab=attempts`}>{attempt.wf}</Crumb><span aria-hidden="true">/</span>
      <span>{name}</span><span aria-hidden="true">/</span><span className="text-foreground">lần thử #{attempt.id}</span>
    </nav>
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
      <div className="flex min-w-0 items-start gap-3">
        <AgentAvatar agent={agent} size={52} live={open && !attempt.reportedAt} />
        <div className="min-w-0 space-y-1.5">
        <h1 className="m-0 text-2xl font-semibold tracking-tight sm:text-3xl">{name} <span className="whitespace-nowrap text-lg font-normal text-muted-foreground sm:text-xl">· lần {attempt.attempt}/{attempt.tryBudget ?? 5}</span></h1>
        <p className="m-0 break-all font-mono text-xs text-muted-foreground">{attempt.op} · {attempt.job} · attempt {attempt.id} · giao #{attempt.dispatchSeq}</p>
        <p className="m-0 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          <span>Agent: <strong className="font-medium text-foreground">{agent.label}</strong>{[attempt.pool, attempt.effort ? `effort ${attempt.effort}` : null].filter(Boolean).map(part => <span key={part}> · {part}</span>)}</span>
          <span>Thời gian: <strong className="font-medium text-foreground">{formatSpan(duration)}</strong></span>
          <span>{tokens != null ? <>Token: <strong className="font-medium text-foreground">{compactVi(tokens)}</strong></> : 'token: chưa ghi nhận'}</span>
        </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <StatusChip status={outcome} label={outcomeLabel} />
        <StatusChip status={verdict} label={verdictLabel} />
      </div>
    </div>
    {previous || attempt.retry.next || attempt.retry.class ? <div className="flex flex-wrap items-center gap-2">
      {previous ? <SiblingLink target={previous} label={attempt.retry.resumeOf && !attempt.retry.retryOf ? 'Tiếp nối từ' : 'Lần trước'} dir="prev" /> : null}
      {attempt.retry.next ? <SiblingLink target={attempt.retry.next} label="Lần sau" dir="next" /> : null}
      {attempt.retry.class ? <span className="text-xs text-muted-foreground">Lý do thử lại: {attempt.retry.class}</span> : null}
    </div> : null}
  </header>;
}
