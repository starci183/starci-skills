import type { CheckPair, CheckRow } from '../../contract';

type VerificationAttempt = { checks: CheckRow[]; checkPairs: CheckPair[] };
export type CheckObservation = 'pass' | 'fail' | 'unavailable' | 'skipped' | 'unknown';

export function runtimeObservation(check: CheckRow | null): CheckObservation {
  if (!check) return 'unknown';
  return check.observation ?? 'unknown';
}

export function verificationSummary(attempt: VerificationAttempt) {
  const pairs = attempt.checkPairs;
  const runtimeTotal = pairs.filter(pair => pair.runtime != null).length;
  const passed = pairs.filter(pair => runtimeObservation(pair.runtime) === 'pass').length;
  const failed = pairs.filter(pair => runtimeObservation(pair.runtime) === 'fail').length;
  const unavailable = pairs.filter(pair => runtimeObservation(pair.runtime) === 'unavailable').length;
  const skipped = pairs.filter(pair => runtimeObservation(pair.runtime) === 'skipped').length;
  return { pairs, total: pairs.length, runtimeTotal, declaredTotal: pairs.length - runtimeTotal,
    runs: attempt.checks.length, passed, failed, unavailable, skipped, unconfirmed: runtimeTotal - passed - failed };
}
