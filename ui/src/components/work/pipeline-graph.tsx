import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { motion } from 'motion/react';
import type { LegRow, PipelineView } from '../../contract';
import { EASE, Stagger, StaggerItem } from '../motion';
import type { Concept } from '../concept';
import { StatusChip } from '../status-chip';
import { statusLabels, statusTone, toneVar, type Status } from '../status';
import { AttemptDotsSvg } from './pipeline/attempt-dots';
import { AgentStack } from '../agent/agent-avatar';
import { legAgents, legGoal, legName } from './pipeline/node/op-identity';
import { NODE_H, buildColumns, layoutPipeline, legTries } from './pipeline/layout';
import { t } from '../../i18n/t';

export const concept: Concept = 'C4';

/** Split a name into at most two lines on word boundaries (second line clipped). */
function wrap2(text: string, n: number): string[] {
  if (text.length <= n) return [text];
  const words = text.split(' '); let first = '';
  while (words.length && (first ? `${first} ${words[0]}` : words[0]).length <= n) first = first ? `${first} ${words.shift()}` : words.shift()!;
  if (!first) return [clip(text, n)];
  return [first, clip(words.join(' '), n)];
}
const clip = (text: string, n: number) => text.length > n ? `${text.slice(0, n - 1)}…` : text;
const dashed = (status: Status) => statusTone[status] === 'skipped';

/** Second line under the status: tries, or units, or the reason a leg is not running. */
export function legSummary(leg: LegRow): string {
  if (leg.status === 'deferred') return leg.deferred ?? t('Deferred by configuration');
  if (leg.status === 'external') return leg.deferred ?? t('Handled externally');
  if (leg.inPlan && leg.binding === 'unbound') return t('No revision-bound runtime units');
  if (leg.units.length > 1) return t('{units} units · {done} passed', { units: leg.units.length, done: leg.units.filter(unit => unit.state === 'done').length });
  if (leg.units.length === 1 || leg.attempts.length) { const { tries, budget } = legTries(leg); return budget == null ? t('try {n}', { n: tries }) : t('try {tries}/{budget}', { tries, budget }); }
  return leg.status === 'planned' ? t('not dispatched') : t('no attempts yet');
}

function useNarrow(max = 760) {
  const query = `(max-width: ${max}px)`;
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = () => setNarrow(media.matches);
    onChange(); media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [query]);
  return narrow;
}

const activate = (leg: LegRow, onSelect: (leg: LegRow) => void) => (event: KeyboardEvent) => {
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(leg); }
};

/** S3: the whole planned op chain as a pipeline (columns = levels, stacked = parallel). */
export function PipelineGraph({ pipeline, selected, onSelect }: { pipeline: PipelineView; selected: string | null; onSelect: (leg: LegRow) => void }) {
  const narrow = useNarrow();
  const planned = { ...pipeline, legs: pipeline.legs.filter(leg => leg.inPlan) };
  const history = pipeline.legs.filter(leg => !leg.inPlan);
  return <div className="space-y-4">
    {!planned.legs.length ? <p className="text-sm text-muted-foreground">{t('This workflow has no planned op chain yet.')}</p> : pipeline.anomalies.length ? <div className="space-y-2 rounded-md border p-3"><p className="text-sm text-muted-foreground">{t('Recorded graph anomalies; dependency ordering is unavailable.')}</p>{pipeline.anomalies.map((anomaly, index) => <p key={index} className="break-all font-mono text-xs">{anomaly.kind} · {anomaly.from ?? '—'} → {anomaly.to ?? '—'}</p>)}<div className="flex flex-wrap gap-2">{planned.legs.map(leg => <button key={leg.op} type="button" onClick={() => onSelect(leg)} className="rounded-md border px-3 py-2 text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring">{legName(leg)} · {leg.op}</button>)}</div></div> : narrow ? <PipelineList pipeline={planned} selected={selected} onSelect={onSelect} /> : <PipelineSvg pipeline={planned} selected={selected} onSelect={onSelect} />}
    {history.length > 0 && <div className="border-t pt-3"><h3 className="text-sm font-semibold">{t('Recorded operation history')}</h3><p className="mt-1 text-xs text-muted-foreground">{t('Operation scope; excluded from plan progress. Instance association is unproven.')}</p><div className="mt-2 flex flex-wrap gap-2">{history.map(leg => <button key={leg.op} type="button" aria-pressed={selected === leg.op} onClick={() => onSelect(leg)} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"><StatusChip status={leg.status} /><span>{legName(leg)} <span className="font-mono text-xs text-muted-foreground">{leg.op}</span></span><span className="text-xs text-muted-foreground">{t('{n} attempts', { n: leg.attempts.length })}</span></button>)}</div></div>}
  </div>;
}

const edgeStroke = (tone: 'current' | 'done' | 'plain') => tone === 'current' ? toneVar('running') : tone === 'done' ? toneVar('success', '-line') : 'var(--muted-foreground)';

function PipelineSvg({ pipeline, selected, onSelect }: { pipeline: PipelineView; selected: string | null; onSelect: (leg: LegRow) => void }) {
  const holder = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState(1050);
  useEffect(() => {
    const el = holder.current; if (!el) return;
    const read = () => setMeasured(Math.floor(el.getBoundingClientRect().width));
    read();
    const observer = new ResizeObserver(read); observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const avail = Math.max(900, measured);
  const { columns, placed, edges, width, height, nodeW } = layoutPipeline(pipeline, avail);
  const chars = Math.max(6, Math.floor((nodeW - 14) / 6.3));
  const scrolls = width > measured;
  return <div className="relative" data-pipeline-graph data-scrolls={scrolls}>
    <div ref={holder} className="overflow-x-auto">
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="group" aria-label={t('A chain of {legs} legs in {cols} columns', { legs: pipeline.legs.length, cols: columns.length })} className="block max-w-none">
      <defs>
        {(['plain', 'current', 'done'] as const).map(kind => <marker key={kind} id={`pg-arrow-${kind}`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill={edgeStroke(kind)} /></marker>)}
      </defs>
      {columns.map(col => <text key={col.level} x={placed.get(col.legs[0].op)!.x} y={18} fontSize="11" fontWeight="600" letterSpacing=".04em" className="fill-muted-foreground"><title>{`${col.index + 1}. ${col.label}`}</title>{clip(`${col.index + 1}. ${col.label.split(' · ')[0]}`, chars + 3)}</text>)}
      <g fill="none">{edges.map(edge => <path key={`${edge.from}>${edge.to}`} d={edge.path} markerEnd={`url(#pg-arrow-${edge.tone})`}
        stroke={edgeStroke(edge.tone)} strokeWidth={edge.tone === 'current' ? 1.8 : 1.2} opacity={edge.tone === 'plain' ? 1 : 0.8}><title>{`${edge.from} → ${edge.to}`}</title></path>)}</g>
      {[...placed.values()].map(({ leg, x, y }) => {
        const tone = statusTone[leg.status], isSel = selected === leg.op;
        const name = legName(leg), goal = legGoal(leg), agents = legAgents(leg);
        return <g key={leg.op} transform={`translate(${x},${y})`} data-tone={tone} data-leg={leg.op} data-status={leg.status} role="button" tabIndex={0} className="group cursor-pointer outline-none"
          aria-label={`${name} (${leg.op}): ${statusLabels[leg.status]}, ${legSummary(leg)}${leg.current ? t(', the current leg') : ''}`} aria-pressed={isSel}
          onClick={() => onSelect(leg)} onKeyDown={activate(leg, onSelect)}>
          <motion.g initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease: EASE, delay: 0.04 * (placed.get(leg.op)?.col ?? 0) }}>
          <title>{`${name} (${leg.op}) · ${statusLabels[leg.status]}${leg.deferred ? ` · ${leg.deferred}` : ''}${goal ? `
${goal}` : ''}`}</title>
          {leg.current && <rect x={-3} y={-3} width={nodeW + 6} height={NODE_H + 6} rx={8} fill="none" stroke={toneVar('running')} strokeWidth={1.5} />}
          <rect width={nodeW} height={NODE_H} rx={6} fill="var(--card)" stroke={isSel ? 'var(--ring)' : 'var(--border)'} strokeWidth={isSel ? 1.5 : 1} strokeDasharray={dashed(leg.status) ? '5 4' : undefined} />
          <rect x={-3} y={-3} width={nodeW + 6} height={NODE_H + 6} rx={8} fill="none" stroke="var(--ring)" strokeWidth={2} className="opacity-0 group-focus-visible:opacity-100" />
          <text x={8} y={19} fontSize="13" fontWeight="650" className="fill-foreground">{wrap2(name, Math.floor(chars * 0.9)).map((line, i) => <tspan key={i} x={8} dy={i ? 15 : 0}>{line}</tspan>)}</text>
          <circle cx={12} cy={55} r={3.5} fill="var(--tone)" />
          <text x={20} y={59} fontSize="11.5" fontWeight="600" fill="var(--tone)">{clip(statusLabels[leg.status], chars - 2)}</text>
          <text x={8} y={79} fontSize="11.5" className="fill-muted-foreground">{clip(legSummary(leg), chars)}</text>
          {leg.attempts.length > 0 && <AttemptDotsSvg attempts={leg.attempts} x={4} y={98} max={Math.max(2, Math.floor((nodeW - 8) / 12) - 4)} />}
          {agents.length > 0 && <foreignObject x={nodeW - (nodeW < 120 ? 36 : 64)} y={NODE_H - 26} width={nodeW < 120 ? 32 : 60} height={22}><div className="flex h-full items-center justify-end"><AgentStack agents={agents} max={nodeW < 120 ? 1 : 2} size={20} /></div></foreignObject>}
          </motion.g>
        </g>;
      })}
    </svg>
    </div>
    {scrolls && <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-card to-transparent" />}
  </div>;
}

function PipelineList({ pipeline, selected, onSelect }: { pipeline: PipelineView; selected: string | null; onSelect: (leg: LegRow) => void }) {
  const columns = buildColumns(pipeline.legs);
  return <div data-pipeline-list><Stagger as="ol" className="flex flex-col gap-4">{columns.map(col => <StaggerItem as="li" key={col.level}>
    <p className="mb-2 text-xs font-semibold text-muted-foreground">{col.index + 1}. {col.label}{col.legs.length > 1 && <span className="font-normal normal-case"> · {t('parallel')}</span>}</p>
    <ul className="flex flex-col gap-2">{col.legs.map(leg => <li key={leg.op}>
      <button type="button" data-tone={statusTone[leg.status]} data-leg={leg.op} aria-pressed={selected === leg.op} onClick={() => onSelect(leg)}
        className={`flex w-full min-w-0 flex-col gap-2 rounded-md border bg-card px-3 py-3 text-left focus-visible:outline-2 focus-visible:outline-ring ${dashed(leg.status) ? 'border-dashed' : ''} ${leg.current ? 'ring-1 ring-[var(--status-running)]' : ''} ${selected === leg.op ? 'border-ring' : 'border-border'}`}>
        <span className="flex w-full min-w-0 items-start justify-between gap-2"><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold" title={legGoal(leg) ?? undefined}>{legName(leg)}</span>
          <span className="block truncate text-xs text-muted-foreground" title={leg.op}>{leg.op}</span></span><StatusChip status={leg.status} /></span>
        <span className="block w-full truncate text-xs text-muted-foreground">{legSummary(leg)}</span>
        {(legAgents(leg).length > 0 || leg.attempts.length > 0) && <span className="flex w-full items-center justify-between gap-2">
          {leg.attempts.length > 0 && <span className="flex shrink-0 gap-1" aria-hidden="true">{leg.attempts.slice(-6).map(attempt => <span key={attempt.id} className="status-dot" data-tone={statusTone[attempt.status]} />)}</span>}
          {legAgents(leg).length > 0 && <span className="shrink-0"><AgentStack agents={legAgents(leg)} max={2} size={20} /></span>}
        </span>}
      </button>
    </li>)}</ul>
  </StaggerItem>)}</Stagger></div>;
}
