import type { AttemptDetailV3 } from '../../../contract';
import { t } from '../../../i18n/t';
import { runtimeObservation, verificationSummary } from '../verification';

const obj = (value: unknown): Record<string, unknown> | null => (value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null);
const list = (value: unknown): string[] => (Array.isArray(value) ? value.map(item => (typeof item === 'string' ? item : JSON.stringify(item))) : []);

const failureClassEn: Record<string, string> = {
  business: 'business (the result does not meet the requirements yet)', 'shared-change': 'shared change (another op has to handle it)',
  transient: 'transient (infrastructure or network)', infra: 'infrastructure', tooling: 'tooling', timeout: 'over time', contract: 'wrong report contract',
};
export const failureClassText = (raw: string): string => t(failureClassEn[raw] ?? raw);

const nextKindEn: Record<string, string> = { retry: 'Retry this op', advance: 'Move to the next leg', escalate: 'Hand to a decider', block: 'Stop and wait for handling', replan: 'Replan' };

export type SettleView = { lines: string[]; failedChecks: string[]; nextStep: string | null; failureClass: string | null };

/** Turn `settle.json` (+ the check rows) into short Vietnamese sentences: what failed, which checks, what happens next. */
export function settleView(attempt: AttemptDetailV3): SettleView {
  const json = obj(attempt.settle?.json) ?? {};
  const lines: string[] = [];
  const failureRaw = attempt.failureClass ?? attempt.retry.class ?? (typeof json.failureClass === 'string' ? json.failureClass : null);
  const failureClass = attempt.verdict === 'pass' ? null : failureRaw;
  const failedChecks = verificationSummary(attempt).pairs.filter(pair => runtimeObservation(pair.runtime) === 'fail').map(pair => pair.name);
  const evidence = obj(json.checkEvidence);
  if (typeof json.reason === 'string' && json.reason) lines.push(json.reason);
  if (evidence) {
    const observed = evidence.observed; const passed = evidence.passed; const failed = evidence.failed;
    if (observed === 0) lines.push(t('No checks were observed by the verdict runner.'));
    else if (typeof observed === 'number' && typeof passed === 'number' && typeof failed === 'number') lines.push(t('The verdict runner cross-checked {observed} checks: {passed} passed, {failed} failed.', { observed, passed, failed }));
  }
  if (failedChecks.length) lines.push(t('Failed checks: {list}.', { list: failedChecks.join(', ') }));
  if (json.claimOverruled === true) lines.push(t('The op self-reported done but runtime verification rejected that claim.'));
  const landed = obj(json.landed);
  if (landed) {
    const missing = list(landed.missing); const dirty = list(landed.dirty);
    if (missing.length) lines.push(t('Still missing in the repo: {list}.', { list: missing.join(', ') }));
    if (dirty.length) lines.push(t('Uncommitted files remain: {list}.', { list: dirty.join(', ') }));
    if (typeof landed.headCheck === 'string') lines.push(landed.headCheck === 'verified' ? t('The reported commit was verified; integration is recorded separately.') : t('Last-commit check: {result}.', { result: landed.headCheck }));
  }
  if (attempt.verdict === 'blocked' && !lines.length) lines.push(t('The recorded verdict is blocked.'));
  const blocker = obj(obj(attempt.report?.json)?.blocker);
  if (attempt.verdict === 'blocked' && typeof blocker?.detail === 'string') lines.push(t('Blocker the op raised: {detail}', { detail: blocker.detail }));
  if (failureClass) lines.unshift(t('Failure class: {text}.', { text: failureClassText(failureClass) }));

  let nextStep: string | null = null;
  const parsedNext = (() => { try { return obj(JSON.parse(attempt.settle?.nextStep ?? 'null')); } catch { return null; } })();
  const next = obj(json.nextStep) ?? parsedNext;
  if (next) {
    const kind = typeof next.kind === 'string' ? t(nextKindEn[next.kind] ?? next.kind) : null;
    const reason = typeof next.reason === 'string' ? next.reason : null;
    nextStep = [kind, reason].filter(Boolean).join(' — ') || null;
  } else if (typeof attempt.settle?.nextStep === 'string' && attempt.settle.nextStep) nextStep = attempt.settle.nextStep;
  return { lines, failedChecks, nextStep, failureClass };
}
