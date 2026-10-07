// api-lib/check-evidence.mjs — the independent checks of one attempt, on check_runs (DBTREE; H8).
//
// `starci kernel record-checks` records the Kernel's (runner kernel) or the settler's (runner settler) checks of the job's latest attempt
// through scripts/machine/evidence-store.mjs recordCheck: the raw exit a runtime runner observed is exit_code; a command
// the runtime could not re-run is authority 'declared' (its value kept as declared_exit_code, exit_code NULL). The whole
// envelope entry (advisory, peerBlocked, attribution, measured, codes, failing) rides in summary_json.entry, so the
// readers - settle, the failure routes, prior_attempt_failures - rebuild the envelope from the latest run of each check.
import path from 'node:path';
import { latestCheckRuns, recordCheck } from '../../../machine/evidence-store.mjs';
import { parseJson } from '../../../lib/json.mjs';
import { requireWorkflowPlacement, workflowAppRepo } from '../../workflow-worktree.mjs';

/** Runners whose checks are independent evidence (never the op's own). */
const INDEPENDENT_RUNNERS = Object.freeze(['kernel', 'settler', 'parity', 'integrate']);

/** The latest op_attempts row id of a job, or null. */
export const latestAttemptIdOf = (db, jobId) => db.prepare('SELECT max(attempt_id) id FROM op_attempts WHERE job_id=?').get(jobId)?.id ?? null;

/**
 * The directory a job's check re-run executes in (docs/workflow-kernel.md, Dispatch): a Git workflow's registered
 * worktree, which every placement the attempt recorded must name (the same readers as settle's checkpoint); the
 * ledger repo only for a non-Git ledger with no registered tree. A Git workflow whose tree cannot be resolved throws
 * {code: 'check-rerun-worktree-unresolved', reason: <the placement refusal>} - a re-run never falls back to main.
 */
export function checkRerunRootOf(db, job, { repo, env = process.env, appRepoOf = workflowAppRepo } = {}) {
  const attemptId = latestAttemptIdOf(db, job.job_id);
  const attempt = attemptId == null ? null : db.prepare('SELECT worktree_path FROM op_attempts WHERE attempt_id=?').get(attemptId);
  const context = parseJson(attemptId == null ? '' : (db.prepare('SELECT context_json FROM contracts WHERE attempt_id=?').get(attemptId)?.context_json ?? ''), null) ?? {};
  const filedTree = context.packet?.context?.workflow_worktree;
  const placements = [attempt?.worktree_path, context.worktree, filedTree?.path].filter((dir) => typeof dir === 'string' && dir).map((dir) => path.resolve(repo, dir));
  const required = Boolean(filedTree || appRepoOf(repo) || placements.some((dir) => appRepoOf(dir)));
  try {
    const tree = requireWorkflowPlacement({ env }, { workflowId: job.workflow_id, placements, required });
    return tree ? tree.path : path.resolve(repo);
  } catch (cause) {
    throw Object.assign(new Error(`check re-run of job ${job.job_id} refused: ${cause.message}`, { cause }),
      { code: 'check-rerun-worktree-unresolved', reason: cause.code ?? null, workflowId: job.workflow_id });
  }
}

/** Record one envelope's checks for `attemptId` (inside the caller's transaction). */
export function recordEnvelopeChecks(db, { attemptId, checks, runner, observations = new Map(), now = Date.now() }) {
  return checks.map((entry) => {
    const declared = entry.authority === 'declared', observed = observations.get(String(entry.name));
    return recordCheck(db, { attemptId, name: String(entry.name), phase: 'verify', runner, authority: declared ? 'declared' : 'runtime',
      command: entry.command ?? null, exitCode: declared ? null : entry.exitCode, declaredExitCode: declared ? entry.exitCode : (entry.declaredExitCode ?? null),
      ...(observed ? { cwd: observed.cwd, inputDigest: observed.inputDigest, exitCode: observed.exitCode, status: observed.status,
        startedAt: observed.startedAt, finishedAt: observed.finishedAt, wallMs: observed.wallMs, stdout: observed.stdout, stderr: observed.stderr, output: observed.output } : {}),
      unavailable: entry.unavailable === true, attribution: entry.attribution ?? null, summary: { entry, ...(observed?.native ? { native: observed.native } : {}) }, now });
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
    return { ...entry, checkId: r.check_id, name: r.name, command: r.command ?? entry.command ?? null, runner: r.runner, authority: r.authority, status: r.status,
      exitCode: Number.isInteger(r.exit_code) ? r.exit_code : (r.declared_exit_code ?? 1),
      ...(r.status === 'unavailable' ? { unavailable: true } : {}) };
  }) };
}
