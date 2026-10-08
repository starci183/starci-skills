// spawn-reconcile.mjs — reconciles the original Dispatch of a job whose worker start answered uncertainly: the worker is dead
// (its job fails), shows its prompt submitted (the job runs), or stays held for the next pass. Uncertain effects never authorize another worker.
import { supervisorEvent } from '../machine/home.mjs';
import { setJob } from './worker-state.mjs';
import { bindGuardTerminal } from '../guards/hook-install.mjs';
import { workerShow } from '../api/orca/worker-show.mjs';
import { terminalShow } from '../api/orca/terminal-show.mjs';
import { terminalRead } from '../api/orca/terminal-read.mjs';
import { draftText } from '../lib/orca-terminal.mjs';
import { classifyAgentScreen, exitedAgentPromptRow, frameWithDraft, wakeDeliveryOf } from '../lib/terminal-liveness.mjs';
import { sendEnterWithProof } from '../kernel/wake-delivery.mjs';
import { allocationMs } from '../../engine/config.mjs';
import { hostIncarnation } from '../machine/provider-reservation-restart.mjs';

/** A dead original Dispatch ends its job as failed (not requeued): the worker exited before its Task landed. */
function failDeadSpawn(pass, job, { terminal, reason }) {
  const { m, now, result } = pass;
  m.transaction(() => {
    m.releaseSupLeases(job.job_id);
    m.updateSupAttempt(job.attempt_id, { cancelledAt: now(), failureClass: 'spawn:worker-exited' });
    setJob(m, job.job_id, { status: 'failed', payload: { ...job.payload, launchEffect: 'dead', result: { reason } } });
    supervisorEvent(m, { entityType: 'job', entityId: job.job_id, kind: 'worker-spawn-failed', payload: { terminal, reason }, now: now() });
  });
  result.failed.push({ jobId: job.job_id, terminal, error: reason, requeued: false });
}

/** Whether the original worker's frame shows its prompt submitted; a staged Codex paste gets one proven Enter. */
function spawnSubmitted({ job, shown, frame, terminal, deps, renderPrompt }) {
  const prompt = renderPrompt(job, job.payload.staging), draft = draftText(frame);
  const screen = draft ? frameWithDraft(frame.screen, draft) : frame.screen;
  const state = classifyAgentScreen(screen, { sentText: prompt, provider: job.payload.agent }).state;
  if (state === 'staged-input' || state === 'queued-input') {
    return job.payload.agent === 'codex' && shown.writable === true && sendEnterWithProof({ terminal, sentText: prompt, deps }).ok;
  }
  return state === 'active' || wakeDeliveryOf({ after: screen, text: prompt }).delivery === 'delivered';
}

// A host restart after the launch began ended it: the Dispatch is gone from a running Orca (or was never recorded) and the incarnation that started it is over.
const dispatchGone = (job, worker) => !job.payload.dispatch || String(worker?.error ?? '').startsWith('dispatch_not_found');
function endedByRestart(pass, job) {
  const spawnedAt = Number(pass.m.latestSupAttempt(job.job_id)?.spawned_at);
  const incarnation = hostIncarnation(pass.deps.host ?? {});
  return incarnation.ok && Number.isFinite(spawnedAt) && incarnation.startedAt - allocationMs('providerReservation.restartToleranceMs') > spawnedAt;
}

/** Reconcile the original Dispatch only: uncertain effects never authorize another worker. */
export function reconcileSpawning(pass, job, { markRunning, renderPrompt }) {
  const { m, deps, root } = pass;
  try {
    const worker = job.payload.dispatch ? (deps.workerShow ?? workerShow)({ dispatch: job.payload.dispatch }) : null;
    if (dispatchGone(job, worker) && endedByRestart(pass, job)) {
      failDeadSpawn(pass, job, { terminal: job.worker_id ?? null, reason: 'host-restarted' });
      return true;
    }
    if (!worker?.ok) return false;
    const terminal = worker.dispatch?.assigneeHandle ?? worker.result?.worker?.agentTerminalHandle ?? job.worker_id;
    if (!terminal || (job.worker_id && job.worker_id !== terminal)) return false;
    m.updateSupAttempt(job.attempt_id, { terminalHandle: terminal });
    const shown = (deps.show ?? terminalShow)({ terminal });
    if (shown?.hostUnavailable) return false;
    const frame = shown?.ok && shown.connected === true ? (deps.read ?? terminalRead)({ terminal, screen: true }) : null;
    const dead = (shown?.ok && shown.connected === false) || shown?.errorCode === 'terminal_handle_stale'
      || (frame?.ok && exitedAgentPromptRow(frame.screen));
    if (dead) {
      failDeadSpawn(pass, job, { terminal, reason: shown?.exitCause ?? shown?.errorCode ?? 'agent-exited' });
      return true;
    }
    const effective = worker.effective;
    if (!shown?.ok || !frame?.ok || (effective?.agent ?? effective?.provider) !== job.payload.agent
      || (effective?.model ?? effective?.modelId) !== job.payload.model) return false;
    if (!spawnSubmitted({ job, shown, frame, terminal, deps, renderPrompt })) return false;
    if (typeof job.payload.guard?.jobFile === 'string') (deps.bindGuard ?? bindGuardTerminal)({ skillRoot: root, handle: terminal, jobFile: job.payload.guard.jobFile });
    m.updateSupAttempt(job.attempt_id, { failureClass: null });
    markRunning(pass, { job, route: { agent: job.payload.agent, model: job.payload.model, pool: job.payload.pool },
      staging: job.payload.staging, leased: { attemptId: job.attempt_id }, spawned: { terminal, dispatchId: job.payload.dispatch },
      payload: { ...job.payload, launchEffect: 'submitted', lastSpawnError: null } });
    return true;
  } catch { return false; } // Host/read failures retain custody for the next pass.
}
