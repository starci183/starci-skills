import { useEffect, useState } from 'react';
import type { EvidenceFile } from '../../contract';

export const TEXT_KINDS = new Set(['json', 'yaml', 'markdown', 'text', 'diff']);
export const TRUNCATE_OVER = 2 * 1024 * 1024;

export type BlobText = { status: 'idle' | 'loading' | 'ready' | 'error'; text: string; error: string | null; httpStatus: number | null; truncated: boolean; sourceEncoding: string | null };
const idle: BlobText = { status: 'idle', text: '', error: null, httpStatus: null, truncated: false, sourceEncoding: null };

/** Loads the decoded UTF-8 text of a text-like evidence file; bytes over 2 MB fetch only the first 2000 lines. */
export function useBlobText(file: EvidenceFile | null): BlobText {
  const [state, setState] = useState<BlobText>(idle);
  const key = file ? `${file.href}|${file.bytes}|${file.kind}|${file.archived}` : '';
  useEffect(() => {
    if (!file || !TEXT_KINDS.has(file.kind)) { setState(idle); return; }
    const truncated = file.bytes > TRUNCATE_OVER;
    const controller = new AbortController();
    setState({ ...idle, status: 'loading', truncated });
    const url = truncated ? `${file.href}?text=head&lines=2000` : file.href;
    let httpStatus: number | null = null;
    fetch(url, { signal: controller.signal })
      .then(async response => {
        httpStatus = response.status;
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const text = await response.text();
        if (controller.signal.aborted) return;
        setState({ status: 'ready', text, error: null, httpStatus, truncated, sourceEncoding: response.headers.get('X-StarCi-Source-Encoding') });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({ ...idle, status: 'error', error: error instanceof Error ? error.message : String(error), httpStatus, truncated });
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state;
}
