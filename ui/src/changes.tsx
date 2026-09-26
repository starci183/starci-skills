import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, FileCode2, Image as ImageIcon, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { AgentChanges, AgentSnapshot } from './types';

type ChangeState = Record<string, AgentChanges | null>;
const kindText: Record<AgentChanges['patches'][number]['kind'], string> = {
  working: 'Chưa stage', staged: 'Đã stage', untracked: 'Tệp mới', committed: 'Đã commit trong ca',
};
const countFiles = (changes: AgentChanges | null | undefined) => new Set(changes?.patches.flatMap((patch) => patch.files) || []).size;
const rank = (changes: AgentChanges | null | undefined) => changes?.patches.length ? 2 : changes?.images.length ? 1 : 0;
const imageUrl = (jobId: string, id: string) => `/api/agents/${encodeURIComponent(jobId)}/images/${id}`;

function useLiveChanges(data: AgentSnapshot | null) {
  const workers = useMemo(() => data?.agents.filter((agent) => agent.role === 'op' && agent.projectId) || [], [data]);
  const ids = workers.map((agent) => agent.id).join('|');
  const [changes, setChanges] = useState<ChangeState>({});
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    if (!ids) { setChanges({}); setLoading(false); return; }
    setLoading(true);
    const controller = new AbortController();
    const jobIds = ids.split('|');
    const refresh = async () => {
      let cursor = 0;
      const next: ChangeState = {};
      const work = async () => {
        while (cursor < jobIds.length && !controller.signal.aborted) {
          const id = jobIds[cursor++];
          try {
            const response = await fetch(`/api/agents/${encodeURIComponent(id)}/changes`, { signal: controller.signal, cache: 'no-store' });
            next[id] = response.ok ? await response.json() as AgentChanges : null;
          } catch { next[id] = null; }
        }
      };
      await Promise.all(Array.from({ length: Math.min(3, jobIds.length) }, work));
      if (!controller.signal.aborted) { setChanges(next); setLoading(false); }
    };
    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, 30_000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [ids, refreshKey]);
  const ordered = [...workers].sort((a, b) => rank(changes[b.id]) - rank(changes[a.id]) || Number(b.activity === 'cooking') - Number(a.activity === 'cooking'));
  return { ordered, changes, loading, refresh: () => setRefreshKey((value) => value + 1) };
}

function DiffLines({ text, preview = false }: { text: string; preview?: boolean }) {
  const all = text.split('\n');
  const hunk = all.findIndex((line) => line.startsWith('@@'));
  const lines = preview ? all.slice(Math.max(0, hunk - 2), Math.max(0, hunk - 2) + 18) : all;
  return <div className={`overflow-auto bg-[#08090a] py-2 font-mono text-[11px] leading-5 ${preview ? 'max-h-72' : 'max-h-[58vh]'}`}>
    {lines.map((line, index) => <div key={index} className={`min-w-max whitespace-pre px-3 ${line.startsWith('+') && !line.startsWith('+++') ? 'bg-emerald-500/10 text-emerald-300' : line.startsWith('-') && !line.startsWith('---') ? 'bg-red-500/10 text-red-300' : line.startsWith('@@') ? 'text-sky-300' : line.startsWith('diff --git') || line.startsWith('commit ') ? 'font-semibold text-zinc-100' : 'text-zinc-500'}`}>{line || ' '}</div>)}
  </div>;
}

function Images({ changes, compact = false }: { changes: AgentChanges; compact?: boolean }) {
  if (!changes.images.length) return <p className="rounded-lg border border-dashed border-zinc-800 p-4 text-xs text-zinc-500">Chưa thấy ảnh trong phạm vi op này.</p>;
  return <div className={`grid gap-3 ${compact ? 'grid-cols-2' : 'sm:grid-cols-2 xl:grid-cols-3'}`}>
    {changes.images.slice(0, compact ? 2 : 12).map((item) => <a key={item.id} href={imageUrl(changes.jobId, item.id)} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 hover:border-zinc-600">
      <div className="aspect-video overflow-hidden bg-zinc-900"><img loading="lazy" src={imageUrl(changes.jobId, item.id)} alt={item.name} className="size-full object-contain transition-transform duration-300 group-hover:scale-[1.03]" /></div>
      <div className="truncate border-t border-zinc-800 px-3 py-2 text-xs text-zinc-400" title={item.path}>{item.name} · {item.repository}</div>
    </a>)}
  </div>;
}

export function CodeDiffTeaser({ data, open }: { data: AgentSnapshot | null; open: () => void }) {
  const { ordered, changes, loading } = useLiveChanges(data);
  const agent = ordered[0];
  const current = agent && changes[agent.id];
  const patch = current?.patches[0];
  const imageAgent = ordered.find((item) => changes[item.id]?.images.length);
  const imageChanges = imageAgent && changes[imageAgent.id];
  return <section className="space-y-4">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-400">Git & ảnh trực tiếp</div><h2 className="text-xl font-semibold tracking-tight">Code diff đang diễn ra</h2><p className="mt-1 text-sm text-zinc-500">Thay đổi trong phạm vi op đang chạy; chọn agent để xem toàn bộ diff và ảnh.</p></div><Button variant="outline" size="sm" onClick={open}>Xem code diff & ảnh <ArrowRight className="size-4" /></Button></div>
    <Card className="overflow-hidden border border-zinc-800 bg-zinc-950/80 shadow-none"><CardContent className="grid gap-4 p-0 lg:grid-cols-[minmax(0,1.3fr)_minmax(250px,.7fr)]">
      <div className="min-w-0"><div className="flex flex-wrap items-center gap-2 border-b border-zinc-800 px-4 py-3 text-xs"><FileCode2 className="size-4 text-sky-400" /><strong className="text-zinc-100">{agent ? `${agent.workflowName} · ${agent.op}` : 'Code diff'}</strong><span className="text-zinc-500">{current ? `${countFiles(current)} tệp code` : loading ? 'Đang quét Git...' : 'Chưa có op'}</span></div>
        {patch ? <DiffLines text={patch.patch} preview /> : <div className="flex min-h-36 items-center px-5 text-sm text-zinc-500">{loading ? 'Đang đọc thay đổi của các agent...' : 'Chưa có diff code trong các op đang chạy.'}</div>}</div>
      <div className="min-w-0 border-t border-zinc-800 p-4 lg:border-l lg:border-t-0"><div className="mb-3 flex items-center gap-2 text-xs font-medium text-zinc-200"><ImageIcon className="size-4 text-violet-400" /> Ảnh đã vẽ · {imageChanges?.images.length || 0}</div>{imageAgent && <div className="mb-3 truncate text-[11px] text-zinc-500">{imageAgent.workflowName} · {imageAgent.op}</div>}{imageChanges ? <Images changes={imageChanges} compact /> : <p className="text-xs text-zinc-500">{loading ? 'Đang tìm ảnh...' : 'Chưa thấy ảnh trong các op đang chạy.'}</p>}</div>
    </CardContent></Card>
  </section>;
}

export function CodeDiffPage({ data }: { data: AgentSnapshot | null }) {
  const { ordered, changes, loading, refresh } = useLiveChanges(data);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const selected = ordered.find((agent) => agent.id === chosenId) || ordered[0];
  const current = selected && changes[selected.id];
  return <div className="space-y-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-400">Git & ảnh trực tiếp</div><h2 className="text-2xl font-semibold">Code diff & ảnh đã vẽ</h2><p className="mt-2 max-w-3xl text-sm text-zinc-500">Chọn một op để xem diff chưa commit, tệp mới, commit trong ca và ảnh ở các đường dẫn được giao.</p></div><Button variant="outline" size="sm" onClick={refresh}><RefreshCw className="size-4" /> Làm mới</Button></div>
    <div className="grid items-start gap-5 xl:grid-cols-[300px_minmax(0,1fr)]"><aside className="space-y-2"><div className="text-xs text-zinc-500">{ordered.length} op đang theo dõi · cập nhật mỗi 30 giây</div>{ordered.map((agent) => { const item = changes[agent.id]; return <button key={agent.id} onClick={() => setChosenId(agent.id)} className={`w-full rounded-lg border p-3 text-left transition-colors ${selected?.id === agent.id ? 'border-sky-500/50 bg-sky-500/10' : 'border-zinc-800 bg-zinc-950 hover:border-zinc-600'}`}><div className="text-sm font-medium text-zinc-100">{agent.workflowName || agent.id}</div><div className="mt-1 truncate text-xs text-zinc-500">{agent.provider} · {agent.op} · {agent.model || 'model chưa rõ'}</div><div className="mt-2 text-[11px] text-zinc-400">{item ? `${countFiles(item)} tệp code · ${item.images.length} ảnh` : loading ? 'Đang đọc...' : 'Chưa đọc được'}</div></button>; })}{!ordered.length && <p className="rounded-lg border border-dashed border-zinc-800 p-4 text-sm text-zinc-500">Chưa có op đang chạy.</p>}</aside>
      <main className="min-w-0 space-y-6">{selected ? <><div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4"><div className="text-sm font-semibold text-zinc-100">{selected.action}</div><div className="mt-1 text-xs text-zinc-500">{selected.projectName} · {selected.workflowName} · {selected.op}</div></div>{current ? <><p className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 text-xs leading-5 text-zinc-400">{current.note}</p><section><h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><FileCode2 className="size-4 text-sky-400" /> Code diff · {countFiles(current)} tệp</h3>{current.patches.length ? <div className="space-y-4">{current.patches.map((patch, index) => <div key={`${patch.repository}-${patch.kind}-${index}`} className="overflow-hidden rounded-lg border border-zinc-800"><div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 bg-zinc-900 px-3 py-2 text-xs"><strong>{patch.repository} · {kindText[patch.kind]}</strong><span className="text-zinc-500">{patch.files.length} tệp{patch.truncated ? ' · đã rút gọn' : ''}</span></div><DiffLines text={patch.patch} /></div>)}</div> : <p className="rounded-lg border border-dashed border-zinc-800 p-5 text-sm text-zinc-500">Op này chưa có diff code trong đường dẫn được giao. Chọn op khác bên trái để xem thay đổi đang có.</p>}</section><section><h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><ImageIcon className="size-4 text-violet-400" /> Ảnh đã vẽ · {current.images.length}</h3><Images changes={current} /></section></> : <div className="rounded-lg border border-zinc-800 p-8 text-sm text-zinc-500">{loading ? 'Đang đọc Git và ảnh...' : 'Không đọc được dữ liệu của op này.'}</div>}</> : <div className="rounded-lg border border-zinc-800 p-8 text-sm text-zinc-500">Chưa có op để xem.</div>}</main></div>
  </div>;
}
