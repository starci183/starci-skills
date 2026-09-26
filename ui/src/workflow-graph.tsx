import { useEffect, useMemo, useRef, useState } from 'react';
import { GitFork, GitMerge, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { LegColor, LegRow, WorkflowRow } from './types';

// The owner's four leg colors. `api status` sets them; the UI derives one only when status carries none.
const colorView: Record<LegColor, { text: string; node: string; dot: string; name: string }> = {
  green: { name: 'Cook xong', text: 'text-emerald-400', node: 'border-emerald-500/50 bg-emerald-500/10', dot: 'bg-emerald-500' },
  yellow: { name: 'Đang cook', text: 'text-yellow-400', node: 'border-yellow-400/60 bg-yellow-400/10', dot: 'bg-yellow-400 animate-pulse' },
  red: { name: 'Về lại', text: 'text-red-400', node: 'border-red-500/60 bg-red-500/10', dot: 'bg-red-500' },
  gray: { name: 'Chưa tới', text: 'text-zinc-500', node: 'border-zinc-800 bg-zinc-900/40', dot: 'bg-zinc-600' },
};
const colors = Object.keys(colorView) as LegColor[];

function derivedColor(leg: LegRow): LegColor {
  if (leg.rework || leg.state === 'failed') return 'red';
  if (leg.state === 'running') return 'yellow';
  if (leg.state === 'done') return 'green';
  return 'gray';
}

interface Layout { ops: string[]; edges: [string, string][]; layer: Map<string, number>; rows: string[][]; linear: boolean }

/** Longest-path layers over the leg DAG; a plan without edges is the linear chain. */
function layout(legs: LegRow[], plan: WorkflowRow['plan']): Layout {
  const ops = legs.map((leg) => leg.op);
  const known = new Set(ops);
  const planned = (plan?.edges || []).filter(([from, to]) => known.has(from) && known.has(to) && from !== to);
  const linear = !plan || plan.source === 'linear' || (!planned.length && ops.length > 1);
  const edges: [string, string][] = linear ? ops.slice(1).map((op, index) => [ops[index], op]) : planned;
  const indegree = new Map(ops.map((op) => [op, 0]));
  for (const [, to] of edges) indegree.set(to, (indegree.get(to) || 0) + 1);
  const layer = new Map<string, number>();
  const ready = ops.filter((op) => !indegree.get(op));
  for (const op of ready) layer.set(op, 0);
  while (ready.length) {
    const op = ready.shift()!;
    for (const [from, to] of edges) if (from === op) {
      layer.set(to, Math.max(layer.get(to) ?? 0, (layer.get(op) ?? 0) + 1));
      indegree.set(to, (indegree.get(to) || 0) - 1);
      if (!indegree.get(to)) ready.push(to);
    }
  }
  // A cycle never comes from plan-edges; if one does, its legs go below the rest in leg order.
  let tail = Math.max(-1, ...layer.values());
  for (const op of ops) if (!layer.has(op)) layer.set(op, ++tail);
  const rows: string[][] = [];
  for (const op of ops) (rows[layer.get(op)!] ||= []).push(op);
  // Order each row by the mean position of its parents so fan-in edges cross as little as possible.
  const position = new Map<string, number>();
  for (const row of rows.filter(Boolean)) {
    const centre = (op: string) => {
      const parents = edges.filter(([, to]) => to === op).map(([from]) => position.get(from)).filter((value): value is number => value != null);
      return parents.length ? parents.reduce((sum, value) => sum + value, 0) / parents.length : ops.indexOf(op) / ops.length;
    };
    row.sort((a, b) => centre(a) - centre(b) || ops.indexOf(a) - ops.indexOf(b));
    row.forEach((op, index) => position.set(op, (index + 0.5) / row.length));
  }
  return { ops, edges, layer, rows: rows.filter(Boolean), linear };
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(640);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

const NODE_H = 58;
const GAP_X = 12;
const GAP_Y = 34;

export function LegGraph({ wf, labelOf, ageOf }: { wf: WorkflowRow; labelOf: (op: string) => string; ageOf: (value: number | null) => string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const graph = useMemo(() => layout(wf.legs, wf.plan), [wf.legs, wf.plan]);
  if (!wf.legs.length) return <p className="text-sm text-zinc-500">Chưa đọc được chuỗi công việc.</p>;
  const legByOp = new Map(wf.legs.map((leg) => [leg.op, leg]));
  const colorOf = (op: string) => legByOp.get(op)?.color || derivedColor(legByOp.get(op)!);
  const fromStatus = wf.legs.some((leg) => leg.color);
  const widest = Math.max(...graph.rows.map((row) => row.length));
  const nodeW = Math.max(84, Math.min(230, (width - (widest - 1) * GAP_X) / widest));
  const box = new Map<string, { x: number; y: number }>();
  graph.rows.forEach((row, rowIndex) => {
    const rowWidth = row.length * nodeW + (row.length - 1) * GAP_X;
    row.forEach((op, index) => box.set(op, { x: (width - rowWidth) / 2 + index * (nodeW + GAP_X), y: rowIndex * (NODE_H + GAP_Y) }));
  });
  const height = graph.rows.length * (NODE_H + GAP_Y) - GAP_Y;
  const out = (op: string) => graph.edges.filter(([from]) => from === op).length;
  const into = (op: string) => graph.edges.filter(([, to]) => to === op).length;
  const counts = Object.fromEntries(colors.map((color) => [color, graph.ops.filter((op) => colorOf(op) === color).length])) as Record<LegColor, number>;
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
      {colors.map((color) => <span key={color} className="inline-flex items-center gap-1.5 text-zinc-400"><span className={`size-2.5 rounded-full ${colorView[color].dot.replace(' animate-pulse', '')}`} /><span>{colorView[color].name}</span><span className="tabular-nums text-zinc-600">{counts[color]}</span></span>)}
      <span className="inline-flex items-center gap-1 text-zinc-500"><GitFork className="size-3.5" /><span>tách nhánh</span></span>
      <span className="inline-flex items-center gap-1 text-zinc-500"><GitMerge className="size-3.5" /><span>gộp nhánh</span></span>
    </div>
    <div ref={ref} className="relative w-full" style={{ height }}>
      <svg className="pointer-events-none absolute inset-0 overflow-visible" width={width} height={height} aria-hidden="true">
        <defs>
          <marker id="leg-arrow-done" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L8,4 L0,8 z" className="fill-emerald-500" /></marker>
          <marker id="leg-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L8,4 L0,8 z" className="fill-zinc-500" /></marker>
        </defs>
        {graph.edges.map(([from, to]) => {
          const a = box.get(from)!; const b = box.get(to)!;
          const x1 = a.x + nodeW / 2; const y1 = a.y + NODE_H; const x2 = b.x + nodeW / 2; const y2 = b.y - 2;
          const bend = Math.max(14, (y2 - y1) / 2);
          const done = colorOf(from) === 'green';
          return <path key={`${from}->${to}`} d={`M${x1},${y1} C${x1},${y1 + bend} ${x2},${y2 - bend} ${x2},${y2}`} fill="none" strokeWidth={1.5}
            className={done ? 'stroke-emerald-500/70' : 'stroke-zinc-500/60'} strokeDasharray={done ? undefined : '4 3'} markerEnd={`url(#${done ? 'leg-arrow-done' : 'leg-arrow'})`} />;
        })}
      </svg>
      {graph.ops.map((op) => {
        const leg = legByOp.get(op)!; const color = colorOf(op); const view = colorView[color]; const at = box.get(op)!;
        const fan = out(op); const merge = into(op);
        return <div key={op} title={`${labelOf(op)} · ${op}`} className={`absolute flex flex-col justify-center rounded-lg border px-2.5 py-1.5 ${view.node}`} style={{ left: at.x, top: at.y, width: nodeW, height: NODE_H }}>
          <div className="flex items-start gap-1.5"><span className={`mt-1 size-2 shrink-0 rounded-full ${view.dot}`} /><span className="line-clamp-2 text-[12px] font-medium leading-4 text-zinc-100">{labelOf(op)}</span></div>
          <div className="mt-1 flex items-center gap-1.5 pl-3.5 text-[10px]"><span className={view.text}>{view.name}</span>{color === 'yellow' && leg.since && <span className="truncate text-zinc-500">· {ageOf(leg.since)}</span>}
            <span className="ml-auto flex items-center gap-1 text-zinc-500">{merge > 1 && <span className="inline-flex items-center" title="Gộp nhánh" aria-label="Gộp nhánh"><GitMerge className="size-3" />{merge}</span>}{fan > 1 && <span className="inline-flex items-center" title="Tách nhánh" aria-label="Tách nhánh"><GitFork className="size-3" />{fan}</span>}</span></div>
        </div>;
      })}
    </div>
    <p className="text-[11px] leading-5 text-zinc-600">{graph.linear ? 'Kế hoạch chưa có đồ thị phụ thuộc: hiển thị theo chuỗi tuyến tính.' : 'Đồ thị phụ thuộc từ derivedPlan.edges.'} {fromStatus ? 'Màu lấy từ api status.' : 'api status chưa gửi màu: màu được suy ra từ trạng thái job.'}</p>
  </div>;
}

/** What the runtime says comes next (`api status` nextActions). `orphaned-frontier` is a runtime defect. */
export function NextActions({ wf, labelOf, fallback }: { wf: WorkflowRow; labelOf: (op: string) => string; fallback: string }) {
  const orphaned = wf.frontier?.state === 'orphaned-frontier';
  const actions = wf.nextActions;
  return <div className="mt-3 max-w-4xl space-y-3">
    {orphaned && <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300"><ShieldAlert className="mt-0.5 size-4 shrink-0" /><div><div className="font-medium">Lỗi runtime</div><p className="mt-1 leading-6">Luồng đang chạy nhưng runtime không tính ra bước tiếp theo nào. Đây là lỗi của runtime, không phải việc chờ kernel hay chờ thầy.</p></div></div>}
    {actions == null ? !orphaned && <p className="text-sm leading-6 text-zinc-400">{fallback}</p>
      : actions.length ? <div><div className="mb-2 text-xs font-medium text-zinc-500">Bước tiếp theo</div><ol className="space-y-2">{actions.map((action, index) => <li key={`${action.kind}-${action.op}-${action.jobId ?? index}`} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
        <div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className="font-mono text-[11px]">{action.kind}</Badge>{action.op && <span className="text-sm font-medium text-zinc-200">{labelOf(action.op)}</span>}{action.jobId && <span className="font-mono text-[11px] text-zinc-500">{action.jobId}</span>}</div>
        {action.reason && <p className="mt-1.5 break-words text-xs leading-5 text-zinc-400">{action.reason}</p>}
      </li>)}</ol></div>
      : !orphaned && <p className="text-sm text-zinc-500">Runtime không có bước tiếp theo cần làm lúc này.</p>}
  </div>;
}
