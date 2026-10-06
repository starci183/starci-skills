import type { AdmissionReservation, AdmissionView, UiState } from '../../contract';
import type { Concept } from '../concept';
import { AgentAvatar, agentOf } from '../agent/agent-avatar';
import { DataTable } from '../data-table';
import { FeedbackState } from '../feedback-state';
import { Advanced } from '../motion';
import { StateChip } from '../state-chip';
import { Panel, at, dash, number, stateOf } from './panel';
import { t } from '../../i18n/t';

export const concept: Concept = 'C14';

function reservationState(row: AdmissionReservation): UiState {
  if (row.state === 'unknown') return 'unknown';
  if (row.state === 'released') return 'done';
  if (row.state === 'reserved') return 'waiting';
  return row.state === 'live' || row.state === 'launching' ? 'running' : 'unknown';
}

function reservationLabel(row: AdmissionReservation): string {
  if (row.state === 'unknown') return t('Unknown launch outcome · slot retained');
  if (row.state === 'reserved') return t('Slot reserved');
  if (row.state === 'launching') return t('Launching');
  if (row.state === 'live') return t('Launch recorded live');
  if (row.state === 'released') return t('Slot released');
  return t('Unknown');
}

function capturedAt(value: number | string | null | undefined): string {
  if (value == null) return '—';
  const epoch = typeof value === 'number' ? value : Date.parse(value);
  return Number.isFinite(epoch) ? at(epoch) : '—';
}

function ReceiptFacts({ row }: Readonly<{ row: AdmissionReservation }>) {
  const quota = row.quota;
  return <Advanced title={t('Receipt {id}', { id: row.id })} summary={`${row.role} · ${row.provider} / ${row.account}`}>
    <dl className="grid gap-4 text-sm sm:grid-cols-2">
      <div><dt className="text-xs text-muted-foreground">{t('Model bound to receipt')}</dt><dd className="mt-1 break-words">{dash(row.model)}</dd></div>
      <div><dt className="text-xs text-muted-foreground">{t('Fence')}</dt><dd className="mt-1 tabular-nums">{number(row.fence)}</dd></div>
      <div><dt className="text-xs text-muted-foreground">{t('Concurrent launch slots')}</dt><dd className="mt-1 tabular-nums">{number(row.slots)}</dd></div>
      <div><dt className="text-xs text-muted-foreground">{t('Limit recorded at admission')}</dt><dd className="mt-1 tabular-nums">{number(row.maxParallel)}</dd></div>
      <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">{t('Launch attempt identity')}</dt><dd className="mt-1 break-all font-mono text-xs">{row.attemptId}</dd></div>
      <div><dt className="text-xs text-muted-foreground">{t('Terminal')}</dt><dd className="mt-1 break-all font-mono text-xs">{dash(row.handle)}</dd></div>
      <div><dt className="text-xs text-muted-foreground">PID</dt><dd className="mt-1 tabular-nums">{number(row.pid)}</dd></div>
      <div><dt className="text-xs text-muted-foreground">{t('Created')}</dt><dd className="mt-1">{at(row.createdAt)}</dd></div>
      <div><dt className="text-xs text-muted-foreground">{t('Updated')}</dt><dd className="mt-1">{at(row.updatedAt)}</dd></div>
      <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">{t('Host request')}</dt><dd className="mt-1 break-all font-mono text-xs">{dash(row.hostRequestId)}</dd></div>
      <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">{t('Launch identity')}</dt><dd className="mt-1 break-all font-mono text-xs">{dash(row.launchIdentity)}</dd></div>
    </dl>
    <section className="mt-6 space-y-4">
      <h3 className="text-sm font-medium">{t('Quota captured at admission')}</h3>
      <p className="text-xs text-muted-foreground">{t('Captured evidence is not permission to launch another agent.')}</p>
      {quota ? <>
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div><dt className="text-xs text-muted-foreground">{t('Captured at')}</dt><dd className="mt-1">{capturedAt(quota.observedAt)}</dd></div>
          <div><dt className="text-xs text-muted-foreground">{t('Capacity evidence authority')}</dt><dd className="mt-1">{dash(quota.authority)}</dd></div>
          <div><dt className="text-xs text-muted-foreground">{t('Auth at capture')}</dt><dd className="mt-1">{dash(quota.auth)}</dd></div>
          <div><dt className="text-xs text-muted-foreground">{t('Fresh at capture')}</dt><dd className="mt-1">{quota.fresh === true ? t('Yes') : quota.fresh === false ? t('No') : '—'}</dd></div>
          <div><dt className="text-xs text-muted-foreground">{t('Quota state at capture')}</dt><dd className="mt-1">{dash(quota.state)}</dd></div>
          <div><dt className="text-xs text-muted-foreground">{t('Captured expiry')}</dt><dd className="mt-1">{capturedAt(quota.expiresAt)}</dd></div>
        </dl>
        <DataTable rows={quota.windows} getKey={(window) => window.id} empty={t('No provider quota windows recorded.')} caption={t('Recorded provider quota windows')} columns={[
          { key: 'window', header: t('Window'), render: (window) => window.id },
          { key: 'used', header: t('Used'), numeric: true, render: (window) => window.usedPercent == null ? '—' : `${number(window.usedPercent, 1)}%` },
          { key: 'observed', header: t('Observed'), render: (window) => capturedAt(window.observedAt) },
          { key: 'reset', header: t('Reset'), render: (window) => capturedAt(window.resetsAt) },
        ]} />
        {quota.detail && <p className="text-xs text-muted-foreground">{quota.detail}</p>}
      </> : <FeedbackState>{t('No quota snapshot recorded.')}</FeedbackState>}
      {row.quotaCodes.length > 0 && <div><h4 className="text-xs font-medium">{t('Recorded evidence notes')}</h4><ul className="mt-2 space-y-1 text-xs text-muted-foreground">{row.quotaCodes.map((code) => <li key={code} className="break-words font-mono">{code}</li>)}</ul></div>}
    </section>
    <Advanced className="mt-4" title={t('Scope and release evidence')}>
      <dl className="space-y-4 text-xs">
        <div><dt className="mb-2 font-medium">{t('Scope')}</dt><dd><pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words font-mono">{row.scope == null ? '—' : JSON.stringify(row.scope, null, 2)}</pre></dd></div>
        <div><dt className="mb-2 font-medium">{t('Release proof')}</dt><dd><pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words font-mono">{row.proof == null ? '—' : JSON.stringify(row.proof, null, 2)}</pre></dd></div>
        <div><dt className="mb-2 font-medium">{t('Released at')}</dt><dd>{at(row.releasedAt)}</dd></div>
      </dl>
    </Advanced>
  </Advanced>;
}

export function AdmissionPanel({ admission }: Readonly<{ admission: AdmissionView | null | undefined }>) {
  const observed = admission?.observed === true;
  const rows = admission?.reservations ?? [];
  const ui: UiState = !observed || admission?.unknown == null || admission.unknown > 0
    ? 'unknown' : stateOf(rows.map((row) => ({ ui: reservationState(row) })));
  const summary = observed
    ? t('{slots} slots occupied · {unknown} unknown launches', { slots: number(admission?.running), unknown: number(admission?.unknown) })
    : t('Admission observations unavailable · occupied slots —');
  return <Panel title={t('Agent admission')} concept="C14" ui={ui} summary={summary}>
    {observed ? <div className="flex flex-col gap-4">
      <p className="text-xs text-muted-foreground">{t('Concurrent launch slots are shared by Kernel, Op, Supervisor, Worker and Critic. Unknown outcomes retain their slot.')}</p>
      <DataTable rows={rows} getKey={(row) => row.id} empty={t('No provider reservations recorded.')} caption={t('Recorded provider reservations')} columns={[
        { key: 'agent', header: t('Agent'), render: (row) => <span className="inline-flex min-w-0 items-center gap-2"><AgentAvatar agent={agentOf({ provider: row.provider, model: row.model })} size={20} /><span className="min-w-0"><span className="block font-medium">{row.provider}</span><span className="block break-words text-xs text-muted-foreground">{row.model}</span></span></span> },
        { key: 'role', header: t('Role'), render: (row) => row.role },
        { key: 'account', header: t('Account'), render: (row) => row.account },
        { key: 'state', header: t('State'), mobileStack: true, render: (row) => <StateChip state={reservationState(row)} label={reservationLabel(row)} /> },
        { key: 'updated', header: t('Observed'), render: (row) => at(row.updatedAt) },
      ]} />
      <Advanced title={t('Captured quota and launch receipts')} summary={t('{n} receipts', { n: rows.length })}>
        <div className="flex flex-col gap-4">{rows.map((row) => <ReceiptFacts key={row.id} row={row} />)}</div>
      </Advanced>
    </div> : <FeedbackState>{t('This database has no provider admission observations. Occupied slots are unknown.')}</FeedbackState>}
  </Panel>;
}
