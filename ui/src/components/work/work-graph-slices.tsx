import { useId, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { WorkGraphView } from '../../contract';
import { toneVar, type Tone } from '../status';
import type { Concept } from '../concept';
import { formatDayTime } from './leg/time';
import { graphEvidenceOf } from './graph';
import { t } from '../../i18n/t';

export const concept: Concept = 'C4';

type Node = WorkGraphView['nodes'][number];
const NODE_W = 210; const NODE_H = 64; const GAP_X = 70; const GAP_Y = 16; const PAD = 12;

// Runtime work-graph colors are coverage states, not attempt verdicts.
const colorTone = (color: string | null): Tone | null => {
  switch (color) {
    case 'gray': return 'queued';
    case 'yellow': return 'running';
    case 'green': return 'success';
    case 'red': return 'failed';
    default: return null;
  }
};
const colorLabel = (color: string | null) => color === 'gray' ? t('Not started')
  : color === 'yellow' ? t('Running or waiting') : color === 'green' ? t('Done')
    : color === 'red' ? t('Rework required') : t('Unknown');
const edgeDash = (kind: string | null) => kind === 'contract' ? '6 3' : kind === 'order' ? '2 3' : undefined;

/** The scope's work graph (slices + data edges) from work_graph_versions, layered left to right by longest path. */
export function WorkGraphSlices({ graph }: Readonly<{ graph: WorkGraphView | null }>) {
  const arrowId = useId();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  if (!graph) return <p className="rounded-lg border p-4 text-sm text-muted-foreground">{t('No slice graph for this scope yet (the work graph has not been written).')}</p>;
  const selectedNode = graph.nodes.find(node => node.id === selectedId);
  const evidence = graphEvidenceOf(graph.nodes.map(n => n.id), graph.edges);
  const edges = evidence.drawable;
  // Longest-path layering applies only where the recorded dependency order is resolved.
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
  const unresolved = new Set(evidence.unresolved);
  for (const n of graph.nodes) if ((remaining.get(n.id) ?? 0) > 0) unresolved.add(n.id);
  const cols: Node[][] = [];
  for (const n of graph.nodes) if (!unresolved.has(n.id)) (cols[layer.get(n.id) ?? 0] ??= []).push(n);
  const unresolvedColumn = unresolved.size ? cols.length : null;
  if (unresolved.size) cols.push(graph.nodes.filter(node => unresolved.has(node.id)));
  const pos = new Map<string, { x: number; y: number }>();
  const top = unresolved.size ? PAD + 22 : PAD;
  cols.forEach((col, ci) => col?.forEach((n, ri) => pos.set(n.id, { x: PAD + ci * (NODE_W + GAP_X), y: top + ri * (NODE_H + GAP_Y) })));
  const width = PAD * 2 + Math.max(1, cols.length) * NODE_W + Math.max(0, cols.length - 1) * GAP_X;
  const height = top + PAD + Math.max(1, ...cols.map(c => c?.length ?? 0)) * (NODE_H + GAP_Y) - GAP_Y;
  const trunc = (s: string, n: number) => s.length > n ? `${s.slice(0, n - 1)}…` : s;
  const edgeLabel = (edge: WorkGraphView['edges'][number]) => `${edge.from || '—'} → ${edge.to || '—'} (${edge.kind ?? t('No dependency type recorded')})${edge.reason ? ` · ${edge.reason}` : ''}${edge.inferred === true ? ` · ${t('Inferred')}` : ''}`;
  const anomalySections = [{ label: t('Missing endpoint'), rows: evidence.dangling }, { label: t('Self dependency'), rows: evidence.self }, { label: t('Cycle dependency'), rows: evidence.cyclic }];
  const listLabel = (items: string[] | undefined) => items == null ? '—' : items.length ? items.join(', ') : t('None recorded');
  const toggleNode = (id: string) => setSelectedId(current => current === id ? null : id);
  return <div className="flex flex-col gap-3">
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      <strong className="text-foreground">{graph.version == null ? t('Version not recorded') : t('Version {n}', { n: graph.version })}</strong><span>{t('event: {event}', { event: graph.event })}</span><span>{t('author op: {op}', { op: graph.authorOp || '—' })}</span><span>{formatDayTime(graph.at)}</span>
      <span>{t('{nodes} nodes · {edges} edges', { nodes: graph.nodes.length, edges: graph.edges.length })}</span>
    </div>
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"><span>{t('Digest')}: <span className="break-all font-mono">{graph.digest ?? '—'}</span></span><span>{t('Author job')}: <span className="break-all font-mono">{graph.authorJob ?? '—'}</span></span><span>{graph.colorSource === 'runtime-live' ? t('Runtime coverage colors') : graph.colorSource === 'artifact' ? t('Colors declared in the artifact') : t('Color source not recorded')}</span></div>
    {graph.reason && <p className="text-xs text-muted-foreground">{graph.reason}</p>}
    {anomalySections.some(section => section.rows.length > 0) && <details className="rounded-lg border bg-card p-3 text-xs">
      <summary className="flex cursor-pointer items-center gap-2 font-medium"><AlertTriangle className="size-4 shrink-0" aria-hidden="true" />{t('Recorded dependency anomalies')}</summary>
      <div className="mt-3 space-y-3 text-muted-foreground">{anomalySections.map(({ label, rows }) => rows.length > 0 && <div key={label}><strong className="text-foreground">{label}</strong><ul className="mt-1 space-y-1">{rows.map((edge, index) => <li key={`${edge.from}-${edge.to}-${edge.kind ?? ''}-${index}`} className="break-all font-mono">{edgeLabel(edge)}</li>)}</ul></div>)}<p>{t('Dependency order unresolved')}: <span className="break-all font-mono">{[...unresolved].join(', ') || '—'}</span></p></div>
    </details>}
    {graph.nodes.length === 0 && <p className="rounded-lg border p-4 text-sm text-muted-foreground">{t('This recorded graph has no nodes.')}</p>}
    <div className="max-w-full overflow-x-auto rounded-lg border bg-card focus-visible:outline-2 focus-visible:outline-ring" tabIndex={0} aria-label={t('Work slice graph')}>
      <svg width={width} height={height} role="group" aria-label={t('Work slice graph')} style={{ minWidth: width }} className="block">
        <defs><marker id={arrowId} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L8,4 L0,8 z" style={{ fill: 'var(--muted-foreground)' }} /></marker></defs>
        {unresolvedColumn != null && <text x={PAD + unresolvedColumn * (NODE_W + GAP_X)} y={PAD + 10} fontSize="10.5" style={{ fill: 'var(--muted-foreground)' }}>{t('Dependency order unresolved')}</text>}
        {edges.map((e, i) => {
          const a = pos.get(e.from); const b = pos.get(e.to); if (!a || !b) return null;
          const x1 = a.x + NODE_W; const y1 = a.y + NODE_H / 2; const x2 = b.x; const y2 = b.y + NODE_H / 2; const mx = (x1 + x2) / 2;
          return <path key={`${e.from}-${e.to}-${e.kind ?? ''}-${i}`} d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2 - 2},${y2}`} fill="none" strokeWidth="1.5" strokeDasharray={edgeDash(e.kind)} markerEnd={`url(#${arrowId})`} style={{ stroke: 'var(--muted-foreground)' }}>
            <title>{edgeLabel(e)}</title>
          </path>;
        })}
        {graph.nodes.map(n => {
          const p = pos.get(n.id); if (!p) return null; const tone = colorTone(n.color);
          return <g key={n.id} transform={`translate(${p.x},${p.y})`} role="button" tabIndex={0} aria-pressed={selectedId === n.id} aria-label={`${n.title} · ${n.id} · ${colorLabel(n.color)}`} onClick={() => toggleNode(n.id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggleNode(n.id); } }} className="cursor-pointer focus-visible:outline-2 focus-visible:outline-ring">
            <title>{`${n.title}\n${n.id}${n.domain ? ` · ${n.domain}` : ''}${n.kind ? ` · ${n.kind}` : ''}\n${colorLabel(n.color)}${unresolved.has(n.id) ? `\n${t('Dependency order unresolved')}` : ''}\n${n.ownedPaths?.join('\n') ?? t('Owned paths not recorded')}`}</title>
            <rect width={NODE_W} height={NODE_H} rx="6" strokeWidth={selectedId === n.id ? '1.5' : '1'} style={{ fill: 'var(--card)', stroke: selectedId === n.id ? 'var(--foreground)' : 'var(--border)' }} />
            <rect x="0.5" y="9" width="2" height={NODE_H - 18} rx="1" style={{ fill: tone ? toneVar(tone) : 'var(--muted-foreground)' }} />
            <text x="16" y="24" fontSize="12.5" fontWeight="600" style={{ fill: 'var(--foreground)' }}>{trunc(n.title, 27)}</text>
            <text x="16" y="42" fontSize="10.5" fontFamily="var(--font-mono, monospace)" style={{ fill: 'var(--muted-foreground)' }}>{trunc(n.id, 30)}</text>
            <text x="16" y="56" fontSize="10.5" style={{ fill: 'var(--muted-foreground)' }}>{n.ownedPaths == null ? '—' : t('{n} paths', { n: n.ownedPaths.length })}{n.kind ? ` · ${trunc(n.kind, 12)}` : n.domain ? ` · ${trunc(n.domain, 14)}` : ''}</text>
          </g>;
        })}
      </svg>
    </div>
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {['gray', 'yellow', 'green', 'red'].map(color => <span key={color} className="inline-flex items-center gap-1.5"><span className="size-1.5 rounded-full" style={{ background: toneVar(colorTone(color) ?? 'queued') }} aria-hidden="true" />{colorLabel(color)}</span>)}
      {[...new Set(edges.map(edge => edge.kind))].map(kind => <span key={kind ?? 'unknown'} className="inline-flex items-center gap-1.5"><svg width="24" height="8" aria-hidden="true"><line x1="0" y1="4" x2="24" y2="4" stroke="currentColor" strokeWidth="1.5" strokeDasharray={edgeDash(kind)} /></svg>{kind ?? t('No dependency type recorded')}</span>)}
    </div>
    {graph.domains.length > 0 && <p className="text-xs text-muted-foreground">{t('Domains: {list}', { list: graph.domains.map(d => d.title ?? d.id).join(', ') })}</p>}
    {selectedNode && <div className="rounded-lg border bg-card p-3 text-xs">
      <div className="mb-3 flex items-start justify-between gap-3"><div><strong className="text-sm">{selectedNode.title}</strong><p className="mt-1 break-all font-mono text-muted-foreground">{selectedNode.id} · {colorLabel(selectedNode.color)}</p></div><button type="button" onClick={() => setSelectedId(null)} className="rounded-md px-2 py-1 text-muted-foreground hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-ring">{t('Close')}</button></div>
      <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
        {[{ label: t('Domain'), value: selectedNode.domain }, { label: t('Slice'), value: selectedNode.slice }, { label: t('Kind'), value: selectedNode.kind }, { label: t('Parent'), value: selectedNode.parent }, { label: t('Rollback to'), value: selectedNode.rollbackTo }].map(({ label, value }) => <div key={label}><dt className="text-muted-foreground">{label}</dt><dd className="mt-0.5 break-all font-mono">{value ?? '—'}</dd></div>)}
        <div><dt className="text-muted-foreground">{t('Recorded size')}</dt><dd className="mt-0.5 break-words font-mono">{selectedNode.size == null ? '—' : Object.entries(selectedNode.size).map(([key, value]) => `${key}: ${value}`).join(' · ') || t('None recorded')}</dd></div>
        {[{ label: t('Reads'), value: selectedNode.reads }, { label: t('Requirements'), value: selectedNode.frs }, { label: t('Shapes'), value: selectedNode.shapes }, { label: t('Inferred fields'), value: selectedNode.inferred }].map(({ label, value }) => <div key={label}><dt className="text-muted-foreground">{label}</dt><dd className="mt-0.5 break-all font-mono">{listLabel(value)}</dd></div>)}
      </dl>
      <div className="mt-3 border-t pt-3"><p className="text-muted-foreground">{t('Owned paths')}</p>{selectedNode.ownedPaths == null ? <p className="mt-1">—</p> : <><ul className="mt-1 space-y-1">{selectedNode.ownedPaths.map(path => <li key={path} className="break-all font-mono">{path}</li>)}</ul>{selectedNode.ownedPaths.length === 0 && <p className="mt-1">{t('None recorded')}</p>}</>}</div>
      <div className="mt-3 border-t pt-3"><p className="text-muted-foreground">{t('Recorded node edges')}</p><ul className="mt-1 space-y-1">{graph.edges.filter(edge => edge.from === selectedNode.id || edge.to === selectedNode.id).map((edge, index) => <li key={`${edge.from}-${edge.to}-${edge.kind ?? ''}-${index}`} className="break-all font-mono">{edgeLabel(edge)}</li>)}</ul>{graph.edges.every(edge => edge.from !== selectedNode.id && edge.to !== selectedNode.id) && <p className="mt-1">{t('None recorded')}</p>}</div>
      {unresolved.has(selectedNode.id) && <p className="mt-3 text-muted-foreground">{t('Dependency order unresolved')}</p>}
    </div>}
  </div>;
}
