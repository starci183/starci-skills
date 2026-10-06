import type { Concept } from '../concept';
export const concept: Concept = 'C16';
import type { AttemptRow } from '../../contract';
import { toneVar, type Tone } from '../status';
import { groupBy, num, triesPerUnit } from './analytics-data';
import { ChartCard } from './chart-card';
import { useWidth } from './use-width';
import { t } from '../../i18n/t';

const ROW = 30;
/** The ledger sometimes stores the class as a JSON object; show its `class` field. */
function failureName(raw: string): string {
  if (!raw.startsWith('{')) return raw;
  try { const parsed = JSON.parse(raw) as { class?: unknown }; return typeof parsed.class === 'string' ? parsed.class : raw; } catch { return raw; }
}
type Bar = { key: string; label: string; n: number; tone: Tone; title: string };

function Bars({ bars, width, aria }: Readonly<{ bars: Bar[]; width: number; aria: string }>) {
  const max = Math.max(1, ...bars.map(b => b.n)), labelW = Math.min(150, width * 0.4), valueW = 36, plotW = Math.max(40, width - labelW - valueW - 10);
  const chars = Math.floor(labelW / 6.4);
  return <svg width={width} height={bars.length * ROW} role="img" aria-label={aria} className="block max-w-full">
    {bars.map((b, i) => <g key={b.key} transform={`translate(0 ${i * ROW})`}>
      <text x={0} y={ROW / 2 + 4} className="fill-foreground text-[12px]"><title>{b.label}</title>{b.label.length > chars ? `${b.label.slice(0, chars - 1)}…` : b.label}</text>
      <rect x={labelW + 6} y={6} width={Math.max(3, (b.n / max) * plotW)} height={16} rx={4} fill={toneVar(b.tone)}><title>{b.title}</title></rect>
      <text x={width} y={ROW / 2 + 4} textAnchor="end" className="fill-foreground text-[12px] font-semibold tabular-nums">{num(b.n, 0)}</text>
    </g>)}
  </svg>;
}

export function Retries({ rows }: Readonly<{ rows: AttemptRow[] }>) {
  const [ref, width] = useWidth();
  const dist = [...triesPerUnit(rows).entries()].sort((a, b) => a[0] - b[0]);
  const tryBars: Bar[] = dist.map(([tries, n]) => ({ key: `t${tries}`, label: t('Highest observed try: {n}', { n: tries }), n, tone: tries === 1 ? 'success' : tries === 2 ? 'warning' : 'failed',
    title: t('{n} units have observed try {tries} in this cohort', { n, tries }) }));
  const classes = [...groupBy(rows.filter(r => r.failureClass), r => failureName(r.failureClass as string)).entries()].map(([k, list]) => ({ k, n: list.length })).sort((a, b) => b.n - a.n).slice(0, 6);
  const failBars: Bar[] = classes.map(c => ({ key: c.k, label: c.k, n: c.n, tone: 'failed', title: t('{kind}: {n} attempts', { kind: c.k, n: c.n }) }));
  return <ChartCard title={t('Retries')} hint={t('Highest recorded try per unit in the dispatch cohort; not completion or spent retry budget.')}
    legend={[{ tone: 'success', label: t('Try 1') }, { tone: 'warning', label: t('Try 2') }, { tone: 'failed', label: t('Try 3 and up / failure classes') }]}
    empty={!tryBars.length && !failBars.length && t('No unit was tried in this range yet.')}>
    <div ref={ref}>
      <h3 className="mb-2 text-sm font-medium">{t('Tries per unit')}</h3>
      {tryBars.length ? <Bars bars={tryBars} width={width} aria={t('Distribution of tries per unit')} /> : <p className="text-xs text-muted-foreground">{t('No units yet.')}</p>}
      <h3 className="mb-2 mt-4 text-sm font-medium">{t('Common failure classes')}</h3>
      {failBars.length ? <Bars bars={failBars} width={width} aria={t('The common failure classes')} /> : <p className="text-xs text-muted-foreground">{t('No failure class recorded.')}</p>}
    </div>
  </ChartCard>;
}
