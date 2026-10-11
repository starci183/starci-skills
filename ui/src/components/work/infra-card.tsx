import type { Usage, WorkflowWhere } from '../../contract';
import type { Concept } from '../concept';
import { PathLink } from '../path-link';
import { UsageView } from '../usage-view';
import { CopyId, InfoChip, InfoRow } from '../infra/rows';
import { formatAbsolute } from '../../i18n/vi';
import { t } from '../../i18n/t';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Table } from '../ui/table';

export const concept: Concept = 'C15';

/** Recorded storage and dispatch custody; terminal records do not establish current process liveness. */
export function WorkflowInfraCard({ where, usage, embedded = false }: Readonly<{ where: WorkflowWhere; usage: Usage; embedded?: boolean }>) {
  return <section aria-label={t('Infrastructure and cost')} className="min-w-0">
    <Card size="sm" inset={embedded ? 'none' : undefined} variant={embedded ? 'transparent' : undefined}>
      <CardHeader><CardTitle><h3>{t('Infrastructure & cost')}</h3></CardTitle></CardHeader>
      <CardContent className="flex min-w-0 flex-col gap-4">
        <p className="text-xs text-muted-foreground">{t('Recorded paths and dispatch custody. Current process liveness is unknown.')}</p>
        <div className="grid min-w-0 gap-6 min-[760px]:gap-8 lg:grid-cols-2">
          <dl className="m-0 min-w-0">
            <InfoRow label="Repo">
              {where.repos.length ? <ul className="m-0 flex list-none flex-col gap-2 p-0">{where.repos.map(repo => <li key={repo.name} className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="break-words font-medium">{repo.name}</span><InfoChip>{repo.role}</InfoChip><PathLink path={repo.root} kind="dir" />
              </li>)}</ul> : <span className="text-muted-foreground">{t('not recorded')}</span>}
            </InfoRow>
            <InfoRow label="Work tree"><PathLink path={where.workTree} kind="dir" /></InfoRow>
            <InfoRow label={t('Ledger file')}><PathLink path={where.ledgerFile} kind="file" /></InfoRow>
            <InfoRow label={t('Blob store')}><PathLink path={where.blobRoot} kind="dir" /></InfoRow>
            <InfoRow label="Runtime"><PathLink path={where.runtimeRoot} kind="dir" /></InfoRow>
            <InfoRow label="Kernel seat"><CopyId value={where.kernelSeat} /></InfoRow>
            <InfoRow label={t('Recorded worktrees')}>
              <span className="flex flex-wrap gap-x-3 gap-y-1">{t('{n} open', { n: where.worktreesOpen })}<span>{t('{n} removed', { n: where.worktreesRemoved })}</span></span>
            </InfoRow>
          </dl>
          <section className="flex min-w-0 flex-col gap-4">
            <h4 className="text-sm font-semibold">{t('Terminal ({n})', { n: where.terminals.length })}</h4>
            {where.terminals.length ? <Table variant="secondary"><Table.ScrollContainer><Table.Content aria-label={t('Terminal ({n})', { n: where.terminals.length })} className="min-w-[520px]">
              <Table.Header>
                <Table.Column id="handle" isRowHeader>Handle</Table.Column>
                <Table.Column id="custody">{t('Recorded custody')}</Table.Column>
                <Table.Column id="times">{t('Recorded times')}</Table.Column>
                <Table.Column id="state">{t('Recorded state')}</Table.Column>
              </Table.Header>
              <Table.Body>{where.terminals.map(term => <Table.Row id={`${term.attempt}:${term.handle}:${term.openedAt}`} key={`${term.attempt}:${term.handle}:${term.openedAt}`}>
                <Table.Cell className="align-top"><div className="flex min-w-0 flex-col gap-2"><CopyId value={term.handle} /><span className="text-xs text-muted-foreground">{t('Role')}: {term.role}</span></div></Table.Cell>
                <Table.Cell className="align-top"><div className="flex flex-col gap-2 text-xs"><span>{term.attempt != null ? t('Attempt #{id}', { id: term.attempt }) : t('No attempt association recorded')}</span><span className="text-muted-foreground">PID: <span className="font-mono">{term.pid ?? t('not recorded')}</span></span></div></Table.Cell>
                <Table.Cell className="align-top"><div className="flex flex-col gap-2 text-xs text-muted-foreground"><span>{t('Opened {at}', { at: formatAbsolute(term.openedAt) })}</span>{term.closedAt != null && <span>{t('Closed {at}', { at: formatAbsolute(term.closedAt) })}</span>}</div></Table.Cell>
                <Table.Cell className="align-top"><InfoChip>{term.closedAt != null ? t('closed') : t('open')}</InfoChip></Table.Cell>
              </Table.Row>)}</Table.Body>
            </Table.Content></Table.ScrollContainer></Table> : <p className="text-sm text-muted-foreground">{t('No terminals yet.')}</p>}
          </section>
        </div>
        <section className="flex min-w-0 flex-col gap-4 border-t border-border pt-4">
          <h4 className="text-sm font-semibold">{t('Tokens & cost')}</h4>
          <UsageView usage={usage} />
        </section>
      </CardContent>
    </Card>
  </section>;
}
