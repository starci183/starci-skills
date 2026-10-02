import type { Concept } from '../concept';
export const concept: Concept = 'C16';
import { motion } from 'motion/react';
import { EASE } from '../motion';
import type { AttemptRow } from '../../contract';
import { toneVar } from '../status';
import { counts, groupBy, num, stateLabel, stateTone, type AttemptState } from './analytics-data';
import { ChartCard } from './chart-card';
import { useWidth } from './use-width';
import { t } from '../../i18n/t';

const ROW = 46;
const order: AttemptState[] = ['pass', 'bad', 'run', 'dropped'];

export function OpOutcomes({ rows }: { rows: AttemptRow[] }) {
  const [ref, width] = useWidth();
  const groups = [...groupBy(rows, row => row.op).entries()].map(([op, list]) => ({ op, ...counts(list) })).sort((a, b) => b.total - a.total || a.op.localeCompare(b.op));
  const max = Math.max(1, ...groups.map(g => g.total));
  const hasDropped = groups.some(g => g.dropped > 0);
  return <ChartCard title={t('Outcomes by op')} hint={t('Each bar is one op. Length follows the attempt count; the k/n label is passes over total attempts.')}
    legend={[{ tone: 'success', label: t('Passed') }, { tone: 'failed', label: t('Failed/blocked') }, { tone: 'running', label: t('Running') }, ...(hasDropped ? [{ tone: 'skipped' as const, label: t('Dropped') }] : [])]}
    empty={!groups.length && t('No attempts in this range yet.')}>
    <div ref={ref}><svg width={width} height={groups.length * ROW} role="img" aria-label={t('Outcomes by op')} className="block max-w-full">
      {groups.map((g, i) => {
        let x = 0;
        return <g key={g.op} transform={`translate(0 ${i * ROW})`}>
          <text x={0} y={14} className="fill-foreground font-mono text-[12px]">{g.op}</text>
          <text x={width} y={14} textAnchor="end" className="fill-muted-foreground text-[12px] tabular-nums">{t('{pass}/{total} passed', { pass: g.pass, total: g.total })}</text>
          <rect x={0} y={22} width={width} height={14} rx={4} className="fill-muted" />
          {order.map(state => {
            const n = g[state]; if (!n) return null;
            const w = (n / max) * width;
            const rect = <motion.rect key={state} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.24, ease: EASE, delay: i * 0.04 }} style={{ transformOrigin: 'left', transformBox: 'fill-box' }} x={x} y={22} width={Math.max(w, 2)} height={14} rx={2} fill={toneVar(stateTone[state])}
              stroke={state === 'dropped' ? toneVar('skipped', '-line') : undefined} strokeDasharray={state === 'dropped' ? '3 2' : undefined}>
              <title>{`${g.op} · ${stateLabel[state]}: ${t('{n}/{total} attempts', { n: num(n, 0), total: num(g.total, 0) })}`}</title></motion.rect>;
            x += w; return rect;
          })}
        </g>;
      })}
    </svg></div>
  </ChartCard>;
}
