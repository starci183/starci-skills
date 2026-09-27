import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Background, Handle, Panel, MarkerType, Position, ReactFlow, type Edge, type Node, type NodeProps, type ReactFlowInstance } from '@xyflow/react';
import { Graph, layout as dagreLayout } from '@dagrejs/dagre';
import '@xyflow/react/dist/style.css';
import type { LegColor, LegUnits, Unit } from './types';

/** The owner's four colours. */
export const colorView: Record<LegColor, { name: string; text: string; dot: string; node: string; stroke: string }> = {
  green: { name: 'Cook xong', text: 'text-emerald-400', dot: 'bg-emerald-500', node: 'border-emerald-500/60 bg-emerald-950', stroke: '#10b981' },
  yellow: { name: 'Đang cook', text: 'text-yellow-400', dot: 'bg-yellow-400', node: 'border-yellow-400/70 bg-yellow-950', stroke: '#facc15' },
  red: { name: 'Về lại', text: 'text-red-400', dot: 'bg-red-500', node: 'border-red-500/70 bg-red-950', stroke: '#ef4444' },
  gray: { name: 'Chưa tới', text: 'text-zinc-500', dot: 'bg-zinc-600', node: 'border-zinc-700 bg-zinc-900', stroke: '#52525b' },
};
export const colorOrder = Object.keys(colorView) as LegColor[];

export type FlowEdgeKind = 'data' | 'contract' | 'order' | 'contains' | 'plan';
export const edgeView: Record<FlowEdgeKind, { name: string; dash?: string; width: number }> = {
  data: { name: 'dữ liệu', width: 1.6 },
  contract: { name: 'hợp đồng', dash: '7 4', width: 1.6 },
  order: { name: 'thứ tự', dash: '1.5 4', width: 2 },
  contains: { name: 'thuộc slice', width: 1 },
  plan: { name: 'phụ thuộc', width: 1.6 },
};

export interface FlowNodeIn {
  id: string; title: string; opLine: string | null; sub: string; color: LegColor; ready?: boolean; lane?: string;
  units?: LegUnits | null; strong?: boolean;
}
export interface FlowEdgeIn { from: string; to: string; kind: FlowEdgeKind }

// A unit's state in the owner's words: done, running now, waiting (queued / planned / not reached), failed.
type UnitState = 'done' | 'running' | 'waiting' | 'failed' | 'other';
export const unitState = (status: string): UnitState => (status === 'succeeded' || status === 'green' ? 'done'
  : ['running', 'leased', 'answering', 'yellow'].includes(status) ? 'running'
    : ['queued', 'planned', 'gray'].includes(status) ? 'waiting'
      : status === 'failed' || status === 'red' ? 'failed' : 'other');
export const unitMark: Record<UnitState, { mark: string; tone: string; name: string }> = {
  done: { mark: '✓', tone: 'text-emerald-400', name: 'xong' },
  running: { mark: '▶', tone: 'text-yellow-300', name: 'đang chạy' },
  waiting: { mark: '⏳', tone: 'text-zinc-400', name: 'đang chờ' },
  failed: { mark: '✗', tone: 'text-red-400', name: 'hỏng / làm lại' },
  other: { mark: '·', tone: 'text-zinc-500', name: 'khác' },
};
const SLOT_WAIT = ['max-ops', 'pool-full'];
/** "k chờ slot (trần N)" when waiting units are held only by the slot ceiling. */
export function slotWait(units: Unit[]): string | null {
  const waiting = units.filter((unit) => unitState(unit.status) === 'waiting' && unit.jobId);
  const slot = waiting.filter((unit) => SLOT_WAIT.includes(unit.queuedBecause ?? ''));
  if (!slot.length) return null;
  const ceiling = Math.max(0, ...slot.map((unit) => unit.ceiling ?? 0));
  const held = Math.max(0, ...slot.map((unit) => unit.slotsHeld ?? 0));
  return `${slot.length === waiting.length ? '' : `${slot.length} `}chờ slot${ceiling ? ` ${held || ceiling}/${ceiling}` : ''}`;
}
export function unitCounts(units: Unit[]) {
  const counts: Record<UnitState, number> = { done: 0, running: 0, waiting: 0, failed: 0, other: 0 };
  for (const unit of units) counts[unitState(unit.status)]++;
  return counts;
}

/** ×N with its breakdown by state; nothing when N = 1. */
export function UnitBadge({ units }: { units?: LegUnits | null }) {
  if (!units || units.total <= 1) return null;
  if (units.planned) return <span className="inline-flex items-center rounded border border-zinc-700 px-1.5 text-[10px] text-zinc-400" title={`Dự kiến ${units.total} phần song song; chưa có job`}>×{units.total} dự kiến</span>;
  const counts = unitCounts(units.units);
  const slot = slotWait(units.units);
  const list = units.units.map((unit) => `${unitMark[unitState(unit.status)].mark} ${unit.label}${unit.jobId ? ` — ${unit.jobId}` : ''} (${unit.status}${unit.model ? `, ${unit.model}` : ''}${unit.queuedBecause ? `, ${unit.queuedBecause}` : ''})`).join('\n');
  return <span className="inline-flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px]" title={list}>
    <span className="rounded border border-sky-500/40 bg-sky-500/10 px-1.5 font-semibold text-sky-300">×{units.total}</span>
    {(['done', 'running', 'waiting', 'failed'] as UnitState[]).filter((state) => counts[state]).map((state, index) => <span key={state} className={unitMark[state].tone}>{index ? '· ' : ''}{counts[state]} {unitMark[state].mark}</span>)}
    {slot && <span className="text-amber-300">· {slot}</span>}
  </span>;
}

const NODE_W = 232;
const NODE_H = 86;
type DagData = FlowNodeIn & { picked: boolean } & Record<string, unknown>;

const DagNode = memo(function DagNode({ data }: NodeProps<Node<DagData>>) {
  const view = colorView[data.color];
  return <div className={`relative flex h-full w-full cursor-pointer flex-col justify-between overflow-hidden rounded-lg border px-2.5 py-1.5 text-left shadow-sm ${view.node} ${data.ready ? 'outline outline-2 outline-offset-2 outline-violet-500' : ''} ${data.picked ? 'ring-2 ring-zinc-100' : ''}`}
    title={`${data.title}${data.opLine ? `\n${data.opLine}` : ''}\n${data.sub}\n${view.name}${data.ready ? ' · chạy được ngay' : ''}`} data-color={data.color} data-node={data.id}>
    <Handle type="target" position={Position.Left} className="!size-1.5 !min-h-0 !min-w-0 !border-0 !bg-zinc-500" isConnectable={false} />
    <span className={`absolute inset-y-0 left-0 w-1 ${view.dot}`} />
    <div className="flex items-start gap-1.5 pl-1">
      <span className={`line-clamp-2 text-[11.5px] leading-[15px] text-zinc-50 ${data.strong ? 'font-semibold' : 'font-medium'}`}>{data.title}</span>
      {data.color === 'yellow' && <span className="ml-auto mt-1 size-2 shrink-0 animate-pulse rounded-full bg-yellow-400" />}
    </div>
    {data.opLine && <div className="truncate pl-1 font-mono text-[10px] text-sky-300/90">{data.opLine}</div>}
    <div className="flex min-w-0 items-center gap-2 pl-1">
      <span className="truncate text-[10px] text-zinc-400">{data.sub}</span>
      <span className="ml-auto shrink-0"><UnitBadge units={data.units} /></span>
    </div>
    <Handle type="source" position={Position.Right} className="!size-1.5 !min-h-0 !min-w-0 !border-0 !bg-zinc-500" isConnectable={false} />
  </div>;
});

const LaneNode = memo(function LaneNode({ data }: NodeProps<Node<{ label: string }>>) {
  return <div className="pointer-events-none h-full w-full rounded-xl border border-dashed border-zinc-700/80 bg-zinc-900/30">
    <span className="absolute left-3 top-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-500">{data.label}</span>
  </div>;
});
const nodeTypes = { dag: DagNode, lane: LaneNode };

/**
 * Layered left-to-right layout (dagre): rank by longest path, crossings cut by dagre's ordering; nodes of one lane
 * (a domain) sit in one cluster.
 */
function layoutOf(nodes: FlowNodeIn[], edges: FlowEdgeIn[]) {
  const lanes = [...new Set(nodes.map((node) => node.lane).filter((lane): lane is string => Boolean(lane)))];
  const g = new Graph({ compound: lanes.length > 0 });
  g.setGraph({ rankdir: 'LR', nodesep: 14, ranksep: 64, marginx: 12, marginy: 12, ranker: 'longest-path' });
  g.setDefaultEdgeLabel(() => ({}));
  for (const lane of lanes) g.setNode(`lane:${lane}`, { label: lane, paddingTop: 28, paddingLeft: 14, paddingRight: 14, paddingBottom: 14 } as never);
  for (const node of nodes) {
    g.setNode(node.id, { width: NODE_W, height: NODE_H });
    if (node.lane) g.setParent(node.id, `lane:${node.lane}`);
  }
  const known = new Set(nodes.map((node) => node.id));
  for (const edge of edges) if (known.has(edge.from) && known.has(edge.to) && edge.from !== edge.to) g.setEdge(edge.from, edge.to, { weight: edge.kind === 'contains' ? 1 : 2 } as never);
  dagreLayout(g);
  const box = (id: string) => g.node(id) as unknown as { x: number; y: number; width: number; height: number };
  const size = g.graph() as unknown as { width: number; height: number };
  return { lanes: lanes.map((lane) => ({ lane, ...box(`lane:${lane}`) })), at: (id: string) => box(id), width: size.width, height: size.height };
}

export function FlowLegend({ kinds }: { kinds: FlowEdgeKind[] }) {
  return <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-zinc-500">
    {kinds.map((kind) => <span key={kind} className="inline-flex items-center gap-1.5">
      <svg width="30" height="8" aria-hidden="true"><line x1="1" y1="4" x2="24" y2="4" strokeWidth={edgeView[kind].width} strokeDasharray={edgeView[kind].dash} strokeLinecap={kind === 'order' ? 'round' : undefined} stroke={kind === 'contains' ? '#52525b' : '#d4d4d8'} /><path d="M23,1 L29,4 L23,7 z" fill={kind === 'contains' ? '#52525b' : '#d4d4d8'} /></svg>{edgeView[kind].name}</span>)}
    <span className="inline-flex items-center gap-1.5"><svg width="24" height="8" aria-hidden="true"><line x1="1" y1="4" x2="23" y2="4" strokeWidth={1.6} stroke="#10b981" /></svg>nguồn đã xong</span>
    <span className="inline-flex items-center gap-1.5"><span className="rounded border border-sky-500/40 bg-sky-500/10 px-1 text-[10px] font-semibold text-sky-300">×N</span>phần chạy song song: ✓ xong · ▶ đang chạy · ⏳ chờ · ✗ hỏng</span>
  </div>;
}

/** A pannable, zoomable DAG (xyflow) of `nodes` and `edges`; a click on a node calls `onPick`. */
export function FlowDag({ nodes, edges, picked, onPick, testId }: { nodes: FlowNodeIn[]; edges: FlowEdgeIn[]; picked: string | null; onPick: (id: string) => void; testId?: string }) {
  const placed = useMemo(() => layoutOf(nodes, edges), [nodes, edges]);
  const colorOf = useMemo(() => new Map(nodes.map((node) => [node.id, node.color])), [nodes]);
  const flowNodes = useMemo<Node[]>(() => [
    ...placed.lanes.map((lane) => ({ id: `lane:${lane.lane}`, type: 'lane', position: { x: lane.x - lane.width / 2, y: lane.y - lane.height / 2 }, data: { label: lane.lane },
      style: { width: lane.width, height: lane.height }, draggable: false, selectable: false, focusable: false, zIndex: -1 })),
    ...nodes.map((node) => {
      const at = placed.at(node.id);
      return { id: node.id, type: 'dag', position: { x: at.x - NODE_W / 2, y: at.y - NODE_H / 2 }, data: { ...node, picked: picked === node.id }, style: { width: NODE_W, height: NODE_H }, draggable: false, connectable: false };
    }),
  ], [placed, nodes, picked]);
  const flowEdges = useMemo<Edge[]>(() => edges.filter((edge) => colorOf.has(edge.from) && colorOf.has(edge.to)).map((edge) => {
    const soft = edge.kind === 'contains';
    const done = colorOf.get(edge.from) === 'green';
    const stroke = soft ? '#3f3f46' : done ? '#10b981' : '#a1a1aa';
    const near = !picked || edge.from === picked || edge.to === picked;
    return { id: `${edge.from}>${edge.to}>${edge.kind}`, source: edge.from, target: edge.to, type: 'default', focusable: false,
      style: { stroke, strokeWidth: edgeView[edge.kind].width, strokeDasharray: edgeView[edge.kind].dash, strokeLinecap: edge.kind === 'order' ? 'round' : undefined, opacity: near ? 1 : 0.18 },
      markerEnd: { type: MarkerType.ArrowClosed, color: stroke, width: 14, height: 14 } };
  }), [edges, colorOf, picked]);
  // The box is as tall as the graph at the zoom that fits its width (never under a readable zoom on a phone); a
  // resize (a <details> opening, a rotated phone) fits the view again.
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [flow, setFlow] = useState<ReactFlowInstance | null>(null);
  useEffect(() => {
    const element = box.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const narrow = width > 0 && width < 640;
  const fit = useMemo(() => ({ padding: 0.04, maxZoom: 1, minZoom: narrow ? 0.55 : 0.15 }), [narrow]);
  const zoom = Math.max(fit.minZoom, Math.min(1, (width || 1000) / (placed.width + 24)));
  const height = Math.round(Math.max(300, Math.min(narrow ? 560 : 1100, placed.height * zoom + 32)));
  useEffect(() => { if (flow && width) void flow.fitView(fit); }, [flow, width, height, fit]);
  return <div ref={box} className="w-full min-w-0 overflow-hidden rounded-lg border border-zinc-800/70 bg-zinc-950" style={{ height }} data-testid={testId}>
    <ReactFlow nodes={flowNodes} edges={flowEdges} nodeTypes={nodeTypes} colorMode="dark" onInit={setFlow} fitView fitViewOptions={fit} minZoom={0.15} maxZoom={2}
      nodesDraggable={false} nodesConnectable={false} elementsSelectable={false} zoomOnScroll={false} panOnScroll={false} preventScrolling={false} zoomOnPinch zoomOnDoubleClick
      onNodeClick={(_, node) => { if (node.type === 'dag') onPick(node.id); }} proOptions={{ hideAttribution: true }}>
      <Background gap={20} size={1} color="#27272a" />
      <Panel position="bottom-left" className="flex gap-1.5">
        <button type="button" aria-label="Phóng to" onClick={() => void flow?.zoomIn()} className="size-8 rounded-full border border-zinc-700 bg-zinc-900 text-sm text-zinc-200 hover:bg-zinc-800">+</button>
        <button type="button" aria-label="Thu nhỏ" onClick={() => void flow?.zoomOut()} className="size-8 rounded-full border border-zinc-700 bg-zinc-900 text-sm text-zinc-200 hover:bg-zinc-800">−</button>
        <button type="button" onClick={() => void flow?.fitView(fit)} className="h-8 rounded-full border border-zinc-700 bg-zinc-900 px-3 text-xs text-zinc-200 hover:bg-zinc-800" data-testid="dag-fit">Vừa khung</button>
      </Panel>
    </ReactFlow>
  </div>;
}
