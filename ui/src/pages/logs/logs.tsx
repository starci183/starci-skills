import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ArrowUp, Filter, Radio, RefreshCw, SlidersHorizontal, X } from 'lucide-react';
import { FeedbackState, PageSkeleton } from '../../components/feedback-state';
import { Button } from '../../components/ui/button';
import { ConceptBlock, type Concept } from '../../components/concept';
import { Drawer } from '../../components/drawer';
import { Input } from '../../components/ui/input';
import { NativeSelect, NativeSelectOption } from '../../components/ui/native-select';
import { Advanced } from '../../components/motion';
import { LogView } from '../../components/log-view';
import { kindFamilies } from '../../components/logs/kinds';
import { useApiQuery, usePagedApiQuery, refreshQuery } from '../../api/query';
import { formatAbsolute } from '../../i18n/vi';
import { t } from '../../i18n/t';
import { useRoute } from '../../router';
import type { ContractInfo, LogRow, WorkflowRow } from '../../contract';
import { partialSources } from '../../components/charts/chart-card';

export const concept: Concept = 'C17';

const inputClass = 'w-full min-w-0';
const filterFields = ['scope', 'source', 'id', 'project', 'wf', 'job', 'actor', 'controller', 'kind', 'level', 'minLevel', 'q', 'since', 'until'] as const;
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
  const fieldId = useId();
  const level = filters.get('minLevel') === 'warn' ? 'warn+' : filters.get('level') ?? 'all';
  const changeLevel = (value: string) => onChange('levelChoice', value);
  return <div className="grid gap-3">
    <label className="grid gap-1 text-xs font-medium">{t('Full-text search')}<Input type="search" value={filters.get('q') ?? ''} onChange={(event) => onChange('q', event.target.value)} placeholder={t('Example: tsc-app')} /></label>
    <div className="grid gap-1 text-xs font-medium"><label htmlFor={`${fieldId}-scope`}>{t('Scope')}</label><NativeSelect id={`${fieldId}-scope`} className={inputClass} value={filters.get('scope') ?? 'all'} onChange={(event) => onChange('scope', event.target.value)}><NativeSelectOption value="all">{t('Host + all projects')}</NativeSelectOption><NativeSelectOption value="machine">{t('Host only')}</NativeSelectOption><NativeSelectOption value="project">{t('Projects')}</NativeSelectOption></NativeSelect></div>
    <div className="grid gap-1 text-xs font-medium"><label htmlFor={`${fieldId}-project`}>{t('Project')}</label><NativeSelect id={`${fieldId}-project`} className={inputClass} value={filters.get('project') ?? ''} onChange={(event) => onChange('project', event.target.value)}><NativeSelectOption value="">{t('All projects')}</NativeSelectOption>{contract?.projects.map((project) => <NativeSelectOption value={project.id} key={project.id}>{project.name}</NativeSelectOption>)}</NativeSelect></div>
    <div className="grid grid-cols-2 gap-2"><label className="grid min-w-0 gap-1 text-xs font-medium">Workflow<Input value={filters.get('wf') ?? ''} onChange={(event) => onChange('wf', event.target.value)} placeholder={t('Workflow id')} /></label><label className="grid min-w-0 gap-1 text-xs font-medium">Job<Input value={filters.get('job') ?? ''} onChange={(event) => onChange('job', event.target.value)} placeholder={t('Job id')} /></label></div>
    <div className="grid grid-cols-2 gap-2"><div className="grid min-w-0 gap-1 text-xs font-medium"><label htmlFor={`${fieldId}-actor`}>Actor</label><NativeSelect id={`${fieldId}-actor`} className={inputClass} value={filters.get('actor') ?? ''} onChange={(event) => onChange('actor', event.target.value)}><NativeSelectOption value="">{t('All actors')}</NativeSelectOption>{contract?.vocab.logActors.map((actor) => <NativeSelectOption key={actor} value={actor}>{actor}</NativeSelectOption>)}</NativeSelect></div><div className="grid min-w-0 gap-1 text-xs font-medium"><label htmlFor={`${fieldId}-level`}>{t('Level')}</label><NativeSelect id={`${fieldId}-level`} className={inputClass} value={level} onChange={(event) => changeLevel(event.target.value)}><NativeSelectOption value="all">{t('All levels')}</NativeSelectOption><NativeSelectOption value="warn+">{t('Warning and up')}</NativeSelectOption><NativeSelectOption value="error">{t('Errors only')}</NativeSelectOption><NativeSelectOption value="warn">{t('Warnings only')}</NativeSelectOption><NativeSelectOption value="info">{t('Info')}</NativeSelectOption><NativeSelectOption value="debug">Debug</NativeSelectOption></NativeSelect></div></div>
    <div className="grid grid-cols-2 gap-2"><label className="grid min-w-0 gap-1 text-xs font-medium">Controller<Input value={filters.get('controller') ?? ''} onChange={(event) => onChange('controller', event.target.value)} placeholder={t('Controller name')} /></label><label className="grid min-w-0 gap-1 text-xs font-medium">{t('Kind prefix')}<Input value={filters.get('kind') ?? ''} onChange={(event) => onChange('kind', event.target.value)} placeholder={t('Example: reconciler.')} /></label></div>
    <div className="grid grid-cols-2 gap-2"><label className="grid min-w-0 gap-1 text-xs font-medium">{t('From')}<Input type="datetime-local" value={asTime(filters.get('since'))} onChange={(event) => onChange('since', fromTime(event.target.value))} /></label><label className="grid min-w-0 gap-1 text-xs font-medium">{t('Until')}<Input type="datetime-local" value={asTime(filters.get('until'))} onChange={(event) => onChange('until', fromTime(event.target.value))} /></label></div>
  </div>;
}

const chipClass = 'max-w-full min-w-0 [&>select]:text-xs';
const ranges = [['900000', 'Last 15 minutes'], ['3600000', 'Last hour'], ['86400000', 'Last 24 hours'], ['604800000', 'Last 7 days']] as const;

function FilterBar({ filters, onChange, contract, onMore, activeCount, workflows }: { filters: URLSearchParams; onChange: (name: string, value: string) => void; contract: ContractInfo | null; workflows: Pick<WorkflowRow, 'id' | 'name' | 'project'>[]; onMore: () => void; activeCount: number }) {
  const level = filters.get('minLevel') === 'warn' ? 'warn+' : filters.get('level') ?? 'all';
  const customRange = filters.has('since') || filters.has('until');
  const chip = (active: boolean) => ({ className: `${chipClass}${active ? ' [&>select]:bg-muted' : ''}`, size: 'sm' as const, 'data-active': active });
  const advancedActive = filters.has('wf') || filters.has('actor') || filters.has('kind') || customRange || filters.has('since') || filters.has('until');
  const workflowValue = filters.has('wf') ? JSON.stringify([filters.get('project') ?? '', filters.get('wf')]) : '';
  return <div className="flex flex-col gap-3" role="group" aria-label={t('Log filters')}>
    <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1 sm:max-w-sm"><Input type="search" className="h-8 text-xs" aria-label={t('Search the logs')} value={filters.get('q') ?? ''} onChange={(event) => onChange('q', event.target.value)} placeholder={t('Search the logs')} /></div>
        <NativeSelect aria-label={t('Minimum level')} {...chip(level !== 'all')} value={level} onChange={(event) => onChange('levelChoice', event.target.value)}><NativeSelectOption value="all">{t('All levels')}</NativeSelectOption><NativeSelectOption value="warn+">{t('Level ≥ warning')}</NativeSelectOption><NativeSelectOption value="error">{t('Errors only')}</NativeSelectOption><NativeSelectOption value="warn">{t('Warnings only')}</NativeSelectOption><NativeSelectOption value="info">{t('Info only')}</NativeSelectOption><NativeSelectOption value="debug">{t('Debug only')}</NativeSelectOption></NativeSelect>
    {activeCount > 0 && <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => onChange('clear', '')}><X size={14} /> {t('Clear filters ({n})', { n: activeCount })}</Button>}
    </div>
    <Advanced title={t('Advanced filters')} summary={t('Workflow, actor, kind, time range and other filters')} defaultOpen={advancedActive}>
      <div className="flex flex-wrap items-center gap-2">
        <NativeSelect aria-label="Workflow" {...chip(filters.has('wf'))} value={workflowValue} onChange={(event) => onChange('workflowChoice', event.target.value)}><NativeSelectOption value="">{t('Workflow: all')}</NativeSelectOption>{workflowValue && !workflows.some((item) => JSON.stringify([item.project, item.id]) === workflowValue) && <NativeSelectOption value={workflowValue}>{filters.get('wf')}</NativeSelectOption>}{workflows.map((item) => <NativeSelectOption key={`${item.project}:${item.id}`} value={JSON.stringify([item.project, item.id])}>{item.name} · {item.project}</NativeSelectOption>)}</NativeSelect>
        <NativeSelect aria-label="Actor" {...chip(filters.has('actor'))} value={filters.get('actor') ?? ''} onChange={(event) => onChange('actor', event.target.value)}><NativeSelectOption value="">{t('Actor: all')}</NativeSelectOption>{contract?.vocab.logActors.map((actor) => <NativeSelectOption key={actor} value={actor}>{t('Actor: {actor}', { actor })}</NativeSelectOption>)}</NativeSelect>
        <NativeSelect aria-label={t('Kind')} {...chip(filters.has('kind'))} value={filters.get('kind') ?? ''} onChange={(event) => onChange('kind', event.target.value)}>{kindFamilies.map((item) => <NativeSelectOption key={item.value} value={item.value}>{item.value ? t('Kind: {kind}', { kind: item.label }) : t('Kind: all')}</NativeSelectOption>)}{filters.get('kind') && !kindFamilies.some((item) => item.value === filters.get('kind')) && <NativeSelectOption value={filters.get('kind') ?? ''}>{t('Kind: {kind}', { kind: filters.get('kind') ?? '' })}</NativeSelectOption>}</NativeSelect>
        <NativeSelect aria-label={t('Time range')} {...chip(customRange)} value={customRange ? 'custom' : ''} onChange={(event) => { const value = event.target.value; if (value === 'custom') return; onChange('until', ''); onChange('since', value ? String(Date.now() - Number(value)) : ''); }}><NativeSelectOption value="">{t('All time')}</NativeSelectOption>{ranges.map(([value, label]) => <NativeSelectOption key={value} value={value}>{t(label)}</NativeSelectOption>)}{customRange && <NativeSelectOption value="custom">{t('Custom range')}</NativeSelectOption>}</NativeSelect>
    <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={onMore}><SlidersHorizontal size={14} /> {t('More filters')}</Button>
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
  const workflowList = useApiQuery<WorkflowRow[]>('/api/workflows?phase=all&limit=100', { topics: ['workers'], intervalMs: 60_000 });
  const [streamStatus, setStreamStatus] = useState<'connecting' | 'live' | 'reconnecting'>('connecting');
  const [streamed, setStreamed] = useState<LogRow[]>([]);
  const [streamEpoch, setStreamEpoch] = useState(filterKey);
  const currentFilter = useRef(filterKey);
  currentFilter.current = filterKey;
  const searching = filters.has('q'), exactRecord = filters.has('id');
  const following = follow && !searching && !exactRecord;
  const contract = useApiQuery<ContractInfo>('/api/contract', { topics: ['system'], intervalMs: 60_000 });

  const change = (name: string, value: string) => {
    const next = new URLSearchParams(window.location.hash.split('?')[1] ?? '');
    if (name === 'clear') { for (const field of filterFields) next.delete(field); }
    else if (name === 'workflowChoice') {
      if (!value) next.delete('wf');
      else { try { const [project, wf] = JSON.parse(value) as [string, string]; next.set('project', project); next.set('wf', wf); } catch { return; } }
    } else if (name === 'levelChoice') {
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
  const logs = usePagedApiQuery<LogRow>(apiUrl, { topics: ['logs'], intervalMs: 30_000, getKey: row => row.key });

  useEffect(() => { setStreamed([]); setPending([]); setFresh(new Set()); setStreamEpoch(filterKey); pausedRef.current = false; }, [filterKey]);
  useEffect(() => {
    if (!following) { setStreamStatus('connecting'); return; }
    let active = true;
    const isCurrent = () => active && currentFilter.current === filterKey;
    const stream = new EventSource(streamUrl);
    setStreamStatus('connecting');
    stream.onopen = () => { if (isCurrent()) setStreamStatus('live'); };
    stream.onerror = () => { if (isCurrent()) setStreamStatus('reconnecting'); };
    const onLog = (event: MessageEvent<string>) => {
      if (!isCurrent()) return;
      try {
        const row = JSON.parse(event.data) as LogRow;
        if (!row.key || typeof row.at !== 'number') return;
        if (knownRef.current.has(row.key) || (oldestRef.current != null && row.at < oldestRef.current)) return;
        knownRef.current.add(row.key);
        if (pausedRef.current) { setPending((current) => unique([row, ...current]).slice(0, 200)); return; }
        setStreamed((current) => unique([row, ...current]).slice(0, 200));
        setFresh((current) => new Set(current).add(row.key));
        setTimeout(() => { if (isCurrent()) setFresh((current) => { const next = new Set(current); next.delete(row.key); return next; }); }, 2000);
      } catch { /* A malformed frame cannot replace a valid row. */ }
    };
    stream.addEventListener('log', onLog as EventListener);
    stream.addEventListener('invalidate', () => { if (isCurrent()) refreshQuery(apiUrl); });
    return () => { active = false; stream.close(); };
  }, [following, streamUrl, apiUrl, filterKey]);

  const onRegionScroll = (top: number) => { pausedRef.current = top > 40; if (!pausedRef.current) flushPending(); };
  const flushPending = () => {
    if (streamEpoch !== filterKey) return;
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
  const rows = unique([...(logs.data ?? []), ...(streamEpoch === filterKey ? streamed : [])]);
  oldestRef.current = logs.data?.length ? Math.min(...logs.data.map((row) => row.at)) : null;
  knownRef.current = new Set(rows.map((row) => row.key));
  const activeCount = filterFields.filter((field) => filters.has(field)).length;
  const sources = [...new Set(logs.meta?.sources.map(source => source.db) ?? [])];
  const observed = logs.data !== null || rows.length > 0;
  return <ConceptBlock concept="C17" className="flex flex-col gap-6 md:gap-8">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs text-muted-foreground">{t('StarCi / observation')}</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">{t('Logs')}</h1><p className="mt-1 text-sm text-muted-foreground">{t('The event stream from the host and project ledgers; filters live in the URL.')}</p></div>
      <div className="flex gap-2"><Button variant="outline" size="sm" className="md:hidden" onClick={() => setFilterOpen(true)}><Filter size={15} /> {t('Filters')}{activeCount ? ` (${activeCount})` : ''}</Button><Button variant={following ? 'default' : 'outline'} size="sm" aria-pressed={following} disabled={searching || exactRecord} title={searching ? t('Follow does not support full-text search; clear the keyword to enable.') : exactRecord ? t('Exact record lookup uses polling.') : undefined} onClick={() => setFollow((value) => !value)}><Radio size={15} /> {searching ? `${t('Search results')} · ${t('Polling')}` : exactRecord ? t('Polling') : following ? streamStatus === 'live' ? t('Following live') : t('Reconnecting') : t('Follow live')}</Button></div></div>
    <div className="hidden md:block"><FilterBar filters={filters} onChange={change} contract={contract.data} workflows={workflowList.data ?? []} activeCount={activeCount} onMore={() => setFilterOpen(true)} /></div>
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><div className="flex flex-wrap items-center gap-2"><span>{t('{n} rows loaded', { n: observed ? rows.length : '—' })}</span><span>{sources.length ? sources.map((source) => source === 'machine' ? t('machine') : source).join(' · ') : t('Unknown')}</span></div><div className="flex items-center gap-2"><span>{logs.meta ? t('Response read: {at}', { at: formatAbsolute(logs.meta.at) }) : t('No source timestamp yet')}</span><Button variant="ghost" size="icon" aria-label={t('Refresh')} onClick={logs.refresh}><RefreshCw size={15} /></Button></div></div>
      {streamEpoch === filterKey && pending.length > 0 && <div className="pointer-events-none sticky top-16 z-20 flex justify-center"><Button size="sm" className="pointer-events-auto rounded-full shadow-md" onClick={showPending}><ArrowUp size={14} /> {t('{n} new rows', { n: pending.length })}</Button></div>}
      {logs.error && <FeedbackState error onRetry={logs.refresh}>{logs.data ? t('The source is failing; keeping the last rows read. ') : t('Could not read the logs. ')}{logs.error}</FeedbackState>}
      {partialSources(logs).length ? <p className="shell-error" role="status">{t('Source out of sync: {list}', { list: partialSources(logs).join(', ') })}</p> : null}
      {!observed && !logs.error ? <PageSkeleton label={t('Reading the logs…')} /> : observed && (rows.length > 0 || !logs.error && !partialSources(logs).length) ? <LogView rows={rows} freshKeys={fresh} regionRef={regionRef} onRegionScroll={onRegionScroll} /> : null}
      {logs.loadMoreError && <FeedbackState error onRetry={logs.loadMoreErrorCode === 'BAD_CURSOR' ? logs.refresh : logs.loadMore}>{logs.loadMoreError}{logs.loadMoreErrorCode === 'BAD_CURSOR' ? ` · ${t('Refresh first page')}` : ''}</FeedbackState>}
      {logs.next && <Button variant="outline" className="w-full" disabled={logs.loadingMore} onClick={logs.loadMore}>{logs.loadingMore ? t('Loading…') : t('Load more')}</Button>}
    </div>
    <Drawer open={filterOpen} onOpenChange={setFilterOpen} title={t('Log filters')} description={t('The choices are saved in the URL.')}><FilterFields filters={filters} onChange={change} contract={contract.data} /><div className="mt-6 grid grid-cols-2 gap-2"><Button variant="outline" onClick={() => change('clear', '')}>{t('Clear filters')}</Button><Button onClick={() => setFilterOpen(false)}>{t('View results')}</Button></div></Drawer>
  </ConceptBlock>;
}
