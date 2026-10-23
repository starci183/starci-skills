import type { AttemptDetailV2 } from '../../contract';
import { Link } from '@heroui/react';
import type { Concept } from '../concept';
import { StatusChip } from '../status-chip';
import { PathLink } from '../path-link';
import { UsageView } from '../usage-view';
import { CopyId, InfoChip, InfoRow, ShaId } from '../infra/rows';
import type { Tone } from '../status';
import { t } from '../../i18n/t';

/** The business concept id (C6) under which the where-it-ran card is filed; it is stamped on data-concept so the rendered DOM traces back to its spec. */
export const concept: Concept = 'C6';

const bytes = (n: number) => {
  if (n >= 1048576) return `${(n / 1048576).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${n} B`;
};
const isFile = (rel: string) => !/[\\/]$/.test(rel) && /\.[a-z0-9]+$/i.test(rel);

type Where = AttemptDetailV2['where'];

const jobToneProps = (status: string): { tone?: Tone } => {
  if (status === 'failed') return { tone: 'failed' };
  if (status === 'awaiting_owner') return { tone: 'owner' };
  if (status === 'succeeded' || status === 'passed') return { tone: 'success' };
  return {};
};

const WorktreeValue = ({ w }: Readonly<{ w: Where }>) => {
  if (!w.worktree) return <span className="text-muted-foreground">{t('Checkout location not recorded')}</span>;
  return <span className="inline-flex flex-wrap items-center gap-2"><PathLink path={w.worktree} kind="dir" />{w.worktreeRemovedAt ? <InfoChip tone="skipped">{t('removed')}</InfoChip> : null}</span>;
};

const AssignedPaths = ({ w }: Readonly<{ w: Where }>) => {
  if (!w.ownedPaths.length) return <span className="text-muted-foreground">{w.scopeSource === 'contract' ? t('Captured write scope is empty') : t('Write scope not recorded')}</span>;
  return <ul className="m-0 flex list-none flex-col gap-2 p-0">
    {w.ownedPaths.map((p) => <li key={p.rel} className="flex flex-col gap-1">
      <code className="font-mono text-[11px] text-muted-foreground [overflow-wrap:anywhere]">{p.rel}</code>
      <PathLink path={p.abs} kind={isFile(p.rel) ? 'file' : 'dir'} />
    </li>)}
  </ul>;
};

const SessionRecord = ({ attempt }: Readonly<{ attempt: AttemptDetailV2 }>) => {
  const transcript = attempt.terminal?.transcript ?? null;
  if (!transcript) return <span className="text-muted-foreground">{t('no transcript yet')}</span>;
  const transcriptHref = `#/a/${encodeURIComponent(attempt.project)}/${encodeURIComponent(String(attempt.id))}?step=run`;
  return <span className="inline-flex flex-wrap items-center gap-2"><Link href={transcriptHref}>{t('View transcript')}</Link>
    <span className="text-xs text-muted-foreground">{bytes(transcript.bytes)}{transcript.archived ? t(' · archived') : ''}</span>
    {attempt.terminal?.live ? <StatusChip status="running" label={t('running')} /> : null}</span>;
};

/** S8: "Where it ran & resources" — every host location, id and resource the attempt touched. */
export const AttemptWhereCard = ({ attempt }: Readonly<{ attempt: AttemptDetailV2 }>) => {
  const w = attempt.where;
  return <section className="min-w-0" aria-label={t('Where it ran and resources')}>
    <h3 className="m-0 mb-2 text-sm font-semibold">{t('Where it ran & resources')}</h3>
    <div className="grid gap-x-8 lg:grid-cols-2">
      <dl className="m-0">
        <InfoRow label="Repo (checkout)">
          <span className="inline-flex flex-wrap items-center gap-2"><PathLink path={w.repo} kind="dir" />{w.mainCheckout ? <InfoChip>{t('main checkout')}</InfoChip> : null}</span>
        </InfoRow>
        <InfoRow label="Worktree">
          <WorktreeValue w={w} />
        </InfoRow>
        <InfoRow label={t('Assigned paths')}>
          <AssignedPaths w={w} />
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
          <span className="inline-flex flex-wrap items-center gap-2"><CopyId value={w.job} />{w.jobStatus ? <InfoChip {...jobToneProps(w.jobStatus)}>{w.jobStatus}</InfoChip> : null}</span>
        </InfoRow>
        <InfoRow label={t('Session record')}>
          <SessionRecord attempt={attempt} />
        </InfoRow>
      </dl>
    </div>
    <p className="mt-2 text-xs text-muted-foreground">{t('Locations and launch IDs come from this dispatch; assigned paths come from its captured contract. Job status is current.')}</p>
    <div className="mt-3 border-t border-border pt-3">
      <h4 className="m-0 mb-2 text-[13px] font-semibold">{t('Tokens & cost')}</h4>
      <UsageView usage={attempt.usage} />
    </div>
  </section>;
};
