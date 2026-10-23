import { useId, useRef, useState } from 'react';
import { Button, Card, Chip } from '@heroui/react';
import { AlertTriangle } from 'lucide-react';
import type { WorkGraphView } from '../../contract';
import { toneVar, type Tone } from '../status';
import type { Concept } from '../concept';
import { formatDayTime } from './leg/time';
import { graphEvidenceOf } from './graph';
import { t } from '../../i18n/t';
import { Advanced } from '../motion';
import { useNodeHeights } from './use-node-heights';

export const concept: Concept = 'C4';

type Node = WorkGraphView['nodes'][number];
type Edge = WorkGraphView['edges'][number];
type Evidence = ReturnType<typeof graphEvidenceOf<Edge>>;
type Position = { x: number; y: number; height: number };
const NODE_W = 256; const NODE_H = 144; const GAP_X = 48; const GAP_Y = 16; const PAD = 12;

// Runtime work-graph colors are coverage states, not attempt verdicts.
const colorTones = new Map<string, Tone>([['gray', 'queued'], ['yellow', 'running'], ['green', 'success'], ['red', 'failed']]);
const colorTone = (color: string | null): Tone | null => color === null ? null : colorTones.get(color) ?? null;
const colorLabel = (color: string | null) => color === 'gray' ? t('Not started')
  : color === 'yellow' ? t('Running or waiting') : color === 'green' ? t('Done')
    : color === 'red' ? t('Rework required') : t('Unknown');
const chipColor = (color: string | null) => color === 'green' ? 'success' : color === 'yellow' ? 'warning' : color === 'red' ? 'danger' : 'default';
const edgeDash = (kind: string | null) => kind === 'contract' ? '6 3' : kind === 'order' ? '2 3' : undefined;

function edgeLabel(edge: Edge): string {
  const kind = edge.kind ?? t('No dependency type recorded');
  const reason = edge.reason ? ` · ${edge.reason}` : '';
  const inferred = edge.inferred === true ? ` · ${t('Inferred')}` : '';
  return `${edge.from || '—'} → ${edge.to || '—'} (${kind})${reason}${inferred}`;
}

function nodeTitle(n: Node, unresolved: ReadonlySet<string>): string {
  const domain = n.domain ? ` · ${n.domain}` : '';
  const kind = n.kind ? ` · ${n.kind}` : '';
  const unresolvedNote = unresolved.has(n.id) ? `\n${t('Dependency order unresolved')}` : '';
  return `${n.title}\n${n.id}${domain}${kind}\n${colorLabel(n.color)}${unresolvedNote}\n${n.ownedPaths?.join('\n') ?? t('Owned paths not recorded')}`;
}

/** Longest-path layering applies only where the recorded dependency order is resolved. */
function longestPath(graph: WorkGraphView, evidence: Evidence) {
  const edges = evidence.drawable;
  const layer = new Map<string, number>(graph.nodes.map(n => [n.id, 0]));
  const remaining = new Map(graph.nodes.map(n => [n.id, 0]));
  const outgoing = new Map<string, typeof edges>();
  for (const edge of edges) {
    remaining.set(edge.to, (remaining.get(edge.to) ?? 0) + 1);
    outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), edge]);
  }
  const queue = graph.nodes.filter(n => remaining.get(n.id) === 0 && !evidence.unresolved.has(n.id)).map(n => n.id);
  for (const from of queue) {
    for (const edge of outgoing.get(from) ?? []) {
      layer.set(edge.to, Math.max(layer.get(edge.to) ?? 0, (layer.get(from) ?? 0) + 1));
      const count = (remaining.get(edge.to) ?? 0) - 1;
      remaining.set(edge.to, count);
      if (count === 0 && !evidence.unresolved.has(edge.to)) queue.push(edge.to);
    }
  }
  return { layer, remaining };
}

function layerNodes(graph: WorkGraphView, evidence: Evidence) {
  const { layer, remaining } = longestPath(graph, evidence);
  const unresolved = new Set(evidence.unresolved);
  for (const n of graph.nodes) if ((remaining.get(n.id) ?? 0) > 0) unresolved.add(n.id);
  const cols: Node[][] = [];
  for (const n of graph.nodes) {
    if (unresolved.has(n.id)) continue;
    const level = layer.get(n.id) ?? 0;
    const column = cols[level] ?? [];
    column.push(n);
    cols[level] = column;
  }
  const unresolvedColumn = unresolved.size ? cols.length : null;
  if (unresolved.size) cols.push(graph.nodes.filter(node => unresolved.has(node.id)));
  return { unresolved, cols, unresolvedColumn };
}

function placeColumns(cols: readonly (readonly Node[] | undefined)[], nodeHeights: ReadonlyMap<string, number>, top: number) {
  const pos = new Map<string, Position>();
  let bottom = top + NODE_H;
  cols.forEach((col, ci) => {
    let y = top;
    for (const n of col ?? []) {
      const height = Math.max(NODE_H, nodeHeights.get(n.id) ?? NODE_H);
      pos.set(n.id, { x: PAD + ci * (NODE_W + GAP_X), y, height });
      y += height + GAP_Y;
    }
    bottom = Math.max(bottom, y - GAP_Y);
  });
  return { pos, bottom };
}

function layoutSlices(graph: WorkGraphView, nodeHeights: ReadonlyMap<string, number>) {
  const evidence = graphEvidenceOf(graph.nodes.map(n => n.id), graph.edges);
  const { unresolved, cols, unresolvedColumn } = layerNodes(graph, evidence);
  const { pos, bottom } = placeColumns(cols, nodeHeights, unresolved.size ? PAD + 22 : PAD);
  const width = PAD * 2 + Math.max(1, cols.length) * NODE_W + Math.max(0, cols.length - 1) * GAP_X;
  return { edges: evidence.drawable, evidence, unresolved, unresolvedColumn, pos, width, height: bottom + PAD };
}

const listLabel = (items: string[] | undefined) => items == null ? '—' : items.length ? items.join(', ') : t('None recorded');
const colorSourceLabel = (source: WorkGraphView['colorSource']) => source === 'runtime-live' ? t('Runtime coverage colors') : source === 'artifact' ? t('Colors declared in the artifact') : t('Color source not recorded');

function GraphHeader({ graph }: Readonly<{ graph: WorkGraphView }>) {
  return <>
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      <strong className="text-foreground">{graph.version == null ? t('Version not recorded') : t('Version {n}', { n: graph.version })}</strong><span>{t('event: {event}', { event: graph.event })}</span><span>{t('author op: {op}', { op: graph.authorOp || '—' })}</span><span>{formatDayTime(graph.at)}</span>
      <span>{t('{nodes} nodes · {edges} edges', { nodes: graph.nodes.length, edges: graph.edges.length })}</span>
    </div>
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"><span>{t('Digest')}: <span className="break-all font-mono">{graph.digest ?? '—'}</span></span><span>{t('Author job')}: <span className="break-all font-mono">{graph.authorJob ?? '—'}</span></span><span>{colorSourceLabel(graph.colorSource)}</span></div>
    {graph.reason && <p className="text-xs text-muted-foreground">{graph.reason}</p>}
  </>;
}

function Anomalies({ evidence, unresolved }: Readonly<{ evidence: Evidence; unresolved: ReadonlySet<string> }>) {
  const sections = [{ label: t('Missing endpoint'), rows: evidence.dangling }, { label: t('Self dependency'), rows: evidence.self }, { label: t('Cycle dependency'), rows: evidence.cyclic }];
  if (!sections.some(section => section.rows.length > 0)) return null;
  return <Advanced keepMounted title={<span className="flex items-center gap-2"><AlertTriangle className="size-4 shrink-0" aria-hidden="true" />{t('Recorded dependency anomalies')}</span>}>
    <div className="mt-3 space-y-3 text-muted-foreground">{sections.map(({ label, rows }) => rows.length > 0 && <div key={label}><strong className="text-foreground">{label}</strong><ul className="mt-1 space-y-1">{rows.map((edge, index) => <li key={`${edge.from}-${edge.to}-${edge.kind ?? ''}-${index}`} className="break-all font-mono">{edgeLabel(edge)}</li>)}</ul></div>)}<p>{t('Dependency order unresolved')}: <span className="break-all font-mono">{[...unresolved].join(', ') || '—'}</span></p></div>
  </Advanced>;
}

function EdgePath({ edge, pos, arrowId }: Readonly<{ edge: Edge; pos: ReadonlyMap<string, Position>; arrowId: string }>) {
  const a = pos.get(edge.from); const b = pos.get(edge.to);
  if (!a || !b) return null;
  const x1 = a.x + NODE_W; const y1 = a.y + a.height / 2; const x2 = b.x; const y2 = b.y + b.height / 2; const mx = (x1 + x2) / 2;
  return <path d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2 - 2},${y2}`} fill="none" strokeWidth="1.5" strokeDasharray={edgeDash(edge.kind)} markerEnd={`url(#${arrowId})`} style={{ stroke: 'var(--muted-foreground)' }}>
    <title>{edgeLabel(edge)}</title>
  </path>;
}

function SliceNode({ node, p, selected, unresolved, onToggle }: Readonly<{ node: Node; p: Position; selected: boolean; unresolved: ReadonlySet<string>; onToggle: (id: string) => void }>) {
  const tone = colorTone(node.color);
  const suffix = node.kind ? ` · ${node.kind}` : node.domain ? ` · ${node.domain}` : '';
  return <Card data-work-node={node.id} data-tone={tone ?? 'unknown'} className={`absolute min-w-0 p-0 ${selected ? 'ring-1 ring-foreground' : ''}`} style={{ left: p.x, top: p.y, width: NODE_W, minHeight: NODE_H }}
    title={nodeTitle(node, unresolved)}>
    <Button variant="ghost" onPress={() => onToggle(node.id)} aria-pressed={selected} aria-label={`${node.title} · ${node.id} · ${colorLabel(node.color)}`}
      style={{ minHeight: NODE_H }} className="h-auto min-h-0 w-full flex-col items-stretch justify-start gap-2 whitespace-normal rounded-[inherit] p-3 text-left">
      <span className="break-words text-base font-semibold leading-6">{node.title}</span>
      <span className="truncate font-mono text-xs text-muted-foreground" title={node.id}>{node.id}</span>
      <span className="flex"><Chip size="sm" variant="soft" color={chipColor(node.color)}>{colorLabel(node.color)}</Chip></span>
      <span className="mt-auto break-words text-xs font-normal text-muted-foreground">{node.ownedPaths == null ? '—' : t('{n} paths', { n: node.ownedPaths.length })}{suffix}</span>
    </Button>
  </Card>;
}

function Legend({ edges }: Readonly<{ edges: readonly Edge[] }>) {
  return <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
    {['gray', 'yellow', 'green', 'red'].map(color => <span key={color} className="inline-flex items-center gap-1.5"><span className="size-1.5 rounded-full" style={{ background: toneVar(colorTone(color) ?? 'queued') }} aria-hidden="true" />{colorLabel(color)}</span>)}
    {[...new Set(edges.map(edge => edge.kind))].map(kind => <span key={kind ?? 'unknown'} className="inline-flex items-center gap-1.5"><svg width="24" height="8" aria-hidden="true"><line x1="0" y1="4" x2="24" y2="4" stroke="currentColor" strokeWidth="1.5" strokeDasharray={edgeDash(kind)} /></svg>{kind ?? t('No dependency type recorded')}</span>)}
  </div>;
}

function NodeDetail({ node, graph, unresolved, onClose }: Readonly<{ node: Node; graph: WorkGraphView; unresolved: ReadonlySet<string>; onClose: () => void }>) {
  const scalarFields = [{ label: t('Domain'), value: node.domain }, { label: t('Slice'), value: node.slice }, { label: t('Kind'), value: node.kind }, { label: t('Parent'), value: node.parent }, { label: t('Rollback to'), value: node.rollbackTo }];
  const listFields = [{ label: t('Reads'), value: node.reads }, { label: t('Requirements'), value: node.frs }, { label: t('Shapes'), value: node.shapes }, { label: t('Inferred fields'), value: node.inferred }];
  const nodeEdges = graph.edges.filter(edge => edge.from === node.id || edge.to === node.id);
  const sizeText = node.size == null ? '—' : Object.entries(node.size).map(([key, value]) => `${key}: ${value}`).join(' · ') || t('None recorded');
  return <Card variant="transparent" className="text-xs">
    <div className="mb-3 flex items-start justify-between gap-3"><div><strong className="text-sm">{node.title}</strong><p className="mt-1 break-all font-mono text-muted-foreground">{node.id} · {colorLabel(node.color)}</p></div><Button variant="ghost" size="sm" onPress={onClose}>{t('Close')}</Button></div>
    <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
      {scalarFields.map(({ label, value }) => <div key={label}><dt className="text-muted-foreground">{label}</dt><dd className="mt-0.5 break-all font-mono">{value ?? '—'}</dd></div>)}
      <div><dt className="text-muted-foreground">{t('Recorded size')}</dt><dd className="mt-0.5 break-words font-mono">{sizeText}</dd></div>
      {listFields.map(({ label, value }) => <div key={label}><dt className="text-muted-foreground">{label}</dt><dd className="mt-0.5 break-all font-mono">{listLabel(value)}</dd></div>)}
    </dl>
    <div className="mt-3 border-t pt-3"><p className="text-muted-foreground">{t('Owned paths')}</p>{node.ownedPaths == null ? <p className="mt-1">—</p> : <><ul className="mt-1 space-y-1">{node.ownedPaths.map(path => <li key={path} className="break-all font-mono">{path}</li>)}</ul>{node.ownedPaths.length === 0 && <p className="mt-1">{t('None recorded')}</p>}</>}</div>
    <div className="mt-3 border-t pt-3"><p className="text-muted-foreground">{t('Recorded node edges')}</p><ul className="mt-1 space-y-1">{nodeEdges.map((edge, index) => <li key={`${edge.from}-${edge.to}-${edge.kind ?? ''}-${index}`} className="break-all font-mono">{edgeLabel(edge)}</li>)}</ul>{nodeEdges.length === 0 && <p className="mt-1">{t('None recorded')}</p>}</div>
    {unresolved.has(node.id) && <p className="mt-3 text-muted-foreground">{t('Dependency order unresolved')}</p>}
  </Card>;
}

/** The scope's work graph (slices + data edges) from work_graph_versions, layered left to right by longest path. */
export function WorkGraphSlices({ graph }: Readonly<{ graph: WorkGraphView | null }>) {
  const arrowId = useId();
  const holder = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const nodeHeights = useNodeHeights(holder, { selector: '[data-work-node]', dataKey: 'workNode', source: graph });
  if (!graph) return <p className="py-4 text-sm text-muted-foreground">{t('No slice graph for this scope yet (the work graph has not been written).')}</p>;
  const selectedNode = graph.nodes.find(node => node.id === selectedId);
  const { edges, evidence, unresolved, unresolvedColumn, pos, width, height } = layoutSlices(graph, nodeHeights);
  const toggleNode = (id: string) => setSelectedId(current => current === id ? null : id);
  return <div className="min-w-0 flex flex-col gap-3">
    <GraphHeader graph={graph} />
    <Anomalies evidence={evidence} unresolved={unresolved} />
    {graph.nodes.length === 0 && <p className="py-4 text-sm text-muted-foreground">{t('This recorded graph has no nodes.')}</p>}
    <div ref={holder} className="max-w-full overflow-x-auto focus-visible:outline-2 focus-visible:outline-ring" tabIndex={0} role="region" aria-label={t('Work slice graph')}>
      <div className="relative" style={{ width, height }}>
      <svg width={width} height={height} aria-hidden="true" className="pointer-events-none absolute inset-0">
        <defs><marker id={arrowId} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L8,4 L0,8 z" style={{ fill: 'var(--muted-foreground)' }} /></marker></defs>
        {edges.map((e, i) => <EdgePath key={`${e.from}-${e.to}-${e.kind ?? ''}-${i}`} edge={e} pos={pos} arrowId={arrowId} />)}
      </svg>
      {unresolvedColumn != null && <p className="absolute top-2 text-xs text-muted-foreground" style={{ left: PAD + unresolvedColumn * (NODE_W + GAP_X), width: NODE_W }}>{t('Dependency order unresolved')}</p>}
        {graph.nodes.map(n => {
          const p = pos.get(n.id);
          return p ? <SliceNode key={n.id} node={n} p={p} selected={selectedId === n.id} unresolved={unresolved} onToggle={toggleNode} /> : null;
        })}
      </div>
    </div>
    <Legend edges={edges} />
    {graph.domains.length > 0 && <p className="text-xs text-muted-foreground">{t('Domains: {list}', { list: graph.domains.map(d => d.title ?? d.id).join(', ') })}</p>}
    {selectedNode && <NodeDetail node={selectedNode} graph={graph} unresolved={unresolved} onClose={() => setSelectedId(null)} />}
  </div>;
}
