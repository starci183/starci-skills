import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ChevronRight, CircleAlert, ExternalLink } from 'lucide-react';
import type { AgentSnapshot, JobProofs, LogPage, LogRow, OpProofs, Snapshot, WorkflowEvents, WorkflowRow } from './contract';
import { ProofDrawer, type ProofTarget } from './proofs';
import { WorkGraphView, LegGraph } from './workflow-graph';
import { WorkflowEvents as RawEvents } from './workflow-events';
import { WorkflowAgents } from './agents';
import { ArtifactPanel } from './artifacts';
import { etaText, eventSentence, legState, opName, ownerItems, presentSentence, reportedCause, retryGroups, stageGroups, workflowName, type ItemState } from './workflow-tracker-model';

const fmt = (at: number | null | undefined) => at ? new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }).format(at) : 'Chưa rõ';
const elapsed = (at: number | null | undefined, now: number) => {
  if (!at) return 'chưa rõ';
  const mins = Math.max(0, Math.floor((now - at) / 60000));
  return mins < 1 ? 'dưới 1 phút' : mins < 60 ? `${mins} phút` : mins < 1440 ? `${Math.floor(mins / 60)} giờ ${mins % 60} phút` : `${Math.floor(mins / 1440)} ngày`;
};
const stateText: Record<ItemState, string> = { done: 'Đã xong', running: 'Đang làm', waiting: 'Đang chờ', attention: 'Cần xem lại' };
const stateMark: Record<ItemState, string> = { done: '✓', running: '◉', waiting: '○', attention: '!' };
const surface = 'rounded-xl border border-border bg-card/45';
const linkFocus = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';
const meaningful = new Set(['step.start', 'step.end', 'check.result', 'test.result', 'narration', 'decision', 'warning', 'error', 'render', 'video', 'trace', 'ask']);

function Prose({ children }: { children: string }) {
  const [open, setOpen] = useState(false);
  if (children.length <= 210) return <p className="break-words text-sm leading-6">{children}</p>;
  return <div><p className={`break-words text-sm leading-6 ${open ? '' : 'line-clamp-3'}`}>{children}</p><button type="button" className={`mt-1 text-xs font-medium underline underline-offset-2 ${linkFocus}`} aria-expanded={open} onClick={() => setOpen((value) => !value)}>{open ? 'Thu gọn' : 'Xem đầy đủ'}</button></div>;
}

function useEvidence(wf: WorkflowRow, updatedAt: number) {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [proofs, setProofs] = useState<Record<string, JobProofs[]>>({});
  const [events, setEvents] = useState<WorkflowEvents['events']>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [logsReady, setLogsReady] = useState(false);
  const [eventsReady, setEventsReady] = useState(false);
  const [proofsReady, setProofsReady] = useState(false);
  const ops = useMemo(() => [...new Set(wf.legs.map((leg) => leg.op))], [wf.legs]);
  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({ project: wf.projectId, workflow: wf.id });
    const get = async <T,>(url: string): Promise<T> => { const response = await fetch(url, { signal: controller.signal, cache: 'no-store' }); if (!response.ok) throw new Error(`${response.status}`); return response.json() as Promise<T>; };
    setErrors([]); setLogsReady(false); setEventsReady(false); setProofsReady(false);
    void get<LogPage>(`/api/logs?${query}&limit=500`).then((body) => setLogs(body.rows)).catch(() => { if (!controller.signal.aborted) setErrors((old) => [...old, 'nhật ký']); }).finally(() => { if (!controller.signal.aborted) setLogsReady(true); });
    void get<WorkflowEvents>(`/api/workflow-events?${query}`).then((body) => setEvents(body.events)).catch(() => { if (!controller.signal.aborted) setErrors((old) => [...old, 'lịch sử']); }).finally(() => { if (!controller.signal.aborted) setEventsReady(true); });
    void Promise.all(ops.map(async (op) => {
      try { const body = await get<OpProofs>(`/api/proofs?${query}&op=${encodeURIComponent(op)}`); return [op, body.jobs] as const; }
      catch { return [op, null] as const; }
    })).then((pairs) => {
      if (controller.signal.aborted) return;
      setProofs(Object.fromEntries(pairs.filter((pair) => pair[1] !== null)));
      setProofsReady(true);
      if (pairs.some((pair) => pair[1] === null)) setErrors((old) => [...old, 'bằng chứng']);
    });
    return () => controller.abort();
  }, [wf.id, wf.projectId, ops, updatedAt]);
  return { logs, proofs, events, errors, logsReady, eventsReady, proofsReady };
}

function ActivityHistory({ events, logs, loading }: { events: WorkflowEvents['events']; logs: LogRow[]; loading: boolean }) {
  const [technical, setTechnical] = useState(false);
  const rows = [
    ...events.filter((event) => ['op-dispatched', 'report-filed', 'op-settled', 'work-graph-version'].includes(event.kind)).map((event) => ({ id: `e${event.seq}`, at: event.at, op: event.op || '', text: eventSentence(event), source: 'Sổ sự kiện', actor: event.from })),
    ...logs.filter((row) => ['check.result', 'test.result', 'land'].includes(row.kind)).map((row) => ({ id: `l${row.seq}`, at: row.at, op: '', text: row.msg, source: 'Nhật ký', actor: row.actor })),
  ].sort((a, b) => b.at - a.at);
  const seen = new Set<string>();
  const visible = rows.filter((row) => { const key = `${row.op}|${row.text}`; if (seen.has(key)) return false; seen.add(key); return true; }).slice(0, 16);
  return <section aria-labelledby="activity-title" className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-2"><h2 id="activity-title" className="text-xl font-semibold">Diễn biến gần đây</h2><button type="button" aria-expanded={technical} onClick={() => setTechnical((value) => !value)} className={`rounded-md px-2 py-1 text-xs underline underline-offset-2 ${linkFocus}`}>{technical ? 'Ẩn sự kiện kỹ thuật' : 'Hiện sự kiện kỹ thuật'}</button></div>
    {visible.length ? <ol className={`${surface} divide-y divide-border px-4`}>{visible.map((row) => <li key={row.id} className="flex flex-wrap gap-x-3 gap-y-1 py-2.5 text-sm"><span className="min-w-0 flex-1">{row.text}</span><time className="text-xs text-muted-foreground">{fmt(row.at)}</time><span className="w-full text-[11px] text-muted-foreground">{row.actor} · {row.source}</span></li>)}</ol> : <p className="text-sm text-muted-foreground">{loading ? 'Đang đọc diễn biến gần đây...' : 'Chưa có diễn biến được ghi nhận.'}</p>}
    {technical && <ol className={`${surface} divide-y divide-border px-4`}>{events.filter((event) => ['job-enqueued', 'job-dropped', 'kernel-transition-woken', 'report-consumed', 'checks-recorded'].includes(event.kind)).map((event) => <li key={event.seq} className="py-2 text-xs"><span>{event.kind === 'job-enqueued' ? 'Đưa vào hàng chờ' : event.kind === 'job-dropped' ? 'Rời hàng chờ' : event.kind === 'kernel-transition-woken' ? 'Chuyển tín hiệu' : event.kind === 'report-consumed' ? 'Đã đọc báo cáo' : 'Đã ghi kiểm tra'} · {opName(event.op || '')}</span><span className="ml-2 text-muted-foreground">{fmt(event.at)} · {event.from}</span></li>)}</ol>}
  </section>;
}

export function WorkflowTracker({ data, agents, id, snapshotError }: { data: Snapshot; agents: AgentSnapshot | null; id: string; snapshotError?: string | null }) {
  const wf = data.projects.flatMap((project) => project.workflows).find((item) => item.id === id);
  if (!wf) return <div><a href="#/workflows" className="underline">Luồng việc</a><p>Không tìm thấy luồng việc này.</p></div>;
  return <TrackerBody key={wf.id} wf={wf} data={data} agents={agents} snapshotError={snapshotError} />;
}

function TrackerBody({ wf, data, agents, snapshotError }: { wf: WorkflowRow; data: Snapshot; agents: AgentSnapshot | null; snapshotError?: string | null }) {
  const [target, setTarget] = useState<ProofTarget | null>(null);
  const [now, setNow] = useState(Date.now());
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  useEffect(() => { const id = window.setInterval(() => setNow(Date.now()), 30000); return () => window.clearInterval(id); }, []);
  const evidence = useEvidence(wf, data.updatedAt);
  const groups = stageGroups(wf);
  const owner = ownerItems(wf);
  const sourceError = data.sources[`status:${wf.id}`] || data.projects.find((project) => project.id === wf.projectId)?.error;
  const stale = now - data.updatedAt > 120000;
  const confirmed = !sourceError && !snapshotError && !stale && Boolean(wf.frontier);
  const sentence = presentSentence(wf, confirmed);
  const blockers = [
    ...(wf.frontier?.peerWaits || []).map((wait, index) => ({ key: `peer-${index}`, title: 'Chờ luồng việc khác', text: wait.reason || `Chờ ${wait.peer}.`, next: `Luồng ${wait.peer} cần hoàn tất việc liên quan.` })),
    ...wf.holds.map((hold, index) => ({ key: `hold-${index}`, title: `Chờ ${opName(hold.op)}`, text: hold.reason, next: hold.peer ? `Luồng ${hold.peer} cần xử lý tiếp.` : 'Đang chờ điều kiện tiếp tục.' })),
    ...wf.incidents.filter((incident) => !/^\[owner-gate\]/i.test(incident.text) && !(incident.op && wf.running.some((job) => job.op === incident.op)))
      .map((incident) => ({ key: incident.id, title: 'Sự cố đang mở', text: /^\[runtime-defect\]/i.test(incident.text) ? 'Công cụ chạy công việc gặp lỗi; đang chờ runtime xử lý.' : 'Hệ thống ghi nhận một sự cố cần xem xét.', original: incident.text, next: /^\[runtime-defect\]/i.test(incident.text) ? 'Runtime cần sửa lỗi.' : 'Người xử lý tiếp chưa được ghi rõ.' })),
  ];
  const openOp = (op: string, jobId?: string) => setTarget({ title: opName(op), op, jobIds: jobId ? [jobId] : null, units: [] });
  const jump = (name: string) => { const node = sectionRefs.current[name]; node?.scrollIntoView({ behavior: 'smooth', block: 'start' }); node?.focus({ preventScroll: true }); };
  const eta = confirmed ? etaText(wf, now, fmt) : wf.etaAt == null ? 'Chưa có ước tính' : `Ước tính theo bản gần nhất: ${fmt(wf.etaAt)}`;
  return <div className="min-w-0 space-y-7" data-testid="workflow-tracker">
    <header className="space-y-3"><a href="#/workflows" className={`inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground ${linkFocus}`}><ArrowLeft className="size-3.5" /> Luồng việc</a><div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><p className="text-xs font-medium text-muted-foreground">{data.projects.find((project) => project.id === wf.projectId)?.name || wf.projectId}</p><h1 className="mt-1 break-words text-2xl font-semibold tracking-tight md:text-3xl">{workflowName(wf)}</h1></div><time className="text-xs text-muted-foreground">Cập nhật lúc {fmt(data.updatedAt)}</time></div>
      <p className="max-w-5xl break-words text-lg font-medium leading-7 md:text-xl" aria-live="polite" aria-atomic="true">{sentence}</p>
      <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground"><span>{confirmed ? '' : 'Theo bản gần nhất: '}{wf.running.length} đang làm · {wf.queued.length} đang chờ · {owner.length} việc cần thầy</span><span>{eta}</span></p>
      {(stale || !confirmed || evidence.errors.length > 0) && <p className="flex items-start gap-2 text-xs text-muted-foreground"><CircleAlert className="mt-0.5 size-3.5 shrink-0" />{snapshotError ? 'Đang xem bản lưu gần nhất. ' : ''}{stale ? `Thông tin đã cũ ${elapsed(data.updatedAt, now)}. ` : ''}{!confirmed ? 'Chưa xác nhận được nguồn trạng thái. ' : ''}{evidence.errors.length ? `Chưa đọc được ${[...new Set(evidence.errors)].join(', ')}.` : ''}</p>}
    </header>

    <div className="flex flex-col gap-6">
    <section aria-labelledby="stages-title" className="order-2 space-y-2 lg:order-1"><h2 id="stages-title" className="text-sm font-semibold">Các phần công việc</h2><div className="flex flex-wrap gap-2">{groups.map((group) => <button key={group.name} type="button" onClick={() => jump(group.name)} className={`${surface} ${linkFocus} min-w-[135px] px-3 py-2 text-left transition-colors hover:bg-accent`}><span className="block text-sm font-medium">{group.name} · {group.running ? 'Đang làm' : group.attention ? 'Cần xem lại' : group.waiting ? 'Đang chờ' : 'Đã xong'}</span><span className="block text-[11px] text-muted-foreground">{group.done} xong · {group.running} làm · {group.waiting} chờ{group.attention ? ` · ${group.attention} xem lại` : ''}</span></button>)}</div><p className="text-[11px] text-muted-foreground">{confirmed ? 'Các phần có thể diễn ra song song.' : 'Trạng thái các phần lấy từ bản gần nhất; chưa xác nhận được hiện tại.'}</p></section>

    <div className="order-1 grid items-start gap-3 lg:order-2 lg:grid-cols-[1.15fr_1fr_1fr]">
      <section aria-labelledby="owner-title" className={`order-first ${confirmed && owner.length ? 'rounded-xl border border-amber-600/35 bg-amber-500/[0.06] p-4' : `${surface} p-4`}`}><h2 id="owner-title" className="mb-2 text-base font-semibold">Thầy cần làm</h2>{confirmed && owner.length ? <ol className="space-y-3">{owner.map((item) => <li key={item.key} className="border-t border-border pt-2 first:border-0 first:pt-0"><Prose>{item.text}</Prose><p className="mt-1 text-xs text-muted-foreground">Nguồn: {item.source}</p>{item.link ? <a href={item.link} target={item.link.startsWith('#') ? undefined : '_blank'} rel="noreferrer" className={`mt-1 inline-flex items-center gap-1 text-xs font-medium underline underline-offset-2 ${linkFocus}`}>Mở nơi trả lời <ExternalLink className="size-3" /></a> : <p className="mt-1 text-xs text-muted-foreground">Trả lời trong kênh giám sát của luồng việc.</p>}{item.original && <details className="mt-2 text-xs text-muted-foreground"><summary className="cursor-pointer">Lý do nguyên văn</summary><p className="mt-1 break-words">{item.original}</p></details>}</li>)}</ol> : <p className="text-sm text-muted-foreground">{confirmed ? 'Hiện thầy chưa có quyết định cần đưa ra.' : 'Chưa xác nhận được yêu cầu hiện tại; xem bản ghi gần nhất trong chi tiết kỹ thuật.'}</p>}</section>
      <section aria-labelledby="running-title" className={`${surface} p-4`}><h2 id="running-title" className="mb-2 text-base font-semibold">Đang làm</h2>{confirmed && wf.running.length ? <ul className="space-y-3">{wf.running.map((job) => { const latest = evidence.logs.filter((row) => row.jobId === job.jobId && meaningful.has(row.kind)).at(-1); const agent = agents?.agents.find((item) => item.id === job.jobId); return <li key={job.jobId} className="border-t border-border pt-2 first:border-0 first:pt-0"><button type="button" onClick={() => openOp(job.op, job.jobId)} className={`text-left text-sm font-medium underline-offset-2 hover:underline ${linkFocus}`}>{opName(job.op)} <ChevronRight className="inline size-3" /></button><p className="text-xs text-muted-foreground">Lần {job.attempt} · đã {elapsed(job.since, now)}</p><p className="mt-1 break-words text-sm">{latest?.msg || (evidence.logsReady ? 'Chưa có cập nhật công việc trong nhật ký.' : 'Đang đọc nhật ký...')}</p>{agent && <p className="mt-1 text-[11px] text-muted-foreground">{agent.provider || 'Agent'} · {agent.model || 'chưa rõ model'}{agent.cut ? ` · phần ${agent.cut.ordinal}/${agent.cut.total}` : ''}</p>}</li>; })}</ul> : <p className="text-sm text-muted-foreground">{confirmed ? 'Chưa có việc đang chạy.' : 'Chưa xác nhận được việc đang chạy.'}</p>}</section>
      <section aria-labelledby="blockers-title" className={`${surface} p-4`}><h2 id="blockers-title" className="mb-2 text-base font-semibold">Vướng</h2>{confirmed && blockers.length ? <ul className="space-y-3">{blockers.map((item) => <li key={item.key} className="border-t border-border pt-2 first:border-0 first:pt-0"><strong className="text-sm font-medium">{item.title}</strong><Prose>{item.text}</Prose><p className="mt-1 text-xs text-muted-foreground">Tiếp theo: {item.next}</p>{'original' in item && typeof item.original === 'string' && <details className="mt-2 text-xs text-muted-foreground"><summary className="cursor-pointer">Lý do nguyên văn</summary><p className="mt-1 break-words">{item.original}</p></details>}</li>)}</ul> : <p className="text-sm text-muted-foreground">{confirmed ? 'Chưa có vướng mắc đang mở được xác nhận.' : 'Chưa xác nhận được vướng mắc hiện tại.'}</p>}</section>
    </div>
    </div>

    {Object.entries(evidence.proofs).some(([, jobs]) => jobs.length > 1) && <section aria-labelledby="retry-title" className="space-y-3"><h2 id="retry-title" className="text-xl font-semibold">Các lần làm lại</h2><div className="grid gap-3 md:grid-cols-2">{Object.entries(evidence.proofs).filter(([, jobs]) => jobs.length > 1).map(([op, jobs]) => <div key={op} className={`${surface} min-w-0 p-4`}><h3 className="font-medium">{opName(op)} · {jobs.length >= 16 ? 'ít nhất 16' : jobs.length} lần</h3><ol className="mt-2 space-y-2">{retryGroups(jobs).map((group) => { const last = group.jobs.at(-1)!; return <li key={group.first} className="min-w-0 border-t border-border pt-2 text-sm"><strong className="font-medium">Lần {group.first}{group.last > group.first ? `–${group.last}` : ''}: {group.verdict === 'pass' || group.verdict === 'succeeded' ? 'đạt' : group.verdict === 'running' ? 'đang làm' : group.verdict === 'cancelled' ? 'đã hủy' : group.verdict === 'queued' ? 'đang chờ' : 'chưa đạt'}</strong><p className="mt-1 break-words text-xs text-muted-foreground">{reportedCause(last)}</p>{last.report?.summary && /unchanged|unrepaired|cause unchanged/i.test(last.report.summary) && <p className="mt-1 text-xs text-muted-foreground">Báo cáo ghi lỗi cũ chưa được sửa.</p>}{group.cause && <details className="mt-1 text-xs text-muted-foreground"><summary className="cursor-pointer">Nguyên nhân đầy đủ</summary><p className="mt-1 [overflow-wrap:anywhere]">{group.cause}</p></details>}</li>; })}</ol><button type="button" onClick={() => openOp(op)} className={`mt-3 text-xs font-medium underline underline-offset-2 ${linkFocus}`}>Xem từng lần và bằng chứng</button></div>)}</div></section>}

    <section aria-labelledby="items-title" className="space-y-3"><h2 id="items-title" className="text-xl font-semibold">Công việc theo phần</h2>{groups.map((group) => <div key={group.name} ref={(node) => { sectionRefs.current[group.name] = node; }} tabIndex={-1} className={`${surface} scroll-mt-24 p-4 focus:outline-2 focus:outline-offset-2 focus:outline-ring`}><div className="mb-2 flex flex-wrap items-baseline justify-between gap-2"><h3 className="text-base font-semibold">{group.name}</h3><span className="text-xs text-muted-foreground">{group.done} xong · {group.running} đang làm · {group.waiting + group.attention} chờ/xem lại</span></div><ul className="divide-y divide-border">{group.legs.map((leg) => { const status = legState(wf, leg); const jobs = evidence.proofs[leg.op] || []; const active = wf.running.find((job) => job.op === leg.op); const recent = jobs[0]; const at = active?.since || recent?.updatedAt || leg.since; return <li key={leg.op}><button type="button" onClick={() => openOp(leg.op)} className={`flex w-full flex-wrap items-center gap-x-3 gap-y-1 py-2 text-left hover:bg-accent ${linkFocus}`}><span className="min-w-0 flex-1 text-sm font-medium">{opName(leg.op)}</span><span className="text-xs">{stateMark[status]} {stateText[status]}</span><span className="text-xs text-muted-foreground">{leg.op in evidence.proofs ? jobs.length >= 16 ? 'Ít nhất 16' : jobs.length : evidence.proofsReady ? 'Chưa rõ' : 'Đang đọc'} lần</span><time className="text-xs text-muted-foreground">{fmt(at)}</time><ChevronRight className="size-3.5 text-muted-foreground" /></button></li>; })}</ul></div>)}</section>

    <ActivityHistory events={evidence.events} logs={evidence.logs} loading={!evidence.eventsReady || !evidence.logsReady} />
    <details className={`${surface} group p-4`}><summary className={`cursor-pointer text-base font-semibold ${linkFocus}`}>Chi tiết kỹ thuật</summary><div className="mt-5 space-y-6 border-t border-border pt-5"><p className="break-all text-xs text-muted-foreground">{wf.id} · {wf.frontier?.reason || 'Không có lý do chi tiết.'}</p><WorkflowAgents data={agents} workflowId={wf.id} />{wf.workGraph && <div><h3 className="mb-2 font-medium">Sơ đồ công việc</h3><WorkGraphView wf={wf as unknown as import('./types').WorkflowRow} graph={wf.workGraph as unknown as import('./types').WorkGraph} labelOf={opName} timeOf={fmt} /></div>}<details><summary className="cursor-pointer text-sm">Chuỗi công việc và đơn vị</summary><LegGraph wf={wf as unknown as import('./types').WorkflowRow} labelOf={opName} ageOf={(at) => elapsed(at, now)} /></details><details><summary className="cursor-pointer text-sm">Sự kiện gốc</summary><RawEvents projectId={wf.projectId} workflowId={wf.id} onPick={(event) => { if (event.op) openOp(event.op, event.jobId || undefined); }} /></details><details><summary className="cursor-pointer text-sm">Tất cả tệp và hình</summary><ArtifactPanel projectId={wf.projectId} workflowId={wf.id} /></details><details><summary className="cursor-pointer text-sm">Dữ liệu chẩn đoán</summary><pre className="max-h-80 overflow-auto whitespace-pre-wrap break-all text-xs">{JSON.stringify(wf, null, 2)}</pre></details></div></details>
    <ProofDrawer projectId={wf.projectId} workflowId={wf.id} target={target} onClose={() => setTarget(null)} labelOf={opName} />
  </div>;
}
