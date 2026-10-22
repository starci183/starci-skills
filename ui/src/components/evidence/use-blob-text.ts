import { useEffect, useState } from 'react';
import type { EvidenceFile } from '../../contract';

export const TEXT_KINDS = new Set(['json', 'yaml', 'markdown', 'text', 'diff']);
export const TRUNCATE_OVER = 2 * 1024 * 1024;

export type BlobText = { status: 'idle' | 'loading' | 'ready' | 'error'; text: string; error: string | null; httpStatus: number | null; truncated: boolean; sourceEncoding: string | null };
const idle: BlobText = { status: 'idle', text: '', error: null, httpStatus: null, truncated: false, sourceEncoding: null };
type Settled = { key: string; state: BlobText };

/** Loads the decoded UTF-8 text of a text-like evidence file; bytes over 2 MB fetch only the first 2000 lines. */
export function useBlobText(file: EvidenceFile | null): BlobText {
  const [settled, setSettled] = useState<Settled | null>(null);
  // The effect reads only these primitives, so a new `file` object for the same blob does not refetch.
  const href = file?.href ?? null;
  const bytes = file?.bytes ?? 0;
  const kind = file?.kind ?? null;
  const archived = file?.archived ?? null;
  const key = href === null || kind === null || !TEXT_KINDS.has(kind) ? null : [href, bytes, kind, archived].join('\u0000');
  useEffect(() => {
    if (key === null || href === null) return undefined;
    const truncated = bytes > TRUNCATE_OVER;
    const controller = new AbortController();
    const url = truncated ? `${href}?text=head&lines=2000` : href;
    let httpStatus: number | null = null;
    fetch(url, { signal: controller.signal })
      .then(async response => {
        httpStatus = response.status;
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const text = await response.text();
        if (controller.signal.aborted) return;
        setSettled({ key, state: { status: 'ready', text, error: null, httpStatus, truncated, sourceEncoding: response.headers.get('X-StarCi-Source-Encoding') } });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setSettled({ key, state: { ...idle, status: 'error', error: error instanceof Error ? error.message : String(error), httpStatus, truncated } });
      });
    return () => controller.abort();
  }, [key, href, bytes]);
  if (key === null) return idle;
  if (settled?.key === key) return settled.state;
  return { ...idle, status: 'loading', truncated: bytes > TRUNCATE_OVER };
}
