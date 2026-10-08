// attempt-placement.mjs - where an admitted attempt works once its workflow tree has been lost and put back.
//
// An attempt is admitted with the directory it works in (op_attempts.worktree_path, the contract's context.worktree, the packet's
// workflow_worktree.path and the gate binding's target roots): those records are immutable. When the workflow's registered tree is
// recreated at another path (starci workflow start, starci workflow custody --apply, the settler's own pass), every admitted but
// unsettled attempt of the workflow is settled one of two ways, decided from what the attempt still has:
//
//   rebind  its worker is gone, its report is filed and every file the report names is in the current tree: a `placement-rebound`
//           ledger event supersedes the lost path for settle and the checks (supersedeDir); the admission is not rewritten.
//   end     its worker is gone and its report is not filed, or the tree lacks a file the report names: the runtime fails the attempt
//           with the typed cause `placement-lost` (an environment cause, no business attempt spent, effect unknown) and the
//           Job controller's failed-no-step route queues the next attempt.
//
// An attempt whose worker is alive, or whose liveness cannot be read, is left alone (the next pass decides).
import fs from 'node:fs';
import path from 'node:path';
import { RETRY_CLASS_ENVIRONMENT } from '../../engine/admission.mjs';
import { releaseLeases, recordJobResult, setJobStatus, setUnitState, updateAttempt } from '../../engine/db/ledger.mjs';
import { TERMINAL_JOB_STATUSES } from '../machine/worktree-registry.mjs';
import { sameResolvedPath } from '../lib/path-key.mjs';
import { PLACEMENT_REBOUND, dirsOf, reboundMapOf, supersedeDir } from '../machine/placement-rebound.mjs';
import { parseJson } from '../lib/json.mjs';
import { recordWhy } from './why-record.mjs';
import { terminalShow } from '../api/orca/terminal-show.mjs';
import { WORKER_STATES, workerStateOf } from './workflow-in-flight.mjs';

/** The typed machine cause of an attempt the runtime ends because its placement is lost. */
export const PLACEMENT_LOST = 'placement-lost';

/** Every directory the attempt was admitted with: its attempt row, its contract context, its packet's tree and the gate binding's roots. */
function admittedPlacementsOf(db, attemptId) {
  const attempt = db.prepare('SELECT worktree_path FROM op_attempts WHERE attempt_id=?').get(attemptId);
  const context = parseJson(db.prepare('SELECT context_json FROM contracts WHERE attempt_id=?').get(attemptId)?.context_json ?? '', null) ?? {};
  const targets = (context.packet?.context?.gate_binding?.targets ?? []).map((target) => target?.root);
  const filed = [attempt?.worktree_path, context.worktree, context.packet?.context?.workflow_worktree?.path, ...targets];
  return [...new Set(dirsOf(filed).map((dir) => path.resolve(dir)))];
}

/** The files a filed report names, app-relative; [] when none. */
function reportFilesOf(reportJson) {
  const files = parseJson(reportJson, {})?.files;
  return Array.isArray(files) ? files.filter((file) => typeof file === 'string' && file && !path.isAbsolute(file)) : [];
}

/** The candidate attempts: the latest unsettled attempt of each op job of the workflow that still holds a tree. */
function candidatesOf(db, workflowId, jobId) {
  const marks = TERMINAL_JOB_STATUSES.map(() => '?').join(',');
  const scoped = jobId ? ' AND j.job_id=?' : '';
  return db.prepare(`SELECT j.job_id, j.workflow_id, j.status, j.worker_id, j.deadline, j.payload_json, j.unit_id, a.attempt_id, a.reported_at
    FROM jobs j JOIN op_attempts a ON a.attempt_id=(SELECT max(x.attempt_id) FROM op_attempts x WHERE x.job_id=j.job_id)
    WHERE j.workflow_id=? AND j.kind='op' AND j.status IN (${marks}) AND a.settled_at IS NULL${scoped}`).all(workflowId, ...TERMINAL_JOB_STATUSES, ...(jobId ? [jobId] : []));
}

/** The lost directories among an attempt's current placements: not the tree, and no directory any more. */
function lostDirsOf(db, attemptId, tree) {
  const map = reboundMapOf(db, attemptId);
  const current = admittedPlacementsOf(db, attemptId).map((dir) => path.resolve(supersedeDir(map, dir)));
  return [...new Set(current.filter((dir) => !sameResolvedPath(dir, tree.path) && !fs.existsSync(dir)))];
}

/** What the attempt still has: the filed report, and whether the tree holds every file the report names. */
function evidenceOf(db, row, tree) {
  const report = db.prepare('SELECT report_id, outcome, report_json FROM reports WHERE attempt_id=?').get(row.attempt_id) ?? null;
  const files = report ? reportFilesOf(report.report_json) : [];
  const missing = files.filter((file) => !fs.existsSync(path.join(tree.path, file)));
  return { reportId: report?.report_id ?? null, outcome: report?.outcome ?? null, files: files.length, missing };
}

const treeFacts = (tree) => ({ to: tree.path, branch: tree.branch ?? null, orcaWorktreeId: tree.orcaWorktreeId ?? null, checkpoint: tree.checkpoint ?? null });

function rebindAttempt(ledger, row, { tree, lost, evidence, worker, now }) {
  ledger.transaction(() => ledger.appendEvent({ workflowId: row.workflow_id, entityType: 'attempt', entityId: String(row.attempt_id), attemptId: row.attempt_id,
    kind: PLACEMENT_REBOUND, createdAt: now,
    payload: { jobId: row.job_id, attemptId: row.attempt_id, from: lost, ...treeFacts(tree), arm: 'rebind', reason: 'tree-reattached',
      reportId: evidence.reportId, reportFiles: evidence.files, worker } }));
}

/** The end of an attempt whose placement is lost: failed with the typed environment cause, leases released, its unit failed. */
function endAttempt(ledger, row, { tree, lost, evidence, worker, now }) {
  const db = ledger.db;
  ledger.transaction(() => {
    const fresh = db.prepare('SELECT status FROM jobs WHERE job_id=?').get(row.job_id);
    if (fresh?.status !== row.status) return;
    const payload = parseJson(row.payload_json, {}) ?? {};
    const next = { ...payload, verdict: 'fail', settledAt: now, placementLost: { from: lost, ...treeFacts(tree), at: now } };
    const why = evidence.reportId == null ? 'no report was filed' : `${evidence.missing.length} file(s) of its report are not in the current tree`;
    const result = { verdict: 'fail', reason: PLACEMENT_LOST, reportFiled: evidence.reportId != null, effectState: 'unknown', attemptConsumed: false, retryable: true,
      retryClass: RETRY_CLASS_ENVIRONMENT, environment: PLACEMENT_LOST, worker, evidence: [`lost:${lost.join(',')}`, why, ...evidence.missing.slice(0, 6).map((file) => `missing:${file}`)], at: now };
    const leasesReleased = releaseLeases(db, { jobId: row.job_id });
    if (row.status === 'answering') setJobStatus(db, { jobId: row.job_id, to: 'running', reason: PLACEMENT_LOST, attemptId: row.attempt_id, at: now });
    setJobStatus(db, { jobId: row.job_id, to: 'failed', reason: PLACEMENT_LOST, attemptId: row.attempt_id, at: now, payload: next, leaseToken: null, deadline: null });
    recordJobResult(db, { jobId: row.job_id, result, at: now });
    updateAttempt(db, { attemptId: row.attempt_id, at: now, endState: 'worker-dead', effectState: 'unknown', settledAt: now, settledBy: 'reconcile' });
    recordWhy(db, row.attempt_id, { at: now });
    if (row.unit_id) setUnitState(db, { workflowId: row.workflow_id, unitId: row.unit_id, to: 'failed', reason: `${row.job_id} ${PLACEMENT_LOST}`, at: now });
    ledger.appendEvent({ workflowId: row.workflow_id, entityType: 'job', entityId: row.job_id, attemptId: row.attempt_id, kind: 'placement-ended', createdAt: now,
      payload: { jobId: row.job_id, attemptId: row.attempt_id, from: lost, ...treeFacts(tree), arm: 'end', reason: PLACEMENT_LOST, cause: why, leasesReleased, worker, reportId: evidence.reportId } });
    ledger.appendEvent({ workflowId: row.workflow_id, entityType: 'job', entityId: row.job_id, kind: 'op-settled', createdAt: now,
      payload: { verdict: 'fail', status: 'failed', reason: PLACEMENT_LOST, auto: true, attemptConsumed: false, effectState: 'unknown', reportFiled: evidence.reportId != null, leasesReleased } });
  });
}

/**
 * Settle the placement of every admitted, unsettled attempt of `workflowId` against its registered `tree` ({path, branch, checkpoint,
 * orcaWorktreeId}). `jobId` narrows to one job. Returns {rebound, ended, deferred}: [{jobId, attemptId, from, ...}] each.
 */
export function reconcileAttemptPlacements(ledger, { workflowId, tree, jobId = null, show = terminalShow, now = Date.now() }) {
  const db = ledger.db;
  const out = { rebound: [], ended: [], deferred: [] };
  if (!tree?.path || !fs.existsSync(tree.path)) return out;
  for (const row of candidatesOf(db, workflowId, jobId)) {
    const lost = lostDirsOf(db, row.attempt_id, tree);
    if (!lost.length) continue;
    const worker = workerStateOf(row, { show, now, reported: row.status === 'reported' }).state;
    const item = { jobId: row.job_id, attemptId: row.attempt_id, from: lost };
    if (worker !== WORKER_STATES.gone) { out.deferred.push({ ...item, worker }); continue; }
    const evidence = evidenceOf(db, row, tree);
    const ctx = { tree, lost, evidence, worker, now };
    if (evidence.reportId != null && !evidence.missing.length) { rebindAttempt(ledger, row, ctx); out.rebound.push(item); }
    else { endAttempt(ledger, row, ctx); out.ended.push({ ...item, missing: evidence.missing }); }
  }
  return out;
}
