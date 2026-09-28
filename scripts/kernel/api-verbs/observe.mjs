// api observe: bounded screen context on the bound operation worker.
import { parseJson } from '../../lib/json.mjs';
import { terminalRead } from '../../api/orca/terminal-read.mjs';
import { terminalShow } from '../../api/orca/terminal-show.mjs';
import { jobPayloadOf, operationTerminalHandleOf } from '../api-lib/rows.mjs';
import { outputAgeOf, exitedAgentPromptRow, classifyAgentScreen, staleAwareState } from '../terminal-liveness.mjs';
import { sessionIdentityOf } from '../op-session.mjs';

const OBSERVE_SCREEN_LINES = 80;
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
  const job = db.prepare('SELECT * FROM jobs WHERE job_id=?').get(jobId);
  if (!job) throw Object.assign(new Error(`unknown job ${jobId}`), { code: 'job-not-found' });
  if (job.kind !== 'op') throw Object.assign(new Error(`job ${jobId} is not an operation`), { code: 'job-not-operation' });
  let lines = OBSERVE_SCREEN_LINES;
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
  // Host reads only — terminal-show for liveness, terminal-read for the
  // screen tail. A dead or unreadable terminal is a typed projection, not a
  // refusal: the kernel still needs the context to reason about the op.
  const terminal = { handle, connected: false, writable: false, status: null, idleMs: null };
  let screen = null, turnState = 'unknown', screenState = null, outageCircuit = null;
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
      screen = String(read.screen ?? '').split(/\r?\n/).slice(-lines).join('\n');
      if (screenState !== 'active') {
        const evidence = workerOutageEvidence(job, read.screen);
        if (evidence) outageCircuit = recordWorkerOutageEvidence(ledger, [{ jobId, providerOutage: evidence, lastOutputAt }], now)[0] ?? null;
      }
    }
  }
  if (screenState) terminal.screenState = screenState;
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
      payload: { opId: job.op_id, attempt: job.attempt, terminal: handle, turnState, screenBytes: screen == null ? 0 : Buffer.byteLength(screen) },
    });
    if (sessionIdentity?.files?.length) {
      const stored = parseJson(db.prepare('SELECT payload_json FROM jobs WHERE job_id=?').get(jobId)?.payload_json) ?? {};
      if (!stored.session?.files?.length)
        db.prepare('UPDATE jobs SET payload_json=? WHERE job_id=?').run(JSON.stringify({ ...stored, session: sessionIdentity }), jobId);
    }
  });
  const out = { ok: true, job: jobId, jobId, opId: job.op_id, attempt: job.attempt, ledgerStatus: job.status, terminal, screen, turnState, observedAt: now,
    ...(outageCircuit ? { outageCircuit } : {}) };
  emit(out, [
    `observe ${jobId} — ${turnState} (terminal ${handle}, connected=${terminal.connected} writable=${terminal.writable}, screen ${screen == null ? 0 : screen.split('\n').length} lines)`,
    ...(screen == null ? [] : [screen]),
  ].join('\n'), args.json);

  },
};
