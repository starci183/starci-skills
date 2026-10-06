// api-lib/kernel-seat.mjs — the live Kernel job of a workflow and the terminal its seat names
// (split out of cli.mjs, lane slim-api). Read projections only.
import { parseJson } from '../../../lib/json.mjs';
import { jobPayloadOf } from './rows.mjs';

import { KERNEL_LAUNCH_EVENTS } from '../../../machine/terminal-ledger.mjs';
import { sha256 } from '../../../../engine/digest.mjs';

export function kernelSeatOf(db, workflowId, env = process.env) {
  // The seat's boot count lives in its payload (hierarchy.attempt, scripts/kernel/start-workflow.mjs); try_no is always 1.
  const job = db.prepare("SELECT status,worker_id,payload_json FROM jobs WHERE job_id=? AND kind='kernel'").get(`kernel-${workflowId}`);
  if (!job) return null;
  const launch = db.prepare(`SELECT kind,created_at,payload_json FROM events WHERE workflow_id=? AND kind IN (${KERNEL_LAUNCH_EVENTS.map(() => '?').join(',')}) ORDER BY seq DESC LIMIT 1`)
    .get(workflowId, ...KERNEL_LAUNCH_EVENTS);
  const payload = parseJson(launch?.payload_json, {}) ?? {};
  const terminal = job.worker_id ?? payload.terminal ?? null;
  const attempt = jobPayloadOf(job)?.hierarchy?.attempt;
  return { attempt: Number.isInteger(attempt) ? attempt : null, status: job.status, terminal, launch: launch?.kind ?? null,
    launchedAt: launch ? new Date(launch.created_at).toISOString() : null, launchedBy: payload.launchedBy ?? null,
    you: Boolean(terminal && env.ORCA_TERMINAL_HANDLE && env.ORCA_TERMINAL_HANDLE === terminal) };
}

// The live Kernel custody of a workflow: its newest Kernel job and the exact terminal the seat names
// (the singleton signal, then the job's worker, then the hierarchy's runtime handle).
export const kernelCustodyOf = (db, workflowId) => {
  const signal = db.prepare("SELECT token,value_json,expires_at FROM signals WHERE scope='kernel' AND key=?").get(workflowId) ?? null;
  const job = db.prepare("SELECT * FROM jobs WHERE workflow_id=? AND kind='kernel' ORDER BY created_at DESC LIMIT 1").get(workflowId) ?? null;
  const payload = job ? jobPayloadOf(job) : null;
  const terminal = parseJson(signal?.value_json)?.terminal ?? job?.worker_id ?? payload?.hierarchy?.runtime?.terminalHandle ?? null;
  return { job, payload, terminal, signal };
};

/** Prove one current incarnation from the existing workflow, job, hierarchy and singleton signal. */
export function kernelAuthorityOf(db, workflowId, handle, { now = Date.now() } = {}) {
  const wf = db.prepare('SELECT generation,phase FROM workflows WHERE workflow_id=?').get(workflowId);
  const { job, payload, signal } = kernelCustodyOf(db, workflowId);
  const hierarchy = payload?.hierarchy, managed = payload?.managed, value = parseJson(signal?.value_json);
  const valid = wf && !['archived', 'finished', 'stopped'].includes(wf.phase) && job?.status === 'running'
    && job.generation === wf.generation && hierarchy?.generation === wf.generation
    && Number.isInteger(hierarchy?.attempt) && hierarchy.attempt > 0 && hierarchy.workflowId === workflowId
    && signal?.token && (signal.expires_at == null || signal.expires_at > now)
    && handle && job.worker_id === handle && hierarchy.runtime?.terminalHandle === handle
    && managed?.agentTerminalHandle === handle && value?.terminal === handle
    && managed.dispatchId && value.dispatch === managed.dispatchId;
  if (!valid) throw Object.assign(new Error(`current Kernel incarnation unavailable for ${workflowId}`), { code: 'kernel-caller-stale' });
  const identity = { role: 'kernel', workflowId, generation: wf.generation, attempt: hierarchy.attempt,
    terminal: handle, dispatch: managed.dispatchId, token: signal.token };
  return { ...identity, digest: sha256(JSON.stringify(identity)) };
}
