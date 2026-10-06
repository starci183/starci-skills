import { many, parse } from './query.mjs';

/** Recorded engine action projection shared by System and job-scoped Attempt history. */
export function actionRow(machine, row, { project = null, ref, blob }) {
  let target = null;
  if (row.attempt_id) target = ref('attempt', row.attempt_id, project);
  else if (row.workflow_id) target = ref('workflow', row.workflow_id, project);
  return { id: row.id, controller: row.controller, duty: row.duty, key: row.key, verb: row.verb,
    state: row.state, ui: row.ui, mode: row.mode, epoch: row.epoch,
    startedAt: row.started_at, finishedAt: row.finished_at, exitCode: row.exit_code,
    errorSignature: row.error_signature,
    target,
    result: parse(row.result_json), resultBlob: blob(machine, row.result_sha),
    stdout: blob(machine, row.stdout_sha), stderr: blob(machine, row.stderr_sha),
    steps: many(machine, 'SELECT * FROM action_steps WHERE action_id=? ORDER BY step_no', row.id).map(step => ({
      stepNo: step.step_no, step: step.step, startedAt: step.started_at, ms: step.ms, ok: step.ok == null ? null : Boolean(step.ok) })) };
}
