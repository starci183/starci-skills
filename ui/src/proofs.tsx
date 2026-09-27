import { useEffect, useState } from 'react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { FileCode2, FileText, Film, Image as ImageIcon, LoaderCircle, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { CommitPatch, JobProofs, OpProofs, ProofFile, Unit } from './types';
import { slotWait, unitMark, unitState } from './flow-dag';
import { WorkflowEvents } from './workflow-events';
import { OpLiveLog } from './op-live-log';

/** A unit the panel can narrow to: its op and the jobs whose proofs it shows. */
export interface ProofUnit extends Unit { op: string | null; jobIds: string[] }
export interface ProofTarget { title: string; op: string | null; jobIds: string[] | null; units: ProofUnit[] }

const when = (value: number | null | undefined) => (value ? new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' }).format(value) : '—');
const size = (bytes: number) => (bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);
const statusTone: Record<string, string> = {
  succeeded: 'border-emerald-500/30 text-emerald-400', failed: 'border-red-500/30 text-red-400', running: 'border-yellow-400/30 text-yellow-300',
  leased: 'border-yellow-400/30 text-yellow-300', answering: 'border-yellow-400/30 text-yellow-300', queued: 'border-zinc-600 text-zinc-400', cancelled: 'border-zinc-700 text-zinc-500',
};

/** Images grouped by the shape (`XBase#state`) they draw; unshaped images last. */
function imageGroups(images: ProofFile[]): [string | null, ProofFile[]][] {
  const groups = new Map<string | null, ProofFile[]>();
  for (const file of images) groups.set(file.shape ?? null, [...(groups.get(file.shape ?? null) ?? []), file]);
  return [...groups].sort(([a], [b]) => (a == null ? 1 : b == null ? -1 : a.localeCompare(b)));
}

function PatchView({ patch }: { patch: string }) {
  return <div className="max-h-[50vh] overflow-auto rounded-md border border-zinc-800 bg-[#08090a] py-2 font-mono text-[11px] leading-5">{patch.split('\n').map((line, index) => <div key={index} className={`min-w-max whitespace-pre px-3 ${line.startsWith('+') && !line.startsWith('+++') ? 'bg-emerald-500/10 text-emerald-300' : line.startsWith('-') && !line.startsWith('---') ? 'bg-red-500/10 text-red-300' : line.startsWith('@@') ? 'text-sky-300' : 'text-zinc-500'}`}>{line || ' '}</div>)}</div>;
}

/** The landed commit of a job as a diff (the existing /api/history commit endpoint). */
function CommitDiff({ projectId, head }: { projectId: string; head: JobProofs['heads'][number] }) {
  const [patch, setPatch] = useState<CommitPatch | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/history/${projectId}/${head.repository}/${head.sha}`, { signal: controller.signal, cache: 'no-store' })
      .then((response) => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json(); })
      .then((result: CommitPatch) => setPatch(result)).catch((cause) => { if (!controller.signal.aborted) setError(String(cause)); });
    return () => controller.abort();
  }, [projectId, head.repository, head.sha]);
  return <div className="space-y-1.5" data-testid="proof-diff">
    <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-400"><FileCode2 className="size-3.5 text-sky-400" /><span className="font-mono">{head.repository} · {head.sha.slice(0, 12)}</span><span className="text-zinc-600">{head.source === 'landed' ? 'commit đã land' : 'head trong report'}</span>{patch && <span className="text-zinc-600">· {patch.files.length} tệp code</span>}</div>
    {error ? <p className="text-xs text-red-400">Không đọc được diff: {error}</p> : !patch ? <p className="text-xs text-zinc-500">Đang đọc diff...</p> : patch.patch ? <PatchView patch={patch.patch} /> : <p className="text-xs text-zinc-500">Commit này không có tệp code trong phạm vi hiển thị.</p>}
  </div>;
}

function TextFile({ file }: { file: ProofFile }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    if (!open || text != null) return;
    fetch(file.url, { cache: 'no-store' }).then((response) => response.text()).then((body) => setText(body.slice(0, 60_000))).catch((cause) => setText(String(cause)));
  }, [open, text, file.url]);
  return <details className="rounded-md border border-zinc-800" onToggle={(event) => setOpen((event.target as HTMLDetailsElement).open)}>
    <summary className="flex cursor-pointer items-center gap-2 px-2.5 py-1.5 text-[11px]">{file.kind === 'patch' ? <FileCode2 className="size-3.5 text-sky-400" /> : <FileText className="size-3.5 text-zinc-500" />}<span className="min-w-0 flex-1 truncate font-mono text-zinc-300" title={file.path}>{file.name}</span><span className="text-zinc-600">{size(file.size)}</span></summary>
    <div className="border-t border-zinc-800 p-2">{text == null ? <p className="text-xs text-zinc-500">Đang đọc...</p> : file.kind === 'patch' ? <PatchView patch={text} /> : <pre className="max-h-[40vh] overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-5 text-zinc-400">{text}</pre>}
      <p className="mt-1 break-all font-mono text-[10px] text-zinc-600">{file.path} · <a className="text-sky-400 underline" href={file.url} target="_blank" rel="noreferrer">mở tệp</a></p></div>
  </details>;
}

function JobSection({ projectId, job, open }: { projectId: string; job: JobProofs; open: boolean }) {
  const images = job.files.filter((file) => file.kind === 'image');
  const videos = job.files.filter((file) => file.kind === 'video');
  const texts = job.files.filter((file) => file.kind === 'patch' || file.kind === 'file').sort((a, b) => Number(b.kind === 'patch') - Number(a.kind === 'patch'));
  const [shown, setShown] = useState(open);
  return <details open={open} className="rounded-lg border border-zinc-800 bg-zinc-900/30" onToggle={(event) => setShown((event.target as HTMLDetailsElement).open)} data-testid="proof-job">
    <summary className="cursor-pointer list-none p-3">
      <div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className={statusTone[job.status] ?? 'text-zinc-400'}>{job.status}</Badge>{job.verdict && <span className="text-xs text-zinc-300">verdict {job.verdict}</span>}<span className="font-mono text-[11px] text-zinc-500">{job.jobId}</span><span className="ml-auto text-[11px] text-zinc-500">{when(job.updatedAt)}</span></div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-zinc-500"><span>lần {job.attempt}</span>{job.model && <span>model {job.model}</span>}{job.cut && <span>cut {job.cut.id} · {job.cut.ordinal}/{job.cut.total}</span>}<span>{images.length} ảnh · {videos.length} video · {job.heads.length} commit · {texts.length} tệp</span></div>
      {job.title && <p className="mt-1 text-xs text-zinc-400">{job.title}</p>}
    </summary>
    {shown && <div className="space-y-3 border-t border-zinc-800 p-3">
      {job.report ? <div className="space-y-1.5 text-xs leading-5" data-testid="proof-report">
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Report · {job.report.outcome ?? '—'} · {job.report.checks} check · {when(job.report.filedAt)}</div>
        {job.report.summary && <p className="whitespace-pre-wrap break-words text-zinc-300">{job.report.summary}</p>}
        {job.report.rootCause && <p className="break-words text-zinc-400"><span className="text-red-300">rootCause:</span> {job.report.rootCause}</p>}
        {job.report.nextStep && <p className="break-words text-zinc-400"><span className="text-sky-300">nextStep:</span> {job.report.nextStep}</p>}
      </div> : <p className="text-xs text-zinc-500">Job chưa nộp report.</p>}
      {job.heads.map((head) => <CommitDiff key={head.sha} projectId={projectId} head={head} />)}
      {images.length > 0 && <div><div className="mb-1.5 flex items-center gap-1.5 text-[11px] text-zinc-500"><ImageIcon className="size-3.5" />Ảnh — bản vẽ và ảnh chụp ({images.length})</div><div className="space-y-3">{imageGroups(images).map(([shape, group]) => <section key={shape ?? '-'} data-testid="proof-image-group">
        <div className="mb-1 font-mono text-[11px] text-violet-300">{shape ?? <span className="font-sans text-zinc-500">Ảnh khác</span>}<span className="ml-2 text-zinc-600">{group.length}</span></div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{group.slice(0, 12).map((file) => <a key={file.id} href={file.url} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-md border border-zinc-800 bg-zinc-900" title={file.path}><img loading="lazy" src={file.url} alt={file.name} className="aspect-video w-full object-contain transition-transform group-hover:scale-[1.03]" /><div className="truncate px-1.5 py-1 font-mono text-[10px] text-zinc-500">{file.name}</div></a>)}</div>{group.length > 12 && <p className="mt-1 text-[11px] text-zinc-600">+{group.length - 12} ảnh khác</p>}</section>)}</div></div>}
      {videos.length > 0 && <div><div className="mb-1.5 flex items-center gap-1.5 text-[11px] text-zinc-500"><Film className="size-3.5" />Video ({videos.length})</div><div className="grid gap-2 sm:grid-cols-2">{videos.map((file) => <figure key={file.id} className="overflow-hidden rounded-md border border-zinc-800 bg-black"><video controls preload="metadata" className="aspect-video w-full" data-testid="proof-video"><source src={file.url} type={file.name.endsWith('.mp4') ? 'video/mp4' : 'video/webm'} /></video><figcaption className="truncate px-1.5 py-1 font-mono text-[10px] text-zinc-500" title={file.path}>{file.name}</figcaption></figure>)}</div></div>}
      {texts.length > 0 && <div><div className="mb-1.5 text-[11px] text-zinc-500">Tệp khác ({texts.length})</div><div className="space-y-1.5">{texts.slice(0, 60).map((file) => <TextFile key={file.id} file={file} />)}</div></div>}
    </div>}
  </details>;
}

/** Everything the chosen op's jobs produced; `units` lets a ×N node narrow to one unit. */
export function ProofBody({ projectId, workflowId, target, labelOf }: { projectId: string; workflowId: string; target: ProofTarget; labelOf: (op: string) => string }) {
  const [unit, setUnit] = useState<number | null>(null);
  const [data, setData] = useState<OpProofs | null>(null);
  const [error, setError] = useState('');
  const chosen = unit == null ? null : target.units[unit];
  const op = chosen ? chosen.op : target.op;
  const jobIds = chosen ? chosen.jobIds : target.jobIds;
  const key = `${op}|${(jobIds ?? []).join(',')}`;
  useEffect(() => { setUnit(null); }, [target]);
  useEffect(() => {
    setData(null); setError('');
    if (!op || (jobIds && !jobIds.length)) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ project: projectId, workflow: workflowId, op, ...(jobIds ? { jobs: jobIds.join(',') } : {}) });
    fetch(`/api/proofs?${params}`, { signal: controller.signal, cache: 'no-store' })
      .then((response) => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json(); })
      .then((result: OpProofs) => setData(result)).catch((cause) => { if (!controller.signal.aborted) setError(String(cause)); });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, workflowId, key]);
  const slot = slotWait(target.units);
  return <div className="space-y-4">
    {op && <div className="font-mono text-xs text-sky-300">{op} · {labelOf(op)}</div>}
    {target.units.length > 1 && <div data-testid="proof-units">
      <div className="mb-1.5 text-[11px] text-zinc-500">{target.units.length} phần song song{slot ? ` · ${slot}` : ''} — chọn một phần để xem bằng chứng của riêng nó</div>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={() => setUnit(null)} className={`rounded-md border px-2 py-1 text-[11px] ${unit == null ? 'border-sky-500/60 bg-sky-500/10 text-sky-200' : 'border-zinc-800 text-zinc-400'}`}>Tất cả</button>
        {target.units.map((item, index) => { const mark = unitMark[unitState(item.status)]; return <button key={`${item.label}-${index}`} type="button" onClick={() => setUnit(index)} title={`${item.label}\n${item.jobId ?? 'chưa có job'} · ${item.status}${item.model ? ` · ${item.model}` : ''}${item.queuedBecause ? ` · ${item.queuedBecause}${item.ceiling ? ` (${item.slotsHeld ?? '?'}/${item.ceiling} slot)` : ''}` : ''}`}
          className={`max-w-full rounded-md border px-2 py-1 text-left text-[11px] ${unit === index ? 'border-sky-500/60 bg-sky-500/10 text-sky-200' : 'border-zinc-800 text-zinc-300 hover:border-zinc-600'}`}>
          <span className={mark.tone}>{mark.mark}</span> <span className="break-all">{item.label}</span><span className="block font-mono text-[10px] text-zinc-500">{item.jobId ?? 'chưa có job'} · {item.status}{item.model ? ` · ${item.model}` : ''}{item.queuedBecause ? ` · ${item.queuedBecause}${item.ceiling ? ` (${item.slotsHeld ?? '?'}/${item.ceiling} slot)` : ''}` : ''}</span></button>; })}
      </div>
    </div>}
    {op && <WorkflowEvents projectId={projectId} workflowId={workflowId} op={op} jobIds={jobIds} compact />}
    {op && <OpLiveLog workflowId={workflowId} op={op} jobIds={jobIds} />}
    {!op || (jobIds && !jobIds.length) ? <p className="text-sm text-zinc-500">Chưa có job nào chạy cho phần này nên chưa có bằng chứng.</p>
      : error ? <p className="text-sm text-red-400">Không đọc được bằng chứng: {error}</p>
        : !data ? <p className="flex items-center gap-2 text-sm text-zinc-500"><LoaderCircle className="size-4 animate-spin" />Đang đọc ledger và bằng chứng...</p>
          : data.jobs.length ? <div className="space-y-2">{data.jobs.map((job, index) => <JobSection key={job.jobId} projectId={projectId} job={job} open={index === 0 || data.jobs.length <= 2} />)}</div>
            : <p className="text-sm text-zinc-500">Ledger chưa có job nào của op này.</p>}
    <p className="text-[11px] leading-5 text-zinc-600">Chỉ hiện tệp mà report của chính các job này nêu tên, nằm trong .starciwork của repo; diff lấy từ commit job đã land. Chỉ đọc.</p>
  </div>;
}

/** The proof panel as a right-hand drawer (full width on a phone). */
export function ProofDrawer({ projectId, workflowId, target, onClose, labelOf }: { projectId: string; workflowId: string; target: ProofTarget | null; onClose: () => void; labelOf: (op: string) => string }) {
  return <DialogPrimitive.Root open={Boolean(target)} onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50" />
      <DialogPrimitive.Content className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[760px] flex-col border-l border-zinc-800 bg-[#0c0c0e] text-zinc-100 shadow-2xl outline-none" data-testid="proof-panel" aria-describedby={undefined}>
        <div className="flex items-start gap-3 border-b border-zinc-800 p-4"><div className="min-w-0 flex-1"><div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-500">Bằng chứng</div><DialogPrimitive.Title className="mt-1 break-words text-base font-semibold">{target?.title}</DialogPrimitive.Title></div>
          <DialogPrimitive.Close className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100" aria-label="Đóng"><X className="size-4" /></DialogPrimitive.Close></div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{target && <ProofBody projectId={projectId} workflowId={workflowId} target={target} labelOf={labelOf} />}</div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  </DialogPrimitive.Root>;
}
