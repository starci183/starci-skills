import type { QuerySnapshot } from '../../../api/query';
import { refreshQuery } from '../../../api/query';
import { FeedbackState } from '../../feedback-state';
import type { Concept } from '../../concept';
import { formatAbsolute } from '../../../i18n/vi';
import { t } from '../../../i18n/t';

export const concept: Concept = 'C7';
export type ReadState = Pick<QuerySnapshot<unknown>, 'error' | 'meta' | 'observedAt'>;

/** Request-local read warning. Successful GET/304 time is not a source evidence timestamp. */
export function ReadWarning({ read, url, retained = false }: Readonly<{ read: ReadState; url: string; retained?: boolean }>) {
  const stale = read.meta?.stale ?? [];
  if (!read.error && !stale.length) return null;
  return <FeedbackState error onRetry={() => refreshQuery(url)}>
    {read.error ? <>{retained ? t('Refresh failed; showing the last successful response.') : null} {read.error}</> : null}
    {stale.length ? <> {t('Some sources could not be refreshed: {sources}', { sources: stale.join(' · ') })}</> : null}
    {read.observedAt != null ? <span className="block text-xs">{t('Last successful API read at {at}', { at: formatAbsolute(read.observedAt) })}</span> : null}
  </FeedbackState>;
}
