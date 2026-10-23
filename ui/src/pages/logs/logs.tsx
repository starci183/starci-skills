import { useEffect, useId, useMemo, useRef, useState, type Ref } from 'react';
import { ArrowUp, Filter, Radio, RefreshCw, SlidersHorizontal, X } from 'lucide-react';
import { ToggleButton } from '@heroui/react';
import { FeedbackState, PageSkeleton, SourceWarning } from '../../components/feedback-state';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { ConceptBlock, type Concept } from '../../components/concept';
import { Drawer } from '../../components/drawer';
import { Input } from '../../components/ui/input';
import { NativeSelect, NativeSelectOption } from '../../components/ui/native-select';
import { Advanced } from '../../components/motion';
import { LogView } from '../../components/log-view';
import { kindFamilies } from '../../components/logs/kinds';
import { useApiQuery, usePagedApiQuery, refreshQuery, type PagedQuerySnapshot } from '../../api/query';
import { formatAbsolute } from '../../i18n/vi';
import { t } from '../../i18n/t';
import { useRoute } from '../../router';
import type { ContractInfo, LogRow, WorkflowRow } from '../../contract';
import { partialSources } from '../../components/charts/chart-card';

/** The business concept id (C17) under which the logs page is filed; it is stamped on data-concept so the rendered DOM traces back to its spec. */
export const concept: Concept = 'C17';

const inputClass = 'w-full min-w-0';
const filterFields = ['scope', 'source', 'id', 'project', 'wf', 'job', 'actor', 'controller', 'kind', 'level', 'minLevel', 'q', 'since', 'until'] as const;
const pad = (number: number) => String(number).padStart(2, '0');
const asTime = (value: string | null) => {
  if (!value) return '';
  const date = new Date(Number(value));
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};
const fromTime = (value: string) => value ? String(new Date(value).getTime()) : '';
const unique = (rows: LogRow[]): LogRow[] => [...new Map(rows.map((row) => [row.key, row])).values()].sort((a, b) => b.at - a.at || a.db.localeCompare(b.db) || b.seq - a.seq);

const FilterFields = ({ filters, onChange, contract }: Readonly<{ filters: URLSearchParams; onChange: (name: string, value: string) => void; contract: ContractInfo | null }>) => {
  const fieldId = useId();
  const level = filters.get('minLevel') === 'warn' ? 'warn+' : filters.get('level') ?? 'all';
  const changeLevel = (value: string) => onChange('levelChoice', value);
  return <div className="grid gap-3">
    <label className="grid gap-1 text-xs font-medium">{t('Full-text search')}<Input type="search" value={filters.get('q') ?? ''} onChange={(event) => onChange('q', event.target.value)} placeholder={t('Example: tsc-app')} /></label>
    <NativeSelect id={`${fieldId}-scope`} label={t('Scope')} className={inputClass} value={filters.get('scope') ?? 'all'} onValueChange={value => onChange('scope', value)}><NativeSelectOption id="all">{t('Host + all projects')}</NativeSelectOption><NativeSelectOption id="machine">{t('Host only')}</NativeSelectOption><NativeSelectOption id="project">{t('Projects')}</NativeSelectOption></NativeSelect>
    <NativeSelect id={`${fieldId}-project`} label={t('Project')} className={inputClass} value={filters.get('project') ?? ''} onValueChange={value => onChange('project', value)}><NativeSelectOption id="">{t('All projects')}</NativeSelectOption>{filters.get('project') && !contract?.projects.some(project => project.id === filters.get('project')) && <NativeSelectOption id={filters.get('project') ?? ''}>{filters.get('project')}</NativeSelectOption>}{contract?.projects.map((project) => <NativeSelectOption id={project.id} key={project.id} textValue={project.name}>{project.name}</NativeSelectOption>)}</NativeSelect>
    <div className="grid grid-cols-2 gap-2"><label className="grid min-w-0 gap-1 text-xs font-medium">Workflow<Input value={filters.get('wf') ?? ''} onChange={(event) => onChange('wf', event.target.value)} placeholder={t('Workflow id')} /></label><label className="grid min-w-0 gap-1 text-xs font-medium">Job<Input value={filters.get('job') ?? ''} onChange={(event) => onChange('job', event.target.value)} placeholder={t('Job id')} /></label></div>
    <div className="grid grid-cols-2 gap-2"><NativeSelect id={`${fieldId}-actor`} label="Actor" className={inputClass} value={filters.get('actor') ?? ''} onValueChange={value => onChange('actor', value)}><NativeSelectOption id="">{t('All actors')}</NativeSelectOption>{contract?.vocab.logActors.map((actor) => <NativeSelectOption key={actor} id={actor}>{actor}</NativeSelectOption>)}</NativeSelect><NativeSelect id={`${fieldId}-level`} label={t('Level')} className={inputClass} value={level} onValueChange={changeLevel}><NativeSelectOption id="all">{t('All levels')}</NativeSelectOption><NativeSelectOption id="warn+">{t('Warning and up')}</NativeSelectOption><NativeSelectOption id="error">{t('Errors only')}</NativeSelectOption><NativeSelectOption id="warn">{t('Warnings only')}</NativeSelectOption><NativeSelectOption id="info">{t('Info')}</NativeSelectOption><NativeSelectOption id="debug">Debug</NativeSelectOption></NativeSelect></div>
    <div className="grid grid-cols-2 gap-2"><label className="grid min-w-0 gap-1 text-xs font-medium">Controller<Input value={filters.get('controller') ?? ''} onChange={(event) => onChange('controller', event.target.value)} placeholder={t('Controller name')} /></label><label className="grid min-w-0 gap-1 text-xs font-medium">{t('Kind prefix')}<Input value={filters.get('kind') ?? ''} onChange={(event) => onChange('kind', event.target.value)} placeholder={t('Example: reconciler.')} /></label></div>
    <div className="grid grid-cols-2 gap-2"><label className="grid min-w-0 gap-1 text-xs font-medium">{t('From')}<Input type="datetime-local" value={asTime(filters.get('since'))} onChange={(event) => onChange('since', fromTime(event.target.value))} /></label><label className="grid min-w-0 gap-1 text-xs font-medium">{t('Until')}<Input type="datetime-local" value={asTime(filters.get('until'))} onChange={(event) => onChange('until', fromTime(event.target.value))} /></label></div>
  </div>;
};

const chipClass = 'max-w-full min-w-0';
const chip = (active: boolean) => ({ className: `${chipClass}${active ? ' [&_[data-slot=select-trigger]]:bg-default' : ''}`, size: 'sm' as const, 'data-active': active });
const ranges = [['900000', 'Last 15 minutes'], ['3600000', 'Last hour'], ['86400000', 'Last 24 hours'], ['604800000', 'Last 7 days']] as const;

const changeRange = (onChange: (name: string, value: string) => void, value: string): void => {
  if (value === 'custom') return;
  onChange('until', '');
  onChange('since', value ? String(Date.now() - Number(value)) : '');
};

const FilterBar = ({ filters, onChange, contract, onMore, activeCount, workflows }: Readonly<{ filters: URLSearchParams; onChange: (name: string, value: string) => void; contract: ContractInfo | null; workflows: Pick<WorkflowRow, 'id' | 'name' | 'project'>[]; onMore: () => void; activeCount: number }>) => {
  const level = filters.get('minLevel') === 'warn' ? 'warn+' : filters.get('level') ?? 'all';
  const customRange = filters.has('since') || filters.has('until');
  const advancedActive = filters.has('wf') || filters.has('actor') || filters.has('kind') || customRange || filters.has('since') || filters.has('until');
  const workflowValue = filters.has('wf') ? JSON.stringify([filters.get('project') ?? '', filters.get('wf')]) : '';
  return <fieldset className="min-w-0 flex flex-col gap-3" aria-label={t('Log filters')}>
    <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1 sm:max-w-sm"><Input type="search" className="h-8 text-xs" aria-label={t('Search the logs')} value={filters.get('q') ?? ''} onChange={(event) => onChange('q', event.target.value)} placeholder={t('Search the logs')} /></div>
        <NativeSelect aria-label={t('Minimum level')} {...chip(level !== 'all')} value={level} onValueChange={value => onChange('levelChoice', value)}><NativeSelectOption id="all">{t('All levels')}</NativeSelectOption><NativeSelectOption id="warn+">{t('Level ≥ warning')}</NativeSelectOption><NativeSelectOption id="error">{t('Errors only')}</NativeSelectOption><NativeSelectOption id="warn">{t('Warnings only')}</NativeSelectOption><NativeSelectOption id="info">{t('Info only')}</NativeSelectOption><NativeSelectOption id="debug">{t('Debug only')}</NativeSelectOption></NativeSelect>
        <NativeSelect aria-label={t('Scope')} {...chip(filters.has('scope'))} value={filters.get('scope') ?? 'all'} onValueChange={value => onChange('scope', value)}><NativeSelectOption id="all">{t('Host + all projects')}</NativeSelectOption><NativeSelectOption id="machine">{t('Host only')}</NativeSelectOption><NativeSelectOption id="project">{t('Projects')}</NativeSelectOption></NativeSelect>
        <NativeSelect aria-label={t('Project')} {...chip(filters.has('project'))} value={filters.get('project') ?? ''} onValueChange={value => onChange('project', value)}><NativeSelectOption id="">{t('All projects')}</NativeSelectOption>{filters.get('project') && !contract?.projects.some(project => project.id === filters.get('project')) && <NativeSelectOption id={filters.get('project') ?? ''}>{filters.get('project')}</NativeSelectOption>}{contract?.projects.map(project => <NativeSelectOption key={project.id} id={project.id} textValue={project.name}>{project.name}</NativeSelectOption>)}</NativeSelect>
    {activeCount > 0 && <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => onChange('clear', '')}><X size={14} /> {t('Clear filters ({n})', { n: activeCount })}</Button>}
    </div>
    <Advanced title={t('Advanced filters')} summary={t('Workflow, actor, kind, time range and other filters')} defaultOpen={advancedActive}>
      <div className="flex flex-wrap items-center gap-2">
        <NativeSelect aria-label="Workflow" {...chip(filters.has('wf'))} value={workflowValue} onValueChange={value => onChange('workflowChoice', value)}><NativeSelectOption id="">{t('Workflow: all')}</NativeSelectOption>{workflowValue && !workflows.some((item) => JSON.stringify([item.project, item.id]) === workflowValue) && <NativeSelectOption id={workflowValue}>{filters.get('wf')}</NativeSelectOption>}{workflows.map((item) => <NativeSelectOption key={`${item.project}:${item.id}`} id={JSON.stringify([item.project, item.id])} textValue={`${item.name} · ${item.project}`}>{item.name} · {item.project}</NativeSelectOption>)}</NativeSelect>
        <NativeSelect aria-label="Actor" {...chip(filters.has('actor'))} value={filters.get('actor') ?? ''} onValueChange={value => onChange('actor', value)}><NativeSelectOption id="">{t('Actor: all')}</NativeSelectOption>{contract?.vocab.logActors.map((actor) => <NativeSelectOption key={actor} id={actor}>{t('Actor: {actor}', { actor })}</NativeSelectOption>)}</NativeSelect>
        <NativeSelect aria-label={t('Kind')} {...chip(filters.has('kind'))} value={filters.get('kind') ?? ''} onValueChange={value => onChange('kind', value)}>{kindFamilies.map((item) => <NativeSelectOption key={item.value} id={item.value}>{item.value ? t('Kind: {kind}', { kind: item.label }) : t('Kind: all')}</NativeSelectOption>)}{filters.get('kind') && !kindFamilies.some((item) => item.value === filters.get('kind')) && <NativeSelectOption id={filters.get('kind') ?? ''}>{t('Kind: {kind}', { kind: filters.get('kind') ?? '' })}</NativeSelectOption>}</NativeSelect>
        <NativeSelect aria-label={t('Time range')} {...chip(customRange)} value={customRange ? 'custom' : ''} onValueChange={value => changeRange(onChange, value)}><NativeSelectOption id="">{t('All time')}</NativeSelectOption>{ranges.map(([value, label]) => <NativeSelectOption key={value} id={value}>{t(label)}</NativeSelectOption>)}{customRange && <NativeSelectOption id="custom">{t('Custom range')}</NativeSelectOption>}</NativeSelect>
    <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={onMore}><SlidersHorizontal size={14} /> {t('More filters')}</Button>
      </div>
    </Advanced>
  </fieldset>;
};

type StreamStatus = 'connecting' | 'live' | 'reconnecting';
type Live = { key: string; streamed: LogRow[]; pending: LogRow[]; fresh: ReadonlySet<string> };
const emptyLive = (key: string): Live => ({ key, streamed: [], pending: [], fresh: new Set() });
const liveFor = (prev: Live, key: string): Live => prev.key === key ? prev : emptyLive(key);
const STREAM_LIMIT = 200;

const parseStreamRow = (data: string): LogRow | null => {
  try {
    const row = JSON.parse(data) as LogRow;
    return row.key && typeof row.at === 'number' ? row : null;
  } catch { return null; /* A malformed frame cannot replace a valid row. */ }
};

/** Live tail: rows streamed after the first page, held back while the reader has scrolled away from the top. */
const useLogStream = (filterKey: string, following: boolean, streamUrl: string, apiUrl: string, base: LogRow[] | null) => {
  const [liveState, setLive] = useState<Live>(() => emptyLive(filterKey));
  const [status, setStatus] = useState<StreamStatus>('connecting');
  const pausedRef = useRef(false);
  const oldestRef = useRef<number | null>(null);
  const knownRef = useRef<Set<string>>(new Set());
  const live = useMemo(() => liveFor(liveState, filterKey), [liveState, filterKey]);
  const rows = useMemo(() => unique([...(base ?? []), ...live.streamed]), [base, live.streamed]);

  useEffect(() => {
    oldestRef.current = base?.length ? Math.min(...base.map((row) => row.at)) : null;
    knownRef.current = new Set(rows.map((row) => row.key));
  }, [base, rows]);
  useEffect(() => { pausedRef.current = false; }, [filterKey]);
  useEffect(() => {
    if (!following) return;
    let active = true;
    const stream = new EventSource(streamUrl);
    const clearFresh = (key: string) => {
      if (!active) return;
      setLive((prev) => {
        const current = liveFor(prev, filterKey);
        const next = new Set(current.fresh);
        next.delete(key);
        return { ...current, fresh: next };
      });
    };
    const accept = (row: LogRow) => {
      if (knownRef.current.has(row.key) || (oldestRef.current != null && row.at < oldestRef.current)) return;
      knownRef.current.add(row.key);
      if (pausedRef.current) {
        setLive((prev) => { const current = liveFor(prev, filterKey); return { ...current, pending: unique([row, ...current.pending]).slice(0, STREAM_LIMIT) }; });
        return;
      }
      setLive((prev) => {
        const current = liveFor(prev, filterKey);
        return { ...current, streamed: unique([row, ...current.streamed]).slice(0, STREAM_LIMIT), fresh: new Set(current.fresh).add(row.key) };
      });
      setTimeout(() => clearFresh(row.key), 2000);
    };
    stream.onopen = () => { if (active) setStatus('live'); };
    stream.onerror = () => { if (active) setStatus('reconnecting'); };
    stream.addEventListener('log', (event) => {
      const row = active && event instanceof MessageEvent && typeof event.data === 'string' ? parseStreamRow(event.data) : null;
      if (row) accept(row);
    });
    stream.addEventListener('invalidate', () => { if (active) refreshQuery(apiUrl); });
    return () => { active = false; stream.close(); setStatus('connecting'); };
  }, [following, streamUrl, apiUrl, filterKey]);

  const flushPending = () => {
    if (!live.pending.length) return;
    setLive((prev) => {
      const current = liveFor(prev, filterKey);
      if (!current.pending.length) return current;
      return { key: filterKey, streamed: unique([...current.pending, ...current.streamed]).slice(0, STREAM_LIMIT), pending: [], fresh: new Set(current.pending.map((row) => row.key)) };
    });
    setTimeout(() => setLive((prev) => ({ ...prev, fresh: new Set() })), 2000);
  };
  const onScroll = (top: number) => {
    pausedRef.current = top > 40;
    if (!pausedRef.current) flushPending();
  };
  const resume = () => { pausedRef.current = false; flushPending(); };
  return { rows, pending: live.pending, fresh: live.fresh, status, onScroll, resume };
};

const applyWorkflowChoice = (next: URLSearchParams, value: string): boolean => {
  if (!value) { next.delete('wf'); return true; }
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return false;
    const project: unknown = parsed[0], wf: unknown = parsed[1];
    if (typeof project !== 'string' || typeof wf !== 'string') return false;
    next.set('project', project);
    next.set('wf', wf);
    return true;
  } catch { return false; }
};

const applyLevelChoice = (next: URLSearchParams, value: string): void => {
  next.delete('level');
  next.delete('minLevel');
  if (value === 'warn+') next.set('minLevel', 'warn');
  else if (value !== 'all') next.set('level', value);
};

/** Updates the filters held in the URL hash; unparsable workflow choices are ignored. */
const changeFilter = (name: string, value: string): void => {
  const next = new URLSearchParams(window.location.hash.split('?')[1] ?? '');
  if (name === 'clear') for (const field of filterFields) next.delete(field);
  else if (name === 'workflowChoice') { if (!applyWorkflowChoice(next, value)) return; }
  else if (name === 'levelChoice') applyLevelChoice(next, value);
  else if (value) next.set(name, value);
  else next.delete(name);
  const search = next.size ? `?${next}` : '';
  window.location.hash = `#/logs${search}`;
};

const followLabel = (searching: boolean, exactRecord: boolean, following: boolean, status: StreamStatus): string => {
  if (searching) return `${t('Search results')} · ${t('Polling')}`;
  if (exactRecord) return t('Polling');
  if (!following) return t('Follow live');
  return status === 'live' ? t('Following live') : t('Reconnecting');
};

const followHint = (searching: boolean, exactRecord: boolean): string | undefined => {
  if (searching) return t('Follow does not support full-text search; clear the keyword to enable.');
  return exactRecord ? t('Exact record lookup uses polling.') : undefined;
};

type FollowState = { searching: boolean; exactRecord: boolean; following: boolean; status: StreamStatus };

const LogsHeader = ({ activeCount, follow, onFollow, onOpenFilters }: Readonly<{ activeCount: number; follow: FollowState; onFollow: (value: boolean) => void; onOpenFilters: () => void }>) => {
  const { searching, exactRecord, following, status } = follow;
  return <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs text-muted-foreground">{t('StarCi / observation')}</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">{t('Logs')}</h1><p className="mt-1 text-sm text-muted-foreground">{t('The event stream from the host and project ledgers; filters live in the URL.')}</p></div>
    <div className="flex gap-2"><Button variant="outline" size="sm" className="md:hidden" onClick={onOpenFilters}><Filter size={15} /> {t('Filters')}{activeCount ? ` (${activeCount})` : ''}</Button><span title={followHint(searching, exactRecord)}><ToggleButton size="sm" isSelected={following} isDisabled={searching || exactRecord} onChange={onFollow}><Radio size={15} /> {followLabel(searching, exactRecord, following, status)}</ToggleButton></span></div></div>;
};

const LogsSummary = ({ logs, rowCount, observed }: Readonly<{ logs: PagedQuerySnapshot<LogRow>; rowCount: number; observed: boolean }>) => {
  const sources = [...new Set(logs.meta?.sources.map(source => source.db) ?? [])];
  return <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><div className="flex flex-wrap items-center gap-2"><span>{t('{n} rows loaded', { n: observed ? rowCount : '—' })}</span><span>{sources.length ? sources.map((source) => source === 'machine' ? t('machine') : source).join(' · ') : t('Unknown')}</span></div><div className="flex min-w-0 items-center gap-2"><span>{logs.observedAt !== null ? t('Last successful API read: {at}', { at: formatAbsolute(logs.observedAt) }) : t('No successful API read yet')}</span><Button variant="ghost" size="icon" aria-label={t('Refresh')} onClick={logs.refresh}><RefreshCw size={15} /></Button></div></div>;
};

type LogListProps = Readonly<{ logs: PagedQuerySnapshot<LogRow>; rows: LogRow[]; observed: boolean; fresh: ReadonlySet<string>; regionRef: Ref<HTMLDivElement>; onRegionScroll: (top: number) => void }>;

const LogList = ({ logs, rows, observed, fresh, regionRef, onRegionScroll }: LogListProps) => {
  const unreadable = partialSources(logs).length > 0;
  const showRows = observed && (rows.length > 0 || !logs.error && !unreadable);
  const refreshFirst = logs.loadMoreErrorCode === 'BAD_CURSOR';
  const waiting = !observed && !logs.error;
  return <>
    {logs.error && <FeedbackState error onRetry={logs.refresh}>{logs.data ? t('The source is failing; keeping the last rows read. ') : t('Could not read the logs. ')}{logs.error}</FeedbackState>}
    {unreadable ? <SourceWarning>{t('Source out of sync: {list}', { list: partialSources(logs).join(', ') })}</SourceWarning> : null}
    {waiting ? <PageSkeleton label={t('Reading the logs…')} /> : null}
    {!waiting && showRows ? <LogView rows={rows} freshKeys={fresh} regionRef={regionRef} onRegionScroll={onRegionScroll} /> : null}
    {logs.loadMoreError && <FeedbackState error onRetry={refreshFirst ? logs.refresh : logs.loadMore}>{logs.loadMoreError}{refreshFirst ? ` · ${t('Refresh first page')}` : ''}</FeedbackState>}
    {logs.next && <Button variant="outline" className="w-full" disabled={logs.loadingMore} onClick={logs.loadMore}>{logs.loadingMore ? t('Loading…') : t('Load more')}</Button>}
  </>;
};

const LogsPage = () => {
  const route = useRoute();
  const filterKey = route.kind === 'logs' ? route.filters.toString() : '';
  const filters = useMemo(() => new URLSearchParams(filterKey), [filterKey]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [follow, setFollow] = useState(true);
  const regionRef = useRef<HTMLDivElement | null>(null);
  const workflowList = useApiQuery<WorkflowRow[]>('/api/workflows?phase=all&limit=100', { topics: ['workers'], intervalMs: 60_000 });
  const searching = filters.has('q'), exactRecord = filters.has('id');
  const following = follow && !searching && !exactRecord;
  const contract = useApiQuery<ContractInfo>('/api/contract', { topics: ['system'], intervalMs: 60_000 });

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
  const stream = useLogStream(filterKey, following, streamUrl, apiUrl, logs.data);

  const showPending = () => { regionRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); stream.resume(); };
  const activeCount = filterFields.filter((field) => filters.has(field)).length;
  const observed = logs.data !== null || stream.rows.length > 0;
  return <ConceptBlock concept="C17" className="flex flex-col gap-6 md:gap-8">
    <LogsHeader activeCount={activeCount} follow={{ searching, exactRecord, following, status: stream.status }} onFollow={setFollow} onOpenFilters={() => setFilterOpen(true)} />
    <Card size="sm" className="hidden md:block"><CardContent><FilterBar filters={filters} onChange={changeFilter} contract={contract.data} workflows={workflowList.data ?? []} activeCount={activeCount} onMore={() => setFilterOpen(true)} /></CardContent></Card>
    <div className="flex min-w-0 flex-col gap-3">
      <LogsSummary logs={logs} rowCount={stream.rows.length} observed={observed} />
      {stream.pending.length > 0 && <div className="pointer-events-none sticky top-16 z-20 flex justify-center"><Button size="sm" className="pointer-events-auto rounded-full shadow-md" onClick={showPending}><ArrowUp size={14} /> {t('{n} new rows', { n: stream.pending.length })}</Button></div>}
      <LogList logs={logs} rows={stream.rows} observed={observed} fresh={stream.fresh} regionRef={regionRef} onRegionScroll={stream.onScroll} />
    </div>
    <Drawer open={filterOpen} onOpenChange={setFilterOpen} title={t('Log filters')} description={t('The choices are saved in the URL.')}><FilterFields filters={filters} onChange={changeFilter} contract={contract.data} /><div className="mt-6 grid grid-cols-2 gap-2"><Button variant="outline" onClick={() => changeFilter('clear', '')}>{t('Clear filters')}</Button><Button onClick={() => setFilterOpen(false)}>{t('View results')}</Button></div></Drawer>
  </ConceptBlock>;
};

export default LogsPage;
