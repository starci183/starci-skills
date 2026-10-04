import { useId, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, GitBranch } from 'lucide-react';
import type { GraphEdge, GraphNode, UiState } from '../../contract';
import { StateChip } from '../state-chip';
import { ConceptBlock, type Concept } from '../concept';
import { formatDayTime } from './leg/time';
import { t } from '../../i18n/t';

export const concept: Concept = 'C4';
export type WorkGraph = { nodes: GraphNode[]; edges: Edge[]; groups: { op: string; total: number; byUi: Record<UiState, number> }[] };
type Predecessor = { unit: string; kind: string };
export type GraphGroup = { id: string; op: string; nodes: GraphNode[]; incoming: Edge[]; recordedEdges: Edge[]; predecessors: Predecessor[]; ui: UiState; orderUnresolved: boolean };
type Group = GraphGroup;
type Edge = GraphEdge;
type GroupEdge = Edge & { records: Edge[] };
type Dependency = { from: string; to: string };
const severity: UiState[] = ['bad', 'warn', 'running', 'waiting', 'unknown', 'ok', 'done'];
const nodeWidth = 208, nodeHeight = 76, colGap = 130, rowGap = 54;
const edgeDash = (kind: string) => kind === 'seam' ? '6 3' : kind === 'dependsOn' ? '3 3' : kind === 'peer-wait' ? '1 3' : undefined;

/** Structural evidence over recorded IDs, independent of runtime readiness or color. */
export function graphEvidenceOf<T extends Dependency>(nodeIds: string[], recordedEdges: T[]) {
  const ids = new Set(nodeIds);
  const dangling = recordedEdges.filter(edge => !ids.has(edge.from) || !ids.has(edge.to));
  const self = recordedEdges.filter(edge => edge.from === edge.to);
  const drawable = recordedEdges.filter(edge => ids.has(edge.from) && ids.has(edge.to) && edge.from !== edge.to);
  const outgoing = new Map(nodeIds.map(id => [id, [] as string[]]));
  const reverse = new Map(nodeIds.map(id => [id, [] as string[]]));
  for (const edge of drawable) {
    outgoing.get(edge.from)!.push(edge.to);
    reverse.get(edge.to)!.push(edge.from);
  }
  // Iterative strongly connected components retain exact cycle edges without a recursion limit.
  const seen = new Set<string>();
  const order: string[] = [];
  for (const root of nodeIds) {
    if (seen.has(root)) continue;
    seen.add(root);
    const stack = [{ id: root, cursor: 0 }];
    while (stack.length) {
      const top = stack[stack.length - 1];
      const next = outgoing.get(top.id)![top.cursor++];
      if (next != null) {
        if (!seen.has(next)) { seen.add(next); stack.push({ id: next, cursor: 0 }); }
      } else { order.push(top.id); stack.pop(); }
    }
  }
  const component = new Map<string, number>();
  const cycleNodes = new Set<string>();
  let componentId = 0;
  for (let i = order.length - 1; i >= 0; i--) {
    const root = order[i];
    if (component.has(root)) continue;
    const members: string[] = [];
    const stack = [root];
    component.set(root, componentId);
    while (stack.length) {
      const id = stack.pop()!;
      members.push(id);
      for (const next of reverse.get(id)!) if (!component.has(next)) { component.set(next, componentId); stack.push(next); }
    }
    if (members.length > 1) for (const id of members) cycleNodes.add(id);
    componentId++;
  }
  const cyclic = drawable.filter(edge => cycleNodes.has(edge.from) && component.get(edge.from) === component.get(edge.to));
  const unresolved = new Set([...cycleNodes, ...self.filter(edge => ids.has(edge.to)).map(edge => edge.to), ...dangling.filter(edge => ids.has(edge.to)).map(edge => edge.to)]);
  const queue = [...unresolved];
  for (let cursor = 0; cursor < queue.length; cursor++) for (const next of outgoing.get(queue[cursor]) ?? []) {
    if (!unresolved.has(next)) { unresolved.add(next); queue.push(next); }
  }
  return { drawable, dangling, self, cyclic, unresolved };
}

function buildLayout(graph: WorkGraph) {
  const evidence = graphEvidenceOf(graph.nodes.map(node => node.unit), graph.edges);
  const incomingByUnit = new Map<string, Map<string, Predecessor>>();
  for (const edge of graph.edges) {
    const incoming = incomingByUnit.get(edge.to) ?? new Map<string, Predecessor>();
    incoming.set(JSON.stringify([edge.from, edge.kind]), { unit: edge.from, kind: edge.kind });
    incomingByUnit.set(edge.to, incoming);
  }
  const grouped = new Map<string, Group>();
  const unitGroup = new Map<string, string>();
  for (const node of graph.nodes) {
    const predecessors = [...(incomingByUnit.get(node.unit)?.values() ?? [])]
      .sort((a, b) => a.unit.localeCompare(b.unit) || a.kind.localeCompare(b.kind));
    // Group only the same operation and exact predecessor Unit ID/kind pairs.
    const id = JSON.stringify([node.op, predecessors.map(edge => [edge.unit, edge.kind])]);
    if (!grouped.has(id)) grouped.set(id, { id, op: node.op, nodes: [], incoming: [], recordedEdges: [], predecessors, ui: 'unknown', orderUnresolved: false });
    grouped.get(id)!.nodes.push(node);
    unitGroup.set(node.unit, id);
  }
  const groups = [...grouped.values()].map(group => ({ ...group, ui: severity.find(state => group.nodes.some(node => node.ui === state)) ?? 'unknown' }));
  const dedupe = new Map<string, GroupEdge>();
  for (const edge of evidence.drawable) {
    const from = unitGroup.get(edge.from), to = unitGroup.get(edge.to);
    if (from && to && from !== to) {
      const id = JSON.stringify([from, to, edge.kind]);
      dedupe.set(id, { ...edge, from, to, records: [...(dedupe.get(id)?.records ?? []), edge] });
    }
  }
  const edges = [...dedupe.values()];
  for (const group of groups) {
    group.incoming = edges.filter(edge => edge.to === group.id);
    group.recordedEdges = graph.edges.filter(edge => unitGroup.get(edge.to) === group.id);
  }
  const depth = new Map(groups.map(group => [group.id, 0]));
  const outgoing = new Map<string, Edge[]>();
  const remaining = new Map(groups.map(group => [group.id, 0]));
  for (const edge of edges) {
    outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), edge]);
    remaining.set(edge.to, (remaining.get(edge.to) ?? 0) + 1);
  }
  const orderUnknown = new Set(groups.filter(group => group.nodes.some(node => evidence.unresolved.has(node.unit))).map(group => group.id));
  const queue = groups.filter(group => remaining.get(group.id) === 0 && !orderUnknown.has(group.id)).map(group => group.id);
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const from = queue[cursor];
    for (const edge of outgoing.get(from) ?? []) {
      depth.set(edge.to, Math.max(depth.get(edge.to) ?? 0, (depth.get(from) ?? 0) + 1));
      const count = (remaining.get(edge.to) ?? 0) - 1;
      remaining.set(edge.to, count);
      if (count === 0 && !orderUnknown.has(edge.to)) queue.push(edge.to);
    }
  }
  for (const group of groups) if ((remaining.get(group.id) ?? 0) > 0) orderUnknown.add(group.id);
  for (const group of groups) group.orderUnresolved = orderUnknown.has(group.id);
  const ordered = groups.filter(group => !orderUnknown.has(group.id));
  const layers = [...new Set(ordered.map(group => depth.get(group.id)!))].sort((a, b) => a - b).map(level => ordered.filter(group => depth.get(group.id) === level));
  const unresolvedColumn = orderUnknown.size ? layers.length : null;
  if (orderUnknown.size) layers.push(groups.filter(group => orderUnknown.has(group.id)));
  const positions = new Map<string, { x: number; y: number }>();
  const top = orderUnknown.size ? 48 : 24;
  layers.forEach((layer, x) => layer.forEach((group, y) => positions.set(group.id, { x: 24 + x * (nodeWidth + colGap), y: top + y * (nodeHeight + rowGap) })));
  return { groups: layers.flat(), edges, positions, evidence, orderUnknown, unresolvedColumn, width: Math.max(1, layers.length) * (nodeWidth + colGap) - colGap + 48, height: Math.max(1, ...layers.map(layer => layer.length)) * (nodeHeight + rowGap) - rowGap + top + 24 };
}

export function GraphView({ graph, onUnit, onGroupSelect, selectionInInspector = false }: { graph: WorkGraph; onUnit: (unit: string) => void; onGroupSelect?: (group: GraphGroup | null) => void; selectionInInspector?: boolean }) {
  const arrowId = useId();
  const [selected, setSelected] = useState<string | null>(null);
  const layout = useMemo(() => buildLayout(graph), [graph]);
  const selectedGroup = layout.groups.find(group => group.id === selected);
  const groupName = (id: string) => layout.groups.find(group => group.id === id)?.op ?? id;
  const predecessorsLabel = (group: GraphGroup) => (group.predecessors.length
    ? t('After {list}', { list: group.predecessors.map(edge => `${edge.unit} (${edge.kind})`).join(', ') })
    : t('No recorded predecessors')) + (layout.orderUnknown.has(group.id) ? ` · ${t('Dependency order unresolved')}` : '');
  const countsLabel = (group: GraphGroup) => {
    const done = group.nodes.filter(node => node.state === 'done').length;
    const unknown = group.nodes.filter(node => node.ui === 'unknown').length;
    return t('{done}/{total} units done', { done, total: group.nodes.length }) + (unknown ? ` · ${t('{n} unknown', { n: unknown })}` : '');
  };
  const edgeLabel = (edge: Edge) => `${edge.from} → ${edge.to} (${edge.kind}) · ${t('source: {source}', { source: edge.source ?? '—' })} · ${formatDayTime(edge.createdAt)}`;
  const anomalySections = [{ label: t('Missing endpoint'), rows: layout.evidence.dangling }, { label: t('Self dependency'), rows: layout.evidence.self }, { label: t('Cycle dependency'), rows: layout.evidence.cyclic }];
  const selectGroup = (group: GraphGroup) => {
    const next = selected === group.id ? null : group;
    setSelected(next?.id ?? null);
    onGroupSelect?.(next);
  };
  return <ConceptBlock concept="C4" className="min-w-0 space-y-3">
    <div className="flex items-center gap-2 text-sm text-muted-foreground"><GitBranch className="size-4" aria-hidden="true" /> {t('Unit graph · {n} units', { n: graph.nodes.length })}</div>
    {(layout.evidence.dangling.length > 0 || layout.evidence.self.length > 0 || layout.evidence.cyclic.length > 0) && <details className="rounded-lg border bg-card p-3 text-xs">
      <summary className="flex cursor-pointer items-center gap-2 font-medium"><AlertTriangle className="size-4 shrink-0" aria-hidden="true" />{t('Recorded dependency anomalies')}</summary>
      <div className="mt-3 space-y-3 text-muted-foreground">
        {anomalySections.map(({ label, rows }) => rows.length > 0 && <div key={label}><strong className="text-foreground">{label}</strong><ul className="mt-1 space-y-1">{rows.map((edge, index) => <li key={index} className="break-all font-mono">{edgeLabel(edge)}</li>)}</ul></div>)}
        <p>{t('Dependency order unresolved')}: <span className="break-all font-mono">{[...layout.evidence.unresolved].join(', ') || '—'}</span></p>
      </div>
    </details>}
    {layout.groups.length === 0 && <p className="rounded-lg border p-6 text-sm text-muted-foreground">{t('No units in the graph yet.')}</p>}
    {layout.groups.length > 0 && <>
      <div className="hidden max-w-full overflow-x-auto rounded-lg border bg-card p-2 focus-visible:outline-2 focus-visible:outline-ring md:block" tabIndex={0} aria-label={t('Unit graph with dependency arrows')}>
        <div className="relative" style={{ width: layout.width, height: layout.height }}>
          {layout.unresolvedColumn != null && <p className="absolute top-3 text-xs text-muted-foreground" style={{ left: 24 + layout.unresolvedColumn * (nodeWidth + colGap), width: nodeWidth }}>{t('Dependency order unresolved')}</p>}
          <svg className="absolute inset-0 h-full w-full overflow-visible text-muted-foreground" width={layout.width} height={layout.height} aria-hidden="true"><defs><marker id={arrowId} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" /></marker></defs>
            {layout.edges.map(edge => { const a = layout.positions.get(edge.from), b = layout.positions.get(edge.to); if (!a || !b) return null; const x1 = a.x + nodeWidth, y1 = a.y + nodeHeight / 2, x2 = b.x - 5, y2 = b.y + nodeHeight / 2, mid = x1 + Math.max(20, (x2 - x1) / 2); return <path key={JSON.stringify([edge.from, edge.to, edge.kind])} d={`M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`} fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray={edgeDash(edge.kind)} markerEnd={`url(#${arrowId})`}><title>{`${groupName(edge.from)} → ${groupName(edge.to)} (${edge.kind})\n${edge.records.map(edgeLabel).join('\n')}`}</title></path>; })}
          </svg>
          {layout.groups.map(group => { const pos = layout.positions.get(group.id); if (!pos) return null; const unknown = group.nodes.filter(node => node.ui === 'unknown').length; return <button key={group.id} type="button" onClick={() => selectGroup(group)} aria-expanded={selected === group.id} title={`${predecessorsLabel(group)}\n${countsLabel(group)}`} style={{ left: pos.x, top: pos.y, width: nodeWidth, height: nodeHeight }} className={`absolute flex min-w-0 flex-col justify-center rounded-lg border bg-card px-3 text-left hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-ring ${selected === group.id ? 'border-foreground ring-1 ring-foreground' : ''}`}><span className="truncate text-sm font-semibold" title={group.op}>{group.op} ×{group.nodes.length}</span><span className="mt-1 flex items-center gap-2"><StateChip state={group.ui} compact />{unknown > 0 && <span className="text-xs text-muted-foreground">{t('{n} unknown', { n: unknown })}</span>}</span><span className="mt-0.5 truncate text-xs text-muted-foreground">{t('{done}/{total} units done', { done: group.nodes.filter(node => node.state === 'done').length, total: group.nodes.length })}</span></button>; })}
        </div>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-hidden="true">{[...new Set(layout.edges.map(edge => edge.kind))].map(kind => <span key={kind} className="inline-flex items-center gap-1.5"><svg width="24" height="8"><line x1="0" y1="4" x2="24" y2="4" stroke="currentColor" strokeWidth="1.5" strokeDasharray={edgeDash(kind)} /></svg>{kind}</span>)}</div>
      <div className="space-y-2 md:hidden" aria-label={t('Unit list by dependency')}>{layout.groups.map(group => <div key={group.id} className="rounded-lg border bg-card"><button type="button" onClick={() => selectGroup(group)} aria-expanded={selected === group.id} className="flex w-full min-w-0 items-center gap-2 p-3 text-left focus-visible:outline-2 focus-visible:outline-ring">{selected === group.id ? <ChevronDown className="size-4 shrink-0" aria-hidden="true" /> : <ChevronRight className="size-4 shrink-0" aria-hidden="true" />}<span className="min-w-0 flex-1"><strong className="block truncate text-sm">{group.op} ×{group.nodes.length}</strong><span className="block truncate text-xs text-muted-foreground" title={predecessorsLabel(group)}>{predecessorsLabel(group)}</span><span className="block text-xs text-muted-foreground">{countsLabel(group)}</span></span><StateChip state={group.ui} compact /></button></div>)}</div>
      {selectedGroup && <div className={selectionInInspector ? 'rounded-lg border bg-card p-3 lg:hidden' : 'rounded-lg border bg-card p-3'}>
        <div className="mb-2 space-y-1"><strong className="text-sm">{selectedGroup.op} ×{selectedGroup.nodes.length}</strong><p className="break-words text-xs text-muted-foreground">{predecessorsLabel(selectedGroup)}</p><p className="text-xs text-muted-foreground">{countsLabel(selectedGroup)}</p></div>
        <div className="grid gap-1 sm:grid-cols-2">{selectedGroup.nodes.map(node => <button type="button" key={node.unit} onClick={() => onUnit(node.unit)} className="flex min-w-0 items-start gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-ring"><span className="min-w-0 flex-1"><span className="block truncate font-medium" title={node.title}>{node.title}</span><span className="block break-all font-mono text-xs text-muted-foreground">{node.unit} · {node.state}</span><span className="mt-1 block break-all text-xs text-muted-foreground">{t('Workflow')}: {node.workflowId ?? '—'} · {node.goalRevision == null ? t('Goal revision not recorded') : t('Goal revision {n}', { n: node.goalRevision })}</span><span className="block break-all text-xs text-muted-foreground">{t('Subject key')}: <span className="font-mono">{node.subjectKey ?? '—'}</span></span><span className="block break-all text-xs text-muted-foreground">{t('Current job')}: <span className="font-mono">{node.currentJob ?? '—'}</span></span></span><StateChip state={node.ui} compact /></button>)}</div>
        {selectedGroup.recordedEdges.length > 0 && <details className="mt-3 border-t pt-3 text-xs"><summary className="cursor-pointer font-medium">{t('Recorded incoming edges')}</summary><ul className="mt-2 space-y-1 text-muted-foreground">{selectedGroup.recordedEdges.map((edge, index) => <li key={index} className="break-all font-mono">{edgeLabel(edge)}</li>)}</ul></details>}
      </div>}
    </>}
  </ConceptBlock>;
}
