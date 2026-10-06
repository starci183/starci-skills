import type { Concept } from '../concept';
export const concept: Concept = 'C16';
import { useMemo } from 'react';
import type { AttemptRow } from '../../contract';
import { toneVar } from '../status';
import { attemptState, fmtMin, groupBy, minutes, niceStep, stateLabel, stateTone } from './analytics-data';
import { ChartCard } from './chart-card';
import { useWidth } from './use-width';
import { t } from '../../i18n/t';

const ROW = 28;
const cut = (text: string, n: number) => text.length > n ? `${text.slice(0, n - 1)}…` : text;

export function DurationPlot({ rows, now }: Readonly<{ rows: AttemptRow[]; now: number }>) {
  const [ref, width] = useWidth();
  const dots = useMemo(() => rows.map(row => {
    const state = attemptState(row);
    const elapsed = row.settledAt != null ? row.dispatchedAt != null ? row.settledAt - row.dispatchedAt : null : row.dispatchedAt != null && (state === 'run' || state === 'settling') ? now - row.dispatchedAt : null;
    const min = elapsed != null && Number.isFinite(elapsed) && elapsed >= 0 ? minutes(elapsed) : null;
    return min == null ? null : { row, state, min, open: row.settledAt == null };
  }).filter((d): d is NonNullable<typeof d> => d != null), [rows, now]);
  const ops = [...groupBy(dots, d => d.row.op).entries()].sort((a, b) => b[1].length - a[1].length);
  const max = Math.max(1, ...dots.map(d => d.min)), step = niceStep(max, width < 500 ? 3 : 5), top = Math.ceil(max / step) * step;
  const labelW = width < 520 ? 104 : 150, plotL = labelW + 6, plotW = Math.max(60, width - plotL - 12), x = (m: number) => plotL + (m / top) * plotW;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const height = ops.length * ROW + 26;
  return <ChartCard title={t('Duration per attempt (minutes)')} hint={t('Each dot is one attempt, from dispatch to settle. A hollow dot is an open attempt, counted up to now.')}
    legend={[{ tone: 'success', label: t('Passed') }, { tone: 'failed', label: t('Failed/blocked') }, { tone: 'running', label: t('Open (hollow)'), hollow: true }, ...(dots.some(dot => dot.state === 'settling') ? [{ tone: 'warning' as const, label: t('Settling'), hollow: true }] : [])]}
    empty={!dots.length && t('No attempt has a timestamp in this range yet.')}>
    <div ref={ref}><svg width={width} height={height} role="img" aria-label={t('Attempt duration by op')} className="block max-w-full">
      {ticks.map(t => <g key={t}><line x1={x(t)} x2={x(t)} y1={0} y2={ops.length * ROW} className="stroke-border" />
        <text x={x(t)} y={ops.length * ROW + 16} textAnchor="middle" className="fill-muted-foreground text-[11px] tabular-nums">{t}</text></g>)}
      {ops.map(([op, list], i) => <g key={op} transform={`translate(0 ${i * ROW})`}>
        <text x={labelW} y={ROW / 2 + 4} textAnchor="end" className="fill-foreground font-mono text-[11.5px]"><title>{op}</title>{cut(op, Math.floor(labelW / 6.6))}</text>
        <line x1={plotL} x2={plotL + plotW} y1={ROW / 2} y2={ROW / 2} className="stroke-border" />
        {list.map((d, j) => {
          const tone = toneVar(stateTone[d.state]), cy = ROW / 2 + ((j % 3) - 1) * 6;
          const title = `#${d.row.id} · ${op} · ${fmtMin(d.min)}${d.open ? t(' (open)') : ''} · ${stateLabel[d.state]}`;
          return <a key={`${d.row.project}-${d.row.id}`} href={d.row.href}><circle cx={x(d.min)} cy={cy} r={4.5} fill={d.open ? 'none' : tone} stroke={tone} strokeWidth={d.open ? 1.75 : 1}><title>{title}</title></circle></a>;
        })}
      </g>)}
    </svg></div>
  </ChartCard>;
}
