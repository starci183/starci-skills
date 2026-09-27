import { useEffect, useMemo, useState } from 'react';
import { Activity, ArrowRight, CheckCircle2, CircleAlert, Clock3, Radio, ScrollText } from 'lucide-react';
import type { WorkflowEvent } from './types';

const names: Record<string, [string, string]> = {
  'job-enqueued': ['Xếp job vào hàng', 'Job queued'],
  'op-dispatched': ['Giao việc cho op', 'Operation dispatched'],
  'report-filed': ['Op nộp báo cáo', 'Operation filed report'],
  'kernel-transition-woken': ['Kernel nhận tín hiệu', 'Kernel received signal'],
  'report-consumed': ['Kernel đọc báo cáo', 'Kernel read report'],
  'checks-recorded': ['Ghi kết quả kiểm tra', 'Checks recorded'],
  'op-settled': ['Kernel chốt verdict', 'Kernel settled verdict'],
  'job-dropped': ['Job rời hàng chờ', 'Job removed from queue'],
  'work-graph-version': ['Cập nhật Work Graph', 'Work Graph updated'],
};
const toneOf = (event: WorkflowEvent) => event.verdict === 'fail' || event.verdict === 'blocked' || event.kind === 'job-dropped' ? 'red'
  : event.verdict === 'pass' ? 'green'
    : event.kind === 'kernel-transition-woken' ? 'sky' : 'zinc';
const tone: Record<string, string> = {
  red: 'border-red-500/30 bg-red-500/10 text-red-400', green: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  sky: 'border-sky-500/30 bg-sky-500/10 text-sky-400', zinc: 'border-zinc-700 bg-zinc-900 text-zinc-400',
};
const merge = (old: WorkflowEvent[], fresh: WorkflowEvent[]) => [...new Map([...old, ...fresh].map((event) => [event.seq, event])).values()].sort((a, b) => b.seq - a.seq).slice(0, 120);

/** Ledger events are durable. The SSE connection only transports new projections; a GET poll recovers missed events. */
export function WorkflowEvents({ projectId, workflowId, op, jobIds, onPick, compact = false }: {
  projectId: string; workflowId: string; op?: string | null; jobIds?: string[] | null;
  onPick?: (event: WorkflowEvent) => void; compact?: boolean;
}) {
  const [events, setEvents] = useState<WorkflowEvent[]>([]);
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);
  const [filter, setFilter] = useState<'all' | 'signals' | 'verdicts' | 'dispatch'>('all');
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ project: projectId, workflow: workflowId });
    let source: EventSource | null = null;
    const refresh = async () => {
      try {
        const response = await fetch(`/api/workflow-events?${params}`, { signal: controller.signal, cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const body = await response.json() as { events: WorkflowEvent[]; cursor: number };
        if (controller.signal.aborted) return;
        setEvents((current) => merge(current, body.events));
        setError('');
        if (!source) {
          params.set('after', String(body.cursor));
          source = new EventSource(`/api/workflow-events/stream?${params}`);
          source.onopen = () => setConnected(true);
          source.onerror = () => setConnected(false);
          source.onmessage = (message) => {
            try { setEvents((current) => merge(current, [JSON.parse(message.data) as WorkflowEvent])); }
            catch { /* A malformed transport frame cannot change a ledger event. */ }
          };
        }
      } catch (caught) {
        if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : String(caught));
      }
    };
    setEvents([]); setConnected(false);
    void refresh();
    const fallback = window.setInterval(() => { void refresh(); }, 15_000);
    return () => { controller.abort(); window.clearInterval(fallback); source?.close(); };
  }, [projectId, workflowId]);
  const visible = useMemo(() => events.filter((event) => (!op || event.op === op) && (!jobIds?.length || Boolean(event.jobId && jobIds.includes(event.jobId)))
    && (filter === 'all' || filter === 'signals' && event.kind === 'kernel-transition-woken' || filter === 'verdicts' && event.kind === 'op-settled' || filter === 'dispatch' && ['job-enqueued', 'op-dispatched'].includes(event.kind))).slice(0, compact ? 12 : 36), [events, op, jobIds, compact, filter]);
  const en = document.documentElement.lang === 'en';
  const actor = (value: string) => value === 'Owner' ? (en ? 'Owner' : 'Thầy') : value;
  return <section className="min-w-0" data-testid={compact ? 'op-events' : 'workflow-events'}>
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><ScrollText className="size-4 text-sky-400" /><h3 className="text-sm font-semibold">{en ? 'Ledger activity' : 'Nhật ký từ ledger'}</h3><span className="rounded border border-zinc-800 px-1.5 py-0.5 text-[10px] tabular-nums text-zinc-500">{visible.length}</span></div><div className="flex items-center gap-1.5 text-[11px] text-zinc-500"><span className={`size-1.5 rounded-full ${connected ? 'bg-emerald-400' : 'bg-zinc-600'}`} />{connected ? (en ? 'Live' : 'Trực tiếp') : (en ? 'Polling fallback' : 'Đang đồng bộ')}</div></div>
    {!compact && <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Lọc nhật ký workflow">{([['all', 'Tất cả', 'All'], ['signals', 'Tín hiệu vào Kernel', 'Kernel signals'], ['verdicts', 'Verdict', 'Verdicts'], ['dispatch', 'Giao việc', 'Dispatch']] as const).map(([id, vi, english]) => <button key={id} type="button" onClick={() => setFilter(id)} aria-pressed={filter === id} className={`rounded-md border px-2.5 py-1 text-[11px] ${filter === id ? 'border-sky-500/40 bg-sky-500/10 text-sky-200' : 'border-zinc-800 text-zinc-500 hover:border-zinc-600'}`}>{en ? english : vi}</button>)}</div>}
    {error && <p className="mb-2 rounded-md border border-amber-500/25 bg-amber-500/5 p-2 text-xs text-amber-300">{en ? 'Cannot read events' : 'Không đọc được event'}: {error}</p>}
    {!visible.length ? <p className="rounded-lg border border-dashed border-zinc-800 p-4 text-xs text-zinc-500">{en ? 'No ledger events in the recent window for this operation.' : 'Chưa có event trong cửa sổ gần đây của op này.'}</p>
      : <ol className={`relative space-y-2 overflow-y-auto pr-1 before:absolute before:bottom-4 before:left-[13px] before:top-4 before:w-px before:bg-zinc-800 ${compact ? 'max-h-[400px]' : 'max-h-[660px]'}`}>
        {visible.map((event) => {
          const shade = toneOf(event);
          const Icon = event.kind === 'kernel-transition-woken' ? Radio : event.verdict === 'pass' ? CheckCircle2 : shade === 'red' ? CircleAlert : event.kind === 'op-dispatched' ? ArrowRight : event.kind === 'job-enqueued' ? Clock3 : Activity;
          return <li key={event.seq} className="relative flex gap-3" data-event-kind={event.kind}>
            <span className={`relative z-10 flex size-7 shrink-0 items-center justify-center rounded-md border ${tone[shade]}`}><Icon className="size-3.5" /></span>
            <div className="min-w-0 flex-1 rounded-lg border border-zinc-800 bg-zinc-900/40 p-2.5">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1"><strong className="text-xs text-zinc-100">{names[event.kind]?.[en ? 1 : 0] || event.kind}</strong>{event.verdict && <span className={`rounded border px-1.5 text-[10px] ${tone[shade]}`}>{event.verdict}</span>}{event.outcome && <span className="text-[11px] text-zinc-400">{event.outcome}</span>}<time className="ml-auto text-[10px] tabular-nums text-zinc-600">{new Date(event.at).toLocaleString(en ? 'en-US' : 'vi-VN')}</time></div>
              <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px]"><span className="text-zinc-400">{actor(event.from)}</span><ArrowRight className="size-3 text-zinc-600" /><span className="text-sky-300">{actor(event.to)}</span>{event.kind === 'kernel-transition-woken' && event.delivery && <span className="rounded bg-sky-500/10 px-1.5 text-sky-400">{event.delivery === 'delivered' ? (en ? 'delivered' : 'đã chuyển') : event.delivery}</span>}{event.transition && <code className="rounded bg-zinc-800 px-1.5 text-zinc-400">{event.transition}</code>}</div>
              <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 font-mono text-[10px] text-zinc-600"><span>#{event.seq}</span>{event.jobId && (onPick ? <button type="button" onClick={() => onPick(event)} className="break-all text-left text-zinc-400 underline decoration-zinc-700 hover:text-sky-300">{event.jobId}</button> : <span className="break-all">{event.jobId}</span>)}{event.model && <span>{event.model}</span>}{event.version !== null && <span>v{event.version}</span>}</div>
            </div>
          </li>;
        })}
      </ol>}
    <p className="mt-2 text-[11px] leading-5 text-zinc-600">{en ? 'Source: read-only ledger. Terminal output is separate; only op-settled confirms a verdict.' : 'Nguồn: ledger chỉ đọc. Log terminal hiển thị riêng; chỉ op-settled xác nhận verdict.'}</p>
  </section>;
}
