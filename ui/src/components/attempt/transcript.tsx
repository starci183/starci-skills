import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { ArrowDownToLine, Check, ChevronDown, ChevronLeft, ChevronRight, Copy, Search, X } from 'lucide-react';
import { useApiQuery } from '../../api/query';
import type { BlobLink, Transcript } from '../../contract';
import { ReadWarning } from './frame/read-warning';
import { formatAbsolute } from '../../i18n/vi';
import { t } from '../../i18n/t';
import { ConceptBlock, type Concept } from '../concept';
import { stripAnsi } from '../logs/kinds';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { InputGroup, InputGroupAddon, InputGroupInput } from '../ui/input-group';
import { Select, ListBox } from '../ui/select';
import { FeedbackState } from '../feedback-state';
import { StatusChip } from '../status-chip';

export const concept: Concept = 'C7';
type Snapshot = { id: number; at: number; lines: number; bytes: number };
type Line = Transcript['lines'][number];
type TranscriptQuery = ReturnType<typeof useApiQuery<Transcript>>;
type SnapshotsQuery = ReturnType<typeof useApiQuery<Snapshot[]>>;
const PAGE = 300;

function CopyLines({ lines }: Readonly<{ lines: readonly Line[] }>) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(lines.map(line => line.text).join('\n')); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard may be blocked */ }
  };
  return <Button type="button" variant="outline" onClick={() => { void copy(); }} disabled={!lines.length}>{copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? t('Copied') : t('Copy')}</Button>;
}

function DownloadButton({ blob, attemptId }: Readonly<{ blob: BlobLink | null | undefined; attemptId: string }>) {
  if (!blob) return null;
  return <Button variant="outline" onClick={() => { const link = document.createElement('a'); link.href = blob.href; link.download = `attempt-${attemptId}.txt`; link.click(); }}><ArrowDownToLine className="size-4" /> {t('Download .txt')}</Button>;
}

function SearchForm({ draft, onDraft, search, onSearch }: Readonly<{ draft: string; onDraft: (value: string) => void; search: string; onSearch: (value: string) => void }>) {
  return <form className="flex w-full min-w-0 flex-none items-center gap-2 min-[760px]:w-auto min-[760px]:flex-1" onSubmit={event => { event.preventDefault(); onSearch(draft); }}>
    <InputGroup className="h-8 min-w-0 flex-1"><InputGroupInput value={draft} onChange={event => onDraft(event.target.value)} placeholder={t('Find text or /regex/')} aria-label={t('Search the transcript')} /><InputGroupAddon><Search className="size-4" aria-hidden="true" /></InputGroupAddon></InputGroup>
    <Button type="submit" variant="outline">{t('Search')}</Button>
    {search && <Button type="button" variant="ghost" size="icon" aria-label={t('Clear search')} onClick={() => { onDraft(''); onSearch(''); }}><X className="size-4" /></Button>}
  </form>;
}

function JumpForm({ jump, onJump, onGo }: Readonly<{ jump: string; onJump: (value: string) => void; onGo: () => void }>) {
  return <form className="flex shrink-0 items-center gap-1.5" onSubmit={event => { event.preventDefault(); onGo(); }}>
    <Input inputMode="numeric" value={jump} onChange={event => onJump(event.target.value.replace(/\D/g, ''))} placeholder={t('Line…')} className="w-20" aria-label={t('Jump to line')} /><Button type="submit" variant="outline" disabled={!jump}>{t('Go')}</Button>
  </form>;
}

function timeSourceLabel(source: Transcript['timeSource']): string {
  if (source === 'blob') return t('Blob storage time');
  if (source === 'snapshot') return t('Snapshot capture time');
  return t('Source time not recorded');
}

function linesSummary(data: Transcript | null, transcript: TranscriptQuery, total: number): string {
  if (data) return t('{lines} lines · {kind}', { lines: total.toLocaleString('vi-VN'), kind: data.final ? t('final copy') : 'snapshot' });
  return transcript.error ? t('Transcript unavailable') : t('Reading transcript…');
}

function StatusLine({ data, transcript, following, total }: Readonly<{ data: Transcript | null; transcript: TranscriptQuery; following: boolean; total: number }>) {
  const live = following && data && !transcript.error && !transcript.meta?.stale?.length;
  return <span className="flex flex-wrap items-center gap-2">
    {live && <StatusChip status="running" label={t('Live')} />}
    <span>{linesSummary(data, transcript, total)}</span>
    {data ? <span>· {timeSourceLabel(data.timeSource)}: {formatAbsolute(data.at)}</span> : null}
    {data && <span>· {t('sensitive data redacted, ANSI colour codes stripped')}</span>}
  </span>;
}

function SnapshotPicker({ attemptId, snapshot, live, snapshots, onChange }: Readonly<{ attemptId: string; snapshot: string; live: boolean; snapshots: SnapshotsQuery; onChange: (value: string) => void }>) {
  const latest = live ? t('Follow live') : t('Latest recorded copy');
  return <div className="flex min-w-0 items-center gap-2"><span>{t('At time')}</span><Select aria-label={t('At time')} value={snapshot || 'latest'} onChange={key => {
    if (key == null) return;
    const value = String(key);
    onChange(value === 'latest' ? '' : value);
  }} className="min-w-0 max-w-44"><Select.Trigger id={`snapshot-${attemptId}`} className="h-8"><Select.Value /><Select.Indicator /></Select.Trigger><Select.Popover><ListBox><ListBox.Item id="latest" textValue={latest}>{latest}<ListBox.ItemIndicator /></ListBox.Item>{snapshots.data?.map(item => <ListBox.Item key={item.id} id={String(item.id)} textValue={`${formatAbsolute(item.at)} · ${t('{n} lines', { n: item.lines })}`}>{formatAbsolute(item.at)} · {t('{n} lines', { n: item.lines })}<ListBox.ItemIndicator /></ListBox.Item>)}</ListBox></Select.Popover></Select></div>;
}

function hitsSummary(hits: readonly { n: number }[], hitIndex: number, data: Transcript | null, transcript: TranscriptQuery): string {
  if (hits.length) return t('{at}/{total} results', { at: hitIndex + 1, total: data?.hitCount ?? hits.length });
  if (data) return t('No results');
  return transcript.error ? t('Transcript unavailable') : t('Searching…');
}

function HitNavigator({ hits, hitIndex, onHit, data, transcript }: Readonly<{ hits: readonly { n: number }[]; hitIndex: number; onHit: (index: number) => void; data: Transcript | null; transcript: TranscriptQuery }>) {
  const activeHit = hits[hitIndex] ?? null;
  return <div className="flex items-center gap-2 text-xs"><span aria-live="polite">{hitsSummary(hits, hitIndex, data, transcript)}</span><Button type="button" size="icon-xs" variant="outline" disabled={!hits.length} aria-label={t('Previous result')} onClick={() => onHit((hitIndex - 1 + hits.length) % hits.length)}><ChevronLeft className="size-3" /></Button><Button type="button" size="icon-xs" variant="outline" disabled={!hits.length} aria-label={t('Next result')} onClick={() => onHit((hitIndex + 1) % hits.length)}><ChevronRight className="size-3" /></Button>{activeHit && <span className="truncate text-muted-foreground">{t('line {n}', { n: activeHit.n })}</span>}</div>;
}

function lineTone(active: boolean, hit: boolean | undefined): string {
  if (active) return 'bg-[color:var(--status-warning)]/25';
  return hit ? 'bg-[color:var(--status-warning)]/10' : '';
}

function LineList({ lines, search, focusLine, activeRef }: Readonly<{ lines: readonly Line[]; search: string; focusLine: number | null; activeRef: RefObject<HTMLDivElement | null> }>) {
  return <div className="max-h-[32rem] min-w-0 overflow-auto rounded-lg border bg-default font-mono text-xs" role="log" aria-label={t('Transcript with sensitive data redacted')}>
    {lines.map((line, index) => {
      const previous = index > 0 ? lines[index - 1] : undefined;
      const gap = Boolean(search) && previous != null && line.n !== previous.n + 1;
      const active = line.n === focusLine;
      return <div key={line.n}>
        {gap && previous && <div className="select-none border-b border-border/30 bg-default px-2 py-0.5 text-center text-[10px] text-muted-foreground">⋯ {t('{n} hidden lines', { n: (line.n - previous.n - 1).toLocaleString('vi-VN') })} ⋯</div>}
        <div ref={active ? activeRef : undefined} id={`L${line.n}`} className={`flex min-w-max border-b border-border/30 px-2 py-0.5 leading-5 ${lineTone(active, line.hit)}`}>
          <span className="mr-3 w-12 shrink-0 select-none text-right tabular-nums text-muted-foreground">{line.n}</span><span className="whitespace-pre">{line.text || ' '}</span>
        </div>
      </div>;
    })}
  </div>;
}

function Pager({ from, total, onFrom, onTail }: Readonly<{ from: number; total: number; onFrom: (from: number) => void; onTail: () => void }>) {
  return <div className="flex flex-wrap justify-between gap-2"><Button variant="outline" size="sm" disabled={from <= 1} onClick={() => onFrom(Math.max(1, from - PAGE))}>{t('{n} lines back', { n: PAGE })}</Button>
    <Button variant="outline" size="sm" onClick={onTail}><ChevronDown className="size-4" /> {t('Jump to end')}</Button>
    <Button variant="outline" size="sm" disabled={from + PAGE > total} onClick={() => onFrom(from + PAGE)}>{t('{n} lines forward', { n: PAGE })}</Button></div>;
}

function transcriptParams(search: string, from: number, snapshot: string): URLSearchParams {
  const params = new URLSearchParams();
  if (search) { params.set('q', search); params.set('around', '3'); }
  else { params.set('from', String(from)); params.set('to', String(from + PAGE - 1)); }
  if (snapshot) params.set('snapshot', snapshot);
  return params;
}

export function TranscriptViewer({ project, attemptId, live }: { readonly project: string; readonly attemptId: string; readonly live: boolean }) {
  const base = `/api/attempts/${encodeURIComponent(project)}/${encodeURIComponent(attemptId)}/transcript`;
  const snapshots = useApiQuery<Snapshot[]>(`${base}/snapshots`, { topics: [`attempt:${project}:${attemptId}`], intervalMs: 60_000 });
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [snapshot, setSnapshot] = useState('');
  const [from, setFrom] = useState(1);
  const [hitState, setHitState] = useState({ scope: '', index: 0 });
  const [jump, setJump] = useState('');
  const [target, setTarget] = useState<number | null>(null);
  const activeRef = useRef<HTMLDivElement | null>(null);
  const following = live && !snapshot;
  const transcriptUrl = `${base}?${transcriptParams(search, from, snapshot)}`;
  const transcript = useApiQuery<Transcript>(transcriptUrl, { topics: [`attempt:${project}:${attemptId}`], intervalMs: following ? 15_000 : 60_000 });
  const data = transcript.data;
  const hits = data?.hits ?? [];
  // The selected hit belongs to one (search, snapshot) pair and falls back to the first hit when either changes.
  const hitScope = `${search}\u0000${snapshot}`;
  const hitIndex = hitState.scope === hitScope ? hitState.index : 0;
  const focusLine = search ? hits[hitIndex]?.n ?? null : target;
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
  const tail = () => { setSearch(''); setDraft(''); setTarget(total || null); setFrom(Math.max(1, total - PAGE + 1)); };
  const pageTo = (next: number) => { setTarget(null); setFrom(next); };

  return <ConceptBlock concept="C7" className="min-w-0 space-y-3">
    <div className="flex flex-wrap items-center gap-2">
      <SearchForm draft={draft} onDraft={setDraft} search={search} onSearch={runSearch} />
      <JumpForm jump={jump} onJump={setJump} onGo={goToLine} />
      <CopyLines lines={lines} />
      <DownloadButton blob={data?.blob} attemptId={attemptId} />
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
      <StatusLine data={data} transcript={transcript} following={following} total={total} />
      <SnapshotPicker attemptId={attemptId} snapshot={snapshot} live={live} snapshots={snapshots} onChange={value => { setSnapshot(value); setFrom(1); setTarget(null); }} />
    </div>
    {transcript.observedAt != null ? <p className="m-0 text-xs text-muted-foreground">{t('Last successful API read at {at}', { at: formatAbsolute(transcript.observedAt) })}</p> : null}
    {search && <HitNavigator hits={hits} hitIndex={hitIndex} onHit={index => setHitState({ scope: hitScope, index })} data={data} transcript={transcript} />}
    <ReadWarning read={transcript} url={transcriptUrl} retained={Boolean(data)} />
    <ReadWarning read={snapshots} url={`${base}/snapshots`} retained={Boolean(snapshots.data)} />
    {!data && !transcript.error ? <FeedbackState>{t('Reading transcript…')}</FeedbackState> : null}
    {data && <LineList lines={lines} search={search} focusLine={focusLine} activeRef={activeRef} />}
    {data && !search && <Pager from={from} total={total} onFrom={pageTo} onTail={tail} />}
  </ConceptBlock>;
}
