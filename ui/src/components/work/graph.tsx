import { useId, useMemo, useRef, useState } from 'react';
import { Button, Card } from '@heroui/react';
import { AlertTriangle, ChevronDown, ChevronRight, GitBranch } from 'lucide-react';
import type { ContractInfo, GraphEdge, GraphNode, UiState } from '../../contract';
import { StateChip } from '../state-chip';
import { ConceptBlock, type Concept } from '../concept';
import { formatDayTime } from './leg/time';
import { t } from '../../i18n/t';
import { Advanced } from '../motion';
import { formatOpLabel } from '../../i18n/vi';
import { useNodeHeights } from './use-node-heights';

export const concept: Concept = 'C4';
export type WorkGraph = { nodes: GraphNode[]; edges: GraphEdge[]; groups: { op: string; total: number; byUi: Record<UiState, number> }[] };
type Predecessor = { unit: string; kind: string };
export type GraphGroup = { id: string; op: string; nodes: GraphNode[]; incoming: GraphEdge[]; recordedEdges: GraphEdge[]; predecessors: Predecessor[]; ui: UiState; orderUnresolved: boolean };
type GroupEdge = GraphEdge & { records: GraphEdge[] };
type Dependency = { from: string; to: string };
const severity: UiState[] = ['bad', 'warn', 'running', 'waiting', 'unknown', 'ok', 'done'];
const nodeWidth = 256, nodeHeight = 160, colGap = 48, rowGap = 16;
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
      const top = stack.at(-1)!;
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
  for (const unit of queue) for (const next of outgoing.get(unit) ?? []) {
    if (!unresolved.has(next)) { unresolved.add(next); queue.push(next); }
  }
  return { drawable, dangling, self, cyclic, unresolved };
}

function buildLayout(graph: WorkGraph, measuredHeights: ReadonlyMap<string, number>) {
  const evidence = graphEvidenceOf(graph.nodes.map(node => node.unit), graph.edges);
  const incomingByUnit = new Map<string, Map<string, Predecessor>>();
  for (const edge of graph.edges) {
    const incoming = incomingByUnit.get(edge.to) ?? new Map<string, Predecessor>();
    incoming.set(JSON.stringify([edge.from, edge.kind]), { unit: edge.from, kind: edge.kind });
    incomingByUnit.set(edge.to, incoming);
  }
  const grouped = new Map<string, GraphGroup>();
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
  const outgoing = new Map<string, GraphEdge[]>();
  const remaining = new Map(groups.map(group => [group.id, 0]));
  for (const edge of edges) {
    outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), edge]);
    remaining.set(edge.to, (remaining.get(edge.to) ?? 0) + 1);
  }
  const orderUnknown = new Set(groups.filter(group => group.nodes.some(node => evidence.unresolved.has(node.unit))).map(group => group.id));
  const queue = groups.filter(group => remaining.get(group.id) === 0 && !orderUnknown.has(group.id)).map(group => group.id);
  for (const from of queue) {
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
  const positions = new Map<string, { x: number; y: number; height: number }>();
  const top = orderUnknown.size ? 48 : 24;
  let bottom = top + nodeHeight;
  layers.forEach((layer, x) => {
    let y = top;
    for (const group of layer) {
      const height = Math.max(nodeHeight, measuredHeights.get(group.id) ?? nodeHeight);
      positions.set(group.id, { x: 24 + x * (nodeWidth + colGap), y, height });
      y += height + rowGap;
    }
    bottom = Math.max(bottom, y - rowGap);
  });
  return { groups: layers.flat(), edges, positions, evidence, orderUnknown, unresolvedColumn, width: Math.max(1, layers.length) * (nodeWidth + colGap) - colGap + 48, height: bottom + 24 };
}

export function GraphView({ graph, onUnit, onGroupSelect, selectionInInspector = false, opLabels }: { readonly graph: WorkGraph; readonly onUnit: (unit: string) => void; readonly onGroupSelect?: (group: GraphGroup | null) => void; readonly selectionInInspector?: boolean; readonly opLabels?: ContractInfo['opLabels'] }) {
  const arrowId = useId();
  const holder = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const nodeHeights = useNodeHeights(holder, { selector: '[data-graph-group]', dataKey: 'graphGroup', source: graph });
  const layout = useMemo(() => buildLayout(graph, nodeHeights), [graph, nodeHeights]);
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
  const edgeLabel = (edge: GraphEdge) => `${edge.from} → ${edge.to} (${edge.kind}) · ${t('source: {source}', { source: edge.source ?? '—' })} · ${formatDayTime(edge.createdAt)}`;
  const anomalySections = [{ label: t('Missing endpoint'), rows: layout.evidence.dangling }, { label: t('Self dependency'), rows: layout.evidence.self }, { label: t('Cycle dependency'), rows: layout.evidence.cyclic }];
  const selectGroup = (group: GraphGroup) => {
    const next = selected === group.id ? null : group;
    setSelected(next?.id ?? null);
    onGroupSelect?.(next);
  };
  return <ConceptBlock concept="C4" className="min-w-0 space-y-3">
    <div className="flex items-center gap-2 text-sm text-muted-foreground"><GitBranch className="size-4" aria-hidden="true" /> {t('Unit graph · {n} units', { n: graph.nodes.length })}</div>
    {(layout.evidence.dangling.length > 0 || layout.evidence.self.length > 0 || layout.evidence.cyclic.length > 0) && <Advanced keepMounted title={<span className="flex items-center gap-2"><AlertTriangle className="size-4 shrink-0" aria-hidden="true" />{t('Recorded dependency anomalies')}</span>}>
      <div className="mt-3 space-y-3 text-muted-foreground">
        {anomalySections.map(({ label, rows }) => rows.length > 0 && <div key={label}><strong className="text-foreground">{label}</strong><ul className="mt-1 space-y-1">{rows.map(edge => <li key={`${edge.from}:${edge.to}:${edge.kind}:${edge.source}:${edge.createdAt}`} className="break-all font-mono">{edgeLabel(edge)}</li>)}</ul></div>)}
        <p>{t('Dependency order unresolved')}: <span className="break-all font-mono">{[...layout.evidence.unresolved].join(', ') || '—'}</span></p>
      </div>
    </Advanced>}
    {layout.groups.length === 0 && <p className="py-6 text-sm text-muted-foreground">{t('No units in the graph yet.')}</p>}
    {layout.groups.length > 0 && <>
      <div ref={holder} className="hidden max-w-full overflow-x-auto p-2 focus-visible:outline-2 focus-visible:outline-ring md:block" tabIndex={0} role="region" aria-label={t('Unit graph with dependency arrows')}>
        <div className="relative" style={{ width: layout.width, height: layout.height }}>
          {layout.unresolvedColumn != null && <p className="absolute top-3 text-xs text-muted-foreground" style={{ left: 24 + layout.unresolvedColumn * (nodeWidth + colGap), width: nodeWidth }}>{t('Dependency order unresolved')}</p>}
          <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible text-muted-foreground" width={layout.width} height={layout.height} aria-hidden="true"><defs><marker id={arrowId} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" /></marker></defs>
            {layout.edges.map(edge => { const a = layout.positions.get(edge.from), b = layout.positions.get(edge.to); if (!a || !b) return null; const x1 = a.x + nodeWidth, y1 = a.y + a.height / 2, x2 = b.x - 5, y2 = b.y + b.height / 2, mid = x1 + Math.max(20, (x2 - x1) / 2); return <path key={JSON.stringify([edge.from, edge.to, edge.kind])} d={`M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`} fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray={edgeDash(edge.kind)} markerEnd={`url(#${arrowId})`}><title>{`${groupName(edge.from)} → ${groupName(edge.to)} (${edge.kind})\n${edge.records.map(edgeLabel).join('\n')}`}</title></path>; })}
          </svg>
          {layout.groups.map(group => {
            const pos = layout.positions.get(group.id); if (!pos) return null;
            const unknown = group.nodes.filter(node => node.ui === 'unknown').length;
            return <Card key={group.id} data-graph-group={group.id} title={`${predecessorsLabel(group)}\n${countsLabel(group)}`} style={{ left: pos.x, top: pos.y, width: nodeWidth, minHeight: nodeHeight }} className={`absolute min-w-0 p-0 ${selected === group.id ? 'ring-1 ring-foreground' : ''}`}><Button variant="ghost" onPress={() => selectGroup(group)} aria-expanded={selected === group.id}
              aria-label={`${formatOpLabel(group.op, opLabels)} (${group.op}) · ${countsLabel(group)}`}
              style={{ minHeight: nodeHeight }} className="h-auto w-full min-w-0 flex-col items-stretch justify-start gap-2 whitespace-normal rounded-[inherit] p-3 text-left">
              <span className="break-words text-base font-semibold leading-6">{formatOpLabel(group.op, opLabels)} ×{group.nodes.length}</span>
              <span className="truncate font-mono text-xs text-muted-foreground" title={group.op}>{group.op}</span>
              <span className="flex flex-wrap items-center gap-2"><StateChip state={group.ui} compact />{unknown > 0 && <span className="text-xs text-muted-foreground">{t('{n} unknown', { n: unknown })}</span>}</span>
              <span className="text-xs font-normal text-muted-foreground">{t('{done}/{total} units done', { done: group.nodes.filter(node => node.state === 'done').length, total: group.nodes.length })}</span>
            </Button></Card>;
          })}
        </div>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-hidden="true">{[...new Set(layout.edges.map(edge => edge.kind))].map(kind => <span key={kind} className="inline-flex items-center gap-1.5"><svg width="24" height="8"><line x1="0" y1="4" x2="24" y2="4" stroke="currentColor" strokeWidth="1.5" strokeDasharray={edgeDash(kind)} /></svg>{kind}</span>)}</div>
      <div className="space-y-2 md:hidden" aria-label={t('Unit list by dependency')}>{layout.groups.map(group => <Card key={group.id} className="p-0"><Button variant="ghost" onPress={() => selectGroup(group)} aria-expanded={selected === group.id} className="h-auto w-full min-w-0 items-start gap-2 whitespace-normal rounded-[inherit] p-3 text-left">{selected === group.id ? <ChevronDown className="size-4 shrink-0" aria-hidden="true" /> : <ChevronRight className="size-4 shrink-0" aria-hidden="true" />}<span className="min-w-0 flex-1"><strong className="block break-words text-base">{formatOpLabel(group.op, opLabels)} ×{group.nodes.length}</strong><span className="block truncate font-mono text-xs text-muted-foreground" title={group.op}>{group.op}</span><span className="block break-words text-xs font-normal text-muted-foreground">{predecessorsLabel(group)}</span><span className="block text-xs font-normal text-muted-foreground">{countsLabel(group)}</span></span><StateChip state={group.ui} compact /></Button></Card>)}</div>
      {selectedGroup && <Card variant="transparent" className={selectionInInspector ? 'lg:hidden' : undefined}>
        <div className="mb-2 space-y-1"><strong className="text-base">{formatOpLabel(selectedGroup.op, opLabels)} ×{selectedGroup.nodes.length}</strong><p className="break-all font-mono text-xs text-muted-foreground">{selectedGroup.op}</p><p className="break-words text-xs text-muted-foreground">{predecessorsLabel(selectedGroup)}</p><p className="text-xs text-muted-foreground">{countsLabel(selectedGroup)}</p></div>
        <div className="grid gap-1 sm:grid-cols-2">{selectedGroup.nodes.map(node => <Button variant="ghost" key={node.unit} onPress={() => onUnit(node.unit)} className="h-auto min-w-0 items-start gap-2 whitespace-normal px-2 py-2 text-left text-sm"><span className="min-w-0 flex-1"><span className="block break-words font-medium">{node.title}</span><span className="block break-all font-mono text-xs font-normal text-muted-foreground">{node.unit} · {node.state}</span><span className="mt-1 block break-all text-xs font-normal text-muted-foreground">{t('Workflow')}: {node.workflowId ?? '—'} · {node.goalRevision == null ? t('Goal revision not recorded') : t('Goal revision {n}', { n: node.goalRevision })}</span><span className="block break-all text-xs font-normal text-muted-foreground">{t('Subject key')}: <span className="font-mono">{node.subjectKey ?? '—'}</span></span><span className="block break-all text-xs font-normal text-muted-foreground">{t('Current job')}: <span className="font-mono">{node.currentJob ?? '—'}</span></span></span><StateChip state={node.ui} compact /></Button>)}</div>
        {selectedGroup.recordedEdges.length > 0 && <Advanced keepMounted className="mt-3" title={t('Recorded incoming edges')}><ul className="space-y-1 text-xs text-muted-foreground">{selectedGroup.recordedEdges.map(edge => <li key={`${edge.from}:${edge.to}:${edge.kind}:${edge.source}:${edge.createdAt}`} className="break-all font-mono">{edgeLabel(edge)}</li>)}</ul></Advanced>}
      </Card>}
    </>}
  </ConceptBlock>;
}
