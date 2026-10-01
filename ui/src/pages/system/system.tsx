import { useState, type ReactNode } from 'react';
import { ArrowUpRight, Clock3, ExternalLink } from 'lucide-react';
import { Advanced } from '../../components/motion';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { ConceptBlock, type Concept } from '../../components/concept';
import { DataTable, type DataColumn } from '../../components/data-table';
import { FeedbackState, PageSkeleton } from '../../components/feedback-state';
import { Drawer } from '../../components/drawer';
import { BlobText } from '../../components/blob-text';
import { StateChip } from '../../components/state-chip';
import { useApiQuery, type QuerySnapshot } from '../../api/query';
import { formatAbsolute, formatRelative, learningKindLabels, learningStateLabels } from '../../i18n/vi';
import { t } from '../../i18n/t';
import { useRoute, systemTabs, type SystemTab } from '../../router';
import { HostCard } from '../../components/host/host-card';
import type { ActionRow, BlobLink, HealthSummary, LandRun, ReconcilerView, Ref, ResourcesView, UiState } from '../../contract';

export const concept: Concept = 'C13';

type Service = { name: string; kind: string; state: string; ui: UiState; since: number; restarts24h: number; failedProbes24h: number; lastProbe: { at: number; ok: boolean; latencyMs: number | null; detail: unknown } | null; port: number | null; url: string | null; quarantinedUntil: number | null };
type Seat = { id: string; role: string; project: string | null; wf: string | null; state: string; parkedReason: string | null; ui: UiState; terminal: Ref | null; agent: string | null; model: string | null; bootedAt: number | null; lastSeenAt: number | null; replacedCount: number; inputFailuresConsecutive: number; deaf: boolean; lastSnapshotAt: number | null; transcript: BlobLink | null };
type Terminal = { handle: string; title: string; role: string; openedAt: number; closedAt: number | null; closeVerifiedAt: number | null; closedBy: string | null; ui: UiState };
type SlaClock = { id: string; entity: string; state: string; code: string; severity: string; project: string | null; wf: string | null; enteredAt: number; slaMs: number; dueAt: number; violatedAt: number | null; clearedAt: number | null; clearReason: string | null; di: Ref | null; ui: UiState };
type Violation = { id: string; code: string; severity: 'warn' | 'critical'; entity: Ref | { text: string }; project: string | null; violatedAt: number; clearedAt: number | null; di: Ref | null; lesson: Ref | null; detail: unknown };
type Catalog = { code: string; state: string; slaMs: number | null; warnMs: number | null; severity: string; owner: string; autoAction: string };
type GcRun = { id: number; startedAt: number; finishedAt: number | null; trigger: string; freedBytes: number; counts: Record<string, number>; errors: number; report: BlobLink | null; ui: UiState };
type Leak = { kind: string; target: string; project: string | null; since: number; owner: Ref | null };
type LandView = { queue: { ticket: string; lane: string; commit: string; state: string; enqueuedAt: number; gateAt: number | null; busyHolder: string | null; startedAt: number | null; ui: UiState }[]; recent: LandRun[]; pushes: { repo: string; branch: string; head: string; from: string; to: string; result: string; reason: string | null; failureSignature: string | null; stdout: BlobLink | null; stderr: BlobLink | null; at: number; ui: UiState }[] };
type Lane = { name: string; worktree: string | null; branch: string; baseSha: string | null; headSha: string | null; owner: string | null; supJob: Ref | null; state: string; ui: UiState; createdAt: number; landedAt: number | null; removedAt: number | null; report: BlobLink | null };
type Supervisor = { seat: Seat | null; decisionsOpen: number; overdue: number; undelivered: number; owed: { id: string; kind: string; subject: string; openedAt: number; dueAt: number | null; acked: boolean; ui: UiState }[]; workersActive: number; lastDigestAt: number | null; urgent24h: number };
type SupervisorWorker = { job: string; lane: string | null; kind: string; title: string; status: string; attempt: { agent: string | null; model: string | null; terminal: string | null; worktree: string | null; branch: string | null; spawnedAt: number | null; reportedAt: number | null; landedAt: number | null; verdict: string | null; landedSha: string | null; tokensIn: number | null; tokensOut: number | null; costUsd: number | null; transcript: BlobLink | null } | null; ui: UiState };
type Lesson = { id: string; kind: string; parent: string | null; title: string; state: string; source: Ref | null; lane: string | null; landedSha: string | null; createdAt: number; updatedAt: number };
type Ruling = { id: string; saidAt: number; channel: string; verbatim: string; paraphrase: string; appliesTo: string | null; contractRef: string | null };
type Score = { op: string; agent: string; model: string; attempts: number; pass: number; fail: number; blocked: number; workerDead: number; passRate: number | null; p50CycleMs: number | null; p90QueueMs: number | null; topFailure: { class: string; n: number }[]; tokensIn: number | null; tokensOut: number | null; costUsd: number | null };

const tabLabels: Record<SystemTab, string> = { engine: 'Engine', sla: 'SLA', resources: t('Resources'), services: t('Services'), cleanup: t('Cleanup'), land: 'Land', supervisor: 'Supervisor', learning: t('Learning') };
const tabConcepts: Record<SystemTab, Concept> = { engine: 'C13', sla: 'C13', resources: 'C14', services: 'C3', cleanup: 'C15', land: 'C11', supervisor: 'C3', learning: 'C16' };
const isIssue = (state: UiState | null | undefined) => state === 'bad' || state === 'warn';
const dash = (value: unknown): string => value == null || value === '' ? '—' : String(value);
const at = (value: number | null | undefined) => value == null ? '—' : formatAbsolute(value);
const number = (value: number | null | undefined, digits = 0) => value == null ? '—' : new Intl.NumberFormat('vi-VN', { maximumFractionDigits: digits }).format(value);
const stateOf = (rows: { ui: UiState }[]): UiState => rows.some((row) => row.ui === 'bad') ? 'bad' : rows.some((row) => row.ui === 'warn') ? 'warn' : 'ok';

function RefLink({ refValue }: { refValue: Ref | null }) { return refValue ? <a className="inline-flex items-center gap-1 text-primary hover:underline" href={refValue.href}>{refValue.id}<ArrowUpRight size={12} /></a> : <span>—</span>; }
function BlobLinkButton({ blob, label }: { blob: BlobLink | null; label: string }) { return blob ? <a className="inline-flex items-center gap-1 text-primary hover:underline" href={blob.href} target="_blank" rel="noreferrer">{label}<ExternalLink size={12} /></a> : <span className="text-muted-foreground">{t('No {label} yet', { label: label.toLowerCase() })}</span>; }
function QueryView<T>({ query, children, empty = t('No data yet.') }: { query: QuerySnapshot<T>; children: (data: T) => ReactNode; empty?: string }) {
  if (query.data == null) return query.error ? <FeedbackState error>{t('Could not read the source: {error}', { error: query.error })}</FeedbackState> : query.loading ? <PageSkeleton label={t('Reading the data…')} /> : <FeedbackState>{empty}</FeedbackState>;
  return <>{query.error && <p className="shell-error mb-3" role="status">{t('The source is failing; showing the last read. {error}', { error: query.error })}</p>}{query.meta?.stale?.length ? <p className="shell-error mb-3" role="status">{t('Source out of sync: {list}', { list: query.meta.stale.join(', ') })}</p> : null}{children(query.data)}</>;
}
function Panel({ title, summary, ui = 'ok', concept: blockConcept, children }: { title: string; summary?: string; ui?: UiState; concept: Concept; children: ReactNode }) {
  return <ConceptBlock concept={blockConcept}><Advanced key={isIssue(ui) ? 'issue' : 'calm'} variant="card" defaultOpen={ui === 'bad'} summary={summary}
    title={<span className="inline-flex items-center gap-3">{title}<StateChip state={ui} compact /></span>}>{children}</Advanced></ConceptBlock>;
}
function QueryPanel<T>({ title, summary, ui = 'ok', concept: blockConcept, query, children }: { title: string; summary?: string; ui?: UiState; concept: Concept; query: QuerySnapshot<T>; children: (data: T) => ReactNode }) {
  if (query.data == null) return <ConceptBlock concept={blockConcept}><Card><CardContent><h2 className="mb-3 text-sm font-medium">{title}</h2><QueryView query={query}>{children}</QueryView></CardContent></Card></ConceptBlock>;
  return <Panel title={title} summary={summary} ui={query.error ? 'warn' : ui} concept={blockConcept}><QueryView query={query}>{children}</QueryView></Panel>;
}
function Metric({ label, value, help }: { label: string; value: ReactNode; help?: string }) { return <div className="flex flex-col gap-1 border-t p-4 min-[760px]:p-6"><div className="text-xs text-muted-foreground">{label}</div><div className="text-lg font-semibold tabular-nums">{value}</div>{help && <div className="text-xs text-muted-foreground">{help}</div>}</div>; }

const tabItemKeys: Partial<Record<SystemTab, HealthSummary['items'][number]['key'][]>> = { sla: ['sla'], services: ['services', 'seats'], cleanup: ['leaks', 'gc'], land: ['land'] };
function TabSummary({ items }: { items: HealthSummary['items'] }) {
  if (!items.length) return null;
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{items.map((item) => <Metric key={item.key} label={item.key} value={<StateChip state={item.ui} label={item.value} />} />)}</div>;
}

function EngineTab() {
  const view = useApiQuery<ReconcilerView>('/api/reconciler', { topics: ['system'], intervalMs: 15_000 });
  const actions = useApiQuery<ActionRow[]>('/api/reconciler/actions?limit=50', { topics: ['system'], intervalMs: 30_000 });
  const queue = useApiQuery<{ controller: string; key: string; dueAt: number; reason: string | null; tries: number; lastError: string | null }[]>('/api/reconciler/queue', { topics: ['system'], intervalMs: 15_000 });
  const [selected, setSelected] = useState<ActionRow | null>(null);
  const columns: DataColumn<ReconcilerView['controllers'][number]>[] = [
    { key: 'controller', header: 'Controller', render: (row) => <span className="font-medium">{row.name}</span> },
    { key: 'mode', header: t('Mode'), render: (row) => <span><Badge variant="outline">{row.mode}</Badge><small className="block text-muted-foreground" title={row.modeSetBy ?? undefined}>{at(row.modeSetAt)}</small></span> },
    { key: 'queue', header: t('Queue'), numeric: true, render: (row) => number(row.queue.depth) },
    { key: 'actions', header: t('24 h done / failed'), numeric: true, render: (row) => `${number(row.actions24h.done)} / ${number(row.actions24h.failed + row.actions24h.unknown)}` },
    { key: 'error', header: t('Latest error'), render: (row) => row.lastError?.text ?? '—' },
    { key: 'state', header: t('State'), render: (row) => <StateChip state={row.ui} compact /> },
  ];
  return <ConceptBlock concept="C13" className="flex flex-col gap-6"><QueryView query={view}>{(data) => <>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label="Leader epoch" value={data.leader?.epoch ?? '—'} help={data.leader ? t('Last heartbeat {ago}', { ago: formatRelative(data.leader.heartbeatAt) }) : t('No leader yet')} />
      <Metric label={t('Queue')} value={data.queueDepth} />
      <Metric label={t('Starts / 1 hour')} value={data.startsLastHour} help={data.crashLoop ? t('Crash-loop signs') : undefined} />
      <Metric label={t('Open violations')} value={data.openViolations} />
    </div>
    {data.leader?.lastError && <p className="shell-error">{t('Engine error: {error}', { error: data.leader.lastError })}</p>}
    <div className="flex flex-col gap-4">
      <Panel title={t('Seven controllers')} concept="C13" ui={stateOf(data.controllers)} summary={t('{n} controllers · {m} active', { n: data.controllers.length, m: data.controllers.filter((row) => row.mode === 'active').length })}><DataTable rows={data.controllers} columns={columns} getKey={(row) => row.name} /></Panel>
      <Panel title={t('Schedules')} concept="C13" ui={stateOf(data.schedules)} summary={t('{n} duties', { n: data.schedules.length })}><DataTable rows={data.schedules} getKey={(row) => `${row.controller}:${row.duty}`} columns={[
        { key: 'duty', header: 'Duty', render: (row) => `${row.controller} · ${row.duty}` }, { key: 'interval', header: t('Interval'), render: (row) => t('{n} sec', { n: number(row.intervalMs / 1000, 1) }) },
        { key: 'last', header: t('Last run'), render: (row) => at(row.lastStartedAt) }, { key: 'next', header: t('Next'), render: (row) => at(row.nextDueAt) }, { key: 'state', header: t('State'), render: (row) => <StateChip state={row.ui} compact /> },
      ]} /></Panel>
      <Panel title={t('Engine starts')} concept="C13" ui={data.crashLoop || data.badExits24h ? 'warn' : 'ok'} summary={t('{n} times / 24 hours', { n: data.starts24h.length })}><DataTable rows={data.starts24h} getKey={(row) => `${row.at}:${row.reason}`} columns={[
        { key: 'at', header: t('Started'), render: (row) => at(row.at) }, { key: 'reason', header: t('Reason'), render: (row) => row.reason }, { key: 'end', header: t('Ended'), render: (row) => at(row.endedAt) }, { key: 'exit', header: t('Stop reason'), render: (row) => dash(row.exitReason) },
      ]} /></Panel>
    </div>
  </>}</QueryView>
    <QueryPanel title={t('Recent actions')} concept="C13" query={actions} ui={actions.data ? stateOf(actions.data) : 'unknown'} summary={actions.data ? t('{n} actions', { n: actions.data.length }) : undefined}>{(rows) => <DataTable rows={rows} getKey={(row) => row.id} columns={[
      { key: 'at', header: t('Started'), render: (row) => at(row.startedAt) }, { key: 'controller', header: 'Controller', render: (row) => row.controller }, { key: 'action', header: t('Action'), render: (row) => row.duty ?? row.verb ?? row.id },
      { key: 'mode', header: 'Mode', render: (row) => row.mode ?? '—' }, { key: 'state', header: t('Outcome'), render: (row) => <StateChip state={row.ui} compact /> }, { key: 'open', header: '', render: (row) => <Button variant="ghost" size="sm" onClick={() => setSelected(row)}>{t('Details')}</Button> },
    ]} />}</QueryPanel>
    <QueryPanel title={t('Engine queue')} concept="C13" query={queue} ui={queue.data?.some((row) => row.lastError) ? 'warn' : 'ok'} summary={queue.data ? t('{n} items', { n: queue.data.length }) : undefined}>{(rows) => <DataTable rows={rows} getKey={(row) => `${row.controller}:${row.key}`} columns={[
      { key: 'controller', header: 'Controller', render: (row) => row.controller }, { key: 'key', header: t('Key'), render: (row) => row.key }, { key: 'due', header: t('Due'), render: (row) => at(row.dueAt) }, { key: 'tries', header: t('Attempts'), numeric: true, render: (row) => row.tries }, { key: 'error', header: t('Error'), render: (row) => dash(row.lastError) },
    ]} />}</QueryPanel>
    <Drawer open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null); }} title={selected ? t('Action {id}', { id: selected.id }) : t('Action')} description={selected ? `${selected.controller} · ${selected.state}` : undefined}>
      {selected && <div className="flex flex-col gap-4 text-sm"><div className="grid grid-cols-2 gap-3"><Metric label={t('Started')} value={at(selected.startedAt)} /><Metric label={t('Ended')} value={at(selected.finishedAt)} /></div>
        <div>{t('Target:')} <RefLink refValue={selected.target} /></div>{selected.errorSignature && <p className="shell-error">{selected.errorSignature}</p>}
        {selected.steps.length > 0 && <DataTable rows={selected.steps} getKey={(row) => row.stepNo} columns={[{ key: 'step', header: t('Step'), render: (row) => row.step }, { key: 'at', header: t('At'), render: (row) => at(row.startedAt) }, { key: 'result', header: t('Outcome'), render: (row) => row.ok == null ? t('Unknown') : row.ok ? t('Passed') : t('Error') }]} />}
        {selected.result != null && <details><summary>{t('Structured result')}</summary><pre className="blob-text">{JSON.stringify(selected.result, null, 2)}</pre></details>}
        <div><h3 className="mb-2 font-medium">Stdout</h3><BlobText blob={selected.stdout} /></div><div><h3 className="mb-2 font-medium">Stderr</h3><BlobText blob={selected.stderr} /></div><BlobLinkButton blob={selected.resultBlob} label={t('Result blob')} />
      </div>}
    </Drawer>
  </ConceptBlock>;
}

function SlaTab() {
  const clocks = useApiQuery<SlaClock[]>('/api/sla/clocks?open=1', { topics: ['system'], intervalMs: 30_000 });
  const violations = useApiQuery<Violation[]>('/api/sla/violations?open=1', { topics: ['system'], intervalMs: 30_000 });
  const catalog = useApiQuery<Catalog[]>('/api/sla/catalog', { intervalMs: 300_000 });
  const explain = (code: string) => catalog.data?.find((item) => item.code === code);
  return <ConceptBlock concept="C13" className="flex flex-col gap-6">
    <QueryPanel title={t('Open SLA windows')} concept="C13" query={clocks} ui={clocks.data ? stateOf(clocks.data) : 'unknown'} summary={clocks.data ? t('{n} windows', { n: clocks.data.length }) : undefined}>{(rows) => <DataTable rows={rows} getKey={(row) => row.id} columns={[
      { key: 'code', header: t('Code / entity'), render: (row) => <span title={explain(row.code)?.autoAction ?? row.code}><strong>{row.code}</strong><span className="block text-xs text-muted-foreground">{row.entity}</span></span> },
      { key: 'scope', header: t('Project / workflow'), render: (row) => `${dash(row.project)} / ${dash(row.wf)}` }, { key: 'due', header: t('Due'), render: (row) => at(row.dueAt) }, { key: 'violation', header: t('Violation'), render: (row) => at(row.violatedAt) }, { key: 'status', header: t('State'), render: (row) => <StateChip state={row.ui} compact /> }, { key: 'di', header: t('Decision'), render: (row) => <RefLink refValue={row.di} /> },
    ]} />}</QueryPanel>
    <QueryPanel title={t('Invariants being violated')} concept="C13" query={violations} ui={violations.data?.some((row) => row.severity === 'critical') ? 'bad' : violations.data?.length ? 'warn' : 'ok'} summary={violations.data ? t('{n} violations', { n: violations.data.length }) : undefined}>{(rows) => <DataTable rows={rows} getKey={(row) => row.id} columns={[
      { key: 'code', header: t('Code'), render: (row) => <span title={explain(row.code)?.autoAction ?? row.code}>{row.code}</span> }, { key: 'severity', header: t('Level'), render: (row) => row.severity }, { key: 'project', header: t('Project'), render: (row) => dash(row.project) }, { key: 'at', header: t('Since'), render: (row) => at(row.violatedAt) }, { key: 'di', header: t('Decision'), render: (row) => <RefLink refValue={row.di} /> }, { key: 'lesson', header: t('Lesson'), render: (row) => <RefLink refValue={row.lesson} /> },
    ]} />}</QueryPanel>
    <QueryPanel title={t('SLA catalog')} concept="C13" query={catalog} summary={catalog.data ? t('{n} rules', { n: catalog.data.length }) : undefined}>{(rows) => <DataTable rows={rows} getKey={(row) => row.code} columns={[
      { key: 'code', header: t('Code'), render: (row) => row.code }, { key: 'sla', header: t('Due'), render: (row) => row.slaMs == null ? '—' : t('{n} sec', { n: number(row.slaMs / 1000) }) }, { key: 'owner', header: t('Accountable owner'), render: (row) => row.owner }, { key: 'auto', header: t('Automatic action'), render: (row) => row.autoAction },
    ]} />}</QueryPanel>
  </ConceptBlock>;
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return <span className="text-xs text-muted-foreground">{t('Not enough samples')}</span>;
  const max = Math.max(...values, 1), min = Math.min(...values, 0), span = Math.max(1, max - min);
  return <svg viewBox="0 0 300 64" role="img" aria-label={t('Host sample trend')} className="h-16 w-full text-primary"><polyline fill="none" stroke="currentColor" strokeWidth="2" points={values.map((value, index) => `${index * 300 / (values.length - 1)},${60 - (value - min) * 56 / span}`).join(' ')} /></svg>;
}
function ResourcesTab() {
  const resources = useApiQuery<ResourcesView>('/api/resources', { topics: ['system'], intervalMs: 15_000 });
  const samples = useApiQuery<{ at: number; ramMb: number | null; cpuPct: number | null; freeRamMb: number | null; freeRamPct: number | null; freeDiskGb: number | null; subject: string | null }[]>('/api/resources/samples?kind=host&step=5', { topics: ['system'], intervalMs: 60_000 });
  return <ConceptBlock concept="C14" className="flex flex-col gap-6"><HostCard /><QueryView query={resources}>{(data) => <>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label={t('Throttle mode')} value={<StateChip state={data.throttle.ui} label={data.throttle.mode} />} help={data.throttle.reason ?? undefined} /><Metric label={t('Effective cap')} value={number(data.throttle.effectiveCap)} /><Metric label={t('Running')} value={number(data.throttle.running)} /><Metric label={t('Free RAM')} value={data.throttle.freeRamPct == null ? '—' : `${number(data.throttle.freeRamPct, 1)}%`} /></div>
    <div className="grid gap-4 xl:grid-cols-2"><Panel title={t('Host CPU')} concept="C14" summary={t('Samples from host_samples')}><QueryView query={samples}>{(rows) => <Sparkline values={rows.map((row) => row.cpuPct).filter((value): value is number => value != null)} />}</QueryView><div className="mt-2 text-xs text-muted-foreground">{data.throttle.cpuPct == null ? t('No CPU reading yet') : t('{n}% at the latest observation', { n: number(data.throttle.cpuPct, 1) })}</div></Panel><Panel title={t('Host RAM')} concept="C14" summary={t('Samples from host_samples')}><QueryView query={samples}>{(rows) => <Sparkline values={rows.map((row) => row.freeRamPct).filter((value): value is number => value != null)} />}</QueryView></Panel></div>
    <div className="flex flex-col gap-4">
      <Panel title="Provider" concept="C14" ui={stateOf(data.providers)} summary={t('{n} providers', { n: data.providers.length })}><DataTable rows={data.providers} getKey={(row) => row.provider} columns={[{ key: 'provider', header: 'Provider', render: (row) => row.provider }, { key: 'state', header: t('Condition'), render: (row) => <StateChip state={row.ui} label={row.status} compact /> }, { key: 'strikes', header: t('Strikes'), numeric: true, render: (row) => row.strikes }, { key: 'circuit', header: t('Circuit open until'), render: (row) => at(row.circuitOpenUntil) }, { key: 'reason', header: t('Reason'), mobileStack: true, render: (row) => dash(row.reason) }]} /></Panel>
      <Panel title="Pool backoff" concept="C14" ui={stateOf(data.pools)} summary={t('{n} pools', { n: data.pools.length })}><DataTable rows={data.pools} getKey={(row) => row.pool} columns={[{ key: 'pool', header: 'Pool', render: (row) => row.pool }, { key: 'until', header: t('Waiting until'), render: (row) => at(row.untilAt) }, { key: 'strikes', header: t('Strikes'), render: (row) => row.strikes }, { key: 'reason', header: t('Reason'), render: (row) => dash(row.reason) }]} /></Panel>
      <Panel title="Quota" concept="C14" ui={stateOf(data.quotas)} summary={t('{n} quotas', { n: data.quotas.length })}><DataTable rows={data.quotas} getKey={(row) => `${row.provider}:${row.window}`} columns={[{ key: 'provider', header: 'Provider', render: (row) => row.provider }, { key: 'window', header: t('Window'), render: (row) => row.window }, { key: 'used', header: t('Used / limit'), render: (row) => `${number(row.used)} / ${number(row.limit)}` }, { key: 'reset', header: t('Reset'), render: (row) => at(row.resetAt) }, { key: 'state', header: t('State'), render: (row) => <StateChip state={row.ui} compact /> }]} /></Panel>
      <Panel title="Lease" concept="C14" summary={t('{n} resources', { n: data.leases.length })}><DataTable rows={data.leases} getKey={(row) => row.resource} columns={[{ key: 'resource', header: t('Resource'), render: (row) => row.resource }, { key: 'usage', header: t('In use / capacity'), render: (row) => `${number(row.used)} / ${number(row.capacity)}` }, { key: 'holders', header: t('Held by'), render: (row) => row.holders.map((holder) => <span key={holder.id} className="mr-2"><RefLink refValue={holder} /></span>) }]} /></Panel>
      <Panel title={t('Budget')} concept="C14" ui={stateOf(data.budgets)} summary={t('{n} scopes', { n: data.budgets.length })}><DataTable rows={data.budgets} getKey={(row) => row.scope} columns={[{ key: 'scope', header: t('Scope'), render: (row) => row.scope }, { key: 'usage', header: t('Used / reserved / limit'), render: (row) => `${number(row.used)} / ${number(row.reserved)} / ${number(row.limit)}` }, { key: 'window', header: t('Window'), render: (row) => dash(row.window) }, { key: 'state', header: t('State'), render: (row) => <StateChip state={row.ui} compact /> }]} /></Panel>
      <Panel title={t('Recent throttles')} concept="C14" ui={data.deferred.length ? 'warn' : 'ok'} summary={t('{n} decisions', { n: data.deferred.length })}><DataTable rows={data.deferred} getKey={(row) => `${row.at}:${row.job ?? ''}`} columns={[{ key: 'at', header: t('At'), render: (row) => at(row.at) }, { key: 'job', header: 'Job', render: (row) => dash(row.job) }, { key: 'reason', header: t('Reason'), render: (row) => row.reason }, { key: 'wait', header: t('Waited'), render: (row) => row.waitedMs == null ? '—' : t('{n} sec', { n: number(row.waitedMs / 1000, 1) }) }]} /></Panel>
    </div>
  </>}</QueryView></ConceptBlock>;
}

function ServicesTab() {
  const services = useApiQuery<Service[]>('/api/services', { topics: ['system'], intervalMs: 15_000 });
  const seats = useApiQuery<Seat[]>('/api/seats', { topics: ['system'], intervalMs: 15_000 });
  const terminals = useApiQuery<Terminal[]>('/api/terminals?open=1', { topics: ['system'], intervalMs: 15_000 });
  const [selected, setSelected] = useState<Service | null>(null);
  const probes = useApiQuery<{ probes: { at: number; ok: boolean; latencyMs: number | null; detail: unknown }[]; events: { at: number; from: string; to: string; probeMs: number | null; probeError: string | null; action: string | null }[] }>(`/api/services/${encodeURIComponent(selected?.name ?? '')}/probes`, { topics: ['system'], intervalMs: 60_000, enabled: Boolean(selected) });
  return <ConceptBlock concept="C3" className="flex flex-col gap-6">
    <QueryPanel title={t('Services')} concept="C3" query={services} ui={services.data ? stateOf(services.data) : 'unknown'} summary={services.data ? t('{n} services', { n: services.data.length }) : undefined}>{(rows) => <DataTable rows={rows} getKey={(row) => row.name} columns={[{ key: 'name', header: t('Service'), render: (row) => <span className="font-medium">{row.name}</span> }, { key: 'state', header: t('State'), render: (row) => <StateChip state={row.ui} label={row.state} compact /> }, { key: 'probe', header: t('Latest probe'), render: (row) => row.lastProbe ? `${row.lastProbe.ok ? t('Passed') : t('Error')} · ${at(row.lastProbe.at)}` : t('None yet') }, { key: 'failed', header: t('Failed probes / 24 h'), render: (row) => row.failedProbes24h }, { key: 'open', header: '', render: (row) => <Button variant="ghost" size="sm" onClick={() => setSelected(row)}>{t('Details')}</Button> }]} />}</QueryPanel>
    <QueryPanel title={t('Agent seats')} concept="C3" query={seats} ui={seats.data ? stateOf(seats.data) : 'unknown'} summary={seats.data ? t('{sup} Supervisor · {ker} Kernel', { sup: seats.data.filter((row) => row.role === 'supervisor').length, ker: seats.data.filter((row) => row.role === 'kernel').length }) : undefined}>{(rows) => <><p className="mb-3 text-xs text-muted-foreground">{t('One global Supervisor seat; a Kernel is bound to each workflow. Executing ops live inside attempts.')}</p><DataTable rows={rows} getKey={(row) => row.id} columns={[{ key: 'seat', header: t('Seat'), render: (row) => <span className="font-medium">{row.id}</span> }, { key: 'role', header: t('Role / workflow'), render: (row) => `${row.role} · ${dash(row.wf)}` }, { key: 'model', header: 'Agent / model', render: (row) => `${dash(row.agent)} / ${dash(row.model)}` }, { key: 'state', header: t('State'), render: (row) => <><StateChip state={row.ui} label={row.state} compact />{row.deaf && <span className="ml-2 text-destructive">{t('Lost signal')}</span>}</> }, { key: 'seen', header: t('Last seen'), render: (row) => at(row.lastSeenAt) }, { key: 'transcript', header: t('Record'), render: (row) => <BlobLinkButton blob={row.transcript} label={t('Record')} /> }]} /></>}</QueryPanel>
    <QueryPanel title={t('Open terminals')} concept="C3" query={terminals} ui={terminals.data ? stateOf(terminals.data) : 'unknown'} summary={terminals.data ? t('{n} terminals', { n: terminals.data.length }) : undefined}>{(rows) => <DataTable rows={rows} getKey={(row) => row.handle} columns={[{ key: 'title', header: 'Terminal', render: (row) => row.title }, { key: 'role', header: t('Role'), render: (row) => row.role }, { key: 'seen', header: t('First seen'), render: (row) => at(row.openedAt) }, { key: 'state', header: t('State'), render: (row) => <StateChip state={row.ui} compact /> }]} />}</QueryPanel>
    <Drawer open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null); }} title={selected?.name ?? t('Service')} description={t('Probes and state transitions from the runtime source')}>
      <QueryView query={probes}>{(data) => <div className="flex flex-col gap-4"><h3 className="font-medium">{t('Recent probes')}</h3><DataTable rows={data.probes} getKey={(row) => row.at} columns={[{ key: 'at', header: t('At'), render: (row) => at(row.at) }, { key: 'result', header: t('Outcome'), render: (row) => row.ok ? t('Passed') : t('Error') }, { key: 'latency', header: t('Latency'), render: (row) => row.latencyMs == null ? '—' : `${number(row.latencyMs)} ms` }]} /><h3 className="font-medium">{t('Events')}</h3><DataTable rows={data.events} getKey={(row) => `${row.at}:${row.to}`} columns={[{ key: 'at', header: t('At'), render: (row) => at(row.at) }, { key: 'transition', header: t('Transition'), render: (row) => `${row.from} → ${row.to}` }, { key: 'action', header: t('Action'), render: (row) => dash(row.action) }]} /></div>}</QueryView>
    </Drawer>
  </ConceptBlock>;
}

function CleanupTab() {
  const runs = useApiQuery<GcRun[]>('/api/gc/runs', { topics: ['system'], intervalMs: 60_000 });
  const leaks = useApiQuery<Leak[]>('/api/leaks', { topics: ['system'], intervalMs: 60_000 });
  const [selected, setSelected] = useState<GcRun | null>(null);
  const details = useApiQuery<{ run: GcRun; items: { collector: string; kind: string; target: string; owner: Ref | null; ageMs: number | null; action: string; reason: string | null; bytes: number | null; tries: number; outcome: string; lastError: string | null; verifiedGoneAt: number | null; at: number }[] }>(`/api/gc/runs/${selected?.id ?? 0}`, { enabled: Boolean(selected), intervalMs: 60_000 });
  return <ConceptBlock concept="C15" className="flex flex-col gap-6"><QueryPanel title={t('Open leaks')} concept="C15" query={leaks} ui={leaks.data?.length ? 'warn' : 'ok'} summary={leaks.data ? t('{n} items', { n: leaks.data.length }) : undefined}>{(rows) => <DataTable rows={rows} getKey={(row) => `${row.kind}:${row.target}`} columns={[{ key: 'kind', header: t('Kind'), render: (row) => row.kind }, { key: 'target', header: t('Target'), render: (row) => row.target }, { key: 'project', header: t('Project'), render: (row) => dash(row.project) }, { key: 'since', header: t('Since'), render: (row) => at(row.since) }, { key: 'owner', header: t('Owner'), render: (row) => <RefLink refValue={row.owner} /> }]} />}</QueryPanel>
    <QueryPanel title={t('Cleanup runs')} concept="C15" query={runs} ui={runs.data ? stateOf(runs.data) : 'unknown'} summary={runs.data ? t('{n} runs', { n: runs.data.length }) : undefined}>{(rows) => <DataTable rows={rows} getKey={(row) => row.id} columns={[{ key: 'id', header: t('Run'), render: (row) => row.id }, { key: 'start', header: t('Started'), render: (row) => at(row.startedAt) }, { key: 'trigger', header: t('Source'), render: (row) => row.trigger }, { key: 'freed', header: t('Freed'), render: (row) => t('{n} bytes', { n: number(row.freedBytes) }) }, { key: 'errors', header: t('Error'), render: (row) => row.errors }, { key: 'state', header: t('State'), render: (row) => <StateChip state={row.ui} compact /> }, { key: 'open', header: '', render: (row) => <Button variant="ghost" size="sm" onClick={() => setSelected(row)}>{t('Details')}</Button> }]} />}</QueryPanel>
    <Drawer open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null); }} title={selected ? t('Cleanup #{id}', { id: selected.id }) : t('Cleanup')} description={selected ? `${selected.trigger} · ${at(selected.startedAt)}` : undefined}><QueryView query={details}>{(data) => <div className="flex flex-col gap-4"><BlobLinkButton blob={data.run.report} label={t('Report')} /><DataTable rows={data.items} getKey={(row) => `${row.collector}:${row.target}:${row.at}`} columns={[{ key: 'kind', header: t('Kind'), render: (row) => `${row.collector} · ${row.kind}` }, { key: 'target', header: t('Target'), render: (row) => row.target }, { key: 'action', header: t('Action'), render: (row) => row.action }, { key: 'outcome', header: t('Outcome'), render: (row) => row.outcome }, { key: 'error', header: t('Error'), render: (row) => dash(row.lastError) }]} /></div>}</QueryView></Drawer>
  </ConceptBlock>;
}

function LandTab() {
  const land = useApiQuery<LandView>('/api/land', { topics: ['system'], intervalMs: 30_000 });
  const runs = useApiQuery<LandRun[]>('/api/land/runs?limit=50', { topics: ['system'], intervalMs: 60_000 });
  const lanes = useApiQuery<Lane[]>('/api/lanes', { topics: ['system'], intervalMs: 60_000 });
  const [selected, setSelected] = useState<LandRun | null>(null);
  return <ConceptBlock concept="C11" className="flex flex-col gap-6"><QueryView query={land}>{(data) => <>
    <Panel title={t('Land queue')} concept="C11" ui={stateOf(data.queue)} summary={t('{n} tickets', { n: data.queue.length })}><DataTable rows={data.queue} getKey={(row) => row.ticket} columns={[{ key: 'ticket', header: 'Ticket', render: (row) => row.ticket }, { key: 'lane', header: 'Lane', render: (row) => row.lane }, { key: 'commit', header: 'Commit', render: (row) => row.commit.slice(0, 10) }, { key: 'enqueued', header: t('Enqueued at'), render: (row) => at(row.enqueuedAt) }, { key: 'state', header: t('State'), render: (row) => <StateChip state={row.ui} label={row.state} compact /> }]} /></Panel>
    <div><Panel title="Push" concept="C11" ui={stateOf(data.pushes)} summary={t('{n} recent runs', { n: data.pushes.length })}><DataTable rows={data.pushes} getKey={(row) => `${row.repo}:${row.at}`} columns={[{ key: 'repo', header: 'Repository', render: (row) => row.repo }, { key: 'branch', header: t('Branch'), render: (row) => row.branch }, { key: 'at', header: t('At'), render: (row) => at(row.at) }, { key: 'result', header: t('Outcome'), render: (row) => <StateChip state={row.ui} label={row.result} compact /> }, { key: 'reason', header: t('Reason'), render: (row) => dash(row.reason) }, { key: 'stderr', header: 'Stderr', render: (row) => <BlobLinkButton blob={row.stderr} label="Stderr" /> }]} /></Panel></div>
  </>}</QueryView>
    <QueryPanel title={t('Land results')} concept="C11" query={runs} ui={runs.data ? stateOf(runs.data) : 'unknown'} summary={runs.data ? t('{n} recent runs', { n: runs.data.length }) : undefined}>{(rows) => <DataTable rows={rows} getKey={(row) => row.id} columns={[{ key: 'id', header: t('Run'), render: (row) => row.id }, { key: 'lane', header: 'Lane', render: (row) => dash(row.lane) }, { key: 'commit', header: 'Commit', render: (row) => row.commit.slice(0, 10) }, { key: 'result', header: t('Outcome'), render: (row) => <StateChip state={row.ui} label={row.result} compact /> }, { key: 'reason', header: t('Reason'), render: (row) => dash(row.reason) }, { key: 'open', header: '', render: (row) => <Button variant="ghost" size="sm" onClick={() => setSelected(row)}>{t('Evidence')}</Button> }]} />}</QueryPanel>
    <QueryPanel title="Lane" concept="C11" query={lanes} ui={lanes.data ? stateOf(lanes.data) : 'unknown'} summary={lanes.data ? t('{n} lanes', { n: lanes.data.length }) : undefined}>{(rows) => <DataTable rows={rows} getKey={(row) => row.name} columns={[{ key: 'name', header: 'Lane', render: (row) => row.name }, { key: 'branch', header: t('Branch'), render: (row) => row.branch }, { key: 'state', header: t('State'), render: (row) => <StateChip state={row.ui} label={row.state} compact /> }, { key: 'head', header: 'Head', render: (row) => row.headSha?.slice(0, 10) ?? '—' }, { key: 'report', header: t('Report'), render: (row) => <BlobLinkButton blob={row.report} label={t('Report')} /> }]} />}</QueryPanel>
    <Drawer open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null); }} title={selected ? `Land #${selected.id}` : 'Land'} description={selected ? `${selected.result} · ${selected.lane ?? t('no lane')}` : undefined}>
      {selected && <div className="flex flex-col gap-4"><div className="grid grid-cols-2 gap-3"><Metric label="Commit" value={selected.commit.slice(0, 12)} /><Metric label={t('SHA after land')} value={selected.landedSha?.slice(0, 12) ?? '—'} /></div>{selected.reason && <p className="shell-error">{selected.reason}</p>}<div><h3 className="mb-2 font-medium">Stderr</h3><BlobText blob={selected.stderr} /></div><div><h3 className="mb-2 font-medium">Stdout</h3><BlobText blob={selected.stdout} /></div></div>}
    </Drawer>
  </ConceptBlock>;
}

function SupervisorTab() {
  const supervisor = useApiQuery<Supervisor>('/api/supervisor', { topics: ['system'], intervalMs: 30_000 });
  const workers = useApiQuery<SupervisorWorker[]>('/api/supervisor/workers?state=active', { topics: ['system'], intervalMs: 30_000 });
  const notices = useApiQuery<{ id: string; channel: string; kind: string; text: string; sentAt: number; delivery: string; media: BlobLink | null }[]>('/api/notifications', { topics: ['system'], intervalMs: 60_000 });
  return <ConceptBlock concept="C3" className="flex flex-col gap-6"><QueryView query={supervisor}>{(data) => <>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label={t('Global Supervisor seat')} value={data.seat ? <StateChip state={data.seat.ui} label={data.seat.state} /> : t('No seat yet')} help={data.seat ? `${dash(data.seat.agent)} · ${dash(data.seat.model)}` : undefined} /><Metric label={t('Open decisions')} value={data.decisionsOpen} help={t('{n} overdue', { n: data.overdue })} /><Metric label={t('Not delivered to a seat')} value={data.undelivered} /><Metric label={t('Supervisor workers')} value={data.workersActive} /></div>
    <p className="text-xs text-muted-foreground">{t('The Supervisor is a single global seat; Supervisor workers do the watching. Per-workflow Kernels and per-attempt ops are shown on their own pages.')}</p>
    <div><Panel title={t('What the Supervisor owes')} concept="C3" ui={stateOf(data.owed)} summary={t('{n} items', { n: data.owed.length })}><DataTable rows={data.owed} getKey={(row) => row.id} columns={[{ key: 'subject', header: t('Work'), render: (row) => row.subject }, { key: 'kind', header: t('Kind'), render: (row) => row.kind }, { key: 'open', header: t('Opened at'), render: (row) => at(row.openedAt) }, { key: 'due', header: t('Due'), render: (row) => at(row.dueAt) }, { key: 'state', header: t('State'), render: (row) => <StateChip state={row.ui} label={row.acked ? t('Claimed') : t('Open')} compact /> }]} /></Panel></div>
  </>}</QueryView>
    <QueryPanel title={t("The Supervisor's workers")} concept="C3" query={workers} ui={workers.data ? stateOf(workers.data) : 'unknown'} summary={workers.data ? t('{n} active workers', { n: workers.data.length }) : undefined}>{(rows) => <DataTable rows={rows} getKey={(row) => row.job} columns={[{ key: 'title', header: t('Work'), render: (row) => row.title }, { key: 'agent', header: 'Agent / model', render: (row) => row.attempt ? `${dash(row.attempt.agent)} / ${dash(row.attempt.model)}` : t('Not dispatched') }, { key: 'lane', header: 'Lane', render: (row) => dash(row.lane) }, { key: 'state', header: t('State'), render: (row) => <StateChip state={row.ui} label={row.status} compact /> }, { key: 'transcript', header: t('Record'), render: (row) => <BlobLinkButton blob={row.attempt?.transcript ?? null} label={t('Record')} /> }]} />}</QueryPanel>
    <QueryPanel title={t('Notifications')} concept="C17" query={notices} summary={notices.data ? t('{n} notifications', { n: notices.data.length }) : undefined}>{(rows) => <DataTable rows={rows} getKey={(row) => row.id} columns={[{ key: 'at', header: t('At'), render: (row) => at(row.sentAt) }, { key: 'kind', header: t('Kind / channel'), render: (row) => `${row.kind} · ${row.channel}` }, { key: 'text', header: t('Content'), render: (row) => row.text }, { key: 'delivery', header: t('Delivery'), render: (row) => row.delivery }]} />}</QueryPanel>
  </ConceptBlock>;
}

function LearningTab() {
  const lessons = useApiQuery<Lesson[]>('/api/supervisor/lessons', { topics: ['system'], intervalMs: 300_000 });
  const rulings = useApiQuery<Ruling[]>('/api/supervisor/rulings', { topics: ['system'], intervalMs: 300_000 });
  const scores = useApiQuery<Score[]>('/api/metrics/ops?window=7d', { topics: ['system'], intervalMs: 300_000 });
  return <ConceptBlock concept="C16" className="flex flex-col gap-6">
    <QueryPanel title={t('Lessons and experiments')} concept="C16" query={lessons} summary={lessons.data ? t('{n} items', { n: lessons.data.length }) : undefined}>{(rows) => <DataTable rows={rows} getKey={(row) => row.id} columns={[{ key: 'title', header: t('Lesson'), render: (row) => <span className="font-medium">{row.title}</span> }, { key: 'kind', header: t('Kind'), render: (row) => <span title={row.kind}>{learningKindLabels[row.kind] ?? row.kind}</span> }, { key: 'state', header: t('Outcome'), render: (row) => <span title={row.state}>{learningStateLabels[row.state] ?? row.state}</span> }, { key: 'landed', header: t('Landed'), render: (row) => row.landedSha?.slice(0, 10) ?? '—' }, { key: 'updated', header: t('Updated'), render: (row) => at(row.updatedAt) }, { key: 'source', header: t('Source'), render: (row) => <RefLink refValue={row.source} /> }]} />}</QueryPanel>
    <QueryPanel title={t('Owner rulings')} concept="C16" query={rulings} summary={rulings.data ? t('{n} rulings', { n: rulings.data.length }) : undefined}>{(rows) => <DataTable rows={rows} getKey={(row) => row.id} columns={[{ key: 'at', header: t('At'), render: (row) => at(row.saidAt) }, { key: 'summary', header: t('Paraphrase'), render: (row) => row.paraphrase }, { key: 'channel', header: t('Channel'), render: (row) => row.channel }, { key: 'contract', header: t('Reference'), render: (row) => dash(row.contractRef) }]} />}</QueryPanel>
    <QueryPanel title={t('Model × op performance / 7 days')} concept="C16" query={scores} summary={scores.data ? t('{n} pairs', { n: scores.data.length }) : undefined}>{(rows) => <DataTable rows={rows} getKey={(row) => `${row.op}:${row.agent}:${row.model}`} columns={[{ key: 'op', header: 'Op', render: (row) => row.op }, { key: 'model', header: 'Agent / model', render: (row) => `${row.agent} / ${row.model}` }, { key: 'attempts', header: t('Attempts'), render: (row) => row.attempts }, { key: 'pass', header: t('Pass / fail / blocked'), render: (row) => `${row.pass} / ${row.fail} / ${row.blocked}` }, { key: 'rate', header: t('Pass rate'), render: (row) => row.passRate == null ? '—' : `${number(row.passRate * 100, 1)}%` }, { key: 'cost', header: t('Cost'), render: (row) => row.costUsd == null ? '—' : `$${number(row.costUsd, 2)}` }]} />}</QueryPanel>
  </ConceptBlock>;
}

export default function SystemPage() {
  const route = useRoute();
  const tab = route.kind === 'system' ? route.tab : 'engine';
  const health = useApiQuery<HealthSummary>('/api/health', { topics: ['system'], intervalMs: 15_000 });
  const itemState = (keys: HealthSummary['items'][number]['key'][]): UiState => {
    const items = health.data?.items.filter((item) => keys.includes(item.key)) ?? [];
    return items.length ? stateOf(items) : 'unknown';
  };
  const tabStates: Record<SystemTab, UiState> = { engine: itemState(['engine']), sla: itemState(['sla']), resources: itemState(['ram', 'providers']), services: itemState(['services', 'seats']), cleanup: itemState(['leaks', 'gc']), land: itemState(['land']), supervisor: itemState(['seats']), learning: 'unknown' };
  return <ConceptBlock concept="C13" className="flex flex-col gap-6 md:gap-8"><div><p className="text-xs text-muted-foreground">{t('StarCi / operations')}</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">{t('System')}</h1><p className="mt-1 text-sm text-muted-foreground">{t('Engine, SLA, resources, services, cleanup, land, Supervisor and learning from the runtime sources.')}</p></div>
    <nav className="-mx-1 overflow-x-auto border-b px-1" aria-label={t('System sections')}><div className="flex min-w-max gap-1">{systemTabs.map((key) => <a key={key} href={`#/system/${key}`} data-concept={tabConcepts[key]} aria-current={tab === key ? 'page' : undefined} className={`inline-flex items-center gap-2 border-b-2 px-3 py-2 text-sm ${tab === key ? 'border-primary font-medium text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>{tabLabels[key]}{isIssue(tabStates[key]) && <span className={`size-1.5 rounded-full ${tabStates[key] === 'bad' ? 'bg-destructive' : 'bg-[var(--status-warning)]'}`} aria-label={tabStates[key] === 'bad' ? t('Has errors') : t('Has warnings')} />}</a>)}</div></nav>
    {tab !== 'engine' && tab !== 'resources' && tab !== 'supervisor' && tab !== 'learning' && <TabSummary items={health.data?.items.filter((item) => tabItemKeys[tab]?.includes(item.key)) ?? []} />}
    {health.error && <p className="shell-error" role="status">{t('Could not read the overall state: {error}', { error: health.error })}</p>}
    {tab === 'engine' && <EngineTab />}{tab === 'sla' && <SlaTab />}{tab === 'resources' && <ResourcesTab />}{tab === 'services' && <ServicesTab />}{tab === 'cleanup' && <CleanupTab />}{tab === 'land' && <LandTab />}{tab === 'supervisor' && <SupervisorTab />}{tab === 'learning' && <LearningTab />}
    <div className="flex items-center gap-2 text-xs text-muted-foreground"><Clock3 size={13} aria-hidden="true" />{health.meta ? t('System source {at}', { at: formatAbsolute(health.meta.at) }) : t('No source timestamp yet')}{health.meta?.stale?.length ? t(' · stale: {list}', { list: health.meta.stale.join(', ') }) : ''}</div>
  </ConceptBlock>;
}
