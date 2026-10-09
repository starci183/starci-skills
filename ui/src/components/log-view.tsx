import { useState, type Ref } from 'react';
import { Card, Link } from '@heroui/react';
import { Link2 } from 'lucide-react';
import { Advanced, Stagger, StaggerItem } from './motion';
import { Badge } from './ui/badge';
import { FeedbackState } from './feedback-state';
import { ConceptBlock, type Concept } from './concept';
import { StateChip } from './state-chip';
import { JsonTree } from './logs/json-tree';
import { kindIcon, levelLabels, levelTone } from './logs/kinds';
import { formatAbsolute } from '../i18n/vi';
import type { LogRow, TimelineItem } from '../contract';
import { AgentAvatar } from './agent/agent-avatar';
import { attemptAgent, useAttemptAgents } from './agent/use-running-agents';
import { t } from '../i18n/t';

export const concept: Concept = 'C17';

const timeFormat = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
const shortWf = (wf: string) => wf.replace(/^wf-/, '');

function RefLinks({ refs }: Readonly<{ refs: LogRow['refs'] }>) {
  if (!refs.length) return <span className="text-muted-foreground">{t('No links yet.')}</span>;
  return <div className="flex flex-wrap gap-3">{refs.map((ref) => <Link key={`${ref.kind}:${ref.project ?? ''}:${ref.id}`} href={ref.href} className="inline-flex items-center gap-1 text-xs"><Link2 size={12} aria-hidden="true" />{ref.kind} · {ref.id}</Link>)}</div>;
}

export function LogRowItem({ row, fresh = false }: Readonly<{ row: LogRow; fresh?: boolean }>) {
  const tone = levelTone[row.level];
  const Icon = kindIcon(row.kind);
  const wfRef = row.refs.find((ref) => ref.kind === 'workflow');
  const attemptRef = row.refs.find((ref) => ref.kind === 'attempt');
  const { forAttempt } = useAttemptAgents();
  const linked = row.actor === 'op' && attemptRef ? forAttempt(attemptRef.project ?? row.project, attemptRef.id) : undefined;
  return <div className={`log-row relative border-b border-b-border/60 last:border-b-0 ${row.level === 'error' ? 'bg-[color:var(--tone-bg)]' : ''} ${fresh ? 'log-row-new' : ''}`} data-tone={tone} data-level={row.level}>
    <Advanced keepMounted className="log-row-disclosure border-0 pt-0" title={<span className="grid w-full grid-cols-[4rem_minmax(0,1fr)] items-center gap-x-3 gap-y-1 text-[13px] md:grid-cols-[4.75rem_3.5rem_minmax(0,1fr)] md:gap-x-4">
      <time className="font-mono text-xs tabular-nums text-muted-foreground" dateTime={new Date(row.at).toISOString()} title={formatAbsolute(row.at)}>{timeFormat.format(row.at)}</time>
      <span className={`hidden text-[11px] font-semibold md:block ${tone ? 'text-[color:var(--tone)]' : 'text-muted-foreground'}`}>{levelLabels[row.level]}</span>
      <span className="col-start-2 flex min-w-0 items-start gap-2 md:col-start-auto">
        <span className="min-w-0 flex-1 break-words leading-5 [overflow-wrap:anywhere]">{row.msg}</span>
        {tone && <span className="shrink-0 text-[11px] font-semibold leading-5 text-[color:var(--tone)] md:hidden">{levelLabels[row.level]}</span>}
      </span>
    </span>}>
    <div className="flex flex-col gap-4 border-t bg-default px-4 py-4 text-xs md:pl-[6.5rem]">
      <div className="flex min-w-0 flex-wrap items-center gap-2 font-mono text-[11px] text-muted-foreground">
        {linked ? <AgentAvatar agent={attemptAgent(linked)} size={18} /> : null}
        <Badge variant="outline" className="min-w-0 max-w-full truncate font-mono text-[11px]">{row.actor}</Badge>
        <Icon className="size-3.5 shrink-0" aria-hidden="true" /><span className="min-w-0 truncate" title={row.kind}>{row.kind}</span>
      </div>
      <div><h3 className="mb-2 font-medium">{t('References')}</h3><RefLinks refs={row.refs} /></div>
      <Advanced summary={t('Source, workflow, job, trace and raw data')}>
        <div className="flex flex-col gap-3">
          {row.job && <p className="text-muted-foreground">{t('Job context can span several dispatches; only an exact Op attempt reference identifies the emitting agent.')}</p>}
          <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div><dt className="text-muted-foreground">{t('At')}</dt><dd>{formatAbsolute(row.at)}</dd></div>
            <div><dt className="text-muted-foreground">{t('Level · actor')}</dt><dd>{levelLabels[row.level]} · {row.actor}{row.controller ? ` · ${row.controller}` : ''}</dd></div>
            <div><dt className="text-muted-foreground">{t('Kind')}</dt><dd className="font-mono">{row.kind}</dd></div>
            <div><dt className="text-muted-foreground">{t('Source')}</dt><dd>{row.db === 'machine' ? t('Machine') : t('Project {db}', { db: row.db })}</dd></div>
            <div><dt className="text-muted-foreground">Workflow</dt><dd className="break-all font-mono">{row.wf ?? '—'}</dd></div>
            <div><dt className="text-muted-foreground">Job</dt><dd className="break-all font-mono">{row.job ?? '—'}</dd></div>
            {row.traceId && <div><dt className="text-muted-foreground">Trace</dt><dd className="break-all font-mono">{row.traceId}</dd></div>}
            {row.spanId && <div><dt className="text-muted-foreground">Span</dt><dd className="break-all font-mono">{row.spanId}</dd></div>}
          </dl>
          {row.data != null && <div><h3 className="mb-2 font-medium">{t('Data')}</h3><JsonTree value={row.data} /></div>}
        </div>
      </Advanced>
    </div>
    </Advanced>
    <div className="log-row-references min-w-0 truncate px-4 pb-2 font-mono text-[11px] text-muted-foreground md:absolute md:right-4 md:top-4 md:w-[10.5rem] md:px-0 md:pb-0">
      {wfRef ? <Link href={wfRef.href} className="text-[11px]">{shortWf(wfRef.id)}</Link> : row.wf ? shortWf(row.wf) : row.db === 'machine' ? t('machine') : row.db}
      {attemptRef && <> · <Link href={attemptRef.href} className="text-[11px]">#{attemptRef.id}</Link></>}
    </div>
  </div>;
}

export function LogView({ rows, empty = t('No matching log rows.'), freshKeys, regionRef, onRegionScroll }: Readonly<{ rows: LogRow[]; empty?: string; freshKeys?: ReadonlySet<string>; regionRef?: Ref<HTMLDivElement>; onRegionScroll?: (top: number) => void }>) {
  const [staggered] = useState(() => new Set(rows.slice(0, 12).map((row) => row.key)));
  if (!rows.length) return <FeedbackState>{empty}</FeedbackState>;
  return <ConceptBlock concept="C17" aria-label={t('Log rows')}>
    <Card className="overflow-hidden p-0"><Card.Content><div ref={regionRef} onScroll={(event) => onRegionScroll?.(event.currentTarget.scrollTop)} className="max-h-[calc(100dvh-260px)] min-h-64 overflow-y-auto overscroll-contain" data-log-region><div className="sticky top-0 z-10 hidden h-12 items-center border-b bg-default md:grid md:grid-cols-[4.75rem_3.5rem_minmax(0,1fr)_10.5rem] md:gap-x-4 px-4 text-xs font-semibold text-muted-foreground" aria-hidden="true"><span>{t('Time')}</span><span>{t('Level')}</span><span>{t('Content')}</span><span>{t('Workflow · attempt')}</span></div>
      <Stagger>{rows.map((row) => staggered.has(row.key) ? <StaggerItem key={row.key}><LogRowItem row={row} fresh={freshKeys?.has(row.key)} /></StaggerItem> : <LogRowItem key={row.key} row={row} fresh={freshKeys?.has(row.key)} />)}</Stagger>
    </div></Card.Content></Card>
  </ConceptBlock>;
}

export function TimelineView({ rows, empty = t('No matching timeline entries yet.') }: Readonly<{ rows: TimelineItem[]; empty?: string }>) {
  if (!rows.length) return <FeedbackState>{empty}</FeedbackState>;
  return <ConceptBlock concept="C17" className="flex flex-col gap-2" aria-label={t('Timeline')}>
    {rows.map((row, index) => <Card key={`${row.at}:${row.kind}:${index}`}><Card.Content className="flex flex-wrap items-start gap-4"><StateChip state={row.ui} compact /><div className="min-w-0 flex-1"><h3 className="text-sm font-medium">{row.title}</h3><div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground"><span>{formatAbsolute(row.at)}</span><span>· {row.source}</span><span>· {row.kind}</span></div></div>{row.ref && <Link href={row.ref.href} className="shrink-0 text-xs">{row.ref.id}</Link>}</Card.Content></Card>)}
  </ConceptBlock>;
}
