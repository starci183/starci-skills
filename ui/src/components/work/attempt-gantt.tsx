import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { AttemptBrief, PipelineView } from '../../contract';
import { statusLabels, statusTone, toneVar } from '../status';
import type { Concept } from '../concept';
import { AgentMark, familyTint, tintStyle } from '../agent/agent-marks';
import { agentOf } from '../agent/agent-avatar';
import { formatDayTime, formatDuration, formatHm } from './leg/time';

export const concept: Concept = 'C7';

const LABEL_W = 190; const ROW_PAD = 6; const BAR_H = 16; const LANE_H = 22; const TOP = 26; const RIGHT = 24;
const STEP_MS = 5 * 60_000;
const ladder = [1, 2, 3, 6, 12, 24, 48, 96];

/** Horizontal scroller with edge fades that show only while more content exists in that direction. */
function FadeScroller({ children }: { children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ left: false, right: false });
  useEffect(() => {
    const el = box.current; if (!el) return;
    const update = () => setEdge({ left: el.scrollLeft > 2, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 2 });
    update();
    el.addEventListener('scroll', update, { passive: true });
    const observer = new ResizeObserver(update); observer.observe(el); if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => { el.removeEventListener('scroll', update); observer.disconnect(); };
  }, []);
  return <div className="relative max-w-full rounded-lg border bg-card">
    <div ref={box} className="max-w-full overflow-x-auto rounded-lg" tabIndex={0} aria-label="Dòng thời gian, cuộn ngang">{children}</div>
    <span aria-hidden="true" className={`pointer-events-none absolute inset-y-0 left-0 w-10 rounded-l-lg bg-gradient-to-r from-card to-transparent transition-opacity ${edge.left ? 'opacity-100' : 'opacity-0'}`} />
    <span aria-hidden="true" className={`pointer-events-none absolute inset-y-0 right-0 w-10 rounded-r-lg bg-gradient-to-l from-card to-transparent transition-opacity ${edge.right ? 'opacity-100' : 'opacity-0'}`} />
  </div>;
}

/** Timeline of every attempt per leg (bar = dispatched → settled/now, colour = status). */
export function AttemptGantt({ pipeline, now }: { pipeline: PipelineView; now: number }) {
  const rows = pipeline.legs.map(leg => ({ leg, atts: leg.attempts.filter(a => a.dispatchedAt != null) })).filter(r => r.atts.length);
  if (!rows.length) return <p className="rounded-lg border p-4 text-sm text-muted-foreground">Chưa có lần thử nào để vẽ dòng thời gian.</p>;
  const all = rows.flatMap(r => r.atts);
  const endOf = (a: AttemptBrief) => a.settledAt ?? (a.open ? Math.max(now, a.dispatchedAt as number) : a.dispatchedAt as number);
  const t0 = Math.floor(Math.min(...all.map(a => a.dispatchedAt as number)) / STEP_MS) * STEP_MS;
  const t1 = Math.ceil(Math.max(...all.map(endOf), now) / STEP_MS) * STEP_MS + STEP_MS;
  const span = t1 - t0;
  const base = span / STEP_MS;
  const mult = ladder.find(m => base / m <= 48) ?? 96;
  const plotW = Math.min(3600, Math.max(640, (base / mult) * 44));
  const x = (t: number) => LABEL_W + ((t - t0) / span) * plotW;
  const width = LABEL_W + plotW + RIGHT;
  // Greedy lane packing per leg so parallel attempts do not overlap.
  const laid = rows.map(({ leg, atts }) => {
    const ends: number[] = [];
    const bars = [...atts].sort((a, b) => (a.dispatchedAt as number) - (b.dispatchedAt as number)).map(a => {
      let lane = ends.findIndex(e => e <= (a.dispatchedAt as number));
      if (lane < 0) lane = ends.length;
      ends[lane] = Math.max(endOf(a), (a.dispatchedAt as number) + STEP_MS / 5);
      return { a, lane };
    });
    return { leg, bars, lanes: Math.max(1, ends.length) };
  });
  let y = TOP;
  const placed = laid.map(r => { const h = r.lanes * LANE_H + ROW_PAD * 2; const out = { ...r, y, h }; y += h; return out; });
  const height = y + 8;
  const ticks: number[] = [];
  for (let t = t0; t <= t1; t += STEP_MS * mult) ticks.push(t);
  const nowX = x(now);
  return <FadeScroller>
    <svg width={width} height={height} role="img" aria-label="Dòng thời gian các lần thử theo chặng" className="block text-foreground" style={{ minWidth: width }}>
      <defs>
        {(['running', 'warning', 'failed', 'success', 'queued', 'skipped'] as const).map(tone => <pattern key={tone} id={`hatch-${tone}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="6" height="6" style={{ fill: toneVar(tone, '-bg') }} /><line x1="0" y1="0" x2="0" y2="6" strokeWidth="3" style={{ stroke: toneVar(tone, '-line') }} />
        </pattern>)}
      </defs>
      {ticks.map(t => <g key={t}>
        <line x1={x(t)} x2={x(t)} y1={TOP - 6} y2={height - 6} style={{ stroke: 'var(--border)' }} strokeWidth="1" />
        <text x={x(t)} y={14} textAnchor="middle" fontSize="10.5" style={{ fill: 'var(--muted-foreground)' }}>{formatHm(t)}</text>
      </g>)}
      {placed.map(({ leg, bars, y: top, h }, i) => <g key={leg.op}>
        {i % 2 === 1 && <rect x={0} y={top} width={width} height={h} style={{ fill: 'var(--muted)' }} opacity="0.35" />}
        <text x={8} y={top + h / 2 + 4} fontSize="12" fontFamily="var(--font-mono, monospace)" style={{ fill: 'var(--foreground)' }}>{leg.op.length > 26 ? `${leg.op.slice(0, 25)}…` : leg.op}<title>{leg.op}</title></text>
        {bars.map(({ a, lane }) => {
          const open = a.open;
          const tone = statusTone[a.status];
          const bx = x(a.dispatchedAt as number); const bw = Math.max(6, x(endOf(a)) - bx);
          const by = top + ROW_PAD + lane * LANE_H + (LANE_H - BAR_H) / 2;
          const tip = `#${a.id} · lần ${a.try} · ${statusLabels[a.status]}\n${a.model ?? a.agent ?? 'chưa rõ model'}\n${formatDayTime(a.dispatchedAt)} → ${open ? 'đang chạy' : formatDayTime(a.settledAt)}\n${formatDuration(endOf(a) - (a.dispatchedAt as number))}`;
          return <a key={a.id} href={a.href}><g>
            <title>{tip}</title>
            <rect x={bx} y={by} width={bw} height={BAR_H} rx="4" strokeWidth="1.5" style={{ fill: open ? `url(#hatch-${tone})` : toneVar(tone, '-bg'), stroke: toneVar(tone) }}>
              {open && <animate attributeName="opacity" values="1;0.55;1" dur="1.8s" repeatCount="indefinite" />}
            </rect>
            {bw >= 20 && <foreignObject x={bx + 2} y={by + 1} width={14} height={14}><span className="grid size-3.5 place-items-center rounded-full border p-px" style={tintStyle(familyTint[agentOf(a).family].tone)}><AgentMark family={agentOf(a).family} initial="?" /></span></foreignObject>}
            {bw >= 44 && <text x={bx + 19} y={by + 12} fontSize="10.5" fontWeight="600" style={{ fill: toneVar(tone) }}>#{a.id}</text>}
          </g></a>;
        })}
      </g>)}
      <g>
        <line x1={nowX} x2={nowX} y1={TOP - 6} y2={height - 6} strokeWidth="1.5" style={{ stroke: 'var(--chart-muted)' }} />
        <text x={Math.min(nowX + 4, width - 52)} y={TOP + 10} fontSize="10.5" fontWeight="600" style={{ fill: 'var(--primary)' }}>bây giờ</text>
      </g>
    </svg>
  </FadeScroller>;
}
