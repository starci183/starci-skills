import type { AttemptDetailV2, CheckPair, CheckRow } from '../../contract';

type VerificationAttempt = Pick<AttemptDetailV2, 'checks'> & { checkPairs?: CheckPair[] };
export type CheckObservation = 'pass' | 'fail' | 'unavailable' | 'skipped' | 'unknown';

export function derivePairs(attempt: VerificationAttempt): CheckPair[] {
  if (attempt.checkPairs) return attempt.checkPairs;
  // Older responses retain every recorded run. Only the owning API selects the latest identity.
  return attempt.checks.map(check => ({ key: `${check.id}`, name: check.name, phase: check.phase, runner: check.runner,
    authority: check.authority, op: check.authority === 'declared' ? check : null, runtime: check.authority === 'runtime' ? check : null }));
}

export function runtimeObservation(check: CheckRow | null): CheckObservation {
  if (!check) return 'unknown';
  return check.observation ?? 'unknown';
}

export function verificationSummary(attempt: VerificationAttempt) {
  const pairs = derivePairs(attempt);
  const runtimeTotal = pairs.filter(pair => pair.runtime != null).length;
  const passed = pairs.filter(pair => runtimeObservation(pair.runtime) === 'pass').length;
  const failed = pairs.filter(pair => runtimeObservation(pair.runtime) === 'fail').length;
  const unavailable = pairs.filter(pair => runtimeObservation(pair.runtime) === 'unavailable').length;
  const skipped = pairs.filter(pair => runtimeObservation(pair.runtime) === 'skipped').length;
  return { pairs, total: pairs.length, runtimeTotal, declaredTotal: pairs.length - runtimeTotal,
    runs: attempt.checks.length, passed, failed, unavailable, skipped, unconfirmed: runtimeTotal - passed - failed };
}
