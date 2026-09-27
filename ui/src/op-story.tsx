import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CheckCircle2, ChevronRight, CircleAlert, Clapperboard, FileCode2, Image as ImageIcon, Layers, ListTree, MonitorSmartphone, Paperclip, Play, Sparkles, XCircle } from 'lucide-react';
import type { Artifact, Artifacts, JobDiff, LogPage, LogRow } from './contract';
import { ImageViewer, artifactUrl } from './artifacts';

// The owner opens an op to answer three questions: what did it do, is it right, where is the proof.
// OpStory answers them in that order for one job: a one-line verdict, then the op's main product shown
// the way that kind of work is judged (drawn shapes side by side, a test video with its steps, the code
// that changed with the app it produced, a generated image with its prompt), then the timeline, the code
// and the raw files folded away. Read-only; every byte comes from the indexed artifacts, the typed logs
// and the patch JSON of the job.

type Kind = 'draw' | 'test' | 'code' | 'asset' | 'decide';
const kindOf = (op: string, subkinds: Set<string>): Kind => {
  if (op.startsWith('interface.draw') || op === 'brand.decide') return subkinds.has('draw-render') || op.startsWith('interface.draw') ? 'draw' : 'decide';
  if (op === 'interface.asset') return 'asset';
  if (/^(e2e|uat)\.|interface\.audit|uat\.assisted/.test(op) || subkinds.has('uat-video') || subkinds.has('e2e-video')) return 'test';
  if (/implement|refactor|author|fix|migrate/.test(op)) return 'code';
  return 'decide';
};

const useJson = <T,>(url: string | null) => {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    setData(null); setError('');
    if (!url) return;
    const controller = new AbortController();
    fetch(url, { signal: controller.signal, cache: 'no-store' })
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((j: T) => setData(j)).catch((e) => { if (!controller.signal.aborted) setError(String(e)); });
    return () => controller.abort();
  }, [url]);
  return { data, error };
};

const clock = (ms: number) => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const span = (ms: number) => ms < 60_000 ? `${Math.round(ms / 1000)} giây` : ms < 3_600_000 ? `${Math.round(ms / 60_000)} phút` : `${(ms / 3_600_000).toFixed(1)} giờ`;

function Section({ icon, title, note, children, open = false, testId }: { icon: ReactNode; title: string; note?: string; children: ReactNode; open?: boolean; testId?: string }) {
  return <details open={open} className="group rounded-xl border border-zinc-800 bg-zinc-950/60" data-testid={testId}>
    <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-sm font-medium text-zinc-200">
      <ChevronRight className="size-4 text-zinc-500 transition-transform group-open:rotate-90" />{icon}{title}{note && <span className="ml-auto text-xs font-normal text-zinc-500">{note}</span>}
    </summary>
    <div className="border-t border-zinc-800 p-3">{children}</div>
  </details>;
}

// ------------------------------------------------------------------------------------------- draw
/** "module-ledger#installed@768px tablet", "installed--page@desktop", "draw-loop X round-3 1184x900" → parts. */
const shapeOf = (a: Artifact) => {
  const label = a.label || a.path.split('/').pop() || '';
  const round = Number(/round-(\d+)/.exec(label)?.[1] ?? /round-(\d+)/.exec(a.path)?.[1] ?? 0);
  const at = label.split('@');
  let shape = (at[0] || label).replace(/^draw-loop\s+/, '').replace(/\s+round-\d+.*$/, '').replace(/--page$/, '').trim();
  shape = shape || label;
  const viewText = (at[1] || label).toLowerCase();
  const view = /mobile|390|375/.test(viewText) ? 'mobile' : /tablet|768/.test(viewText) ? 'tablet' : 'desktop';
  return { shape, view, round };
};
const VIEW_ORDER = ['desktop', 'tablet', 'mobile'];
const VIEW_NAME: Record<string, string> = { desktop: 'Máy tính', tablet: 'Máy tính bảng', mobile: 'Điện thoại' };

function ShapeBoard({ projectId, jobId, images }: { projectId: string; jobId: string; images: Artifact[] }) {
  const byShape = useMemo(() => {
    const map = new Map<string, Artifact[]>();
    for (const a of images) { const { shape } = shapeOf(a); map.set(shape, [...(map.get(shape) || []), a]); }
    return [...map.entries()];
  }, [images]);
  const [pick, setPick] = useState(0);
  const [roundPick, setRoundPick] = useState<number | null>(null);
  const [zoom, setZoom] = useState<{ list: Artifact[]; index: number } | null>(null);
  useEffect(() => { setPick(0); setRoundPick(null); }, [images]);
  if (!byShape.length) return null;
  const [shape, list] = byShape[Math.min(pick, byShape.length - 1)];
  const rounds = [...new Set(list.map((a) => shapeOf(a).round))].sort((a, b) => a - b);
  const round = roundPick ?? rounds[rounds.length - 1];
  const shown = list.filter((a) => shapeOf(a).round === round).sort((a, b) => VIEW_ORDER.indexOf(shapeOf(a).view) - VIEW_ORDER.indexOf(shapeOf(b).view));
  return <div className="space-y-3" data-testid="story-shapes">
    {byShape.length > 1 && <div className="flex flex-wrap gap-1.5">{byShape.map(([name, items], i) => <button key={name} type="button" onClick={() => { setPick(i); setRoundPick(null); }} aria-pressed={i === pick}
      className={`rounded-full border px-2.5 py-1 text-xs ${i === pick ? 'border-sky-500/60 bg-sky-500/10 text-sky-200' : 'border-zinc-800 text-zinc-400 hover:text-zinc-200'}`}>{name}<span className="ml-1 text-zinc-500">{items.length}</span></button>)}</div>}
    <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400"><span className="font-medium text-zinc-200">{shape}</span>
      {rounds.length > 1 && <label className="flex items-center gap-2">Vòng vẽ <input type="range" min={0} max={rounds.length - 1} value={rounds.indexOf(round)} onChange={(e) => setRoundPick(rounds[Number(e.target.value)])} className="w-40 accent-sky-500" aria-label="Chọn vòng vẽ" /><span className="font-mono text-zinc-300">{round}/{rounds[rounds.length - 1]}</span></label>}
    </div>
    <div className="flex flex-wrap items-start gap-3">{shown.map((a, i) => { const v = shapeOf(a).view; return <button key={a.sha256} type="button" onClick={() => setZoom({ list: shown, index: i })} title={a.path}
      className={`overflow-hidden rounded-lg border border-zinc-800 bg-white/95 text-left hover:border-sky-500/60 ${v === 'mobile' ? 'w-[min(100%,220px)]' : v === 'tablet' ? 'w-[min(100%,360px)]' : 'min-w-0 flex-1 basis-[420px]'}`}>
      <img src={artifactUrl(projectId, jobId, a)} alt={`${shape} · ${VIEW_NAME[v]}`} loading="lazy" className="block w-full" />
      <span className="block bg-zinc-950 px-2 py-1 text-[11px] text-zinc-400">{VIEW_NAME[v]}</span></button>; })}</div>
    {zoom && <ImageViewer images={zoom.list} index={zoom.index} onClose={() => setZoom(null)} projectId={projectId} jobId={jobId} />}
  </div>;
}

// ------------------------------------------------------------------------------------------- test
const STEP_KINDS = new Set(['step.start', 'check.result', 'test.result', 'cmd.run', 'render', 'error', 'warning']);
function VideoStory({ projectId, jobId, videos, shots, rows }: { projectId: string; jobId: string; videos: Artifact[]; shots: Artifact[]; rows: LogRow[] }) {
  const [pick, setPick] = useState(0);
  const [zoom, setZoom] = useState<number | null>(null);
  const player = useRef<HTMLVideoElement | null>(null);
  const video = videos[Math.min(pick, videos.length - 1)];
  const steps = rows.filter((r) => STEP_KINDS.has(r.kind));
  const t0 = steps.length ? steps[0].at : 0;
  const seek = (row: LogRow) => { if (!player.current) return; player.current.currentTime = Math.max(0, (row.at - t0) / 1000); void player.current.play().catch(() => {}); };
  return <div className="space-y-3" data-testid="story-video">
    {video && <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="overflow-hidden rounded-lg border border-zinc-800 bg-black"><video ref={player} key={video.sha256} controls preload="metadata" className="aspect-video w-full" poster={shots[0] ? artifactUrl(projectId, jobId, shots[0]) : undefined}><source src={artifactUrl(projectId, jobId, video)} type={video.mime || undefined} /></video>
        {videos.length > 1 && <div className="flex flex-wrap gap-1.5 p-2">{videos.map((v, i) => <button key={v.sha256} type="button" onClick={() => setPick(i)} aria-pressed={i === pick} className={`rounded border px-2 py-0.5 text-[11px] ${i === pick ? 'border-sky-500/60 text-sky-200' : 'border-zinc-800 text-zinc-400'}`}>{v.label || v.path.split('/').pop()}</button>)}</div>}</div>
      <ol className="max-h-[360px] space-y-1 overflow-auto pr-1 text-xs" aria-label="Các bước">{steps.length ? steps.map((r) => <li key={r.seq}><button type="button" onClick={() => seek(r)} className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left hover:bg-zinc-800/60">
        <span className="font-mono text-[10px] text-zinc-500">{clock(r.at - t0)}</span>
        {r.level === 'error' || (r.kind === 'check.result' && r.data.pass === false) ? <XCircle className="mt-0.5 size-3.5 shrink-0 text-red-400" /> : r.kind === 'check.result' || r.kind === 'test.result' ? <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-400" /> : <Play className="mt-0.5 size-3.5 shrink-0 text-zinc-500" />}
        <span className="min-w-0 break-words text-zinc-300">{r.msg}</span></button></li>) : <li className="text-zinc-500">Chưa có bước nào trong nhật ký để đồng bộ với video.</li>}</ol>
    </div>}
    {steps.length > 0 && video && <p className="text-[11px] text-zinc-600">Bấm một bước để tua video tới lúc đó (ước tính theo thời điểm ghi nhật ký).</p>}
    {shots.length > 0 && <div><div className="mb-1.5 text-xs text-zinc-500">Ảnh từng bước · {shots.length}</div><div className="flex gap-2 overflow-x-auto pb-1">{shots.map((a, i) => <button key={a.sha256} type="button" onClick={() => setZoom(i)} title={a.label || a.path} className="w-40 shrink-0 overflow-hidden rounded-md border border-zinc-800 bg-zinc-950 hover:border-sky-500/60"><img src={artifactUrl(projectId, jobId, a)} alt={a.label || ''} loading="lazy" className="aspect-video w-full object-cover" /><span className="block truncate px-1.5 py-1 text-[10px] text-zinc-400">{a.label || a.path.split('/').pop()}</span></button>)}</div></div>}
    {zoom !== null && <ImageViewer images={shots} index={zoom} onClose={() => setZoom(null)} projectId={projectId} jobId={jobId} />}
  </div>;
}

// ------------------------------------------------------------------------------------------- code
function ChangeBoard({ diff, onOpen, projectId, jobId, captures }: { diff: JobDiff | null; onOpen: (path: string) => void; projectId: string; jobId: string; captures: Artifact[] }) {
  const [zoom, setZoom] = useState<number | null>(null);
  const files = (diff?.files || []).filter((f) => !f.path.startsWith('.starciwork/')).sort((a, b) => (b.added + b.removed) - (a.added + a.removed));
  const max = Math.max(1, ...files.map((f) => f.added + f.removed));
  return <div className="space-y-3" data-testid="story-code">
    {files.length > 0 ? <ul className="space-y-1">{files.slice(0, 14).map((f) => <li key={f.path}><button type="button" onClick={() => onOpen(f.path)} className="grid w-full grid-cols-[1fr_auto] items-center gap-3 rounded-md px-2 py-1.5 text-left hover:bg-zinc-800/60">
      <span className="min-w-0 truncate font-mono text-[11px] text-zinc-300" title={f.path}><span className={`mr-1.5 ${f.status === 'A' ? 'text-emerald-400' : f.status === 'D' ? 'text-red-400' : 'text-sky-400'}`}>{f.status}</span>{f.path}</span>
      <span className="flex items-center gap-2"><span className="flex h-1.5 w-24 overflow-hidden rounded-full bg-zinc-800"><span className="bg-emerald-500" style={{ width: `${(f.added / max) * 100}%` }} /><span className="bg-red-500" style={{ width: `${(f.removed / max) * 100}%` }} /></span><span className="w-20 text-right font-mono text-[10px]"><span className="text-emerald-400">+{f.added}</span> <span className="text-red-400">−{f.removed}</span></span></span></button></li>)}</ul>
      : <p className="text-xs text-zinc-500">{diff ? 'Không có thay đổi code sản phẩm (chỉ bản ghi .starciwork).' : 'Đang đọc thay đổi...'}</p>}
    {files.length > 14 && <p className="text-[11px] text-zinc-500">+{files.length - 14} tệp khác trong phần Code bên dưới.</p>}
    {captures.length > 0 && <div><div className="mb-1.5 flex items-center gap-1.5 text-xs text-zinc-500"><MonitorSmartphone className="size-3.5" />Kết quả trên ứng dụng · {captures.length}</div><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{captures.slice(0, 6).map((a, i) => <button key={a.sha256} type="button" onClick={() => setZoom(i)} title={a.label || a.path} className="overflow-hidden rounded-md border border-zinc-800 bg-zinc-950 hover:border-sky-500/60"><img src={artifactUrl(projectId, jobId, a)} alt={a.label || ''} loading="lazy" className="aspect-video w-full object-contain" /><span className="block truncate px-1.5 py-1 text-[10px] text-zinc-400">{a.label || a.path.split('/').pop()}</span></button>)}</div></div>}
    {zoom !== null && <ImageViewer images={captures} index={zoom} onClose={() => setZoom(null)} projectId={projectId} jobId={jobId} />}
  </div>;
}

// ------------------------------------------------------------------------------------------- asset
function AssetBoard({ projectId, jobId, images, all }: { projectId: string; jobId: string; images: Artifact[]; all: Artifact[] }) {
  const [zoom, setZoom] = useState<number | null>(null);
  const promptOf = (a: Artifact) => all.find((x) => x.path === `${a.path}.prompt.txt` || x.path === a.path.replace(/\.[a-z0-9]+$/i, '.prompt.txt'));
  return <div className="grid gap-3 md:grid-cols-2" data-testid="story-asset">{images.map((a, i) => { const p = promptOf(a); return <figure key={a.sha256} className="overflow-hidden rounded-lg border border-zinc-800 bg-[repeating-conic-gradient(#27272a_0%_25%,#18181b_0%_50%)] [background-size:16px_16px]">
    <button type="button" onClick={() => setZoom(i)} className="block w-full"><img src={artifactUrl(projectId, jobId, a)} alt={a.label || ''} loading="lazy" className="max-h-72 w-full object-contain" /></button>
    <figcaption className="space-y-1 bg-zinc-950 p-2 text-[11px]"><div className="text-zinc-300">{a.label || a.path.split('/').pop()}</div>{p && <a className="text-sky-400 underline" href={artifactUrl(projectId, jobId, p)} target="_blank" rel="noreferrer">Xem prompt đã dùng</a>}</figcaption></figure>; })}
    {zoom !== null && <ImageViewer images={images} index={zoom} onClose={() => setZoom(null)} projectId={projectId} jobId={jobId} />}
  </div>;
}

// ------------------------------------------------------------------------------------------- story
export interface StoryJob { jobId: string; op: string; status: string; verdict: string | null; model: string | null; createdAt: number; updatedAt: number; report: { outcome: string | null; summary: string | null; rootCause: string | null; nextStep: string | null; checks: number } | null }

/** The top of a job: the verdict in one line, then its main product in the viewer that fits the op. */
export function OpStory({ projectId, workflowId, job, onOpenFile }: { projectId: string; workflowId: string; job: StoryJob; onOpenFile: (path: string) => void }) {
  const q = (o: Record<string, string>) => new URLSearchParams(o).toString();
  const arts = useJson<Artifacts>(`/api/artifacts?${q({ project: projectId, workflow: workflowId, job: job.jobId })}`);
  const diff = useJson<JobDiff>(`/api/diff?${q({ project: projectId, job: job.jobId })}`);
  const logs = useJson<LogPage>(`/api/logs?${q({ project: projectId, workflow: workflowId, job: job.jobId, limit: '800' })}`);
  const all = useMemo(() => (arts.data?.jobs || []).flatMap((j) => j.artifacts), [arts.data]);
  const sub = (s: string) => all.filter((a) => a.subkind === s);
  const images = (s: string) => sub(s).filter((a) => a.kind === 'image');
  const subkinds = useMemo(() => new Set(all.map((a) => a.subkind || 'unknown')), [all]);
  const kind = kindOf(job.op, subkinds);
  const rows = logs.data?.rows || [];
  const ok = job.status === 'succeeded';
  const failed = job.status === 'failed' || job.verdict === 'blocked';
  const checks = rows.filter((r) => r.kind === 'check.result');
  const checksPassed = checks.filter((r) => r.data.pass !== false).length;
  const totals = diff.data?.totals;
  const draws = images('draw-render');
  const videos = [...sub('uat-video'), ...sub('e2e-video')];
  const shots = [...images('uat-capture'), ...images('e2e-capture')];
  const captures = images('app-capture');
  const assets = images('asset-gen');
  const headline = (job.report?.summary || '').split(/(?<=[.!?])\s/)[0];
  const hero = kind === 'draw' && draws.length ? { title: 'Hình đã vẽ', icon: <Layers className="size-4 text-violet-400" />, body: <ShapeBoard projectId={projectId} jobId={job.jobId} images={draws} /> }
    : kind === 'test' && (videos.length || shots.length) ? { title: 'Video và các bước kiểm thử', icon: <Clapperboard className="size-4 text-amber-400" />, body: <VideoStory projectId={projectId} jobId={job.jobId} videos={videos} shots={shots} rows={rows} /> }
      : kind === 'asset' && assets.length ? { title: 'Ảnh đã tạo', icon: <Sparkles className="size-4 text-pink-400" />, body: <AssetBoard projectId={projectId} jobId={job.jobId} images={assets} all={all} /> }
        : (totals && totals.files) || captures.length ? { title: 'Những gì đã thay đổi', icon: <FileCode2 className="size-4 text-sky-400" />, body: <ChangeBoard diff={diff.data} onOpen={onOpenFile} projectId={projectId} jobId={job.jobId} captures={captures} /> }
          : null;
  return <div className="space-y-3" data-testid="op-story">
    <div className={`rounded-xl border p-3 ${failed ? 'border-red-500/30 bg-red-500/5' : ok ? 'border-emerald-500/25 bg-emerald-500/5' : 'border-zinc-800 bg-zinc-950/60'}`}>
      <div className="flex items-start gap-2">{failed ? <CircleAlert className="mt-0.5 size-5 shrink-0 text-red-400" /> : ok ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-400" /> : <ListTree className="mt-0.5 size-5 shrink-0 text-yellow-300" />}
        <div className="min-w-0"><p className="text-sm font-medium text-zinc-100">{headline || (failed ? 'Chặng này chưa đạt.' : ok ? 'Chặng này đã xong.' : 'Chặng này đang chạy.')}</p>
          {failed && job.report?.rootCause && <p className="mt-1 text-xs text-red-300">Nguyên nhân: {job.report.rootCause}</p>}
          {job.report?.nextStep && <p className="mt-1 text-xs text-sky-300">Bước tiếp: {job.report.nextStep}</p>}</div></div>
      <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
        <span className="rounded-full border border-zinc-800 px-2 py-0.5 text-zinc-400">{span(Math.max(0, job.updatedAt - job.createdAt))}</span>
        {job.model && <span className="rounded-full border border-zinc-800 px-2 py-0.5 text-zinc-400">{job.model}</span>}
        {checks.length > 0 && <span className={`rounded-full border px-2 py-0.5 ${checksPassed === checks.length ? 'border-emerald-500/30 text-emerald-300' : 'border-red-500/30 text-red-300'}`}>{checksPassed}/{checks.length} check đạt</span>}
        {totals && totals.files > 0 && <span className="rounded-full border border-zinc-800 px-2 py-0.5 text-zinc-400">{totals.files} tệp · <span className="text-emerald-400">+{totals.added}</span> <span className="text-red-400">−{totals.removed}</span>{diff.data?.unlanded ? ' · chưa land' : ''}</span>}
        {draws.length > 0 && <span className="rounded-full border border-zinc-800 px-2 py-0.5 text-zinc-400"><ImageIcon className="mr-1 inline size-3" />{draws.length} hình vẽ</span>}
        {videos.length > 0 && <span className="rounded-full border border-zinc-800 px-2 py-0.5 text-zinc-400"><Clapperboard className="mr-1 inline size-3" />{videos.length} video</span>}
        {all.length > 0 && <span className="rounded-full border border-zinc-800 px-2 py-0.5 text-zinc-500"><Paperclip className="mr-1 inline size-3" />{all.length} tệp bằng chứng</span>}
      </div>
    </div>
    {hero && <Section icon={hero.icon} title={hero.title} open testId="story-hero">{hero.body}</Section>}
    {arts.error && <p className="text-xs text-red-400">Không đọc được tệp bằng chứng: {arts.error}</p>}
  </div>;
}

export { Section as StorySection };
