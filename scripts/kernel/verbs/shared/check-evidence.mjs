// api-lib/check-evidence.mjs — the independent checks of one attempt, on check_runs (DBTREE; H8).
//
// `api record-checks` records the Kernel's (runner kernel) or the settler's (runner settler) checks of the job's latest attempt
// through scripts/machine/evidence-store.mjs recordCheck: the raw exit a runtime runner observed is exit_code; a command
// the runtime could not re-run is authority 'declared' (its value kept as declared_exit_code, exit_code NULL). The whole
// envelope entry (advisory, peerBlocked, attribution, measured, codes, failing) rides in summary_json.entry, so the
// readers - settle, the failure routes, prior_attempt_failures - rebuild the envelope from the latest run of each check.
import { latestCheckRuns, recordCheck } from '../../../machine/evidence-store.mjs';
import { parseJson } from '../../../lib/json.mjs';

/** Runners whose checks are independent evidence (never the op's own). */
export const INDEPENDENT_RUNNERS = Object.freeze(['kernel', 'settler', 'parity', 'integrate']);

/** The latest op_attempts row id of a job, or null. */
export const latestAttemptIdOf = (db, jobId) => db.prepare('SELECT max(attempt_id) id FROM op_attempts WHERE job_id=?').get(jobId)?.id ?? null;

/** Record one envelope's checks for `attemptId` (inside the caller's transaction). */
export function recordEnvelopeChecks(db, { attemptId, checks, runner, now = Date.now() }) {
  return checks.map((entry) => {
    const declared = entry.authority === 'declared';
    return recordCheck(db, { attemptId, name: String(entry.name), phase: 'verify', runner, authority: declared ? 'declared' : 'runtime',
      command: entry.command ?? null, exitCode: declared ? null : entry.exitCode, declaredExitCode: declared ? entry.exitCode : (entry.declaredExitCode ?? null),
      unavailable: entry.unavailable === true, attribution: entry.attribution ?? null, summary: { entry }, now });
  });
}

/**
 * The independent checks envelope of a job's attempt ({checks:[entry]}) - the latest run of each (runner, phase, name)
 * of INDEPENDENT_RUNNERS, each entry with the raw exit as exitCode - or null when there is none.
 */
export function independentChecksOf(db, { jobId = null, attemptId = null } = {}) {
  const id = attemptId ?? (jobId ? latestAttemptIdOf(db, jobId) : null);
  if (id == null) return null;
  const rows = latestCheckRuns(db, id).filter((r) => INDEPENDENT_RUNNERS.includes(r.runner));
  if (!rows.length) return null;
  return { checks: rows.map((r) => {
    const entry = parseJson(r.summary_json ?? '', {})?.entry ?? {};
    return { ...entry, name: r.name, command: r.command ?? entry.command ?? null, runner: r.runner, authority: r.authority, status: r.status,
      exitCode: Number.isInteger(r.exit_code) ? r.exit_code : (r.declared_exit_code ?? 1),
      ...(r.status === 'unavailable' ? { unavailable: true } : {}) };
  }) };
}
