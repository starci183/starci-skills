// tests/helpers/fake-orca.mjs — the canned Orca binary shared by the dispatch
// specs. Write FAKE_ORCA to a temp file and run it through the existing
// STARCI_ORCA_COMMAND / STARCI_ORCA_ARGS overrides:
//
//   env: { STARCI_ORCA_COMMAND: process.execPath, STARCI_ORCA_ARGS: JSON.stringify([stubPath]) }
//
// Every invocation appends {argv} to STARCI_FAKE_ORCA_LOG (JSONL) — the specs
// prove no terminal/worker leaks from that call log. Mutable state lives in
// STARCI_FAKE_ORCA_STATE (sends counter, terminal command/model, and last
// started operation-worker agent/model).
//
// Env knobs:
//   STARCI_FAKE_ORCA_MODE  'healthy' (default): terminal read shows the qwen
//                          prompt, worker-start returns a ready dispatch.
//                          'auth': terminal read shows the observed
//                          '401 Invalid API-key' death screen and
//                          worker-start fails at stage 'auth'.
//                          'auth-partial': worker-start reports an auth failure
//                          plus a residual Dispatch that cleanup can settle.
//                          'auth-unknown': worker-start reports outcome_unknown;
//                          worker-show observes it ready, so fallback must stop.
//                          'prompt-stalled': worker-start created an exact
//                          worker whose prompt injection stalled; its process
//                          exited and release retains only terminal bookkeeping.
//                          'dead-terminal': terminal show reports the exact
//                          terminal disconnected/unwritable and terminal read
//                          fails — the observe spec's disconnected/unreadable
//                          projection.
//   STARCI_FAKE_ORCA_DEAD  comma-separated provider ids whose `account list`
//                          rateLimits entry reads dead/not-authenticated —
//                          drives the kernel-pin fail-closed spec.
//   STARCI_FAKE_ORCA_STALE comma-separated provider ids whose `account list`
//                          entry reports a refreshable stale OAuth token.
//   STARCI_FAKE_ORCA_EFFECTIVE_MODEL overrides the model rendered by the
//                          terminal for requested/effective mismatch coverage.
//   STARCI_FAKE_ORCA_UNIQUE_TERMINALS='1' hands every `terminal create` a fresh
//                          handle (fake-terminal-<n>) instead of reusing
//                          fake-terminal-1 — the kernel-restart spec proves the
//                          replacement terminal is a different one.
//
// State the specs read back: `commands` (every --command in creation order),
// `counter` (terminals created) and `terminals[handle]` = {handle, connected,
// writable, sent, prompt, command, model}. A spec may write connected:false
// onto one terminal record between runs; `terminal show`/`read` then report
// that exact terminal dead while the others stay live.
export const FAKE_ORCA = String.raw`// fake orca — canned terminal + orchestration API for the dispatch specs.
import fs from 'node:fs';
const argv = process.argv.slice(2);
const log = process.env.STARCI_FAKE_ORCA_LOG;
const stateFile = process.env.STARCI_FAKE_ORCA_STATE;
const mode = process.env.STARCI_FAKE_ORCA_MODE || 'healthy';
const deadProviders = new Set((process.env.STARCI_FAKE_ORCA_DEAD || '').split(',').map(s => s.trim()).filter(Boolean));
const staleProviders = new Set((process.env.STARCI_FAKE_ORCA_STALE || '').split(',').map(s => s.trim()).filter(Boolean));
const effectiveModelOverride = process.env.STARCI_FAKE_ORCA_EFFECTIVE_MODEL || null;
if (log) fs.appendFileSync(log, JSON.stringify({ argv }) + '\n');
const state = stateFile && fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')) : { sends: 0 };
const save = () => { if (stateFile) fs.writeFileSync(stateFile, JSON.stringify(state)); };
const arg = n => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : null; };
const out = o => console.log(JSON.stringify(o));
const fail = (o, code) => { console.log(JSON.stringify(o)); process.exit(code ?? 1); };
const commandModel = command => {
  const match = String(command || '').match(/(?:^|\s)(?:-m|--model)\s+["']?([^\s"']+)/i);
  return match?.[1] ?? null;
};
const uniqueTerminals = process.env.STARCI_FAKE_ORCA_UNIQUE_TERMINALS === '1';
const record = handle => (state.terminals || {})[handle] || null;
const renderedModel = handle => effectiveModelOverride || record(handle)?.model || state.terminalModel || 'gpt-5.6-sol';
const isQwen = handle => /(?:^|\s)qwen(?:\.exe)?(?:\s|$)/i.test(String(record(handle)?.command ?? state.terminalCommand ?? ''));
const PROMPT = h => (isQwen(h) ? 'Qwen\nmodel: ' + renderedModel(h) + '\nType your message\n> ' : 'Codex\nmodel: ' + renderedModel(h) + '\nEnter a prompt\n> ');
const DEAD = h => (isQwen(h) ? 'Qwen\nmodel: ' + renderedModel(h) + '\nType your message' : 'Codex\nmodel: ' + renderedModel(h) + '\nEnter a prompt') + '\n\nERROR 401 Invalid API-key — key rejected upstream\n';
const LIVE = h => (isQwen(h) ? 'Qwen' : 'Codex') + '\nmodel: ' + renderedModel(h) + '\nThinking hard\nesc to interrupt\ntokens 96\n';
// A spec may mark one terminal record dead; mode 'dead-terminal' kills them all.
const isDead = handle => mode === 'dead-terminal' || record(handle)?.connected === false;
const hasSent = handle => { const r = record(handle); return r ? !!r.sent : state.sends > 0; };
const verb = argv.slice(0, 2).join(' ');
if (verb === 'terminal create') {
  state.terminalCommand = arg('command');
  state.terminalModel = commandModel(state.terminalCommand);
  state.counter = (state.counter || 0) + 1;
  state.commands = [...(state.commands || []), state.terminalCommand];
  const handle = uniqueTerminals ? 'fake-terminal-' + state.counter : 'fake-terminal-1';
  state.terminals = { ...(state.terminals || {}), [handle]: { handle, connected: true, writable: true,
    sent: false, prompt: null, command: state.terminalCommand, model: state.terminalModel } };
  save();
  out({ ok: true, result: { terminal: { handle, title: arg('title'), connected: true, writable: true } } });
}
else if (verb === 'terminal read')
  isDead(arg('terminal'))
    ? fail({ ok: false, error: { code: 'terminal_gone', message: 'terminal is not connected' } })
    : out({ ok: true, result: { terminal: { handle: arg('terminal'), connected: true, writable: true,
      screen: mode === 'auth' ? DEAD(arg('terminal')) : (hasSent(arg('terminal')) ? LIVE(arg('terminal')) : PROMPT(arg('terminal'))) } } });
else if (verb === 'terminal send') {
  const r = record(arg('terminal'));
  if (r) { r.sent = true; r.prompt = arg('text'); }
  state.sends += 1; save(); out({ ok: true, result: { sent: true } });
}
else if (verb === 'terminal close') out({ ok: true, result: { closed: arg('terminal') } });
else if (verb === 'terminal show')
  isDead(arg('terminal'))
    ? out({ ok: true, result: { terminal: { handle: arg('terminal'), status: 'exited', connected: false, writable: false, lastOutputAt: null } } })
    : out({ ok: true, result: { terminal: { handle: arg('terminal'), status: 'running', connected: true, writable: true, lastOutputAt: Date.now() } } });
else if (verb === 'terminal rename')
  out({ ok: true, result: { terminal: { handle: arg('terminal'), title: arg('title') } } });
// ---- orchestration verbs (managed-agent lifecycle) ----
else if (verb === 'orchestration run-create') {
  if (mode === 'run-create-error')
    fail({ ok: false, error: { code: 'run_context_missing', message: 'No launcher context is bound' } });
  out({ ok: true, result: { run: { id: 'run-fake-1', objective: arg('objective') } } });
}
else if (verb === 'orchestration run-use')
  out({ ok: true, result: { run: { id: arg('id') } } });
else if (verb === 'orchestration run-show')
  out({ ok: true, result: { run: { id: arg('id'), coordinator_handle: 'fake-terminal-1' } } });
else if (verb === 'orchestration task-create')
  out({ ok: true, result: { task: { id: 'task-fake-1', display_name: arg('display-name'), run: arg('run') } } });
else if (verb === 'orchestration task-update')
  out({ ok: true, result: { task: { id: arg('id') } } });
else if (verb === 'orchestration task-list')
  out({ ok: true, result: { tasks: [] } });
else if (verb === 'orchestration worker-start') {
  if (mode === 'auth')
    fail({ ok: false, error: { code: 'not_authenticated' }, result: { stage: 'auth', failedStage: 'auth', residualResources: [] } });
  if (mode === 'auth-partial')
    fail({ ok: false, error: { code: 'not_authenticated' }, result: { dispatchId: 'dispatch-fake-1', stage: 'auth', failedStage: 'auth', residualResources: ['dispatch-fake-1'] } });
  if (mode === 'auth-unknown') {
    state.agent = arg('agent'); state.model = arg('model'); state.dispatchId = 'dispatch-fake-1'; save();
    fail({ ok: false, error: { code: 'not_authenticated' }, result: { dispatchId: 'dispatch-fake-1', state: 'outcome_unknown' } });
  }
  if (mode === 'prompt-stalled') {
    state.agent = arg('agent'); state.model = arg('model'); state.dispatchId = 'dispatch-fake-1'; save();
    fail({ ok: false, error: { code: 'agent_prompt_stalled' }, result: {
      dispatchId: 'dispatch-fake-1', stage: 'dispatch_input', failedStage: 'dispatch_input',
      residualResources: ['dispatch-fake-1']
    } });
  }
  state.agent = arg('agent'); state.model = arg('model'); state.dispatchId = 'dispatch-fake-1'; save();
  out({ ok: true, result: { runId: arg('run'), taskId: arg('task'), dispatchId: 'dispatch-fake-1',
    state: 'ready', stage: 'ready',
    launch: { effective: { agent: arg('agent'), model: arg('model'), effort: arg('effort') } } } });
}
else if (verb === 'orchestration worker-show') {
  if (mode === 'prompt-stalled')
    out({ ok: true, result: { dispatch: { id: arg('dispatch'), task_id: 'task-fake-1', last_failure: 'agent_prompt_stalled' },
      worker: { state: 'failed', stage: 'dispatch_input', agent_terminal_handle: 'fake-terminal-1' },
      terminal: { handle: 'fake-terminal-1', connected: false, writable: false },
      observation: { exactWorker: true, status: 'exited' } } });
  else
    out({ ok: true, result: { dispatch: { id: arg('dispatch'), task_id: 'task-fake-1' },
      worker: { state: 'ready', agent_terminal_handle: 'fake-terminal-1',
        startOptions: { launch: { effective: { agent: state.agent ?? 'codex', model: state.model ?? 'gpt-5.6-sol' } } } },
      observation: { exactWorker: true } } });
}
else if (verb === 'orchestration worker-stop')
  out({ ok: true, result: { dispatchId: arg('dispatch'), state: 'stopped', alreadySettled: false } });
else if (verb === 'orchestration worker-release') {
  if (mode === 'prompt-stalled')
    fail({ ok: false, result: { dispatchId: arg('dispatch'), state: 'retained', reason: 'identity_unproven' } });
  out({ ok: true, result: { dispatchId: arg('dispatch'), state: 'released' } });
}
else if (verb === 'orchestration worker-abandon')
  out({ ok: true, result: { dispatchId: arg('dispatch'), state: 'abandoned' } });
else if (verb === 'orchestration worker-list')
  out({ ok: true, result: { workers: [] } });
else if (verb === 'orchestration worker-read')
  out({ ok: true, result: { dispatch: arg('dispatch'), lines: [] } });
else if (verb === 'orchestration dispatch')
  out({ ok: true, result: { dispatch: { id: arg('to') ?? 'dispatch-fake-1' }, preamble: 'fake dispatch preamble' } });
else if (verb === 'orchestration dispatch-show')
  out({ ok: true, result: { dispatch: { id: 'dispatch-fake-1', assignee_handle: 'fake-terminal-1' } } });
else if (verb === 'orchestration check')
  out({ ok: true, result: { deliveries: [] } });
else if (verb === 'orchestration send')
  out({ ok: true, result: { sent: true } });
else if (verb === 'orchestration reply')
  out({ ok: true, result: { replied: arg('id') } });
// ---- misc reads ----
else if (verb === 'worktree show')
  out({ ok: true, result: { worktree: { id: arg('worktree'), path: arg('worktree') } } });
else if (verb === 'account list') {
  // Pinned receipt shape (scripts/api/quota/orca-account.mjs):
  //   result.rateLimits.<provider> = {status, weekly:{usedPercent,...}, error,
  //   usageMetadata:{failureKind}} — 'unavailable' / missing-credentials → dead.
  const rateLimits = {};
  for (const p of ['claude', 'codex', 'qwen', 'devin'])
    rateLimits[p] = deadProviders.has(p)
      ? { status: 'unavailable', error: 'not authenticated',
          weekly: { usedPercent: null, windowMinutes: null, resetsAt: null },
          usageMetadata: { failureKind: 'missing-credentials' } }
      : staleProviders.has(p)
        ? { status: 'error', error: 'OAuth token expired; refresh may occur on launch',
            weekly: { usedPercent: null, windowMinutes: 10080, resetsAt: null },
            usageMetadata: { failureKind: 'stale-token' } }
      : { status: 'ok', weekly: { usedPercent: 12, windowMinutes: 10080, resetsAt: null } };
  out({ ok: true, result: { rateLimits } });
}
else { out({ ok: false, error: 'fake-orca: unhandled ' + argv.join(' ') }); process.exit(1); }
process.exit(0);
`;
