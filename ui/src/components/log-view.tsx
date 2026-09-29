import type { Ref } from 'react';
import { ChevronRight, Link2 } from 'lucide-react';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';
import { ConceptBlock, type Concept } from './concept';
import { StateChip } from './state-chip';
import { JsonTree } from './logs/json-tree';
import { kindIcon, levelLabels, levelTone } from './logs/kinds';
import { formatAbsolute } from '../i18n/vi';
import type { LogRow, TimelineItem } from '../contract';
import { AgentAvatar } from './agent/agent-avatar';
import { attemptAgent, useAttemptAgents } from './agent/use-running-agents';

export const concept: Concept = 'C17';

const timeFormat = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
const shortWf = (wf: string) => wf.replace(/^wf-/, '');

function RefLinks({ refs }: { refs: LogRow['refs'] }) {
  if (!refs.length) return <span className="text-muted-foreground">Chưa có liên kết.</span>;
  return <div className="flex flex-wrap gap-2">{refs.map((ref) => <a key={`${ref.kind}:${ref.project ?? ''}:${ref.id}`} href={ref.href} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-primary hover:bg-muted"><Link2 size={12} aria-hidden="true" />{ref.kind} · {ref.id}</a>)}</div>;
}

const linkClass = 'text-primary hover:underline';

export function LogRowItem({ row, fresh = false }: { row: LogRow; fresh?: boolean }) {
  const tone = levelTone[row.level];
  const Icon = kindIcon(row.kind);
  const wfRef = row.refs.find((ref) => ref.kind === 'workflow');
  const attemptRef = row.refs.find((ref) => ref.kind === 'attempt');
  const { rows: attempts, forJob } = useAttemptAgents();
  const linked = row.actor === 'op' ? (attemptRef ? attempts.find((item) => String(item.id) === attemptRef.id && item.project === (attemptRef.project ?? row.project)) : forJob(row.project, row.job)) : undefined;
  return <details className={`group border-b border-l-[3px] border-b-border/60 border-l-transparent last:border-b-0 data-[tone]:border-l-[color:var(--tone)] ${row.level === 'error' ? 'bg-[color:var(--tone-bg)]' : ''} ${fresh ? 'log-row-new' : ''}`} data-tone={tone} data-level={row.level}>
    <summary className="grid cursor-pointer list-none grid-cols-[3.9rem_minmax(0,1fr)] items-center gap-x-2.5 gap-y-0.5 px-3 py-2 text-[12.5px] hover:bg-muted/40 md:grid-cols-[4.7rem_3.4rem_5.5rem_9.5rem_minmax(0,1fr)_10.5rem] md:gap-x-3 [&::-webkit-details-marker]:hidden">
      <time className="font-mono text-xs tabular-nums text-muted-foreground" dateTime={new Date(row.at).toISOString()} title={formatAbsolute(row.at)}>{timeFormat.format(row.at)}</time>
      <span className={`hidden text-[11px] font-semibold md:block ${tone ? 'text-[color:var(--tone)]' : 'text-muted-foreground'}`}>{levelLabels[row.level]}</span>
      <span className="hidden min-w-0 md:block"><span className="inline-flex max-w-full items-center gap-1">{linked ? <AgentAvatar agent={attemptAgent(linked)} size={18} /> : null}<Badge variant="outline" className="min-w-0 max-w-full truncate font-mono text-[10.5px]">{row.actor}</Badge></span></span>
      <span className="col-start-2 flex min-w-0 items-center gap-1.5 font-mono text-[11.5px] text-muted-foreground md:col-start-auto">
        <Icon className="size-3.5 shrink-0" aria-hidden="true" /><span className="truncate" title={row.kind}>{row.kind}</span>
        {tone && <span className="font-semibold text-[color:var(--tone)] md:hidden">· {levelLabels[row.level]}</span>}
        <ChevronRight className="ml-auto size-3.5 shrink-0 transition-transform group-open:rotate-90 md:hidden" aria-hidden="true" />
      </span>
      <span className="col-start-2 min-w-0 break-words leading-5 md:col-start-auto [overflow-wrap:anywhere]">{row.msg}</span>
      <span className="hidden min-w-0 truncate font-mono text-[11px] text-muted-foreground md:block" onClick={(event) => { if ((event.target as HTMLElement).closest('a')) event.stopPropagation(); }}>
        {wfRef ? <a href={wfRef.href} className={linkClass}>{shortWf(wfRef.id)}</a> : row.wf ? shortWf(row.wf) : row.db === 'machine' ? 'máy' : row.db}
        {attemptRef && <> · <a href={attemptRef.href} className={linkClass}>#{attemptRef.id}</a></>}
      </span>
    </summary>
    <div className="space-y-3 border-t bg-muted/20 px-3 py-3 text-xs md:pl-[5.4rem]">
      <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div><dt className="text-muted-foreground">Thời điểm</dt><dd>{formatAbsolute(row.at)}</dd></div>
        <div><dt className="text-muted-foreground">Mức · Actor</dt><dd>{levelLabels[row.level]} · {row.actor}{row.controller ? ` · ${row.controller}` : ''}</dd></div>
        <div><dt className="text-muted-foreground">Loại</dt><dd className="font-mono">{row.kind}</dd></div>
        <div><dt className="text-muted-foreground">Nguồn</dt><dd>{row.db === 'machine' ? 'Máy' : `Dự án ${row.db}`}</dd></div>
        <div><dt className="text-muted-foreground">Workflow</dt><dd className="break-all font-mono">{row.wf ?? '—'}</dd></div>
        <div><dt className="text-muted-foreground">Job</dt><dd className="break-all font-mono">{row.job ?? '—'}</dd></div>
        {row.traceId && <div><dt className="text-muted-foreground">Trace</dt><dd className="break-all font-mono">{row.traceId}</dd></div>}
        {row.spanId && <div><dt className="text-muted-foreground">Span</dt><dd className="break-all font-mono">{row.spanId}</dd></div>}
      </dl>
      <div><h3 className="mb-1.5 font-medium">Tham chiếu</h3><RefLinks refs={row.refs} /></div>
      {row.data != null && <div><h3 className="mb-1.5 font-medium">Dữ liệu</h3><JsonTree value={row.data} /></div>}
    </div>
  </details>;
}

export function LogView({ rows, empty = 'Không có dòng nhật ký phù hợp.', freshKeys, regionRef, onRegionScroll }: { rows: LogRow[]; empty?: string; freshKeys?: ReadonlySet<string>; regionRef?: Ref<HTMLDivElement>; onRegionScroll?: (top: number) => void }) {
  if (!rows.length) return <div className="empty-state" role="status">{empty}</div>;
  return <ConceptBlock concept="C17" aria-label="Dòng nhật ký">
    <style>{'@keyframes log-flash{from{background-color:color-mix(in oklab,var(--primary) 22%,transparent)}to{background-color:transparent}}.log-row-new{animation:log-flash 1.6s ease-out 1}@media (prefers-reduced-motion:reduce){.log-row-new{animation:none}}'}</style>
    <Card size="sm" className="overflow-hidden py-0"><div ref={regionRef} onScroll={(event) => onRegionScroll?.(event.currentTarget.scrollTop)} className="max-h-[calc(100dvh-260px)] min-h-64 overflow-y-auto overscroll-contain" data-log-region><div className="sticky top-0 z-10 hidden border-b bg-muted md:grid md:grid-cols-[4.7rem_3.4rem_5.5rem_9.5rem_minmax(0,1fr)_10.5rem] md:gap-x-3 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground " aria-hidden="true"><span>Giờ</span><span>Mức</span><span>Actor</span><span>Loại</span><span>Nội dung</span><span>Workflow · lần thử</span></div>
      {rows.map((row) => <LogRowItem key={row.key} row={row} fresh={freshKeys?.has(row.key)} />)}
    </div></Card>
  </ConceptBlock>;
}

export function TimelineView({ rows, empty = 'Chưa có diễn biến phù hợp.' }: { rows: TimelineItem[]; empty?: string }) {
  if (!rows.length) return <div className="empty-state" role="status">{empty}</div>;
  return <ConceptBlock concept="C17" className="space-y-2" aria-label="Diễn biến">
    {rows.map((row, index) => <Card key={`${row.at}:${row.kind}:${index}`} size="sm"><CardContent className="flex items-start gap-3"><StateChip state={row.ui} compact /><div className="min-w-0 flex-1"><div className="text-sm font-medium">{row.title}</div><div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground"><span>{formatAbsolute(row.at)}</span><span>· {row.source}</span><span>· {row.kind}</span></div></div>{row.ref && <a href={row.ref.href} className="shrink-0 text-xs text-primary hover:underline">{row.ref.id}</a>}</CardContent></Card>)}
  </ConceptBlock>;
}
