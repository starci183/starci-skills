import { useEffect, useMemo, useState } from 'react';
import { Filter, Radio, RefreshCw } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { ConceptBlock, type Concept } from '../../components/concept';
import { Drawer } from '../../components/drawer';
import { Input } from '../../components/ui/input';
import { LogView } from '../../components/log-view';
import { useApiQuery, refreshQuery } from '../../api/query';
import { formatAbsolute } from '../../i18n/vi';
import { useRoute } from '../../router';
import type { ContractInfo, Envelope, LogRow } from '../../contract';

export const concept: Concept = 'C17';

const inputClass = 'h-9 w-full min-w-0 rounded-md border bg-background px-2 text-sm text-foreground';
const filterFields = ['scope', 'project', 'wf', 'job', 'actor', 'controller', 'kind', 'level', 'minLevel', 'q', 'since', 'until'] as const;
const asTime = (value: string | null) => {
  if (!value) return '';
  const date = new Date(Number(value));
  if (Number.isNaN(date.getTime())) return '';
  const pad = (number: number) => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};
const fromTime = (value: string) => value ? String(new Date(value).getTime()) : '';
const unique = (rows: LogRow[]): LogRow[] => [...new Map(rows.map((row) => [row.key, row])).values()].sort((a, b) => b.at - a.at || a.db.localeCompare(b.db) || b.seq - a.seq);

function FilterFields({ filters, onChange, contract }: { filters: URLSearchParams; onChange: (name: string, value: string) => void; contract: ContractInfo | null }) {
  const level = filters.get('minLevel') === 'warn' ? 'warn+' : filters.get('level') ?? 'all';
  const changeLevel = (value: string) => onChange('levelChoice', value);
  return <div className="grid gap-3">
    <label className="grid gap-1 text-xs font-medium">Tìm toàn văn<Input type="search" value={filters.get('q') ?? ''} onChange={(event) => onChange('q', event.target.value)} placeholder="Ví dụ: tsc-app" /></label>
    <label className="grid gap-1 text-xs font-medium">Phạm vi<select className={inputClass} value={filters.get('scope') ?? 'all'} onChange={(event) => onChange('scope', event.target.value)}><option value="all">Máy + mọi dự án</option><option value="machine">Chỉ máy</option><option value="project">Các dự án</option></select></label>
    <label className="grid gap-1 text-xs font-medium">Dự án<select className={inputClass} value={filters.get('project') ?? ''} onChange={(event) => onChange('project', event.target.value)}><option value="">Mọi dự án</option>{contract?.projects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}</select></label>
    <div className="grid grid-cols-2 gap-2"><label className="grid min-w-0 gap-1 text-xs font-medium">Workflow<Input value={filters.get('wf') ?? ''} onChange={(event) => onChange('wf', event.target.value)} placeholder="ID workflow" /></label><label className="grid min-w-0 gap-1 text-xs font-medium">Job<Input value={filters.get('job') ?? ''} onChange={(event) => onChange('job', event.target.value)} placeholder="ID job" /></label></div>
    <div className="grid grid-cols-2 gap-2"><label className="grid min-w-0 gap-1 text-xs font-medium">Actor<select className={inputClass} value={filters.get('actor') ?? ''} onChange={(event) => onChange('actor', event.target.value)}><option value="">Mọi actor</option>{contract?.vocab.logActors.map((actor) => <option key={actor} value={actor}>{actor}</option>)}</select></label><label className="grid min-w-0 gap-1 text-xs font-medium">Mức<select className={inputClass} value={level} onChange={(event) => changeLevel(event.target.value)}><option value="all">Mọi mức</option><option value="warn+">Từ cảnh báo</option><option value="error">Chỉ lỗi</option><option value="warn">Chỉ cảnh báo</option><option value="info">Thông tin</option><option value="debug">Debug</option></select></label></div>
    <div className="grid grid-cols-2 gap-2"><label className="grid min-w-0 gap-1 text-xs font-medium">Controller<Input value={filters.get('controller') ?? ''} onChange={(event) => onChange('controller', event.target.value)} placeholder="Tên controller" /></label><label className="grid min-w-0 gap-1 text-xs font-medium">Tiền tố loại<Input value={filters.get('kind') ?? ''} onChange={(event) => onChange('kind', event.target.value)} placeholder="Ví dụ: reconciler." /></label></div>
    <div className="grid grid-cols-2 gap-2"><label className="grid min-w-0 gap-1 text-xs font-medium">Từ lúc<Input type="datetime-local" value={asTime(filters.get('since'))} onChange={(event) => onChange('since', fromTime(event.target.value))} /></label><label className="grid min-w-0 gap-1 text-xs font-medium">Đến lúc<Input type="datetime-local" value={asTime(filters.get('until'))} onChange={(event) => onChange('until', fromTime(event.target.value))} /></label></div>
  </div>;
}

export default function LogsPage() {
  const route = useRoute();
  const filterKey = route.kind === 'logs' ? route.filters.toString() : '';
  const filters = useMemo(() => new URLSearchParams(filterKey), [filterKey]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [follow, setFollow] = useState(false);
  const [streamStatus, setStreamStatus] = useState<'connecting' | 'live' | 'reconnecting'>('connecting');
  const [streamed, setStreamed] = useState<LogRow[]>([]);
  const [older, setOlder] = useState<LogRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null | undefined>(undefined);
  const [moreBusy, setMoreBusy] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);
  const contract = useApiQuery<ContractInfo>('/api/contract', { topics: ['system'], intervalMs: 60_000 });

  useEffect(() => {
    if (route.kind !== 'logs' || !window.matchMedia('(max-width: 767px)').matches || filters.has('level') || filters.has('minLevel')) return;
    const next = new URLSearchParams(filterKey);
    next.set('minLevel', 'warn');
    window.location.hash = `#/logs?${next}`;
  }, [route.kind, filterKey, filters]);

  const change = (name: string, value: string) => {
    const next = new URLSearchParams(filterKey);
    if (name === 'levelChoice') {
      next.delete('level'); next.delete('minLevel');
      if (value === 'warn+') next.set('minLevel', 'warn');
      else if (value !== 'all') next.set('level', value);
    } else if (value) next.set(name, value); else next.delete(name);
    window.location.hash = `#/logs${next.size ? `?${next}` : ''}`;
  };
  const requestParams = useMemo(() => {
    const params = new URLSearchParams();
    for (const field of filterFields) {
      const value = filters.get(field);
      if (value) params.set(field, value);
    }
    params.set('limit', '100');
    return params;
  }, [filters]);
  const apiUrl = `/api/logs?${requestParams}`;
  const streamParams = useMemo(() => {
    const params = new URLSearchParams(requestParams);
    params.delete('q'); params.delete('limit');
    return params;
  }, [requestParams]);
  const streamUrl = `/api/logs/stream?${streamParams}`;
  const logs = useApiQuery<LogRow[]>(apiUrl, { topics: ['logs'], intervalMs: 30_000 });

  useEffect(() => { setStreamed([]); setOlder([]); setNextCursor(undefined); setMoreError(null); setFollow(false); }, [filterKey]);
  useEffect(() => {
    if (!follow || filters.has('q')) return;
    const stream = new EventSource(streamUrl);
    setStreamStatus('connecting');
    stream.onopen = () => setStreamStatus('live');
    stream.onerror = () => setStreamStatus('reconnecting');
    const onLog = (event: MessageEvent<string>) => {
      try {
        const row = JSON.parse(event.data) as LogRow;
        if (!row.key || typeof row.at !== 'number') return;
        setStreamed((current) => unique([row, ...current]).slice(0, 200));
      } catch { /* A malformed frame cannot replace a valid row. */ }
    };
    stream.addEventListener('log', onLog as EventListener);
    stream.addEventListener('invalidate', () => refreshQuery(apiUrl));
    return () => stream.close();
  }, [follow, streamUrl, apiUrl, filters]);

  const loadMore = async () => {
    const cursor = nextCursor === undefined ? logs.meta?.next : nextCursor;
    if (!cursor || moreBusy) return;
    setMoreBusy(true); setMoreError(null);
    try {
      const params = new URLSearchParams(requestParams); params.set('cursor', cursor);
      const response = await fetch(`/api/logs?${params}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const envelope = await response.json() as Envelope<LogRow[]>;
      setOlder((current) => unique([...current, ...envelope.data]));
      setNextCursor(envelope.meta.next ?? null);
    } catch (error) { setMoreError(error instanceof Error ? error.message : 'Không tải được trang kế tiếp.'); }
    finally { setMoreBusy(false); }
  };
  const rows = unique([...(logs.data ?? []), ...streamed, ...older]);
  const sources = [...new Set(rows.map((row) => row.db))];
  const canLoadMore = (nextCursor === undefined ? logs.meta?.next : nextCursor) != null;
  return <ConceptBlock concept="C17" className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs text-muted-foreground">StarCi / Quan sát</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Nhật ký</h1><p className="mt-1 text-sm text-muted-foreground">Dòng sự kiện từ máy và ledger dự án, có bộ lọc lưu trong đường dẫn.</p></div><div className="flex gap-2"><Button variant="outline" size="sm" className="lg:hidden" onClick={() => setFilterOpen(true)}><Filter size={15} /> Bộ lọc</Button><Button variant={follow ? 'default' : 'outline'} size="sm" disabled={filters.has('q')} title={filters.has('q') ? 'Theo dõi không hỗ trợ tìm toàn văn; xóa từ khóa để bật.' : undefined} onClick={() => setFollow((value) => !value)}><Radio size={15} /> {follow ? streamStatus === 'live' ? 'Đang theo dõi' : 'Đang nối lại' : 'Theo dõi'}</Button></div></div>
    <div className="grid min-w-0 gap-4 lg:grid-cols-[245px_minmax(0,1fr)]">
      <aside className="hidden lg:block"><Card><CardHeader><CardTitle>Bộ lọc</CardTitle></CardHeader><CardContent><FilterFields filters={filters} onChange={change} contract={contract.data} /></CardContent></Card></aside>
      <div className="min-w-0 space-y-3"><Card><CardContent className="flex flex-wrap items-center justify-between gap-2 py-3 text-xs text-muted-foreground"><div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{rows.length} dòng đã tải</Badge><span>{sources.length ? sources.map((source) => source === 'machine' ? 'máy' : source).join(' · ') : 'Chưa có nguồn'}</span></div><div className="flex items-center gap-2"><span>{logs.meta ? `Nguồn ${formatAbsolute(logs.meta.at)}` : 'Chưa có thời điểm nguồn'}</span><Button variant="ghost" size="icon" aria-label="Làm mới" onClick={() => refreshQuery(apiUrl)}><RefreshCw size={15} /></Button></div></CardContent></Card>
        {logs.error && <p className="shell-error" role="status">{logs.data ? 'Nguồn đang lỗi; giữ dòng đã đọc gần nhất. ' : 'Không đọc được nhật ký. '}{logs.error}</p>}
        {logs.meta?.stale?.length ? <p className="shell-error" role="status">Nguồn chậm: {logs.meta.stale.join(', ')}</p> : null}
        {logs.loading && !logs.data ? <p className="empty-state" role="status">Đang đọc nhật ký…</p> : <LogView rows={rows} />}
        {moreError && <p className="shell-error" role="status">{moreError}</p>}
        {canLoadMore && <Button variant="outline" className="w-full" disabled={moreBusy} onClick={loadMore}>{moreBusy ? 'Đang tải…' : 'Tải thêm dòng cũ'}</Button>}
      </div>
    </div>
    <Drawer open={filterOpen} onOpenChange={setFilterOpen} title="Bộ lọc nhật ký" description="Các lựa chọn được lưu trong đường dẫn."><FilterFields filters={filters} onChange={change} contract={contract.data} /><Button className="mt-5 w-full" onClick={() => setFilterOpen(false)}>Xem kết quả</Button></Drawer>
  </ConceptBlock>;
}
