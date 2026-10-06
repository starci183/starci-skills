import { useEffect, useState } from 'react';
import type { BlobLink } from '../contract';
import type { Concept } from './concept';
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
      setState({ text: await response.text(), error: null, loading: false });
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setState({ text: '', error: error instanceof Error ? error.message : t('Could not read the content.'), loading: false });
    });
    return () => controller.abort();
  }, [blob?.href, lines, mode]);
  if (!blob) return <p className="empty-state">{t('No content yet.')}</p>;
  if (state.loading) return <p className="empty-state">{t('Reading the content…')}</p>;
  if (state.error) return <output className="empty-state block">{state.error}</output>;
  return <pre className="blob-text" tabIndex={0}>{state.text}</pre>;
}
