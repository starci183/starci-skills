import type { ReactNode } from 'react';
import { ArrowUpRight, ExternalLink } from 'lucide-react';
import { Advanced } from '../motion';
import { Card, CardContent } from '../ui/card';
import { ConceptBlock, type Concept } from '../concept';
import { FeedbackState, PageSkeleton } from '../feedback-state';
import { StateChip } from '../state-chip';
import { refreshQuery, type QuerySnapshot } from '../../api/query';
import type { BlobLink, Ref, UiState } from '../../contract';
import { formatAbsolute } from '../../i18n/vi';
import { t } from '../../i18n/t';

export const concept: Concept = 'frame';

export const isIssue = (state: UiState | null | undefined) => state === 'bad' || state === 'warn';
export const dash = (value: unknown): string => value == null || value === '' ? '—' : String(value);
export const at = (value: number | null | undefined) => value == null ? '—' : formatAbsolute(value);
export const number = (value: number | null | undefined, digits = 0) => value == null ? '—' : new Intl.NumberFormat('vi-VN', { maximumFractionDigits: digits }).format(value);

export function stateOf(rows: { ui: UiState }[]): UiState {
  if (!rows.length) return 'unknown';
  const priority: UiState[] = ['bad', 'warn', 'unknown', 'running', 'waiting', 'ok', 'done'];
  return priority.find((state) => rows.some((row) => row.ui === state)) ?? 'unknown';
}

export function RefLink({ refValue }: { refValue: Ref | null }) {
  return refValue
    ? <a className="inline-flex items-center gap-1 text-primary hover:underline" href={refValue.href}>{refValue.id}<ArrowUpRight size={12} aria-hidden="true" /></a>
    : <span>—</span>;
}

export function BlobLinkButton({ blob, label }: { blob: BlobLink | null; label: string }) {
  return blob
    ? <a className="inline-flex items-center gap-1 text-primary hover:underline" href={blob.href} target="_blank" rel="noreferrer">{label}<ExternalLink size={12} aria-hidden="true" /></a>
    : <span className="text-muted-foreground">{t('No {label} yet', { label: label.toLowerCase() })}</span>;
}

export function QueryReadNotice<T>({ query, url }: { query: QuerySnapshot<T>; url?: string }) {
  const stale = [...new Set([...(query.meta?.stale ?? []), ...(query.errorMeta?.stale ?? [])])];
  const sources = query.errorMeta?.sources ?? query.meta?.sources ?? [];
  if (!query.error && !stale.length) return null;
  return <div className="mb-3 flex flex-col gap-3">
    <FeedbackState error onRetry={url ? () => refreshQuery(url) : undefined}>{query.error
      ? query.data == null ? t('Could not read the source: {error}', { error: query.error }) : t('The source is failing; showing the last read. {error}', { error: query.error })
      : t('Source out of sync: {list}', { list: stale.join(', ') })}</FeedbackState>
    <details className="text-xs text-muted-foreground"><summary>{t('Read source details')}</summary><p className="mt-2">{t('Last successful read {at}', { at: at(query.observedAt) })}{query.errorCode ? ` · ${query.errorCode}` : ''}</p>
      {sources.map((source, index) => <div key={`${source.db}:${source.rel}:${index}`} className="mt-2 break-words">{source.db}:{source.rel} · {source.availability ?? t('Unknown')} · {t('Observed {at}', { at: at(source.at) })} · {t('Read at')} {at(source.readAt)}{source.error ? <p className="shell-error">{source.error}</p> : null}</div>)}
      {stale.length ? <p>{t('Source out of sync: {list}', { list: stale.join(', ') })}</p> : null}
    </details>
  </div>;
}

export function QueryView<T>({ query, url, children, empty = t('No data yet.') }: { query: QuerySnapshot<T>; url?: string; children: (data: T) => ReactNode; empty?: string }) {
  if (query.data == null) {
    if (query.error) return <QueryReadNotice query={query} url={url} />;
    return query.loading || query.meta == null ? <PageSkeleton label={t('Reading the data…')} /> : <FeedbackState>{empty}</FeedbackState>;
  }
  return <>
    <QueryReadNotice query={query} url={url} />
    {children(query.data)}
  </>;
}

export function Panel({ title, summary, ui = 'unknown', concept: blockConcept, children }: { title: string; summary?: string; ui?: UiState; concept: Concept; children: ReactNode }) {
  return <ConceptBlock concept={blockConcept}>
    <Advanced key={isIssue(ui) ? 'issue' : 'calm'} variant="card" defaultOpen={ui === 'bad'} summary={summary}
      title={<span className="inline-flex items-center gap-3">{title}<StateChip state={ui} compact /></span>}>
      {children}
    </Advanced>
  </ConceptBlock>;
}

export function QueryPanel<T>({ title, summary, ui = 'unknown', concept: blockConcept, query, url, children }: { title: string; summary?: string; ui?: UiState; concept: Concept; query: QuerySnapshot<T>; url: string; children: (data: T) => ReactNode }) {
  if (query.data == null) return <ConceptBlock concept={blockConcept}>
    <Card><CardContent><h2 className="mb-3 text-sm font-medium">{title}</h2><QueryView query={query} url={url}>{children}</QueryView></CardContent></Card>
  </ConceptBlock>;
  const observedState = ui === 'bad' ? 'bad' : query.error || query.meta?.stale?.length ? 'warn' : ui;
  return <Panel title={title} summary={summary} ui={observedState} concept={blockConcept}><QueryView query={query} url={url}>{children}</QueryView></Panel>;
}

export function Metric({ label, value, help }: { label: string; value: ReactNode; help?: string }) {
  return <div className="flex min-w-0 flex-col gap-1 border-t p-4 min-[760px]:p-6">
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className="text-lg font-semibold tabular-nums">{value}</div>
    {help && <div className="text-xs text-muted-foreground">{help}</div>}
  </div>;
}
