import { useEffect, useState } from 'react';
import { Skeleton } from '@heroui/react';
import type { BlobLink } from '../contract';
import type { Concept } from './concept';
import { FeedbackState } from './feedback-state';
import { t } from '../i18n/t';

export const concept: Concept = 'C17';

export function BlobText({ blob, mode = 'tail', lines = 80 }: Readonly<{ blob: BlobLink | null; mode?: 'head' | 'tail'; lines?: number }>) {
  const [state, setState] = useState<{ text: string; error: string | null; loading: boolean }>({ text: '', error: null, loading: Boolean(blob) });
  useEffect(() => {
    if (!blob) { setState({ text: '', error: null, loading: false }); return; }
    const controller = new AbortController();
    setState({ text: '', error: null, loading: true });
    void fetch(`${blob.href}?text=${mode}&lines=${Math.min(Math.max(lines, 1), 200)}`, { signal: controller.signal }).then(async (response) => {
      if (response.status === 410) throw new Error(t('The content was archived and is no longer on the machine.'));
      if (!response.ok) throw new Error(t('Could not read the content (HTTP {status}).', { status: response.status }));
      const text = await response.text();
      if (!controller.signal.aborted) setState({ text, error: null, loading: false });
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setState({ text: '', error: error instanceof Error ? error.message : t('Could not read the content.'), loading: false });
    });
    return () => controller.abort();
  }, [blob?.href, lines, mode]);
  if (!blob) return <FeedbackState>{t('No content yet.')}</FeedbackState>;
  if (state.loading) return <div role="status" aria-label={t('Reading the content…')} className="space-y-3 py-4">
    <span className="sr-only">{t('Reading the content…')}</span>
    <Skeleton animationType="pulse" aria-hidden="true" className="h-4 w-4/5" />
    <Skeleton animationType="pulse" aria-hidden="true" className="h-4 w-3/5" />
    <Skeleton animationType="pulse" aria-hidden="true" className="h-4 w-2/3" />
  </div>;
  if (state.error) return <FeedbackState error>{state.error}</FeedbackState>;
  if (state.text === '') return <FeedbackState>{t('Empty file (no content).')}</FeedbackState>;
  return <pre className="blob-text" tabIndex={0}>{state.text}</pre>;
}
