// A Worker's actual selected identity and uncertain launch stay on its original attempt and leases.
import { supervisorEvent } from '../machine/home.mjs';
const ATTEMPT_AGENTS = new Set(['devin', 'codex', 'claude']);
export const workerAttemptAgent = (provider) => ATTEMPT_AGENTS.has(provider) ? provider : null;

/** Write a job's status and/or payload; the machine owns its status event. */
export function setJob(m, jobId, { status = null, payload = undefined }) {
  if (status) return m.setSupJobStatus(jobId, status, { payload });
  return m.update('sup_jobs', { payload_json: payload, updated_at: m.now() }, { job_id: jobId }).changes > 0;
}

export function recordWorkerLaunch({ m, job, route, spawned, staging, attemptId, guard, now }) {
  const selected = spawned?.admission?.selected;
  if (selected) { route.pool = selected.pool; route.agent = selected.provider; route.model = selected.model; }
  const payload = { ...job.payload, pool: route.pool, agent: route.agent, model: route.model, staging,
    admission: spawned?.admission ?? null,
    spawnAttempts: (job.payload.spawnAttempts ?? 0) + 1, guard: guard.receipt,
    ...(spawned?.dispatchId ? { dispatch: spawned.dispatchId } : {}), ...(spawned?.runId ? { runId: spawned.runId } : {}),
    ...(spawned?.taskId ? { taskId: spawned.taskId } : {}) };
  m.updateSupAttempt(attemptId, { agent: workerAttemptAgent(route.agent),
    provider: route.agent, model: route.model, effort: spawned?.admission?.selected?.effort ?? route.effort ?? null });
  const heldUnknown = !spawned?.ok && spawned?.effectState !== 'none';
  if (heldUnknown) {
    m.transaction(() => {
      m.updateSupAttempt(attemptId, { failureClass: 'spawn:effects-unknown', terminalHandle: spawned?.terminal ?? null });
      setJob(m, job.job_id, { status: 'spawning', payload: { ...payload, launchEffect: spawned?.effectState ?? 'unknown',
        lastSpawnError: spawned?.error ?? 'launch effect is unknown' } });
      supervisorEvent(m, { entityType: 'job', entityId: job.job_id, kind: 'worker-spawn-unknown',
        payload: { dispatch: spawned?.dispatchId ?? null, effectState: spawned?.effectState ?? 'unknown', admission: spawned?.admission ?? null }, now: now() });
    });
  }
  return { payload, heldUnknown };
}
