import type { ReactNode } from 'react';
import { Card, Link } from '@heroui/react';
import { ArrowUpRight, ExternalLink } from 'lucide-react';
import { Advanced } from '../motion';
import { ConceptBlock, type Concept } from '../concept';
import { FeedbackState, PageSkeleton, SourceWarning } from '../feedback-state';
import { StateChip } from '../state-chip';
import { partialSources } from '../charts/chart-card';
import { refreshQuery, type QuerySnapshot } from '../../api/query';
import type { BlobLink, Ref, UiState } from '../../contract';
import { formatAbsolute } from '../../i18n/vi';
import { t } from '../../i18n/t';

export const concept: Concept = 'frame';

export const isIssue = (state: UiState | null | undefined) => state === 'bad' || state === 'warn';
export const dash = (value: string | number | boolean | null | undefined): string => value == null || value === '' ? '—' : String(value);
export const at = (value: number | null | undefined) => value == null ? '—' : formatAbsolute(value);
export const number = (value: number | null | undefined, digits = 0) => value == null ? '—' : new Intl.NumberFormat('vi-VN', { maximumFractionDigits: digits }).format(value);

export function stateOf(rows: { ui: UiState }[]): UiState {
  if (!rows.length) return 'unknown';
  const priority: UiState[] = ['bad', 'warn', 'unknown', 'running', 'waiting', 'ok', 'done'];
  return priority.find((state) => rows.some((row) => row.ui === state)) ?? 'unknown';
}

export function RefLink({ refValue }: { readonly refValue: Ref | null }) {
  return refValue
    ? <Link className="inline-flex items-center gap-1" href={refValue.href}>{refValue.id}<ArrowUpRight size={12} aria-hidden="true" /></Link>
    : <span>—</span>;
}

export function BlobLinkButton({ blob, label }: { readonly blob: BlobLink | null; readonly label: string }) {
  return blob
    ? <Link className="inline-flex items-center gap-1" href={blob.href} target="_blank" rel="noreferrer">{label}<ExternalLink size={12} aria-hidden="true" /></Link>
    : <span className="text-muted-foreground">{t('No {label} yet', { label: label.toLowerCase() })}</span>;
}

export function QueryReadNotice<T>({ query, url }: { readonly query: QuerySnapshot<T>; readonly url?: string }) {
  const stale = partialSources(query);
  const sources = query.errorMeta?.sources ?? query.meta?.sources ?? [];
  if (!query.error && !stale.length) return null;
  return <div className="mb-3 flex flex-col gap-3">
    <FeedbackState error onRetry={url ? () => refreshQuery(url) : undefined}>{query.error
      ? query.data == null ? t('Could not read the source: {error}', { error: query.error }) : t('The source is failing; showing the last read. {error}', { error: query.error })
      : t('Source out of sync: {list}', { list: stale.join(', ') })}</FeedbackState>
    <Advanced title={t('Read source details')} keepMounted className="text-xs text-muted-foreground"><p>{t('Last successful read {at}', { at: at(query.observedAt) })}{query.errorCode ? ` · ${query.errorCode}` : ''}</p>
      {sources.map((source, index) => <div key={`${source.db}:${source.rel}:${index}`} className="mt-2 break-words">{source.db}:{source.rel} · {source.availability ?? t('Unknown')} · {t('Observed {at}', { at: at(source.at) })} · {t('Read at')} {at(source.readAt)}{source.error ? <SourceWarning>{source.error}</SourceWarning> : null}</div>)}
      {stale.length ? <p>{t('Source out of sync: {list}', { list: stale.join(', ') })}</p> : null}
    </Advanced>
  </div>;
}

export function QueryReadDetails<T>({ query }: { readonly query: QuerySnapshot<T> }) {
  if (!query.meta) return null;
  return <Advanced title={t('Read source details')} summary={t('Read observed {at}', { at: at(query.observedAt) })} className="text-xs text-muted-foreground">
    <p>{t('Response assembled {at}', { at: at(query.meta.at) })}</p>
    <ul className="mt-2 space-y-2">{query.meta.sources.map((source, index) => <li key={`${source.db}:${source.rel}:${index}`} className="break-words">
      <span className="font-mono">{source.db}:{source.rel}</span> · {source.availability ?? t('Unknown')} · {t('Observed {at}', { at: at(source.at) })} · {t('Read at')} {at(source.readAt)}
      {source.error && <SourceWarning>{source.error}</SourceWarning>}
    </li>)}</ul>
  </Advanced>;
}

export function QueryView<T>({ query, url, children, empty = t('No data yet.') }: { readonly query: QuerySnapshot<T>; readonly url?: string; readonly children: (data: T) => ReactNode; readonly empty?: string }) {
  if (query.data == null) {
    if (query.error || partialSources(query).length) return <QueryReadNotice query={query} url={url} />;
    return query.loading || query.meta == null ? <PageSkeleton label={t('Reading the data…')} /> : <FeedbackState>{empty}</FeedbackState>;
  }
  return <>
    <QueryReadNotice query={query} url={url} />
    {Array.isArray(query.data) && !query.data.length && (query.error || partialSources(query).length)
      ? <FeedbackState>{t('No matching results from the available sources.')}</FeedbackState>
      : children(query.data)}
  </>;
}

export function Panel({ title, summary, ui, defaultOpen = false, concept: blockConcept, children }: { readonly title: string; readonly summary?: string; readonly ui?: UiState; readonly defaultOpen?: boolean; readonly concept: Concept; readonly children: ReactNode }) {
  return <ConceptBlock concept={blockConcept}>
    <Advanced key={isIssue(ui) ? 'issue' : 'calm'} variant="card" defaultOpen={defaultOpen || ui === 'bad'} summary={summary}
      title={<span className="inline-flex flex-wrap items-center gap-3">{title}{ui && <StateChip state={ui} compact />}</span>}>
      {children}
    </Advanced>
  </ConceptBlock>;
}

export function QueryPanel<T>({ title, summary, ui, defaultOpen = false, concept: blockConcept, query, url, children }: { readonly title: string; readonly summary?: string; readonly ui?: UiState; readonly defaultOpen?: boolean; readonly concept: Concept; readonly query: QuerySnapshot<T>; readonly url: string; readonly children: (data: T) => ReactNode }) {
  if (query.data == null) return <ConceptBlock concept={blockConcept}>
    <Card><Card.Header><Card.Title>{title}</Card.Title></Card.Header><Card.Content><QueryView query={query} url={url}>{children}</QueryView></Card.Content></Card>
  </ConceptBlock>;
  return <>
    <QueryReadNotice query={query} url={url} />
    <Panel title={title} summary={summary} ui={ui} defaultOpen={defaultOpen} concept={blockConcept}><div className="flex min-w-0 flex-col gap-4">{Array.isArray(query.data) && !query.data.length && (query.error || partialSources(query).length)
      ? <FeedbackState>{t('No matching results from the available sources.')}</FeedbackState>
      : children(query.data)}<QueryReadDetails query={query} /></div></Panel>
  </>;
}

export function Metric({ label, value, help }: { readonly label: string; readonly value: ReactNode; readonly help?: string }) {
  return <Card className="min-w-0 gap-2">
    <Card.Header><Card.Description className="text-xs">{label}</Card.Description></Card.Header>
    <Card.Content className="text-xl font-semibold tabular-nums">{value}</Card.Content>
    {help && <Card.Footer className="text-xs text-muted-foreground">{help}</Card.Footer>}
  </Card>;
}
