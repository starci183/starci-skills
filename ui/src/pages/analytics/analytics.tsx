import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Chip, ToggleButton, ToggleButtonGroup } from '@heroui/react';
import { isReadErrorEnvelope, readEnvelope, useApiQuery } from '../../api/query';
import type { AttemptRow, ReadSource, WorkersViewV2 } from '../../contract';
import type { Concept } from '../../components/concept';
import { Advanced, Ticker } from '../../components/motion';
import { FeedbackState, PageSkeleton, SourceWarning } from '../../components/feedback-state';
import { counts, fmtDayClock } from '../../components/charts/analytics-data';
import { DurationPlot } from '../../components/charts/duration-plot';
import { ModelRates } from '../../components/charts/model-rates';
import { OpOutcomes } from '../../components/charts/op-outcomes';
import { Retries } from '../../components/charts/retries';
import { Throughput } from '../../components/charts/throughput';
import { UsagePanel } from '../../components/charts/usage-panel';
import { WorkflowProgress } from '../../components/charts/workflow-progress';
import { t } from '../../i18n/t';
import { formatAbsolute } from '../../i18n/vi';
import { Card, CardContent } from '../../components/ui/card';
import { NativeSelect, NativeSelectOption } from '../../components/ui/native-select';

export const concept: Concept = 'C16';

type Window = '24h' | '7d';
const DAY = 86_400_000;

function hashParams(): URLSearchParams {
  try { return new URL(window.location.hash.slice(1) || '/analytics', window.location.origin).searchParams; }
  catch { return new URLSearchParams(); }
}
function setParam(key: string, value: string | null): void {
  const params = hashParams();
  if (value) params.set(key, value); else params.delete(key);
  const search = params.size ? `?${params}` : '';
  window.location.hash = `/analytics${search}`;
}
function useHashParams() {
  const [params, setParams] = useState(hashParams);
  useEffect(() => {
    const onChange = () => setParams(hashParams());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return params;
}

type AttemptRead = { rows: AttemptRow[] | null; error: string | null; stale: string[]; truncated: boolean; observedAt: number | null; since: number | null; until: number | null };

type AttemptState = AttemptRead & { key: string };
type Loaded = { rows: AttemptRow[]; stale: Set<string>; truncated: boolean; since: number; until: number };

function isAttemptRow(row: unknown): row is AttemptRow {
  return typeof row === 'object' && row !== null
    && 'id' in row && Number.isSafeInteger(row.id)
    && 'project' in row && typeof row.project === 'string'
    && 'wf' in row && typeof row.wf === 'string'
    && 'op' in row && typeof row.op === 'string';
}

function markUnavailable(meta: { sources: readonly ReadSource[]; stale?: readonly string[] } | undefined, into: Set<string>): void {
  for (const source of meta?.stale ?? []) into.add(source);
  for (const source of meta?.sources ?? []) if (source.availability && source.availability !== 'available') into.add(`${source.db}:${source.rel}`);
}

async function readFailure(response: Response, failedSources: Set<string>): Promise<Error> {
  const payload: unknown = await response.json().catch(() => null);
  if (!isReadErrorEnvelope(payload)) return new Error(`HTTP ${response.status}`);
  markUnavailable(payload.meta, failedSources);
  return new Error(payload.error.message);
}

async function loadAttempts(project: string, win: Window, signal: AbortSignal, failedSources: Set<string>): Promise<Loaded> {
  const rows: AttemptRow[] = [];
  const stale = new Set<string>();
  let cursor: string | null = null;
  const until = Date.now(), since = until - (win === '24h' ? DAY : 7 * DAY);
  for (let page = 0; page < 50; page += 1) {
    const query = new URLSearchParams({ limit: '200', since: String(since), until: String(until) });
    if (project) query.set('project', project);
    if (cursor) query.set('cursor', cursor);
    const response = await fetch(`/api/attempts?${query}`, { signal });
    if (!response.ok) throw await readFailure(response, failedSources);
    const body = readEnvelope<AttemptRow[]>(await response.json(), (data): data is AttemptRow[] => Array.isArray(data) && data.every(isAttemptRow));
    rows.push(...body.data);
    markUnavailable(body.meta, stale);
    cursor = body.meta.next ?? null;
    if (!cursor) break;
  }
  return { rows, stale, truncated: cursor !== null, since, until };
}

function failedState(prev: AttemptState, key: string, failedSources: ReadonlySet<string>, error: unknown): AttemptState {
  const same = prev.key === key;
  return {
    key, rows: same ? prev.rows : null, stale: [...new Set([...(same ? prev.stale : []), ...failedSources])], truncated: same && prev.truncated,
    observedAt: same ? prev.observedAt : null, since: same ? prev.since : null, until: same ? prev.until : null,
    error: error instanceof Error ? error.message : t('Load error'),
  };
}

/** Loaded dispatch cohort, following `meta.next` cursors; refreshed every 30 s. */
function useAllAttempts(project: string, win: Window, retryKey: number): AttemptRead {
  const key = `${project}\u0000${win}`;
  const [state, setState] = useState<AttemptState>({ key, rows: null, error: null, stale: [], truncated: false, observedAt: null, since: null, until: null });
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    let busy = false;
    async function load() {
      if (busy) return;
      busy = true;
      const failedSources = new Set<string>();
      try {
        const loaded = await loadAttempts(project, win, controller.signal, failedSources);
        if (!cancelled) setState({ key, rows: [...new Map(loaded.rows.map(row => [`${row.project}:${row.id}`, row])).values()], error: null, stale: [...loaded.stale], truncated: loaded.truncated, observedAt: Date.now(), since: loaded.since, until: loaded.until });
      } catch (error) {
        if (!cancelled && !controller.signal.aborted) setState(prev => failedState(prev, key, failedSources, error));
      } finally { busy = false; }
    }
    void load();
    const timer = setInterval(() => void load(), 30_000);
    return () => { cancelled = true; controller.abort(); clearInterval(timer); };
  }, [project, win, key, retryKey]);
  return state.key === key ? state : { rows: null, error: null, stale: [], truncated: false, observedAt: null, since: null, until: null };
}

function Segmented({ value, onChange }: Readonly<{ value: Window; onChange: (value: Window) => void }>) {
  const options: { value: Window; label: string }[] = [{ value: '24h', label: t('24 hours') }, { value: '7d', label: t('7 days') }];
  return <ToggleButtonGroup aria-label={t('Time window')} selectionMode="single" disallowEmptySelection selectedKeys={new Set([value])} size="sm"
    onSelectionChange={keys => { const selected = [...keys][0]; if (selected === '24h' || selected === '7d') onChange(selected); }}>
    {options.map(option => <ToggleButton key={option.value} id={option.value}>{option.label}</ToggleButton>)}
  </ToggleButtonGroup>;
}

function Count({ tone, label, n }: Readonly<{ tone: 'success' | 'failed' | 'running' | 'settling' | 'retry' | 'dropped' | 'unknown'; label: string; n: number }>) {
  const color = { success: 'success', failed: 'danger', running: 'accent', settling: 'warning', retry: 'accent', dropped: 'default', unknown: 'default' } as const;
  return <Chip color={color[tone]} variant="soft" size="sm"><strong className="tabular-nums"><Ticker value={n} /></strong> {label}</Chip>;
}

type ProjectOption = { id: string; name: string };

function AnalyticsHeader({ project, win, projects, summary }: Readonly<{ project: string; win: Window; projects: readonly ProjectOption[]; summary: ReactNode }>) {
  return <div className="flex flex-wrap items-end justify-between gap-3">
    <div className="min-w-0">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('StarCi / observation')}</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{t('Analytics')}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{summary}</p>
    </div>
    <div className="flex flex-wrap items-center gap-2">
      <NativeSelect id="an-project" aria-label={t('Project')} value={project} onValueChange={value => setParam('project', value || null)}
        className="w-full min-w-0 sm:w-64">
        <NativeSelectOption id="">{t('All projects')}</NativeSelectOption>
        {project && !projects.some(p => p.id === project) ? <NativeSelectOption id={project}>{project}</NativeSelectOption> : null}
        {projects.map(p => <NativeSelectOption key={p.id} id={p.id} textValue={p.name}>{p.name}</NativeSelectOption>)}
      </NativeSelect>
      <Segmented value={win} onChange={value => setParam('window', value === '7d' ? null : value)} />
    </div>
  </div>;
}

function AttemptNotices({ attempts, win, since, until, onRetry }: Readonly<{ attempts: AttemptRead; win: Window; since: number; until: number; onRetry: () => void }>) {
  return <>
    {attempts.error ? <FeedbackState error onRetry={onRetry}>{attempts.rows ? t('The source is failing; keeping the last rows read. ') : null}{t('Could not load the attempt list ({error}).', { error: attempts.error })}</FeedbackState> : null}
    {attempts.stale.length ? <SourceWarning>{t('Source out of sync: {list}', { list: attempts.stale.join(', ') })}</SourceWarning> : null}
    {attempts.truncated ? <FeedbackState>{t('Analytics reached the 10,000-row cap; charts cover the loaded dispatch cohort only.')}</FeedbackState> : null}
    <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2 text-xs text-muted-foreground">
      <div className="flex min-w-0 flex-col gap-1"><p>{fmtDayClock(since)} → {fmtDayClock(until)} · UTC+7</p><p>{t('Dispatch cohort: {window}. Counts describe loaded records; settlements are not a separate settlement-window total.', { window: win === '24h' ? t('24 hours') : t('7 days') })}</p></div>
      <p>{attempts.observedAt !== null ? t('Last successful API read: {at}', { at: formatAbsolute(attempts.observedAt) }) : t('No successful API read yet')}</p>
    </div>
  </>;
}

function CountsCard({ c }: Readonly<{ c: ReturnType<typeof counts> }>) {
  return <Card size="sm"><CardContent className="flex flex-wrap items-center gap-2"><Count tone="success" label={t('passed')} n={c.pass} /><Count tone="failed" label={t('failed/blocked')} n={c.bad} /><Count tone="running" label={t('running')} n={c.run} />
    {c.dropped > 0 ? <Count tone="dropped" label={t('dropped')} n={c.dropped} /> : null}
    {c.settling > 0 ? <Count tone="settling" label={t('Settling')} n={c.settling} /> : null}
    {c.retry > 0 ? <Count tone="retry" label={t('Requeued')} n={c.retry} /> : null}
    {c.unknown > 0 ? <Count tone="unknown" label={t('Unknown')} n={c.unknown} /> : null}
  </CardContent></Card>;
}

export default function AnalyticsPage() {
  const params = useHashParams();
  const project = params.get('project') ?? '';
  const win: Window = params.get('window') === '24h' ? '24h' : '7d';
  const [now, setNow] = useState(() => Date.now());
  const [retryKey, setRetryKey] = useState(0);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(timer); }, []);

  const attempts = useAllAttempts(project, win, retryKey);
  const workers = useApiQuery<WorkersViewV2>('/api/workers', { topics: ['workers'], intervalMs: 30_000 });
  const projects = useApiQuery<{ id: string; name: string; product: string | null }[]>('/api/projects', { topics: ['workers'], intervalMs: 60_000 });

  const until = attempts.until ?? now;
  const since = attempts.since ?? until - (win === '24h' ? DAY : 7 * DAY);
  const rows = useMemo(() => (attempts.rows ?? []).filter(r => (r.dispatchedAt ?? 0) >= since), [attempts.rows, since]);
  const c = useMemo(() => counts(rows), [rows]);
  const workflows = new Set(rows.map(r => `${r.project}/${r.wf}`)).size;
  const loading = attempts.rows === null && !attempts.error;
  const observed = attempts.rows !== null;
  const chartable = observed && (rows.length > 0 || !attempts.error && !attempts.stale.length);
  const idle = loading ? t('Loading…') : t('Unknown');
  const summary = observed ? <><Ticker value={rows.length} /> {t('attempts')} · <Ticker value={workflows} /> {t('workflows')}</> : idle;

  return <section className="page-shell flex flex-col gap-6 md:gap-8" data-concept="C16">
    <AnalyticsHeader project={project} win={win} projects={projects.data ?? []} summary={summary} />
    <AttemptNotices attempts={attempts} win={win} since={since} until={until} onRetry={() => setRetryKey(value => value + 1)} />
    {observed ? <CountsCard c={c} /> : null}

    {loading ? <PageSkeleton label={t('Loading…')} /> : null}
    {observed && !chartable ? <FeedbackState>{t('Available sources returned no attempts; the full scope is incomplete.')}</FeedbackState> : null}
    <div className="grid min-w-0 grid-cols-1 items-start gap-4 lg:grid-cols-2 lg:gap-6">
      {chartable ? <><OpOutcomes rows={rows} /><Throughput rows={rows} since={since} now={until} /></> : null}
      <WorkflowProgress workers={workers} project={project} />
    </div>
    <Advanced variant="card" title={t('Detailed analytics')} summary={t('Rates by model, durations, retries, tokens and cost')}>
      <div className="grid min-w-0 grid-cols-1 items-start gap-4 lg:grid-cols-2 lg:gap-6">
        {chartable ? <><ModelRates rows={rows} /><DurationPlot rows={rows} now={now} /><Retries rows={rows} /></> : null}
        <UsagePanel window={win} project={project} />
      </div>
    </Advanced>
  </section>;
}
