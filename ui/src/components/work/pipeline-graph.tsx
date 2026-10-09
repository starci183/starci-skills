import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { Button, Card } from '@heroui/react';
import type { LegRow, PipelineView } from '../../contract';
import { Stagger, StaggerItem } from '../motion';
import type { Concept } from '../concept';
import { StatusChip } from '../status-chip';
import { statusLabels, statusTone, toneVar } from '../status';
import { AgentStack } from '../agent/agent-avatar';
import { legAgents, legGoal, legName } from './pipeline/node/op-identity';
import { NODE_H, buildColumns, layoutPipeline } from './pipeline/layout';
import { useNodeHeights } from './use-node-heights';
import { t } from '../../i18n/t';

export const concept: Concept = 'C4';

/** Recorded unit progress or plan disposition; dispatch history never implies spent business retries. */
export function legSummary(leg: LegRow): string {
  if (leg.status === 'deferred') return leg.deferred ?? t('Deferred by configuration');
  if (leg.status === 'external') return leg.deferred ?? t('Handled externally');
  if (leg.inPlan && leg.binding === 'unbound') return t('No revision-bound runtime units');
  if (leg.units.length > 0) return t('{units} units · {done} passed', { units: leg.units.length, done: leg.units.filter(unit => unit.state === 'done').length });
  if (leg.attempts.length) return t('Recorded dispatch history');
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

/** A real button owns leg selection; the surrounding card and SVG edges are presentation only. */
function LegCard({ leg, selected, onSelect, style, history = false }: Readonly<{
  leg: LegRow; selected: string | null; onSelect: (leg: LegRow) => void; style?: CSSProperties; history?: boolean;
}>) {
  const agents = legAgents(leg);
  const name = legName(leg);
  return <Card data-leg={leg.op} data-current={leg.current} data-status={leg.status} data-tone={statusTone[leg.status]} style={style}
    title={[name, leg.op, legSummary(leg), legGoal(leg)].filter(Boolean).join('\n')}
    className={`pipeline-node min-w-0 p-0 ${leg.current ? 'ring-1 ring-[var(--status-running)]' : ''} ${selected === leg.op ? 'outline outline-2 outline-ring outline-offset-2' : ''}`}>
    <Button variant="ghost" onPress={() => onSelect(leg)} aria-pressed={selected === leg.op}
      aria-label={`${name} (${leg.op}): ${statusLabels[leg.status]}, ${legSummary(leg)}, ${t('Attempts: {n}', { n: leg.attempts.length })}${leg.current ? t(', the current leg') : ''}`}
      style={{ minHeight: style?.minHeight }} className="h-auto min-h-0 w-full min-w-0 flex-col items-stretch justify-start gap-2 whitespace-normal rounded-[inherit] p-3 text-left">
      <span className="block min-w-0 break-words text-base font-semibold leading-6">{name}</span>
      <span className="block min-w-0 truncate font-mono text-xs text-muted-foreground" title={leg.op}>{leg.op}</span>
      <span className="flex items-center"><StatusChip status={leg.status} /></span>
      <span className="block min-w-0 break-words text-[13px] font-normal leading-5 text-muted-foreground">{legSummary(leg)}</span>
      {history && leg.injected && <span className="block break-words text-xs font-normal text-muted-foreground">{t(leg.injected)}</span>}
      {(leg.attempts.length > 0 || agents.length > 0) && <span className="mt-auto flex min-w-0 flex-wrap items-center justify-between gap-2 pt-1">
        {leg.attempts.length > 0 && <span className="flex min-w-0 flex-col gap-1 text-xs font-normal text-muted-foreground" title={t('Attempts · dispatch history')}>
          <span>{t('Attempts: {n}', { n: leg.attempts.length })}</span>
          <span className="flex items-center gap-1" aria-hidden="true">{leg.attempts.slice(-6).map(attempt => <span key={attempt.id} className="status-dot" data-tone={statusTone[attempt.status]} />)}{leg.attempts.length > 6 && <span>+{leg.attempts.length - 6}</span>}</span>
        </span>}
        {agents.length > 0 && <AgentStack agents={agents} max={2} size={20} />}
      </span>}
    </Button>
  </Card>;
}

/** The exact planned Op chain keeps native dependencies, with separate operation history. */
export function PipelineGraph({ pipeline, selected, onSelect }: { readonly pipeline: PipelineView; readonly selected: string | null; readonly onSelect: (leg: LegRow) => void }) {
  const narrow = useNarrow();
  const planned = { ...pipeline, legs: pipeline.legs.filter(leg => leg.inPlan) };
  const history = pipeline.legs.filter(leg => !leg.inPlan);
  return <div className="min-w-0 space-y-4">
    {pipeline.anomalies.length ? <div className="space-y-3"><p className="text-sm text-muted-foreground">{t('Recorded graph anomalies; dependency ordering is unavailable.')}</p>{pipeline.anomalies.map(anomaly => <p key={`${anomaly.kind}:${anomaly.from}:${anomaly.to}`} className="break-all font-mono text-xs">{anomaly.kind} · {anomaly.from ?? '—'} → {anomaly.to ?? '—'}</p>)}<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{planned.legs.map(leg => <LegCard key={leg.op} leg={leg} selected={selected} onSelect={onSelect} />)}</div></div>
      : !planned.legs.length ? <p className="text-sm text-muted-foreground">{t('This workflow has no planned op chain yet.')}</p>
      : narrow ? <PipelineList pipeline={planned} selected={selected} onSelect={onSelect} /> : <PipelineCanvas pipeline={planned} selected={selected} onSelect={onSelect} />}
    {history.length > 0 && <div className="border-t pt-3"><h3 className="text-sm font-semibold">{t('Recorded operation history')}</h3><p className="mt-1 text-xs text-muted-foreground">{t('Operation scope; excluded from plan progress. Instance association is unproven.')}</p><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{history.map(leg => <LegCard key={leg.op} leg={leg} selected={selected} onSelect={onSelect} history />)}</div></div>}
  </div>;
}

const edgeStroke = (tone: 'current' | 'done' | 'plain') => tone === 'current' ? toneVar('running') : tone === 'done' ? toneVar('success', '-line') : 'var(--muted-foreground)';

function PipelineCanvas({ pipeline, selected, onSelect }: { readonly pipeline: PipelineView; readonly selected: string | null; readonly onSelect: (leg: LegRow) => void }) {
  const holder = useRef<HTMLDivElement>(null);
  const arrowId = useId();
  const [measured, setMeasured] = useState(1050);
  const nodeHeights = useNodeHeights(holder, { selector: '[data-leg]', dataKey: 'leg', source: pipeline, width: measured });
  useEffect(() => {
    const el = holder.current; if (!el) return;
    const read = () => setMeasured(Math.floor(el.getBoundingClientRect().width));
    read();
    const observer = new ResizeObserver(read); observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const { columns, placed, edges, width, height, nodeW } = layoutPipeline(pipeline, measured, nodeHeights);
  return <div ref={holder} tabIndex={0} role="region" aria-label={t('A chain of {legs} legs in {cols} columns', { legs: pipeline.legs.length, cols: columns.length })}
    className="max-w-full overflow-x-auto pb-2 focus-visible:outline-2 focus-visible:outline-ring" data-pipeline-graph data-scrolls={width > measured}>
    <div className="relative" style={{ width, height }}>
      {columns.map(col => <p key={col.level} className="absolute top-0 break-words text-xs font-semibold text-muted-foreground" style={{ left: placed.get(col.legs[0].op)!.x, width: nodeW }}>{col.index + 1}. {col.label}</p>)}
      <svg width={width} height={height} className="pointer-events-none absolute inset-0" aria-hidden="true">
        <defs>{(['plain', 'current', 'done'] as const).map(kind => <marker key={kind} id={`${arrowId}-${kind}`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill={edgeStroke(kind)} /></marker>)}</defs>
        <g fill="none">{edges.map((edge, index) => <path key={`${edge.from}>${edge.to}:${index}`} d={edge.path} markerEnd={`url(#${arrowId}-${edge.tone})`} stroke={edgeStroke(edge.tone)} strokeWidth={edge.tone === 'current' ? 1.8 : 1.2}><title>{`${edge.from} → ${edge.to}`}</title></path>)}</g>
      </svg>
      {[...placed.values()].map(({ leg, x, y }) => <LegCard key={leg.op} leg={leg} selected={selected} onSelect={onSelect} style={{ position: 'absolute', left: x, top: y, width: nodeW, minHeight: NODE_H }} />)}
    </div>
  </div>;
}

function PipelineList({ pipeline, selected, onSelect }: { readonly pipeline: PipelineView; readonly selected: string | null; readonly onSelect: (leg: LegRow) => void }) {
  const columns = buildColumns(pipeline.legs);
  return <div data-pipeline-list><Stagger as="ol" className="flex flex-col gap-4">{columns.map(col => <StaggerItem as="li" key={col.level}>
    <p className="mb-2 text-xs font-semibold text-muted-foreground">{col.index + 1}. {col.label}{col.legs.length > 1 && <span className="font-normal"> · {t('parallel')}</span>}</p>
    <ul className="flex flex-col gap-3">{col.legs.map(leg => <li key={leg.op}><LegCard leg={leg} selected={selected} onSelect={onSelect} /></li>)}</ul>
  </StaggerItem>)}</Stagger></div>;
}
