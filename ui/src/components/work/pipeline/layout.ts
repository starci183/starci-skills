import type { LegRow, LegStatus, PipelineView } from '../../../contract';
import { t } from '../../../i18n/t';

export const NODE_H = 116, COL_GAP = 20, ROW_GAP = 16, PAD_X = 8, HEAD_H = 34, PAD_B = 14;

export type PlacedLeg = { leg: LegRow; x: number; y: number; col: number };
export type Column = { level: number; index: number; label: string; legs: LegRow[] };
export type PlacedEdge = { from: string; to: string; path: string; tone: 'current' | 'done' | 'plain' };

const domainLabels: [RegExp, string][] = [
  [/^request\./, 'REQUEST'], [/^scope\./, 'SCOPE'], [/^(business|architecture|brand)\./, 'DECISION'],
  [/^provision\./, 'PREPARATION'], [/^work\./, 'PLANNING'], [/^interface\.draw/, 'DESIGN'],
  [/\.implement$/, 'IMPLEMENT'], [/\.(verify|audit)$/, 'VERIFY'], [/^(review|handover)\./, 'HANDOVER'],
];
export const columnLabel = (legs: LegRow[]) => {
  const labels = legs.map(leg => {
    const label = domainLabels.find(([re]) => re.test(leg.op))?.[1];
    return label ? t(label) : leg.op.split('.')[0].toUpperCase();
  });
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

export function layoutPipeline(pipeline: PipelineView, availWidth = 1050) {
  const columns = buildColumns(pipeline.legs);
  const tallest = Math.max(1, ...columns.map(col => col.legs.length));
  const bodyH = tallest * NODE_H + (tallest - 1) * ROW_GAP;
  const gaps = Math.max(0, columns.length - 1) * COL_GAP;
  const NODE_W = Math.max(152, Math.min(190, Math.floor((availWidth - PAD_X * 2 - gaps) / Math.max(1, columns.length))));
  const width = PAD_X * 2 + columns.length * NODE_W + gaps;
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
  return { columns, placed, edges, width, height, nodeW: NODE_W };
}

export const legTries = (leg: LegRow) => {
  const budget = Math.max(0, ...leg.units.map(unit => unit.tryBudget));
  const max = Math.max(0, ...leg.units.map(unit => unit.tries), ...(leg.units.length ? [] : [leg.attempts.length]));
  return { tries: max, budget: budget || 5 };
};
