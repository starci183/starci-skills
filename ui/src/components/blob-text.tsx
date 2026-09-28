import { useEffect, useState } from 'react';
import type { BlobLink } from '../contract';
import type { Concept } from './concept';

export const concept: Concept = 'C17';

export function BlobText({ blob, mode = 'tail', lines = 80 }: { blob: BlobLink | null; mode?: 'head' | 'tail'; lines?: number }) {
  const [state, setState] = useState<{ text: string; error: string | null; loading: boolean }>({ text: '', error: null, loading: Boolean(blob) });
  useEffect(() => {
    if (!blob) { setState({ text: '', error: null, loading: false }); return; }
    const controller = new AbortController();
    setState({ text: '', error: null, loading: true });
    void fetch(`${blob.href}?text=${mode}&lines=${Math.min(Math.max(lines, 1), 200)}`, { signal: controller.signal }).then(async (response) => {
      if (response.status === 410) throw new Error('Nội dung đã được lưu trữ và không còn trên máy.');
      if (!response.ok) throw new Error(`Không đọc được nội dung (HTTP ${response.status}).`);
      setState({ text: await response.text(), error: null, loading: false });
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setState({ text: '', error: error instanceof Error ? error.message : 'Không đọc được nội dung.', loading: false });
    });
    return () => controller.abort();
  }, [blob?.href, lines, mode]);
  if (!blob) return <p className="empty-state">Chưa có nội dung.</p>;
  if (state.loading) return <p className="empty-state">Đang đọc nội dung…</p>;
  if (state.error) return <p className="empty-state" role="status">{state.error}</p>;
  return <pre className="blob-text" tabIndex={0}>{state.text}</pre>;
}
