import type { AttemptDetailV2, UiState } from '../../../contract';
import { statusFromOutcome, statusFromVerdict, statusTone, type Tone } from '../../status';
import type { StepItem } from '../../step-bar';
import { formatSpan } from './util';

const stateOf = (tone: Tone): UiState => tone === 'success' ? 'done' : tone === 'failed' ? 'bad' : tone === 'running' ? 'running' : tone === 'warning' ? 'warn' : 'waiting';

export function isOpen(attempt: AttemptDetailV2): boolean {
  return attempt.verdict == null && attempt.endState !== 'worker-dead' && attempt.endState !== 'settled';
}

/** The six lifecycle steps with a semantic tone each; the checks step also carries a pass/fail bar. */
export function stepItems(attempt: AttemptDetailV2): StepItem[] {
  const at = (step: string) => attempt.timeline.find(item => item.step === step)?.at ?? null;
  const open = isOpen(attempt);
  const startedAt = at('started') ?? attempt.dispatchedAt;
  const runMs = attempt.reportedAt && startedAt ? attempt.reportedAt - startedAt : null;
  const runTone: Tone = attempt.endState === 'worker-dead' ? 'failed' : attempt.reportedAt ? 'success' : attempt.dispatchedAt ? 'running' : 'queued';
  const reportTone = attempt.reportedAt ? statusTone[statusFromOutcome(attempt.reportOutcome)] : 'queued';
  const ok = attempt.checks.filter(check => check.status === 'pass').length;
  const red = attempt.checks.filter(check => check.status === 'fail' || check.status === 'error').length;
  const other = attempt.checks.length - ok - red;
  const checksTone: Tone = red > 0 ? 'failed' : attempt.checks.length && other === 0 ? 'success' : attempt.checks.length ? 'warning' : 'queued';
  const verdictTone = statusTone[statusFromVerdict(attempt.verdict, open && Boolean(attempt.reportedAt))];
  const land = attempt.land;
  const landTone: Tone = land?.result === 'passed' ? 'success' : land?.result === 'failed' ? 'failed' : land ? 'warning' : attempt.verdict ? 'skipped' : 'queued';
  const landDetail = land ? (land.result === 'passed' ? 'Đã land' : land.result === 'failed' ? 'Land hỏng' : land.result) : attempt.verdict ? 'Không áp dụng' : 'Chưa tới';
  return [
    { key: 'dispatch', state: stateOf(attempt.dispatchedAt ? 'success' : 'queued'), tone: attempt.dispatchedAt ? 'success' : 'queued', at: attempt.dispatchedAt },
    { key: 'run', state: stateOf(runTone), tone: runTone, at: startedAt, detail: runMs != null ? formatSpan(runMs) : attempt.dispatchedAt ? 'Đang chạy' : undefined },
    { key: 'report', state: stateOf(reportTone), tone: reportTone, at: attempt.reportedAt, detail: attempt.reportedAt ? (attempt.reportOutcome ?? 'đã báo cáo') : undefined },
    { key: 'checks', state: stateOf(checksTone), tone: checksTone, at: at('checked'), detail: attempt.checks.length ? `${ok}/${attempt.checks.length} đạt` : 'Chưa có check',
      segments: [{ tone: 'success', n: ok }, { tone: 'failed', n: red }, { tone: 'warning', n: other }] },
    { key: 'verdict', state: stateOf(verdictTone), tone: verdictTone, at: attempt.settledAt, detail: attempt.verdict ?? (open && attempt.reportedAt ? 'Đang chốt' : undefined) },
    { key: 'land', state: stateOf(landTone), tone: landTone, at: land?.at ?? null, detail: landDetail },
  ];
}
