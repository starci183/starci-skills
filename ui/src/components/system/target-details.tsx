import { BlobText } from '../blob-text';
import { StateChip } from '../state-chip';
import { t } from '../../i18n/t';
import type { BlobLink, LandRun, Ref, UiState } from '../../contract';
import { BlobLinkButton, Metric, RefLink, at, dash, number } from './panel';

export const concept = 'frame';

export type Service = { name: string; kind: string; state: string; ui: UiState; since: number; restarts24h: number; failedProbes24h: number; lastProbe: { at: number; ok: boolean; latencyMs: number | null; detail: unknown } | null; port: number | null; url: string | null; quarantinedUntil: number | null };
export type Seat = { id: string; role: string; project: string | null; wf: string | null; state: string; parkedReason: string | null; ui: UiState; terminal: Ref | null; agent: string | null; model: string | null; bootedAt: number | null; lastSeenAt: number | null; replacedCount: number; inputFailuresConsecutive: number; deaf: boolean; lastSnapshotAt: number | null; transcript: BlobLink | null };
export type Terminal = { handle: string; title: string; role: string; openedAt: number; closedAt: number | null; closeVerifiedAt: number | null; closedBy: string | null; ui: UiState };
export type ServiceTarget = { kind: 'service'; row: Service } | { kind: 'seat'; row: Seat } | { kind: 'terminal'; row: Terminal };
export type LandTicket = { scope: 'runtime'; ticket: string; lane: string; commit: string; state: string; enqueuedAt: number; gateAt: number | null; busyHolder: string | null; startedAt: number | null; ui: UiState };
export type Push = { id: number; repo: string; repoRole: string | null; scope: 'runtime' | 'project' | 'unknown'; project: string | null; branch: string; head: string; from: string; to: string; result: string; reason: string | null; failureSignature: string | null; stdout: BlobLink | null; stderr: BlobLink | null; at: number; ui: UiState };
export type Lane = { scope: 'runtime'; name: string; worktree: string | null; branch: string; baseSha: string | null; headSha: string | null; owner: string | null; supJob: Ref | null; supJobId: string | null; state: string; ui: UiState; createdAt: number; landedAt: number | null; removedAt: number | null; report: BlobLink | null };
export type LandTarget = { kind: 'land-run' | 'commit'; row: LandRun } | { kind: 'land-ticket'; row: LandTicket } | { kind: 'lane'; row: Lane } | { kind: 'push'; row: Push };

function Facts({ rows }: Readonly<{ rows: [string, string][] }>) {
  return <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">{rows.map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="break-words">{value}</dd></div>)}</dl>;
}

export function ServiceFacts({ selected }: Readonly<{ selected: ServiceTarget }>) {
  if (selected.kind === 'service') {
    const row = selected.row;
    return <div className="flex flex-col gap-4"><StateChip state={row.ui} label={row.state} /><Facts rows={[
      [t('Kind'), row.kind], [t('Since'), at(row.since)], [t('Restarts / 24 h'), number(row.restarts24h)], [t('Failed probes / 24 h'), number(row.failedProbes24h)],
      [t('Port'), dash(row.port)], ['URL', dash(row.url)], [t('Quarantined until'), at(row.quarantinedUntil)],
    ]} /></div>;
  }
  if (selected.kind === 'seat') {
    const row = selected.row;
    const workflow: Ref | null = row.project && row.wf ? { kind: 'workflow', id: row.wf, project: row.project, href: `#/w/${encodeURIComponent(row.project)}/${encodeURIComponent(row.wf)}` } : null;
    return <div className="flex flex-col gap-4"><StateChip state={row.ui} label={row.state} /><Facts rows={[
      [t('Role'), row.role], [t('Project'), dash(row.project)], ['Agent', dash(row.agent)], [t('Recorded model'), dash(row.model)],
      [t('Booted at'), at(row.bootedAt)], [t('Last seen'), at(row.lastSeenAt)], [t('Replaced count'), number(row.replacedCount)],
      [t('Consecutive input failures'), number(row.inputFailuresConsecutive)], [t('Parked reason'), dash(row.parkedReason)], [t('Snapshot at'), at(row.lastSnapshotAt)],
    ]} /><div className="text-sm">{t('Workflow')}: {workflow ? <RefLink refValue={workflow} /> : dash(row.wf)}</div><div className="text-sm">Terminal: <RefLink refValue={row.terminal} /></div>
      {row.deaf && <p className="shell-error">{t('Lost signal')}</p>}<BlobLinkButton blob={row.transcript} label={t('Record')} /></div>;
  }
  const row = selected.row;
  return <div className="flex flex-col gap-4"><StateChip state={row.ui} /><p className="text-xs text-muted-foreground">{t('Recorded shell inventory and close verification; this is not a live terminal probe.')}</p><Facts rows={[
    ['Handle', row.handle], [t('Role'), row.role], [t('First seen'), at(row.openedAt)], [t('Closed at'), at(row.closedAt)],
    [t('Close verified at'), at(row.closeVerifiedAt)], [t('Closed by'), dash(row.closedBy)],
  ]} /></div>;
}

export function landTargetTitle(selected: LandTarget) {
  if (selected.kind === 'land-ticket') return `Ticket ${selected.row.ticket}`;
  if (selected.kind === 'lane') return `Lane ${selected.row.name}`;
  if (selected.kind === 'push') return `Push #${selected.row.id}`;
  return `Land #${selected.row.id}`;
}

export function LandFacts({ selected }: Readonly<{ selected: LandTarget }>) {
  if (selected.kind === 'land-ticket') {
    const row = selected.row;
    return <div className="flex flex-col gap-4"><StateChip state={row.ui} label={row.state} /><Facts rows={[
      [t('Scope'), row.scope], ['Lane', row.lane], ['Commit', row.commit], [t('Enqueued at'), at(row.enqueuedAt)],
      [t('Gate at'), at(row.gateAt)], [t('Busy holder'), dash(row.busyHolder)], [t('Started'), at(row.startedAt)],
    ]} /></div>;
  }
  if (selected.kind === 'lane') {
    const row = selected.row;
    return <div className="flex flex-col gap-4"><StateChip state={row.ui} label={row.state} /><Facts rows={[
      [t('Scope'), row.scope], [t('Branch'), row.branch], [t('Worktree'), dash(row.worktree)], ['Base SHA', dash(row.baseSha)], ['Head SHA', dash(row.headSha)],
      [t('Owner'), dash(row.owner)], ['Supervisor job', dash(row.supJobId)], [t('Created'), at(row.createdAt)], [t('Landed at'), at(row.landedAt)], [t('Removed at'), at(row.removedAt)],
    ]} /><BlobLinkButton blob={row.report} label={t('Report')} /></div>;
  }
  if (selected.kind === 'push') {
    const row = selected.row;
    return <div className="flex flex-col gap-4"><StateChip state={row.ui} label={row.result} /><p className="text-xs text-muted-foreground">{t('Repository push receipts are separate from workflow integration.')}</p><Facts rows={[
      ['Repository', row.repo], [t('Repository role'), dash(row.repoRole)], [t('Scope'), row.scope], [t('Project'), dash(row.project)],
      [t('Branch'), row.branch], ['Head', dash(row.head)], ['From SHA', dash(row.from)], ['To SHA', dash(row.to)], [t('At'), at(row.at)],
      [t('Reason'), dash(row.reason)], [t('Failure signature'), dash(row.failureSignature)],
    ]} /><div><h3 className="mb-2 font-medium">Stderr</h3><BlobText blob={row.stderr} /></div><div><h3 className="mb-2 font-medium">Stdout</h3><BlobText blob={row.stdout} /></div></div>;
  }
  const row = selected.row;
  return <div className="flex flex-col gap-4"><StateChip state={row.ui} label={row.result} /><div className="grid grid-cols-2 gap-3"><Metric label="Commit" value={row.commit.slice(0, 12)} /><Metric label={t('SHA after land')} value={row.landedSha?.slice(0, 12) ?? '—'} /></div>
    <Facts rows={[[t('Scope'), row.scope], ['Lane', dash(row.lane)], ['Ticket', dash(row.ticket)], [t('Started'), at(row.startedAt)], [t('Ended'), at(row.finishedAt)]]} />
    {row.reason && <p className="shell-error">{row.reason}</p>}<div className="text-sm">Push: <RefLink refValue={row.push} /></div>
    {row.specs != null && <details><summary>{t('Recorded specs')}</summary><pre className="blob-text">{JSON.stringify(row.specs, null, 2)}</pre></details>}
    <div><h3 className="mb-2 font-medium">Stderr</h3><BlobText blob={row.stderr} /></div><div><h3 className="mb-2 font-medium">Stdout</h3><BlobText blob={row.stdout} /></div></div>;
}
