import type { WorkGraphView } from '../../../contract';
import type { EvidenceFile } from '../../../contract';
import type { Concept } from '../../concept';
import { WorkGraphSlices } from '../../work/work-graph-slices';
import { JsonView, MarkdownView, TextView, YamlView } from '../renderers';
import { useBlobText } from '../use-blob-text';
import { ScopeView } from './scope-view';
import { t } from '../../../i18n/t';

export const concept: Concept = 'C8';

type Rec = Record<string, unknown>;
const rec = (v: unknown): Rec | null => (v && typeof v === 'object' && !Array.isArray(v) ? v as Rec : null);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);

export const SCHEMA_LABELS: Record<string, string> = { 'starci/scope-evidence@1': t('Scope'), 'starci/work-graph@1': t('Slice graph'), 'starci/evidence@1': 'Manifest' };

/** A work-graph evidence file → the WorkGraphView the shared slice diagram draws. */
export function workGraphFromFile(data: unknown, file: EvidenceFile, authorOp: string): WorkGraphView | null {
  const root = rec(data); if (!root) return null;
  if (!Array.isArray(root.nodes)) return null;
  const nodes = arr(root.nodes).map(rec).filter((n): n is Rec => n != null && str(n.id) != null);
  const strings = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : undefined;
  const sizeOf = (value: unknown): NonNullable<WorkGraphView['nodes'][number]['size']> | undefined => {
    const size = rec(value); if (!size) return undefined;
    return Object.fromEntries(['files', 'assertions', 'components', 'records'].flatMap(key => typeof size[key] === 'number' && Number.isInteger(size[key]) && Number(size[key]) >= 0 ? [[key, size[key]]] : []));
  };
  return {
    version: typeof root.version === 'number' && Number.isInteger(root.version) && root.version >= 0 ? root.version : null,
    event: t('op evidence file'), reason: str(root.reason) ?? '', authorOp, at: file.createdAt,
    digest: str(root.digest), authorJob: str(root.authorJob), colorSource: 'artifact',
    domains: arr(root.domains).map(rec).filter((d): d is Rec => d != null && str(d.id) != null).map(d => ({ id: String(d.id), ...(str(d.title) ? { title: String(d.title) } : {}) })),
    nodes: nodes.map(n => ({ id: String(n.id), title: str(n.title) ?? String(n.id), domain: str(n.domain), kind: str(n.kind),
      ...(n.slice !== undefined ? { slice: str(n.slice) } : {}), ...(n.parent !== undefined ? { parent: str(n.parent) } : {}),
      ...(n.rollbackTo !== undefined ? { rollbackTo: str(n.rollbackTo) } : {}), reads: strings(n.reads), size: sizeOf(n.size),
      frs: strings(n.frs), shapes: strings(n.shapes), inferred: strings(n.inferred),
      ownedPaths: strings(n.ownedPaths) ?? null, color: str(n.color) })),
    edges: arr(root.edges).map(rec).filter((e): e is Rec => e != null).map(e => ({ from: str(e.from) ?? '', to: str(e.to) ?? '', kind: str(e.kind), reason: str(e.reason),
      ...(typeof e.inferred === 'boolean' ? { inferred: e.inferred } : {}) })),
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
  if (blob.status === 'idle' || blob.status === 'loading') return <p className="p-3 text-sm text-muted-foreground">{t('Reading {name}…', { name: file.base })}</p>;
  if (blob.status === 'error') return <p role="alert" className="p-3 text-sm text-[var(--status-failed)]">{t('Could not read {name}: {error}', { name: file.base, error: blob.error ?? '' })}</p>;
  const schema = schemaOf(file, blob.text);
  const note = blob.truncated ? <p className="mb-2 text-xs text-muted-foreground">{t('Large file: only the first 2000 lines are shown.')}</p> : null;
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
