import type { Concept } from '../concept';
/** Names the C16 analytics concept this module belongs to, for the per-attempt duration dot plot. */
export const concept: Concept = 'C16';
import { useMemo } from 'react';
import { Link } from '@heroui/react';
import type { AttemptRow } from '../../contract';
import { toneVar } from '../status';
import { attemptState, type AttemptState, fmtMin, groupBy, minutes, niceStep, stateLabel, stateTone } from './analytics-data';
import { ChartCard } from './chart-card';
import { useWidth } from './use-width';
import { t } from '../../i18n/t';

const ROW = 28;
type Dot = { row: AttemptRow; state: AttemptState; min: number; open: boolean };

/** The status word of a dot: a terminal-closed execution names that closure, anything else its attempt state. */
const dotStatus = (d: Dot): string => {
  if (!d.open || d.row.terminalEndedAt == null) return stateLabel[d.state];
  return d.row.verdict == null && d.row.endState == null ? t('Terminal closed · settlement pending') : t('Terminal closed');
};

/** The accessible label of a dot: attempt id, op, duration and status. */
const dotLabel = (d: Dot) => `#${d.row.id} · ${d.row.op} · ${fmtMin(d.min)} · ${dotStatus(d)}`;

const cut = (text: string, n: number) => text.length > n ? `${text.slice(0, n - 1)}…` : text;

/** Plots every attempt as a dot on a per-op minutes axis, so slow or still-open executions stand out from the pack. */
export const DurationPlot = ({ rows, now }: Readonly<{ rows: AttemptRow[]; now: number }>) => {
  const [ref, width] = useWidth();
  const dots = useMemo(() => rows.map((row): Dot | null => {
    const state = attemptState(row);
    const endpoint = row.settledAt ?? row.terminalEndedAt ?? (state === 'run' || state === 'settling' ? now : null);
    const elapsed = row.dispatchedAt != null && endpoint != null ? endpoint - row.dispatchedAt : null;
    const min = elapsed != null && Number.isFinite(elapsed) && elapsed >= 0 ? minutes(elapsed) : null;
    return min == null ? null : { row, state, min, open: row.settledAt == null };
  }).filter((d): d is Dot => d != null), [rows, now]);
  const ops = [...groupBy(dots, d => d.row.op).entries()].sort((a, b) => b[1].length - a[1].length);
  const max = Math.max(1, ...dots.map(d => d.min)), step = niceStep(max, width < 500 ? 3 : 5), top = Math.ceil(max / step) * step;
  const labelW = width < 520 ? 104 : 150, plotL = labelW + 6, plotW = Math.max(60, width - plotL - 12), x = (m: number) => plotL + (m / top) * plotW;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const height = ops.length * ROW + 26;
  const points = ops.flatMap(([, list], i) => list.map((d, j) => ({ dot: d, label: dotLabel(d), hitArea: { left: x(d.min) - 4.5, top: i * ROW + ROW / 2 + ((j % 3) - 1) * 6 - 4.5, width: 9, height: 9 } })));
  return <ChartCard title={t('Duration per attempt (minutes)')} hint={t('Each dot spans dispatch to recorded settlement or terminal closure. Only an open execution continues to now.')}
    legend={[{ tone: 'success', label: t('Passed') }, { tone: 'failed', label: t('Failed/blocked') }, { tone: 'running', label: t('Unsettled (hollow)'), hollow: true }, ...(dots.some(dot => dot.state === 'settling') ? [{ tone: 'warning' as const, label: t('Settling'), hollow: true }] : [])]}
    empty={!dots.length && t('No attempt has a timestamp in this range yet.')}>
    <div ref={ref} className="relative" style={{ height }}><svg width={width} height={height} role="group" aria-label={t('Attempt duration by op')} className="block max-w-full">
      {ticks.map(t => <g key={t}><line x1={x(t)} x2={x(t)} y1={0} y2={ops.length * ROW} className="stroke-border" />
        <text x={x(t)} y={ops.length * ROW + 16} textAnchor="middle" className="fill-muted-foreground text-[11px] tabular-nums">{t}</text></g>)}
      {ops.map(([op, list], i) => <g key={op} transform={`translate(0 ${i * ROW})`}>
        <text x={labelW} y={ROW / 2 + 4} textAnchor="end" className="fill-foreground font-mono text-[11.5px]"><title>{op}</title>{cut(op, Math.floor(labelW / 6.6))}</text>
        <line x1={plotL} x2={plotL + plotW} y1={ROW / 2} y2={ROW / 2} className="stroke-border" />
        {list.map((d, j) => {
          const tone = toneVar(stateTone[d.state]), cy = ROW / 2 + ((j % 3) - 1) * 6;
          const title = dotLabel(d);
          return <circle key={`${d.row.project}-${d.row.id}`} cx={x(d.min)} cy={cy} r={4.5} fill={d.open ? 'none' : tone} stroke={tone} strokeWidth={d.open ? 1.75 : 1}><title>{title}</title></circle>;
        })}
      </g>)}
    </svg><div className="pointer-events-none absolute inset-0">{points.map(point => <span key={`${point.dot.row.project}-${point.dot.row.id}`} title={point.label}><Link href={point.dot.row.href} aria-label={point.label} className="pointer-events-auto absolute rounded-full focus-visible:outline-2 focus-visible:outline-ring" style={point.hitArea}><span className="sr-only">{point.label}</span></Link></span>)}</div></div>
  </ChartCard>;
};
