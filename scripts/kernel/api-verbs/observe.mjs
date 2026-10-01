// api observe: bounded output context on the bound operation worker.
// The context is the worker's own output, read by Dispatch (worker-read --source auto: the exact transcript when the
// provider has one, else labelled terminal output; deep map T1). The turn state is still classified from the
// rendered frame (terminal show + terminal read --screen): only the frame shows turn-idle versus active, a staged
// draft and provider rate-limit text (deep map T2, WRAP). A worker whose frame is unreadable still returns its output.
import { parseJson } from '../../lib/json.mjs';
import { updateJob } from '../../../engine/ledger-db.mjs';
import { terminalRead } from '../../api/orca/terminal-read.mjs';
import { terminalShow } from '../../api/orca/terminal-show.mjs';
import { workerRead } from '../../api/orca/worker-read.mjs';
import { jobPayloadOf, jobRowOf, operationTerminalHandleOf, operationDispatchOf } from '../api-lib/rows.mjs';
import { outputAgeOf, exitedAgentPromptRow, classifyAgentScreen, staleAwareState } from '../terminal-liveness.mjs';
import { sessionIdentityOf } from '../op-session.mjs';

const OBSERVE_OUTPUT_LINES = 80;
/**
 * The newest `lines` lines of Dispatch `dispatch`'s output (one worker-read page: Orca's bounded tail) as
 * {dispatch, source, text, contentComplete, clipping, fallbackReason} or, unreadable, {dispatch, source: null,
 * text: null, reason}. contentComplete is Orca's: false whenever older output was left out.
 */
const observedOutputOf = (dispatch, lines) => {
  if (!dispatch) return { dispatch: null, source: null, text: null, contentComplete: false, reason: 'no-dispatch' };
  let page;
  try { page = workerRead({ dispatch, source: 'auto', limit: lines }); } catch (error) { page = { ok: false, error: String(error?.message ?? error) }; }
  if (!page?.ok) return { dispatch, source: null, text: null, contentComplete: false, reason: page?.hostUnavailable ? 'host-unavailable' : 'unreadable',
    ...(page?.errorCode ? { errorCode: page.errorCode } : {}) };
  const all = [...page.rows, ...(page.draft ? [page.draft] : [])].join('\n').split(/\r?\n/);
  return { dispatch, source: page.source, text: all.slice(-lines).join('\n'), contentComplete: page.contentComplete && all.length <= lines,
    clipping: page.clipping, fallbackReason: page.fallbackReason };
};
// Keyed on classifyAgentScreen/staleAwareState states only: gate-loop is observeOperationWorker's
// composed liveness, never a screen state, so it has no entry here.
const OBSERVE_TURN_STATES = { active: 'active', wedged: 'wedged', 'turn-idle': 'turn-idle', 'interactive-gate': 'turn-idle', 'staged-input': 'staged-input' };
export default {
  verb: 'observe',
  required: ['job'],
  kernelOnly: true,
  usageInCore: true,
  run({ ledger, args, repo, emit, need, internals }) {
    const { stagedInputEvidenceOf, livenessMsOf, ACTIVE_STALE_MS, workerOutageEvidence, recordWorkerOutageEvidence } = internals;
  const db = ledger.db, jobId = args.job, now = Date.now();
  const job = jobRowOf(db, jobId);
  if (!job) throw Object.assign(new Error(`unknown job ${jobId}`), { code: 'job-not-found' });
  if (job.kind !== 'op') throw Object.assign(new Error(`job ${jobId} is not an operation`), { code: 'job-not-operation' });
  let lines = OBSERVE_OUTPUT_LINES;
  if (args.lines != null) {
    const n = Number(args.lines);
    need(Number.isInteger(n) && n > 0, `observe --lines must be a positive integer, got '${args.lines}'`);
    lines = n;
  }
  const handle = operationTerminalHandleOf(job);
  if (!handle) {
    const out = { ok: false, job: jobId, reason: 'no-live-worker', ledgerStatus: job.status };
    emit(out, `observe REFUSED for ${jobId}: no-live-worker (a ${job.status} job binds no worker terminal)`, args.json);
    process.exit(1);
  }
  // Host reads only — terminal-show and the rendered frame for the turn state, worker-read for the output.
  // A dead or unreadable terminal is a typed projection, not a refusal: the kernel still needs the context
  // to reason about the op.
  const terminal = { handle, connected: false, writable: false, status: null, idleMs: null };
  let turnState = 'unknown', screenState = null, outageCircuit = null;
  let shown;
  try { shown = terminalShow({ terminal: handle }); }
  catch (error) { shown = { ok: false, error: String(error?.message ?? error) }; }
  terminal.connected = shown?.ok === true && shown?.connected === true;
  terminal.writable = shown?.ok === true && shown?.writable === true;
  terminal.status = shown?.terminal?.status ?? null;
  const { lastOutputAt, outputAgeMs: idleMs } = outputAgeOf(shown?.terminal?.lastOutputAt, now);
  terminal.idleMs = idleMs;
  if (!shown?.ok) turnState = 'unreadable';
  else if (!terminal.connected || !terminal.writable) turnState = 'disconnected';
  else {
    let read;
    try { read = terminalRead({ terminal: handle, screen: true }); }
    catch (error) { read = { ok: false, error: String(error?.message ?? error) }; }
    if (!read?.ok) turnState = 'unreadable';
    else {
      const shellPrompt = exitedAgentPromptRow(read.screen);
      screenState = shellPrompt ? 'agent-exited' : classifyAgentScreen(read.screen, stagedInputEvidenceOf(db, job)).state;
      // The provider card's activeStaleMs, as status reads it: with the global ten minutes a Devin
      // worker that redrew nothing through a long tool call read turn-idle here while status read it
      // active (nivo inc-266976b75b25).
      const stale = staleAwareState(screenState, terminal.idleMs, livenessMsOf(job, 'activeStaleMs', ACTIVE_STALE_MS));
      turnState = shellPrompt ? 'agent-exited' : OBSERVE_TURN_STATES[stale.state] ?? 'unknown';
      if (stale.staleActive) terminal.livenessReason = 'stale-active';
      if (screenState !== 'active') {
        const evidence = workerOutageEvidence(job, read.screen);
        if (evidence) outageCircuit = recordWorkerOutageEvidence(ledger, [{ jobId, providerOutage: evidence, lastOutputAt }], now)[0] ?? null;
      }
    }
  }
  if (screenState) terminal.screenState = screenState;
  const output = observedOutputOf(operationDispatchOf(jobPayloadOf(job)), lines);
  // The op's session identity is learned while the worker is live and kept on
  // the job payload (op-session.mjs): settle archives by that record and
  // re-resolves anything it missed. Resolved once — the session file set is
  // stable once the agent's session exists.
  let sessionIdentity = null;
  try {
    const payload = jobPayloadOf(job);
    if (!payload.session?.files?.length && ['running', 'answering'].includes(job.status))
      sessionIdentity = sessionIdentityOf(db, job, payload, repo);
  } catch { /* identity resolution never breaks the read */ }
  ledger.transaction(() => {
    ledger.appendEvent({
      workflowId: job.workflow_id, entityType: 'job', entityId: jobId,
      kind: 'op-observed',
      payload: { opId: job.op_id, attempt: job.attempt, terminal: handle, dispatch: output.dispatch, turnState,
        outputSource: output.source, outputBytes: output.text == null ? 0 : Buffer.byteLength(output.text) },
    });
    if (sessionIdentity?.files?.length) {
      const stored = parseJson(db.prepare('SELECT payload_json FROM jobs WHERE job_id=?').get(jobId)?.payload_json) ?? {};
      if (!stored.session?.files?.length)
        updateJob(db, { jobId, payload: { ...stored, session: sessionIdentity } });
    }
  });
  const out = { ok: true, job: jobId, jobId, opId: job.op_id, attempt: job.attempt, ledgerStatus: job.status, terminal, output, turnState, observedAt: now,
    ...(outageCircuit ? { outageCircuit } : {}) };
  emit(out, [
    `observe ${jobId} — ${turnState} (terminal ${handle}, connected=${terminal.connected} writable=${terminal.writable}, `
      + `output ${output.source ?? output.reason}, ${output.text == null ? 0 : output.text.split('\n').length} lines, contentComplete=${output.contentComplete})`,
    ...(output.text == null ? [] : [output.text]),
  ].join('\n'), args.json);

  },
};
