import { useEffect, useState } from 'react';
import { Activity, ArrowRight, CheckCircle2, CircleAlert, Cpu, FilePenLine, HardDrive, Radio, Search, ScrollText, TerminalSquare } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { AgentChanges, AgentLog, AgentProvider, AgentRow, AgentSnapshot } from './types';

const providers: AgentProvider[] = ['qwen', 'devin', 'claude', 'codex'];
const brands: Record<AgentProvider, { name: string; logo: string; tint: string }> = {
  qwen: { name: 'Qwen', logo: '/logos/qwen.png', tint: 'bg-violet-500/10' },
  devin: { name: 'Devin', logo: '/logos/devin.svg', tint: 'bg-zinc-200' },
  claude: { name: 'Claude', logo: '/logos/claude.png', tint: 'bg-orange-500/10' },
  codex: { name: 'Codex', logo: '/logos/codex.png', tint: 'bg-sky-500/10' },
};
const memory = (bytes: number | null) => bytes === null ? '—' : bytes >= 1024 ** 3
  ? `${(bytes / 1024 ** 3).toFixed(1)} GB` : `${Math.round(bytes / 1024 ** 2)} MB`;
const activityText: Record<AgentRow['activity'], string> = {
  cooking: 'Đang cook', idle: 'Mở · chưa có tín hiệu', unknown: 'Chưa xác minh', disconnected: 'Mất kết nối',
};
const activityTone: Record<AgentRow['activity'], string> = {
  cooking: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400',
  idle: 'border-zinc-700 bg-zinc-800/50 text-zinc-400',
  unknown: 'border-amber-500/25 bg-amber-500/10 text-amber-400',
  disconnected: 'border-red-500/25 bg-red-500/10 text-red-400',
};

function AgentLogo({ provider, cooking = false, small = false }: { provider: AgentProvider; cooking?: boolean; small?: boolean }) {
  const brand = brands[provider];
  return <span className={`agent-logo ${small ? 'agent-logo--small' : ''} ${cooking ? 'agent-logo--active' : ''} ${brand.tint}`}>
    <img src={brand.logo} alt={`${brand.name} logo`} className={`${small ? 'size-4' : 'size-7'} object-contain`} />
  </span>;
}

export function AgentBadges({ data, workflowId }: { data: AgentSnapshot | null; workflowId: string }) {
  const linked = data?.agents.filter((agent) => agent.workflowId === workflowId && agent.connected) || [];
  if (!linked.length) return <span className="text-xs text-zinc-600">—</span>;
  return <div className="flex items-center gap-1.5" title={linked.map((agent) => `${agent.provider || 'Agent'} · ${agent.model || 'model chưa rõ'} · ${activityText[agent.activity]}`).join('\n')}>
    {linked.slice(0, 3).map((agent) => agent.provider && <AgentLogo key={agent.id} provider={agent.provider} cooking={agent.activity === 'cooking'} small />)}
    {linked.length > 3 && <span className="text-xs text-zinc-500">+{linked.length - 3}</span>}
  </div>;
}

export function WorkflowAgents({ data, workflowId }: { data: AgentSnapshot | null; workflowId: string }) {
  const [selected, setSelected] = useState<AgentRow | null>(null);
  const [selectedChanges, setSelectedChanges] = useState<AgentRow | null>(null);
  const linked = data?.agents.filter((agent) => agent.workflowId === workflowId) || [];
  const kernels = linked.filter((agent) => agent.role === 'kernel');
  const workers = linked.filter((agent) => agent.role !== 'kernel');
  return <section className="space-y-5"><div><div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Thực thi cục bộ</div><h2 className="text-xl font-semibold">Ai điều phối, ai thực thi?</h2><p className="mt-1 text-sm text-zinc-500">Kernel quản lý luồng. Mỗi op worker làm một nhiệm vụ và báo kết quả riêng.</p></div>
    <div className="grid gap-5 lg:grid-cols-[minmax(0,.85fr)_minmax(0,1.15fr)]"><div className="min-w-0"><SectionHeading title="Kernel điều phối" count={kernels.length} note="Theo dõi và quyết định bước tiếp theo" /><div className="space-y-3">{kernels.length ? kernels.map((agent) => <KernelCard key={agent.id} agent={agent} onOpenLog={setSelected} />) : <EmptyAgents text="Chưa thấy terminal Kernel của luồng này." />}</div></div>
    <div className="min-w-0"><SectionHeading title="Op đang thực thi" count={workers.length} note="Hành động cụ thể từ job đang chạy" /><div className="grid gap-3 2xl:grid-cols-2">{workers.length ? workers.map((agent) => <AgentCard key={agent.id} agent={agent} onOpenLog={setSelected} onOpenChanges={setSelectedChanges} />) : <EmptyAgents text="Chưa có op worker đang chạy." />}</div></div></div>
    <AgentLogDialog agent={selected} onClose={() => setSelected(null)} />
    <AgentChangesDialog agent={selectedChanges} onClose={() => setSelectedChanges(null)} />
  </section>;
}

function SectionHeading({ title, count, note }: { title: string; count: number; note: string }) {
  return <div className="mb-3 flex flex-wrap items-end justify-between gap-2 border-b border-zinc-800 pb-2"><div className="flex items-center gap-2"><h3 className="text-sm font-semibold text-zinc-200">{title}</h3><span className="rounded-md bg-zinc-800 px-1.5 py-0.5 text-[11px] tabular-nums text-zinc-400">{count}</span></div><span className="text-xs text-zinc-600">{note}</span></div>;
}
function EmptyAgents({ text }: { text: string }) { return <div className="rounded-xl border border-dashed border-zinc-800 p-5 text-sm text-zinc-500">{text}</div>; }

export function AgentOverview({ data, open }: { data: AgentSnapshot | null; open: () => void }) {
  return <section>
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Máy này</div><h2 className="text-xl font-semibold tracking-tight">Agent đang hoạt động</h2><p className="mt-1 text-sm text-zinc-500">Bốn loại agent, model và tài nguyên tiến trình.</p></div><Button variant="outline" size="sm" onClick={open}>Xem agent <ArrowRight /></Button></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{providers.map((provider) => {
      const group = data?.groups[provider];
      return <Card key={provider} className="border border-zinc-800/80 bg-zinc-950/80 shadow-none"><CardContent className="flex items-center gap-4">
        <AgentLogo provider={provider} cooking={Boolean(group?.cooking)} />
        <div className="min-w-0"><div className="font-medium">{brands[provider].name}</div><div className="mt-1 text-xs text-zinc-500">{group ? `${group.cooking} đang cook · ${group.terminals} terminal` : 'Đang tải...'}</div><div className="mt-1 text-xs tabular-nums text-zinc-400">{group ? `${group.cpuPercent === null ? '—' : `${group.cpuPercent}%`} CPU · ${memory(group.ramBytes)} RAM` : '—'}</div></div>
      </CardContent></Card>;
    })}</div>
    <p className="mt-2 text-xs text-zinc-600">CPU/RAM là tổng tiến trình cùng loại trên máy; Orca chưa cung cấp PID để gán số đo cho từng terminal.</p>
  </section>;
}

function AgentMark({ agent }: { agent: AgentRow }) {
  return agent.provider ? <AgentLogo provider={agent.provider} cooking={agent.activity === 'cooking'} />
    : <span className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900"><Radio className="size-5 text-zinc-500" /></span>;
}
function KernelCard({ agent, onOpenLog }: { agent: AgentRow; onOpenLog: (agent: AgentRow) => void }) {
  return <Card className="border border-zinc-800 bg-gradient-to-r from-zinc-900/70 to-zinc-950 shadow-none"><CardContent className="flex flex-wrap items-center gap-4 py-5">
    <AgentMark agent={agent} />
    <div className="min-w-[220px] flex-1"><div className="flex flex-wrap items-center gap-2"><span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Kernel</span><Badge variant="outline" className={activityTone[agent.activity]}>{activityText[agent.activity]}</Badge></div><div className="mt-1 text-base font-semibold text-zinc-100">{agent.action}</div><div className="mt-1 text-xs text-zinc-500">{agent.projectName || 'Ngoài dự án'} · {agent.provider ? brands[agent.provider].name : 'Agent chưa rõ'} · {agent.model || 'Model chưa xác minh'}</div></div>
    <Button variant="outline" size="sm" disabled={!agent.terminal || agent.connected === false} onClick={() => onOpenLog(agent)}><ScrollText className="size-4" /> Nhật ký Kernel</Button>
  </CardContent></Card>;
}
function AgentCard({ agent, onOpenLog, onOpenChanges }: { agent: AgentRow; onOpenLog: (agent: AgentRow) => void; onOpenChanges: (agent: AgentRow) => void }) {
  return <Card className="border border-zinc-800/80 bg-zinc-950/80 shadow-none"><CardContent className="flex h-full flex-col gap-3">
    <div className="flex items-start gap-3"><AgentMark agent={agent} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><strong className="text-sm">{agent.provider ? brands[agent.provider].name : 'Agent chưa rõ'}</strong><Badge variant="outline" className={activityTone[agent.activity]}>{activityText[agent.activity]}</Badge></div><div className="mt-1 text-xs text-zinc-500">{agent.model || 'Model chưa xác minh'} · {agent.projectName || 'Ngoài dự án'}</div></div></div>
    <div className="flex-1"><div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-600">Hành động đang làm</div><h3 className="mt-1 line-clamp-3 text-sm font-medium leading-5 text-zinc-100" title={agent.action}>{agent.action}</h3><div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-500">{agent.op && <code className="rounded bg-zinc-900 px-1.5 py-0.5 text-zinc-400">{agent.op}</code>}{agent.attempt !== null && <span>lần {agent.attempt}</span>}{agent.cut && <span>· chặng {agent.cut.ordinal}/{agent.cut.total}</span>}</div></div>
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-800 pt-3"><span className="min-w-0 truncate text-[11px] text-zinc-600">{agent.workflowName || 'Ngoài workflow StarCi'}</span><div className="flex gap-2">{agent.role === 'op' && <Button variant="outline" size="sm" className="h-8 shrink-0 text-xs" onClick={() => onOpenChanges(agent)}><FilePenLine className="size-3.5" /> Diff & ảnh</Button>}<Button variant="outline" size="sm" className="h-8 shrink-0 text-xs" disabled={!agent.terminal || agent.connected === false} onClick={() => onOpenLog(agent)}><ScrollText className="size-3.5" /> Nhật ký</Button></div></div>
  </CardContent></Card>;
}

function AgentLogDialog({ agent, onClose }: { agent: AgentRow | null; onClose: () => void }) {
  const [log, setLog] = useState<AgentLog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'activity' | 'raw'>('activity');
  useEffect(() => {
    if (!agent?.terminal) return;
    const controller = new AbortController();
    const handle = agent.terminal;
    setLog(null);
    setError(null);
    setView('activity');
    const refresh = async () => {
      try {
        const response = await fetch(`/api/agents/${encodeURIComponent(handle)}/log`, { signal: controller.signal, cache: 'no-store' });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Không đọc được log');
        if (!controller.signal.aborted) { setLog(body as AgentLog); setError(null); }
      } catch (caught) {
        if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : 'Không đọc được log');
      }
    };
    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, 5_000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [agent?.terminal]);
  return <Dialog open={Boolean(agent)} onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className="flex max-h-[90vh] w-[calc(100vw-2rem)] max-w-none flex-col gap-0 overflow-hidden border border-zinc-700 bg-zinc-950 p-0 text-zinc-100 shadow-2xl sm:max-w-[960px]">
      <DialogHeader className="border-b border-zinc-800 bg-gradient-to-r from-zinc-900/80 to-zinc-950 px-5 py-5 pr-14">
        <div className="mb-1 flex flex-wrap items-center gap-2"><span className="agent-live-dot" /><span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-400">Nhật ký trực tiếp</span><Badge variant="outline" className={agent ? activityTone[agent.activity] : ''}>{agent ? activityText[agent.activity] : 'Đang đọc'}</Badge></div>
        <DialogTitle className="text-lg leading-6">{agent?.role === 'kernel' ? 'Kernel điều phối' : 'Op worker'} · {agent?.provider ? brands[agent.provider].name : 'Agent chưa rõ'}</DialogTitle>
        <DialogDescription className="text-xs text-zinc-500">{agent?.model || 'Model chưa xác minh'} · {agent?.workflowName || 'Ngoài workflow StarCi'}</DialogDescription>
      </DialogHeader>
      <div className="border-b border-zinc-800 px-5 py-4"><div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">{agent?.role === 'kernel' ? 'Vai trò' : 'Hành động đang làm'}</div><div className="mt-1 text-sm font-medium leading-5 text-zinc-100">{agent?.action}</div><div className="mt-2 flex flex-wrap gap-2 text-[11px] text-zinc-500">{agent?.op && <code className="rounded bg-zinc-900 px-1.5 py-0.5">{agent.op}</code>}{agent?.attempt !== null && agent?.attempt !== undefined && <span>lần {agent.attempt}</span>}{agent?.cut && <span>· chặng {agent.cut.ordinal}/{agent.cut.total}</span>}</div>{agent?.role === 'op' && agent.task && agent.task !== agent.action && <details className="mt-2 text-[11px] text-zinc-500"><summary className="cursor-pointer hover:text-zinc-300">Mô tả nhiệm vụ gốc từ ledger</summary><p className="mt-2 max-h-24 overflow-auto leading-5 text-zinc-400">{agent.task}</p></details>}</div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 px-5 py-3"><div role="tablist" aria-label="Cách xem nhật ký" className="inline-flex gap-1 rounded-lg bg-zinc-900 p-1"><button role="tab" aria-selected={view === 'activity'} className={`rounded-md px-3 py-1.5 text-xs ${view === 'activity' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-200'}`} onClick={() => setView('activity')}>Diễn giải tiếng Việt</button><button role="tab" aria-selected={view === 'raw'} className={`rounded-md px-3 py-1.5 text-xs ${view === 'raw' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-200'}`} onClick={() => setView('raw')}>Terminal gốc</button></div><div className="text-[11px] text-zinc-500">{log ? `Đọc lúc ${new Date(log.updatedAt).toLocaleTimeString('vi-VN')}` : 'Đang đọc...'} · tự cập nhật 5 giây</div></div>
      {log && <div className="agent-log-cycle" key={log.updatedAt} />}
      <div className="min-h-48 flex-1 overflow-auto bg-black/70 px-5 py-4">
        {error && <p className="mb-3 rounded border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-300">{error}</p>}
        {!log && !error ? <p className="text-xs text-zinc-500">Đang đọc màn hình terminal...</p> : view === 'activity' ? <LogTimeline log={log} /> : <RawLog log={log} />}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-800 px-5 py-2 text-[11px] text-zinc-600"><span>{view === 'activity' ? `Diễn giải theo config.yaml: ${log?.language === 'vi' ? 'Tiếng Việt' : log?.language || 'vi'}. Lệnh và đầu ra gốc nằm ở tab bên cạnh.` : 'Màn hình terminal tối đa 80 dòng; chuỗi nhạy cảm thông dụng được ẩn.'}</span><span className="font-mono" title={agent?.terminal || ''}>{agent?.terminal?.slice(0, 15)}…</span></div>
    </DialogContent>
  </Dialog>;
}

function AgentChangesDialog({ agent, onClose }: { agent: AgentRow | null; onClose: () => void }) {
  const [changes, setChanges] = useState<AgentChanges | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    if (!agent || agent.role !== 'op') return;
    const controller = new AbortController();
    setChanges(null);
    setError(null);
    const refresh = async () => {
      try {
        const response = await fetch(`/api/agents/${encodeURIComponent(agent.id)}/changes`, { signal: controller.signal, cache: 'no-store' });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Không đọc được thay đổi');
        if (!controller.signal.aborted) { setChanges(body as AgentChanges); setError(null); }
      } catch (caught) {
        if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : 'Không đọc được thay đổi');
      }
    };
    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, 15_000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [agent?.id, refreshKey]);
  const files = new Set(changes?.patches.flatMap((section) => section.files) || []).size;
  return <Dialog open={Boolean(agent)} onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className="flex max-h-[92vh] w-[calc(100vw-2rem)] max-w-none flex-col gap-0 overflow-hidden border border-zinc-700 bg-zinc-950 p-0 text-zinc-100 shadow-2xl sm:max-w-[1100px]">
      <DialogHeader className="border-b border-zinc-800 bg-gradient-to-r from-zinc-900/80 to-zinc-950 px-5 py-5 pr-14">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-400">Phạm vi op đang chạy</div>
        <DialogTitle className="text-lg leading-6">Diff code & ảnh · {agent?.provider ? brands[agent.provider].name : 'Agent'}</DialogTitle>
        <DialogDescription className="text-xs text-zinc-500">{agent?.action} · {agent?.workflowName || 'Ngoài workflow StarCi'}</DialogDescription>
      </DialogHeader>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 px-5 py-3 text-xs text-zinc-400"><span>{changes ? `${files} tệp code · ${changes.images.length} ảnh` : 'Đang đọc Git và ảnh...'} · tự cập nhật 15 giây</span><Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setRefreshKey((value) => value + 1)}>Làm mới</Button></div>
      <div className="min-h-48 flex-1 space-y-7 overflow-auto bg-black/50 px-5 py-5">
        {error && <p className="rounded border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-300">{error}</p>}
        {!changes && !error && <p className="text-sm text-zinc-500">Đang đọc các tệp được giao cho op...</p>}
        {changes && <><p className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 text-xs leading-5 text-zinc-400">{changes.note}</p>
          <section><div className="mb-3 flex items-baseline justify-between gap-2"><h3 className="text-sm font-semibold text-zinc-100">Ảnh trong phạm vi op</h3><span className="text-xs text-zinc-600">Ảnh mới nhất trước · nhấn để mở lớn</span></div>
            {changes.images.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{changes.images.map((item) => <a key={item.id} href={`/api/agents/${encodeURIComponent(changes.jobId)}/images/${item.id}`} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 hover:border-zinc-600"><div className="aspect-video overflow-hidden bg-zinc-900"><img loading="lazy" src={`/api/agents/${encodeURIComponent(changes.jobId)}/images/${item.id}`} alt={item.name} className="size-full object-contain transition-transform duration-300 group-hover:scale-[1.03]" /></div><div className="space-y-1 border-t border-zinc-800 p-2.5"><div className="truncate text-xs font-medium text-zinc-200" title={item.path}>{item.name}</div><div className="text-[11px] text-zinc-500">{item.repository} · {new Date(item.modifiedAt).toLocaleString('vi-VN')}</div></div></a>)}</div>
              : <div className="rounded-lg border border-dashed border-zinc-800 p-4 text-xs text-zinc-500">Chưa thấy ảnh trong các đường dẫn được giao cho op này.</div>}
          </section>
          <section><h3 className="mb-3 text-sm font-semibold text-zinc-100">Code diff</h3>
            {changes.patches.length ? <div className="space-y-4">{changes.patches.map((section, index) => <div key={`${section.repository}-${section.kind}-${index}`} className="overflow-hidden rounded-lg border border-zinc-800 bg-[#08090a]"><div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 bg-zinc-900/70 px-3 py-2"><strong className="text-xs text-zinc-200">{section.repository} · {{ working: 'Chưa stage', staged: 'Đã stage', untracked: 'Tệp mới', committed: 'Đã commit trong ca' }[section.kind]}</strong><span className="text-[11px] text-zinc-500">{section.files.length} tệp{section.truncated ? ' · đã rút gọn' : ''}</span></div><div className="max-h-[50vh] overflow-auto py-2 font-mono text-[11px] leading-5">{section.patch.split('\n').map((line, lineIndex) => <div key={lineIndex} className={`min-w-max whitespace-pre px-3 ${line.startsWith('+') && !line.startsWith('+++') ? 'bg-emerald-500/10 text-emerald-300' : line.startsWith('-') && !line.startsWith('---') ? 'bg-red-500/10 text-red-300' : line.startsWith('@@') ? 'text-sky-300' : line.startsWith('diff --git') ? 'pt-2 font-semibold text-zinc-100' : 'text-zinc-500'}`}>{line || ' '}</div>)}</div></div>)}</div>
              : <div className="rounded-lg border border-dashed border-zinc-800 p-4 text-xs leading-5 text-zinc-500">Chưa có diff code trong đường dẫn được giao kể từ khi op bắt đầu. Agent có thể đang đọc hoặc chạy kiểm tra.</div>}
          </section></>}
      </div>
      <div className="border-t border-zinc-800 px-5 py-2 text-[11px] text-zinc-600">Chỉ đọc Git và tệp ảnh. Ảnh và diff có thể thay đổi khi op tiếp tục làm việc.</div>
    </DialogContent>
  </Dialog>;
}

const eventStyle: Record<AgentLog['events'][number]['kind'], { icon: typeof Activity; color: string; bg: string }> = {
  running: { icon: Activity, color: 'text-sky-400', bg: 'border-sky-500/30 bg-sky-500/10' },
  command: { icon: TerminalSquare, color: 'text-zinc-300', bg: 'border-zinc-700 bg-zinc-900' },
  success: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'border-emerald-500/30 bg-emerald-500/10' },
  error: { icon: CircleAlert, color: 'text-red-400', bg: 'border-red-500/30 bg-red-500/10' },
  change: { icon: FilePenLine, color: 'text-amber-400', bg: 'border-amber-500/30 bg-amber-500/10' },
};
function LogTimeline({ log }: { log: AgentLog | null }) {
  if (!log) return <p className="text-xs text-zinc-500">Chưa có dữ liệu.</p>;
  if (!log.events?.length) return <div className="rounded-lg border border-dashed border-zinc-800 p-5 text-sm text-zinc-500">Chưa nhận diện được mốc hoạt động trong màn hình hiện tại. Mở “Terminal gốc” để xem đầy đủ đầu ra.</div>;
  return <div className="relative space-y-0 pl-2"><div className="absolute bottom-5 left-[22px] top-5 w-px bg-zinc-800" />{[...log.events].reverse().map((event, index) => {
    const style = eventStyle[event.kind]; const Icon = style.icon;
    return <div key={`${event.line}-${event.kind}-${event.title}`} className="agent-log-event relative flex gap-4 pb-5 last:pb-0"><span className={`relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border ${style.bg}`}><Icon className={`size-4 ${style.color}`} /></span><div className="min-w-0 flex-1 rounded-lg border border-zinc-800/70 bg-zinc-950/70 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-xs font-medium text-zinc-100">{event.title}</strong>{index === 0 && <span className="text-[10px] uppercase tracking-wider text-emerald-500">Mới nhất</span>}</div>{event.detail && <code className="mt-2 block break-all rounded bg-black/70 px-2 py-1.5 text-[11px] leading-5 text-zinc-400">{event.detail}</code>}<div className="mt-2 text-[10px] text-zinc-600">Dòng {event.line} trên màn hình terminal</div></div></div>;
  })}</div>;
}
function RawLog({ log }: { log: AgentLog | null }) {
  if (!log?.lines.length) return <p className="text-xs text-zinc-500">Terminal chưa có dòng hiển thị.</p>;
  return <div className="overflow-hidden rounded-lg border border-zinc-800 bg-[#070708] font-mono text-[11px] leading-5">{log.lines.map((line, index) => <div key={`${index}-${line}`} className="agent-raw-line flex min-w-0 border-b border-zinc-900/50 last:border-0"><span className="w-9 shrink-0 select-none border-r border-zinc-900 px-2 text-right tabular-nums text-zinc-700">{index + 1}</span><span className={`min-w-0 flex-1 whitespace-pre-wrap break-all px-3 ${/Exited with code 0|passed/i.test(line) ? 'text-emerald-400' : /Exited with code [1-9]|error|failed/i.test(line) ? 'text-red-400' : /Ran command|Running command/i.test(line) ? 'text-sky-300' : 'text-zinc-400'}`}>{line || ' '}</span></div>)}</div>;
}

export function AgentsPage({ data }: { data: AgentSnapshot | null }) {
  const [filter, setFilter] = useState<'all' | AgentProvider>('all');
  const [onlyCooking, setOnlyCooking] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<AgentRow | null>(null);
  const [selectedChanges, setSelectedChanges] = useState<AgentRow | null>(null);
  if (!data) return <div className="rounded-xl border border-zinc-800 p-8 text-sm text-zinc-500">Đang đọc Orca và tiến trình trên máy...</div>;
  const rows = data.agents.filter((agent) => (filter === 'all' || agent.provider === filter)
    && (!onlyCooking || agent.activity === 'cooking')
    && `${agent.provider} ${agent.model} ${agent.workflowName} ${agent.op} ${agent.action} ${agent.task} ${agent.projectName}`.toLowerCase().includes(query.toLowerCase()));
  const kernels = rows.filter((agent) => agent.role === 'kernel');
  const workers = rows.filter((agent) => agent.role === 'op');
  const others = rows.filter((agent) => agent.role === 'other');
  const errors = Object.entries(data.sources).filter(([, error]) => error);
  const hasProcessMetrics = providers.every((provider) => data.groups[provider].cpuPercent !== null && data.groups[provider].ramBytes !== null);
  const totalCpu = providers.reduce((sum, provider) => sum + (data.groups[provider].cpuPercent || 0), 0);
  const totalRam = providers.reduce((sum, provider) => sum + (data.groups[provider].ramBytes || 0), 0);
  const totalCooking = providers.reduce((sum, provider) => sum + data.groups[provider].cooking, 0);
  return <div className="space-y-7">
    <div><div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Orca + tiến trình cục bộ</div><h2 className="text-2xl font-semibold tracking-tight">Ai đang cook?</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">Vòng sáng quay khi Orca ghi nhận terminal đang hoạt động gần đây. Model và workflow lấy từ ledger; CPU/RAM lấy từ các tiến trình trên máy.</p><p className="mt-3 text-sm tabular-nums text-zinc-300">{totalCooking} terminal đang cook <span className="px-2 text-zinc-700">·</span> {hasProcessMetrics ? `${totalCpu.toFixed(1)}%` : '—'} CPU <span className="px-2 text-zinc-700">·</span> {hasProcessMetrics ? memory(totalRam) : '—'} RAM trên máy</p></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{providers.map((provider) => {
      const group = data.groups[provider];
      return <Card key={provider} className="border border-zinc-800 bg-zinc-950/80 shadow-none"><CardContent className="space-y-4">
        <div className="flex items-center gap-3"><AgentLogo provider={provider} cooking={group.cooking > 0} /><div><div className="font-semibold">{brands[provider].name}</div><div className="text-xs text-zinc-500">{group.cooking} đang cook / {group.terminals} terminal</div></div></div>
        <div className="grid grid-cols-2 gap-3 border-t border-zinc-800 pt-3"><div><div className="flex items-center gap-1 text-xs text-zinc-500"><Cpu className="size-3" /> CPU máy</div><div className="mt-1 text-lg font-semibold tabular-nums">{group.cpuPercent === null ? '—' : `${group.cpuPercent}%`}</div></div><div><div className="flex items-center gap-1 text-xs text-zinc-500"><HardDrive className="size-3" /> RAM riêng</div><div className="mt-1 text-lg font-semibold tabular-nums">{memory(group.ramBytes)}</div></div></div>
        <div className="text-xs text-zinc-600">{group.processCount ?? '—'} tiến trình cùng loại trên máy</div>
      </CardContent></Card>;
    })}</div>
    <p className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-3 text-xs leading-5 text-zinc-500">“Đang cook” nghĩa là terminal còn kết nối, có output trong 90 giây và hiện dấu hiệu xử lý. “Mở · chưa có tín hiệu” nghĩa là terminal vẫn mở nhưng chưa thấy các dấu hiệu đó; không khẳng định agent đang chờ việc. Trạng thái job và verdict đọc riêng từ ledger. CPU/RAM là tổng theo loại tiến trình trên máy, chưa đo riêng từng terminal.</p>
    {errors.length > 0 && <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-300">Chưa đọc được: {errors.map(([name]) => name).join(', ')}.</div>}
    <div className="flex flex-wrap gap-2"><div className="relative min-w-[220px] flex-1"><Search className="absolute left-3 top-2.5 size-4 text-zinc-500" /><Input className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm model, workflow, op..." /></div>{(['all', ...providers] as const).map((item) => <Button key={item} variant={filter === item ? 'secondary' : 'outline'} onClick={() => setFilter(item)}>{item === 'all' ? 'Tất cả' : brands[item].name}</Button>)}<Button variant={onlyCooking ? 'secondary' : 'outline'} onClick={() => setOnlyCooking(!onlyCooking)}>Chỉ đang cook</Button></div>
    <div className="flex items-center justify-between text-xs text-zinc-500"><span>{rows.length} terminal phù hợp</span><span>Làm mới mỗi 10 giây</span></div>
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)]"><section className="order-2 min-w-0 xl:order-1"><SectionHeading title="Kernel điều phối" count={kernels.length} note="Một Kernel quản lý một workflow" /><div className="grid gap-3">{kernels.length ? kernels.map((agent) => <KernelCard key={agent.id} agent={agent} onOpenLog={setSelected} />) : <EmptyAgents text="Không có Kernel phù hợp bộ lọc." />}</div></section>
    <section className="order-1 min-w-0 xl:order-2"><SectionHeading title="Op worker" count={workers.length} note="Mỗi worker thực hiện một op rồi báo verdict" /><div className="grid gap-3 2xl:grid-cols-2">{workers.length ? workers.map((agent) => <AgentCard key={agent.id} agent={agent} onOpenLog={setSelected} onOpenChanges={setSelectedChanges} />) : <EmptyAgents text="Không có op worker phù hợp bộ lọc." />}</div></section></div>
    {others.length > 0 && <section><SectionHeading title="Terminal ngoài ledger" count={others.length} note="Chưa gắn với job StarCi đang chạy" /><div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">{others.map((agent) => <AgentCard key={agent.id} agent={agent} onOpenLog={setSelected} onOpenChanges={setSelectedChanges} />)}</div></section>}
    <AgentLogDialog agent={selected} onClose={() => setSelected(null)} />
    <AgentChangesDialog agent={selectedChanges} onClose={() => setSelectedChanges(null)} />
  </div>;
}
