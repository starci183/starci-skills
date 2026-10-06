import { useId } from 'react';
import type { AttemptBrief, PipelineView } from '../../contract';
import { statusLabels, statusTone, toneVar } from '../status';
import type { Concept } from '../concept';
import { AgentMark, familyTint, tintStyle } from '../agent/agent-marks';
import { agentOf } from '../agent/agent-avatar';
import { formatDayTime, formatDuration, formatHm } from './leg/time';
import { t } from '../../i18n/t';

export const concept: Concept = 'C7';

const LABEL_W = 190; const ROW_PAD = 6; const BAR_H = 16; const LANE_H = 22; const TOP = 26; const RIGHT = 24;
const STEP_MS = 5 * 60_000;
const ladder = [1, 2, 3, 6, 12, 24, 48, 96];
type DispatchedAttempt = AttemptBrief & { dispatchedAt: number };
const wasDispatched = (attempt: AttemptBrief): attempt is DispatchedAttempt => attempt.dispatchedAt != null && Number.isFinite(attempt.dispatchedAt);
const recordedTime = (at: number | null | undefined) => at != null && Number.isFinite(at) ? at : null;

/** Actual dispatch timeline per leg, independent of the Op and Unit dependency graphs. */
export function AttemptGantt({ pipeline, now }: { readonly pipeline: PipelineView; readonly now: number }) {
  const hatchId = useId();
  const rows = pipeline.legs.map(leg => ({ leg, atts: leg.attempts.filter(wasDispatched) })).filter(r => r.atts.length);
  if (!rows.length) return <p className="rounded-lg border p-4 text-sm text-muted-foreground">{t('No attempts to draw a timeline for yet.')}</p>;
  const all = rows.flatMap(r => r.atts);
  const closedAt = (a: DispatchedAttempt) => recordedTime(a.endedAt);
  const isLive = (a: DispatchedAttempt) => a.open && closedAt(a) == null;
  const settlementPending = (a: DispatchedAttempt) => a.open && closedAt(a) != null && recordedTime(a.settledAt) == null;
  // Terminal closure stops a dispatched span even when settlement has not been recorded.
  // Closed history with neither milestone remains an observed span, not an invented duration.
  const endOf = (a: DispatchedAttempt) => Math.max(a.dispatchedAt, recordedTime(a.settledAt) ?? closedAt(a) ?? (isLive(a) ? now : recordedTime(a.reportedAt) ?? a.dispatchedAt));
  const observedThrough = (a: DispatchedAttempt) => Math.max(endOf(a), recordedTime(a.reportedAt) ?? a.dispatchedAt, closedAt(a) ?? a.dispatchedAt);
  const hasLive = all.some(isLive);
  const t0 = Math.floor(Math.min(...all.map(a => a.dispatchedAt)) / STEP_MS) * STEP_MS;
  const t1 = Math.ceil(Math.max(...all.map(observedThrough)) / STEP_MS) * STEP_MS + STEP_MS;
  const span = t1 - t0;
  const base = span / STEP_MS;
  const mult = ladder.find(m => base / m <= 48) ?? Math.ceil(base / 48);
  const plotW = Math.min(3600, Math.max(640, (base / mult) * 44));
  const x = (t: number) => LABEL_W + ((t - t0) / span) * plotW;
  const width = LABEL_W + plotW + RIGHT;
  // Greedy lane packing per leg so parallel attempts do not overlap.
  const laid = rows.map(({ leg, atts }) => {
    const ends: number[] = [];
    const bars = [...atts].sort((a, b) => a.dispatchedAt - b.dispatchedAt || a.id - b.id).map(a => {
      let lane = ends.findIndex(e => e <= a.dispatchedAt);
      if (lane < 0) lane = ends.length;
        // Keep later recorded milestones in the same lane without changing the bar endpoint.
        ends[lane] = Math.max(observedThrough(a), a.dispatchedAt + 6 * span / plotW);
      return { a, lane };
    });
    return { leg, bars, lanes: Math.max(1, ends.length) };
  });
  let y = TOP;
  const placed = laid.map(r => { const h = r.lanes * LANE_H + ROW_PAD * 2; const out = { ...r, y, h }; y += h; return out; });
  const height = y + 8;
  const ticks: number[] = [];
  for (let tick = t0; tick <= t1; tick += STEP_MS * mult) ticks.push(tick);
  const nowX = x(now);
  return <div className="space-y-2">
    <p className="text-xs text-muted-foreground">{t('Bars show dispatch to settlement, or terminal closure while settlement is pending.')}</p>
    <div className="max-w-full overflow-x-auto rounded-lg border bg-card focus-visible:outline-2 focus-visible:outline-ring" tabIndex={0} aria-label={t('Timeline, scroll horizontally')}>
    <svg width={width} height={height} role="group" aria-label={t('Attempt timeline by leg')} className="block text-foreground" style={{ minWidth: width }}>
      <defs>
        <pattern id={hatchId} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" style={{ fill: 'var(--card)' }} /><line x1="0" y1="0" x2="0" y2="6" strokeWidth="1" style={{ stroke: 'var(--border)' }} /></pattern>
      </defs>
      {ticks.map(tick => <g key={tick}>
        <line x1={x(tick)} x2={x(tick)} y1={TOP - 6} y2={height - 6} style={{ stroke: 'var(--border)' }} strokeWidth="1" />
        <text x={x(tick)} y={14} textAnchor="middle" fontSize="10.5" style={{ fill: 'var(--muted-foreground)' }}>{span >= 24 * 60 * 60_000 ? formatDayTime(tick).slice(0, 11) : formatHm(tick)}<title>{formatDayTime(tick)}</title></text>
      </g>)}
      {placed.map(({ leg, bars, y: top, h }) => <g key={`${leg.seq}:${leg.op}`}>
        <line x1={0} x2={width} y1={top + h} y2={top + h} style={{ stroke: 'var(--border)' }} strokeWidth="1" />
        <text x={8} y={top + h / 2 + 4} fontSize="12" fontFamily="var(--font-mono, monospace)" style={{ fill: 'var(--foreground)' }}>{leg.op.length > 26 ? `${leg.op.slice(0, 25)}…` : leg.op}<title>{leg.op}</title></text>
        {bars.map(({ a, lane }) => {
          const live = isLive(a);
          const pending = settlementPending(a);
          const terminalAt = closedAt(a);
          const settledAt = recordedTime(a.settledAt);
          const reportedAt = recordedTime(a.reportedAt);
          const label = pending ? t('Terminal closed · settlement pending') : statusLabels[a.status];
          const tone = statusTone[pending ? 'settling' : a.status];
          const bx = x(a.dispatchedAt); const bw = Math.max(6, x(endOf(a)) - bx);
          const by = top + ROW_PAD + lane * LANE_H + (LANE_H - BAR_H) / 2;
          const endpoint = settledAt != null ? formatDayTime(settledAt) : terminalAt != null ? formatDayTime(terminalAt) : live ? t('now') : t('No end time recorded');
          const elapsed = settledAt != null || terminalAt != null || live ? formatDuration(endOf(a) - a.dispatchedAt) : t('Observed through {at}', { at: formatDayTime(endOf(a)) });
          const sequence = Number.isFinite(a.dispatchSeq) ? t('dispatch {n}', { n: a.dispatchSeq }) : t('Dispatch sequence not recorded');
          const tip = `#${a.id} · ${t('try {n}', { n: a.try })} · ${sequence} · ${label}\n${a.model ?? a.agent ?? t('unknown model')}\n${a.unit ?? a.job}\n${formatDayTime(a.dispatchedAt)} → ${endpoint}\n${elapsed}${reportedAt != null ? `\n${t('Reported at {at}', { at: formatDayTime(reportedAt) })}` : ''}${terminalAt != null ? `\n${t('Terminal closed at {at}', { at: formatDayTime(terminalAt) })}` : ''}${settledAt != null ? `\n${t('Settled at {at}', { at: formatDayTime(settledAt) })}` : pending ? `\n${t('No settlement time recorded')}` : ''}`;
          return <a key={a.id} href={a.href} aria-label={tip} className="focus-visible:outline-2 focus-visible:outline-ring"><g>
            <title>{tip}</title>
            <rect x={bx} y={by} width={bw} height={BAR_H} rx="3" strokeWidth="1" strokeDasharray={pending ? '3 2' : undefined} style={{ fill: live ? `url(#${hatchId})` : 'var(--muted)', stroke: 'var(--border)' }} />
            <line x1={bx + 1.5} x2={bx + 1.5} y1={by + 3} y2={by + BAR_H - 3} strokeWidth="2" style={{ stroke: toneVar(tone) }} />
            {reportedAt != null && reportedAt >= a.dispatchedAt && <line x1={x(reportedAt)} x2={x(reportedAt)} y1={by + 2} y2={by + BAR_H - 2} strokeWidth="1" style={{ stroke: 'var(--muted-foreground)' }}><title>{t('Reported at {at}', { at: formatDayTime(reportedAt) })}</title></line>}
            {terminalAt != null && terminalAt >= a.dispatchedAt && <path d={`M ${x(terminalAt)} ${by - 2} l 3 3 l -3 3 l -3 -3 z`} style={{ fill: 'var(--foreground)' }}><title>{t('Terminal closed at {at}', { at: formatDayTime(terminalAt) })}</title></path>}
            {settledAt != null && settledAt >= a.dispatchedAt && <line x1={x(settledAt)} x2={x(settledAt)} y1={by - 1} y2={by + BAR_H + 1} strokeWidth="1.5" style={{ stroke: 'var(--foreground)' }}><title>{t('Settled at {at}', { at: formatDayTime(settledAt) })}</title></line>}
            {bw >= 20 && <foreignObject x={bx + 2} y={by + 1} width={14} height={14}><span className="grid size-3.5 place-items-center rounded-full border p-px" style={tintStyle(familyTint[agentOf(a).family].tone)}><AgentMark family={agentOf(a).family} initial="?" /></span></foreignObject>}
            {bw >= 44 && <text x={bx + 19} y={by + 12} fontSize="10.5" fontWeight="600" style={{ fill: 'var(--foreground)' }}>#{a.id}</text>}
          </g></a>;
        })}
      </g>)}
      {hasLive && now >= t0 && now <= t1 && <g>
        <line x1={nowX} x2={nowX} y1={TOP - 6} y2={height - 6} strokeWidth="1.5" style={{ stroke: 'var(--chart-muted)' }} />
        <text x={Math.min(nowX + 4, width - 52)} y={TOP + 10} fontSize="10.5" fontWeight="600" style={{ fill: 'var(--foreground)' }}>{t('now')}</text>
      </g>}
    </svg>
    </div>
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"><span>{t('Short marker: report')}</span><span>{t('Diamond: terminal closure')}</span><span>{t('Full marker: settlement')}</span><span>{t('Dashed outline: settlement pending')}</span></div>
  </div>;
}
