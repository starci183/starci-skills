import type { Concept } from '../concept';
export const concept: Concept = 'C16';
import type { AttemptRow } from '../../contract';
import { toneVar } from '../status';
import { attemptState, fmtMin, groupBy, median, minutes, num } from './analytics-data';
import { ChartCard } from './chart-card';
import { useWidth } from './use-width';
import { AgentMark, familyTint, tintStyle } from '../agent/agent-marks';
import { agentOf } from '../agent/agent-avatar';
import { t } from '../../i18n/t';

const ROW = 76;

function AgentGlyph({ model, pool }: { model: string; pool: string | null }) {
  const agent = agentOf({ model, pool });
  const tint = familyTint[agent.family];
  return <foreignObject x={0} y={-3} width={22} height={22}><span className="grid size-5 place-items-center rounded-full border p-[3px]" style={tintStyle(tint.tone)} title={[tint.name, pool, model].filter(Boolean).join(' · ')}><AgentMark family={agent.family} initial={model[0]?.toUpperCase()} /></span></foreignObject>;
}

export function ModelRates({ rows }: { rows: AttemptRow[] }) {
  const [ref, width] = useWidth();
  const models = [...groupBy(rows, row => row.model ?? t('model unknown')).entries()].map(([model, list]) => {
    const first = list.filter(r => (r.attempt || 1) <= 1 && r.verdict != null && attemptState(r) !== 'dropped');
    const pass = first.filter(r => r.verdict === 'pass').length;
    const running = list.filter(r => attemptState(r) === 'run').length;
    const p50 = median(list.map(r => r.cycleMs).filter((v): v is number => v != null));
    return { model, pool: list.find(r => r.pool)?.pool ?? null, total: list.length, settled: list.length - running, running, first: first.length, pass, rate: first.length ? pass / first.length : null, p50 };
  }).sort((a, b) => b.total - a.total);
  return <ChartCard title={t('Models: first-try pass')} hint={t("The share of each unit's first attempt settled as passed, per model.")}
    legend={[{ tone: 'success', label: t('Passed on the first try') }, { label: t('The rest') }]} empty={!models.length && t('No attempts in this range yet.')}>
    <div ref={ref}><svg width={width} height={models.length * ROW} role="img" aria-label={t('First-try pass rate by model')} className="block max-w-full">
      {models.map((m, i) => <g key={m.model} transform={`translate(0 ${i * ROW})`}>
        <AgentGlyph model={m.model} pool={m.pool} /><text x={26} y={14} className="fill-foreground font-mono text-[12px]">{m.model}</text>
        <text x={width} y={14} textAnchor="end" className="fill-foreground text-[13px] font-semibold tabular-nums">{m.rate == null ? '—' : `${num(m.rate * 100, 0)}%`}</text>
        <rect x={0} y={22} width={width} height={14} rx={4} className="fill-muted">
          <title>{m.rate == null ? t('{model}: no first try settled yet', { model: m.model }) : t('{model}: {pass}/{first} first tries passed', { model: m.model, pass: m.pass, first: m.first })}</title></rect>
        {m.rate != null && m.rate > 0 ? <rect x={0} y={22} width={Math.max(m.rate * width, 3)} height={14} rx={4} fill={toneVar('success')}><title>{t('{model}: {pass}/{first} first tries passed', { model: m.model, pass: m.pass, first: m.first })}</title></rect> : null}
        <text x={0} y={54} className="fill-muted-foreground text-[11.5px]">{t('first try {pass}/{first} · p50 {p50}', { pass: m.pass, first: m.first, p50: m.p50 == null ? '—' : fmtMin(minutes(m.p50)) })}</text>
        <text x={0} y={69} className="fill-muted-foreground text-[11.5px]">{t('{total} attempts: {settled} settled, {running} running', { total: m.total, settled: m.settled, running: m.running })}</text>
      </g>)}
    </svg></div>
  </ChartCard>;
}
