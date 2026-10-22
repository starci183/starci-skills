import type { AttemptDetailV3, UiState } from '../../../contract';
import { statusFromOutcome, statusFromVerdict, statusTone, type Tone } from '../../status';
import type { StepItem } from '../../step-bar';
import { formatSpan } from './util';
import { t } from '../../../i18n/t';
import { verificationSummary } from '../verification';
import { workflowLandStatus } from '../land-state';
import { checkpointState } from '../checkpoint';

const stateOf = (tone: Tone): UiState => tone === 'success' ? 'done' : tone === 'failed' ? 'bad' : tone === 'running' ? 'running' : tone === 'warning' ? 'warn' : 'waiting';

export function isOpen(attempt: AttemptDetailV3): boolean {
  return attempt.verdict == null && attempt.endState == null;
}

function runToneOf(attempt: AttemptDetailV3, closedWithoutReport: boolean): Tone {
  if (attempt.endState === 'worker-dead') return 'failed';
  if (attempt.endState != null && !attempt.reportedAt) return 'skipped';
  if (attempt.reportedAt) return 'success';
  if (closedWithoutReport) return 'skipped';
  return attempt.dispatchedAt ? 'running' : 'queued';
}

function runDetailOf(attempt: AttemptDetailV3, open: boolean, closedWithoutReport: boolean, runMs: number | null): string | undefined {
  if (attempt.endState === 'effect-unknown') return t('Launch outcome unknown');
  if (attempt.endState === 'requeued') return t('Requeued');
  if (closedWithoutReport) return open ? t('Terminal closed · settlement pending') : t('Terminal closed');
  if (runMs != null) return formatSpan(runMs);
  return open && attempt.dispatchedAt && !attempt.reportedAt ? t('Running') : undefined;
}

function checksToneOf(failed: number, runtimeTotal: number, unconfirmed: number): Tone {
  if (failed > 0) return 'failed';
  if (runtimeTotal > 0) return unconfirmed === 0 ? 'success' : 'warning';
  return 'queued';
}

function verdictDetailOf(attempt: AttemptDetailV3, open: boolean): string | undefined {
  if (attempt.ui === 'awaiting-owner') return t('waiting for the owner');
  if (attempt.ui === 'rejected') return t('rejected at dispatch');
  return attempt.verdict ?? (open && attempt.reportedAt ? t('Settling') : undefined);
}

function runStep(attempt: AttemptDetailV3, open: boolean, startedAt: number | null): StepItem {
  const runEnd = attempt.terminalEndedAt ?? attempt.reportedAt;
  const runMs = runEnd != null && startedAt != null ? runEnd - startedAt : null;
  const closedWithoutReport = attempt.terminalEndedAt != null && attempt.reportedAt == null;
  const runTone = runToneOf(attempt, closedWithoutReport);
  const runUnknown = attempt.endState === 'effect-unknown';
  return { key: 'run', state: runUnknown ? 'unknown' : stateOf(runTone), tone: runUnknown ? 'warning' : runTone, at: startedAt, detail: runDetailOf(attempt, open, closedWithoutReport, runMs) };
}

function reportStep(attempt: AttemptDetailV3): StepItem {
  const reportTone = attempt.reportedAt ? statusTone[statusFromOutcome(attempt.reportOutcome)] : 'queued';
  return { key: 'report', state: attempt.reportedAt && !attempt.reportOutcome ? 'unknown' : stateOf(reportTone), tone: reportTone, at: attempt.reportedAt, detail: attempt.reportedAt ? (attempt.reportOutcome ?? t('reported')) : undefined };
}

function checksStep(attempt: AttemptDetailV3, checkedAt: number | null): StepItem {
  const checks = verificationSummary(attempt);
  const { passed: ok, failed: red, unconfirmed: other } = checks;
  const checksTone = checksToneOf(red, checks.runtimeTotal, other);
  return { key: 'checks', state: checks.runtimeTotal === 0 ? 'unknown' : stateOf(checksTone), tone: checksTone, at: checkedAt, detail: checks.runtimeTotal > 0 ? t('Runtime confirmed {pass}/{total} checks', { pass: ok, total: checks.runtimeTotal }) : t('No runtime checks recorded'),
    segments: [{ tone: 'success', n: ok }, { tone: 'failed', n: red }, { tone: 'warning', n: other }] };
}

function verdictStep(attempt: AttemptDetailV3, open: boolean): StepItem {
  const verdictTone = statusTone[statusFromVerdict(attempt.verdict, open && Boolean(attempt.reportedAt), attempt.ui)];
  const unrecorded = !attempt.verdict && !attempt.reportedAt && attempt.ui !== 'awaiting-owner' && attempt.ui !== 'rejected';
  return { key: 'verdict', state: unrecorded ? 'unknown' : stateOf(verdictTone), tone: verdictTone, at: attempt.settledAt, detail: verdictDetailOf(attempt, open) };
}

function landStep(attempt: AttemptDetailV3): StepItem {
  const land = attempt.land;
  const landStatus = workflowLandStatus(land);
  const landTone = statusTone[landStatus];
  const landDetail = land ? t('Workflow: {state}', { state: land.result === 'landed' ? t('Landed') : land.result }) : t('No workflow land record');
  return { key: 'land', state: landStatus === 'unknown' ? 'unknown' : stateOf(landTone), tone: landTone, at: land?.at ?? null, detail: landDetail };
}

/** Recorded milestones; each tone and timestamp comes from its own receipt. */
export function stepItems(attempt: AttemptDetailV3): StepItem[] {
  const at = (step: string) => attempt.timeline.find(item => item.step === step)?.at ?? null;
  const open = isOpen(attempt);
  const checkpoint = checkpointState(attempt.checkpoint);
  return [
    { key: 'dispatch', state: stateOf(attempt.dispatchedAt ? 'success' : 'queued'), tone: attempt.dispatchedAt ? 'success' : 'queued', at: attempt.dispatchedAt },
    runStep(attempt, open, at('started')),
    reportStep(attempt),
    checksStep(attempt, at('checked')),
    { key: 'commit', state: checkpoint.status === 'unknown' ? 'unknown' : 'done', tone: statusTone[checkpoint.status], at: attempt.checkpoint?.at ?? null, detail: checkpoint.label },
    verdictStep(attempt, open),
    landStep(attempt),
  ];
}
