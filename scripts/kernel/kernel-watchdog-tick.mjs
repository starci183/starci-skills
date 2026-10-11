// One decision pass over the Kernel seat; the host owns the cadence.
import { contractReplacement } from '../machine/revision-replace.mjs';
import { draftSeatResult } from './draft-hold.mjs';
const noTerminalResult = ({ workflowId, phase, terminal, repair, lostSeatWorker, exitedTwice, stopAndRelease, replaceKernel }) => {
  if (terminal) return null;
  if (!repair) return { ok: true, workflowId, phase, action: 'restart-needed', reason: 'kernel signal/terminal absent' };
  const lost = lostSeatWorker();
  const fenced = lost && exitedTwice(lost.agentTerminalHandle) ? stopAndRelease(lost.dispatchId) : null;
  const replaced = replaceKernel({ workflowId, phase, ...(fenced ? { fenced, lostSeat: lost } : {}) });
  return { ...replaced, terminal: replaced.replacementTerminal ?? null };
};

const noDispatchResult = ({ workflowId, phase, terminal, signalValue, repair, replaceKernel }) => {
  if (signalValue.dispatch) return null;
  const deathReason = 'seat has no worker';
  if (!repair) return { ok: true, workflowId, phase, terminal, action: 'restart-needed', reason: deathReason };
  return replaceKernel({ workflowId, phase, terminal, deathReason });
};

const deadWorkerResult = ({ workflowId, phase, terminal, signalValue, workerShow, repair, DEAD_WORKER_STATE, replaceKernel, stopAndRelease }) => {
  const worker = workerShow({ dispatch: signalValue.dispatch });
  if (worker?.hostUnavailable) return { ok: true, workflowId, phase, terminal, action: 'host-unavailable', reason: worker.error ?? 'worker-show did not answer' };
  if (!worker?.ok || !worker.state || !DEAD_WORKER_STATE.test(worker.state)) return null;
  const deathReason = `kernel worker ${signalValue.dispatch} is ${worker.state}`;
  if (!repair) return { ok: true, workflowId, phase, terminal, action: 'restart-needed', reason: deathReason };
  return replaceKernel({ workflowId, phase, terminal, deathReason, fenced: stopAndRelease(signalValue.dispatch) });
};

const verdictResult = ({ workflowId, phase, terminal, signalValue, repair, settledKernelVerdict, DEAD_VERDICTS, replaceKernel, stopAndRelease }) => {
  const verdict = settledKernelVerdict(terminal, repair ? {} : { waitMs: 0, settleMs: 0 });
  if (verdict.verdict === 'host-unavailable') return { result: {
    ok: true, workflowId, phase, terminal, action: 'host-unavailable', reason: verdict.reason,
    ...(verdict.hostWait ? { hostWaitMs: verdict.hostWait.waitedMs } : {}),
  } };
  if (verdict.verdict === 'unverified') return { result: {
    ok: false, workflowId, phase, terminal, action: 'terminal-unverified',
    reason: `${verdict.reason}; an unproven death never replaces a kernel`,
  } };
  if (DEAD_VERDICTS.has(verdict.verdict)) {
    if (!repair) return { result: { ok: true, workflowId, phase, terminal, action: 'restart-needed', reason: verdict.reason } };
    return { result: replaceKernel({ workflowId, phase, terminal, deathReason: verdict.reason, fenced: stopAndRelease(signalValue.dispatch) }) };
  }
  return { shown: verdict.shown };
};

const shellPromptResult = ({ workflowId, phase, terminal, dispatch, read, repair, exitedAgentPromptRow, DEATH_SETTLE_MS, sleepSync, terminalRead, replaceKernel, stopAndRelease }) => {
  const shellPrompt = exitedAgentPromptRow(read.screen);
  if (!shellPrompt) return null;
  const deathReason = `agent exited: the kernel terminal is back at the shell prompt '${shellPrompt}'`;
  if (!repair) return { ok: true, workflowId, phase, terminal, action: 'restart-needed', state: 'agent-exited', shellPrompt, reason: deathReason };
  if (DEATH_SETTLE_MS > 0) sleepSync(DEATH_SETTLE_MS);
  const again = terminalRead({ terminal, screen: true });
  if (!again.ok || !exitedAgentPromptRow(again.screen)) return {
    ok: true, workflowId, phase, terminal, action: 'agent-exit-unconfirmed', state: 'agent-exited', shellPrompt,
    reason: again.ok ? 'the second read no longer ends in a shell prompt' : `the second read failed: ${again.error ?? 'unreadable'}`,
  };
  return replaceKernel({ workflowId, phase, terminal, state: 'agent-exited', shellPrompt, deathReason, fenced: stopAndRelease(dispatch) });
};

const queuedInputResult = (ctx) => {
  const { classified, repair, workflowId, phase, terminal, outputAgeMs, lastOutputAt, kernelWakeFailures,
    wakeFailuresProveDead, replaceWakeDeadKernel, dispatch, sendEnterWithProof, recordKernelWakeFailed, deliveryFieldsOf } = ctx;
  if (classified.state !== 'queued-input' && classified.state !== 'staged-input') return null;
  if (!repair) return { ok: true, workflowId, phase, terminal, action: classified.state, outputAgeMs };
  const earlier = wakeFailuresProveDead(kernelWakeFailures(terminal), { lastOutputAt });
  if (earlier.dead) return replaceWakeDeadKernel({ phase, terminal, dispatch, stale: ctx.stale, outputAgeMs, ...earlier });
  const proof = sendEnterWithProof({ terminal });
  if (!proof.ok) recordKernelWakeFailed(terminal, { state: classified.state, sendErrorCode: proof.sendErrorCode ?? null });
  const action = proof.ok ? `${classified.state}-sent` : 'wake-failed';
  return { ok: proof.ok, workflowId, phase, terminal, action, outputAgeMs,
    ...deliveryFieldsOf(proof), error: proof.ok ? null : (proof.sent?.error || proof.sendErrorCode || null) };
};

/** The tick result of one wake send: its proof, the action it implies and the delivery fields. */
const wakeResultOf = ({ proof, workflowId, phase, terminal, stale, outputAgeMs, wakeActionOf, deliveryFieldsOf }) => ({
  ok: proof.ok, workflowId, phase, terminal,
  action: wakeActionOf(proof), ...stale, outputAgeMs, ...deliveryFieldsOf(proof),
  ...(proof.shellPrompt ? { shellPrompt: proof.shellPrompt } : {}),
  receipt: proof.sent?.receipt ?? null, error: proof.ok ? null : (proof.sent?.error || proof.sendErrorCode || null),
});

/** The proven liveness wake of an idle Kernel and its tick answer (a refused send on a stale frame replaces the seat). */
const sendIdleWake = (ctx, idle) => {
  const withheld = ctx.repeatedWake?.(ctx.status.value);
  if (withheld) return { ok: true, workflowId: ctx.workflowId, phase: ctx.phase, terminal: ctx.terminal, action: 'wake-withheld', reason: withheld.reason, since: withheld.since, outputAgeMs: ctx.outputAgeMs };
  const { status, workflowId, phase, terminal, stale, outputAgeMs, liveness, dispatch, replaceUnwritableKernel, sendWakeWithProof, wakePromptOf, read,
    recordKernelWakeFailed, recordKernelWoken, wakeSendRefused, wakeActionOf, deliveryFieldsOf, classified } = ctx;
  const proof = sendWakeWithProof({ terminal, text: wakePromptOf(workflowId, status.value), before: String(read.screen ?? '') });
  if (ctx.draftRefused(proof)) ctx.recordDraftHeld(terminal, proof);
  else if (!proof.ok && proof.delivery !== 'agent-exited') recordKernelWakeFailed(terminal, { state: classified.state, sendErrorCode: proof.sendErrorCode ?? null, delivery: proof.delivery ?? null });
  if (proof.ok) recordKernelWoken(terminal, { delivery: proof.delivery ?? null, idleWakes: idle.wakes + 1, ...ctx.menuOf?.(status.value) });
  if (proof.ok && status.value?.revisionNotice?.state === 'owed') ctx.recordRevisionWoken(status.value.revisionNotice);
  if (!proof.ok && liveness.staleActive && wakeSendRefused(proof))
    return replaceUnwritableKernel({ phase, terminal, dispatch, stale, outputAgeMs, proof });
  return wakeResultOf({ proof, workflowId, phase, terminal, stale, outputAgeMs, wakeActionOf, deliveryFieldsOf });
};

const idleTurnResult = (ctx) => {
  const { classified, status, repair, workflowId, phase, terminal, stale, outputAgeMs, liveness, lastOutputAt,
    dispatch, kernelWakeRefusedAt, replaceUnwritableKernel, kernelWakeFailures, wakeFailuresProveDead, replaceWakeDeadKernel,
    kernelIdleWakes, escalateIdleStall, replaceIdleKernel, kernelRotation } = ctx;
  if (classified.state !== 'turn-idle') return null;
  const owes = ['owed', 'replace-due'].includes(status.value?.revisionNotice?.state);
  if (status.value?.frontier?.actionable === false && !owes) return { ok: true, workflowId, phase, terminal, action: 'idle-waiting', ...stale, reason: status.value?.frontier?.reason ?? 'frontier not actionable', outputAgeMs };
  if (!repair) return { ok: true, workflowId, phase, terminal, action: 'wake-needed', ...stale, outputAgeMs };
  // A person's draft wins: no replacement, rotation or clearing while one stands (draft-hold.mjs); the wake is tried again and refused again.
  if (ctx.draftHeld() || ctx.foreignDraft(ctx.read.draft)) return sendIdleWake(ctx, kernelIdleWakes());
  const refusedAt = liveness.staleActive ? kernelWakeRefusedAt(terminal) : null;
  if (refusedAt != null && refusedAt > (lastOutputAt ?? 0))
    return replaceUnwritableKernel({ phase, terminal, dispatch, stale, outputAgeMs, refusedAt });
  const earlier = wakeFailuresProveDead(kernelWakeFailures(terminal), { lastOutputAt });
  if (earlier.dead) return replaceWakeDeadKernel({ phase, terminal, dispatch, stale, outputAgeMs, ...earlier });
  const idle = kernelIdleWakes();
  if (idle.due) return idle.replaced ? escalateIdleStall({ phase, terminal, idle, outputAgeMs }) : replaceIdleKernel({ phase, terminal, dispatch, stale, outputAgeMs, idle });
  const rotation = kernelRotation.due();
  if (rotation.due) return kernelRotation.rotate({ phase, terminal, dispatch, stale, outputAgeMs, rotation });
  const contract = contractReplacement(status.value?.revisionNotice);
  if (contract) return kernelRotation.rotate({ phase, terminal, dispatch, stale, outputAgeMs, rotation: contract });
  return sendIdleWake(ctx, idle);
};

export function createKernelTick(deps) {
  return function kernelTick(status, phase) {
    const survey = deps.api('survey');
    if (!survey.ok || !survey.value?.ok) return {
      ok: false, workflowId: deps.workflowId, phase, action: 'survey-failed',
      error: survey.error ?? survey.value?.reason ?? survey.stderr ?? survey.stdout,
    };
    const kernelSignal = (survey.value.signals ?? []).find(signal => signal.scope === 'kernel' && signal.key === deps.workflowId);
    const signalValue = kernelSignal?.value ?? deps.jsonFromStdout(kernelSignal?.value_json) ?? {};
    const terminal = signalValue.terminal ?? null;
    const seatContext = { ...deps, workflowId: deps.workflowId, phase, terminal, signalValue, status, repair: deps.repair };
    const noSeat = noTerminalResult(seatContext);
    if (noSeat) return noSeat;
    const heldDraft = draftSeatResult(seatContext);
    if (heldDraft) return heldDraft;
    const noDispatch = noDispatchResult(seatContext);
    if (noDispatch) return noDispatch;
    const deadWorker = deadWorkerResult(seatContext);
    if (deadWorker) return deadWorker;
    const verdict = verdictResult(seatContext);
    if (verdict.result) return verdict.result;
    const read = deps.terminalRead({ terminal, screen: true });
    if (!read.ok) return { ok: false, workflowId: deps.workflowId, phase, terminal, action: 'terminal-unreadable', error: read.error };
    deps.observeRevision?.(status);
    const shared = { ...deps, workflowId: deps.workflowId, phase, terminal, dispatch: signalValue.dispatch, read, status };
    const shellPrompt = shellPromptResult(shared);
    if (shellPrompt) return shellPrompt;
    const screen = deps.classifyKernelScreen(read.screen);
    const { lastOutputAt, outputAgeMs } = deps.outputAgeOf(verdict.shown.terminal?.lastOutputAt);
    const liveness = deps.staleAwareState(screen.state, outputAgeMs, deps.ACTIVE_STALE_MS);
    const classified = liveness.staleActive ? { ...screen, state: liveness.state } : screen;
    const stale = liveness.staleActive ? { screenState: screen.state, reason: 'stale-active', livenessReason: 'stale-active', activeStaleMs: deps.ACTIVE_STALE_MS } : {};
    const context = { ...shared, classified, outputAgeMs, lastOutputAt, liveness, stale };
    const queued = queuedInputResult(context);
    if (queued) return queued;
    const idle = idleTurnResult(context);
    if (idle) return idle;
    if (classified.state === 'failed') return {
      ok: false, workflowId: deps.workflowId, phase, terminal, action: 'kernel-failed-screen', outputAgeMs,
      reason: 'terminal shows an authentication/process failure; exact terminal must be reconciled before replacement',
    };
    if (classified.state === 'interactive-gate') return {
      ok: false, workflowId: deps.workflowId, phase, terminal, action: 'interactive-gate', gate: classified.gate ?? null, outputAgeMs,
      reason: `kernel terminal is waiting on an interactive gate (${classified.gate ?? 'unnamed'}); nothing is typed into it`,
    };
    return { ok: true, workflowId: deps.workflowId, phase, terminal, action: deps.finalKernelAction(classified.state), state: classified.state, outputAgeMs };
  };
}
