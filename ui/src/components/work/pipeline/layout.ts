import type { LegRow, LegStatus, PipelineView } from '../../../contract';

export const NODE_W = 164, NODE_H = 96, COL_GAP = 28, ROW_GAP = 14, PAD_X = 14, HEAD_H = 34, PAD_B = 14;

export type PlacedLeg = { leg: LegRow; x: number; y: number; col: number };
export type Column = { level: number; index: number; label: string; legs: LegRow[] };
export type PlacedEdge = { from: string; to: string; path: string; tone: 'current' | 'done' | 'plain' };

const domainLabels: [RegExp, string][] = [
  [/^request\./, 'YÊU CẦU'], [/^scope\./, 'PHẠM VI'], [/^(business|architecture|brand)\./, 'QUYẾT ĐỊNH'],
  [/^provision\./, 'CHUẨN BỊ'], [/^work\./, 'LẬP KẾ HOẠCH'], [/^interface\.draw/, 'THIẾT KẾ'],
  [/\.implement$/, 'TRIỂN KHAI'], [/\.(verify|audit)$/, 'KIỂM CHỨNG'], [/^(review|handover)\./, 'BÀN GIAO'],
];
export const columnLabel = (legs: LegRow[]) => {
  const labels = legs.map(leg => domainLabels.find(([re]) => re.test(leg.op))?.[1] ?? leg.op.split('.')[0].toUpperCase());
  return [...new Set(labels)].join(' · ');
};

export function buildColumns(legs: LegRow[]): Column[] {
  const levels = [...new Set(legs.map(leg => leg.level))].sort((a, b) => a - b);
  return levels.map((level, index) => {
    const group = legs.filter(leg => leg.level === level).sort((a, b) => a.seq - b.seq);
    return { level, index, label: columnLabel(group), legs: group };
  });
}

/** Drop an edge when a longer path already connects its ends (keeps the picture readable; reachability is unchanged). */
export function reduceEdges(edges: PipelineView['edges']) {
  const next = new Map<string, Set<string>>();
  for (const edge of edges) (next.get(edge.from) ?? next.set(edge.from, new Set()).get(edge.from)!).add(edge.to);
  const reaches = (from: string, target: string, skip: string): boolean => {
    const seen = new Set<string>(); const stack = [...(next.get(from) ?? [])].filter(item => item !== skip);
    while (stack.length) { const item = stack.pop()!; if (item === target) return true; if (seen.has(item)) continue; seen.add(item); stack.push(...(next.get(item) ?? [])); }
    return false;
  };
  return edges.filter(edge => !reaches(edge.from, edge.to, edge.to));
}

const doneLike = (status: LegStatus) => status === 'success';

export function layoutPipeline(pipeline: PipelineView) {
  const columns = buildColumns(pipeline.legs);
  const tallest = Math.max(1, ...columns.map(col => col.legs.length));
  const bodyH = tallest * NODE_H + (tallest - 1) * ROW_GAP;
  const width = PAD_X * 2 + columns.length * NODE_W + Math.max(0, columns.length - 1) * COL_GAP;
  const height = HEAD_H + bodyH + PAD_B;
  const placed = new Map<string, PlacedLeg>();
  for (const col of columns) {
    const colH = col.legs.length * NODE_H + (col.legs.length - 1) * ROW_GAP;
    const top = HEAD_H + (bodyH - colH) / 2;
    col.legs.forEach((leg, row) => placed.set(leg.op, { leg, col: col.index, x: PAD_X + col.index * (NODE_W + COL_GAP), y: top + row * (NODE_H + ROW_GAP) }));
  }
  const edges: PlacedEdge[] = [];
  for (const edge of reduceEdges(pipeline.edges)) {
    const a = placed.get(edge.from), b = placed.get(edge.to);
    if (!a || !b) continue;
    const x1 = a.x + NODE_W, y1 = a.y + NODE_H / 2, x2 = b.x, y2 = b.y + NODE_H / 2;
    const dx = Math.max(24, (x2 - x1) / 2);
    edges.push({ from: edge.from, to: edge.to, path: `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`,
      tone: b.leg.current ? 'current' : doneLike(a.leg.status) && doneLike(b.leg.status) ? 'done' : 'plain' });
  }
  return { columns, placed, edges, width, height };
}

export const legTries = (leg: LegRow) => {
  const budget = Math.max(0, ...leg.units.map(unit => unit.tryBudget));
  const max = Math.max(0, ...leg.units.map(unit => unit.tries), ...(leg.units.length ? [] : [leg.attempts.length]));
  return { tries: max, budget: budget || 5 };
};
