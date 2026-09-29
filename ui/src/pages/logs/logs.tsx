import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUp, Filter, Radio, RefreshCw, SlidersHorizontal, X } from 'lucide-react';
import { FeedbackState, PageSkeleton } from '../../components/feedback-state';
import { Button } from '../../components/ui/button';
import { ConceptBlock, type Concept } from '../../components/concept';
import { Drawer } from '../../components/drawer';
import { Input } from '../../components/ui/input';
import { Advanced } from '../../components/motion';
import { LogView } from '../../components/log-view';
import { kindFamilies } from '../../components/logs/kinds';
import { useApiQuery, refreshQuery } from '../../api/query';
import { formatAbsolute } from '../../i18n/vi';
import { useRoute } from '../../router';
import type { ContractInfo, Envelope, LogRow, WorkflowRow } from '../../contract';

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

const chipClass = 'h-8 max-w-full min-w-0 rounded-full border bg-background px-3 text-xs text-foreground data-[active=true]:border-primary data-[active=true]:bg-primary/10';
const ranges = [['900000', '15 phút qua'], ['3600000', '1 giờ qua'], ['86400000', '24 giờ qua'], ['604800000', '7 ngày qua']] as const;

function FilterBar({ filters, onChange, contract, onMore, activeCount, workflows }: { filters: URLSearchParams; onChange: (name: string, value: string) => void; contract: ContractInfo | null; workflows: Pick<WorkflowRow, 'id' | 'name' | 'project'>[]; onMore: () => void; activeCount: number }) {
  const level = filters.get('minLevel') === 'warn' ? 'warn+' : filters.get('level') ?? 'all';
  const customRange = filters.has('since') || filters.has('until');
  const chip = (active: boolean) => ({ className: chipClass, 'data-active': active });
  const advancedActive = filters.has('wf') || filters.has('actor') || filters.has('kind') || customRange || filters.has('since') || filters.has('until');
  return <div className="flex flex-col gap-3" role="group" aria-label="Bộ lọc nhật ký">
    <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1 sm:max-w-sm"><Input type="search" className="h-8 rounded-full text-xs" aria-label="Tìm trong nhật ký" value={filters.get('q') ?? ''} onChange={(event) => onChange('q', event.target.value)} placeholder="Tìm trong nhật ký" /></div>
        <select aria-label="Mức tối thiểu" {...chip(level !== 'all')} value={level} onChange={(event) => onChange('levelChoice', event.target.value)}><option value="all">Mọi mức</option><option value="warn+">Mức ≥ cảnh báo</option><option value="error">Chỉ lỗi</option><option value="warn">Chỉ cảnh báo</option><option value="info">Chỉ info</option><option value="debug">Chỉ debug</option></select>
    {activeCount > 0 && <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => onChange('clear', '')}><X size={14} /> Xóa lọc ({activeCount})</Button>}
    </div>
    <Advanced title="Bộ lọc nâng cao" summary="Workflow, actor, loại, khoảng thời gian và các bộ lọc khác" defaultOpen={advancedActive}>
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Workflow" {...chip(filters.has('wf'))} value={filters.get('wf') ?? ''} onChange={(event) => { const found = workflows.find((item) => item.id === event.target.value); onChange('wf', event.target.value); if (found) onChange('project', found.project); }}><option value="">Workflow: tất cả</option>{filters.get('wf') && !workflows.some((item) => item.id === filters.get('wf')) && <option value={filters.get('wf') ?? ''}>{filters.get('wf')}</option>}{workflows.map((item) => <option key={`${item.project}:${item.id}`} value={item.id}>{item.name}</option>)}</select>
        <select aria-label="Actor" {...chip(filters.has('actor'))} value={filters.get('actor') ?? ''} onChange={(event) => onChange('actor', event.target.value)}><option value="">Actor: tất cả</option>{contract?.vocab.logActors.map((actor) => <option key={actor} value={actor}>Actor: {actor}</option>)}</select>
        <select aria-label="Loại" {...chip(filters.has('kind'))} value={filters.get('kind') ?? ''} onChange={(event) => onChange('kind', event.target.value)}>{kindFamilies.map((item) => <option key={item.value} value={item.value}>{item.value ? `Loại: ${item.label}` : 'Loại: tất cả'}</option>)}{filters.get('kind') && !kindFamilies.some((item) => item.value === filters.get('kind')) && <option value={filters.get('kind') ?? ''}>Loại: {filters.get('kind')}</option>}</select>
        <select aria-label="Khoảng thời gian" {...chip(customRange)} value={customRange ? 'custom' : ''} onChange={(event) => { const value = event.target.value; if (value === 'custom') return; onChange('until', ''); onChange('since', value ? String(Date.now() - Number(value)) : ''); }}><option value="">Mọi thời gian</option>{ranges.map(([value, label]) => <option key={value} value={value}>{label}</option>)}{customRange && <option value="custom">Khoảng tùy chọn</option>}</select>
    <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={onMore}><SlidersHorizontal size={14} /> Thêm bộ lọc</Button>
      </div>
    </Advanced>
  </div>;
}

export default function LogsPage() {
  const route = useRoute();
  const filterKey = route.kind === 'logs' ? route.filters.toString() : '';
  const filters = useMemo(() => new URLSearchParams(filterKey), [filterKey]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [follow, setFollow] = useState(true);
  const [pending, setPending] = useState<LogRow[]>([]);
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set());
  const pausedRef = useRef(false);
  const regionRef = useRef<HTMLDivElement | null>(null);
  const oldestRef = useRef<number | null>(null);
  const knownRef = useRef<Set<string>>(new Set());
  const workflowList = useApiQuery<WorkflowRow[]>('/api/workflows?phase=all&limit=100', { topics: ['fleet'], intervalMs: 60_000 });
  const [streamStatus, setStreamStatus] = useState<'connecting' | 'live' | 'reconnecting'>('connecting');
  const [streamed, setStreamed] = useState<LogRow[]>([]);
  const [older, setOlder] = useState<LogRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null | undefined>(undefined);
  const [moreBusy, setMoreBusy] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);
  const contract = useApiQuery<ContractInfo>('/api/contract', { topics: ['system'], intervalMs: 60_000 });

  const change = (name: string, value: string) => {
    const next = new URLSearchParams(window.location.hash.split('?')[1] ?? '');
    if (name === 'clear') { for (const field of filterFields) next.delete(field); }
    else if (name === 'levelChoice') {
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

  useEffect(() => { setStreamed([]); setOlder([]); setNextCursor(undefined); setMoreError(null); setPending([]); }, [filterKey]);
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
        if (knownRef.current.has(row.key) || (oldestRef.current != null && row.at < oldestRef.current)) return;
        knownRef.current.add(row.key);
        if (pausedRef.current) { setPending((current) => unique([row, ...current]).slice(0, 200)); return; }
        setStreamed((current) => unique([row, ...current]).slice(0, 200));
        setFresh((current) => new Set(current).add(row.key));
        setTimeout(() => setFresh((current) => { const next = new Set(current); next.delete(row.key); return next; }), 2000);
      } catch { /* A malformed frame cannot replace a valid row. */ }
    };
    stream.addEventListener('log', onLog as EventListener);
    stream.addEventListener('invalidate', () => refreshQuery(apiUrl));
    return () => stream.close();
  }, [follow, streamUrl, apiUrl, filters]);

  const onRegionScroll = (top: number) => { pausedRef.current = top > 40; if (!pausedRef.current) flushPending(); };
  const flushPending = () => {
    setPending((current) => {
      if (!current.length) return current;
      const keys = current.map((row) => row.key);
      setStreamed((old) => unique([...current, ...old]).slice(0, 200));
      setFresh(new Set(keys));
      setTimeout(() => setFresh(new Set()), 2000);
      return [];
    });
  };
  const showPending = () => { regionRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); pausedRef.current = false; flushPending(); };
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
  oldestRef.current = logs.data?.length ? Math.min(...logs.data.map((row) => row.at)) : null;
  knownRef.current = new Set(rows.map((row) => row.key));
  const activeCount = filterFields.filter((field) => filters.has(field)).length;
  const sources = [...new Set(rows.map((row) => row.db))];
  const canLoadMore = (nextCursor === undefined ? logs.meta?.next : nextCursor) != null;
  return <ConceptBlock concept="C17" className="flex flex-col gap-6 md:gap-8">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs text-muted-foreground">StarCi / Quan sát</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Nhật ký</h1><p className="mt-1 text-sm text-muted-foreground">Dòng sự kiện từ máy và ledger dự án; bộ lọc lưu trong đường dẫn.</p></div>
      <div className="flex gap-2"><Button variant="outline" size="sm" className="md:hidden" onClick={() => setFilterOpen(true)}><Filter size={15} /> Bộ lọc{activeCount ? ` (${activeCount})` : ''}</Button><Button variant={follow ? 'default' : 'outline'} size="sm" aria-pressed={follow} disabled={filters.has('q')} title={filters.has('q') ? 'Theo dõi không hỗ trợ tìm toàn văn; xóa từ khóa để bật.' : undefined} onClick={() => setFollow((value) => !value)}><Radio size={15} /> {follow ? streamStatus === 'live' ? 'Đang theo dõi trực tiếp' : 'Đang nối lại' : 'Theo dõi trực tiếp'}</Button></div></div>
    <div className="hidden md:block"><FilterBar filters={filters} onChange={change} contract={contract.data} workflows={workflowList.data ?? []} activeCount={activeCount} onMore={() => setFilterOpen(true)} /></div>
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><div className="flex flex-wrap items-center gap-2"><span>{rows.length} dòng đã tải</span><span>{sources.length ? sources.map((source) => source === 'machine' ? 'máy' : source).join(' · ') : 'Chưa có nguồn'}</span></div><div className="flex items-center gap-2"><span>{logs.meta ? `Nguồn ${formatAbsolute(logs.meta.at)}` : 'Chưa có thời điểm nguồn'}</span><Button variant="ghost" size="icon" aria-label="Làm mới" onClick={() => refreshQuery(apiUrl)}><RefreshCw size={15} /></Button></div></div>
      {pending.length > 0 && <div className="pointer-events-none sticky top-16 z-20 flex justify-center"><Button size="sm" className="pointer-events-auto rounded-full shadow-md" onClick={showPending}><ArrowUp size={14} /> {pending.length} dòng mới</Button></div>}
      {logs.error && <FeedbackState error onRetry={() => refreshQuery(apiUrl)}>{logs.data ? 'Nguồn đang lỗi; giữ dòng đã đọc gần nhất. ' : 'Không đọc được nhật ký. '}{logs.error}</FeedbackState>}
      {logs.meta?.stale?.length ? <p className="shell-error" role="status">Nguồn chậm: {logs.meta.stale.join(', ')}</p> : null}
      {logs.loading && !logs.data ? <PageSkeleton label="Đang đọc nhật ký…" /> : <LogView rows={rows} freshKeys={fresh} regionRef={regionRef} onRegionScroll={onRegionScroll} />}
      {moreError && <p className="shell-error" role="status">{moreError}</p>}
      {canLoadMore && <Button variant="outline" className="w-full" disabled={moreBusy} onClick={loadMore}>{moreBusy ? 'Đang tải…' : 'Tải thêm'}</Button>}
    </div>
    <Drawer open={filterOpen} onOpenChange={setFilterOpen} title="Bộ lọc nhật ký" description="Các lựa chọn được lưu trong đường dẫn."><FilterFields filters={filters} onChange={change} contract={contract.data} /><div className="mt-6 grid grid-cols-2 gap-2"><Button variant="outline" onClick={() => change('clear', '')}>Xóa lọc</Button><Button onClick={() => setFilterOpen(false)}>Xem kết quả</Button></div></Drawer>
  </ConceptBlock>;
}
