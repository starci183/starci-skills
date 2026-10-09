import type { LegRow, LegStatus, PipelineView } from '../../../contract';
import { t } from '../../../i18n/t';

export const NODE_H = 216, COL_GAP = 24, ROW_GAP = 16, PAD_X = 8, HEAD_H = 48, PAD_B = 8;

export type PlacedLeg = { leg: LegRow; x: number; y: number; height: number; col: number };
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

const doneLike = (status: LegStatus) => status === 'success';

export function layoutPipeline(pipeline: PipelineView, availWidth = 1050, measuredHeights: ReadonlyMap<string, number> = new Map()) {
  const columns = buildColumns(pipeline.legs);
  const legHeight = (leg: LegRow) => Math.max(NODE_H, measuredHeights.get(leg.op) ?? NODE_H);
  const bodyH = Math.max(NODE_H, ...columns.map(col => col.legs.reduce((height, leg) => height + legHeight(leg), 0) + Math.max(0, col.legs.length - 1) * ROW_GAP));
  const gaps = Math.max(0, columns.length - 1) * COL_GAP;
  const NODE_W = Math.max(240, Math.min(272, Math.floor((availWidth - PAD_X * 2 - gaps) / Math.max(1, columns.length))));
  const width = PAD_X * 2 + columns.length * NODE_W + gaps;
  const height = HEAD_H + bodyH + PAD_B;
  const placed = new Map<string, PlacedLeg>();
  for (const col of columns) {
    // A distant tall branch must not reserve blank space above the visible columns.
    let top = HEAD_H;
    for (const leg of col.legs) {
      const height = legHeight(leg);
      placed.set(leg.op, { leg, col: col.index, x: PAD_X + col.index * (NODE_W + COL_GAP), y: top, height });
      top += height + ROW_GAP;
    }
  }
  const edges: PlacedEdge[] = [];
  for (const edge of pipeline.edges) {
    const a = placed.get(edge.from), b = placed.get(edge.to);
    if (!a || !b) continue;
    const x1 = a.x + NODE_W, y1 = a.y + a.height / 2, x2 = b.x, y2 = b.y + b.height / 2;
    const dx = Math.max(24, (x2 - x1) / 2);
    edges.push({ from: edge.from, to: edge.to, path: `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`,
      tone: b.leg.current ? 'current' : doneLike(a.leg.status) && doneLike(b.leg.status) ? 'done' : 'plain' });
  }
  return { columns, placed, edges, width, height, nodeW: NODE_W };
}

export const legTries = (leg: LegRow) => {
  const budgets = [...new Set(leg.units.map(unit => unit.tryBudget))];
  const budget = budgets.length === 1 && budgets[0] > 0 ? budgets[0] : null;
  const max = Math.max(0, ...leg.units.map(unit => unit.tries), ...(leg.units.length ? [] : leg.attempts.map(attempt => attempt.try)));
  return { tries: max, budget };
};
