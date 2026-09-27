import { useEffect, useRef, useState } from 'react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { ChevronRight, FileCode2, ListTree, LoaderCircle, Maximize2, Minimize2, Paperclip, ScrollText, X } from 'lucide-react';
import { OpStory, StorySection } from './op-story';
import { Badge } from '@/components/ui/badge';
import type { CommitPatch, JobProofs, OpProofs, ProofFile, Unit } from './types';
import { slotWait, unitMark, unitState } from './flow-dag';
import { WorkflowEvents } from './workflow-events';
import { OpLiveLog } from './op-live-log';
import { LogTimeline } from './log-timeline';
import { DiffViewer } from './diff-viewer';
import { ArtifactPanel } from './artifacts';

/** A unit the panel can narrow to: its op and the jobs whose proofs it shows. */
export interface ProofUnit extends Unit { op: string | null; jobIds: string[] }
export interface ProofTarget { title: string; op: string | null; jobIds: string[] | null; units: ProofUnit[] }

const when = (value: number | null | undefined) => (value ? new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' }).format(value) : '—');
const statusTone: Record<string, string> = {
  succeeded: 'border-emerald-500/30 text-emerald-400', failed: 'border-red-500/30 text-red-400', running: 'border-yellow-400/30 text-yellow-300',
  leased: 'border-yellow-400/30 text-yellow-300', answering: 'border-yellow-400/30 text-yellow-300', queued: 'border-zinc-600 text-zinc-400', cancelled: 'border-zinc-700 text-zinc-500',
};

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

const LIVE = new Set(['running', 'leased', 'answering']);
/** A log ref (an artifact path, repo-relative or absolute) as the URL of the job file it names, else null. */
const refResolver = (projectId: string, jobId: string, files: ProofFile[]) => (ref: string) => {
  const wanted = ref.replace(/\\/g, '/').toLowerCase();
  const own = files.find((file) => { const p = file.path.toLowerCase(); return p === wanted || wanted.endsWith(`/${p}`); })?.url;
  if (own) return own;
  // An image the job's own diff carries (its decoded literal, or the blob in the repository).
  return /\.(png|jpe?g|gif|webp|svg|avif)$/.test(wanted) ? `/api/diff/asset?${new URLSearchParams({ project: projectId, job: jobId, path: ref })}` : null;
};

function JobSection({ projectId, workflowId, job, open }: { projectId: string; workflowId: string; job: JobProofs; open: boolean }) {
  const images = job.files.filter((file) => file.kind === 'image');
  const videos = job.files.filter((file) => file.kind === 'video');
  const [hasDiff, setHasDiff] = useState(true);
  const [focus, setFocus] = useState<string | null>(null);
  const diffAnchor = useRef<HTMLDivElement | null>(null);
  const texts = job.files.filter((file) => (file.kind === 'patch' && !hasDiff) || file.kind === 'file').sort((a, b) => Number(b.kind === 'patch') - Number(a.kind === 'patch'));
  const [shown, setShown] = useState(open);
  const [codeOpen, setCodeOpen] = useState(false);
  const codeRef = useRef<HTMLDetailsElement | null>(null);
  const openFile = (path: string) => { if (path) setFocus(path); setCodeOpen(true); window.setTimeout(() => codeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80); };
  return <details open={open} className="rounded-lg border border-zinc-800 bg-zinc-900/30" onToggle={(event) => setShown((event.target as HTMLDetailsElement).open)} data-testid="proof-job">
    <summary className="cursor-pointer list-none p-3">
      <div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className={statusTone[job.status] ?? 'text-zinc-400'}>{job.status}</Badge>{job.verdict && <span className="text-xs text-zinc-300">verdict {job.verdict}</span>}<span className="font-mono text-[11px] text-zinc-500">{job.jobId}</span><span className="ml-auto text-[11px] text-zinc-500">{when(job.updatedAt)}</span></div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-zinc-500"><span>lần {job.attempt}</span>{job.model && <span>model {job.model}</span>}{job.cut && <span>cut {job.cut.id} · {job.cut.ordinal}/{job.cut.total}</span>}<span>{images.length} ảnh · {videos.length} video · {job.heads.length} commit · {texts.length} tệp</span></div>
      {job.title && <p className="mt-1 text-xs text-zinc-400">{job.title}</p>}
    </summary>
    {shown && <div className="space-y-3 border-t border-zinc-800 p-3">
      <OpStory projectId={projectId} workflowId={workflowId} job={job} onOpenFile={openFile} />
      {job.report && <StorySection icon={<ScrollText className="size-4 text-zinc-400" />} title="Báo cáo đầy đủ" note={`${job.report.outcome ?? '—'} · ${job.report.checks} check · ${when(job.report.filedAt)}`} testId="proof-report">
        <div className="space-y-1.5 text-xs leading-5">
          {job.report.summary && <p className="whitespace-pre-wrap break-words text-zinc-300">{job.report.summary}</p>}
          {job.report.rootCause && <p className="break-words text-zinc-400"><span className="text-red-300">Nguyên nhân gốc:</span> {job.report.rootCause}</p>}
          {job.report.nextStep && <p className="break-words text-zinc-400"><span className="text-sky-300">Bước tiếp:</span> {job.report.nextStep}</p>}
        </div></StorySection>}
      <StorySection icon={<ListTree className="size-4 text-zinc-400" />} title="Dòng thời gian" note="lệnh, check, tệp sửa, cảnh báo" open={LIVE.has(job.status) || job.status === 'failed'} testId="story-timeline">
        <LogTimeline projectId={projectId} workflowId={workflowId} jobIds={[job.jobId]} resolveRef={refResolver(projectId, job.jobId, job.files)} onOpenFile={hasDiff ? openFile : undefined} live={LIVE.has(job.status)} />
      </StorySection>
      <details ref={codeRef} open={codeOpen} onToggle={(event) => setCodeOpen((event.currentTarget as HTMLDetailsElement).open)} className="group scroll-mt-4 rounded-xl border border-zinc-800 bg-zinc-950/60" data-testid="story-code-diff">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-sm font-medium text-zinc-200"><ChevronRight className="size-4 text-zinc-500 transition-transform group-open:rotate-90" /><FileCode2 className="size-4 text-sky-400" />Code</summary>
        <div ref={diffAnchor} className="border-t border-zinc-800 p-3">{codeOpen && (hasDiff ? <DiffViewer projectId={projectId} jobId={job.jobId} focus={focus} onMissing={() => setHasDiff(false)} />
          : job.heads.map((head) => <CommitDiff key={head.sha} projectId={projectId} head={head} />))}</div>
      </details>
      <StorySection icon={<Paperclip className="size-4 text-zinc-400" />} title="Tất cả tệp bằng chứng" note="tệp gốc theo loại" testId="story-raw">
        <ArtifactPanel projectId={projectId} workflowId={workflowId} jobId={job.jobId} onOpenDiff={() => openFile('')} />
      </StorySection>
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
    {op && <OpLiveLog workflowId={workflowId} op={op} jobIds={jobIds} />}
    {!op || (jobIds && !jobIds.length) ? <p className="text-sm text-zinc-500">Chưa có job nào chạy cho phần này nên chưa có bằng chứng.</p>
      : error ? <p className="text-sm text-red-400">Không đọc được bằng chứng: {error}</p>
        : !data ? <p className="flex items-center gap-2 text-sm text-zinc-500"><LoaderCircle className="size-4 animate-spin" />Đang đọc ledger và bằng chứng...</p>
          : data.jobs.length ? (() => {
            // The present running attempt leads; otherwise show the newest settled attempt with evidence.
            const live = data.jobs.findIndex((job) => LIVE.has(job.status));
            const best = live >= 0 ? live : data.jobs.findIndex((job) => ['succeeded', 'failed'].includes(job.status) && (job.report || job.files.length));
            const openIndex = best >= 0 ? best : 0;
            return <div className="space-y-2">{data.jobs.map((job, index) => <JobSection key={job.jobId} projectId={projectId} workflowId={workflowId} job={job} open={index === openIndex || data.jobs.length === 1} />)}</div>;
          })()
            : <p className="text-sm text-zinc-500">Ledger chưa có job nào của op này.</p>}
    {op && <StorySection icon={<ScrollText className="size-4 text-zinc-400" />} title="Sự kiện ledger của op" note="xếp hàng, giao việc, verdict" testId="story-ledger-events"><WorkflowEvents projectId={projectId} workflowId={workflowId} op={op} jobIds={jobIds} compact /></StorySection>}
    <p className="text-[11px] leading-5 text-zinc-600">Chỉ hiện tệp mà report của chính các job này nêu tên, nằm trong .starciwork của repo; diff lấy từ commit job đã land. Chỉ đọc.</p>
  </div>;
}

/** The proof panel as a right-hand drawer (full width on a phone). */
export function ProofDrawer({ projectId, workflowId, target, onClose, labelOf }: { projectId: string; workflowId: string; target: ProofTarget | null; onClose: () => void; labelOf: (op: string) => string }) {
  const [wide, setWide] = useState(false);
  return <DialogPrimitive.Root open={Boolean(target)} onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50" />
      <DialogPrimitive.Content className={`fixed inset-y-0 right-0 z-50 flex w-full ${wide ? 'max-w-[1280px]' : 'max-w-[760px]'} flex-col border-l border-border bg-background text-foreground shadow-2xl outline-none`} data-testid="proof-panel" aria-describedby={undefined}>
        <div className="flex items-start gap-3 border-b border-zinc-800 p-4"><div className="min-w-0 flex-1"><div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-500">Bằng chứng</div><DialogPrimitive.Title className="mt-1 break-words text-base font-semibold">{target?.title}</DialogPrimitive.Title></div>
          <button type="button" onClick={() => setWide((v) => !v)} className="hidden rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 md:block" aria-label={wide ? 'Thu hẹp' : 'Mở rộng'} title={wide ? 'Thu hẹp' : 'Mở rộng'} data-testid="proof-wide">{wide ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}</button>
          <DialogPrimitive.Close className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100" aria-label="Đóng"><X className="size-4" /></DialogPrimitive.Close></div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{target && <ProofBody projectId={projectId} workflowId={workflowId} target={target} labelOf={labelOf} />}</div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  </DialogPrimitive.Root>;
}
