// starci kernel nudge: recover a running worker at its exact terminal without widening authority.
import { createHash } from 'node:crypto';
import { jobPayloadOf, jobRowOf } from './shared/rows.mjs';
import { sendEnterWithProof, sendWakeWithProof, deliveryFieldsOf } from '../wake-delivery.mjs';
import { answerAllowlistedGate } from '../../agent/lib.mjs';
import { probeDraft } from '../clear-draft.mjs';
import { draftOwnership } from '../../lib/terminal-liveness.mjs';
import { VerbExit } from './shared/verb-exit.mjs';

export default {
  verb: 'nudge',
  required: ['job'],
  kernelOnly: true,
  usageInCore: true,
  run({ ledger, args, emit, internals }) {
    const { observeOperationWorker, LAUNCH_GRACE_MS, stagedInputEvidenceOf, workerCardOf,
      GATE_ANSWERED_EVENT, runningOpRevDriftOf, workerInputRowText, INPUT_ROW_PLACEHOLDER,
      runtimeOwnedInput, TERMINAL_NOT_WRITABLE, UNWRITABLE_EVENT } = internals;
    const deadWorkerRecovery = (jobId) => `run starci kernel reconcile --job ${jobId} --dead-worker --settle-failed`;
    // What sat in a worker's input box could be anything a human pasted, so a ledger event never carries
    // a foreign draft verbatim: the labelled digest proves WHICH text it was without quoting it (M10).
    // The operator-facing refusal keeps the bounded slice.
    const draftRef = (text) => text == null ? null : `draft, ${String(text).length} chars, sha256:${createHash('sha256').update(String(text)).digest('hex').slice(0, 12)}`;
    // The delivery fields as an event payload: draft text digested, everything else verbatim.
    const deliveredForEvent = (delivered) => ({ ...delivered,
      ...(delivered.draft != null ? { draft: draftRef(delivered.draft) } : {}),
      ...(delivered.staleDraft != null ? { staleDraft: draftRef(delivered.staleDraft) } : {}) });
    // A send Orca refused terminal_not_writable is recorded (UNWRITABLE_EVENT): liveness reads it next.
    const recordSendRefused = (ledger, job, { dispatchId, worker, proof }) => {
      const refused = [proof.sendErrorCode, proof.sent?.errorCode, proof.sent?.error].some((value) => String(value ?? '').includes(TERMINAL_NOT_WRITABLE));
      if (refused) ledger.transaction(() => ledger.appendEvent({ workflowId: job.workflow_id, entityType: 'job', entityId: job.job_id, kind: UNWRITABLE_EVENT,
        payload: { opId: job.op_id, attempt: job.attempt, dispatchId, terminal: worker.terminalHandle, priorLiveness: worker.liveness, errorCode: TERMINAL_NOT_WRITABLE } }));
      return refused;
    };
    const refusedNote = (jobId) => `; Orca refused the write: the worker reads disconnected until it prints or heartbeats again, and starci kernel reconcile --job ${jobId} --dead-worker --settle-failed recovers it`;

  const db = ledger.db, jobId = args.job;
  const job = jobRowOf(db, jobId);
  if (!job) throw Object.assign(new Error(`unknown job ${jobId}`), { code: 'job-unknown' });
  if (job.kind !== 'op') throw Object.assign(new Error(`job ${jobId} is not an operation`), { code: 'job-not-operation' });
  if (job.status !== 'running') throw Object.assign(new Error(`job ${jobId} is ${job.status}; nudge requires running`), { code: 'job-not-running' });
  const payload = jobPayloadOf(job);
  const dispatchId = payload.managed?.dispatchId ?? payload.orca?.dispatchId ?? payload.hierarchy?.runtime?.dispatchId ?? job.worker_id;
  const report = dispatchId
    ? db.prepare('SELECT outcome,consumed_at FROM reports WHERE workflow_id=? AND dispatch_id=?').get(job.workflow_id, dispatchId)
    : null;
  if (report) {
    const out = { ok: true, jobId, nudged: false, reason: 'report-filed', report };
    emit(out, `nudge skipped for ${jobId}: report already filed (${report.outcome})`, args.json);
    return;
  }
  const worker = observeOperationWorker(job, Date.now(), db, { frame: true });
  const refuseNudge = (out, text) => { emit(out, text, args.json); throw new VerbExit(1); };
  const refuseUnavailable = () => refuseNudge({ ok: false, jobId, nudged: false, reason: 'worker-unavailable', worker },
    `nudge REFUSED for ${jobId}: worker-unavailable — exact terminal is disconnected/unwritable`);
  // The agent exited and left a bare shell: a wake would run as a shell command.
  // Nothing is typed; status reads it worker-dead and reconcile --dead-worker recovers it.
  const refuseAgentExited = () => refuseNudge({ ok: false, jobId, nudged: false, reason: 'agent-exited', delivery: 'agent-exited', worker },
    `nudge REFUSED for ${jobId}: agent-exited — the worker's agent exited (its terminal shows the shell prompt '${worker.shellPrompt}'); nothing was typed - ${deadWorkerRecovery(jobId)}`);
  // Quiet past its provider's timeout after a delivered nudge: a second wake changes nothing.
  const refuseQuiet = () => refuseNudge({ ok: false, jobId, nudged: false, reason: 'worker-quiet', worker },
    `nudge REFUSED for ${jobId}: worker-quiet — the worker printed nothing for ${Math.round((worker.quiet?.outputAgeMs ?? 0) / 60000)} min after its last nudge - ${deadWorkerRecovery(jobId)}`);
  // A wedged worker's turn can never file its report, but it is not nudgeable either: a wake lands
  // behind a turn that never ends. Its recovery is the dead-worker settle-failed route, which quits
  // the agent first (inc-2c1ac4ff3e48). Nothing is typed.
  const refuseWedged = () => refuseNudge({ ok: false, jobId, nudged: false, reason: 'worker-wedged', worker },
    `nudge REFUSED for ${jobId}: worker-wedged — the worker's turn ran past the wedge threshold on one command with no output; a wake would land behind a turn that never ends - ${deadWorkerRecovery(jobId)}`);
  const skipActive = () => emit({ ok: true, jobId, nudged: false, reason: 'worker-active', worker },
    `nudge skipped for ${jobId}: exact worker is active`, args.json);
  // A managed worker inside its launch grace is still starting: worker-start returned before Orca
  // injected the Task, and a wake would land in front of it. Nothing is typed.
  const skipStarting = () => emit({ ok: true, jobId, nudged: false, reason: 'worker-starting', worker },
    `nudge skipped for ${jobId}: the managed worker's dispatch is ${Math.round((worker.launchGrace?.ageMs ?? 0) / 1000)}s old (launch grace ${Math.round((worker.launchGrace?.graceMs ?? LAUNCH_GRACE_MS) / 1000)}s); its first turn is still starting`, args.json);
  // A staged, unsubmitted paste (the dispatch contract still in the input
  // row) is not started work and not an idle prompt: typing a wake on top of
  // it would bury it. One Enter-only send submits exactly what is there
  // (inc-06aeecf432f1; the dispatch-time twin is scripts/agent/lib.mjs
  // awaitSubmission).
  // A stalled/blocked receipt is not a failure when the next frame no longer
  // reads staged-input (scripts/kernel/wake-delivery.mjs).
  const submitStaged = (stagedEvidence) => {
    const proof = sendEnterWithProof({ terminal: worker.terminalHandle, ...stagedEvidence });
    const sent = proof.sent ?? {};
    if (!proof.ok) {
      const refused = recordSendRefused(ledger, job, { dispatchId, worker, proof });
      const out = { ok: false, jobId, nudged: false, reason: 'terminal-send-failed', delivery: 'failed', evidence: proof.evidence, sendErrorCode: proof.sendErrorCode, worker, error: sent.error, ...(refused ? { sendRefused: true } : {}) };
      emit(out, `nudge FAILED for ${jobId}: ${sent.error || proof.sendErrorCode || 'terminal send failed'}; the screen still shows the staged input${refused ? refusedNote(jobId) : ''}`, args.json);
      throw new VerbExit(1);
    }
    ledger.transaction(() => ledger.appendEvent({
      workflowId: job.workflow_id, entityType: 'job', entityId: jobId,
      kind: 'op-worker-nudged', payload: { opId: job.op_id, attempt: job.attempt, dispatchId, terminal: worker.terminalHandle, priorLiveness: worker.liveness, action: 'submit-staged-input', delivery: proof.delivery, evidence: proof.evidence, ...(proof.sendErrorCode ? { sendErrorCode: proof.sendErrorCode } : {}) },
    }));
    const out = { ok: true, jobId, nudged: true, action: 'submit-staged-input', delivery: proof.delivery, evidence: proof.evidence, ...(proof.sendErrorCode ? { sendErrorCode: proof.sendErrorCode } : {}), worker, receipt: sent.receipt ?? null };
    emit(out, `nudged ${jobId}: submitted the staged input on exact worker ${worker.terminalHandle} with one Enter`, args.json);
  };
  // A host dialog the worker's card allowlists is answered, never typed over: the card's option is picked
  // (arrow keys, Enter) and the answer recorded, so a repeat on this attempt reads gate-loop.
  const answerGate = () => {
    const { card } = workerCardOf(job);
    const answer = answerAllowlistedGate(worker.terminalHandle, card, worker.gateAutoAnswer.gate);
    const answers = worker.gateAutoAnswer.answers + (answer.answered ? 1 : 0);
    const gatePayload = { opId: job.op_id, attempt: job.attempt, dispatchId, terminal: worker.terminalHandle, gate: answer.gate, select: answer.select,
      answered: answer.answered, cleared: answer.cleared, keystroke: answer.keystroke, answers, limit: worker.gateAutoAnswer.limit,
      ...(answer.reason ? { reason: answer.reason } : {}) };
    if (answer.answered) ledger.transaction(() => ledger.appendEvent({ workflowId: job.workflow_id, entityType: 'job', entityId: jobId, kind: GATE_ANSWERED_EVENT, payload: gatePayload }));
    const out = { ok: answer.answered, jobId, nudged: answer.answered, action: 'answer-gate', ...gatePayload, worker };
    const clearedNote = answer.cleared ? '' : '; the dialog is still on screen';
    const text = answer.answered
      ? `nudged ${jobId}: answered host dialog '${answer.gate}' on exact worker ${worker.terminalHandle} with '${answer.select}' (${answer.keystroke}; answer ${answers} of ${worker.gateAutoAnswer.limit} on attempt ${job.attempt})${clearedNote}`
      : `nudge FAILED for ${jobId}: host dialog '${answer.gate}' could not be answered (${answer.reason ?? 'no answer'}); nothing was recorded`;
    emit(out, text, args.json);
    if (!answer.answered) throw new VerbExit(1);
  };
  // The same host dialog came back after the runtime answered it maxPerAttempt times on this attempt: the
  // worker is looping, and another answer is an endless continue. Nothing is typed; the attempt recovers
  // like a wedged one and its retry is routed again (a repeat there reads as a retry-loop finding).
  const refuseGateLoop = () => {
    const already = db.prepare("SELECT 1 FROM events WHERE entity_id=? AND kind='op-worker-gate-loop' AND json_extract(payload_json,'$.attempt')=?").get(jobId, job.attempt);
    if (!already) ledger.transaction(() => ledger.appendEvent({ workflowId: job.workflow_id, entityType: 'job', entityId: jobId, kind: 'op-worker-gate-loop',
      payload: { opId: job.op_id, attempt: job.attempt, dispatchId, terminal: worker.terminalHandle, gate: worker.gateAutoAnswer?.gate ?? worker.gate ?? null,
        answers: worker.gateAutoAnswer?.answers ?? null, limit: worker.gateAutoAnswer?.limit ?? null } }));
    refuseNudge({ ok: false, jobId, nudged: false, reason: 'worker-gate-loop', worker },
      `nudge REFUSED for ${jobId}: worker-gate-loop — host dialog '${worker.gateAutoAnswer?.gate ?? worker.gate}' is back after ${worker.gateAutoAnswer?.answers ?? '?'} answers on attempt ${job.attempt}; another answer is an endless continue - ${deadWorkerRecovery(jobId)} (Esc closes the dialog before the agent is quit); a repeat on the retry reads as a retry-loop finding`);
  };
  const refuseTypedGate = () => refuseNudge({ ok: false, jobId, nudged: false, reason: worker.liveness, worker },
    `nudge REFUSED for ${jobId}: ${worker.liveness} — ${worker.liveness === 'interactive-gate' ? "permission/trust input the worker's card does not allowlist" : 'an agent process/authentication failure'} is a typed environment problem, not a wake; nothing was typed`);
  const refuseUnknown = () => refuseNudge({ ok: false, jobId, nudged: false, reason: 'worker-state-unknown', worker },
    `nudge REFUSED for ${jobId}: worker-state-unknown — liveness ${worker.liveness} is neither turn-idle nor live-idle; weak observation never authorizes input`);
  // Returns false once an early liveness state was already answered (emitted, or refused by a thrown VerbExit).
  const earlyGate = () => {
    if (!worker.terminalHandle || !worker.connected || !worker.writable) refuseUnavailable();
    if (worker.liveness === 'agent-exited') refuseAgentExited();
    if (worker.liveness === 'quiet') refuseQuiet();
    if (worker.liveness === 'wedged') refuseWedged();
    if (worker.liveness === 'active' || worker.liveness === 'active-unclassified') { skipActive(); return false; }
    if (worker.liveness === 'starting') { skipStarting(); return false; }
    return true;
  };
  // Answers a staged paste, a gate answer, a gate loop, a typed gate and a weak observation; 'send' says the
  // worker is turn-idle/live-idle and the wake may be typed.
  const midGate = (stagedEvidence) => {
    if (worker.liveness === 'staged-input') { submitStaged(stagedEvidence); return 'handled'; }
    if (worker.liveness === 'interactive-gate' && worker.gateAutoAnswer && !worker.gateAutoAnswer.loop) { answerGate(); return 'handled'; }
    if (worker.liveness === 'gate-loop') refuseGateLoop();
    if (worker.liveness === 'interactive-gate' || worker.liveness === 'failed') refuseTypedGate();
    if (!['turn-idle', 'live-idle'].includes(worker.liveness)) refuseUnknown();
    return 'send';
  };
  // op-rev-drift while running: the worker hears that its op contract moved and that it is judged by its admission.
  const driftNotice = () => {
    try {
      const drift = runningOpRevDriftOf(db, job.workflow_id).find((w) => w.jobId === jobId);
      if (!drift) return [];
      const more = drift.files.length > 4 ? ', ...' : '';
      const advisory = drift.advisoryChanges.length ? ` - findings of ${drift.advisoryChanges.slice(0, 6).join(', ')} are advisory for you, do not loop on them` : '';
      return [`Notice: this op's contract changed on the runtime since your dispatch (${drift.files.slice(0, 4).join(', ')}${more}); you are judged by the contract you were admitted under${advisory}.`];
    } catch { return []; }
  };
  // A wake is typed into whatever the input row already holds. Text that is neither the provider's
  // painted placeholder nor the runtime's own (a staged paste marker, the dispatched contract, or
  // this same wake left staged) is foreign input: appending the wake would submit words this job
  // never wrote - the Supervisor's ruling on inc-f1d014518dc3, where 'continue to cut 6' sat in a
  // worker's input row at its session-turn limit. Nothing is typed.
  // The frame the observation already read: the foreign-input check judges the same screen and
  // draft the liveness classification did, not a second read that could have moved on (L-6).
  // Orca lifts the input box's text out of the frame and answers it as `draft`: text left there that
  // the runtime did not type is foreign input exactly as a visible input row is (a collab Kernel,
  // 2026-09-25: a hidden draft took every later send as its tail). The runtime's own - this wake or
  // the contract left staged, or runtime wakes piled up - goes on to the proven wake, which submits
  // or clears it (scripts/kernel/wake-delivery.mjs).
  // Orca's draft can be stale on its side (sn-foundation term_da5f72b3, 2026-09-25: 'check status' no
  // key cleared while the box was empty): foreign text gets one Ctrl+U probe (clear-draft.mjs
  // probeDraft). Text that changed is real - the deleted part is typed back and the nudge refuses;
  // text the Ctrl+U left unchanged is stale - noted draft-stale, never refused, and the wake is typed.
  const foreignDraftGate = (prompt, stagedEvidence) => {
    const draftOwner = worker.draft ? draftOwnership(worker.draft, { texts: [prompt, stagedEvidence.sentText], stagedPattern: stagedEvidence.stagedPattern }) : null;
    const staleDrafts = [];
    if (draftOwner?.kind === 'foreign') {
      const probe = probeDraft({ terminal: worker.terminalHandle });
      if (probe.verdict === 'stale') staleDrafts.push(probe.draft);
      else if (probe.verdict !== 'none') {
        const draftProbe = { verdict: probe.verdict, sends: probe.sends };
        if (probe.verdict === 'real') {
          draftProbe.restored = probe.restored;
          if (!probe.restored) draftProbe.removed = probe.removed;
        }
        const out = { ok: false, jobId, nudged: false, reason: 'foreign-input', input: draftOwner.draft.slice(0, 200), inputSource: 'draft', draftProbe, worker };
        const shown = draftOwner.draft.length > 80 ? `${draftOwner.draft.slice(0, 80)}…` : draftOwner.draft;
        const probeNote = probe.verdict === 'real' ? `changed it - real text${probe.restored ? ', its cut typed back' : ', NOT restored'}` : 'left it unreadable';
        emit(out, `nudge REFUSED for ${jobId}: foreign-input — the input box draft Orca reports holds '${shown}' that is neither a staged paste nor the runtime's own delivered text; the wake was not typed (a Ctrl+U probe ${probeNote}), no event is appended`, args.json);
        throw new VerbExit(1);
      }
    }
    return staleDrafts;
  };
  const inputRowGate = (prompt, stagedEvidence) => {
    const nudgeFrame = typeof worker.screen === 'string' ? worker.screen : null;
    const inputText = nudgeFrame == null ? null : workerInputRowText(nudgeFrame);
    if (inputText && !INPUT_ROW_PLACEHOLDER.test(inputText) && !runtimeOwnedInput(inputText, stagedEvidence, prompt)) {
      const out = { ok: false, jobId, nudged: false, reason: 'foreign-input', input: inputText.slice(0, 200), worker };
      const shown = inputText.length > 80 ? `${inputText.slice(0, 80)}…` : inputText;
      emit(out, `nudge REFUSED for ${jobId}: foreign-input — the input row holds '${shown}' that is neither a staged paste nor the runtime's own delivered text; the wake was not typed, no event is appended`, args.json);
      throw new VerbExit(1);
    }
  };
  const sendWake = (prompt, stagedEvidence, staleDrafts) => {
    // Delivery is proven from the screen, not Orca's receipt: agent_prompt_stalled
    // (text queued behind a running turn) and agent_prompt_blocked (Enter refused,
    // then retried) left wakes on the worker's screen while nudge reported
    // terminal-send-failed (inc-b87a42ec8690, inc-e4f69f9ef061, inc-13ab4be5059f).
    const proof = sendWakeWithProof({ terminal: worker.terminalHandle, text: prompt, stagedPattern: stagedEvidence.stagedPattern,
      ownTexts: [stagedEvidence.sentText].filter(Boolean), staleDrafts });
    const sent = proof.sent ?? {};
    // The input box changed between the check above and the send: foreign text appeared, or a pile of
    // runtime text would not clear. Nothing was typed onto it.
    if (!proof.ok && (proof.delivery === 'foreign-input' || proof.delivery === 'draft-stuck')) {
      const out = { ok: false, jobId, nudged: false, reason: proof.delivery, input: proof.draft ?? null, inputSource: 'draft', ...deliveryFieldsOf(proof), worker };
      const why = proof.delivery === 'foreign-input'
        ? `the input box draft Orca reports holds '${String(proof.draft ?? '').slice(0, 80)}' that is neither a staged paste nor the runtime's own delivered text; the wake was not typed (only a Ctrl+U probe and its restore)`
        : `the input box holds piled-up runtime text that bounded Ctrl+U shrank but could not empty ('${String(proof.draft ?? '').slice(0, 80)}'); the wake was not typed onto it`;
      emit(out, `nudge REFUSED for ${jobId}: ${proof.delivery} — ${why}, no event is appended`, args.json);
      throw new VerbExit(1);
    }
    // A dropped wake (ok receipt, idle frame, no text) is retried once split -
    // text, then Enter-only - and says so: splitRetried/splitOutcome.
    const delivered = deliveryFieldsOf(proof);
    // The agent exited after the observation: the frame read right before typing
    // ended in a shell (nothing typed), or the frames after the send show a shell
    // got the text. Never a delivery; reconcile --dead-worker recovers the job.
    if (!proof.ok && proof.delivery === 'agent-exited') {
      const typed = Boolean(proof.sent);
      if (typed) ledger.transaction(() => ledger.appendEvent({
        workflowId: job.workflow_id, entityType: 'job', entityId: jobId,
        kind: 'op-worker-wake-to-shell', payload: { opId: job.op_id, attempt: job.attempt, dispatchId, terminal: worker.terminalHandle,
          priorLiveness: worker.liveness, shellPrompt: proof.shellPrompt ?? null, ...deliveredForEvent(delivered) },
      }));
      const out = { ok: false, jobId, nudged: false, reason: 'agent-exited', ...delivered, shellPrompt: proof.shellPrompt ?? null, typed, worker };
      const what = typed ? `a shell received the wake: '${proof.shellPrompt}'` : `the worker's agent exited; its terminal shows the shell prompt '${proof.shellPrompt}'; nothing was typed`;
      emit(out, `nudge REFUSED for ${jobId}: agent-exited — ${what} - ${deadWorkerRecovery(jobId)}`, args.json);
      throw new VerbExit(1);
    }
    if (!proof.ok) {
      const refused = recordSendRefused(ledger, job, { dispatchId, worker, proof });
      const out = { ok: false, jobId, nudged: false, reason: 'terminal-send-failed', ...delivered, worker, error: sent.error, ...(refused ? { sendRefused: true } : {}) };
      emit(out, `nudge FAILED for ${jobId}: ${sent.error || proof.sendErrorCode || 'terminal send failed'}; the screen shows no wake (${proof.evidence})${refused ? refusedNote(jobId) : ''}`, args.json);
      throw new VerbExit(1);
    }
    ledger.transaction(() => ledger.appendEvent({
      workflowId: job.workflow_id, entityType: 'job', entityId: jobId,
      kind: 'op-worker-nudged', payload: { opId: job.op_id, attempt: job.attempt, dispatchId, terminal: worker.terminalHandle, priorLiveness: worker.liveness, ...(worker.livenessReason ? { livenessReason: worker.livenessReason } : {}), ...deliveredForEvent(delivered) },
    }));
    const out = { ok: true, jobId, nudged: true, action: 'wake', ...delivered, worker, receipt: sent.receipt ?? null };
    const deliveryVerb = proof.delivery === 'queued' ? 'queued the wake behind the running turn of' : 'resumed';
    const staleNote = proof.draftNote ? `; Orca's draft '${String(proof.staleDraft ?? '').slice(0, 80)}' was stale (Ctrl+U left it unchanged), typed over as an empty box` : '';
    emit(out, `nudged ${jobId}: ${deliveryVerb} exact worker ${worker.terminalHandle} to file its durable report (${proof.evidence})${staleNote}`, args.json);
  };
  if (!earlyGate()) return;
  const stagedEvidence = stagedInputEvidenceOf(db, job);
  if (midGate(stagedEvidence) !== 'send') return;
  const prompt = [
    `Operation liveness wake for durable job ${jobId} (${job.op_id}) attempt ${job.attempt}.`,
    'Your accepted contract remains running but no durable report is filed.',
    'Re-read the exact contract with starci kernel op-contract, continue only inside its existing authority, and file exactly one starci kernel report.',
    'Report done, partial, failed, ask or blocked truthfully; do not wait for another chat prompt and do not widen scope.',
    ...driftNotice(),
  ].join(' ');
  const staleDrafts = foreignDraftGate(prompt, stagedEvidence);
  inputRowGate(prompt, stagedEvidence);
  sendWake(prompt, stagedEvidence, staleDrafts);
  },
};
