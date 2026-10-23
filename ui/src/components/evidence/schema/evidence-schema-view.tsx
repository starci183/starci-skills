import type { EvidenceFile, WorkGraphView } from '../../../contract';
import type { Concept } from '../../concept';
import { WorkGraphSlices } from '../../work/work-graph-slices';
import { JsonView, MarkdownView, TextView, YamlView } from '../renderers';
import { useBlobText, type BlobText } from '../use-blob-text';
import { ScopeView } from './scope-view';
import { t } from '../../../i18n/t';
import { Alert, Skeleton } from '@heroui/react';

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

type SchemaFile = EvidenceFile & { schema?: string | null };

function ReadFailure({ file, blob }: Readonly<{ file: SchemaFile; blob: BlobText }>) {
  const archived = blob.httpStatus === 410;
  return <Alert status={archived ? 'warning' : 'danger'}><Alert.Content><Alert.Description>{archived ? t('Archived evidence is unavailable.') : t('Could not read {name}: {error}', { name: file.base, error: blob.error ?? '' })}</Alert.Description></Alert.Content></Alert>;
}

/** The parsed JSON of a file whose schema may have a dedicated view; null when it has none or cannot be parsed. */
function schemaData(file: SchemaFile, blob: BlobText, schema: string | null): unknown {
  if (!schema || file.kind !== 'json' || blob.truncated) return null;
  try { return JSON.parse(blob.text); } catch { return null; }
}

function KindView({ kind, text }: Readonly<{ kind: EvidenceFile['kind']; text: string }>) {
  if (kind === 'markdown') return <MarkdownView text={text} />;
  if (kind === 'json') return <JsonView text={text} />;
  if (kind === 'yaml') return <YamlView text={text} />;
  return <TextView text={text} query="" />;
}

/** Renders one evidence file by what it is: scope evidence, work graph, markdown, YAML, other JSON, plain text. */
export function EvidenceSchemaView({ file, authorOp = '' }: Readonly<{ file: SchemaFile; authorOp?: string }>) {
  const blob = useBlobText(file);
  if (blob.status === 'idle' || blob.status === 'loading') return <output className="block space-y-2" aria-label={t('Reading {name}…', { name: file.base })}><Skeleton className="h-4 w-2/3" /><Skeleton className="h-4 w-1/2" /></output>;
  if (blob.status === 'error') return <ReadFailure file={file} blob={blob} />;
  const schema = schemaOf(file, blob.text);
  const data = schemaData(file, blob, schema);
  if (data && schema?.startsWith('starci/scope-evidence@')) return <ScopeView data={data} />;
  if (data && schema?.startsWith('starci/work-graph@')) return <WorkGraphSlices graph={workGraphFromFile(data, file, authorOp)} />;
  const note = blob.truncated ? <p className="mb-2 text-xs text-muted-foreground">{t('Large file: only the first 2000 lines are shown.')}</p> : null;
  return <div className="min-w-0">{note}
    <KindView kind={file.kind} text={blob.text} />
  </div>;
}
