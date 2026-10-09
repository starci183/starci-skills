import type { Concept } from '../../concept';
export const concept: Concept = 'C2';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Link, Meter } from '@heroui/react';
import { useApiQuery } from '../../../api/query';
import type { ContractInfo, LegStatus, PipelineView, WorkflowDetailV2 } from '../../../contract';
import { formatAbsolute, formatOpLabel, formatReason } from '../../../i18n/vi';
import { StatusChip, StatusDot } from '../../status-chip';
import { statusLabels, statusTone, type Status } from '../../status';
import { Advanced, Swap, Ticker } from '../../motion';
import { WhyBlock, WhyOwnerBadge } from '../../why/why-block';
import { Card, CardContent } from '../../ui/card';
import { legName } from './node/op-identity';
import { t } from '../../../i18n/t';

const order: LegStatus[] = ['success', 'running', 'settling', 'queued', 'retry', 'failed', 'blocked', 'awaiting-owner', 'planned', 'deferred', 'external', 'dropped', 'rejected', 'warning', 'unknown'];
const stuckReasons: Record<string, string> = {
  STALLED: t('stalled, no progress'), OWNER_DECISION_OPEN: t('waiting for an owner decision'), SEAT_VACANT: t('the Kernel seat is vacant'), SLA_CRITICAL: t('critical SLA violation'),
};
const fmt = (value: number) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(value);

/** API completion is scoped to the recorded goal revision; every plan leg remains visible. */
export function LegProgress({ pipeline, eta, action }: { readonly pipeline: PipelineView; readonly eta?: string; readonly action?: { href: string; label: string } | null }) {
  const { done, total, byStatus } = pipeline.progress;
  const legs = pipeline.legs.filter(leg => leg.inPlan).sort((a, b) => a.seq - b.seq);
  const excluded = (['deferred', 'external', 'dropped'] as const).filter(status => (byStatus[status] ?? 0) > 0)
    .map(status => `${byStatus[status]} ${statusLabels[status]}`).join(' · ');
  const context = `${t('Progress for goal revision {n}', { n: pipeline.goalRevision ?? t('unknown') })} · ${pipeline.approvalState === 'recorded' && pipeline.approvedBy ? t('Approval recorded by {who}', { who: pipeline.approvedBy }) : t('Approval evidence unproven')}`;
  if (!pipeline.progress.available) return <div className="space-y-2"><p className="text-sm text-muted-foreground">{t('Plan progress is unavailable.')}</p><p className="text-xs text-muted-foreground">{context}</p></div>;
  return <div>
    <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1"><span className="text-sm"><strong className="text-lg tabular-nums"><Ticker value={done} />/{total}</strong> {t('legs passed')}{eta ? <span className="ml-3 text-xs text-muted-foreground">ETA <strong className="text-foreground">{eta}</strong></span> : null}</span>
      {action ? <Link href={action.href} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">{action.label} <ArrowRight className="size-3.5" aria-hidden="true" /></Link> : null}</div>
    <p className="mb-2 text-xs text-muted-foreground">{context} · {t('{total} counted of {legs} recorded plan legs', { total, legs: legs.length })}{excluded ? ` · ${t('Excluded: {items}', { items: excluded })}` : ''}</p>
    {total > 0 && <Meter value={done} minValue={0} maxValue={total} aria-label={t('{done} of {total} counted legs passed; {legs} recorded plan legs', { done, total, legs: legs.length })} data-progress-scope={pipeline.progress.scope} className="w-full"><Meter.Track><Meter.Fill /></Meter.Track></Meter>}
    <ul className="mt-2 flex flex-wrap gap-2" aria-label={t('Op chain')}>{legs.map(leg => <li key={leg.op} data-tone={statusTone[leg.status]} className={leg.current ? 'rounded-sm ring-1 ring-[var(--status-running)]' : undefined}><span title={`${legName(leg)} (${leg.op}) · ${statusLabels[leg.status]}`} className="inline-flex items-center gap-1 px-1 text-xs"><span className="status-dot" />{legName(leg)}</span></li>)}</ul>
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">{order.filter(status => (byStatus[status] ?? 0) > 0 || legs.some(leg => leg.status === status)).map(status => {
      const n = legs.filter(leg => leg.status === status).length;
      return <li key={status} data-tone={statusTone[status]} className="inline-flex items-center gap-2"><span className="status-dot" />{statusLabels[status]} <strong className="text-foreground tabular-nums">{n}</strong></li>;
    })}</ul>
  </div>;
}

export function WorkflowHeader({ row, pipeline }: { readonly row: WorkflowDetailV2; readonly pipeline: PipelineView | null }) {
  const contract = useApiQuery<ContractInfo>('/api/contract', { topics: ['system'], intervalMs: 60_000 });
  const problems = [
    row.blockedBy.length > 0 && { key: 'b', status: 'blocked' as Status, text: t('{n} blocking points', { n: row.blockedBy.length }) },
    (pipeline?.failures ?? 0) > 0 && { key: 'f', status: 'failed' as Status, text: t('{n} settled workflow failures', { n: pipeline!.failures }) },
    row.counts.decisionsOpen > 0 && { key: 'd', status: 'retry' as Status, text: t('{n} decisions waiting', { n: row.counts.decisionsOpen }) },
  ].filter(Boolean) as { key: string; status: Status; text: string }[];
  // Lifecycle, progress trouble and recorded causes remain independent facts.
  const running = row.phase === 'running';
  const phaseStatus: Status = row.phase === 'paused' ? 'paused' : row.phase === 'stopped' ? 'stopped' : running ? 'running' : row.phase === 'awaiting-approval' ? 'awaiting-owner' : row.phase === 'queued' ? 'queued' : row.phase === 'finished' || row.phase === 'archived' ? 'success' : 'unknown';
  const healthChip = running && (row.ui === 'bad' || row.ui === 'warn')
    ? { status: (row.ui === 'bad' ? 'failed' : 'warning') as Status, text: row.ui === 'bad' ? t('Progress: stuck') : t('Progress: needs attention') } : null;
  const phaseText = row.phase === 'archived' ? t('Archived') : row.phase === 'finished' ? t('Finished') : statusLabels[phaseStatus];
  const root = `#/w/${encodeURIComponent(row.project)}/${encodeURIComponent(row.id)}`;
  const currentOps = pipeline?.current ?? row.pipeline.current;
  const action = row.blockedBy[0] ? { href: row.blockedBy[0].ref.href, label: t('View what is blocking') }
    : row.counts.decisionsOpen > 0 ? { href: `${root}?tab=decisions`, label: t('View pending decisions') }
    : currentOps.length ? { href: `${root}?leg=${encodeURIComponent(currentOps[0])}`, label: t('View current operation details') } : null;
  const legWhys = pipeline?.legs.filter(leg => leg.why && (leg.current || ['failed', 'blocked', 'awaiting-owner', 'retry', 'rejected'].includes(leg.status))) ?? [];
  const notes = pipeline?.kernelNotes ?? [];
  const why = row.reason ? (stuckReasons[row.reason.code] ?? formatReason(row.reason)) : row.phase !== 'running' ? row.phaseReason : row.onIt ? formatReason(row.onIt.reason) : null;
  return <header className="flex flex-col gap-4">
    <nav aria-label={t('Location')} className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground"><Link href="#/" className="inline-flex items-center gap-1 hover:text-foreground"><ArrowLeft className="size-4" /> {t('Overview')}</Link><span aria-hidden="true">/</span><span>{row.project}</span></nav>
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2"><h1 className="min-w-0 break-words text-xl font-semibold tracking-tight sm:text-2xl">{row.name}</h1>
        <Swap keyValue={`${phaseStatus}-${phaseText}`}><StatusChip status={phaseStatus} label={phaseText} /></Swap></div>
      <p className="break-all font-mono text-xs text-muted-foreground">{row.id}</p>
      {row.observedGeneration < row.generation && <p className="text-xs text-muted-foreground">{t('Observation {observed}/{generation}', { observed: row.observedGeneration, generation: row.generation })}</p>}
      {(healthChip || problems.length > 0) && <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {healthChip && <span className="inline-flex items-center gap-1.5"><StatusDot status={healthChip.status} />{healthChip.text}</span>}
        {problems.map(item => <span key={item.key} className="inline-flex items-center gap-1.5"><StatusDot status={item.status} />{item.text}</span>)}
      </div>}
      <p className="text-sm text-muted-foreground"><span className="font-medium">{t('Current operations:')}</span> {currentOps.length ? currentOps.map((op, index) => {
        const leg = pipeline?.legs.find(item => item.op === op);
        return <span key={op}>{index > 0 ? ' · ' : ''}<Link href={`${root}?leg=${encodeURIComponent(op)}`} className="hover:text-foreground hover:underline">{leg ? legName(leg) : formatOpLabel(op, contract.data?.opLabels)} <span className="font-mono text-xs">({op})</span></Link></span>;
      }) : t('No current operation recorded.')}</p>
      {(why || healthChip) && <p className="text-sm text-muted-foreground"><span className="font-medium">{t('Why:')}</span> {why ?? t('no reason recorded')}</p>}
      {legWhys.map(leg => <div key={leg.op} className="flex min-w-0 flex-col gap-1"><Link href={`${root}?leg=${encodeURIComponent(leg.op)}`} className="text-xs text-muted-foreground hover:text-foreground hover:underline">{t('Reason recorded for {op}', { op: legName(leg) })} <span className="font-mono">({leg.op})</span> · {leg.inPlan ? t('Goal revision {n}', { n: leg.goalRevision ?? t('unknown') }) : t('Recorded operation history')}</Link><WhyBlock why={leg.why} compact className="max-w-[80ch]" /></div>)}
      {!legWhys.length && <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span>{t('Handling role:')}</span><WhyOwnerBadge owner={row.onIt?.who} /></div>}
    </div>
    <Advanced keepMounted title={t('Goal · revision {n}', { n: row.goal.revision })} summary={row.goal.text ? row.goal.text.slice(0, 160) : t('No goal recorded yet.')}>
      <p className="mt-2 whitespace-pre-wrap break-words border-t pt-2 leading-relaxed">{row.goal.text || t('No goal recorded yet.')}</p>
      {row.goal.approvedBy && <p className="mt-2 text-xs text-muted-foreground">{t('Recorded approver: {who}', { who: row.goal.approvedBy })}</p>}
      {row.goal.approvalRef && <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{t('Approval reference: {ref}', { ref: row.goal.approvalRef })}</p>}</Advanced>
    {pipeline && <Card size="sm"><CardContent><LegProgress pipeline={pipeline} eta={row.etaAt != null ? formatAbsolute(row.etaAt) : t('not estimable')} action={action} />
      {notes.length ? <Advanced summary={t('{n} Kernel notes', { n: notes.length })} title={t('Kernel notes')}>
        <ol className="m-0 flex list-none flex-col divide-y p-0 text-sm">{notes.slice().reverse().map(note => <li key={note.id} className="flex min-w-0 flex-col gap-1 py-3">
          <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span className="font-medium text-foreground">{note.kind === 'decision' ? t('Decision') : t('Proposal')}</span><span>{note.status}</span><span>{new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }).format(note.at)}</span></span>
          <span className="break-words">{note.headline}</span>{note.observed ? <span className="text-xs text-muted-foreground">{t('Result: {text}', { text: note.observed })}</span> : null}
        </li>)}</ol>
      </Advanced> : null}
      <Advanced summary={t('rate · parallelism · handling role · Kernel seat · attempts')}>
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
          <span>{t('{legs} recorded plan legs · {attempts} workflow attempts · {failures} settled failures', { legs: pipeline.legs.filter(leg => leg.inPlan).length, attempts: pipeline.attempts, failures: pipeline.failures })}</span>
          <span>{t('{done}/{total} workflow units · all goal revisions', { done: row.units.done, total: row.units.total })}</span>
          <span>{t('Rate')} <strong className="text-foreground tabular-nums">{row.ratePerHour == null ? t('not recorded') : t('{n}/hour', { n: fmt(row.ratePerHour) })}</strong>{row.minRatePerHour != null ? t(' (minimum {n})', { n: fmt(row.minRatePerHour) }) : ''}</span>
          {row.progressSnapshot && <span>{t('Rate snapshot #{id} · recorded {at}', { id: row.progressSnapshot.id, at: formatAbsolute(row.progressSnapshot.at) })}{row.progressSnapshot.windowMs != null ? ` · ${t('Window {n} hours', { n: row.progressSnapshot.windowMs / 3_600_000 })}` : ''}</span>}
          <span>{t('Running')} <strong className="text-foreground tabular-nums">{row.running}/{row.allowedParallel ?? '—'}</strong></span>
          <span className="inline-flex flex-wrap items-center gap-1.5"><span>{t('Handling role:')}</span><WhyOwnerBadge owner={row.onIt?.who} />{row.onIt ? ` · ${formatReason(row.onIt.reason)}` : ''}</span>
          <span data-concept="C3">{t('Kernel seat · {state}', { state: row.seat?.state ?? t('unknown') })}</span>
          {row.phase !== 'running' && <span>{phaseText}: {row.phaseReason ?? t('no reason recorded')}</span>}
        </div></Advanced></CardContent></Card>}
  </header>;
}
