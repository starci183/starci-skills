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
//   STARCI_FAKE_ORCA_LIMITED comma-separated provider ids whose `account list`
//                          entry is ok at 96% of the weekly window (limited).
//   STARCI_FAKE_ORCA_GATE  comma-separated provider ids (claude|codex) whose
//                          terminals render that CLI's first-run interactive
//                          gate screen on every read — drives the kernel
//                          group fall-through spec.
//   STARCI_FAKE_ORCA_EFFECTIVE_MODEL overrides the model rendered by the
//                          terminal for requested/effective mismatch coverage.
//   STARCI_FAKE_ORCA_UNIQUE_TERMINALS='1' hands every `terminal create` a fresh
//                          handle (fake-terminal-<n>) instead of reusing
//                          fake-terminal-1 — the kernel-restart spec proves the
//                          replacement terminal is a different one.
//
//   STARCI_FAKE_ORCA_CREATE_TIMEOUT 'live' | 'dead': `terminal create` makes the
//                          terminal but answers Orca's renderer-path error
//                          "Timed out waiting for terminal handle after
//                          creation" with no handle — the created terminal is
//                          only visible through `terminal list`, where its pane
//                          title is the cwd name (as Codex rewrites it) and its
//                          tab title is the --title. 'dead': that terminal has
//                          already disconnected.
//   STARCI_FAKE_ORCA_STUCK_PASTE 'enter' | 'never': a non-empty `terminal send`
//                          leaves the text staged in the input row
//                          ("› [Pasted Content N chars]"). 'enter': one
//                          Enter-only send submits it; 'never': it stays.
//
//   STARCI_FAKE_ORCA_GATE_SCREEN 'claude-trust' | 'claude-bypass' | 'codex-trust' |
//                          'claude-onboarding': every created terminal first shows
//                          that multi-line launch menu with its cursor on the
//                          first option (Claude 2.1.280 puts 'No, exit' first).
//                          A raw terminal-send key drives it: ESC[B / ESC[A move
//                          the cursor, '\r' picks the option. Picking the accept
//                          option clears the gate (the agent prompt follows);
//                          picking any other exits the terminal. Keys land in
//                          terminals[h].gateKeys and never count as a prompt.
//   STARCI_FAKE_ORCA_GATE_STICKY='1' the gate ignores every key (it persists).
//
//   STARCI_FAKE_ORCA_CLOSE_FAILS comma-separated terminal handles whose
//                          `terminal close` is refused ('*' refuses every
//                          close) — drives the unclosed-stale-kernel spec.
//
//   STARCI_FAKE_ORCA_OMIT_COMMAND comma-separated Orca commands ('terminal
//                          send') the agent-context listing leaves out — drives
//                          the host-contract-drift refusal spec.
//   STARCI_FAKE_ORCA_OMIT_FLAG comma-separated '<command>:<flag>' pairs
//                          ('orchestration worker-start:model') the
//                          agent-context listing leaves out of that command.
//
// `agent-context` answers from this repo's modules/host/orca/calls.yaml, so the
// live-schema comparison in scripts/api/orca/lib.mjs runs in every spec instead
// of being skipped; the two omit knobs above are the only way it drifts.
//
// State the specs read back: `commands` (every --command in creation order),
// `counter` (terminals created), `closed` (every handle `terminal close` took,
// in order) and `terminals[handle]` = {handle, connected, writable, sent,
// prompt, command, model, title, worktree, closed}. A spec may write
// connected:false onto one terminal record between runs; `terminal show`/
// `read` then report that exact terminal dead while the others stay live.
// `terminal list` answers with every terminal that is not closed — the
// listing scripts/checks/check-orca-tree.mjs projects.
import path from 'node:path';

const FAKE_ORCA_SOURCE = String.raw`// fake orca — canned terminal + orchestration API for the dispatch specs.
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
const ROOT = __STARCI_ROOT__;
const argv = process.argv.slice(2);
const log = process.env.STARCI_FAKE_ORCA_LOG;
const stateFile = process.env.STARCI_FAKE_ORCA_STATE;
const mode = process.env.STARCI_FAKE_ORCA_MODE || 'healthy';
const deadProviders = new Set((process.env.STARCI_FAKE_ORCA_DEAD || '').split(',').map(s => s.trim()).filter(Boolean));
const staleProviders = new Set((process.env.STARCI_FAKE_ORCA_STALE || '').split(',').map(s => s.trim()).filter(Boolean));
const limitedProviders = new Set((process.env.STARCI_FAKE_ORCA_LIMITED || '').split(',').map(s => s.trim()).filter(Boolean));
// Providers whose kernel terminal shows an interactive gate screen instead of a prompt.
const gateScreens = {
  claude: "Let's get started. Choose the text style that looks best with your terminal To change this later, run /theme 1. Auto (match terminal) ❯ 2. Dark mode ✔",
  codex: 'Do you trust the contents of this directory? › 1. Yes, continue 2. No, quit  Press enter to continue',
};
// Multi-line launch menus (STARCI_FAKE_ORCA_GATE_SCREEN): [lead text, options, accept index].
const menuGates = {
  'claude-trust': ['Accessing workspace:\n\n' + 'D:/fake/repo' + "\n\nQuick safety check: Is this a project you created or one you trust? (Like your own code, a well-known open source\nproject, or work from your team). If not, take a moment to review what's in this folder first.\n\nClaude Code'll be able to read, edit, and execute files here.\n\nSecurity guide\n",
    ['No, exit', 'Yes, I trust this folder'], 1, 'Enter to confirm · Esc to cancel', '❯'],
  'claude-bypass': ['WARNING: Claude Code running in Bypass Permissions mode\n\nIn Bypass Permissions mode, Claude Code will not ask for your approval before running potentially dangerous commands.\n\nBy proceeding, you accept all responsibility for actions taken while running in Bypass Permissions mode.\n',
    ['No, exit', 'Yes, I accept'], 1, 'Enter to confirm · Esc to cancel', '❯'],
  'codex-trust': ['> You are in D:/fake/repo\n\n  Do you trust the contents of this directory? Working with untrusted contents comes with higher risk of prompt injection.\n',
    ['1. Yes, continue', '2. No, quit'], 0, '  Press enter to continue', '›'],
  'claude-onboarding': ["Let's get started.\n\nChoose the text style that looks best with your terminal\nTo change this later, run /theme\n",
    ['1. Dark mode ✔', '2. Light mode'], 0, '', '❯'],
};
const menuGate = process.env.STARCI_FAKE_ORCA_GATE_SCREEN || '';
const menuSticky = process.env.STARCI_FAKE_ORCA_GATE_STICKY === '1';
const MENU = r => { const [lead, options, , foot, mark] = menuGates[r.gate.kind];
  return lead + '\n' + options.map((o, i) => (i === r.gate.cursor ? mark + ' ' : '  ') + o).join('\n') + '\n\n' + foot; };
const gatedProviders = new Set((process.env.STARCI_FAKE_ORCA_GATE || '').split(',').map(s => s.trim()).filter(Boolean));
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
// Handles that terminal close refuses ('*' refuses every close).
const closeFails = new Set((process.env.STARCI_FAKE_ORCA_CLOSE_FAILS || '').split(',').map(s => s.trim()).filter(Boolean));
const record = handle => (state.terminals || {})[handle] || null;
const renderedModel = handle => effectiveModelOverride || record(handle)?.model || state.terminalModel || 'gpt-6-sol';
const isQwen = handle => /(?:^|\s)qwen(?:\.exe)?(?:\s|$)/i.test(String(record(handle)?.command ?? state.terminalCommand ?? ''));
const PROMPT = h => (isQwen(h) ? 'Qwen\nmodel: ' + renderedModel(h) + '\nType your message\n> ' : 'Codex\nmodel: ' + renderedModel(h) + '\nEnter a prompt\n> ');
const DEAD = h => (isQwen(h) ? 'Qwen\nmodel: ' + renderedModel(h) + '\nType your message' : 'Codex\nmodel: ' + renderedModel(h) + '\nEnter a prompt') + '\n\nERROR 401 Invalid API-key — key rejected upstream\n';
const LIVE = h => (isQwen(h) ? 'Qwen' : 'Codex') + '\nmodel: ' + renderedModel(h) + '\nThinking hard\nesc to interrupt\ntokens 96\n';
// A spec may mark one terminal record dead; mode 'dead-terminal' kills them all.
const isDead = handle => mode === 'dead-terminal' || record(handle)?.connected === false;
const commandProvider = handle => (String(record(handle)?.command ?? state.terminalCommand ?? '').match(/(?:^|[\s"'\\/])(claude|codex|qwen|devin)(?:\.exe|\.cmd)?(?=[\s"']|$)/i)?.[1] ?? '').toLowerCase();
const gatedProviderOf = handle => { const p = commandProvider(handle); return p && gatedProviders.has(p) && gateScreens[p] ? p : null; };
const hasSent = handle => { const r = record(handle); return r ? !!r.sent : state.sends > 0; };
const createTimeout = process.env.STARCI_FAKE_ORCA_CREATE_TIMEOUT || '';
const stuckPaste = process.env.STARCI_FAKE_ORCA_STUCK_PASTE || '';
const STAGED = h => 'Codex\nmodel: ' + renderedModel(h) + '\n\n› [Pasted Content ' + String(record(h)?.prompt ?? '').length + ' chars]\n  gpt-6-sol high · repo\n';
const verb = argv.slice(0, 2).join(' ');
// The live-schema listing scripts/api/orca/lib.mjs compares against, derived
// from calls.yaml so the stub can never disagree with the contract by accident.
if (argv[0] === 'agent-context') {
  const { parseYaml } = await import(pathToFileURL(ROOT + '/engine/yaml.mjs').href);
  const contract = parseYaml(fs.readFileSync(ROOT + '/modules/host/orca/calls.yaml', 'utf8'));
  const omitCommands = new Set((process.env.STARCI_FAKE_ORCA_OMIT_COMMAND || '').split(',').map(s => s.trim()).filter(Boolean));
  const omitFlags = new Set((process.env.STARCI_FAKE_ORCA_OMIT_FLAG || '').split(',').map(s => s.trim()).filter(Boolean));
  const commands = [];
  const seen = new Set();
  for (const call of Object.values(contract.calls || {})) {
    if (!call || seen.has(call.command) || omitCommands.has(call.command)) continue;
    seen.add(call.command);
    const flags = (call.flags || []).filter(f => !omitFlags.has(call.command + ':' + f));
    if (!flags.includes('json')) flags.push('json');
    commands.push({ command: call.command, flags: flags.map(f => '--' + f) });
  }
  out({ ok: true, schemaVersion: 1, commandCount: commands.length, commands });
  process.exit(0);
}
if (verb === 'terminal create') {
  state.terminalCommand = arg('command');
  state.terminalModel = commandModel(state.terminalCommand);
  state.counter = (state.counter || 0) + 1;
  state.commands = [...(state.commands || []), state.terminalCommand];
  const handle = uniqueTerminals ? 'fake-terminal-' + state.counter : 'fake-terminal-1';
  const timedOut = createTimeout === 'live' || createTimeout === 'dead';
  const paneTitle = timedOut ? String(arg('worktree') || '').replaceAll('\\', '/').split('/').filter(Boolean).pop() || null : arg('title');
  state.terminals = { ...(state.terminals || {}), [handle]: { handle, connected: createTimeout !== 'dead', writable: createTimeout !== 'dead',
    sent: false, prompt: null, command: state.terminalCommand, model: state.terminalModel,
    title: paneTitle, tabTitle: arg('title'), worktree: arg('worktree'), closed: false,
    ...(menuGates[menuGate] ? { gate: { kind: menuGate, cursor: 0, cleared: false }, gateKeys: [] } : {}) } };
  save();
  if (timedOut) fail({ ok: false, error: { code: 'runtime_error', message: 'Timed out waiting for terminal handle after creation' } });
  out({ ok: true, result: { terminal: { handle, title: arg('title'), connected: true, writable: true } } });
}
else if (verb === 'terminal read' && record(arg('terminal'))?.gate && !record(arg('terminal')).gate.cleared && !isDead(arg('terminal')))
  out({ ok: true, result: { terminal: { handle: arg('terminal'), connected: true, writable: true, screen: MENU(record(arg('terminal'))) } } });
else if (verb === 'terminal read' && gatedProviderOf(arg('terminal')))
  out({ ok: true, result: { terminal: { handle: arg('terminal'), connected: true, writable: true,
    screen: gateScreens[gatedProviderOf(arg('terminal'))] } } });
else if (verb === 'terminal read')
  isDead(arg('terminal'))
    ? fail({ ok: false, error: { code: 'terminal_gone', message: 'terminal is not connected' } })
    : out({ ok: true, result: { terminal: { handle: arg('terminal'), connected: true, writable: true,
      screen: mode === 'auth' ? DEAD(arg('terminal')) : (record(arg('terminal'))?.staged ? STAGED(arg('terminal'))
        : (hasSent(arg('terminal')) ? LIVE(arg('terminal')) : PROMPT(arg('terminal')))) } } });
else if (verb === 'terminal send' && record(arg('terminal'))?.gate && !record(arg('terminal')).gate.cleared) {
  const r = record(arg('terminal'));
  const key = (arg('text') ?? '') + (argv.includes('--enter') ? '\r' : '');
  r.gateKeys.push(key);
  const [, options, accept] = menuGates[r.gate.kind];
  if (!menuSticky) {
    if (key === '\x1b[B') r.gate.cursor = Math.min(options.length - 1, r.gate.cursor + 1);
    else if (key === '\x1b[A') r.gate.cursor = Math.max(0, r.gate.cursor - 1);
    else if (key === '\r') {
      if (r.gate.cursor === accept) r.gate.cleared = true;
      else { r.connected = false; r.writable = false; }
    }
  }
  save(); out({ ok: true, result: { send: { accepted: true, bytesWritten: key.length } } });
}
else if (verb === 'terminal send') {
  const r = record(arg('terminal'));
  const text = arg('text') ?? '';
  if (r && text) { r.sent = true; r.prompt = text; if (stuckPaste) r.staged = true; }
  else if (r && !text && argv.includes('--enter')) {
    r.enters = (r.enters || 0) + 1;
    if (stuckPaste === 'enter') r.staged = false;
    if (!r.sent) r.sent = true;
  }
  state.sends += 1; save(); out({ ok: true, result: { sent: true } });
}
else if (verb === 'terminal close') {
  const handle = arg('terminal');
  if (closeFails.has('*') || closeFails.has(handle))
    fail({ ok: false, error: { code: 'terminal_close_refused', message: 'terminal is held by the host' } });
  const r = record(handle);
  if (r) { r.closed = true; r.connected = false; r.writable = false; }
  state.closed = [...(state.closed || []), handle];
  save();
  out({ ok: true, result: { closed: handle } });
}
// terminal list is the listing scripts/checks/check-orca-tree.mjs reads:
// every terminal this stub created and has not closed.
else if (verb === 'terminal list') {
  const open = Object.values(state.terminals || {}).filter(t => !t.closed);
  out({ ok: true, result: { terminals: open
    .map(t => ({ handle: t.handle, title: t.title ?? null, worktree: t.worktree ?? null,
      connected: t.connected !== false, writable: t.writable !== false })),
    ...(argv.includes('--include-visual-layouts') ? { visualLayouts: [{ worktreeId: 'fake-worktree', root: { type: 'group',
      tabs: open.map(t => ({ tabId: 'tab-' + t.handle, title: t.tabTitle ?? t.title ?? null,
        panes: { type: 'terminal', handle: t.handle, tabId: 'tab-' + t.handle, title: t.title ?? null, connected: t.connected !== false } })) } }] } : {}) } });
}
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
else if (verb === 'orchestration task-create' && arg('parent') != null && !/^task[_-]/.test(arg('parent')))
  fail({ ok: false, error: { code: 'invalid_parent', message: '--parent takes a task id' } });
else if (verb === 'orchestration task-create')
  out({ ok: true, result: { task: { id: 'task-fake-1', display_name: arg('display-name'), run: arg('run') } } });
else if (verb === 'orchestration task-update' && !['pending', 'ready', 'dispatched', 'completed', 'failed', 'blocked'].includes(arg('status')))
  fail({ ok: false, error: { code: 'invalid_argument', message: 'invalid status ' + arg('status') + ', expected one of: pending, ready, dispatched, completed, failed, blocked' } });
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
  // The shape Devin logged: a refusal the host never classified — no stage, no
  // residual resources, an empty message. calls.yaml classifies it failed with
  // effectState none, so the candidate is reusable and nothing said why.
  if (mode === 'worker-start-refused')
    fail({ ok: false, error: { code: 'worker_start_failed', message: '' }, result: {} });
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
        startOptions: { launch: { effective: { agent: state.agent ?? 'codex', model: state.model ?? 'gpt-6-sol' } } } },
      observation: { exactWorker: true } } });
}
else if (verb === 'orchestration worker-stop')
  out({ ok: true, result: { dispatchId: arg('dispatch'), state: 'stopped', alreadySettled: false } });
else if (verb === 'orchestration worker-release') {
  if (mode === 'prompt-stalled')
    fail({ ok: false, result: { dispatchId: arg('dispatch'), state: 'retained', reason: 'identity_unproven' } });
  // STARCI_FAKE_ORCA_RELEASE_UNKNOWN=<n>: the first n releases answer
  // release_unknown and leave the agent terminal (fake-terminal-1) connected,
  // as Orca did for settled nivo Claude ops; a later release disconnects it.
  const unknownReleases = Number(process.env.STARCI_FAKE_ORCA_RELEASE_UNKNOWN || 0);
  if (unknownReleases > 0) {
    state.releases = (state.releases || 0) + 1;
    state.terminals = state.terminals || {};
    const agent = state.terminals['fake-terminal-1'] || { handle: 'fake-terminal-1' };
    if (state.releases > unknownReleases) state.terminals['fake-terminal-1'] = { ...agent, connected: false, writable: false };
    else state.terminals['fake-terminal-1'] = { ...agent, connected: true };
    save();
    if (state.releases <= unknownReleases)
      out({ ok: true, result: { dispatchId: arg('dispatch'), state: 'release_unknown', processAction: 'closed_agent_terminal',
        lastError: 'The agent terminal was closed but its process could not be confirmed stopped' } });
  }
  if (!(unknownReleases > 0 && state.releases <= unknownReleases))
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
      : limitedProviders.has(p)
        ? { status: 'ok', weekly: { usedPercent: 96, windowMinutes: 10080, resetsAt: null } }
      : { status: 'ok', weekly: { usedPercent: 12, windowMinutes: 10080, resetsAt: null } };
  out({ ok: true, result: { rateLimits } });
}
else { out({ ok: false, error: 'fake-orca: unhandled ' + argv.join(' ') }); process.exit(1); }
process.exit(0);
`;

// The stub reads calls.yaml from this checkout, so it carries the repo root it
// was written from — the spec's tmp dir is not a StarCi tree.
const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..').replaceAll('\\', '/');
export const FAKE_ORCA = FAKE_ORCA_SOURCE.replace('__STARCI_ROOT__', JSON.stringify(REPO_ROOT));
