import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, ExternalLink, Image as ImageIcon, X } from 'lucide-react';
import type { Artifact, ArtifactJob, Artifacts, ArtifactSubkind } from './contract';
import { Markdown } from './markdown';

const names: Record<ArtifactSubkind | 'unknown', string> = {
  'draw-render': 'Bản vẽ', 'asset-gen': 'Ảnh tạo', 'app-capture': 'Ảnh ứng dụng', 'e2e-capture': 'Ảnh E2E',
  'uat-capture': 'Ảnh UAT', 'uat-video': 'Video UAT', 'e2e-video': 'Video E2E', 'playwright-trace': 'Playwright trace',
  patch: 'Patch', 'patch-json': 'Patch JSON', diff: 'Diff', report: 'Báo cáo', log: 'Nhật ký', critique: 'Nhận xét bản vẽ',
  metrics: 'Chỉ số', 'grammar-proposal': 'Đề xuất grammar', 'asset-request': 'Yêu cầu ảnh', unknown: 'Khác',
};
const order = Object.keys(names);
const size = (bytes: number) => bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
const ansi = (text: string) => text.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '').replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, '');
const fileName = (path: string) => path.split('/').pop() || path;
export const artifactUrl = (projectId: string, jobId: string, artifact: Artifact) => `/api/artifacts/file?${new URLSearchParams({ project: projectId, job: jobId, sha256: artifact.sha256 })}`;
const isImage = (artifact: Artifact) => artifact.kind === 'image' || /\.(png|jpe?g|webp|gif|avif)$/i.test(artifact.path);
const isVideo = (artifact: Artifact) => artifact.kind === 'video';
const labelOf = (artifact: Artifact) => artifact.label || fileName(artifact.path);

export function ImageViewer({ images, index, onClose, projectId, jobId }: { images: Artifact[]; index: number; onClose: () => void; projectId: string; jobId: string }) {
  const [position, setPosition] = useState(index);
  useEffect(() => { setPosition(index); }, [index]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft') setPosition((n) => (n + images.length - 1) % images.length);
      if (event.key === 'ArrowRight') setPosition((n) => (n + 1) % images.length);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [images.length, onClose]);
  const artifact = images[position];
  return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 p-3" role="dialog" aria-modal="true" aria-label={`Ảnh ${position + 1}/${images.length}`} onClick={onClose}>
    <button autoFocus type="button" className="absolute right-3 top-3 rounded-md bg-zinc-800 p-2 text-white" onClick={onClose} aria-label="Đóng ảnh"><X className="size-5" /></button>
    {images.length > 1 && <button type="button" className="absolute left-3 rounded-md bg-zinc-800 p-2 text-white" onClick={(event) => { event.stopPropagation(); setPosition((n) => (n + images.length - 1) % images.length); }} aria-label="Ảnh trước"><ChevronLeft /></button>}
    <figure className="max-w-[calc(100%-6rem)]" onClick={(event) => event.stopPropagation()}><img src={artifactUrl(projectId, jobId, artifact)} alt={labelOf(artifact)} className="max-h-[80vh] max-w-full rounded object-contain" /><figcaption className="mt-2 text-center text-xs text-zinc-300">{labelOf(artifact)} · {position + 1}/{images.length}</figcaption></figure>
    {images.length > 1 && <button type="button" className="absolute right-3 rounded-md bg-zinc-800 p-2 text-white" onClick={(event) => { event.stopPropagation(); setPosition((n) => (n + 1) % images.length); }} aria-label="Ảnh sau"><ChevronRight /></button>}
  </div>;
}

function DataTable({ value }: { value: unknown }) {
  const [query, setQuery] = useState('');
  const rows: { key: string; value: string }[] = [];
  const walk = (item: unknown, key: string, depth: number) => {
    if (rows.length >= 160) return;
    if (item && typeof item === 'object' && depth < 5) {
      for (const [part, child] of Object.entries(item)) walk(child, key ? `${key}.${part}` : part, depth + 1);
    } else rows.push({ key, value: typeof item === 'string' ? item : JSON.stringify(item) ?? '—' });
  };
  walk(value, '', 0);
  const verdict = rows.find((row) => /(?:^|\.)(?:verdict|pass|passed|ok)$/i.test(row.key));
  const score = rows.find((row) => /(?:^|\.)(?:score|totalScore)$/i.test(row.key));
  return <div className="space-y-2">{(verdict || score) && <div className="flex flex-wrap gap-2">{verdict && <span className="rounded-full border border-sky-500/30 px-2 py-0.5 text-xs text-sky-300">{verdict.key}: {verdict.value}</span>}{score && <span className="rounded-full border border-violet-500/30 px-2 py-0.5 text-xs text-violet-300">{score.key}: {score.value}</span>}</div>}
    <input aria-label="Lọc trường" placeholder="Lọc trường và nội dung..." value={query} onChange={(event) => setQuery(event.target.value)} className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs" />
    <div className="max-h-80 overflow-auto rounded-md border border-zinc-800"><table className="w-full text-left text-xs"><tbody>{rows.filter((row) => `${row.key} ${row.value}`.toLocaleLowerCase('vi').includes(query.toLocaleLowerCase('vi'))).map((row, index) => <tr key={`${row.key}-${index}`} className="border-b border-zinc-800 last:border-0"><th className="w-1/3 break-all px-2 py-1 align-top font-mono font-normal text-zinc-500">{row.key || 'giá trị'}</th><td className="break-words px-2 py-1 text-zinc-300">{row.value}</td></tr>)}</tbody></table></div></div>;
}

export function ArtifactText({ projectId, jobId, artifact }: { projectId: string; jobId: string; artifact: Artifact }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState('');
  const url = artifactUrl(projectId, jobId, artifact);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    fetch(url, { signal: controller.signal }).then((response) => { if (!response.ok) throw Error(`HTTP ${response.status}`); return response.text(); })
      .then((body) => setText(body.slice(0, 100000))).catch((cause) => { if (!controller.signal.aborted) setError(String(cause)); });
    return () => controller.abort();
  }, [open, url]);
  const structured = (['critique', 'metrics', 'report', 'grammar-proposal', 'asset-request'].includes(artifact.subkind ?? '') || /rationale\.json$/i.test(artifact.path)) && /\.json$/i.test(artifact.path);
  let json: unknown = null;
  if (structured && text) { try { json = JSON.parse(text); } catch { /* show source */ } }
  return <details className="rounded-md border border-zinc-800" onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary className="cursor-pointer px-2.5 py-2 text-xs text-zinc-300">{fileName(artifact.path)} <span className="text-zinc-500">· {size(artifact.bytes)}</span></summary>
    <div className="space-y-2 border-t border-zinc-800 p-2.5">{error ? <p className="text-red-400">{error}</p> : text == null ? <p className="text-zinc-500">Đang đọc tệp...</p> : json !== null ? <DataTable value={json} /> : artifact.subkind === 'log' ? <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] text-zinc-400">{ansi(text)}</pre> : /\.(md|markdown)$/i.test(artifact.path) ? <Markdown text={text} /> : <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] text-zinc-400">{text}</pre>}
      <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] text-sky-400 underline">Mở tệp gốc <ExternalLink className="size-3" /></a></div>
  </details>;
}

function Group({ projectId, job, subkind, artifacts, onOpenDiff }: { projectId: string; job: ArtifactJob; subkind: string; artifacts: Artifact[]; onOpenDiff?: () => void }) {
  const images = artifacts.filter(isImage);
  const videos = artifacts.filter(isVideo);
  const rest = artifacts.filter((artifact) => !isImage(artifact) && !isVideo(artifact));
  const [zoom, setZoom] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);
  const PAGE = 12;
  const shownImages = showAll ? images : images.slice(0, PAGE);
  const shownRest = showAll ? rest : rest.slice(0, PAGE);
  const hidden = (images.length - shownImages.length) + (rest.length - shownRest.length);
  return <section className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-900/30 p-3" data-testid={`artifact-${subkind}`}>
    <h4 className="flex items-center gap-2 text-xs font-semibold text-zinc-200">{names[subkind as ArtifactSubkind] || names.unknown}<span className="rounded-full bg-zinc-800 px-1.5 text-[10px] text-zinc-400">{artifacts.length}</span></h4>
    {subkind === 'draw-render' && <p className="text-[11px] text-zinc-500">Các vòng vẽ · máy tính và điện thoại</p>}
    {images.length > 0 && <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{shownImages.map((artifact, index) => <button key={artifact.sha256} type="button" onClick={() => setZoom(index)} title={artifact.origin || artifact.path} className="overflow-hidden rounded-md border border-zinc-800 bg-zinc-950 text-left hover:border-sky-500/50"><img src={artifactUrl(projectId, job.jobId, artifact)} alt={labelOf(artifact)} loading="lazy" className="aspect-video w-full object-contain" /><div className="truncate px-2 py-1 text-[11px] text-zinc-300">{labelOf(artifact)}</div><div className="truncate px-2 pb-1 font-mono text-[10px] text-zinc-600">{artifact.sha256.slice(0, 10)} · {size(artifact.bytes)}</div></button>)}</div>}
    {videos.length > 0 && <div className="grid gap-2 sm:grid-cols-2">{videos.map((artifact) => <figure key={artifact.sha256} title={artifact.origin || artifact.path} className="overflow-hidden rounded-md border border-zinc-800 bg-black"><video controls preload="metadata" poster={images[0] ? artifactUrl(projectId, job.jobId, images[0]) : undefined} className="aspect-video w-full" data-testid="artifact-video"><source src={artifactUrl(projectId, job.jobId, artifact)} type={artifact.mime || undefined} /></video><figcaption className="px-2 py-1 text-[11px] text-zinc-400">{labelOf(artifact)} · {size(artifact.bytes)} · {artifact.sha256.slice(0, 10)}</figcaption></figure>)}</div>}
    {shownRest.map((artifact) => <div key={artifact.sha256 + artifact.path} title={artifact.origin || artifact.path} className="space-y-1">{['patch', 'patch-json', 'diff'].includes(subkind) && onOpenDiff && <button type="button" onClick={onOpenDiff} className="rounded-md border border-sky-500/30 px-2 py-1 text-xs text-sky-300 hover:bg-sky-500/10">Xem diff · {artifact.label || (artifact.landedSha ? 'đã land' : 'chưa land')}</button>}
      {subkind === 'playwright-trace' ? <a href={artifactUrl(projectId, job.jobId, artifact)} download={fileName(artifact.path)} className="flex items-center gap-2 rounded-md border border-zinc-800 px-2 py-1.5 text-xs text-sky-300"><Download className="size-3.5" />{fileName(artifact.path)} · {size(artifact.bytes)} · {artifact.sha256.slice(0, 10)}</a>
        : <ArtifactText projectId={projectId} jobId={job.jobId} artifact={artifact} />}</div>)}
    {hidden > 0 && <button type="button" onClick={() => setShowAll(true)} className="rounded-md border border-zinc-800 px-2 py-1 text-[11px] text-zinc-400 hover:text-zinc-200">Xem thêm {hidden} tệp</button>}
    {showAll && images.length + rest.length > PAGE && <button type="button" onClick={() => setShowAll(false)} className="rounded-md border border-zinc-800 px-2 py-1 text-[11px] text-zinc-500 hover:text-zinc-300">Thu gọn</button>}
    {zoom !== null && <ImageViewer images={images} index={zoom} onClose={() => setZoom(null)} projectId={projectId} jobId={job.jobId} />}
  </section>;
}

/** Indexed artifacts for a job or an entire workflow. */
export function ArtifactPanel({ projectId, workflowId, jobId, jobIds, onOpenDiff, pathQuery = '' }: { projectId: string; workflowId: string; jobId?: string; jobIds?: string[]; onOpenDiff?: () => void; pathQuery?: string }) {
  const [data, setData] = useState<Artifacts | null>(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ project: projectId, workflow: workflowId, ...(jobId ? { job: jobId } : {}) });
    fetch(`/api/artifacts?${params}`, { signal: controller.signal, cache: 'no-store' }).then((response) => { if (!response.ok) throw Error(`HTTP ${response.status}`); return response.json(); }).then(setData).catch((cause) => { if (!controller.signal.aborted) setError(String(cause)); });
    return () => controller.abort();
  }, [projectId, workflowId, jobId]);
  const jobs = useMemo(() => (data?.jobs || []).filter((job) => !jobIds || jobIds.includes(job.jobId)).map((job) => ({ ...job, artifacts: job.artifacts.filter((artifact) => !pathQuery || artifact.path.toLowerCase().includes(pathQuery.toLowerCase())) })), [data, jobIds?.join(','), pathQuery]);
  const counts = useMemo(() => jobs.flatMap((job) => job.artifacts).reduce<Record<string, number>>((acc, artifact) => { const key = artifact.subkind || 'unknown'; acc[key] = (acc[key] || 0) + 1; return acc; }, {}), [jobs]);
  const total = Object.values(counts).reduce((n, count) => n + count, 0);
  const firstJob = jobs.find((job) => job.artifacts.length)?.jobId;
  return <section className="space-y-3" data-testid="artifact-panel"><div className="flex flex-wrap items-center gap-2"><ImageIcon className="size-4 text-violet-400" /><h3 className="text-sm font-semibold">Tệp và hình của {jobId ? 'job' : 'workflow'}</h3><span className="text-xs text-zinc-500">{total} tệp · {jobs.filter((job) => job.artifacts.length).length} job</span></div>
    {error && <p className="text-xs text-red-400">Không đọc được tệp: {error}</p>}
    <div className="flex flex-wrap gap-1.5"><button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')} className={`rounded-full border px-2 py-1 text-[11px] ${filter === 'all' ? 'border-sky-500/50 text-sky-300' : 'border-zinc-800 text-zinc-500'}`}>Tất cả {total}</button>{order.filter((key) => counts[key]).map((key) => <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)} className={`rounded-full border px-2 py-1 text-[11px] ${filter === key ? 'border-sky-500/50 text-sky-300' : 'border-zinc-800 text-zinc-500'}`}>{names[key as ArtifactSubkind] || names.unknown} {counts[key]}</button>)}</div>
    {jobs.map((job) => { const artifacts = job.artifacts.filter((artifact) => filter === 'all' || (artifact.subkind || 'unknown') === filter); const groups = artifacts.reduce<Record<string, Artifact[]>>((acc, artifact) => { const key = artifact.subkind || 'unknown'; (acc[key] ||= []).push(artifact); return acc; }, {}); return artifacts.length ? <details key={job.jobId} className="group/job rounded-lg border border-zinc-800/70" open={jobs.length === 1 || job.jobId === firstJob}><summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 px-2.5 py-2 text-[11px]"><ChevronRight className="size-3.5 text-zinc-500 transition-transform group-open/job:rotate-90" /><code className="break-all text-zinc-300">{job.jobId}</code><span className="text-zinc-500">{job.opId} · lần {job.attempt ?? '—'} · {job.status}</span><span className="ml-auto rounded-full bg-zinc-800 px-1.5 text-[10px] text-zinc-400">{artifacts.length} tệp</span></summary><div className="space-y-2 border-t border-zinc-800/70 p-2.5">{order.filter((key) => groups[key]?.length).map((key) => <Group key={key} projectId={projectId} job={job} subkind={key} artifacts={groups[key]} onOpenDiff={onOpenDiff} />)}</div></details> : null; })}
    {data && !total && <p className="rounded-md border border-dashed border-zinc-800 p-3 text-xs text-zinc-500">Chưa có tệp phù hợp.</p>}
  </section>;
}
