import { useEffect, useMemo, useState } from 'react';
import { ArrowDownToLine, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useApiQuery } from '../../api/query';
import type { Transcript } from '../../contract';
import { formatAbsolute } from '../../i18n/vi';
import { ConceptBlock, type Concept } from '../concept';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

export const concept: Concept = 'C7';
type Snapshot = { id: number; at: number; lines: number; bytes: number };

export function TranscriptViewer({ project, attemptId, live }: { project: string; attemptId: string; live: boolean }) {
  const base = `/api/attempts/${encodeURIComponent(project)}/${encodeURIComponent(attemptId)}/transcript`;
  const snapshots = useApiQuery<Snapshot[]>(`${base}/snapshots`, { topics: [`attempt:${project}:${attemptId}`], intervalMs: 60_000 });
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [snapshot, setSnapshot] = useState('');
  const [from, setFrom] = useState(1);
  const [hitIndex, setHitIndex] = useState(0);
  const params = new URLSearchParams();
  if (search) params.set('q', search);
  else { params.set('from', String(from)); params.set('to', String(from + 299)); }
  if (snapshot) params.set('snapshot', snapshot);
  const transcript = useApiQuery<Transcript>(`${base}?${params}`, { topics: [`attempt:${project}:${attemptId}`], intervalMs: live && !snapshot ? 15_000 : 60_000 });
  const data = transcript.data;
  const hits = data?.hits ?? [];
  const activeHit = hits[hitIndex] ?? null;
  const visibleLines = useMemo(() => {
    if (!data) return [];
    if (!search || !activeHit) return data.lines;
    const selected = data.lines.filter(line => Math.abs(line.n - activeHit.n) <= 100);
    return selected.length ? selected : data.lines;
  }, [data, search, activeHit]);
  useEffect(() => { setHitIndex(0); }, [search, snapshot]);

  return <ConceptBlock concept="C7" className="min-w-0 space-y-3">
    <div className="flex flex-wrap items-center gap-2"><form className="flex min-w-0 flex-1 items-center gap-2" onSubmit={event => { event.preventDefault(); setSearch(draft.trim()); setFrom(1); }}>
      <div className="relative min-w-0 flex-1"><Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" /><Input value={draft} onChange={event => setDraft(event.target.value)} placeholder="Tìm văn bản hoặc /regex/" className="pl-8" aria-label="Tìm trong transcript" /></div><Button type="submit" variant="outline">Tìm</Button>
    </form>
    {data?.blob && <Button asChild variant="outline"><a href={data.blob.href} download={`attempt-${attemptId}.txt`}><ArrowDownToLine className="size-4" /> Tải .txt</a></Button>}</div>
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><span>{data ? `${data.totalLines.toLocaleString('vi-VN')} dòng · ${data.final ? 'bản cuối' : 'snapshot'} · ${formatAbsolute(data.at)}` : 'Chưa có transcript'}</span>
      <div className="flex items-center gap-2"><label htmlFor={`snapshot-${attemptId}`}>Thời điểm</label><select id={`snapshot-${attemptId}`} value={snapshot} onChange={event => { setSnapshot(event.target.value); setFrom(1); }} className="max-w-44 rounded-md border bg-background px-2 py-1 text-foreground"><option value="">{live ? 'Theo dõi trực tiếp' : 'Bản cuối'}</option>{snapshots.data?.map(item => <option key={item.id} value={item.id}>{formatAbsolute(item.at)} · {item.lines} dòng</option>)}</select></div>
    </div>
    {search && <div className="flex items-center gap-2 text-xs"><span>{hits.length ? `${hitIndex + 1}/${data?.hitCount ?? hits.length} kết quả` : 'Không có kết quả'}</span><Button type="button" size="icon-xs" variant="outline" disabled={!hits.length} aria-label="Kết quả trước" onClick={() => setHitIndex(index => (index - 1 + hits.length) % hits.length)}><ChevronLeft className="size-3" /></Button><Button type="button" size="icon-xs" variant="outline" disabled={!hits.length} aria-label="Kết quả sau" onClick={() => setHitIndex(index => (index + 1) % hits.length)}><ChevronRight className="size-3" /></Button></div>}
    {transcript.error && <p role="status" className="rounded-lg border p-3 text-sm text-muted-foreground">{transcript.error}</p>}
    {data && <div className="max-h-[28rem] min-w-0 overflow-auto rounded-lg border bg-muted/20 font-mono text-xs" role="log" aria-label="Transcript đã che dữ liệu nhạy cảm">
      {visibleLines.map(line => <div key={line.n} className={`flex min-w-max border-b border-border/30 px-2 py-0.5 leading-5 ${line.n === activeHit?.n ? 'bg-amber-500/20' : line.hit ? 'bg-amber-500/10' : ''}`}><span className="mr-3 w-12 shrink-0 select-none text-right text-muted-foreground">{line.n}</span><span className="whitespace-pre">{line.text || ' '}</span></div>)}
    </div>}
    {data && !search && <div className="flex justify-between gap-2"><Button variant="outline" size="sm" disabled={from <= 1} onClick={() => setFrom(Math.max(1, from - 300))}>300 dòng trước</Button><Button variant="outline" size="sm" disabled={from + 300 > data.totalLines} onClick={() => setFrom(from + 300)}>300 dòng sau</Button></div>}
  </ConceptBlock>;
}
