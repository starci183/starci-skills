import type { WorkGraphView } from '../../contract';
import { toneVar, type Tone } from '../status';
import type { Concept } from '../concept';
import { formatDayTime } from './leg/time';

export const concept: Concept = 'C4';

type Node = WorkGraphView['nodes'][number];
const NODE_W = 210; const NODE_H = 64; const GAP_X = 70; const GAP_Y = 16; const PAD = 12;

const colorTone = (color: string | null): Tone => {
  const c = (color ?? '').toLowerCase();
  if (['green', 'success', 'done', 'lime', 'teal'].includes(c)) return 'success';
  if (['blue', 'running', 'cyan', 'indigo', 'purple', 'violet'].includes(c)) return 'running';
  if (['red', 'failed', 'pink', 'rose'].includes(c)) return 'failed';
  if (['yellow', 'amber', 'orange', 'warning'].includes(c)) return 'warning';
  return 'queued';
};

/** The scope's work graph (slices + data edges) from work_graph_versions, layered left to right by longest path. */
export function WorkGraphSlices({ graph }: { graph: WorkGraphView | null }) {
  if (!graph) return <p className="rounded-lg border p-4 text-sm text-muted-foreground">Chưa có đồ thị lát cắt cho phạm vi này (work graph chưa được ghi).</p>;
  const ids = new Set(graph.nodes.map(n => n.id));
  const edges = graph.edges.filter(e => ids.has(e.from) && ids.has(e.to) && e.from !== e.to);
  // Longest-path layering (Kahn-style; nodes left in a cycle fall to layer 0).
  const layer = new Map<string, number>(graph.nodes.map(n => [n.id, 0]));
  for (let pass = 0; pass < graph.nodes.length; pass++) {
    let moved = false;
    for (const e of edges) { const want = (layer.get(e.from) ?? 0) + 1; if (want > (layer.get(e.to) ?? 0) && want <= graph.nodes.length) { layer.set(e.to, want); moved = true; } }
    if (!moved) break;
  }
  const cols: Node[][] = [];
  for (const n of graph.nodes) (cols[layer.get(n.id) ?? 0] ??= []).push(n);
  const pos = new Map<string, { x: number; y: number }>();
  cols.forEach((col, ci) => col?.forEach((n, ri) => pos.set(n.id, { x: PAD + ci * (NODE_W + GAP_X), y: PAD + ri * (NODE_H + GAP_Y) })));
  const width = PAD * 2 + cols.length * NODE_W + Math.max(0, cols.length - 1) * GAP_X;
  const height = PAD * 2 + Math.max(1, ...cols.map(c => c?.length ?? 0)) * (NODE_H + GAP_Y) - GAP_Y;
  const trunc = (s: string, n: number) => s.length > n ? `${s.slice(0, n - 1)}…` : s;
  return <div className="flex flex-col gap-3">
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      <strong className="text-foreground">Phiên bản {graph.version}</strong><span>sự kiện: {graph.event}</span><span>op tác giả: {graph.authorOp}</span><span>{formatDayTime(graph.at)}</span>
      <span>{graph.nodes.length} lát cắt · {edges.length} cạnh</span>
    </div>
    {graph.reason && <p className="text-xs text-muted-foreground">{graph.reason}</p>}
    <div className="max-w-full overflow-x-auto rounded-lg border bg-card">
      <svg width={width} height={height} role="img" aria-label="Đồ thị lát cắt công việc" style={{ minWidth: width }} className="block">
        <defs><marker id="wgs-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L8,4 L0,8 z" style={{ fill: 'var(--muted-foreground)' }} /></marker></defs>
        {edges.map((e, i) => {
          const a = pos.get(e.from); const b = pos.get(e.to); if (!a || !b) return null;
          const x1 = a.x + NODE_W; const y1 = a.y + NODE_H / 2; const x2 = b.x; const y2 = b.y + NODE_H / 2; const mx = (x1 + x2) / 2;
          return <path key={i} d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2 - 2},${y2}`} fill="none" strokeWidth="1.5" markerEnd="url(#wgs-arrow)" style={{ stroke: 'var(--muted-foreground)' }} opacity="0.7">
            <title>{`${e.from} → ${e.to}${e.kind ? ` (${e.kind})` : ''}\n${e.reason ?? 'Không ghi lý do'}`}</title>
          </path>;
        })}
        {graph.nodes.map(n => {
          const p = pos.get(n.id); if (!p) return null; const tone = colorTone(n.color);
          return <g key={n.id} transform={`translate(${p.x},${p.y})`}>
            <title>{`${n.title}\n${n.id}${n.domain ? ` · ${n.domain}` : ''}${n.kind ? ` · ${n.kind}` : ''}\n${n.ownedPaths.join('\n')}`}</title>
            <rect width={NODE_W} height={NODE_H} rx="8" strokeWidth="1.5" style={{ fill: toneVar(tone, '-bg'), stroke: toneVar(tone, '-line') }} />
            <rect width="5" height={NODE_H} rx="2.5" style={{ fill: toneVar(tone) }} />
            <text x="16" y="24" fontSize="12.5" fontWeight="600" style={{ fill: 'var(--foreground)' }}>{trunc(n.title, 27)}</text>
            <text x="16" y="42" fontSize="10.5" fontFamily="var(--font-mono, monospace)" style={{ fill: 'var(--muted-foreground)' }}>{trunc(n.id, 30)}</text>
            <text x="16" y="56" fontSize="10.5" style={{ fill: 'var(--muted-foreground)' }}>{n.ownedPaths.length} đường dẫn{n.domain ? ` · ${trunc(n.domain, 14)}` : ''}</text>
          </g>;
        })}
      </svg>
    </div>
    {graph.domains.length > 0 && <p className="text-xs text-muted-foreground">Miền: {graph.domains.map(d => d.title ?? d.id).join(', ')}</p>}
  </div>;
}
