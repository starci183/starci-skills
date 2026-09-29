import { useEffect, useState, type KeyboardEvent } from 'react';
import type { LegRow, PipelineView } from '../../contract';
import type { Concept } from '../concept';
import { StatusChip } from '../status-chip';
import { statusLabels, statusTone, toneVar, type Status } from '../status';
import { AttemptDotsSvg } from './pipeline/attempt-dots';
import { NODE_H, NODE_W, buildColumns, layoutPipeline, legTries } from './pipeline/layout';

export const concept: Concept = 'C4';

const clip = (text: string, n: number) => text.length > n ? `${text.slice(0, n - 1)}…` : text;
const dashed = (status: Status) => statusTone[status] === 'skipped';

/** Second line under the status: tries, or units, or the reason a leg is not running. */
export function legSummary(leg: LegRow): string {
  if (leg.status === 'deferred') return leg.deferred ?? 'Hoãn theo cấu hình';
  if (leg.status === 'external') return leg.deferred ?? 'Do bên ngoài xử lý';
  if (leg.units.length > 1) return `${leg.units.length} unit · ${leg.units.filter(unit => unit.state === 'done').length} đạt`;
  if (leg.units.length === 1 || leg.attempts.length) { const { tries, budget } = legTries(leg); return `lần ${tries}/${budget}`; }
  return leg.status === 'planned' ? 'chưa giao' : 'chưa có lần thử';
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
  if (!pipeline.legs.length) return <p className="text-sm text-muted-foreground">Workflow này chưa có chuỗi op được lên kế hoạch.</p>;
  return narrow ? <PipelineList pipeline={pipeline} selected={selected} onSelect={onSelect} /> : <PipelineSvg pipeline={pipeline} selected={selected} onSelect={onSelect} />;
}

const edgeStroke = (tone: 'current' | 'done' | 'plain') => tone === 'current' ? toneVar('running') : tone === 'done' ? toneVar('success', '-line') : toneVar('skipped');

function PipelineSvg({ pipeline, selected, onSelect }: { pipeline: PipelineView; selected: string | null; onSelect: (leg: LegRow) => void }) {
  const { columns, placed, edges, width, height } = layoutPipeline(pipeline);
  return <div className="overflow-x-auto" data-pipeline-graph>
    <svg viewBox={`0 0 ${width} ${height}`} role="group" aria-label={`Chuỗi ${pipeline.legs.length} chặng, ${columns.length} cột`} className="block h-auto w-full" style={{ minWidth: Math.max(900, Math.round(width * 0.7)) }}>
      <defs>
        {(['plain', 'current', 'done'] as const).map(kind => <marker key={kind} id={`pg-arrow-${kind}`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill={edgeStroke(kind)} /></marker>)}
      </defs>
      {columns.map(col => <text key={col.level} x={placed.get(col.legs[0].op)!.x} y={18} fontSize="12" fontWeight="600" letterSpacing=".06em" className="fill-muted-foreground">{clip(`${col.index + 1}. ${col.label}`, 22)}</text>)}
      <g fill="none">{edges.map(edge => <path key={`${edge.from}>${edge.to}`} d={edge.path} markerEnd={`url(#pg-arrow-${edge.tone})`}
        stroke={edgeStroke(edge.tone)} strokeWidth={edge.tone === 'current' ? 2.2 : 1.4} opacity={edge.tone === 'plain' ? 0.55 : 1}><title>{`${edge.from} → ${edge.to}`}</title></path>)}</g>
      {[...placed.values()].map(({ leg, x, y }) => {
        const tone = statusTone[leg.status], isSel = selected === leg.op;
        return <g key={leg.op} transform={`translate(${x},${y})`} data-tone={tone} data-leg={leg.op} data-status={leg.status} role="button" tabIndex={0} className="group cursor-pointer outline-none"
          aria-label={`${leg.op}: ${statusLabels[leg.status]}, ${legSummary(leg)}${leg.current ? ', chặng hiện tại' : ''}`} aria-pressed={isSel}
          onClick={() => onSelect(leg)} onKeyDown={activate(leg, onSelect)}>
          <title>{`${leg.op} · ${statusLabels[leg.status]}${leg.deferred ? ` · ${leg.deferred}` : ''}`}</title>
          {leg.current && <rect x={-4} y={-4} width={NODE_W + 8} height={NODE_H + 8} rx={13} fill="none" stroke={toneVar('running')} strokeWidth={2.5} />}
          <rect width={NODE_W} height={NODE_H} rx={10} fill="var(--tone-bg)" stroke={isSel ? 'var(--primary)' : 'var(--tone-line)'} strokeWidth={isSel ? 2.5 : 1.5} strokeDasharray={dashed(leg.status) ? '5 4' : undefined} />
          <rect x={-3} y={-3} width={NODE_W + 6} height={NODE_H + 6} rx={12} fill="none" stroke="var(--primary)" strokeWidth={2} className="opacity-0 group-focus-visible:opacity-100" />
          <text x={12} y={25} fontSize="15" fontWeight="650" className="fill-foreground">{clip(leg.op, 19)}</text>
          <circle cx={16} cy={42} r={4} fill="var(--tone)" />
          <text x={26} y={46} fontSize="13" fontWeight="600" fill="var(--tone)">{statusLabels[leg.status]}</text>
          <text x={12} y={65} fontSize="13" className="fill-muted-foreground">{clip(legSummary(leg), 24)}</text>
          {leg.attempts.length > 0 && <AttemptDotsSvg attempts={leg.attempts} x={8} y={83} />}
        </g>;
      })}
    </svg>
  </div>;
}

function PipelineList({ pipeline, selected, onSelect }: { pipeline: PipelineView; selected: string | null; onSelect: (leg: LegRow) => void }) {
  const columns = buildColumns(pipeline.legs);
  return <ol className="space-y-4" data-pipeline-list>{columns.map(col => <li key={col.level}>
    <p className="mb-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground">{col.index + 1}. {col.label}{col.legs.length > 1 && <span className="font-normal normal-case tracking-normal"> · song song</span>}</p>
    <ul className="space-y-2">{col.legs.map(leg => <li key={leg.op}>
      <button type="button" data-tone={statusTone[leg.status]} data-leg={leg.op} aria-pressed={selected === leg.op} onClick={() => onSelect(leg)}
        className={`flex w-full min-w-0 items-center gap-3 rounded-lg border bg-[var(--tone-bg)] px-3 py-2.5 text-left ${dashed(leg.status) ? 'border-dashed' : ''} ${leg.current ? 'ring-2 ring-[var(--status-running)]' : ''} ${selected === leg.op ? 'border-primary' : 'border-[var(--tone-line)]'}`}>
        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{leg.op}</span>
          <span className="block truncate text-xs text-muted-foreground">{legSummary(leg)}</span></span>
        {leg.attempts.length > 0 && <span className="flex shrink-0 gap-1" aria-hidden="true">{leg.attempts.slice(-6).map(attempt => <span key={attempt.id} className="status-dot" data-tone={statusTone[attempt.status]} />)}</span>}
        <StatusChip status={leg.status} />
      </button>
    </li>)}</ul>
  </li>)}</ol>;
}
