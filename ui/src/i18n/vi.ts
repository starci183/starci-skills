import type { ContractInfo, Reason, UiState } from '../contract';
import { t } from './t';

export const navLabels = {
  overview: t('Overview'),
  decisions: t('Decisions'),
  system: t('System'),
  logs: t('Logs'),
  analytics: t('Analytics'),
} as const;

export const stateLabels: Record<UiState, string> = {
  bad: t('Bad / Stuck'),
  warn: t('Slow / Warning'),
  running: t('Running'),
  waiting: t('Waiting'),
  ok: t('OK'),
  done: t('Done'),
  unknown: t('Unknown'),
};

export const unitStateLabels = {
  planned: t('Planned'),
  queued: t('Queued unit'),
  running: t('Running'),
  reported: t('Reported'),
  deciding: t('Deciding'),
  done: t('Passed'),
  failed: t('Failed'),
  dropped: t('Dropped'),
} as const;

export const stepLabels = {
  dispatch: t('Dispatch'),
  run: t('Run step'),
  report: t('Report'),
  checks: t('Checks'),
  commit: t('Runtime checkpoint'),
  verdict: t('Verdict'),
  land: t('Workflow integration'),
} as const;

export const learningKindLabels: Record<string, string> = {
  lesson: t('Lesson'),
  hypothesis: t('Hypothesis'),
  experiment: t('Experiment'),
  'experiment-result': t('Experiment result'),
};

export const learningStateLabels: Record<string, string> = {
  kept: t('Kept'),
  reverted: t('Reverted'),
  keep: t('Keep'),
  revert: t('Revert'),
  proposed: t('Proposed'),
  running: t('Running'),
  landed: t('Landed'),
};

export function formatOpLabel(op: string, labels: ContractInfo['opLabels']): string {
  return labels?.[op]?.vi?.trim() || labels?.[op.split('#')[0]]?.vi?.trim() || op;
}

export const reasonLabels: Record<string, string> = {
  OWNER_DECISION_OPEN: t('An owner decision is pending'),
  DECISION_OPEN: t('A decision is pending'),
  DECISION_OVERDUE: t('A decision is overdue'),
  PHASE_REASON: t('The workflow phase was recorded'),
  UNDER_DISPATCHED: t('Dispatched below the minimum'),
  READY_UNDISPATCHED: t('A ready unit has not been dispatched'),
  RAM_THROTTLED: t('The machine is throttled for RAM'),
  WORKER_SILENT: t('An op has missed its heartbeat deadline'),
  QUESTION_OVERDUE: t('An op question is overdue'),
  SEAT_VACANT: t('The Kernel seat is vacant'),
  UpstreamNotDone: t('Waiting for an upstream unit'),
  WorkerQuestionPending: t('An op is waiting for an answer'),
  SettleTailFailed: t('A post-settlement step failed'),
  SLA_CRITICAL: t('The SLA is critical'),
  SLA_WARNING: t('The SLA has a warning'),
  UNIT_FAILED: t('A unit failed'),
  PROGRESS: t('Progress needs attention'),
};

const reasonParamLabels: Record<string, string> = {
  kind: t('Decision kind'),
  phase: t('Phase'),
  count: t('Count'),
  running: t('Running'),
  allowedParallel: t('Allowed parallelism'),
  queuedReady: t('Ready in queue'),
};

const reasonParamValues: Record<string, string> = {
  'settle-nongreen': t('Non-green settlement'),
  'credential-missing': t('Missing credentials'),
  decision: t('Decision'),
  paused: t('Paused'),
  stopped: t('Stopped'),
  running: t('Running'),
  queued: t('Queued unit'),
  done: t('Completed'),
};

function reasonTitle(code: string): string {
  if (reasonLabels[code]) return reasonLabels[code];
  if (code.startsWith('DecisionOpen:')) return t('Decision pending · {kind}', { kind: reasonParamValues[code.slice(13)] ?? code.slice(13) });
  if (code.startsWith('IncidentOpen:')) return t('Open incident · {kind}', { kind: reasonParamValues[code.slice(13)] ?? code.slice(13) });
  return code;
}

export function formatReason(reason: Reason | null | undefined): string {
  if (!reason) return t('No reason recorded.');
  const title = reasonTitle(reason.code);
  const params = Object.entries(reason.params ?? {}).filter(([, value]) => value !== '' && value !== null && value !== undefined);
  if (!params.length) return title;
  return `${title} · ${params.map(([key, value]) => `${reasonParamLabels[key] ?? key}: ${reasonParamValues[String(value)] ?? value}`).join(' · ')}`;
}

function validTimestamp(at: unknown): at is number {
  return typeof at === 'number' && Number.isFinite(at) && Number.isFinite(new Date(at).getTime());
}

export function formatAbsolute(at: number | null | undefined): string {
  if (!validTimestamp(at)) return t('No timestamp recorded');
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Bangkok', day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(at);
}

export function formatRelative(at: number | null | undefined, now = Date.now()): string {
  if (!validTimestamp(at) || !validTimestamp(now)) return t('No timestamp recorded');
  if (at > now) return t('Future timestamp: {at}', { at: formatAbsolute(at) });
  const delta = now - at;
  if (delta < 60_000) return t('just now');
  if (delta < 3_600_000) return t('{n} minutes ago', { n: Math.floor(delta / 60_000) });
  if (delta < 86_400_000) return t('{n} hours ago', { n: Math.floor(delta / 3_600_000) });
  return t('{n} days ago', { n: Math.floor(delta / 86_400_000) });
}
