// debug-digest-ledger.mjs — the ledger rows the operating standard is judged by: a workflow's attempts and the events that mark its
// steps, and the history of the workflows that finished. Read only, through the reader the caller opened.
import fs from 'node:fs';
import { parseJsonOr } from '../lib/json.mjs';
import { reboundMapOf, supersedeDir } from '../machine/placement-rebound.mjs';

const STEP_EVENTS = Object.freeze(['phase-transition', 'kernel-booted', 'kernel-restarted', 'kernel-adopted', 'kernel-start-failed', 'runtime-rev-acked', 'op-dispatched', 'dispatch-rejected',
  'checks-recorded', 'op-settled', 'handover-approved', 'provider-unavailable', 'op-caller-refused', 'ledger-written-outside-seat', 'critic-run', 'runtime-critic-run', 'runtime-critic-op-verdict-ignored']);

const ATTEMPTS_SQL = `SELECT a.attempt_id, a.job_id, a.op_id, a.try_no, a.agent, a.provider, a.dispatched_at, a.started_at, a.reported_at, a.settled_at, a.report_outcome,
  a.verdict, a.end_state, a.settled_by, a.worktree_path, a.transcript_sha,
  (SELECT count(*) FROM check_runs c WHERE c.attempt_id=a.attempt_id AND c.declared_exit_code IS NOT NULL AND c.exit_code IS NOT NULL
     AND ((c.declared_exit_code=0) <> (c.exit_code=0))
     AND c.run_seq=(SELECT MAX(x.run_seq) FROM check_runs x WHERE x.attempt_id=c.attempt_id AND x.name=c.name AND x.runner=c.runner)) AS claim_mismatch
  FROM op_attempts a WHERE a.workflow_id=? ORDER BY a.attempt_id`;

const EVENTS_SQL = `SELECT kind, attempt_id, entity_id, created_at,
  json_extract(payload_json,'$.step') AS step, substr(json_extract(payload_json,'$.error'),1,120) AS error, json_extract(payload_json,'$.op') AS op,
  json_extract(payload_json,'$.verdict') AS verdict, json_extract(payload_json,'$.claimOverruled') AS claim_overruled,
  json_extract(payload_json,'$.checkedIn') AS checked_in, json_extract(payload_json,'$.verb') AS verb,
  COALESCE(json_extract(payload_json,'$.criticProvider'), json_extract(payload_json,'$.critic.provider')) AS critic_provider, COALESCE(json_extract(payload_json,'$.opProvider'), json_extract(payload_json,'$.maker')) AS op_provider,
  json_extract(payload_json,'$.independent') AS independent, json_extract(payload_json,'$.code') AS code, json_extract(payload_json,'$.runtimeRev') AS runtime_rev,
  json_extract(payload_json,'$.critic.model') AS critic_model, json_extract(payload_json,'$.critic.durationMs') AS duration_ms, json_extract(payload_json,'$.critic.tokens') AS tokens,
  json_extract(payload_json,'$.outcome') AS run_outcome, json_extract(payload_json,'$.pass') AS run_pass, json_extract(payload_json,'$.try') AS run_try
  FROM events WHERE workflow_id=? AND kind IN (${STEP_EVENTS.map(() => '?').join(',')}) ORDER BY seq`;

const attemptOf = (r, exists, rebound) => ({ attemptId: r.attempt_id, jobId: r.job_id, op: r.op_id, tryNo: r.try_no, agent: r.agent, provider: r.provider,
  dispatchedAt: r.dispatched_at, startedAt: r.started_at, reportedAt: r.reported_at, settledAt: r.settled_at, reportOutcome: r.report_outcome,
  verdict: r.verdict, endState: r.end_state, settledBy: r.settled_by, worktreePath: r.worktree_path, transcriptSha: r.transcript_sha, claimMismatch: Number(r.claim_mismatch),
  treeExists: r.worktree_path && r.settled_at === null && r.end_state === null ? exists(supersedeDir(rebound(r.attempt_id), r.worktree_path)) : null });

const eventOf = (r) => ({ kind: r.kind, attemptId: r.attempt_id, entityId: r.entity_id, at: r.created_at, step: r.step, error: r.error, op: r.op, verb: r.verb,
  verdict: r.verdict, claimOverruled: r.claim_overruled === 1, checkedIn: parseJsonOr(r.checked_in, null),
  criticProvider: r.critic_provider, opProvider: r.op_provider, independent: r.kind === 'runtime-critic-run' ? Boolean(r.critic_provider && r.op_provider && r.critic_provider !== r.op_provider) : r.independent === 1,
  code: r.code, runtimeRev: r.runtime_rev ?? null, criticModel: r.critic_model ?? null, durationMs: r.duration_ms ?? null, tokens: r.tokens ?? null, runOutcome: r.run_outcome ?? null, runPass: r.run_pass == null ? null : r.run_pass === 1, runTry: r.run_try ?? null });

/** The attempts of one workflow; `treeExists` says whether the tree an unsettled attempt works in (its admitted tree read through its placement-rebound events) is on disk (null for a settled or ended attempt). */
export const attemptFacts = (db, workflowId, { exists = fs.existsSync } = {}) => db.prepare(ATTEMPTS_SQL).all(workflowId).map((r) => attemptOf(r, exists, (attemptId) => reboundMapOf(db, attemptId)));

/** The step-marking events of one workflow, oldest first. */
export const eventFacts = (db, workflowId) => db.prepare(EVENTS_SQL).all(workflowId, ...STEP_EVENTS).map(eventOf);

/** The finished workflows of a ledger, oldest first, each with the departures that can be counted from its rows. */
export function historyFacts(db) {
  const count = (sql, id) => Number(db.prepare(sql).get(id)?.n ?? 0);
  return db.prepare("SELECT workflow_id, created_at, finished_at, updated_at FROM workflows WHERE phase='finished' ORDER BY COALESCE(finished_at, updated_at)").all().map((w) => ({
    id: w.workflow_id, createdAt: w.created_at, finishedAt: w.finished_at ?? w.updated_at,
    interventions: count("SELECT count(*) AS n FROM events WHERE workflow_id=? AND kind='ledger-written-outside-seat'", w.workflow_id),
    runtimeDefects: count("SELECT count(*) AS n FROM incidents WHERE workflow_id=? AND kind='runtime-defect'", w.workflow_id),
    startFailures: count("SELECT count(*) AS n FROM events WHERE workflow_id=? AND kind='kernel-start-failed'", w.workflow_id) }));
}
