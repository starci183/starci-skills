import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownToLine, Check, ChevronDown, ChevronLeft, ChevronRight, Copy, Search, X } from 'lucide-react';
import { useApiQuery } from '../../api/query';
import type { Transcript } from '../../contract';
import { formatAbsolute } from '../../i18n/vi';
import { ConceptBlock, type Concept } from '../concept';
import { stripAnsi } from '../logs/kinds';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

export const concept: Concept = 'C7';
type Snapshot = { id: number; at: number; lines: number; bytes: number };
const PAGE = 300;

export function TranscriptViewer({ project, attemptId, live }: { project: string; attemptId: string; live: boolean }) {
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
  const transcript = useApiQuery<Transcript>(`${base}?${params}`, { topics: [`attempt:${project}:${attemptId}`], intervalMs: following ? 15_000 : 60_000 });
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
      <form className="flex min-w-0 flex-1 items-center gap-2" onSubmit={event => { event.preventDefault(); runSearch(draft); }}>
        <div className="relative min-w-[10rem] flex-1"><Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" /><Input value={draft} onChange={event => setDraft(event.target.value)} placeholder="Tìm văn bản hoặc /regex/" className="pl-8" aria-label="Tìm trong transcript" /></div>
        <Button type="submit" variant="outline">Tìm</Button>
        {search && <Button type="button" variant="ghost" size="icon" aria-label="Xóa tìm kiếm" onClick={() => { setDraft(''); runSearch(''); }}><X className="size-4" /></Button>}
      </form>
      <form className="flex items-center gap-1.5" onSubmit={event => { event.preventDefault(); goToLine(); }}>
        <Input inputMode="numeric" value={jump} onChange={event => setJump(event.target.value.replace(/\D/g, ''))} placeholder="Dòng…" className="w-20" aria-label="Nhảy tới dòng" /><Button type="submit" variant="outline" disabled={!jump}>Đi</Button>
      </form>
      <Button type="button" variant="outline" onClick={copy} disabled={!lines.length}>{copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? 'Đã chép' : 'Chép'}</Button>
      {data?.blob && <Button asChild variant="outline"><a href={data.blob.href} download={`attempt-${attemptId}.txt`}><ArrowDownToLine className="size-4" /> Tải .txt</a></Button>}
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
      <span className="flex flex-wrap items-center gap-2">
        {following && <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-medium" data-tone="running" style={{ color: 'var(--tone)', background: 'var(--tone-bg)', borderColor: 'var(--tone-line)' }}><span className="status-dot" data-tone="running" aria-hidden="true" /> Trực tiếp</span>}
        <span>{data ? `${total.toLocaleString('vi-VN')} dòng · ${data.final ? 'bản cuối' : 'snapshot'} · ${formatAbsolute(data.at)}` : 'Chưa có transcript'}</span>
        {data && <span>· đã che dữ liệu nhạy cảm, bỏ mã màu ANSI</span>}
      </span>
      <div className="flex items-center gap-2"><label htmlFor={`snapshot-${attemptId}`}>Thời điểm</label><select id={`snapshot-${attemptId}`} value={snapshot} onChange={event => { setSnapshot(event.target.value); setFrom(1); setTarget(null); }} className="max-w-44 rounded-md border bg-background px-2 py-1 text-foreground"><option value="">{live ? 'Theo dõi trực tiếp' : 'Bản cuối'}</option>{snapshots.data?.map(item => <option key={item.id} value={item.id}>{formatAbsolute(item.at)} · {item.lines} dòng</option>)}</select></div>
    </div>
    {search && <div className="flex items-center gap-2 text-xs"><span aria-live="polite">{hits.length ? `${hitIndex + 1}/${data?.hitCount ?? hits.length} kết quả` : 'Không có kết quả'}</span><Button type="button" size="icon-xs" variant="outline" disabled={!hits.length} aria-label="Kết quả trước" onClick={() => setHitIndex(index => (index - 1 + hits.length) % hits.length)}><ChevronLeft className="size-3" /></Button><Button type="button" size="icon-xs" variant="outline" disabled={!hits.length} aria-label="Kết quả sau" onClick={() => setHitIndex(index => (index + 1) % hits.length)}><ChevronRight className="size-3" /></Button>{activeHit && <span className="truncate text-muted-foreground">dòng {activeHit.n}</span>}</div>}
    {transcript.error && <p role="status" className="rounded-lg border p-3 text-sm text-muted-foreground">{transcript.error}</p>}
    {data && <div className="max-h-[32rem] min-w-0 overflow-auto rounded-lg border bg-muted/20 font-mono text-xs" role="log" aria-label="Transcript đã che dữ liệu nhạy cảm">
      {lines.map((line, index) => {
        const gap = search && index > 0 && line.n !== lines[index - 1].n + 1;
        const active = line.n === focusLine;
        return <div key={line.n}>
          {gap && <div className="select-none border-b border-border/30 bg-muted/40 px-2 py-0.5 text-center text-[10px] text-muted-foreground">⋯ {(line.n - lines[index - 1].n - 1).toLocaleString('vi-VN')} dòng ẩn ⋯</div>}
          <div ref={active ? activeRef : undefined} id={`L${line.n}`} className={`flex min-w-max border-b border-border/30 px-2 py-0.5 leading-5 ${active ? 'bg-[color:var(--status-warning)]/25' : line.hit ? 'bg-[color:var(--status-warning)]/10' : ''}`}>
            <span className="mr-3 w-12 shrink-0 select-none text-right tabular-nums text-muted-foreground">{line.n}</span><span className="whitespace-pre">{line.text || ' '}</span>
          </div>
        </div>;
      })}
    </div>}
    {data && !search && <div className="flex flex-wrap justify-between gap-2"><Button variant="outline" size="sm" disabled={from <= 1} onClick={() => { setTarget(null); setFrom(Math.max(1, from - PAGE)); }}>{PAGE} dòng trước</Button>
      <Button variant="outline" size="sm" onClick={tail}><ChevronDown className="size-4" /> Xuống cuối</Button>
      <Button variant="outline" size="sm" disabled={from + PAGE > total} onClick={() => { setTarget(null); setFrom(from + PAGE); }}>{PAGE} dòng sau</Button></div>}
  </ConceptBlock>;
}
