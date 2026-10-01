import type { Concept } from '../concept';
export const concept: Concept = 'C16';
import { useMemo } from 'react';
import { motion } from 'motion/react';
import { EASE } from '../motion';
import type { AttemptRow } from '../../contract';
import { toneVar } from '../status';
import { fmtClock, fmtDay, fmtDayClock, niceStep, throughput } from './analytics-data';
import { ChartCard } from './chart-card';
import { useWidth } from './use-width';
import { t } from '../../i18n/t';

const H = 190, TOP = 8, BOTTOM = 26, LEFT = 30;

export function Throughput({ rows, since, now }: { rows: AttemptRow[]; since: number; now: number }) {
  const [ref, width] = useWidth();
  const { step, buckets } = useMemo(() => throughput(rows, since, now), [rows, since, now]);
  const max = Math.max(1, ...buckets.map(b => Math.max(b.dispatched, b.settled))), tick = Math.max(1, niceStep(max, 4)), top = Math.ceil(max / tick) * tick;
  const plotW = width - LEFT - 6, plotH = H - TOP - BOTTOM, slot = plotW / Math.max(1, buckets.length), bw = Math.max(2, Math.min(18, slot * 0.36));
  const y = (v: number) => TOP + plotH - (v / top) * plotH;
  const every = Math.max(1, Math.ceil(buckets.length / Math.max(2, Math.floor(plotW / (step >= 86_400e3 ? 44 : 60)))));
  const label = (at: number) => step >= 86_400e3 ? fmtDay(at) : step >= 6 * 3600e3 ? fmtDayClock(at) : fmtClock(at);
  const stepText = step >= 86_400e3 ? t('day') : step >= 3600e3 ? t('{n} hours', { n: step / 3600e3 }) : t('{n} min', { n: step / 60e3 });
  return <ChartCard title={t('Throughput')} hint={t('Attempts dispatched and attempts settled, per {step}.', { step: stepText })}
    legend={[{ neutral: true, label: t('Dispatched') }, { tone: 'queued', label: t('Settled') }]} empty={!rows.length && t('No attempts in this range yet.')}>
    <div ref={ref}><svg width={width} height={H} role="img" aria-label={t('Throughput over time')} className="block max-w-full">
      {Array.from({ length: Math.round(top / tick) + 1 }, (_, i) => i * tick).map(v => <g key={v}>
        <line x1={LEFT} x2={width - 6} y1={y(v)} y2={y(v)} className="stroke-border" />
        <text x={LEFT - 6} y={y(v) + 4} textAnchor="end" className="fill-muted-foreground text-[11px] tabular-nums">{v}</text></g>)}
      {buckets.map((b, i) => {
        const cx = LEFT + slot * i + slot / 2, when = `${fmtDayClock(b.start)} → ${fmtClock(b.end)}`;
        return <g key={b.start}>
          {b.dispatched > 0 ? <motion.rect initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ duration: 0.24, ease: EASE }} style={{ transformOrigin: 'bottom', transformBox: 'fill-box' }} x={cx - bw - 0.5} y={y(b.dispatched)} width={bw} height={y(0) - y(b.dispatched)} rx={2} fill="var(--primary)"><title>{`${when} · ${t('{n} dispatched', { n: b.dispatched })}`}</title></motion.rect> : null}
          {b.settled > 0 ? <motion.rect initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ duration: 0.24, ease: EASE }} style={{ transformOrigin: 'bottom', transformBox: 'fill-box' }} x={cx + 0.5} y={y(b.settled)} width={bw} height={y(0) - y(b.settled)} rx={2} fill={toneVar('queued')}><title>{`${when} · ${t('{n} settled', { n: b.settled })}`}</title></motion.rect> : null}
          {i % every === 0 ? <text x={cx} y={H - 8} textAnchor="middle" className="fill-muted-foreground text-[11px] tabular-nums">{label(b.start)}</text> : null}
        </g>;
      })}
    </svg></div>
  </ChartCard>;
}
