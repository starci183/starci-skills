import type { WorkGraphView } from '../../../contract';
import type { EvidenceFile } from '../../../contract';
import type { Concept } from '../../concept';
import { WorkGraphSlices } from '../../work/work-graph-slices';
import { JsonView, MarkdownView, TextView, YamlView } from '../renderers';
import { useBlobText } from '../use-blob-text';
import { ScopeView } from './scope-view';

export const concept: Concept = 'C8';

type Rec = Record<string, unknown>;
const rec = (v: unknown): Rec | null => (v && typeof v === 'object' && !Array.isArray(v) ? v as Rec : null);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);

export const SCHEMA_LABELS: Record<string, string> = { 'starci/scope-evidence@1': 'Phạm vi', 'starci/work-graph@1': 'Đồ thị lát cắt', 'starci/evidence@1': 'Manifest' };

/** A work-graph evidence file → the WorkGraphView the shared slice diagram draws. */
export function workGraphFromFile(data: unknown, file: EvidenceFile, authorOp: string): WorkGraphView | null {
  const root = rec(data); if (!root) return null;
  const nodes = arr(root.nodes).map(rec).filter((n): n is Rec => n != null && str(n.id) != null);
  if (!nodes.length) return null;
  return {
    version: typeof root.version === 'number' ? root.version : 0, event: 'tệp bằng chứng của op', reason: str(root.reason) ?? '', authorOp, at: file.createdAt,
    domains: arr(root.domains).map(rec).filter((d): d is Rec => d != null).map(d => ({ id: String(d.id), ...(str(d.title) ? { title: String(d.title) } : {}) })),
    nodes: nodes.map(n => ({ id: String(n.id), title: str(n.title) ?? String(n.id), domain: str(n.domain), kind: str(n.kind), ownedPaths: arr(n.ownedPaths).filter((p): p is string => typeof p === 'string'), color: str(n.color) })),
    edges: arr(root.edges).map(rec).filter((e): e is Rec => e != null).map(e => ({ from: String(e.from), to: String(e.to), kind: str(e.kind), reason: str(e.reason) })),
  };
}

/** The schema id of a JSON evidence file: the server's `schema` field, else the file's own `schema` key. */
export function schemaOf(file: EvidenceFile & { schema?: string | null }, text: string | null): string | null {
  if (file.schema) return file.schema;
  if (file.kind !== 'json' || !text) return null;
  try { return str(rec(JSON.parse(text))?.schema); } catch { return null; }
}

/** Renders one evidence file by what it is: scope evidence, work graph, markdown, YAML, other JSON, plain text. */
export function EvidenceSchemaView({ file, authorOp = '' }: { file: EvidenceFile & { schema?: string | null }; authorOp?: string }) {
  const blob = useBlobText(file);
  if (blob.status === 'idle' || blob.status === 'loading') return <p className="p-3 text-sm text-muted-foreground">Đang đọc {file.base}…</p>;
  if (blob.status === 'error') return <p role="alert" className="p-3 text-sm text-[var(--status-failed)]">Không đọc được {file.base}: {blob.error}</p>;
  const schema = schemaOf(file, blob.text);
  const note = blob.truncated ? <p className="mb-2 text-xs text-muted-foreground">Tệp lớn: chỉ hiện 2000 dòng đầu.</p> : null;
  if (schema && file.kind === 'json' && !blob.truncated) {
    let data: unknown = null;
    try { data = JSON.parse(blob.text); } catch { data = null; }
    if (data) {
      if (schema.startsWith('starci/scope-evidence@')) return <ScopeView data={data} />;
      if (schema.startsWith('starci/work-graph@')) return <WorkGraphSlices graph={workGraphFromFile(data, file, authorOp)} />;
    }
  }
  // Scope evidence files carry no `schema` key in older attempts; recognise them by shape.
  if (file.kind === 'json' && !blob.truncated) {
    try { const data = JSON.parse(blob.text) as unknown; const r = rec(data); if (r && rec(r.scope)?.nodes && r.requestDigest) return <ScopeView data={data} />; } catch { /* plain JSON below */ }
  }
  return <div className="min-w-0">{note}
    {file.kind === 'markdown' ? <MarkdownView text={blob.text} />
      : file.kind === 'json' ? <JsonView text={blob.text} />
        : file.kind === 'yaml' ? <YamlView text={blob.text} />
          : <TextView text={blob.text} query="" />}
  </div>;
}
