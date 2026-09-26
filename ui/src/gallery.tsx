import { useEffect, useState } from 'react';
import { Camera, ChevronLeft, ChevronRight, FileCode2, Image as ImageIcon, Play, RefreshCw, Search, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { CommitPatch, CommitRow, EvidenceItem, EvidencePage } from './types';

const projects = [{ id: 'all', name: 'Tất cả dự án' }, { id: 'nivo', name: 'Nivo' }, { id: 'starci-next', name: 'StarCi Next' }, { id: 'mia-mia', name: 'Mia Mia' }];
const kinds = [{ id: 'all', name: 'Tất cả', icon: ImageIcon }, { id: 'ai-draw', name: 'Ảnh AI vẽ', icon: ImageIcon }, { id: 'screenshot', name: 'Ảnh chụp', icon: Camera }, { id: 'uat-video', name: 'Video UAT', icon: Video }] as const;
const mediaUrl = (id: string) => `/api/evidence/${id}`;
const date = (value: number) => new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' }).format(value);

export function EvidenceGallery() {
  const [project, setProject] = useState('all');
  const [kind, setKind] = useState<'all' | EvidenceItem['kind']>('all');
  const [query, setQuery] = useState('');
  const [offset, setOffset] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [page, setPage] = useState<EvidencePage | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<EvidenceItem | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ project, kind, q: query, offset: String(offset) });
        const response = await fetch(`/api/evidence?${params}`, { signal: controller.signal, cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        setPage(await response.json() as EvidencePage); setError('');
      } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : String(cause)); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }, query ? 250 : 0);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [project, kind, query, offset, refresh]);
  const chooseProject = (value: string) => { setProject(value); setOffset(0); };
  const chooseKind = (value: typeof kind) => { setKind(value); setOffset(0); };
  return <section className="space-y-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-400">Bằng chứng từ runtime</div><h3 className="text-xl font-semibold">Thư viện hình và video</h3><p className="mt-1 max-w-3xl text-sm text-zinc-500">Ảnh AI của interface.draw, ảnh chụp màn hình triển khai, và video UAT từ các dự án. Mỗi tệp giữ đường dẫn nguồn để đối chiếu.</p></div><Button variant="outline" size="sm" onClick={() => setRefresh((value) => value + 1)}><RefreshCw className="size-4" /> Làm mới</Button></div>
    <div className="flex flex-wrap gap-2">{projects.map((item) => <Button key={item.id} size="sm" variant={project === item.id ? 'secondary' : 'outline'} onClick={() => chooseProject(item.id)}>{item.name}</Button>)}</div>
    <div className="flex flex-wrap items-center gap-2">{kinds.map((item) => <Button key={item.id} size="sm" variant={kind === item.id ? 'secondary' : 'outline'} onClick={() => chooseKind(item.id)}><item.icon className="size-4" />{item.name} <span className="text-zinc-500">{page?.counts[item.id] ?? '—'}</span></Button>)}<div className="relative min-w-[220px] flex-1"><Search className="absolute left-3 top-2.5 size-4 text-zinc-500" /><Input className="pl-9" value={query} onChange={(event) => { setQuery(event.target.value); setOffset(0); }} placeholder="Tìm tên tệp, tính năng, workflow..." /></div></div>
    {error && <p className="rounded-lg border border-red-500/30 p-4 text-sm text-red-400">Không đọc được thư viện: {error}</p>}
    <div className="flex justify-between text-xs text-zinc-500"><span>{loading ? 'Đang quét bằng chứng...' : `${page?.total ?? 0} tệp phù hợp`}</span><span>{page?.total ? `${offset + 1}–${Math.min(offset + 48, page.total)}` : ''}</span></div>
    {page?.items.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{page.items.map((item) => <button key={item.id} onClick={() => setSelected(item)} className="group overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 text-left transition hover:border-zinc-600"><div className="relative aspect-video overflow-hidden bg-zinc-900">{item.kind === 'uat-video' ? <div className="flex size-full items-center justify-center bg-gradient-to-br from-zinc-900 to-zinc-950"><span className="rounded-full border border-zinc-600 bg-zinc-800/80 p-4"><Play className="size-6 fill-current text-zinc-100" /></span></div> : <img loading="lazy" src={mediaUrl(item.id)} alt={item.name} className="size-full object-contain transition-transform duration-300 group-hover:scale-[1.03]" />}<span className="absolute left-2 top-2 rounded bg-black/80 px-2 py-1 text-[10px] text-white">{item.kind === 'ai-draw' ? 'Ảnh AI vẽ' : item.kind === 'screenshot' ? 'Ảnh chụp thật' : 'Video UAT'}</span></div><div className="space-y-1.5 p-3"><div className="truncate text-sm font-medium" title={item.name}>{item.name}</div><div className="text-xs text-zinc-500">{item.projectName} · {date(item.modifiedAt)}</div><div className="truncate font-mono text-[10px] text-zinc-600" title={item.path}>{item.path}</div></div></button>)}</div> : !loading && <div className="rounded-lg border border-dashed border-zinc-800 p-8 text-center text-sm text-zinc-500">Chưa có bằng chứng phù hợp bộ lọc.</div>}
    {page && page.total > 48 && <div className="flex items-center justify-center gap-3"><Button variant="outline" size="sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 48))}><ChevronLeft className="size-4" /> Trước</Button><span className="text-xs text-zinc-500">Trang {Math.floor(offset / 48) + 1} / {Math.ceil(page.total / 48)}</span><Button variant="outline" size="sm" disabled={offset + 48 >= page.total} onClick={() => setOffset(offset + 48)}>Sau <ChevronRight className="size-4" /></Button></div>}
    <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null); }}><DialogContent className="max-h-[94vh] max-w-[95vw] overflow-auto bg-zinc-950"><DialogHeader><DialogTitle className="pr-5 text-sm">{selected?.name}</DialogTitle></DialogHeader>{selected && <div className="space-y-3">{selected.kind === 'uat-video' ? <video key={selected.id} controls preload="metadata" className="max-h-[72vh] w-full rounded-lg bg-black"><source src={mediaUrl(selected.id)} type={selected.name.endsWith('.mp4') ? 'video/mp4' : 'video/webm'} /></video> : <img src={mediaUrl(selected.id)} alt={selected.name} className="max-h-[72vh] w-full rounded-lg bg-black object-contain" />}<div className="break-all rounded-md border border-zinc-800 p-3 font-mono text-xs text-zinc-400">{selected.projectName} · {selected.path}</div><a href={mediaUrl(selected.id)} target="_blank" rel="noreferrer" className="inline-flex text-xs text-sky-400 underline">Mở tệp gốc trong tab mới</a></div>}</DialogContent></Dialog>
  </section>;
}

export function CommitHistory() {
  const [project, setProject] = useState('nivo');
  const [rows, setRows] = useState<CommitRow[]>([]);
  const [chosen, setChosen] = useState<CommitRow | null>(null);
  const [patch, setPatch] = useState<CommitPatch | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setChosen(null); setPatch(null);
    fetch(`/api/history?project=${project}`, { signal: controller.signal, cache: 'no-store' }).then((response) => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json(); }).then((result: { commits: CommitRow[] }) => { setRows(result.commits); setChosen(result.commits[0] || null); setError(''); }).catch((cause) => { if (!controller.signal.aborted) setError(String(cause)); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [project]);
  useEffect(() => {
    if (!chosen) return;
    const controller = new AbortController();
    setPatch(null);
    fetch(`/api/history/${project}/${chosen.repository}/${chosen.sha}`, { signal: controller.signal, cache: 'no-store' }).then((response) => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json(); }).then((result: CommitPatch) => setPatch(result)).catch((cause) => { if (!controller.signal.aborted) setError(String(cause)); });
    return () => controller.abort();
  }, [project, chosen]);
  return <section className="space-y-5"><div><div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-400">Git history</div><h3 className="text-xl font-semibold">Code diff đã commit</h3><p className="mt-1 text-sm text-zinc-500">Mở commit gần đây của BE hoặc FE; nội dung code được rút gọn và ẩn chuỗi nhạy cảm phổ biến.</p></div><div className="flex flex-wrap gap-2">{projects.slice(1).map((item) => <Button key={item.id} size="sm" variant={project === item.id ? 'secondary' : 'outline'} onClick={() => setProject(item.id)}>{item.name}</Button>)}</div>{error && <p className="text-sm text-red-400">{error}</p>}
    <div className="grid items-start gap-4 xl:grid-cols-[320px_minmax(0,1fr)]"><aside className="max-h-[70vh] space-y-2 overflow-auto">{rows.map((row) => <button key={`${row.repository}-${row.sha}`} onClick={() => setChosen(row)} className={`w-full rounded-lg border p-3 text-left ${chosen?.sha === row.sha && chosen.repository === row.repository ? 'border-sky-500/50 bg-sky-500/10' : 'border-zinc-800 bg-zinc-950 hover:border-zinc-600'}`}><div className="line-clamp-2 text-sm font-medium">{row.subject}</div><div className="mt-2 text-[11px] text-zinc-500">{row.repository} · {row.sha.slice(0, 8)} · {date(row.at)}</div></button>)}{!rows.length && <div className="rounded-lg border border-dashed border-zinc-800 p-4 text-sm text-zinc-500">{loading ? 'Đang đọc Git...' : 'Chưa có commit.'}</div>}</aside><main className="min-w-0 overflow-hidden rounded-lg border border-zinc-800"><div className="flex items-center gap-2 border-b border-zinc-800 bg-zinc-900 px-4 py-3 text-xs"><FileCode2 className="size-4 text-sky-400" /><span>{chosen ? `${chosen.repository} · ${chosen.sha.slice(0, 12)} · ${patch?.files.length ?? '…'} tệp code` : 'Chọn commit'}</span></div>{patch?.patch ? <div className="max-h-[68vh] overflow-auto bg-[#08090a] py-2 font-mono text-[11px] leading-5">{patch.patch.split('\n').map((line, index) => <div key={index} className={`min-w-max whitespace-pre px-3 ${line.startsWith('+') && !line.startsWith('+++') ? 'bg-emerald-500/10 text-emerald-300' : line.startsWith('-') && !line.startsWith('---') ? 'bg-red-500/10 text-red-300' : line.startsWith('@@') ? 'text-sky-300' : 'text-zinc-500'}`}>{line || ' '}</div>)}</div> : <div className="p-6 text-sm text-zinc-500">{patch ? 'Commit này không có tệp code trong phạm vi hiển thị.' : chosen ? 'Đang đọc diff...' : 'Chưa chọn commit.'}</div>}</main></div>
  </section>;
}
