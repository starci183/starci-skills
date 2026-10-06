// A Worker's actual selected identity and uncertain launch stay on its original attempt and leases.
import { supervisorEvent } from '../machine/home.mjs';
import { closeSelfSafe } from '../machine/close-verify.mjs';
import { releaseSelfSafe, workerClosureProven } from '../machine/worker-close.mjs';
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

// Physical custody is qualified separately from logical release or job completion.
export const workerTerminalClosed = (job) => job.payload.dispatch
  ? job.payload.terminalClosed?.dispatch === job.payload.dispatch && job.payload.terminalClosed?.attemptId === job.attempt_id
    && workerClosureProven(job.payload.terminalClosed, job.worker_id)
  : job.payload.terminalClosed?.attemptId === job.attempt_id && job.payload.terminalClosed?.handle === job.worker_id && job.payload.terminalClosed?.ok === true
    && ['gone', 'disconnected'].includes(job.payload.terminalClosed?.proof);

// Existing Supervisor consumer; its public entry and job projection stay in workers.mjs.
export function closeWorkerTerminalState(m, { jobId, env = process.env, now = Date.now(), close = closeSelfSafe, release = releaseSelfSafe } = {}, jobOf) {
  const job = jobOf(m, jobId);
  const handle = job?.worker_id;
  if (!handle || handle === 'supervisor' || job.payload.self) return null;
  if (workerTerminalClosed(job)) return null;
  // A worker-start worker is fenced and released by its Dispatch (release archives its output); a job
  // recorded without a Dispatch has only its terminal to close.
  const dispatch = job.payload.dispatch ?? null;
  let r;
  try { r = dispatch ? release(dispatch, handle, { owner: `supervisor:${jobId}`, env }) : close(handle, { owner: `supervisor:${jobId}`, env }); }
  catch (error) { r = { handle, ok: false, error: String(error?.message ?? error) }; }
  const physical = dispatch ? r?.dispatch === dispatch && workerClosureProven(r, handle)
    : r?.handle === handle && r?.ok === true && ['gone', 'disconnected'].includes(r?.proof);
  let reason = r?.reason;
  if (!reason && !physical) reason = 'worker-closure-unproven';
  const record = { handle, attemptId: job.attempt_id ?? null, ...(dispatch ? { dispatch, released: r?.ok === true,
    closed: r?.closed ?? null, processes: r?.processes ?? null } : {}), ok: physical, proof: (dispatch ? r?.closed?.proof : r?.proof) ?? null,
    ...(r?.detached ? { detached: true } : {}), ...(r?.pending ? { pending: true } : {}),
    ...(reason ? { reason } : {}),
    ...(r?.error ? { error: String(r.error).slice(0, 200) } : {}), at: new Date(now).toISOString() };
  try {
    m.transaction(() => {
      const fresh = jobOf(m, jobId);
      if (!fresh || fresh.worker_id !== handle || fresh.attempt_id !== job.attempt_id || (fresh.payload.dispatch ?? null) !== dispatch) {
        record.ok = false;
        record.reason = 'worker-owner-changed';
      }
      if (record.ok) {
        setJob(m, jobId, { payload: { ...fresh.payload, terminalClosed: record } });
        if (fresh.attempt_id != null) m.updateSupAttempt(fresh.attempt_id, { closedAt: now });
      }
      supervisorEvent(m, { entityType: 'job', entityId: jobId, kind: record.ok ? 'worker-terminal-closed' : 'worker-terminal-unclosed', payload: record, now });
    });
  } catch { /* the close stands; the tick GC re-reads Orca */ }
  return record;
}
