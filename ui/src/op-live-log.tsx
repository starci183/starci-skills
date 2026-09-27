import { useEffect, useState } from 'react';
import { Radio, TerminalSquare } from 'lucide-react';
import type { AgentLog, AgentRow, AgentSnapshot } from './types';

/** Terminal screen is temporary activity, kept distinct from the durable ledger timeline. */
export function OpLiveLog({ workflowId, op, jobIds }: { workflowId: string; op: string; jobIds: string[] | null }) {
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [log, setLog] = useState<AgentLog | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    const refresh = async () => {
      try {
        const response = await fetch('/api/agents', { signal: controller.signal, cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const body = await response.json() as AgentSnapshot;
        if (!controller.signal.aborted) setAgents(body.agents.filter((agent) => agent.role === 'op' && agent.workflowId === workflowId && agent.op === op && (!jobIds?.length || jobIds.includes(agent.id))));
      } catch { if (!controller.signal.aborted) setAgents([]); }
    };
    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, 10_000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [workflowId, op, jobIds?.join(',')]);
  const active = agents.find((agent) => agent.terminal && agent.connected !== false) ?? null;
  useEffect(() => {
    if (!active?.terminal) { setLog(null); return; }
    const controller = new AbortController();
    const refresh = async () => {
      try {
        const response = await fetch(`/api/agents/${encodeURIComponent(active.terminal!)}/log`, { signal: controller.signal, cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const body = await response.json() as AgentLog;
        if (!controller.signal.aborted) { setLog(body); setError(''); }
      } catch (caught) { if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : String(caught)); }
    };
    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, 5_000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [active?.terminal]);
  if (!active) return null;
  const en = document.documentElement.lang === 'en';
  return <details className="rounded-lg border border-sky-500/20 bg-sky-500/[0.04] p-3" data-testid="op-live-log">
    <summary className="cursor-pointer list-none"><span className="flex flex-wrap items-center gap-2 text-xs"><Radio className="size-3.5 text-sky-400" /><strong className="text-zinc-200">{en ? 'Open terminal' : 'Terminal đang mở'}</strong><span className="text-zinc-500">{active.provider || 'Agent'} · {active.model || (en ? 'model unknown' : 'model chưa rõ')} · {active.activity === 'cooking' ? (en ? 'active' : 'đang cook') : (en ? 'no recent signal' : 'chưa có tín hiệu mới')}</span></span><span className="mt-1 block text-[11px] leading-5 text-zinc-500">{active.action}</span></summary>
    <div className="mt-3 border-t border-zinc-800 pt-3">{error && <p className="mb-2 text-xs text-amber-300">{error}</p>}{log?.events.length ? <ol className="space-y-1.5">{[...log.events].reverse().slice(0, 8).map((event) => <li key={`${event.line}-${event.kind}`} className="rounded-md border border-zinc-800 bg-zinc-950/60 p-2 text-[11px]"><span className="text-zinc-200">{event.title}</span>{event.detail && <code className="mt-1 block break-all text-zinc-500">{event.detail}</code>}</li>)}</ol> : <p className="text-xs text-zinc-500">{en ? 'No activity marker on the current terminal screen.' : 'Chưa có mốc hoạt động trên màn hình terminal.'}</p>}
      {log && <details className="mt-3"><summary className="flex cursor-pointer items-center gap-1 text-[11px] text-zinc-400"><TerminalSquare className="size-3" /> {en ? `Raw terminal (${log.lines.length} lines)` : `Xem terminal gốc (${log.lines.length} dòng)`}</summary><pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-all rounded bg-black p-2 font-mono text-[10px] leading-4 text-zinc-400">{log.lines.join('\n')}</pre></details>}
      <p className="mt-2 text-[10px] text-zinc-600">{en ? `Activity labels follow config.yaml (${log?.language || 'unknown'}). Terminal output does not confirm a verdict; the ledger does.` : `${log?.language === 'vi' ? 'Mốc được diễn giải tiếng Việt theo config.yaml.' : `Ngôn ngữ từ config.yaml: ${log?.language || 'chưa rõ'}.`} Terminal không xác nhận verdict; trạng thái cuối lấy từ ledger.`}</p>
    </div>
  </details>;
}
