import type { AttemptDetailV2 } from '../../contract';
import type { Concept } from '../concept';
import { StatusChip } from '../status-chip';
import { PathLink } from '../path-link';
import { UsageView } from '../usage-view';
import { CopyId, InfoChip, InfoRow, ShaId } from '../infra/rows';

export const concept: Concept = 'C6';

const bytes = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : n >= 1024 ? `${(n / 1024).toFixed(1)} KB` : `${n} B`);
const isFile = (rel: string) => !/[\\/]$/.test(rel) && /\.[a-z0-9]+$/i.test(rel);

/** S8: "Nơi chạy & tài nguyên" — every host location, id and resource the attempt touched. */
export function AttemptWhereCard({ attempt }: { attempt: AttemptDetailV2 }) {
  const w = attempt.where;
  const transcript = attempt.terminal?.transcript ?? null;
  const transcriptHref = `#/a/${encodeURIComponent(attempt.project)}/${encodeURIComponent(String(attempt.id))}?step=run`;
  return <section className="rounded-lg border border-border bg-card p-4" aria-label="Nơi chạy và tài nguyên">
    <h3 className="m-0 mb-2 text-sm font-semibold">Nơi chạy &amp; tài nguyên</h3>
    <div className="grid gap-x-8 lg:grid-cols-2">
      <dl className="m-0">
        <InfoRow label="Repo (checkout)">
          <span className="inline-flex flex-wrap items-center gap-2"><PathLink path={w.repo} kind="dir" />{w.mainCheckout ? <InfoChip>checkout chính</InfoChip> : null}</span>
        </InfoRow>
        <InfoRow label="Worktree">
          {w.worktree ? <span className="inline-flex flex-wrap items-center gap-2"><PathLink path={w.worktree} kind="dir" />{w.worktreeRemovedAt ? <InfoChip tone="skipped">đã gỡ</InfoChip> : null}</span>
            : <span className="text-muted-foreground">không có worktree riêng — op chạy trên checkout chính</span>}
        </InfoRow>
        <InfoRow label="Đường dẫn được giao">
          {w.ownedPaths.length ? <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {w.ownedPaths.map((p) => <li key={p.rel} className="flex flex-col gap-0.5">
              <code className="font-mono text-[11px] text-muted-foreground [overflow-wrap:anywhere]">{p.rel}</code>
              <PathLink path={p.abs} kind={isFile(p.rel) ? 'file' : 'dir'} />
            </li>)}
          </ul> : <span className="text-muted-foreground">—</span>}
        </InfoRow>
        <InfoRow label="Sổ ledger"><PathLink path={w.ledgerFile} kind="file" /></InfoRow>
        <InfoRow label="Kho blob"><PathLink path={w.blobRoot} kind="dir" /></InfoRow>
        <InfoRow label="Runtime"><PathLink path={w.runtimeRoot} kind="dir" /></InfoRow>
        <InfoRow label="Nhánh"><CopyId value={w.branch} /></InfoRow>
        <InfoRow label="SHA">
          <span className="flex flex-col gap-1">
            <span className="inline-flex flex-wrap items-center gap-1.5"><span className="w-14 text-xs text-muted-foreground">gốc</span><ShaId sha={w.baseSha} /></span>
            <span className="inline-flex flex-wrap items-center gap-1.5"><span className="w-14 text-xs text-muted-foreground">đầu</span><ShaId sha={w.headSha} /></span>
            <span className="inline-flex flex-wrap items-center gap-1.5"><span className="w-14 text-xs text-muted-foreground">tích hợp</span><ShaId sha={w.integratedSha} /></span>
          </span>
        </InfoRow>
      </dl>
      <dl className="m-0">
        <InfoRow label="Máy chủ / agent">{[w.host, w.agent, w.provider].filter(Boolean).join(' · ') || '—'}</InfoRow>
        <InfoRow label="Profile / pool">{[w.profile, w.pool].filter(Boolean).join(' · ') || '—'}</InfoRow>
        <InfoRow label="Terminal"><CopyId value={w.terminalHandle} /></InfoRow>
        <InfoRow label="Orca run"><CopyId value={w.runId} /></InfoRow>
        <InfoRow label="Orca task"><CopyId value={w.taskId} /></InfoRow>
        <InfoRow label="Orca dispatch"><CopyId value={w.dispatchId} /></InfoRow>
        <InfoRow label="Agent node"><CopyId value={w.agentNode} /></InfoRow>
        <InfoRow label="Agent cha"><CopyId value={w.parentAgent} /></InfoRow>
        <InfoRow label="Trace span"><CopyId value={w.traceSpan} /></InfoRow>
        <InfoRow label="Job">
          <span className="inline-flex flex-wrap items-center gap-2"><CopyId value={w.job} />{w.jobStatus ? <InfoChip tone={w.jobStatus === 'failed' ? 'failed' : w.jobStatus === 'awaiting_owner' ? 'owner' : w.jobStatus === 'succeeded' || w.jobStatus === 'passed' ? 'success' : undefined}>{w.jobStatus}</InfoChip> : null}</span>
        </InfoRow>
        <InfoRow label="Bản ghi phiên">
          {transcript ? <span className="inline-flex flex-wrap items-center gap-2"><a className="text-primary underline-offset-2 hover:underline" href={transcriptHref}>Xem transcript</a>
            <span className="text-xs text-muted-foreground">{bytes(transcript.bytes)}{transcript.archived ? ' · đã lưu trữ' : ''}</span>
            {attempt.terminal?.live ? <StatusChip status="running" label="đang chạy" /> : null}</span>
            : <span className="text-muted-foreground">chưa có transcript</span>}
        </InfoRow>
      </dl>
    </div>
    <div className="mt-3 border-t border-border pt-3">
      <h4 className="m-0 mb-2 text-[13px] font-semibold">Token &amp; chi phí</h4>
      <UsageView usage={attempt.usage} />
    </div>
  </section>;
}
