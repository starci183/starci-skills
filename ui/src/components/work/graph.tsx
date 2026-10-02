import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, GitBranch } from 'lucide-react';
import type { GraphNode, UiState } from '../../contract';
import { StateChip } from '../state-chip';
import { ConceptBlock, type Concept } from '../concept';
import { t } from '../../i18n/t';

export const concept: Concept = 'C4';
export type WorkGraph = { nodes: GraphNode[]; edges: { from: string; to: string; kind: string }[]; groups: { op: string; total: number; byUi: Record<UiState, number> }[] };
export type GraphGroup = { id: string; op: string; nodes: GraphNode[]; incoming: Edge[]; ui: UiState };
type Group = GraphGroup;
type Edge = { from: string; to: string; kind: string };
const severity: UiState[] = ['bad', 'warn', 'running', 'waiting', 'ok', 'done', 'unknown'];
const nodeWidth = 208, nodeHeight = 76, colGap = 130, rowGap = 54;

function buildLayout(graph: WorkGraph) {
  const incomingByUnit = new Map<string, string[]>();
  for (const edge of graph.edges) incomingByUnit.set(edge.to, [...(incomingByUnit.get(edge.to) ?? []), `${edge.from}:${edge.kind}`]);
  const grouped = new Map<string, Group>();
  const unitGroup = new Map<string, string>();
  for (const node of graph.nodes) {
    const predecessors = [...(incomingByUnit.get(node.unit) ?? [])].sort().join('|');
    const id = `${node.op}\u0000${predecessors}`;
    if (!grouped.has(id)) grouped.set(id, { id, op: node.op, nodes: [], incoming: [], ui: 'unknown' });
    grouped.get(id)!.nodes.push(node);
    unitGroup.set(node.unit, id);
  }
  const groups = [...grouped.values()].map(group => ({ ...group, ui: severity.find(state => group.nodes.some(node => node.ui === state)) ?? 'unknown' }));
  const dedupe = new Map<string, Edge>();
  for (const edge of graph.edges) {
    const from = unitGroup.get(edge.from), to = unitGroup.get(edge.to);
    if (from && to && from !== to) dedupe.set(`${from}\u0001${to}\u0001${edge.kind}`, { from, to, kind: edge.kind });
  }
  const edges = [...dedupe.values()];
  for (const group of groups) group.incoming = edges.filter(edge => edge.to === group.id);
  const depth = new Map(groups.map(group => [group.id, 0]));
  for (let pass = 0; pass < groups.length; pass++) {
    let changed = false;
    for (const edge of edges) {
      const next = Math.min(groups.length - 1, (depth.get(edge.from) ?? 0) + 1);
      if (next > (depth.get(edge.to) ?? 0)) { depth.set(edge.to, next); changed = true; }
    }
    if (!changed) break;
  }
  const layers = [...new Set(depth.values())].sort((a, b) => a - b).map(level => groups.filter(group => depth.get(group.id) === level));
  const positions = new Map<string, { x: number; y: number }>();
  layers.forEach((layer, x) => layer.forEach((group, y) => positions.set(group.id, { x: 24 + x * (nodeWidth + colGap), y: 24 + y * (nodeHeight + rowGap) })));
  return { groups: layers.flat(), edges, positions, width: Math.max(1, layers.length) * (nodeWidth + colGap) - colGap + 48, height: Math.max(1, ...layers.map(layer => layer.length)) * (nodeHeight + rowGap) - rowGap + 48 };
}

export function GraphView({ graph, onUnit, onGroupSelect, selectionInInspector = false }: { graph: WorkGraph; onUnit: (unit: string) => void; onGroupSelect?: (group: GraphGroup | null) => void; selectionInInspector?: boolean }) {
  const [selected, setSelected] = useState<string | null>(null);
  const layout = useMemo(() => buildLayout(graph), [graph]);
  const selectedGroup = layout.groups.find(group => group.id === selected);
  const groupName = (id: string) => layout.groups.find(group => group.id === id)?.op ?? id.split('\u0000')[0];
  const selectGroup = (group: GraphGroup) => {
    const next = selected === group.id ? null : group;
    setSelected(next?.id ?? null);
    onGroupSelect?.(next);
  };
  return <ConceptBlock concept="C4" className="min-w-0 space-y-3">
    <div className="flex items-center gap-2 text-sm text-muted-foreground"><GitBranch className="size-4" aria-hidden="true" /> {t('Op graph · {n} units', { n: graph.nodes.length })}</div>
    {layout.groups.length === 0 && <p className="rounded-xl border p-6 text-sm text-muted-foreground">{t('No units in the graph yet.')}</p>}
    {layout.groups.length > 0 && <>
      <div className="hidden max-w-full overflow-x-auto rounded-xl border bg-muted/15 p-2 md:block" aria-label={t('Op graph with dependency arrows')}>
        <div className="relative" style={{ width: layout.width, height: layout.height }}>
          <svg className="absolute inset-0 h-full w-full overflow-visible" width={layout.width} height={layout.height} aria-hidden="true"><defs><marker id="work-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" /></marker></defs>
            {layout.edges.map((edge, index) => { const a = layout.positions.get(edge.from), b = layout.positions.get(edge.to); if (!a || !b) return null; const x1 = a.x + nodeWidth, y1 = a.y + nodeHeight / 2, x2 = b.x - 5, y2 = b.y + nodeHeight / 2, mid = x1 + Math.max(20, (x2 - x1) / 2); return <path key={index} d={`M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`} fill="none" stroke="currentColor" strokeWidth="1.5" markerEnd="url(#work-arrow)" className={edge.kind === 'seam' ? 'text-muted-foreground' : 'text-muted-foreground/60'} />; })}
          </svg>
          {layout.groups.map(group => { const pos = layout.positions.get(group.id)!; return <button key={group.id} type="button" onClick={() => selectGroup(group)} aria-expanded={selected === group.id} style={{ left: pos.x, top: pos.y, width: nodeWidth, height: nodeHeight }} className={`absolute flex min-w-0 flex-col justify-center rounded-xl border bg-card px-3 text-left shadow-sm hover:border-primary/50 focus-visible:outline-2 focus-visible:outline-ring ${selected === group.id ? 'ring-2 ring-primary/40' : ''}`}><span className="truncate text-sm font-semibold" title={group.op}>{group.op} ×{group.nodes.length}</span><span className="mt-1 flex items-center gap-2"><StateChip state={group.ui} compact /><span className="truncate text-xs text-muted-foreground">{t('{pass}/{total} passed', { pass: group.nodes.filter(node => node.state === 'done').length, total: group.nodes.length })}</span></span></button>; })}
        </div>
      </div>
      <div className="space-y-2 md:hidden" aria-label={t('Op list by dependency')}>{layout.groups.map(group => <div key={group.id} className="rounded-xl border bg-card"><button type="button" onClick={() => selectGroup(group)} aria-expanded={selected === group.id} className="flex w-full min-w-0 items-center gap-2 p-3 text-left">{selected === group.id ? <ChevronDown className="size-4 shrink-0" /> : <ChevronRight className="size-4 shrink-0" />}<span className="min-w-0 flex-1"><strong className="block truncate text-sm">{group.op} ×{group.nodes.length}</strong><span className="block truncate text-xs text-muted-foreground">{group.incoming.length ? t('After {list}', { list: group.incoming.map(edge => `${groupName(edge.from)} (${edge.kind})`).join(', ') }) : t('First step')}</span></span><StateChip state={group.ui} compact /></button></div>)}</div>
      {selectedGroup && <div className={selectionInInspector ? 'rounded-xl border bg-card p-3 lg:hidden' : 'rounded-xl border bg-card p-3'}><div className="mb-2 flex flex-wrap items-center gap-2"><strong className="text-sm">{selectedGroup.op} ×{selectedGroup.nodes.length}</strong><span className="text-xs text-muted-foreground">{selectedGroup.incoming.length ? t('After {list}', { list: selectedGroup.incoming.map(edge => `${groupName(edge.from)} (${edge.kind})`).join(', ') }) : t('First step')}</span></div><div className="grid gap-1 sm:grid-cols-2">{selectedGroup.nodes.map(node => <button type="button" key={node.unit} onClick={() => onUnit(node.unit)} className="flex min-w-0 items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-muted/60"><span className="min-w-0 flex-1"><span className="block truncate font-medium">{node.title}</span><span className="block truncate text-xs text-muted-foreground">{node.unit} · {node.state}</span></span><StateChip state={node.ui} compact /></button>)}</div></div>}
    </>}
  </ConceptBlock>;
}
