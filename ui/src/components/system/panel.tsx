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

/** Names the frame concept this module belongs to, for the collapsible system panel frame. */
export const concept: Concept = 'frame';

type RefLinkProps = Readonly<{ refValue: Ref | null }>;
type BlobLinkButtonProps = Readonly<{ blob: BlobLink | null; label: string }>;
type QueryReadNoticeProps<T> = Readonly<{ query: QuerySnapshot<T>; url?: string | undefined }>;
type QueryReadDetailsProps<T> = Readonly<{ query: QuerySnapshot<T> }>;
type QueryViewProps<T> = Readonly<{ query: QuerySnapshot<T>; url?: string | undefined; children: (data: T) => ReactNode; empty?: string }>;
type PanelProps = Readonly<{ title: string; summary?: string | undefined; ui?: UiState | undefined; defaultOpen?: boolean; concept: Concept; children: ReactNode }>;
type QueryPanelProps<T> = Readonly<{ title: string; summary?: string | undefined; ui?: UiState | undefined; defaultOpen?: boolean; concept: Concept; query: QuerySnapshot<T>; url: string; children: (data: T) => ReactNode }>;
type MetricProps = Readonly<{ label: string; value: ReactNode; help?: string }>;
type StateRow = Readonly<{ ui: UiState }>;

/** True for a state that needs the owner's eye: failed or warning. */
export const isIssue = (state: UiState | null | undefined) => state === 'bad' || state === 'warn';
/** Shows a missing or empty value as a dash instead of a blank cell, so absence is visible. */
export const dash = (value: string | number | boolean | null | undefined): string => value == null || value === '' ? '—' : String(value);
/** Formats an epoch instant as an absolute time, or a dash when it was never recorded. */
export const at = (value: number | null | undefined) => value == null ? '—' : formatAbsolute(value);
/** Formats a count in the viewer's locale, or a dash when it was not observed. */
export const number = (value: number | null | undefined, digits = 0) => value == null ? '—' : new Intl.NumberFormat('vi-VN', { maximumFractionDigits: digits }).format(value);

/** Rolls a list of rows up to the single worst state among them, so a panel header reflects its rows. */
export const stateOf = (rows: readonly StateRow[]): UiState => {
  if (!rows.length) return 'unknown';
  const priority: UiState[] = ['bad', 'warn', 'unknown', 'running', 'waiting', 'ok', 'done'];
  return priority.find((state) => rows.some((row) => row.ui === state)) ?? 'unknown';
};

/** Links to a referenced record by its id, or a dash when there is none. */
export const RefLink = ({ refValue }: RefLinkProps) => {
  return refValue
    ? <Link className="inline-flex items-center gap-1" href={refValue.href}>{refValue.id}<ArrowUpRight size={12} aria-hidden="true" /></Link>
    : <span>—</span>;
};

/** Opens a stored blob in a new tab, or says that none was recorded yet. */
export const BlobLinkButton = ({ blob, label }: BlobLinkButtonProps) => {
  return blob
    ? <Link className="inline-flex items-center gap-1" href={blob.href} target="_blank" rel="noreferrer">{label}<ExternalLink size={12} aria-hidden="true" /></Link>
    : <span className="text-muted-foreground">{t('No {label} yet', { label: label.toLowerCase() })}</span>;
};

/** The headline of a read notice: a failed read (with or without an earlier result to fall back on) or sources out of sync. */
const readNoticeText = (error: string | null | undefined, hasData: boolean, stale: readonly string[]): string => {
  if (!error) return t('Source out of sync: {list}', { list: stale.join(', ') });
  return hasData ? t('The source is failing; showing the last read. {error}', { error }) : t('Could not read the source: {error}', { error });
};

/** Tells the reader that a query failed or only partly answered, with a retry and the per-source read details. */
export const QueryReadNotice = <T,>({ query, url }: QueryReadNoticeProps<T>) => {
  const stale = partialSources(query);
  const sources = query.errorMeta?.sources ?? query.meta?.sources ?? [];
  if (!query.error && !stale.length) return null;
  const retryProps = url ? { onRetry: () => refreshQuery(url) } : {};
  return <div className="mb-3 flex flex-col gap-3">
    <FeedbackState error {...retryProps}>{readNoticeText(query.error, query.data != null, stale)}</FeedbackState>
    <Advanced title={t('Read source details')} keepMounted className="text-xs text-muted-foreground"><p>{t('Last successful read {at}', { at: at(query.observedAt) })}{query.errorCode ? ` · ${query.errorCode}` : ''}</p>
      {sources.map(source => <div key={`${source.db}:${source.rel}`} className="mt-2 break-words">{source.db}:{source.rel} · {source.availability ?? t('Unknown')} · {t('Observed {at}', { at: at(source.at) })} · {t('Read at')} {at(source.readAt)}{source.error ? <SourceWarning>{source.error}</SourceWarning> : null}</div>)}
      {stale.length ? <p>{t('Source out of sync: {list}', { list: stale.join(', ') })}</p> : null}
    </Advanced>
  </div>;
};

/** Lists every source a query read from with its availability and read times, for auditing what the numbers rest on. */
export const QueryReadDetails = <T,>({ query }: QueryReadDetailsProps<T>) => {
  if (!query.meta) return null;
  return <Advanced title={t('Read source details')} summary={t('Read observed {at}', { at: at(query.observedAt) })} className="text-xs text-muted-foreground">
    <p>{t('Response assembled {at}', { at: at(query.meta.at) })}</p>
    <ul className="mt-2 space-y-2">{query.meta.sources.map(source => <li key={`${source.db}:${source.rel}`} className="break-words">
      <span className="font-mono">{source.db}:{source.rel}</span> · {source.availability ?? t('Unknown')} · {t('Observed {at}', { at: at(source.at) })} · {t('Read at')} {at(source.readAt)}
      {source.error && <SourceWarning>{source.error}</SourceWarning>}
    </li>)}</ul>
  </Advanced>;
};

/** Renders a query's data through `children`, or the loading, empty or failure notice when there is none yet. */
export const QueryView = <T,>({ query, url, children, empty = t('No data yet.') }: QueryViewProps<T>) => {
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
};

/** A collapsible system section whose header carries the rolled-up state and opens by itself when something failed. */
export const Panel = ({ title, summary, ui, defaultOpen = false, concept: blockConcept, children }: PanelProps) => {
  return <ConceptBlock concept={blockConcept}>
    <Advanced key={isIssue(ui) ? 'issue' : 'calm'} variant="card" defaultOpen={defaultOpen || ui === 'bad'} summary={summary}
      title={<span className="inline-flex flex-wrap items-center gap-3">{title}{ui && <StateChip state={ui} compact />}</span>}>
      {children}
    </Advanced>
  </ConceptBlock>;
};

/** A Panel fed by one query: it shows the read notice and source details around the data, or a loading card before any data. */
export const QueryPanel = <T,>({ title, summary, ui, defaultOpen = false, concept: blockConcept, query, url, children }: QueryPanelProps<T>) => {
  if (query.data == null) return <ConceptBlock concept={blockConcept}>
    <Card><Card.Header><Card.Title>{title}</Card.Title></Card.Header><Card.Content><QueryView query={query} url={url}>{children}</QueryView></Card.Content></Card>
  </ConceptBlock>;
  return <>
    <QueryReadNotice query={query} url={url} />
    <Panel title={title} summary={summary} ui={ui} defaultOpen={defaultOpen} concept={blockConcept}><div className="flex min-w-0 flex-col gap-4">{Array.isArray(query.data) && !query.data.length && (query.error || partialSources(query).length)
      ? <FeedbackState>{t('No matching results from the available sources.')}</FeedbackState>
      : children(query.data)}<QueryReadDetails query={query} /></div></Panel>
  </>;
};

/** One headline number with its label and an optional explanatory footer. */
export const Metric = ({ label, value, help }: MetricProps) => {
  return <Card className="min-w-0 gap-2">
    <Card.Header><Card.Description className="text-xs">{label}</Card.Description></Card.Header>
    <Card.Content className="text-xl font-semibold tabular-nums">{value}</Card.Content>
    {help && <Card.Footer className="text-xs text-muted-foreground">{help}</Card.Footer>}
  </Card>;
};
