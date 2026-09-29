import type { Usage, WorkflowWhere } from '../../contract';
import type { Concept } from '../concept';
import { PathLink } from '../path-link';
import { UsageView } from '../usage-view';
import { CopyId, InfoChip, InfoRow } from '../infra/rows';

export const concept: Concept = 'C15';

/** S8: where the workflow runs on the host (repos, work tree, ledger, blobs, seat, terminals, worktrees) and its token/cost usage. */
export function WorkflowInfraCard({ where, usage }: { where: WorkflowWhere; usage: Usage }) {
  return <section className="rounded-lg border border-border bg-card p-4" aria-label="Hạ tầng và chi phí">
    <h3 className="m-0 mb-2 text-sm font-semibold">Hạ tầng &amp; chi phí</h3>
    <div className="grid gap-x-8 lg:grid-cols-2">
      <dl className="m-0">
        <InfoRow label="Repo">
          {where.repos.length ? <ul className="m-0 flex list-none flex-col gap-1.5 p-0">{where.repos.map((r) => <li key={r.name} className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{r.name}</span><InfoChip>{r.role}</InfoChip><PathLink path={r.root} kind="dir" /></li>)}</ul> : <span className="text-muted-foreground">—</span>}
        </InfoRow>
        <InfoRow label="Work tree"><PathLink path={where.workTree} kind="dir" /></InfoRow>
        <InfoRow label="Sổ ledger"><PathLink path={where.ledgerFile} kind="file" /></InfoRow>
        <InfoRow label="Kho blob"><PathLink path={where.blobRoot} kind="dir" /></InfoRow>
        <InfoRow label="Runtime"><PathLink path={where.runtimeRoot} kind="dir" /></InfoRow>
        <InfoRow label="Kernel seat"><CopyId value={where.kernelSeat} /></InfoRow>
        <InfoRow label="Worktree">
          <span className="inline-flex flex-wrap gap-2"><InfoChip tone={where.worktreesOpen ? 'running' : 'queued'}>{where.worktreesOpen} đang mở</InfoChip><InfoChip tone="skipped">{where.worktreesRemoved} đã gỡ</InfoChip></span>
        </InfoRow>
      </dl>
      <div>
        <h4 className="m-0 mb-1 text-[13px] font-semibold">Terminal ({where.terminals.length})</h4>
        {where.terminals.length ? <div className="overflow-x-auto"><table className="w-full min-w-[420px] border-collapse text-xs">
          <thead><tr className="text-left text-muted-foreground">{['Handle', 'Vai trò', 'Lượt', 'PID', 'Trạng thái'].map((h) => <th key={h} className="border-b border-border px-2 py-1 font-medium">{h}</th>)}</tr></thead>
          <tbody>{where.terminals.map((t) => <tr key={t.handle} className="border-b border-border last:border-b-0">
            <td className="px-2 py-1"><CopyId value={t.handle} /></td><td className="px-2 py-1">{t.role}</td>
            <td className="px-2 py-1 font-mono">{t.attempt != null ? `#${t.attempt}` : '—'}</td>
            <td className="px-2 py-1 font-mono">{t.pid ?? '—'}</td>
            <td className="px-2 py-1">{t.closedAt ? <InfoChip tone="skipped">đã đóng</InfoChip> : <InfoChip tone="running">đang mở</InfoChip>}</td>
          </tr>)}</tbody>
        </table></div> : <p className="m-0 text-[13px] text-muted-foreground">Chưa có terminal nào.</p>}
      </div>
    </div>
    <div className="mt-3 border-t border-border pt-3">
      <h4 className="m-0 mb-2 text-[13px] font-semibold">Token &amp; chi phí</h4>
      <UsageView usage={usage} />
    </div>
  </section>;
}
