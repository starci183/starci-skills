import { useId } from 'react';
import { ArrowRight, CircleAlert, MessageCircleQuestion, ShieldAlert } from 'lucide-react';
import { usePagedApiQuery, type PagedQuerySnapshot } from '../../api/query';
import { ConceptBlock, type Concept } from '../../components/concept';
import { Advanced, Stagger, StaggerItem } from '../../components/motion';
import { FeedbackState } from '../../components/feedback-state';
import { StateChip } from '../../components/state-chip';
import { TimeAgo } from '../../components/time-ago';
import type { DecisionRow, AskRow, IncidentRow } from '../../contract';
import { formatAbsolute } from '../../i18n/vi';
import { t } from '../../i18n/t';
import { useRoute } from '../../router';
import { DecisionDrawer } from './decision-drawer';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent } from '../../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Checkbox } from '../../components/ui/checkbox';
import { NativeSelect, NativeSelectOption } from '../../components/ui/native-select';
import { Button } from '../../components/ui/button';
import { ReadQuality, partialSources } from '../../components/charts/chart-card';
import { byCodeUnit } from '../../lib/utils';

export const concept: Concept = 'C12';

function PageRead<T>({ query, url }: { query: PagedQuerySnapshot<T>; url: string }) {
  return <><ReadQuality query={query} url={url} onRetry={query.refresh} />
    {query.data !== null ? <p className="text-xs text-muted-foreground">{t('{n} rows loaded', { n: query.data.length })} · {t('Counts describe loaded records, not the full population.')}</p> : null}
    {query.loadMoreError ? <FeedbackState error onRetry={query.loadMoreErrorCode === 'BAD_CURSOR' ? query.refresh : query.loadMore}>{query.loadMoreError}{query.loadMoreErrorCode === 'BAD_CURSOR' ? ` · ${t('Refresh first page')}` : ''}</FeedbackState> : null}
    {query.next ? <Button variant="outline" disabled={query.loadingMore} onClick={query.loadMore}>{query.loadingMore ? t('Loading…') : t('Load more')}</Button> : null}
  </>;
}

const deciderLabel = (value: string) => ({ kernel: 'Kernel', supervisor: 'Supervisor', owner: t('The owner') } as Record<string, string>)[value] ?? value;
const channelLabel = (value: string | null) => ({ 'kernel-seat': t('Kernel seat'), 'supervisor-seat': t('Supervisor seat'), telegram: 'Telegram', 'serve-ask': t('the ask channel') } as Record<string, string>)[value ?? ''] ?? t('Unknown');
const statusLabel = (value: string) => ({ open: t('Open'), claimed: t('Claimed'), escalated: t('Escalated'), resolved: t('Resolved'), superseded: t('Superseded'), expired: t('Expired'), answered: t('Answered'), retired: t('closed') } as Record<string, string>)[value] ?? value;
const escalation = (row: DecisionRow) => row.decider === 'owner' && row.escalations > 0 ? `Kernel → Supervisor → ${t('The owner')}`
  : row.escalations > 0 ? 'Kernel → Supervisor' : deciderLabel(row.decider);

function hashParams(): URLSearchParams {
  try { return new URL(window.location.hash.slice(1) || '/decisions', window.location.origin).searchParams; }
  catch { return new URLSearchParams(); }
}
function href(changes: Record<string, string | null>): string {
  const params = hashParams();
  for (const [key, value] of Object.entries(changes)) value ? params.set(key, value) : params.delete(key);
  return `#/decisions${params.size ? `?${params}` : ''}`;
}
function navigate(changes: Record<string, string | null>): void { window.location.hash = href(changes).slice(1); }
function SelectFilter({ label, value, options, onChange }: { label: string; value: string;
  options: { value: string; label: string }[]; onChange: (value: string) => void }) {
  const id = useId();
  return <div className="flex min-w-0 flex-col gap-1 text-xs font-medium text-muted-foreground"><label htmlFor={id}>{label}</label>
    <NativeSelect id={id} value={value} onChange={event => onChange(event.target.value)} className="w-full">
      {options.map(option => <NativeSelectOption key={option.value} value={option.value}>{option.label}</NativeSelectOption>)}
    </NativeSelect>
  </div>;
}

function DecisionCard({ row }: { row: DecisionRow }) {
  const credential = row.kind === 'credential-missing';
  return <Card size="sm" className="min-w-0 transition-colors hover:bg-muted/20"><CardContent>
    <a href={row.href} className="group flex min-w-0 flex-col gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-row sm:items-center sm:gap-4">
      <StateChip state={row.ui} compact />
      <span className="flex min-w-0 flex-1 flex-col gap-1"><span className="flex flex-wrap items-center gap-2"><strong className="break-all text-sm">{row.kind}</strong>{row.overdue && <span className="text-xs font-semibold text-destructive">{t('Overdue')}</span>}</span>
        <span className="block break-words text-sm text-muted-foreground">{credential ? t('Credential request · content hidden.') : row.summary}</span>
        <span className="block break-words text-xs text-muted-foreground">{t('Decider: {who}', { who: escalation(row) })}</span>
      </span>
      <span className={`shrink-0 text-xs text-muted-foreground sm:text-right ${row.overdue ? 'font-semibold text-destructive' : ''}`}>{t('Due {at}', { at: formatAbsolute(row.dueAt) })}</span>
      <ArrowRight className="hidden size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary sm:block" aria-hidden="true" />
    </a>
    <Advanced summary={t('Project, workflow, channel and opened time')}>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"><span>{row.project ?? t('Machine')}{row.wf ? ` · ${row.wf}` : ''}</span><span>{t('Opened')} <TimeAgo at={row.openedAt} /></span><span>{t('Channel: {channel}', { channel: channelLabel(row.channel) })}</span>{row.escalations > 0 && <span>{t('{n} escalations', { n: row.escalations })}</span>}</div>
    </Advanced>
  </CardContent></Card>;
}

function AskCard({ row }: { row: AskRow }) {
  return <ConceptBlock concept="C12" as="article"><Card size="sm"><CardContent className="flex flex-col gap-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><MessageCircleQuestion className="size-4 text-primary" aria-hidden="true" /><strong className="text-sm">{row.credential ? 'credential' : t('Ask the owner')}</strong></div>
      <Badge variant="outline">{statusLabel(row.state)}</Badge></div>
    <p className="break-words text-sm">{row.credential ? t('A credential item needs handling over a separate channel. Content is hidden.') : row.question ?? t('No content is allowed to be shown.')}</p>
    {!row.credentialObserved ? <p className="text-xs text-muted-foreground">{t('Content is hidden because the credential scope could not be verified.')}</p> : null}
    {row.di && <a href={row.di.href} className="inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline">{t('View the related decision')}<ArrowRight className="size-3.5" aria-hidden="true" /></a>}
    <Advanced summary={t('Project, channel and ask time')}><div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"><span>{row.project ?? t('Machine')}{row.wf ? ` · ${row.wf}` : ''}</span><span>{t('Channel: {channel}', { channel: channelLabel(row.channel) })}</span><span><TimeAgo at={row.askedAt} /></span></div></Advanced>
  </CardContent></Card></ConceptBlock>;
}

function IncidentCard({ row, selected = false }: { row: IncidentRow; selected?: boolean }) {
  return <ConceptBlock concept="C12" as="article" className="min-w-0"><Card size="sm" data-selected={selected} className={selected ? 'ring-2 ring-ring' : undefined}><CardContent className="flex flex-col gap-3">
    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
      <StateChip state={row.ui} compact /><div className="flex min-w-0 flex-1 flex-col gap-1"><div className="flex flex-wrap items-center gap-2"><strong className="break-all text-sm">{row.kind}</strong><span className="text-xs text-muted-foreground">{statusLabel(row.status)}</span></div>
        {row.lastProgress && <p className="break-words text-sm text-muted-foreground">{row.lastProgress}</p>}
      </div><div className="shrink-0 text-xs text-muted-foreground sm:text-right"><p>{t('Owner: {who}', { who: deciderLabel(row.owner) })}</p><p>{t('Due: {at}', { at: formatAbsolute(row.dueAt) })}</p></div>
    </div>
    <Advanced summary={t('Project, workflow, op and updated time')}><p className="break-words text-xs text-muted-foreground">{row.project} · {row.wf}{row.op ? ` · ${row.op}` : ''} · {t('Updated')} <TimeAgo at={row.updatedAt} /></p></Advanced>
  </CardContent></Card></ConceptBlock>;
}

export function DecisionsPage() {
  const route = useRoute();
  const params = hashParams();
  const tab = route.kind === 'decisions' ? route.tab : 'di';
  const selectedId = params.get('id');
  const selectedIncident = tab === 'incidents' ? params.get('incident') ?? selectedId : null;
  const decider = params.get('decider') ?? '', status = params.get('status') ?? '', kind = params.get('kind') ?? '';
  const overdue = params.get('overdue') === '1';
  const decisionParams = new URLSearchParams();
  if (decider) decisionParams.set('decider', decider);
  if (status) decisionParams.set('status', status);
  if (kind) decisionParams.set('kind', kind);
  if (overdue) decisionParams.set('overdue', '1');
  if (params.get('project')) decisionParams.set('project', params.get('project')!);
  if (params.get('wf')) decisionParams.set('wf', params.get('wf')!);
  const decisionsUrl = `/api/decisions${decisionParams.size ? `?${decisionParams}` : ''}`;
  const asksParams = new URLSearchParams({ state: 'open' }), incidentsParams = new URLSearchParams({ status: selectedIncident ? 'all' : tab === 'incidents' && status ? status : 'open' });
  for (const key of ['project', 'wf']) if (params.get(key)) { asksParams.set(key, params.get(key)!); incidentsParams.set(key, params.get(key)!); }
  if (selectedIncident) incidentsParams.set('id', selectedIncident);
  const asksUrl = `/api/asks?${asksParams}`, incidentsUrl = `/api/incidents?${incidentsParams}`;
  const decisions = usePagedApiQuery<DecisionRow>(decisionsUrl, { topics: ['decisions'], intervalMs: 20_000, getKey: row => row.key });
  const asks = usePagedApiQuery<AskRow>(asksUrl, { topics: ['decisions'], intervalMs: 30_000, getKey: row => row.id });
  const incidents = usePagedApiQuery<IncidentRow>(incidentsUrl, { topics: ['decisions'], intervalMs: 30_000, getKey: row => `${row.ledgerId}:${row.id}` });
  const kinds = [...new Set([kind, ...(decisions.data ?? []).map(row => row.kind)].filter(Boolean))].sort(byCodeUnit);
  const tabs = [
    { key: 'di', label: 'DI', count: decisions.data?.length ?? null, icon: CircleAlert },
    { key: 'asks', label: t('Ask the owner'), count: asks.data?.length ?? null, icon: MessageCircleQuestion },
    { key: 'incidents', label: t('Incidents'), count: incidents.data?.length ?? null, icon: ShieldAlert },
  ] as const;
  return <ConceptBlock concept="C12" className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-6 pb-24 md:gap-8">
    <header className="flex flex-col gap-2"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{t('StarCi / decisions')}</p><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('Decisions')}</h1>
      <p className="text-sm text-muted-foreground">{t('Track pending decisions, questions to the owner and incidents. This page is read-only.')}</p></header>
    <Tabs value={tab} onValueChange={value => navigate({ tab: value, id: null, incident: null, store: null, ledger: null, status: null, kind: null, overdue: null })} className="min-w-0 gap-6">
    <div className="min-w-0 overflow-x-auto border-b"><TabsList variant="line" aria-label={t('Decision items')} className="h-10 min-w-max">
      {tabs.map(item => <TabsTrigger key={item.key} value={item.key} asChild><a href={href({ tab: item.key, id: null, incident: null, store: null, ledger: null, status: null, kind: null, overdue: null })}>
        <item.icon className="size-4" aria-hidden="true" />{item.label}<span title={t('Loaded records')} className="text-xs text-muted-foreground tabular-nums">{item.count ?? '—'}</span>
      </a></TabsTrigger>)}
    </TabsList></div>
    <TabsContent value="di" className="space-y-6">
    <Card size="sm"><CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <SelectFilter label={t('Decider')} value={decider} options={[{ value: '', label: t('All') }, { value: 'kernel', label: 'Kernel' }, { value: 'supervisor', label: 'Supervisor' }, { value: 'owner', label: t('The owner') }]} onChange={value => navigate({ decider: value, id: null })} />
      <SelectFilter label={t('State')} value={status} options={[{ value: '', label: t('Open') }, { value: 'all', label: t('All') }, ...['open', 'claimed', 'escalated', 'resolved', 'expired', 'superseded'].map(value => ({ value, label: statusLabel(value) }))]} onChange={value => navigate({ status: value, id: null })} />
      <SelectFilter label={t('Kind')} value={kind} options={[{ value: '', label: t('All') }, ...kinds.map(value => ({ value, label: value }))]} onChange={value => navigate({ kind: value, id: null })} />
      <label htmlFor="decisions-overdue" className="flex items-end gap-2 pb-2 text-sm"><Checkbox id="decisions-overdue" checked={overdue} onCheckedChange={checked => navigate({ overdue: checked === true ? '1' : null, id: null })} /><span>{t('Only overdue')}</span></label>
    </CardContent></Card>
    <div className="grid gap-4" aria-live="polite"><PageRead query={decisions} url={decisionsUrl} />
      <Stagger className="grid gap-4">{decisions.data?.map(row => <StaggerItem key={row.key}><DecisionCard row={row} /></StaggerItem>)}</Stagger>
      {!decisions.error && !partialSources(decisions).length && decisions.data !== null && !decisions.data.length ? <FeedbackState>{t('No matching decisions.')}</FeedbackState> : null}</div>
    </TabsContent>
    <TabsContent value="asks"><div className="grid gap-4" aria-live="polite"><PageRead query={asks} url={asksUrl} />
      <Stagger className="grid gap-4">{asks.data?.map(row => <StaggerItem key={row.id}><AskCard row={row} /></StaggerItem>)}</Stagger>
      {!asks.error && !partialSources(asks).length && asks.data !== null && !asks.data.length ? <FeedbackState>{t('No open questions.')}</FeedbackState> : null}</div></TabsContent>
    <TabsContent value="incidents" className="space-y-6"><div className="max-w-xs"><SelectFilter label={t('Incident state')} value={status} options={[{ value: '', label: t('Open') }, { value: 'all', label: t('All') }, { value: 'open', label: t('Open') }, { value: 'resolved', label: t('Resolved') }, { value: 'superseded', label: t('Superseded') }]} onChange={value => navigate({ status: value })} /></div>
    <div className="grid gap-4" aria-live="polite"><PageRead query={incidents} url={incidentsUrl} />
      <Stagger className="grid gap-4">{incidents.data?.map(row => <StaggerItem key={`${row.ledgerId}:${row.id}`}><IncidentCard row={row} selected={row.id === selectedIncident} /></StaggerItem>)}</Stagger>
      {!incidents.error && !partialSources(incidents).length && incidents.data !== null && !incidents.data.length ? <FeedbackState>{t('No matching incidents.')}</FeedbackState> : null}</div></TabsContent>
    </Tabs>
    <DecisionDrawer id={tab !== 'incidents' ? selectedId : null} store={params.get('store')} ledger={params.get('ledger') ?? params.get('project')} onClose={() => navigate({ id: null, store: null, ledger: null })} />
  </ConceptBlock>;
}

export default DecisionsPage;
