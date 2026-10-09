import type { Concept } from '../concept';
export const concept: Concept = 'C16';
import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { DURATION, EASE } from '../motion';
import { toneVar, type Tone } from '../status';
import { FeedbackState, PageSkeleton, SourceWarning } from '../feedback-state';
import { t } from '../../i18n/t';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { refreshQuery, type QuerySnapshot } from '../../api/query';

export type LegendItem = { tone?: Tone; label: string; hollow?: boolean; neutral?: boolean };

export function Legend({ items }: Readonly<{ items: LegendItem[] }>) {
  return <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label={t('Legend')}>
    {items.map(item => <li key={item.label} className="inline-flex items-center gap-2">
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
        {item.hollow
          ? <circle cx="6" cy="6" r="4.5" fill="none" stroke={toneVar(item.tone ?? 'running')} strokeWidth="1.75" />
          : <rect x="1" y="1" width="10" height="10" rx="2.5" fill={item.tone ? toneVar(item.tone) : item.neutral ? 'var(--primary)' : 'var(--muted-foreground)'} />}
      </svg>{item.label}</li>)}
  </ul>;
}

/** One analytics chart: title, one-line explanation, legend, body or empty state. */
export function ChartCard({ title, hint, legend, empty, className = '', children }: Readonly<{ title: string; hint: string; legend?: LegendItem[];
  empty?: string | false; className?: string; children?: ReactNode }>) {
  return <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: DURATION.enter, ease: EASE }} className={`min-w-0 ${className}`} aria-label={title}>
    <Card className="chart-card min-w-0"><CardHeader>
      <CardTitle><h2>{title}</h2></CardTitle>
      <CardDescription className="text-xs">{hint}</CardDescription>
      {legend && !empty ? <div className="mt-2"><Legend items={legend} /></div> : null}
    </CardHeader><CardContent className="min-w-0">{empty ? <FeedbackState>{empty}</FeedbackState> : children}</CardContent></Card>
  </motion.section>;
}

/** Availability belongs to the query; an unread source is never an empty chart. */
export function ReadQuality<T>({ query, url, onRetry }: Readonly<{ query: QuerySnapshot<T>; url?: string; onRetry?: () => void }>) {
  const retry = onRetry ?? (url ? () => refreshQuery(url) : undefined);
  return <>
    {query.error ? <FeedbackState error onRetry={retry}>{query.data !== null ? t('The source is failing; showing the last read. {error}', { error: query.error }) : t('Could not read the source: {error}', { error: query.error })}</FeedbackState> : null}
    {partialSources(query).length ? <SourceWarning>{t('Source out of sync: {list}', { list: partialSources(query).join(', ') })}</SourceWarning> : null}
    {query.data === null && !query.error ? query.meta ? <FeedbackState>{t('Unknown')}</FeedbackState> : <PageSkeleton label={t('Reading the data…')} /> : null}
  </>;
}

export function partialSources<T>(query: QuerySnapshot<T>): string[] {
  return [...new Set([...(query.meta?.stale ?? []), ...(query.errorMeta?.stale ?? []), ...[...(query.meta?.sources ?? []), ...(query.errorMeta?.sources ?? [])].filter(source => source.availability && source.availability !== 'available').map(source => `${source.db}:${source.rel}`)])];
}
