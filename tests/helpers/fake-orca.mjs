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
//                          'quota': terminal read shows Qwen Code's rendered
//                          plan-quota error row ("[API Error: 429
//                          Throttling.AllocationQuota ...]") under its prompt.
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
//                          'inline-enter' | 'inline-never': the same, but the
//                          input box shows the pasted text itself (the tail of
//                          it, first row behind the glyph) the way Devin renders
//                          an inline paste - no "[Pasted Content]" marker.
//   STARCI_FAKE_ORCA_DROP_ENTER_SEND '1' | 'all': the Codex drop seen on
//                          term_28a694d9 (2026-09-24). A non-empty send with
//                          --enter answers ok:true and changes nothing. '1': a
//                          --no-enter send stages the text in the input row
//                          ("› <text>" under a seeded screen, else "[Pasted
//                          Content]") and an Enter-only send submits it (a
//                          Codex turn runs with the text echoed). 'all': the
//                          --no-enter send is dropped too.
//   STARCI_FAKE_ORCA_PREAMBLE overrides the `orchestration dispatch` preamble
//                          text (default 'fake dispatch preamble').
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
//   STARCI_FAKE_ORCA_BOOT_SCREEN 'claude-hint': a Claude terminal, until its first
//                          prompt send, shows Claude Code 2.1's fresh frame whose
//                          empty input box carries the placeholder hint
//                          (❯ Try "write a test for <filepath>") - the frame three
//                          nivo kernel boots timed out on (2026-09-24).
//   STARCI_FAKE_ORCA_BOOT_EXIT <n>: the first n terminals created exit on
//                          start: their frame shows the echoed launch line, a
//                          startup error and a bare PowerShell prompt
//                          (terminals[h].bootExit). Drives the one-retry spec.
//
//   STARCI_FAKE_ORCA_CLOSE_FAILS comma-separated terminal handles whose
//                          `terminal close` is refused ('*' refuses every
//                          close) — drives the unclosed-stale-kernel spec.
//
//   STARCI_FAKE_ORCA_HOST 'runtime_unavailable': Orca is not running; every
//                          call answers {error:{code:'runtime_unavailable'}}
//                          (state.hostDown does the same from the state file).
//   STARCI_FAKE_ORCA_HOST_DOWN_CALLS <n>: only the first n calls answer it -
//                          an Orca restart that comes back mid-sequence.
//   ENOENT (orca.exe missing while an update replaces it) is not a stub mode:
//                          point STARCI_ORCA_COMMAND at MISSING_ORCA_COMMAND.
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
// connected:false onto one terminal record between runs (lastOutputAt: <ms> pins
// what `terminal show` reports, a frozen frame's age; shellAfterSend: see terminal send); `terminal show`/
// `read` then report that exact terminal dead while the others stay live.
// stale:true instead makes `terminal show` refuse the handle with Orca's typed
// terminal_handle_stale, the answer a live Orca gives after a host reboot.
// `terminal list` answers with every terminal that is not closed — the
// listing scripts/checks/check-orca-tree.mjs projects — with worktreePath (the
// record's worktree), agentIdentity and, with --include-visual-layouts, each
// tab's title (tabTitle, else title): the restored-tab dedupe reads all three.
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
const QUOTA = h => 'Qwen\nmodel: ' + renderedModel(h) + '\n✕ [API Error: 429 Throttling.AllocationQuota: Allocated quota exceeded, please increase your quota limit.]\nType your message\n> ';
const LIVE = h => (isQwen(h) ? 'Qwen' : 'Codex') + '\nmodel: ' + renderedModel(h) + '\nThinking hard\nesc to interrupt\ntokens 96\n';
// A spec may mark one terminal record dead; mode 'dead-terminal' kills them all.
const isDead = handle => mode === 'dead-terminal' || record(handle)?.connected === false;
const commandProvider = handle => (String(record(handle)?.command ?? state.terminalCommand ?? '').match(/(?:^|[\s"'\\/])(claude|codex|qwen|devin)(?:\.exe|\.cmd)?(?=[\s"']|$)/i)?.[1] ?? '').toLowerCase();
const gatedProviderOf = handle => { const p = commandProvider(handle); return p && gatedProviders.has(p) && gateScreens[p] ? p : null; };
const hasSent = handle => { const r = record(handle); return r ? !!r.sent : state.sends > 0; };
const createTimeout = process.env.STARCI_FAKE_ORCA_CREATE_TIMEOUT || '';
const bootScreen = process.env.STARCI_FAKE_ORCA_BOOT_SCREEN || '';
const bootExits = Number(process.env.STARCI_FAKE_ORCA_BOOT_EXIT || 0);
const CLAUDE_HINT = h => [' ▐▛███▜▌   Claude Code v2.1.280', '▝▜█████▛▘  Opus 5.5 with high effort · Claude Max', '  ▘▘ ▝▝    D:\\fake\\repo', '',
  '─────', '❯ Try "write a test for <filepath>"', '─────', '  ⏵⏵ bypass permissions on (shift+tab to cycle) · ← for agents'].join('\n');
const BOOT_EXIT = h => ['PS D:\\fake\\repo> ' + String(record(h)?.command ?? '').slice(0, 60), 'Error: fake startup crash (ECONNRESET reading settings)', 'PS D:\\fake\\repo> '].join('\n');
const stuckPaste = process.env.STARCI_FAKE_ORCA_STUCK_PASTE || '';
const INLINE_STAGED = h => 'Codex\nmodel: ' + renderedModel(h) + '\n\n' + String(record(h)?.prompt ?? '').split(/\r?\n/).filter(Boolean).slice(-8)
  .map((line, i) => (i === 0 ? '› ' : '  ') + line).join('\n') + '\n';
const STAGED = h => stuckPaste.startsWith('inline') ? INLINE_STAGED(h) : 'Codex\nmodel: ' + renderedModel(h) + '\n\n› [Pasted Content ' + String(record(h)?.prompt ?? '').length + ' chars]\n  gpt-6-sol high · repo\n';
// STARCI_FAKE_ORCA_SEND_STALLED 'queued' | 'landed' | 'lost': a non-empty send
// with --enter answers agent_prompt_stalled. 'queued': a Claude frame holds the
// text behind a running hook spinner with "Press up to edit queued messages";
// 'landed': the text is echoed and a turn runs; 'lost': the screen is unchanged.
// A spec seeds terminals[h].screen (the frame shown until then).
const sendStalled = process.env.STARCI_FAKE_ORCA_SEND_STALLED || '';
const wrapRows = (text, width) => { const rows = []; let row = '';
  for (const word of String(text).split(' ')) { if (row && (row + ' ' + word).length > width) { rows.push(row); row = word; } else row = row ? row + ' ' + word : word; }
  if (row) rows.push(row); return rows; };
const CLAUDE_CHROME = ['─────', '❯', '─────', '  ⏵⏵ bypass permissions on (shift+tab to cycle) · ← for agents'];
const dropEnterSend = process.env.STARCI_FAKE_ORCA_DROP_ENTER_SEND || '';
const codexRows = text => wrapRows(text, 76).map((row, i) => (i === 0 ? '› ' : '  ') + row);
const SCREEN_OF = r => r.dropStaged ? [String(r.screen), ...codexRows(r.prompt)].join('\n')
  : r.dropSubmitted ? [String(r.screen), ...codexRows(r.prompt), '• Working (2s • esc to interrupt)', '› Ask Codex to do anything'].join('\n')
  : r.stalledWake === 'queued'
  ? ['● Bash(node scripts/kernel/api.mjs op-contract)', '✢ Transmuting… (running PreToolUse hook · 1m 26s · ↓ 3.9k tokens)', '─────',
    ...wrapRows(r.prompt, 76).map((row, i) => (i === 0 ? '❯ ' : '  ') + row), '─────', '  Press up to edit queued messages, Enter to send them immediately'].join('\n')
  : r.stalledWake === 'landed'
    ? [String(r.screen), ...wrapRows(r.prompt, 76).map((row, i) => (i === 0 ? '❯ ' : '  ') + row), '✻ Pondering… (2s · ↓ 12 tokens)', ...CLAUDE_CHROME].join('\n')
    : String(r.screen);
const verb = argv.slice(0, 2).join(' ');
// STARCI_FAKE_ORCA_HOST='runtime_unavailable' (or state.hostDown): Orca is not
// running - every call, agent-context included, answers the observed refusal
// with an empty stderr and exit 1. STARCI_FAKE_ORCA_HOST_DOWN_CALLS=<n>: only
// the first n calls do (an Orca app restarting, then back); state.hostDownServed
// counts them. The terminals themselves are untouched: the daemon kept them.
const hostDownCalls = Number(process.env.STARCI_FAKE_ORCA_HOST_DOWN_CALLS || 0);
const hostDown = (process.env.STARCI_FAKE_ORCA_HOST || state.hostDown || '') === 'runtime_unavailable'
  || (hostDownCalls > 0 && (state.hostDownServed || 0) < hostDownCalls);
if (hostDown) {
  state.hostDownServed = (state.hostDownServed || 0) + 1; save();
  fail({ ok: false, error: { code: 'runtime_unavailable', message: 'Could not read Orca runtime metadata at C:\\Users\\fake\\AppData\\Roaming\\orca\\orca-runtime.json. Start the Orca app first.' } });
}
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
    ...(state.counter <= bootExits ? { bootExit: true } : {}),
    title: paneTitle, tabTitle: arg('title'), worktree: arg('worktree'), closed: false,
    ...(menuGates[menuGate] ? { gate: { kind: menuGate, cursor: 0, cleared: false }, gateKeys: [] } : {}) } };
  save();
  if (timedOut) fail({ ok: false, error: { code: 'runtime_error', message: 'Timed out waiting for terminal handle after creation' } });
  out({ ok: true, result: { terminal: { handle, title: arg('title'), connected: true, writable: true } } });
}
else if (verb === 'terminal read' && record(arg('terminal'))?.bootExit && !isDead(arg('terminal')))
  out({ ok: true, result: { terminal: { handle: arg('terminal'), connected: true, writable: true, screen: BOOT_EXIT(arg('terminal')) } } });
else if (verb === 'terminal read' && bootScreen === 'claude-hint' && commandProvider(arg('terminal')) === 'claude' && !hasSent(arg('terminal')) && !isDead(arg('terminal')))
  out({ ok: true, result: { terminal: { handle: arg('terminal'), connected: true, writable: true, screen: CLAUDE_HINT(arg('terminal')) } } });
else if (verb === 'terminal read' && record(arg('terminal'))?.gate && !record(arg('terminal')).gate.cleared && !isDead(arg('terminal')))
  out({ ok: true, result: { terminal: { handle: arg('terminal'), connected: true, writable: true, screen: MENU(record(arg('terminal'))) } } });
else if (verb === 'terminal read' && gatedProviderOf(arg('terminal')))
  out({ ok: true, result: { terminal: { handle: arg('terminal'), connected: true, writable: true,
    screen: gateScreens[gatedProviderOf(arg('terminal'))] } } });
else if (verb === 'terminal read' && !isDead(arg('terminal')) && typeof record(arg('terminal'))?.screen === 'string')
  out({ ok: true, result: { terminal: { handle: arg('terminal'), connected: true, writable: true, screen: SCREEN_OF(record(arg('terminal'))),
    // terminals[h].draft: the text Orca lifts out of the agent's input box (never in the screen).
    ...(typeof record(arg('terminal')).draft === 'string' && record(arg('terminal')).draft ? { draft: record(arg('terminal')).draft } : {}) } } });
else if (verb === 'terminal read')
  isDead(arg('terminal'))
    ? fail({ ok: false, error: { code: 'terminal_gone', message: 'terminal is not connected' } })
    : out({ ok: true, result: { terminal: { handle: arg('terminal'), connected: true, writable: true,
      screen: mode === 'auth' ? DEAD(arg('terminal')) : mode === 'quota' ? QUOTA(arg('terminal')) : (record(arg('terminal'))?.staged ? STAGED(arg('terminal'))
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
else if (verb === 'terminal send' && record(arg('terminal')) && (record(arg('terminal')).draftMode || typeof record(arg('terminal')).draft === 'string')) {
  // An input box Orca reads as 'draft' (terminals[h].draft, or draftMode set): text sent without
  // Enter is typed onto the draft; Enter submits the whole draft (terminals[h].submitted) and the
  // agent echoes it and starts a turn; draftMode 'drop-enter' loses the Enter of a text+Enter send
  // (the nivo collab Kernel, 2026-09-25). Ctrl+U deletes the draft's last row - unless draftStuck.
  // A quit command with Enter over an empty box ends the agent; over a draft it is only more text.
  const r = record(arg('terminal')), text = arg('text') ?? '', enter = argv.includes('--enter');
  r.keys = [...(r.keys || []), { text, enter }];
  if (text === '\u0015') {
    if (!r.draftStuck) { const rows = String(r.draft || '').split('\n'); rows.pop(); r.draft = rows.join('\n'); }
  } else if (['/exit', '/quit'].includes(text) && enter && !r.draft) {
    r.quit = text; r.connected = false; r.writable = false;
    state.quits = [...(state.quits || []), { handle: arg('terminal'), text }];
  } else {
    if (text) r.draft = String(r.draft || '') + text;
    if (enter && !(text && r.draftMode === 'drop-enter') && r.draft) {
      r.submitted = [...(r.submitted || []), r.draft];
      r.screen = [String(r.screen ?? ''), ...wrapRows(r.draft.replace(/\s+/g, ' '), 76).map((row, i) => (i === 0 ? '❯ ' : '  ') + row),
        '✻ Pondering… (2s · ↓ 12 tokens)', ...CLAUDE_CHROME].join('\n');
      r.sent = true; r.prompt = r.draft; r.draft = '';
    }
  }
  state.sends += 1; save();
  out({ ok: true, result: { sent: true } });
}
else if (verb === 'terminal send' && ((['/exit', '/quit'].includes(arg('text') ?? '') && argv.includes('--enter')) || arg('text') === '\u0003\u0003')) {
  // An agent CLI's own quit input ends its process: the terminal disconnects.
  // Claude's is a double Ctrl+C with no Enter (scripts/kernel/quit-agent.mjs).
  const r = record(arg('terminal'));
  if (r) { r.quit = arg('text'); r.connected = false; r.writable = false; }
  state.quits = [...(state.quits || []), { handle: arg('terminal'), text: arg('text') }];
  save(); out({ ok: true, result: { sent: true } });
}
else if (verb === 'terminal send' && dropEnterSend && (arg('text') ?? '')) {
  // STARCI_FAKE_ORCA_DROP_ENTER_SEND: text+Enter is accepted and lost; a
  // --no-enter send stages the text unless the knob is 'all'.
  const r = record(arg('terminal'));
  if (r && !argv.includes('--enter') && dropEnterSend !== 'all') { r.prompt = arg('text'); r.dropStaged = true; r.staged = true; }
  else state.droppedSends = (state.droppedSends || 0) + 1;
  state.sends += 1; save();
  out({ ok: true, result: { sent: true } });
}
else if (verb === 'terminal send') {
  const r = record(arg('terminal'));
  const text = arg('text') ?? '';
  // terminals[h].shellAfterSend = '<prompt>': the agent under the frame is dead and a
  // host shell reads the input - the text lands after that prompt (wrapped at 80
  // columns) and PowerShell answers a ParserError (nivo term_8f9e0611, 2026-09-24).
  if (r && text && typeof r.shellAfterSend === 'string') {
    const line = r.shellAfterSend + ' ' + text;
    const wrapped = []; for (let i = 0; i < line.length; i += 80) wrapped.push(line.slice(i, i + 80));
    r.screen = [String(r.screen ?? ''), ...wrapped, 'At line:1 char:366', 'Missing statement body in do loop.',
      '    + CategoryInfo          : ParserError: (:) [], ParentContainsErrorRecordException',
      '    + FullyQualifiedErrorId : MissingLoopStatement', r.shellAfterSend].join('\n');
    r.shellRan = [...(r.shellRan || []), text];
  }
  else if (r && text) { r.sent = true; r.prompt = text; if (stuckPaste) r.staged = true; }
  else if (r && !text && argv.includes('--enter')) {
    r.enters = (r.enters || 0) + 1;
    if (stuckPaste === 'enter' || stuckPaste === 'inline-enter' || stuckPaste === 'blocked') r.staged = false;
    if (r.dropStaged) { r.dropStaged = false; r.dropSubmitted = true; r.staged = false; r.sent = true; }
    if (!r.sent) r.sent = true;
  }
  state.sends += 1; save();
  // STARCI_FAKE_ORCA_STUCK_PASTE=blocked: Orca types the text but refuses the
  // Enter that came with it (agent_prompt_blocked); an Enter-only send submits.
  if (stuckPaste === 'blocked' && text && argv.includes('--enter')) fail({ ok: false, error: { code: 'agent_prompt_blocked', message: 'agent_prompt_blocked' } });
  if (sendStalled && text && argv.includes('--enter')) {
    if (r) { r.stalledWake = sendStalled; save(); }
    fail({ ok: false, error: { code: 'agent_prompt_stalled', message: 'agent_prompt_stalled' } });
  }
  out({ ok: true, result: { sent: true } });
}
else if (verb === 'terminal close') {
  const handle = arg('terminal');
  if (closeFails.has('*') || closeFails.has(handle))
    fail({ ok: false, error: { code: 'terminal_close_refused', message: 'terminal is held by the host' } });
  const r = record(handle);
  if (r) { r.closed = true; r.connected = false; r.writable = false; }
  state.closed = [...(state.closed || []), handle];
  if (argv.includes('--tab')) state.closedTabs = [...(state.closedTabs || []), handle];
  save();
  out({ ok: true, result: { closed: handle } });
}
// terminal list is the listing scripts/checks/check-orca-tree.mjs reads:
// every terminal this stub created and has not closed.
else if (verb === 'terminal list') {
  const open = Object.values(state.terminals || {}).filter(t => !t.closed);
  out({ ok: true, result: { terminals: open
    .map(t => ({ handle: t.handle, title: t.title ?? null, worktree: t.worktree ?? null, worktreePath: t.worktree ?? null, tabId: t.tabId ?? 'tab-' + t.handle,
      agentIdentity: t.agentIdentity ?? null, connected: t.connected !== false, writable: t.writable !== false })),
    ...(argv.includes('--include-visual-layouts') ? { visualLayouts: [{ worktreeId: 'fake-worktree', root: { type: 'group',
      tabs: open.map(t => ({ tabId: 'tab-' + t.handle, title: t.tabTitle ?? t.title ?? null,
        panes: { type: 'terminal', handle: t.handle, tabId: 'tab-' + t.handle, title: t.title ?? null, connected: t.connected !== false } })) } }] } : {}) } });
}
// A record marked stale:true is a handle a live Orca no longer knows (every
// terminal after a host reboot): show answers the typed terminal_handle_stale.
else if (verb === 'terminal show' && record(arg('terminal'))?.stale === true)
  fail({ ok: false, error: { code: 'terminal_handle_stale', message: 'terminal_handle_stale' } });
else if (verb === 'terminal show')
  isDead(arg('terminal'))
    ? out({ ok: true, result: { terminal: { handle: arg('terminal'), status: 'exited', connected: false, writable: false, lastOutputAt: null } } })
    : out({ ok: true, result: { terminal: { handle: arg('terminal'), status: 'running', connected: true, writable: true, lastOutputAt: record(arg('terminal'))?.lastOutputAt ?? Date.now() } } });
else if (verb === 'terminal rename')
  out({ ok: true, result: { terminal: { handle: arg('terminal'), title: arg('title') } } });
// ---- orchestration verbs (managed-agent lifecycle) ----
// Runs are stateful: state.runs[id] = {id, coordinator, objective, lost?}. run-create binds
// --from as coordinator, run-use re-binds it, and task-create/task-update from any other
// terminal are refused the way a live Orca refused every restarted Kernel after the
// 2026-09-24 reboot: JSON error on stdout, empty stderr, exit 1. A Run marked lost:true
// answers run_not_found. A Run the state does not hold keeps the old permissive answers.
else if (verb === 'orchestration run-create') {
  if (mode === 'run-create-error')
    fail({ ok: false, error: { code: 'run_context_missing', message: 'No launcher context is bound' } });
  state.runs = state.runs || {};
  const id = 'run-fake-' + (Object.keys(state.runs).length + 1);
  state.runs[id] = { id, coordinator: arg('from'), objective: arg('objective') };
  save();
  out({ ok: true, result: { run: { id, objective: arg('objective'), coordinator_handle: arg('from') } } });
}
else if ((verb === 'orchestration run-use' || verb === 'orchestration run-show') && state.runs?.[arg('id')]?.lost)
  fail({ ok: false, error: { code: 'run_not_found', message: 'Run ' + arg('id') + ' was not found.' } });
else if (verb === 'orchestration run-use') {
  state.runs = state.runs || {};
  state.runs[arg('id')] = { ...(state.runs[arg('id')] || { id: arg('id') }), coordinator: arg('from') };
  state.runUses = [...(state.runUses || []), { id: arg('id'), from: arg('from') }];
  save();
  out({ ok: true, result: { run: { id: arg('id'), coordinator_handle: arg('from') } } });
}
else if (verb === 'orchestration run-show')
  out({ ok: true, result: { run: { id: arg('id'), coordinator_handle: state.runs?.[arg('id')]?.coordinator ?? null } } });
else if (verb === 'orchestration run-list')
  out({ ok: true, result: { runs: Object.values(state.runs || {}).map(r => ({ id: r.id, objective: r.objective ?? null, coordinator_handle: r.coordinator ?? null })) } });
else if ((verb === 'orchestration task-create' || verb === 'orchestration task-update') && state.runs?.[arg('run')]?.lost)
  fail({ ok: false, error: { code: 'run_not_found', message: 'Run ' + arg('run') + ' was not found.' } });
else if ((verb === 'orchestration task-create' || verb === 'orchestration task-update') && state.runs?.[arg('run')]
  && state.runs[arg('run')].coordinator !== arg('from'))
  fail({ ok: false, error: { code: 'not_run_coordinator', message: 'Terminal ' + arg('from') + ' is not the coordinator of run ' + arg('run') + '.' } });
else if (verb === 'orchestration task-create' && arg('parent') != null && !/^task[_-]/.test(arg('parent')))
  fail({ ok: false, error: { code: 'invalid_parent', message: '--parent takes a task id' } });
else if (verb === 'orchestration task-create')
  out({ ok: true, result: { task: { id: 'task-fake-1', display_name: arg('display-name'), run: arg('run') } } });
else if (verb === 'orchestration task-update' && !['pending', 'ready', 'dispatched', 'completed', 'failed', 'blocked'].includes(arg('status')))
  fail({ ok: false, error: { code: 'invalid_argument', message: 'invalid status ' + arg('status') + ', expected one of: pending, ready, dispatched, completed, failed, blocked' } });
else if (verb === 'orchestration task-update') {
  // state.tasks[runId] = [{id, status, task_title, display_name}] seeds task-list; an update closes the row.
  const rows = state.tasks?.[arg('run')];
  const row = Array.isArray(rows) ? rows.find(t => t.id === arg('id')) : null;
  if (row) { row.status = arg('status'); }
  state.taskUpdates = [...(state.taskUpdates || []), { id: arg('id'), status: arg('status'), run: arg('run'), from: arg('from') }];
  save();
  out({ ok: true, result: { task: { id: arg('id') } } });
}
else if (verb === 'orchestration task-list')
  out({ ok: true, result: { runId: arg('run'), tasks: (state.tasks?.[arg('run')] || []).filter(t => !arg('status') || t.status === arg('status')) } });
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
  out({ ok: true, result: { dispatch: { id: arg('to') ?? 'dispatch-fake-1' }, preamble: process.env.STARCI_FAKE_ORCA_PREAMBLE || 'fake dispatch preamble' } });
else if (verb === 'orchestration dispatch-show')
  out({ ok: true, result: { dispatch: { id: 'dispatch-fake-1', assignee_handle: 'fake-terminal-1' } } });
else if (verb === 'orchestration check')
  out({ ok: true, result: { deliveries: [] } });
else if (verb === 'orchestration send')
  out({ ok: true, result: { sent: true } });
// state.messages seeds the orchestration inbox (newest first, Orca's row shape);
// a reply is recorded in state.replies and threaded onto the inbox like Orca does.
else if (verb === 'orchestration inbox')
  out({ ok: true, result: { messages: (state.messages || []).slice(0, Number(arg('limit')) || undefined), count: (state.messages || []).length } });
else if (verb === 'orchestration reply') {
  if (process.env.STARCI_FAKE_ORCA_REPLY_FAILS === '1')
    fail({ ok: false, error: { code: 'message_not_found', message: 'no such question' } });
  const question = (state.messages || []).find(m => m.id === arg('id'));
  state.replies = [...(state.replies || []), { id: arg('id'), body: arg('body'), run: arg('run') }];
  state.messages = [{ id: 'msg_reply_' + state.replies.length, run_id: question?.run_id ?? arg('run'), from_handle: 'run:' + (question?.run_id ?? arg('run')),
    to_handle: question?.from_handle ?? null, subject: 'Re: Question', body: arg('body'), type: 'status', thread_id: arg('id'), payload: null,
    read: 0, created_at: new Date().toISOString() }, ...(state.messages || [])];
  save();
  out({ ok: true, result: { message: { id: 'msg_reply_' + state.replies.length, thread_id: arg('id') } } });
}
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
// A command that does not exist: spawning it fails with ENOENT, the answer a
// caller got while an Orca auto-update was replacing orca.exe.
export const MISSING_ORCA_COMMAND = path.join(REPO_ROOT, 'tests', 'fixtures', 'no-such-orca', 'orca.exe');
