import { ArrowUpRight, Check, Clock3, Star } from 'lucide-react';
import { useApiQuery } from '../../api/query';
import { ConceptBlock, type Concept } from '../../components/concept';
import { Advanced } from '../../components/motion';
import { Drawer } from '../../components/drawer';
import { StateChip } from '../../components/state-chip';
import { TimeAgo } from '../../components/time-ago';
import type { DecisionRow, Ref, DecisionDetail } from '../../contract';
import { formatAbsolute } from '../../i18n/vi';
import { t } from '../../i18n/t';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { ReadQuality } from '../../components/charts/chart-card';

export const concept: Concept = 'C12';

type Evidence = Ref | { text: string };

const actor = (value: string | null | undefined) => value === 'owner' ? t('The owner') : value === 'kernel' ? 'Kernel' : value === 'supervisor' ? 'Supervisor' : value ?? t('Unknown');
const channel = (value: DecisionRow['channel']) => ({ 'kernel-seat': t('Kernel seat'), 'supervisor-seat': t('Supervisor seat'), telegram: 'Telegram', 'serve-ask': t('the ask channel') } as Record<string, string>)[value ?? ''] ?? t('Unknown');
const isRef = (item: Evidence): item is Ref => 'href' in item;

function EvidenceList({ items, credential }: Readonly<{ items: Evidence[]; credential: boolean }>) {
  if (!items.length) return <p className="text-sm text-muted-foreground">{t('No linked evidence yet.')}</p>;
  return <ul className="flex flex-col gap-2">{items.map((item, index) => <li key={`${isRef(item) ? item.href : item.text}-${index}`}>
    {isRef(item) ? <a href={item.href} className="inline-flex max-w-full items-center gap-1 rounded-md text-sm font-medium text-primary underline-offset-4 hover:underline">
      <span className="truncate">{item.kind} · {item.id}</span><ArrowUpRight className="size-3.5 shrink-0" aria-hidden="true" />
    </a> : <span className="text-sm text-muted-foreground">{credential ? t('Credential details are hidden.') : item.text}</span>}
  </li>)}</ul>;
}

export function DecisionDrawer({ id, store, ledger, onClose }: Readonly<{ id: string | null; store: string | null; ledger: string | null; onClose: () => void }>) {
  const params = new URLSearchParams();
  if (store) params.set('store', store);
  if (ledger) params.set('ledger', ledger);
  const url = `/api/decisions/${encodeURIComponent(id ?? '')}${params.size ? `?${params}` : ''}`;
  const detail = useApiQuery<DecisionDetail>(url, { topics: ['decisions'], enabled: Boolean(id), intervalMs: 20_000 });
  const row = detail.data;
  const credential = row?.kind === 'credential-missing';
  return <Drawer open={Boolean(id)} onOpenChange={open => { if (!open) onClose(); }} title={id ? t('Decision {id}', { id }) : t('Decision')} description={t('Read-only record · answer through the shown channel')}>
    <ConceptBlock concept="C12" className="flex flex-col gap-6" aria-live="polite">
      {id ? <ReadQuality query={detail} url={url} /> : null}
      {row && <>
        <div className="flex flex-wrap items-center gap-2"><StateChip state={row.ui} /><Badge variant="outline">{row.kind}</Badge><span className="text-xs text-muted-foreground">{row.status}</span></div>
        <div><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('Summary')}</p>
          <p className="mt-2 break-words text-sm leading-relaxed">{credential ? t('Credential request · content hidden.') : row.summary}</p></div>
        <dl className="grid grid-cols-1 gap-4 border-y py-4 text-sm sm:grid-cols-2">
          <div><dt className="text-muted-foreground">{t('Decider')}</dt><dd className="font-medium">{actor(row.decider)}</dd></div>
          <div><dt className="text-muted-foreground">{t('Due')}</dt><dd className={row.overdue ? 'font-medium text-destructive' : ''}>{formatAbsolute(row.dueAt)}</dd></div>
        </dl>
        {row.project && row.wf && <Button variant="link" size="sm" asChild className="h-auto justify-start self-start px-0"><a href={`#/w/${encodeURIComponent(row.project)}/${encodeURIComponent(row.wf)}?tab=decisions`}>{t('View workflow {wf}', { wf: row.wf })}<ArrowUpRight className="size-3.5" aria-hidden="true" /></a></Button>}
        <section className="flex flex-col gap-2"><h3 className="font-semibold">{t('Recorded options')}</h3>
          {row.options?.length ? <ul className="flex flex-col divide-y">{row.options.map((option, index) => <li key={`${option.key}-${index}`} className="flex flex-wrap items-center gap-2 py-3 text-sm">
            {option.recommended && <Star className="size-4 text-muted-foreground" fill="currentColor" aria-label={t('Recommended')} />}
            <span className="font-medium">{option.key}</span><span className="text-muted-foreground">{option.verb}</span>
            {option.recommended && <span className="text-xs text-muted-foreground">{t('Recommended')}</span>}
          </li>)}</ul> : <p className="text-sm text-muted-foreground">{t('No options recorded yet.')}</p>}
        </section>
        <section className="flex flex-col gap-2"><h3 className="font-semibold">{t('Outcome')}</h3>{row.resolution ? <div className="border-l-2 pl-3 text-sm"><p className="flex items-center gap-2 font-medium"><Check className="size-4" aria-hidden="true" />{row.resolution.verb ?? t('Decided')}</p><p className="mt-1 text-muted-foreground">{t('By {actor}', { actor: actor(row.resolution.by) })} · {formatAbsolute(row.resolvedAt)}</p></div>
          : <p className="flex items-center gap-2 text-sm text-muted-foreground"><Clock3 className="size-4" aria-hidden="true" />{t('Waiting for a decision via {channel}.', { channel: channel(row.channel) })}</p>}</section>
        <Advanced summary={t('Channel, opened time, evidence and history')}>
          <div className="flex flex-col gap-6">
            <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
              <div><dt className="text-muted-foreground">{t('Answer channel')}</dt><dd className="font-medium">{channel(row.channel)}</dd></div>
              <div><dt className="text-muted-foreground">{t('Opened at')}</dt><dd>{formatAbsolute(row.openedAt)} · <TimeAgo at={row.openedAt} /></dd></div>
              {row.claim && <div className="sm:col-span-2"><dt className="text-muted-foreground">{t('Claimed for handling')}</dt><dd>{actor(row.claim.by)} · {formatAbsolute(row.claim.at)} · {t('expires {at}', { at: formatAbsolute(row.claim.expiresAt) })}</dd></div>}
            </dl>
        <section className="flex flex-col gap-2"><h3 className="font-semibold">{t('Evidence')}</h3><EvidenceList items={row.evidence ?? []} credential={credential} /></section>
        <section className="flex flex-col gap-2"><h3 className="font-semibold">{t('Claim and escalation history')}</h3>
          {row.history?.length ? <ol className="flex flex-col gap-2 border-l pl-4">{row.history.map((entry, index) => <li key={`${entry.kind}-${entry.at}-${index}`} className="relative text-sm before:absolute before:-left-[1.28rem] before:top-1.5 before:size-2 before:rounded-full before:bg-primary">
            <div className="flex flex-wrap items-center gap-2"><span className="font-medium">{entry.kind === 'decision-escalated' ? t('Escalated') : entry.kind === 'decision-opened' ? t('Decision opened') : entry.kind}</span>
              <span className="text-xs text-muted-foreground">{formatAbsolute(entry.at)}</span></div>
            <p className="text-muted-foreground">{entry.from && entry.to ? `${actor(entry.from)} → ${actor(entry.to)}` : actor(entry.by)}</p>
          </li>)}</ol> : <p className="text-sm text-muted-foreground">{t('No history events yet.')}</p>}
        </section>
          </div>
        </Advanced>
      </>}
    </ConceptBlock>
  </Drawer>;
}
