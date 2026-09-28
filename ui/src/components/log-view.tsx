import { ChevronRight, Link2 } from 'lucide-react';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';
import { ConceptBlock, type Concept } from './concept';
import { StateChip } from './state-chip';
import { formatAbsolute } from '../i18n/vi';
import type { LogRow, TimelineItem, UiState } from '../contract';

export const concept: Concept = 'C17';

const levelState: Record<LogRow['level'], UiState> = { debug: 'unknown', info: 'ok', warn: 'warn', error: 'bad' };

function RefLinks({ refs }: { refs: LogRow['refs'] }) {
  if (!refs.length) return <span className="text-muted-foreground">Chưa có liên kết.</span>;
  return <div className="flex flex-wrap gap-2">{refs.map((ref) => <a key={`${ref.kind}:${ref.project ?? ''}:${ref.id}`} href={ref.href} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-primary hover:bg-muted"><Link2 size={12} aria-hidden="true" />{ref.kind} · {ref.id}</a>)}</div>;
}

export function LogView({ rows, empty = 'Không có dòng nhật ký phù hợp.' }: { rows: LogRow[]; empty?: string }) {
  if (!rows.length) return <div className="empty-state" role="status">{empty}</div>;
  return <ConceptBlock concept="C17" className="space-y-2" aria-label="Dòng nhật ký">
    {rows.map((row) => <Card key={row.key} size="sm"><details className="group"><summary className="flex cursor-pointer list-none items-start gap-3 px-3 py-2.5 [&::-webkit-details-marker]:hidden">
      <ChevronRight className="mt-1 size-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" aria-hidden="true" />
      <time className="w-20 shrink-0 text-xs tabular-nums text-muted-foreground sm:w-36" dateTime={new Date(row.at).toISOString()} title={formatAbsolute(row.at)}>{new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(row.at)}<span className="hidden sm:inline"> · {new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Bangkok', day: '2-digit', month: '2-digit' }).format(row.at)}</span></time>
      <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><StateChip state={levelState[row.level]} label={row.level} compact /><strong className="text-xs font-medium">{row.actor}</strong>{row.controller && <Badge variant="outline" className="text-[10px]">{row.controller}</Badge>}{row.db !== 'machine' && <span className="text-[11px] text-muted-foreground">{row.db}</span>}</span><span className="mt-1 block break-words text-sm leading-5">{row.msg}</span></span>
    </summary><CardContent className="space-y-3 border-t pt-3 text-xs"><dl className="grid gap-2 sm:grid-cols-2"><div><dt className="text-muted-foreground">Loại</dt><dd>{row.kind}</dd></div><div><dt className="text-muted-foreground">Nguồn</dt><dd>{row.db === 'machine' ? 'Máy' : `Dự án ${row.db}`}</dd></div><div><dt className="text-muted-foreground">Workflow</dt><dd>{row.wf ?? '—'}</dd></div><div><dt className="text-muted-foreground">Job</dt><dd>{row.job ?? '—'}</dd></div></dl>
      <div><h3 className="mb-2 font-medium">Tham chiếu</h3><RefLinks refs={row.refs} /></div>
      {row.data != null && <div><h3 className="mb-2 font-medium">Dữ liệu</h3><pre className="blob-text">{JSON.stringify(row.data, null, 2)}</pre></div>}
    </CardContent></details></Card>)}
  </ConceptBlock>;
}

export function TimelineView({ rows, empty = 'Chưa có diễn biến phù hợp.' }: { rows: TimelineItem[]; empty?: string }) {
  if (!rows.length) return <div className="empty-state" role="status">{empty}</div>;
  return <ConceptBlock concept="C17" className="space-y-2" aria-label="Diễn biến">
    {rows.map((row, index) => <Card key={`${row.at}:${row.kind}:${index}`} size="sm"><CardContent className="flex items-start gap-3"><StateChip state={row.ui} compact /><div className="min-w-0 flex-1"><div className="text-sm font-medium">{row.title}</div><div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground"><span>{formatAbsolute(row.at)}</span><span>· {row.source}</span><span>· {row.kind}</span></div></div>{row.ref && <a href={row.ref.href} className="shrink-0 text-xs text-primary hover:underline">{row.ref.id}</a>}</CardContent></Card>)}
  </ConceptBlock>;
}
