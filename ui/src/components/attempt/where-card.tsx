import type { AttemptDetailV2 } from '../../contract';
import type { Concept } from '../concept';
import { StatusChip } from '../status-chip';
import { PathLink } from '../path-link';
import { UsageView } from '../usage-view';
import { CopyId, InfoChip, InfoRow, ShaId } from '../infra/rows';
import { t } from '../../i18n/t';
import { AdmissionDetails } from './admission';

export const concept: Concept = 'C6';

const bytes = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : n >= 1024 ? `${(n / 1024).toFixed(1)} KB` : `${n} B`);
const isFile = (rel: string) => !/[\\/]$/.test(rel) && /\.[a-z0-9]+$/i.test(rel);

/** S8: "Where it ran & resources" — every host location, id and resource the attempt touched. */
export function AttemptWhereCard({ attempt }: { attempt: AttemptDetailV2 }) {
  const w = attempt.where;
  const transcript = attempt.terminal?.transcript ?? null;
  const transcriptHref = `#/a/${encodeURIComponent(attempt.project)}/${encodeURIComponent(String(attempt.id))}?step=run`;
  return <section className="min-w-0" aria-label={t('Where it ran and resources')}>
    <h3 className="m-0 mb-2 text-sm font-semibold">{t('Where it ran & resources')}</h3>
    <div className="grid gap-x-8 lg:grid-cols-2">
      <dl className="m-0">
        <InfoRow label="Repo (checkout)">
          <span className="inline-flex flex-wrap items-center gap-2"><PathLink path={w.repo} kind="dir" />{w.mainCheckout ? <InfoChip>{t('main checkout')}</InfoChip> : null}</span>
        </InfoRow>
        <InfoRow label="Worktree">
          {w.worktree ? <span className="inline-flex flex-wrap items-center gap-2"><PathLink path={w.worktree} kind="dir" />{w.worktreeRemovedAt ? <InfoChip tone="skipped">{t('removed')}</InfoChip> : null}</span>
            : <span className="text-muted-foreground">{t('Checkout location not recorded')}</span>}
        </InfoRow>
        <InfoRow label={t('Assigned paths')}>
          {w.ownedPaths.length ? <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {w.ownedPaths.map((p) => <li key={p.rel} className="flex flex-col gap-1">
              <code className="font-mono text-[11px] text-muted-foreground [overflow-wrap:anywhere]">{p.rel}</code>
              <PathLink path={p.abs} kind={isFile(p.rel) ? 'file' : 'dir'} />
            </li>)}
          </ul> : <span className="text-muted-foreground">{w.scopeSource === 'contract' ? t('Captured write scope is empty') : t('Write scope not recorded')}</span>}
        </InfoRow>
        <InfoRow label={t('Ledger file')}><PathLink path={w.ledgerFile} kind="file" /></InfoRow>
        <InfoRow label={t('Blob store')}><PathLink path={w.blobRoot} kind="dir" /></InfoRow>
        <InfoRow label="Runtime"><PathLink path={w.runtimeRoot} kind="dir" /></InfoRow>
        <InfoRow label={t('Branch')}><CopyId value={w.branch} /></InfoRow>
        <InfoRow label="SHA">
          <span className="flex flex-col gap-1">
            <span className="inline-flex flex-wrap items-center gap-2"><span className="w-14 text-xs text-muted-foreground">{t('base')}</span><ShaId sha={w.baseSha} /></span>
            <span className="inline-flex flex-wrap items-center gap-2"><span className="w-14 text-xs text-muted-foreground">{t('head')}</span><ShaId sha={w.headSha} /></span>
            <span className="inline-flex flex-wrap items-center gap-2"><span className="w-14 text-xs text-muted-foreground">{t('integrated')}</span><ShaId sha={w.integratedSha} /></span>
          </span>
        </InfoRow>
      </dl>
      <dl className="m-0">
        <InfoRow label={t('Host / agent')}>{[w.host, w.agent, w.provider].filter(Boolean).join(' · ') || '—'}</InfoRow>
        <InfoRow label="Profile / pool">{[w.profile, w.pool].filter(Boolean).join(' · ') || '—'}</InfoRow>
        <InfoRow label="Terminal"><CopyId value={w.terminalHandle} /></InfoRow>
        <InfoRow label="Orca run"><CopyId value={w.runId} /></InfoRow>
        <InfoRow label="Orca task"><CopyId value={w.taskId} /></InfoRow>
        <InfoRow label="Orca dispatch"><CopyId value={w.dispatchId} /></InfoRow>
        <InfoRow label="Agent node"><CopyId value={w.agentNode} /></InfoRow>
        <InfoRow label={t('Parent agent')}><CopyId value={w.parentAgent} /></InfoRow>
        <InfoRow label="Trace span"><CopyId value={w.traceSpan} /></InfoRow>
        <InfoRow label={t('Job · current status')}>
          <span className="inline-flex flex-wrap items-center gap-2"><CopyId value={w.job} />{w.jobStatus ? <InfoChip tone={w.jobStatus === 'failed' ? 'failed' : w.jobStatus === 'awaiting_owner' ? 'owner' : w.jobStatus === 'succeeded' || w.jobStatus === 'passed' ? 'success' : undefined}>{w.jobStatus}</InfoChip> : null}</span>
        </InfoRow>
        <InfoRow label={t('Session record')}>
          {transcript ? <span className="inline-flex flex-wrap items-center gap-2"><a className="text-primary underline-offset-2 hover:underline" href={transcriptHref}>{t('View transcript')}</a>
            <span className="text-xs text-muted-foreground">{bytes(transcript.bytes)}{transcript.archived ? t(' · archived') : ''}</span>
            {attempt.terminal?.live ? <StatusChip status="running" label={t('running')} /> : null}</span>
            : <span className="text-muted-foreground">{t('no transcript yet')}</span>}
        </InfoRow>
      </dl>
    </div>
    <p className="mt-2 text-xs text-muted-foreground">{t('Locations and launch IDs come from this dispatch; assigned paths come from its captured contract. Job status is current.')}</p>
    <AdmissionDetails attempt={attempt} />
    <div className="mt-3 border-t border-border pt-3">
      <h4 className="m-0 mb-2 text-[13px] font-semibold">{t('Tokens & cost')}</h4>
      <UsageView usage={attempt.usage} />
    </div>
  </section>;
}
