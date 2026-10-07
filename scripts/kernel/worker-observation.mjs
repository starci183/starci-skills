function initialLiveness({ shown, connected, writable }, terminalGoneCodes) {
  if (!shown?.ok) return terminalGoneCodes.has(shown?.errorCode) ? 'gone' : 'unknown';
  if (!connected || !writable) return 'disconnected';
  return null;
}

function directScreenLiveness(screenState) {
  if (screenState === 'agent-exited') return 'agent-exited';
  if (screenState === 'staged-input') return 'staged-input';
  if (screenState === 'wedged') return 'wedged';
  return null;
}

function remainingScreenLiveness({ screenState, stale, beating, gateAnswer }) {
  if (stale.staleActive) return beating ? 'active' : 'turn-idle';
  if (screenState === 'active') return 'active';
  if (screenState === 'turn-idle') return 'turn-idle';
  if (screenState === 'interactive-gate') return gateAnswer?.loop ? 'gate-loop' : 'interactive-gate';
  if (screenState === 'failed') return 'failed';
  return null;
}

const livenessOf = (input, { terminalGoneCodes, activeUnclassifiedMs }) => {
  const initial = initialLiveness(input, terminalGoneCodes);
  if (initial !== null) return initial;
  const direct = directScreenLiveness(input.screenState);
  if (direct !== null) return direct;
  const remaining = remainingScreenLiveness(input);
  if (remaining !== null) return remaining;
  return input.outputAgeMs != null && input.outputAgeMs <= activeUnclassifiedMs ? 'active-unclassified' : 'live-idle';
};

function gateAnswerFor(ctx, workerGateAnswerOf) {
  return ctx.screenState === 'interactive-gate' && ctx.connected && ctx.writable
    ? workerGateAnswerOf(ctx.db, ctx.job, ctx.screenGate) : null;
}

function idleLivenessState(ctx, seen, quietAfterNudge, launchGraceOf) {
  const quiet = ctx.db && ['turn-idle', 'live-idle'].includes(seen) ? quietAfterNudge(ctx.db, ctx.job, { now: ctx.now, outputAgeMs: ctx.outputAgeMs }) : null;
  const starting = !quiet && ['turn-idle', 'live-idle'].includes(seen) ? launchGraceOf(ctx.db, ctx.job, { now: ctx.now }) : null;
  return { quiet, starting };
}

function staleReasonOf({ stale, connected, writable, beating }) {
  if (stale.staleActive && connected && writable) return beating ? 'heartbeat' : 'stale-active';
  return null;
}

function observationRecord(ctx, { gateAnswer, quiet, starting, liveness, staleReason }, { clipDraft, terminalNotWritable }) {
  const { job, now, terminalHandle, shown, connected, writable, lastOutputAt, outputAgeMs, screenState,
    shellPrompt, inputDraft, frame, screen, screenGate, heartbeatAgeMs, providerOutage, unwritable, refusedAt } = ctx;
  return { jobId: job.job_id, opId: job.op_id, ledgerStatus: job.status, terminalHandle, liveness, connected, writable, ...(quiet ? { quiet } : {}),
    terminalStatus: shown?.terminal?.status ?? null, lastOutputAt,
    outputAgeMs, screenState, ...(shellPrompt ? { shellPrompt } : {}), ...(inputDraft ? { inputDraft: clipDraft(inputDraft) } : {}),
    ...(frame ? { screen, draft: inputDraft } : {}),
    ...(screenGate ? { gate: screenGate } : {}), ...(gateAnswer ? { gateAutoAnswer: gateAnswer } : {}),
    ...(staleReason ? { livenessReason: staleReason } : {}),
    ...(heartbeatAgeMs != null ? { heartbeatAgeMs } : {}),
    ...(starting ? { livenessReason: 'launch-grace', launchGrace: starting } : {}),
    ...(providerOutage ? { providerOutage } : {}),
    ...(unwritable ? { livenessReason: 'terminal-incarnation-stale', sendRefusedAt: refusedAt } : {}),
    ...(shown?.errorCode || unwritable ? { errorCode: shown?.errorCode ?? terminalNotWritable } : {}), observedAt: now };
};

export const workerObservation = (ctx, { workerGateAnswerOf, terminalGoneCodes, activeUnclassifiedMs, quietAfterNudge, launchGraceOf, clipDraft, terminalNotWritable }) => {
  const { job, now, db, frame, terminalHandle, shown, connected, writable, lastOutputAt, outputAgeMs,
    screenState, shellPrompt, inputDraft, screen, screenGate, providerOutage, stale, beating,
    heartbeatAgeMs, unwritable, refusedAt } = ctx;
  // A host dialog the worker's card allowlists (a loop-detection menu) is the runtime's to
  // answer: starci kernel nudge picks it. Answered maxPerAttempt times on this attempt, it is a loop (gate-loop).
  const gateAnswer = gateAnswerFor({ screenState, connected, writable, db, job, screenGate }, workerGateAnswerOf);
  const seen = livenessOf({ shown, connected, writable, screenState, stale, beating, gateAnswer, outputAgeMs }, { terminalGoneCodes, activeUnclassifiedMs });
  const { quiet, starting } = idleLivenessState({ db, job, now, outputAgeMs }, seen, quietAfterNudge, launchGraceOf);
  // A managed worker still inside its launch grace reads `starting`, never nudge-ready (a staged
  // paste already counts as ready - the grace exists because worker-start returns before the Task
  // reaches the screen, not because the worker cannot already hold input).
  let liveness = seen;
  if (quiet) liveness = 'quiet';
  else if (starting) liveness = 'starting';
  const staleReason = staleReasonOf({ stale, connected, writable, beating });
  const recordContext = { job, now, terminalHandle, shown, connected, writable, lastOutputAt, outputAgeMs, screenState,
    shellPrompt, inputDraft, frame, screen, screenGate, heartbeatAgeMs, providerOutage, unwritable, refusedAt };
  return observationRecord(recordContext, { gateAnswer, quiet, starting, liveness, staleReason }, { clipDraft, terminalNotWritable });
};
