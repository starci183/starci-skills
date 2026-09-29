import { CircleAlert } from 'lucide-react';
import { useApiQuery } from '../../../api/query';
import type { ActionRow, AttemptDetailV2, DecisionRow, LogRow } from '../../../contract';
import { formatAbsolute } from '../../../i18n/vi';
import { statusFromUi } from '../../status';
import { StatusChip } from '../../status-chip';
import { TranscriptViewer } from '../transcript';
import { DiffView, type JobDiff } from '../evidence';
import { PathLink } from '../../path-link';
import { BareCards, Card, Empty } from './card';
import { formatBytes, formatClock, formatSpan } from './util';
import type { Concept } from '../../concept';

export const concept: Concept = 'C7';

const timelineLabels: Record<string, string> = {
  routed: 'Định tuyến', dispatched: 'Giao', started: 'Bắt đầu', attested: 'Xác nhận agent', reported: 'Báo cáo', consumed: 'Kernel nhận báo cáo',
  checked: 'Kiểm', settled: 'Chốt', released: 'Nhả slot', 'terminal-closed': 'Đóng terminal', 'worktree-removed': 'Xoá worktree',
};

export function TranscriptSection({ project, attemptId, attempt }: { project: string; attemptId: string; attempt: AttemptDetailV2 }) {
  const logs = useApiQuery<LogRow[]>(`/api/logs?project=${encodeURIComponent(project)}&job=${encodeURIComponent(attempt.job)}&limit=100`, { topics: [`attempt:${project}:${attemptId}`], intervalMs: 30_000 });
  const terminal = attempt.terminal;
  return <Card id="attempt-step-run" concept="C7" title="Chạy · transcript" hint="scrollback đã che dữ liệu nhạy cảm, không phải ảnh chụp màn hình terminal"
    right={terminal ? <span className="font-mono text-[11px] text-muted-foreground">{terminal.handle} · {terminal.snapshots} snapshot{terminal.live ? ' · đang mở' : ''}</span> : null}>
    <TranscriptViewer project={project} attemptId={attemptId} live={attempt.verdict == null && attempt.endState == null} />
    <details className="mt-4"><summary className="cursor-pointer text-sm font-medium">Nhật ký hệ thống của job · {logs.data?.length ?? 0}</summary>
      <div className="mt-2 divide-y">{logs.data?.map(item => <div key={item.key} className="py-2 text-xs"><span className="text-muted-foreground">{formatAbsolute(item.at)} · {item.level} · {item.actor}</span><p className="break-words">{item.msg}</p></div>)}</div>
      {logs.data && !logs.data.length ? <Empty>Không có dòng nhật ký nào cho job này.</Empty> : null}
    </details>
  </Card>;
}

export function DiffSection({ project, attemptId, attempt }: { project: string; attemptId: string; attempt: AttemptDetailV2 }) {
  const diff = useApiQuery<JobDiff | null>(`/api/attempts/${encodeURIComponent(project)}/${encodeURIComponent(attemptId)}/diff`, { intervalMs: 60_000 });
  const where = attempt.where;
  const fileCount = diff.data?.files?.length ?? 0;
  return <Card id="attempt-step-diff" concept="C11" title="Diff" hint={fileCount ? `${fileCount} tệp thay đổi` : 'thay đổi op ghi vào repo'}
    right={where.baseSha || where.headSha ? <span className="font-mono text-[11px] text-muted-foreground">{where.baseSha?.slice(0, 8) ?? '—'} → {where.headSha?.slice(0, 8) ?? '—'}</span> : null}>
    {diff.data?.files?.length ? <DiffView diff={diff.data} /> : <Empty>Chưa có diff được ghi nhận. Diff chỉ có khi runtime lưu lại thay đổi của op{where.mainCheckout ? '; op này chạy trên checkout chính nên không có worktree riêng để so sánh' : ''}.</Empty>}
  </Card>;
}

export function LandSection({ attempt }: { attempt: AttemptDetailV2 }) {
  const land = attempt.land;
  return <Card id="attempt-step-land" concept="C11" title="Land" hint={land ? undefined : 'gộp commit của lần thử vào nhánh chính'}
    right={land ? <StatusChip status={land.result === 'passed' ? 'success' : land.result === 'failed' ? 'failed' : 'retry'} label={land.result} /> : <StatusChip status={attempt.verdict ? 'deferred' : 'queued'} label={attempt.verdict ? 'Không áp dụng' : 'Chưa tới'} />}>
    <dl className="m-0 grid gap-4 text-sm sm:grid-cols-2">
      <div className="flex flex-col gap-1"><dt className="text-xs text-muted-foreground">Commit tích hợp</dt><dd className="m-0 break-all font-mono">{attempt.where.integratedSha ?? 'Chưa có'}</dd></div>
      <div className="flex flex-col gap-1"><dt className="text-xs text-muted-foreground">SHA sau land</dt><dd className="m-0 break-all font-mono">{land?.mergedSha ?? 'Chưa có'}</dd></div>
      <div className="flex flex-col gap-1"><dt className="text-xs text-muted-foreground">Thời điểm</dt><dd className="m-0">{formatAbsolute(land?.at)}</dd></div>
      <div className="flex flex-col gap-1"><dt className="text-xs text-muted-foreground">Nhánh · worktree</dt><dd className="m-0 flex flex-wrap items-center gap-2 break-all">{attempt.where.branch ?? 'không có nhánh riêng'}{attempt.where.worktree && !attempt.where.mainCheckout ? <PathLink path={attempt.where.worktree} /> : null}</dd></div>
    </dl>
    {land?.reason ? <p className="mb-0 mt-3 break-words text-sm text-muted-foreground">{land.reason}</p> : null}
    {land?.output ? <a href={land.output.href} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm text-primary hover:underline">Mở đầu ra land ({formatBytes(land.output.bytes)})</a> : null}
    {!land ? <p className="mt-3 text-xs text-muted-foreground">Chưa có bản ghi land cho lần thử này. Land chạy ở cấp workflow khi mọi chặng đã đạt, nên phần lớn lần thử không có bước này.</p> : null}
  </Card>;
}

export function TimelineCard({ attempt }: { attempt: AttemptDetailV2 }) {
  const first = attempt.timeline.find(item => item.at)?.at ?? null;
  return <Card concept="C7" title="Dòng thời gian" hint="mốc đo từ ledger, kèm hạn SLA">
    <ol className="m-0 grid list-none gap-x-6 p-0 sm:grid-cols-2">{attempt.timeline.map(item => <li key={item.step} className="flex items-center gap-2 border-b py-2 text-sm" data-tone={item.late ? 'warning' : item.at ? 'success' : 'queued'}>
      <span className="size-2 shrink-0 rounded-full bg-[var(--tone)]" aria-hidden="true" />
      <span className="min-w-0 flex-1">{timelineLabels[item.step] ?? item.step}</span>
      {item.late ? <span className="inline-flex items-center gap-1 text-xs" style={{ color: 'var(--tone)' }}><CircleAlert className="size-3.5" aria-hidden="true" />quá SLA{item.slaMs ? ` ${formatSpan(item.slaMs)}` : ''}</span> : null}
      <span className="font-mono text-xs text-muted-foreground">{item.at ? `${formatClock(item.at)}${first ? ` · +${formatSpan(item.at - first)}` : ''}` : '—'}</span>
    </li>)}</ol>
  </Card>;
}

function ActionRowView({ action }: { action: ActionRow }) {
  return <li className="flex flex-wrap items-center gap-2 py-2 text-sm"><StatusChip status={statusFromUi(action.ui)} label={action.state} /><span>{action.controller} · {action.duty ?? action.verb ?? action.state}</span>{action.exitCode != null ? <span className="text-xs text-muted-foreground">exit {action.exitCode}</span> : null}<span className="ml-auto text-xs text-muted-foreground">{formatAbsolute(action.startedAt)}</span></li>;
}

function DecisionRowView({ decision }: { decision: DecisionRow }) {
  return <li className="flex flex-wrap items-center gap-2 py-2 text-sm"><StatusChip status={statusFromUi(decision.ui)} label={decision.status} /><span className="rounded border px-2 py-1 text-[11px] text-muted-foreground">{decision.decider}</span><span className="min-w-0 flex-1 break-words">{decision.summary}</span><span className="text-xs text-muted-foreground">{formatAbsolute(decision.openedAt)}</span></li>;
}

/** Controller actions, decisions and lessons tied to this attempt (three framed cards). */
export function AttemptDecisions({ attempt }: { attempt: AttemptDetailV2 }) {
  return <BareCards value={false}>
    <div className="grid min-w-0 gap-4 lg:grid-cols-3">
      <Card concept="C13" title="Ai đã đụng" hint="controller đã tác động">{attempt.actions.length ? <ul className="m-0 list-none divide-y p-0">{attempt.actions.map(action => <ActionRowView key={action.id} action={action} />)}</ul> : <Empty>Chưa có tác động controller nào được ghi nhận.</Empty>}</Card>
      <Card concept="C12" title="Quyết định" hint="decision item liên quan">{attempt.decisions.length ? <ul className="m-0 list-none divide-y p-0">{attempt.decisions.map(decision => <DecisionRowView key={decision.id} decision={decision} />)}</ul> : <Empty>Chưa có quyết định nào gắn với lần thử này.</Empty>}</Card>
      <Card concept="C16" title="Bài học liên quan" hint="learning đã rút ra">{attempt.lessons.length ? <ul className="m-0 list-none divide-y p-0">{attempt.lessons.map(lesson => <li key={lesson.id} className="py-2 text-sm"><strong>{lesson.title}</strong><span className="ml-2 text-xs text-muted-foreground">{lesson.state}{lesson.landedSha ? ` · ${lesson.landedSha.slice(0, 10)}` : ''}</span></li>)}</ul> : <Empty>Chưa có bài học liên quan.</Empty>}</Card>
    </div>
  </BareCards>;
}

/** Timeline, controller actions, decisions and lessons tied to this attempt. */
export function AttemptTrail({ attempt }: { attempt: AttemptDetailV2 }) {
  return <div className="grid min-w-0 gap-4">
    <TimelineCard attempt={attempt} />
    <AttemptDecisions attempt={attempt} />
  </div>;
}
