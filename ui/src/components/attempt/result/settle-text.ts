import type { AttemptDetailV3 } from '../../../contract';
import { t } from '../../../i18n/t';
import { runtimeObservation, verificationSummary } from '../verification';

const obj = (value: unknown): Record<string, unknown> | null => (value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null);
const list = (value: unknown): string[] => (Array.isArray(value) ? value.map(item => (typeof item === 'string' ? item : JSON.stringify(item))) : []);

const failureClassEn: Record<string, string> = {
  business: 'business (the result does not meet the requirements yet)', 'shared-change': 'shared change (another op has to handle it)',
  transient: 'transient (infrastructure or network)', infra: 'infrastructure', tooling: 'tooling', timeout: 'over time', contract: 'wrong report contract',
};
/** Localised plain-language label for a failure class code, falling back to the raw code when it is unknown. */
export const failureClassText = (raw: string): string => t(failureClassEn[raw] ?? raw);

const nextKindEn: Record<string, string> = { retry: 'Retry this op', advance: 'Move to the next leg', escalate: 'Hand to a decider', block: 'Stop and wait for handling', replan: 'Replan' };

/** The settle.json distilled for display: explanatory lines, the failing checks, the suggested next step and the failure class. */
export type SettleView = { lines: string[]; failedChecks: string[]; nextStep: string | null; failureClass: string | null };

const evidenceLines = (evidence: Record<string, unknown> | null): string[] => {
  if (!evidence) return [];
  const { observed, passed, failed } = evidence;
  if (observed === 0) return [t('No checks were observed by the verdict runner.')];
  if (typeof observed === 'number' && typeof passed === 'number' && typeof failed === 'number') return [t('The verdict runner cross-checked {observed} checks: {passed} passed, {failed} failed.', { observed, passed, failed })];
  return [];
};

const landedLines = (landed: Record<string, unknown> | null): string[] => {
  if (!landed) return [];
  const lines: string[] = [];
  const missing = list(landed.missing);
  const dirty = list(landed.dirty);
  if (missing.length) lines.push(t('Still missing in the repo: {list}.', { list: missing.join(', ') }));
  if (dirty.length) lines.push(t('Uncommitted files remain: {list}.', { list: dirty.join(', ') }));
  if (typeof landed.headCheck === 'string') lines.push(landed.headCheck === 'verified' ? t('The reported commit was verified; integration is recorded separately.') : t('Last-commit check: {result}.', { result: landed.headCheck }));
  return lines;
};

const parsedNextStep = (raw: string | null | undefined): Record<string, unknown> | null => {
  try { return obj(JSON.parse(raw ?? 'null')); } catch { return null; }
};

const nextStepOf = (attempt: AttemptDetailV3, json: Record<string, unknown>): string | null => {
  const next = obj(json.nextStep) ?? parsedNextStep(attempt.settle?.nextStep);
  if (next) {
    const kind = typeof next.kind === 'string' ? t(nextKindEn[next.kind] ?? next.kind) : null;
    const reason = typeof next.reason === 'string' ? next.reason : null;
    return [kind, reason].filter(Boolean).join(' — ') || null;
  }
  return typeof attempt.settle?.nextStep === 'string' && attempt.settle.nextStep ? attempt.settle.nextStep : null;
};

/** Turn `settle.json` (+ the check rows) into short Vietnamese sentences: what failed, which checks, what happens next. */
export const settleView = (attempt: AttemptDetailV3): SettleView => {
  const json = obj(attempt.settle?.json) ?? {};
  const lines: string[] = [];
  const failureRaw = attempt.failureClass ?? attempt.retry.class ?? (typeof json.failureClass === 'string' ? json.failureClass : null);
  const failureClass = attempt.verdict === 'pass' ? null : failureRaw;
  const failedChecks = verificationSummary(attempt).pairs.filter(pair => runtimeObservation(pair.runtime) === 'fail').map(pair => pair.name);
  if (typeof json.reason === 'string' && json.reason) lines.push(json.reason);
  lines.push(...evidenceLines(obj(json.checkEvidence)));
  if (failedChecks.length) lines.push(t('Failed checks: {list}.', { list: failedChecks.join(', ') }));
  if (json.claimOverruled === true) lines.push(t('The op self-reported done but runtime verification rejected that claim.'));
  lines.push(...landedLines(obj(json.landed)));
  if (attempt.verdict === 'blocked' && !lines.length) lines.push(t('The recorded verdict is blocked.'));
  const blocker = obj(obj(attempt.report?.json)?.blocker);
  if (attempt.verdict === 'blocked' && typeof blocker?.detail === 'string') lines.push(t('Blocker the op raised: {detail}', { detail: blocker.detail }));
  if (failureClass) lines.unshift(t('Failure class: {text}.', { text: failureClassText(failureClass) }));
  return { lines, failedChecks, nextStep: nextStepOf(attempt, json), failureClass };
};
