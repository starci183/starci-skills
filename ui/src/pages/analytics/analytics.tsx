import { useEffect, useMemo, useState } from 'react';
import { useApiQuery } from '../../api/query';
import type { AttemptRow, Envelope, FleetViewV2 } from '../../contract';
import type { Concept } from '../../components/concept';
import { Advanced, Ticker } from '../../components/motion';
import { counts, fmtDayClock } from '../../components/charts/analytics-data';
import { DurationPlot } from '../../components/charts/duration-plot';
import { ModelRates } from '../../components/charts/model-rates';
import { OpOutcomes } from '../../components/charts/op-outcomes';
import { Retries } from '../../components/charts/retries';
import { Throughput } from '../../components/charts/throughput';
import { UsagePanel, type OpsMetric } from '../../components/charts/usage-panel';
import { WorkflowProgress } from '../../components/charts/workflow-progress';

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
  window.location.hash = `/analytics${params.size ? `?${params}` : ''}`;
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

/** All attempts of the project(s), following `meta.next` cursors; refreshed every 30 s. */
function useAllAttempts(project: string): { rows: AttemptRow[] | null; error: string | null } {
  const [state, setState] = useState<{ key: string; rows: AttemptRow[] | null; error: string | null }>({ key: project, rows: null, error: null });
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    async function load() {
      try {
        const all: AttemptRow[] = [];
        let cursor: string | null = null;
        for (let page = 0; page < 50; page += 1) {
          const query = new URLSearchParams({ limit: '200' });
          if (project) query.set('project', project);
          if (cursor) query.set('cursor', cursor);
          const response = await fetch(`/api/attempts?${query}`, { signal: controller.signal });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const body = await response.json() as Envelope<AttemptRow[]>;
          all.push(...body.data);
          cursor = body.meta.next ?? null;
          if (!cursor) break;
        }
        if (!cancelled) setState({ key: project, rows: all, error: null });
      } catch (error) {
        if (!cancelled && !controller.signal.aborted) setState(prev => ({ key: project, rows: prev.key === project ? prev.rows : null, error: error instanceof Error ? error.message : 'Lỗi tải' }));
      }
    }
    void load();
    const timer = setInterval(() => void load(), 30_000);
    return () => { cancelled = true; controller.abort(); clearInterval(timer); };
  }, [project]);
  return { rows: state.key === project ? state.rows : null, error: state.error };
}

function Segmented({ value, onChange }: { value: Window; onChange: (value: Window) => void }) {
  const options: { value: Window; label: string }[] = [{ value: '24h', label: '24 giờ' }, { value: '7d', label: '7 ngày' }];
  return <div role="group" aria-label="Khoảng thời gian" className="inline-flex gap-1 rounded-lg border bg-muted/40 p-1">
    {options.map(o => <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}
      className={`h-8 rounded-md px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${value === o.value ? 'bg-background text-foreground shadow-sm ring-1 ring-foreground/10' : 'text-muted-foreground hover:text-foreground'}`}>{o.label}</button>)}
  </div>;
}

function Count({ tone, label, n }: { tone: 'success' | 'failed' | 'running'; label: string; n: number }) {
  return <span data-tone={tone} className="inline-flex items-center gap-1.5"><span className="status-dot" aria-hidden="true" /><strong className="tabular-nums text-foreground"><Ticker value={n} /></strong> {label}</span>;
}

export default function AnalyticsPage() {
  const params = useHashParams();
  const project = params.get('project') ?? '';
  const win: Window = params.get('window') === '24h' ? '24h' : '7d';
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(timer); }, []);

  const attempts = useAllAttempts(project);
  const metricsUrl = `/api/metrics/ops?window=${win}${project ? `&project=${encodeURIComponent(project)}` : ''}`;
  const metrics = useApiQuery<OpsMetric[]>(metricsUrl, { topics: ['fleet'], intervalMs: 30_000 });
  const fleet = useApiQuery<FleetViewV2>('/api/fleet', { topics: ['fleet'], intervalMs: 30_000 });
  const projects = useApiQuery<{ id: string; name: string; product: string | null }[]>('/api/projects', { topics: ['fleet'], intervalMs: 60_000 });

  const since = now - (win === '24h' ? DAY : 7 * DAY);
  const rows = useMemo(() => (attempts.rows ?? []).filter(r => (r.dispatchedAt ?? 0) >= since), [attempts.rows, since]);
  const c = useMemo(() => counts(rows), [rows]);
  const workflows = new Set(rows.map(r => `${r.project}/${r.wf}`)).size;
  const times = rows.flatMap(r => [r.dispatchedAt, r.settledAt]).filter((t): t is number => t != null);
  const from = times.length ? Math.min(...times) : null, to = times.length ? Math.max(...times) : null;
  const loading = attempts.rows === null && !attempts.error;

  return <main className="page-shell flex flex-col gap-6 md:gap-8" data-concept="C16">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Phân tích</p>
        <h1 className="text-2xl font-semibold tracking-tight">{loading ? 'Đang tải…' : <><Ticker value={rows.length} /> lần thử · <Ticker value={workflows} /> workflow</>}</h1>
        <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {from != null && to != null ? <span>{fmtDayClock(from)} → {fmtDayClock(to)}</span> : <span>{win === '24h' ? '24 giờ' : '7 ngày'} qua</span>}
          <Count tone="success" label="đạt" n={c.pass} /><Count tone="failed" label="hỏng/chặn" n={c.bad} /><Count tone="running" label="đang chạy" n={c.run} />
          {c.dropped > 0 ? <span><strong className="tabular-nums text-foreground"><Ticker value={c.dropped} /></strong> đã bỏ</span> : null}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="an-project">Dự án</label>
        <select id="an-project" value={project} onChange={e => setParam('project', e.target.value || null)}
          className="h-9 min-w-0 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <option value="">Mọi dự án</option>
          {(projects.data ?? []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <Segmented value={win} onChange={value => setParam('window', value === '7d' ? null : value)} />
      </div>
    </div>

    {attempts.error && !attempts.rows ? <p role="alert" className="rounded-lg border border-[var(--status-failed-line)] bg-[var(--status-failed-bg)] p-3 text-sm text-[var(--status-failed)]">Không tải được danh sách lần thử ({attempts.error}).</p> : null}

    <div className="grid min-w-0 grid-cols-1 items-start gap-4 lg:grid-cols-2 lg:gap-6">
      <OpOutcomes rows={rows} />
      <Throughput rows={rows} since={since} now={now} />
      <WorkflowProgress fleet={fleet.data} project={project} />
    </div>
    <Advanced variant="card" title="Phân tích chi tiết" summary="Tỉ lệ theo model, thời lượng, thử lại, token và chi phí">
      <div className="grid min-w-0 grid-cols-1 items-start gap-4 lg:grid-cols-2 lg:gap-6">
        <ModelRates rows={rows} />
        <DurationPlot rows={rows} now={now} />
        <Retries rows={rows} />
        <UsagePanel metrics={metrics.data} window={win} summary={fleet.data?.summary ?? null} />
      </div>
    </Advanced>
  </main>;
}
