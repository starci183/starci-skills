import type { Concept } from '../concept';
export const concept: Concept = 'C16';
import { motion } from 'motion/react';
import { EASE } from '../motion';
import type { AttemptRow } from '../../contract';
import { toneVar } from '../status';
import { counts, groupBy, num, stateLabel, stateTone, type AttemptState } from './analytics-data';
import { ChartCard } from './chart-card';
import { useWidth } from './use-width';

const ROW = 46;
const order: AttemptState[] = ['pass', 'bad', 'run', 'dropped'];

export function OpOutcomes({ rows }: { rows: AttemptRow[] }) {
  const [ref, width] = useWidth();
  const groups = [...groupBy(rows, row => row.op).entries()].map(([op, list]) => ({ op, ...counts(list) })).sort((a, b) => b.total - a.total || a.op.localeCompare(b.op));
  const max = Math.max(1, ...groups.map(g => g.total));
  const hasDropped = groups.some(g => g.dropped > 0);
  return <ChartCard title="Kết quả theo op" hint="Mỗi thanh là một op. Độ dài theo số lần thử; nhãn k/n là số lần đạt trên tổng số lần thử."
    legend={[{ tone: 'success', label: 'Đạt' }, { tone: 'failed', label: 'Hỏng/chặn' }, { tone: 'running', label: 'Đang chạy' }, ...(hasDropped ? [{ tone: 'skipped' as const, label: 'Đã bỏ' }] : [])]}
    empty={!groups.length && 'Chưa có lần thử nào trong khoảng này.'}>
    <div ref={ref}><svg width={width} height={groups.length * ROW} role="img" aria-label="Kết quả theo op" className="block max-w-full">
      {groups.map((g, i) => {
        let x = 0;
        return <g key={g.op} transform={`translate(0 ${i * ROW})`}>
          <text x={0} y={14} className="fill-foreground font-mono text-[12px]">{g.op}</text>
          <text x={width} y={14} textAnchor="end" className="fill-muted-foreground text-[12px] tabular-nums">{g.pass}/{g.total} đạt</text>
          <rect x={0} y={22} width={width} height={14} rx={4} className="fill-muted" />
          {order.map(state => {
            const n = g[state]; if (!n) return null;
            const w = (n / max) * width;
            const rect = <motion.rect key={state} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.36, ease: EASE, delay: i * 0.04 }} style={{ transformOrigin: 'left', transformBox: 'fill-box' }} x={x} y={22} width={Math.max(w, 2)} height={14} rx={2} fill={toneVar(stateTone[state])}
              stroke={state === 'dropped' ? toneVar('skipped', '-line') : undefined} strokeDasharray={state === 'dropped' ? '3 2' : undefined}>
              <title>{`${g.op} · ${stateLabel[state]}: ${num(n, 0)}/${num(g.total, 0)} lần thử`}</title></motion.rect>;
            x += w; return rect;
          })}
        </g>;
      })}
    </svg></div>
  </ChartCard>;
}
