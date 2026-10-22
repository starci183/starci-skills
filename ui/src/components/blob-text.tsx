import { useEffect, useState } from 'react';
import { Skeleton } from '@heroui/react';
import type { BlobLink } from '../contract';
import type { Concept } from './concept';
import { FeedbackState } from './feedback-state';
import { t } from '../i18n/t';

/** The business concept id (C17) under which the stored-text view is filed; it is stamped on data-concept so the rendered DOM traces back to its spec. */
export const concept: Concept = 'C17';

/** The head or tail lines of a stored text blob, fetched on demand with explicit loading, empty, archived and error states. */
export const BlobText = ({ blob, mode = 'tail', lines = 80 }: Readonly<{ blob: BlobLink | null; mode?: 'head' | 'tail'; lines?: number }>) => {
  const href = blob?.href;
  const requestKey = href === undefined ? null : `${href}?text=${mode}&lines=${Math.min(Math.max(lines, 1), 200)}`;
  const [result, setResult] = useState<{ key: string; text: string; error: string | null } | null>(null);
  useEffect(() => {
    if (requestKey === null) return;
    const controller = new AbortController();
    void fetch(requestKey, { signal: controller.signal }).then(async (response) => {
      if (response.status === 410) throw new Error(t('The content was archived and is no longer on the machine.'));
      if (!response.ok) throw new Error(t('Could not read the content (HTTP {status}).', { status: response.status }));
      const text = await response.text();
      if (!controller.signal.aborted) setResult({ key: requestKey, text, error: null });
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setResult({ key: requestKey, text: '', error: error instanceof Error ? error.message : t('Could not read the content.') });
    });
    return () => controller.abort();
  }, [requestKey]);
  const current = result !== null && result.key === requestKey ? result : null;
  if (!blob) return <FeedbackState>{t('No content yet.')}</FeedbackState>;
  if (current === null) return <div role="status" aria-label={t('Reading the content…')} className="space-y-3 py-4">
    <span className="sr-only">{t('Reading the content…')}</span>
    <Skeleton animationType="pulse" aria-hidden="true" className="h-4 w-4/5" />
    <Skeleton animationType="pulse" aria-hidden="true" className="h-4 w-3/5" />
    <Skeleton animationType="pulse" aria-hidden="true" className="h-4 w-2/3" />
  </div>;
  if (current.error) return <FeedbackState error>{current.error}</FeedbackState>;
  if (current.text === '') return <FeedbackState>{t('Empty file (no content).')}</FeedbackState>;
  return <pre className="blob-text" tabIndex={0}>{current.text}</pre>;
};
