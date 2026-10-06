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

/** Recorded milestones; each tone and timestamp comes from its own receipt. */
export function stepItems(attempt: AttemptDetailV3): StepItem[] {
  const at = (step: string) => attempt.timeline.find(item => item.step === step)?.at ?? null;
  const open = isOpen(attempt);
  const startedAt = at('started');
  const runMs = attempt.reportedAt && startedAt ? attempt.reportedAt - startedAt : null;
  const runTone: Tone = attempt.endState === 'worker-dead' ? 'failed' : attempt.endState != null && !attempt.reportedAt ? 'skipped' : attempt.reportedAt ? 'success' : attempt.dispatchedAt ? 'running' : 'queued';
  const runUnknown = attempt.endState === 'effect-unknown';
  const reportTone = attempt.reportedAt ? statusTone[statusFromOutcome(attempt.reportOutcome)] : 'queued';
  const checks = verificationSummary(attempt);
  const { passed: ok, failed: red, unconfirmed: other } = checks;
  const checksTone: Tone = red > 0 ? 'failed' : checks.runtimeTotal > 0 && other === 0 ? 'success' : checks.runtimeTotal > 0 ? 'warning' : 'queued';
  const verdictTone = statusTone[statusFromVerdict(attempt.verdict, open && Boolean(attempt.reportedAt), attempt.ui)];
  const checkpoint = checkpointState(attempt.checkpoint);
  const land = attempt.land;
  const landStatus = workflowLandStatus(land);
  const landTone = statusTone[landStatus];
  const landDetail = land ? t('Workflow: {state}', { state: land.result === 'landed' ? t('Landed') : land.result }) : t('No workflow land record');
  return [
    { key: 'dispatch', state: stateOf(attempt.dispatchedAt ? 'success' : 'queued'), tone: attempt.dispatchedAt ? 'success' : 'queued', at: attempt.dispatchedAt },
    { key: 'run', state: runUnknown ? 'unknown' : stateOf(runTone), tone: runUnknown ? 'warning' : runTone, at: startedAt, detail: runUnknown ? t('Launch outcome unknown') : attempt.endState === 'requeued' ? t('Requeued') : runMs != null ? formatSpan(runMs) : open && attempt.dispatchedAt && !attempt.reportedAt ? t('Running') : undefined },
    { key: 'report', state: attempt.reportedAt && !attempt.reportOutcome ? 'unknown' : stateOf(reportTone), tone: reportTone, at: attempt.reportedAt, detail: attempt.reportedAt ? (attempt.reportOutcome ?? t('reported')) : undefined },
    { key: 'checks', state: checks.runtimeTotal === 0 ? 'unknown' : stateOf(checksTone), tone: checksTone, at: at('checked'), detail: checks.runtimeTotal > 0 ? t('Runtime confirmed {pass}/{total} checks', { pass: ok, total: checks.runtimeTotal }) : t('No runtime checks recorded'),
      segments: [{ tone: 'success', n: ok }, { tone: 'failed', n: red }, { tone: 'warning', n: other }] },
    { key: 'commit', state: checkpoint.status === 'unknown' ? 'unknown' : 'done', tone: statusTone[checkpoint.status], at: attempt.checkpoint?.at ?? null, detail: checkpoint.label },
    { key: 'verdict', state: !attempt.verdict && !attempt.reportedAt && attempt.ui !== 'awaiting-owner' && attempt.ui !== 'rejected' ? 'unknown' : stateOf(verdictTone), tone: verdictTone, at: attempt.settledAt, detail: attempt.ui === 'awaiting-owner' ? t('waiting for the owner') : attempt.ui === 'rejected' ? t('rejected at dispatch') : attempt.verdict ?? (open && attempt.reportedAt ? t('Settling') : undefined) },
    { key: 'land', state: landStatus === 'unknown' ? 'unknown' : stateOf(landTone), tone: landTone, at: land?.at ?? null, detail: landDetail },
  ];
}
