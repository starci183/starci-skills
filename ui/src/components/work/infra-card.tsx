import type { Usage, WorkflowWhere } from '../../contract';
import type { Concept } from '../concept';
import { PathLink } from '../path-link';
import { UsageView } from '../usage-view';
import { CopyId, InfoChip, InfoRow } from '../infra/rows';
import { t } from '../../i18n/t';
import { Card, CardContent } from '../ui/card';

export const concept: Concept = 'C15';

/** S8: where the workflow runs on the host (repos, work tree, ledger, blobs, seat, terminals, worktrees) and its token/cost usage. */
export function WorkflowInfraCard({ where, usage }: Readonly<{ where: WorkflowWhere; usage: Usage }>) {
  return <section aria-label={t('Infrastructure and cost')}><Card size="sm"><CardContent>
    <h3 className="m-0 mb-3 text-sm font-semibold">{t('Infrastructure & cost')}</h3>
    <div className="grid gap-x-8 lg:grid-cols-2">
      <dl className="m-0">
        <InfoRow label="Repo">
          {where.repos.length ? <ul className="m-0 flex list-none flex-col gap-2 p-0">{where.repos.map((r) => <li key={r.name} className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{r.name}</span><InfoChip>{r.role}</InfoChip><PathLink path={r.root} kind="dir" /></li>)}</ul> : <span className="text-muted-foreground">—</span>}
        </InfoRow>
        <InfoRow label="Work tree"><PathLink path={where.workTree} kind="dir" /></InfoRow>
        <InfoRow label={t('Ledger file')}><PathLink path={where.ledgerFile} kind="file" /></InfoRow>
        <InfoRow label={t('Blob store')}><PathLink path={where.blobRoot} kind="dir" /></InfoRow>
        <InfoRow label="Runtime"><PathLink path={where.runtimeRoot} kind="dir" /></InfoRow>
        <InfoRow label="Kernel seat"><CopyId value={where.kernelSeat} /></InfoRow>
        <InfoRow label="Worktree">
          <span className="inline-flex flex-wrap gap-2"><InfoChip tone={where.worktreesOpen ? 'running' : 'queued'}>{t('{n} open', { n: where.worktreesOpen })}</InfoChip><InfoChip tone="skipped">{t('{n} removed', { n: where.worktreesRemoved })}</InfoChip></span>
        </InfoRow>
      </dl>
      <div>
        <h4 className="m-0 mb-2 text-[13px] font-semibold">{t('Terminal ({n})', { n: where.terminals.length })}</h4>
        {where.terminals.length ? <div className="overflow-x-auto"><table className="w-full min-w-[420px] border-collapse text-xs">
          <thead><tr className="text-left text-muted-foreground">{['Handle', t('Role'), t('Attempt'), 'PID', t('State')].map((h) => <th key={h} className="border-b border-border px-2 py-2 font-medium">{h}</th>)}</tr></thead>
          <tbody>{where.terminals.map((term) => <tr key={term.handle} className="border-b border-border last:border-b-0">
            <td className="px-2 py-2"><CopyId value={term.handle} /></td><td className="px-2 py-2">{term.role}</td>
            <td className="px-2 py-2 font-mono">{term.attempt != null ? `#${term.attempt}` : '—'}</td>
            <td className="px-2 py-2 font-mono">{term.pid ?? '—'}</td>
            <td className="px-2 py-2">{term.closedAt ? <InfoChip tone="skipped">{t('closed')}</InfoChip> : <InfoChip tone="running">{t('open')}</InfoChip>}</td>
          </tr>)}</tbody>
        </table></div> : <p className="m-0 text-[13px] text-muted-foreground">{t('No terminals yet.')}</p>}
      </div>
    </div>
    <div className="mt-3 border-t border-border pt-3">
      <h4 className="m-0 mb-2 text-[13px] font-semibold">{t('Tokens & cost')}</h4>
      <UsageView usage={usage} />
    </div>
  </CardContent></Card></section>;
}
