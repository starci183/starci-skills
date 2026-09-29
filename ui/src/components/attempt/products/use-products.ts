import { useApiQuery } from '../../../api/query';
import type { AttemptDetailV3, AttemptProducts, EvidenceKind, ProductFile } from '../../../contract';
import { useBlobText } from '../../evidence/use-blob-text';

const obj = (value: unknown): Record<string, unknown> | null => (value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null);

const kindByExt: Record<string, EvidenceKind> = { json: 'json', yaml: 'yaml', yml: 'yaml', md: 'markdown', markdown: 'markdown', diff: 'diff', patch: 'diff', png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image', svg: 'text' };
export const kindOfPath = (path: string): EvidenceKind => kindByExt[path.split('.').pop()?.toLowerCase() ?? ''] ?? 'text';

/** Split a unified diff into per-file patches keyed by the new path. */
export function splitDiff(text: string): Map<string, string> {
  const out = new Map<string, string>();
  const parts = text.replace(/\r/g, '').split(/^(?=diff --git )/m);
  for (const part of parts) {
    const m = /^diff --git a\/(.+?) b\/(.+)$/m.exec(part);
    if (m) out.set(m[2].trim(), part.trimEnd());
  }
  return out;
}

const joinHost = (repo: string | null, rel: string) => (repo ? `${repo.replace(/[\\/]+$/, '')}\\${rel.replaceAll('/', '\\')}` : null);

/**
 * `/api/attempts/:p/:id/products`; when the server has no such route yet, the same shape is built from
 * `report.json.files` and the attempt's `patch.diff` attachment (paths and diffs only, no file content).
 */
export function useProducts(project: string, attempt: AttemptDetailV3): { products: AttemptProducts | null; loading: boolean; fallback: boolean } {
  const url = `/api/attempts/${encodeURIComponent(project)}/${encodeURIComponent(String(attempt.id))}/products`;
  const query = useApiQuery<AttemptProducts>(url, { topics: [`attempt:${project}:${attempt.id}`] });
  const failed = !query.data && !!query.error;
  const patchFile = failed ? attempt.files.find(file => file.name === 'patch.diff' || file.base === 'patch.diff') ?? null : null;
  const patch = useBlobText(patchFile);
  if (query.data) return { products: query.data, loading: false, fallback: false };
  if (!failed) return { products: null, loading: true, fallback: false };
  if (patchFile && (patch.status === 'idle' || patch.status === 'loading')) return { products: null, loading: true, fallback: true };
  const report = obj(attempt.report?.json);
  const paths = Array.isArray(report?.files) ? (report.files as unknown[]).filter((p): p is string => typeof p === 'string') : [];
  const diffs = patch.status === 'ready' ? splitDiff(patch.text) : new Map<string, string>();
  const files: ProductFile[] = paths.map(path => {
    const diff = diffs.get(path) ?? null;
    const status: ProductFile['status'] = diff ? (/^new file mode/m.test(diff) ? 'added' : /^deleted file mode/m.test(diff) ? 'deleted' : 'modified') : 'missing';
    return { path, status, kind: kindOfPath(path), bytes: null, hostPath: joinHost(attempt.where.repo, path), content: null, truncated: false, diff, diffTruncated: false, error: null };
  });
  const head = typeof report?.head === 'string' ? report.head : null;
  return {
    fallback: true, loading: false,
    products: { head, parent: null, repo: attempt.where.repo, files, otherChanged: [...diffs.keys()].filter(p => !paths.includes(p)).map(path => ({ path, status: 'modified' })), claims: [], error: null },
  };
}
