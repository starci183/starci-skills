import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownToLine, Check, ChevronDown, ChevronLeft, ChevronRight, Copy, Search, X } from 'lucide-react';
import { useApiQuery } from '../../api/query';
import type { Transcript } from '../../contract';
import { ReadWarning } from './frame/read-warning';
import { formatAbsolute } from '../../i18n/vi';
import { t } from '../../i18n/t';
import { ConceptBlock, type Concept } from '../concept';
import { stripAnsi } from '../logs/kinds';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { InputGroup, InputGroupAddon, InputGroupInput } from '../ui/input-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { FeedbackState } from '../feedback-state';

export const concept: Concept = 'C7';
type Snapshot = { id: number; at: number; lines: number; bytes: number };
const PAGE = 300;

export function TranscriptViewer({ project, attemptId, live }: { readonly project: string; readonly attemptId: string; readonly live: boolean }) {
  const base = `/api/attempts/${encodeURIComponent(project)}/${encodeURIComponent(attemptId)}/transcript`;
  const snapshots = useApiQuery<Snapshot[]>(`${base}/snapshots`, { topics: [`attempt:${project}:${attemptId}`], intervalMs: 60_000 });
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [snapshot, setSnapshot] = useState('');
  const [from, setFrom] = useState(1);
  const [hitIndex, setHitIndex] = useState(0);
  const [jump, setJump] = useState('');
  const [target, setTarget] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const activeRef = useRef<HTMLDivElement | null>(null);
  const params = new URLSearchParams();
  if (search) { params.set('q', search); params.set('around', '3'); }
  else { params.set('from', String(from)); params.set('to', String(from + PAGE - 1)); }
  if (snapshot) params.set('snapshot', snapshot);
  const following = live && !snapshot;
  const transcriptUrl = `${base}?${params}`;
  const transcript = useApiQuery<Transcript>(transcriptUrl, { topics: [`attempt:${project}:${attemptId}`], intervalMs: following ? 15_000 : 60_000 });
  const data = transcript.data;
  const hits = data?.hits ?? [];
  const activeHit = hits[hitIndex] ?? null;
  const focusLine = search ? activeHit?.n ?? null : target;
  useEffect(() => { setHitIndex(0); }, [search, snapshot]);
  useEffect(() => { activeRef.current?.scrollIntoView({ block: 'center' }); }, [focusLine, search, from]);

  const lines = useMemo(() => (data?.lines ?? []).map(line => ({ ...line, text: stripAnsi(line.text) })), [data]);
  const total = data?.totalLines ?? 0;
  const runSearch = (value: string) => { setSearch(value.trim()); setTarget(null); setFrom(1); };
  const goToLine = () => {
    const n = Math.round(Number(jump));
    if (!Number.isFinite(n) || n < 1) return;
    const line = Math.min(n, Math.max(1, total));
    setSearch(''); setDraft(''); setTarget(line);
    setFrom(Math.max(1, line - Math.floor(PAGE / 2)));
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(lines.map(line => line.text).join('\n')); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard may be blocked */ }
  };
  const tail = () => { setSearch(''); setDraft(''); setTarget(total || null); setFrom(Math.max(1, total - PAGE + 1)); };

  return <ConceptBlock concept="C7" className="min-w-0 space-y-3">
    <div className="flex flex-wrap items-center gap-2">
      <form className="flex w-full min-w-0 flex-none items-center gap-2 min-[760px]:w-auto min-[760px]:flex-1" onSubmit={event => { event.preventDefault(); runSearch(draft); }}>
        <InputGroup className="h-8 min-w-0 flex-1"><InputGroupInput value={draft} onChange={event => setDraft(event.target.value)} placeholder={t('Find text or /regex/')} aria-label={t('Search the transcript')} /><InputGroupAddon><Search className="size-4" aria-hidden="true" /></InputGroupAddon></InputGroup>
        <Button type="submit" variant="outline">{t('Search')}</Button>
        {search && <Button type="button" variant="ghost" size="icon" aria-label={t('Clear search')} onClick={() => { setDraft(''); runSearch(''); }}><X className="size-4" /></Button>}
      </form>
      <form className="flex shrink-0 items-center gap-1.5" onSubmit={event => { event.preventDefault(); goToLine(); }}>
        <Input inputMode="numeric" value={jump} onChange={event => setJump(event.target.value.replace(/\D/g, ''))} placeholder={t('Line…')} className="w-20" aria-label={t('Jump to line')} /><Button type="submit" variant="outline" disabled={!jump}>{t('Go')}</Button>
      </form>
      <Button type="button" variant="outline" onClick={copy} disabled={!lines.length}>{copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? t('Copied') : t('Copy')}</Button>
      {data?.blob && <Button variant="outline" onClick={() => { const link = document.createElement('a'); link.href = data.blob!.href; link.download = `attempt-${attemptId}.txt`; link.click(); }}><ArrowDownToLine className="size-4" /> {t('Download .txt')}</Button>}
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
      <span className="flex flex-wrap items-center gap-2">
        {following && data && !transcript.error && !transcript.meta?.stale?.length && <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-medium" data-tone="running" style={{ color: 'var(--tone)', background: 'var(--tone-bg)', borderColor: 'var(--tone-line)' }}><span className="status-dot" data-tone="running" aria-hidden="true" /> {t('Live')}</span>}
        <span>{data ? t('{lines} lines · {kind}', { lines: total.toLocaleString('vi-VN'), kind: data.final ? t('final copy') : 'snapshot' }) : transcript.error ? t('Transcript unavailable') : t('Reading transcript…')}</span>
        {data ? <span>· {data.timeSource === 'blob' ? t('Blob storage time') : data.timeSource === 'snapshot' ? t('Snapshot capture time') : t('Source time not recorded')}: {formatAbsolute(data.at)}</span> : null}
        {data && <span>· {t('sensitive data redacted, ANSI colour codes stripped')}</span>}
      </span>
      <div className="flex min-w-0 items-center gap-2"><label htmlFor={`snapshot-${attemptId}`}>{t('At time')}</label><Select value={snapshot || 'latest'} onValueChange={value => { setSnapshot(value === 'latest' ? '' : value); setFrom(1); setTarget(null); }}><SelectTrigger id={`snapshot-${attemptId}`} size="sm" className="max-w-44"><SelectValue /></SelectTrigger><SelectContent position="popper"><SelectItem value="latest">{live ? t('Follow live') : t('Final copy')}</SelectItem>{snapshots.data?.map(item => <SelectItem key={item.id} value={String(item.id)}>{formatAbsolute(item.at)} · {t('{n} lines', { n: item.lines })}</SelectItem>)}</SelectContent></Select></div>
    </div>
    {search && <div className="flex items-center gap-2 text-xs"><span aria-live="polite">{hits.length ? t('{at}/{total} results', { at: hitIndex + 1, total: data?.hitCount ?? hits.length }) : data ? t('No results') : transcript.error ? t('Transcript unavailable') : t('Searching…')}</span><Button type="button" size="icon-xs" variant="outline" disabled={!hits.length} aria-label={t('Previous result')} onClick={() => setHitIndex(index => (index - 1 + hits.length) % hits.length)}><ChevronLeft className="size-3" /></Button><Button type="button" size="icon-xs" variant="outline" disabled={!hits.length} aria-label={t('Next result')} onClick={() => setHitIndex(index => (index + 1) % hits.length)}><ChevronRight className="size-3" /></Button>{activeHit && <span className="truncate text-muted-foreground">{t('line {n}', { n: activeHit.n })}</span>}</div>}
    <ReadWarning read={transcript} url={transcriptUrl} retained={Boolean(data)} />
    <ReadWarning read={snapshots} url={`${base}/snapshots`} retained={Boolean(snapshots.data)} />
    {!data && !transcript.error ? <FeedbackState>{t('Reading transcript…')}</FeedbackState> : null}
    {data && <div className="max-h-[32rem] min-w-0 overflow-auto rounded-lg border bg-muted/20 font-mono text-xs" role="log" aria-label={t('Transcript with sensitive data redacted')}>
      {lines.map((line, index) => {
        const gap = search && index > 0 && line.n !== lines[index - 1].n + 1;
        const active = line.n === focusLine;
        return <div key={line.n}>
          {gap && <div className="select-none border-b border-border/30 bg-muted/40 px-2 py-0.5 text-center text-[10px] text-muted-foreground">⋯ {t('{n} hidden lines', { n: (line.n - lines[index - 1].n - 1).toLocaleString('vi-VN') })} ⋯</div>}
          <div ref={active ? activeRef : undefined} id={`L${line.n}`} className={`flex min-w-max border-b border-border/30 px-2 py-0.5 leading-5 ${active ? 'bg-[color:var(--status-warning)]/25' : line.hit ? 'bg-[color:var(--status-warning)]/10' : ''}`}>
            <span className="mr-3 w-12 shrink-0 select-none text-right tabular-nums text-muted-foreground">{line.n}</span><span className="whitespace-pre">{line.text || ' '}</span>
          </div>
        </div>;
      })}
    </div>}
    {data && !search && <div className="flex flex-wrap justify-between gap-2"><Button variant="outline" size="sm" disabled={from <= 1} onClick={() => { setTarget(null); setFrom(Math.max(1, from - PAGE)); }}>{t('{n} lines back', { n: PAGE })}</Button>
      <Button variant="outline" size="sm" onClick={tail}><ChevronDown className="size-4" /> {t('Jump to end')}</Button>
      <Button variant="outline" size="sm" disabled={from + PAGE > total} onClick={() => { setTarget(null); setFrom(from + PAGE); }}>{t('{n} lines forward', { n: PAGE })}</Button></div>}
  </ConceptBlock>;
}
