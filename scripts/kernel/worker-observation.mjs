const livenessOf = ({ shown, connected, writable, screenState, stale, beating, gateAnswer, outputAgeMs }, { terminalGoneCodes, activeUnclassifiedMs }) => {
  if (!shown?.ok) return terminalGoneCodes.has(shown?.errorCode) ? 'gone' : 'unknown';
  if (!connected || !writable) return 'disconnected';
  if (screenState === 'agent-exited') return 'agent-exited';
  if (screenState === 'staged-input') return 'staged-input';
  if (screenState === 'wedged') return 'wedged';
  if (stale.staleActive) return beating ? 'active' : 'turn-idle';
  if (screenState === 'active') return 'active';
  if (screenState === 'turn-idle') return 'turn-idle';
  if (screenState === 'interactive-gate') return gateAnswer?.loop ? 'gate-loop' : 'interactive-gate';
  if (screenState === 'failed') return 'failed';
  return outputAgeMs != null && outputAgeMs <= activeUnclassifiedMs ? 'active-unclassified' : 'live-idle';
};

export const workerObservation = (ctx, { workerGateAnswerOf, terminalGoneCodes, activeUnclassifiedMs, quietAfterNudge, launchGraceOf, clipDraft, terminalNotWritable }) => {
  const { job, now, db, frame, terminalHandle, shown, connected, writable, lastOutputAt, outputAgeMs,
    screenState, shellPrompt, inputDraft, screen, screenGate, providerOutage, stale, beating,
    heartbeatAgeMs, unwritable, refusedAt } = ctx;
  // A host dialog the worker's card allowlists (a loop-detection menu) is the runtime's to
  // answer: starci kernel nudge picks it. Answered maxPerAttempt times on this attempt, it is a loop (gate-loop).
  const gateAnswer = screenState === 'interactive-gate' && connected && writable ? workerGateAnswerOf(db, job, screenGate) : null;
  const seen = livenessOf({ shown, connected, writable, screenState, stale, beating, gateAnswer, outputAgeMs }, { terminalGoneCodes, activeUnclassifiedMs });
  const quiet = db && ['turn-idle', 'live-idle'].includes(seen) ? quietAfterNudge(db, job, { now, outputAgeMs }) : null;
  // A managed worker still inside its launch grace reads `starting`, never nudge-ready (a staged
  // paste already counts as ready - the grace exists because worker-start returns before the Task
  // reaches the screen, not because the worker cannot already hold input).
  const starting = !quiet && ['turn-idle', 'live-idle'].includes(seen) ? launchGraceOf(db, job, { now }) : null;
  let liveness = seen;
  if (quiet) liveness = 'quiet';
  else if (starting) liveness = 'starting';
  return { jobId: job.job_id, opId: job.op_id, ledgerStatus: job.status, terminalHandle, liveness, connected, writable, ...(quiet ? { quiet } : {}),
    terminalStatus: shown?.terminal?.status ?? null, lastOutputAt,
    outputAgeMs, screenState, ...(shellPrompt ? { shellPrompt } : {}), ...(inputDraft ? { inputDraft: clipDraft(inputDraft) } : {}),
    ...(frame ? { screen, draft: inputDraft } : {}),
    ...(screenGate ? { gate: screenGate } : {}), ...(gateAnswer ? { gateAutoAnswer: gateAnswer } : {}),
    ...(stale.staleActive && connected && writable ? { livenessReason: beating ? 'heartbeat' : 'stale-active' } : {}),
    ...(heartbeatAgeMs != null ? { heartbeatAgeMs } : {}),
    ...(starting ? { livenessReason: 'launch-grace', launchGrace: starting } : {}),
    ...(providerOutage ? { providerOutage } : {}),
    ...(unwritable ? { livenessReason: 'terminal-incarnation-stale', sendRefusedAt: refusedAt } : {}),
    ...(shown?.errorCode || unwritable ? { errorCode: shown?.errorCode ?? terminalNotWritable } : {}), observedAt: now };
};
