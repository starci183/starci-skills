// scripts/agent/lib.mjs — semantic agent lifecycle over the Orca API layer.
// Provider differences are DATA (modules/models/agents/<name>.yaml); this
// module is the only mechanism. Callers pass --agent and get the card's
// command prefix (credential refresh, env strip), command requirements
// (--yolo, --permission-mode dangerous, …) and readiness/submission patterns
// injected automatically — forgetting a bypass flag is structurally
// impossible because no caller ever assembles a provider command by hand.
//
//   spawnAgent({provider, model, effort, worktree, title, prompt|promptFile, kernel})
//     → create terminal → awaitReadiness → send → awaitSubmission
//     → awaitAttestation (bounded death-watch: provider activity AND absence
//       of known-failure signatures) → receipt. A submitted prompt is NOT a
//       live agent — a terminal can die on an auth failure after submission
//       while the job is still marked running.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../engine/yaml.mjs';
import { terminalCreate } from '../api/orca/terminal-create.mjs';
import { terminalSend } from '../api/orca/terminal-send.mjs';
import { terminalRead } from '../api/orca/terminal-read.mjs';
import { terminalShow } from '../api/orca/terminal-show.mjs';
import { terminalClose } from '../api/orca/terminal-close.mjs';
import { closeOperationTerminal } from '../kernel/close-op-terminal.mjs';
import { terminalList } from '../api/orca/terminal-list.mjs';
import { sleepSync } from '../api/orca/lib.mjs';
import { classifyAgentScreen, gateRemedy, stagedInputRegion, DEFAULT_STAGED_PATTERN, exitedAgentPromptRow, shellPromptPrefix } from '../kernel/terminal-liveness.mjs';
import { ensureLaunchTrust } from './trust.mjs';

const skillRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');

export function loadAdapter(provider) {
  const file = path.join(skillRoot, 'modules', 'models', 'agents', `${provider}.yaml`);
  if (!fs.existsSync(file)) return { provider, error: `no adapter card modules/models/agents/${provider}.yaml` };
  try {
    return { provider, card: parseYaml(fs.readFileSync(file, 'utf8')), file: `modules/models/agents/${provider}.yaml` };
  } catch (e) {
    return { provider, error: `adapter card ${provider}.yaml unparsable: ${e.message}` };
  }
}

// Build the terminal command for a provider. Composition:
//   env + hostIdentity.env                                 ← launch env, Orca tab identity (qwen CLI_TITLE)
//   + credentialRefresh[plat] + commandPrefix[plat]        ← card-owned env prep (ACP strip, stale-key unset)
//   + hostLaunchPrefix[plat]                               ← keeps the launch on Orca's runtime-owned PTY path
//   + explicit `command` (e.g. a model profile's launch.orca.command carrying model+tuning flags)
//     AND any missing card requirements (kernel → kernelCommandRequirements)
//   OR the card's own body plus those requirements
//     or terminalFallback.command + bypassFlag for native-managed agents.
// A terminalFallback may additionally declare modelArgs/effortArgs/bypassArgs.
// Those arrays are the only source of provider-specific CLI flags; placeholder
// values are shell-quoted before they enter Orca's command string.
// Requirements ALWAYS come from the card — that is where --yolo/dangerous lives.
const shellQuote = (value) => {
  const text = String(value);
  return process.platform === 'win32'
    ? `'${text.replaceAll("'", "''")}'`
    : `'${text.replaceAll("'", `'"'"'`)}'`;
};

const renderArgs = (args, values) => {
  if (!Array.isArray(args)) return [];
  return args.map((arg) => {
    const raw = String(arg);
    const exact = raw.match(/^<(model|effort)>$/);
    if (exact) return shellQuote(values[exact[1]]);
    let rendered = raw;
    for (const [name, value] of Object.entries(values))
      rendered = rendered.replaceAll(`<${name}>`, String(value));
    return rendered === raw ? raw : shellQuote(rendered);
  });
};

// `env` sets variables inside the terminal's own shell before the agent
// starts (PowerShell on win32, POSIX sh elsewhere): the op launch carries
// STARCI_ROLE=op and STARCI_OP_JOB=<job>, which scripts/kernel/api.mjs reads to
// refuse kernel-only verbs from an op (inc-360891316369). Keys are
// [A-Z_][A-Z0-9_]*; values are single-quoted and may not hold a quote.
export const envPrefix = (env = {}, plat = process.platform === 'win32' ? 'win32' : 'posix') => Object.entries(env ?? {})
  .filter(([key, value]) => /^[A-Z_][A-Z0-9_]*$/.test(key) && value != null && !/['\r\n]/.test(String(value)))
  .map(([key, value]) => (plat === 'win32' ? `$env:${key}='${value}';` : `export ${key}='${value}';`)).join(' ');
// `cwd` is the directory the agent starts in when it is not the Orca worktree
// the terminal is created on: Orca's terminal create has no cwd flag, and a
// checkout Orca does not manage (the Supervisor's staging worktrees) gets an
// orphaned terminal no project in the sidebar shows. The terminal is created
// on the project's registered worktree and its shell changes directory first;
// a failed change stops the whole line, so the agent never starts elsewhere.
export const cwdCommand = (dir, plat = process.platform === 'win32' ? 'win32' : 'posix') => {
  if (typeof dir !== 'string' || !dir.trim() || /['"\r\n]/.test(dir)) return null;
  return plat === 'win32' ? `Set-Location -LiteralPath '${dir}' -ErrorAction Stop;` : `cd '${dir}' || exit 1;`;
};
// A card's credentialRefresh step for one platform, with `<secrets-file>`
// replaced by the absolute path of credentialRefresh.secretsFile under this
// runtime root. The step reads the secret from that file inside the terminal's
// own shell, so no value ever enters the command, a receipt or a log.
export function credentialRefreshCommand(card, plat = process.platform === 'win32' ? 'win32' : 'posix') {
  const step = card?.credentialRefresh?.[plat];
  if (typeof step !== 'string' || !step.trim()) return null;
  if (!step.includes('<secrets-file>')) return step;
  const rel = card?.credentialRefresh?.secretsFile;
  if (typeof rel !== 'string' || !rel.trim() || path.isAbsolute(rel) || rel.split(/[\\/]/).includes('..')) return null;
  const file = path.join(skillRoot, rel).replace(/\\/g, '/');
  if (/['\r\n]/.test(file)) return null;
  return step.replaceAll('<secrets-file>', file);
}
// A card's hostIdentity.env: variables that let Orca recognise the agent in
// its tab (logo + working spinner). Orca names a pane's agent from agent hooks,
// the foreground process, or the pane title; an agent whose process is a bare
// `node` and that has no Orca hook (Qwen Code) is only recognisable by title.
// `<label>` renders to the op job id when the launch carries STARCI_OP_JOB,
// otherwise to the card's agent name.
export function hostIdentityEnv(card, env = null) {
  const vars = card?.hostIdentity?.env;
  if (!vars || typeof vars !== 'object' || Array.isArray(vars)) return {};
  const label = String(env?.STARCI_OP_JOB || card?.agent || 'agent');
  return Object.fromEntries(Object.entries(vars).map(([key, value]) => [key, String(value).replaceAll('<label>', label)]));
}
// `pathPrefix` is a directory put FIRST on the agent's PATH inside the same
// shell: the op launch puts the shared-checkout guard shims there (git, npm:
// scripts/guards/install.mjs guardLaunch), so the worker's `git` is the guard.
export const pathPrefixCommand = (dir, plat = process.platform === 'win32' ? 'win32' : 'posix') => {
  if (typeof dir !== 'string' || !dir.trim() || /['"\r\n]/.test(dir)) return null;
  return plat === 'win32' ? `$env:PATH='${dir};'+$env:PATH;` : `export PATH='${dir}':"$PATH";`;
};
export function buildSpawnCommand({ provider, kernel = false, command = null, model = null, effort = null, env = null, pathPrefix = null, cwd = null } = {}) {
  const { card, error } = loadAdapter(provider);
  if (error) return { provider, error };
  const plat = process.platform === 'win32' ? 'win32' : 'posix';
  const cd = cwd == null ? null : cwdCommand(cwd, plat);
  if (cwd != null && !cd) return { provider, error: `launch cwd cannot be rendered into a shell command: ${cwd}` };
  // 'none' is in the config effort vocabulary (engine/config.mjs) and means
  // "no effort pin" — normalize it away before any card asks for effortArgs.
  if (effort === 'none') effort = null;
  // hostLaunchPrefix: Orca's CLI sends a command whose first word is `codex`
  // or `claude` down its renderer-backed tab path, which waits at most 10s
  // for the UI to publish a handle and otherwise answers "Timed out waiting
  // for terminal handle after creation" while the tab still spawns later,
  // untracked. A leading shell call operator runs the same binary on the
  // runtime-owned PTY path qwen and devin already use (agent card reason).
  const prefix = [envPrefix(env, plat), pathPrefixCommand(pathPrefix, plat), envPrefix(hostIdentityEnv(card, env), plat), credentialRefreshCommand(card, plat), card?.commandPrefix?.[plat], card?.hostLaunchPrefix?.[plat]]
    .filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim()).join(' ');
  const requirementList = (kernel && Array.isArray(card?.kernelCommandRequirements)
    ? card.kernelCommandRequirements
    : (Array.isArray(card?.commandRequirements) ? card.commandRequirements : [])).map(String);
  const reqs = requirementList.join(' ');
  const tf = card?.terminalFallback;
  // Native-managed agents still use this terminal fallback for the long-lived
  // Kernel and for any explicitly requested command-terminal lane. Their
  // unattended flags therefore apply to explicit profile commands too; an
  // override may choose model/tuning, never permission interactivity.
  const fallbackBypassArgs = Array.isArray(tf?.bypassArgs)
    ? tf.bypassArgs.map(String)
    : [String(tf?.bypassFlag ?? '').match(/^(--?\S+)/)?.[1] ?? ''].filter(Boolean);
  const explicit = typeof command === 'string' && command.trim() ? command.trim() : null;
  let body = explicit;
  if (body) {
    const missing = requirementList.filter((requirement) => !body.includes(requirement));
    const missingBypass = fallbackBypassArgs.length > 0
      && !fallbackBypassArgs.every((requirement) => body.includes(requirement))
      ? fallbackBypassArgs
      : [];
    body = [body, ...missing, ...missingBypass].filter(Boolean).join(' ');
  }
  if (!body && typeof tf?.command === 'string' && tf.command.trim()) {
    if (model && !Array.isArray(tf.modelArgs))
      return { provider, error: `adapter card ${provider}.yaml cannot pin model '${model}' (terminalFallback.modelArgs missing)` };
    if (effort && !Array.isArray(tf.effortArgs))
      return { provider, error: `adapter card ${provider}.yaml cannot pin effort '${effort}' (terminalFallback.effortArgs missing)` };
    const modelArgs = model ? renderArgs(tf.modelArgs, { model, effort }) : [];
    const effortArgs = effort ? renderArgs(tf.effortArgs, { model, effort }) : [];
    // bypassArgs is canonical. bypassFlag remains a compatibility seam for
    // older installed cards and deliberately keeps only its first CLI token.
    body = [tf.command.trim(), reqs, ...modelArgs, ...effortArgs, ...fallbackBypassArgs].filter(Boolean).join(' ');
  } else if (!body && (prefix || reqs)) {
    body = [card?.agent ?? provider, reqs].filter(Boolean).join(' ');
  }
  if (!body) return { provider, error: `adapter card ${provider}.yaml yields no command (no command, no terminalFallback)` };
  return { provider, command: [cd, prefix, body].filter(Boolean).join(' '), commandSource: `modules/models/agents/${provider}.yaml`, adapter: card,
    model: model ?? null, effort: effort ?? null };
}

const regexp = (source, fallback) => {
  try { return new RegExp(source || fallback, 'i'); } catch { return new RegExp(fallback, 'i'); }
};

// knownFailures[].signal entries are prose-shaped patterns; compile them as
// regex first and fall back to an escaped literal so a card can never crash
// the watcher.
const signalRegexp = (source) => {
  try { return new RegExp(source, 'i'); }
  catch { return new RegExp(String(source).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'); }
};

// A bare '401' matched any number or id holding those digits (a job id '...-false-401-...' in the echoed launch
// line, an epoch, a token count) and the product's own "mapped to 401" in a pasted Task; each tripped a 24 h auth
// circuit (nivo inc-7d452a3329ba, mia-mia inc-10f0777e39c1). 401 counts only as a word next to an auth word or
// an HTTP/status/error prefix.
const GENERIC_FAILURE = [
  '\\b401\\b[^\\n]{0,60}\\b(?:unauthori[sz]ed|authentication|not authenticated|invalid[^\\n]{0,20}(?:key|token|credential))',
  '\\b(?:HTTP|status(?: code)?|error|code)\\W{0,3}401\\b',
  'Invalid API-key', 'not authenticated', 'authentication failed',
  'OAuth[^\\n]*(?:expired|invalid|rejected)', 'token[^\\n]*(?:expired|invalid|rejected)', 'agent child exited',
].join('|');

const failureMatchers = (adapter) => {
  const spec = adapter?.attestation && typeof adapter.attestation === 'object' ? adapter.attestation : {};
  return [
    { signal: 'generic', re: regexp(spec.failurePattern, GENERIC_FAILURE) },
    ...(Array.isArray(adapter?.knownFailures) ? adapter.knownFailures : [])
      .map((f) => f?.signal).filter((s) => typeof s === 'string' && s.trim())
      .map((signal) => ({ signal, re: signalRegexp(signal) })),
  ];
};
// The runtime's own delivered text (the launch command, the pasted Task) is never failure evidence: a screen line
// that is a fragment of it is dropped before matching. Terminal wrapping cuts a delivered line into fragments, so a
// line counts when its whitespace-collapsed text (12+ chars) is a substring of the delivered text.
const squash = (text) => String(text ?? '').replace(/\s+/g, ' ').trim();
const withoutDelivered = (screen, delivered) => {
  const own = squash(Array.isArray(delivered) ? delivered.filter(Boolean).join('\n') : delivered);
  if (!own) return screen ?? '';
  return String(screen ?? '').split(/\r?\n/).filter((line) => {
    const text = squash(line).replace(/^[>❯›│|]\s*/u, '');
    return text.length < 12 || !own.includes(text);
  }).join('\n');
};
export const failureOnScreen = (adapter, screen, delivered = null) => {
  const judged = withoutDelivered(screen, delivered);
  for (const failure of failureMatchers(adapter)) {
    const match = failure.re.exec(judged);
    if (match) return {
      signal: failure.signal === 'generic' ? `generic failure signature '${match[0]}'` : failure.signal,
      matched: match[0],
    };
  }
  return null;
};

// ---- launch-gate auto-answer ----------------------------------------------
// Owner instruction 2026-09-23: the runtime, never the owner, approves the
// launch prompts of the directories it launches agents in. Pre-trust
// (scripts/agent/trust.mjs) keeps those prompts from appearing; when one still
// appears, a gate the agent card allowlists (gateAutoAnswer.gates) is answered
// ONCE from the screen: the cursor is walked to the card's `select` option with
// arrow keys and Enter is pressed, each key a raw terminal-send. Anything not
// on the allowlist (login, usage limit, an unknown menu) is refused as before,
// with no keystroke. A gate that is still there after settleMs is refused too.
const KEYS = { down: '\x1b[B', up: '\x1b[A', enter: '\r' };
const GATE_CURSOR = /^\s*[❯›▶>]\s*\S/u;
const MAX_GATE_MOVES = 6;

export function gateAutoAnswerRule(adapter, gate) {
  const spec = adapter?.gateAutoAnswer;
  const rule = spec?.gates?.[gate];
  if (!rule || typeof rule.select !== 'string' || !rule.select.trim()) return null;
  return { select: rule.select, delayMs: Math.max(0, Number(rule.delayMs ?? spec.delayMs) || 0),
    settleMs: Math.max(1000, Number(rule.settleMs ?? spec.settleMs) || 6000) };
}

/** Where the menu cursor sits relative to the option labelled `label`, or null. */
export function gateMenuPosition(screen, label) {
  const rows = String(screen ?? '').split(/\r?\n/).slice(-40).map((line) => line.replace(/^\s*[│┃]\s?/u, ''));
  const want = String(label).toLowerCase();
  let target = -1;
  for (let i = rows.length - 1; i >= 0; i -= 1) if (rows[i].toLowerCase().includes(want)) { target = i; break; }
  if (target < 0) return null;
  let cursor = -1;
  for (let d = 0; d <= 8 && cursor < 0; d += 1)
    for (const i of [target - d, target + d]) if (i >= 0 && i < rows.length && GATE_CURSOR.test(rows[i])) { cursor = i; break; }
  if (cursor < 0) return null;
  return { onTarget: cursor === target, direction: Math.sign(target - cursor) };
}

function answerGate(handle, rule, screen) {
  const keys = [];
  const press = (name) => { terminalSend({ terminal: handle, text: KEYS[name] ?? name, enter: false }); keys.push(name); };
  // Claude's accessible confirm renders "Enter y/n:" instead of a menu.
  if (/enter y\/n:/i.test(screen ?? '')) { press('y'); press('enter'); return { answered: true, keystroke: keys.join(',') }; }
  let current = screen;
  for (let moves = 0; ; moves += 1) {
    const at = gateMenuPosition(current, rule.select);
    if (!at) return { answered: false, keystroke: keys.join(','), reason: `option '${rule.select}' with a menu cursor is not on screen` };
    if (at.onTarget) { press('enter'); return { answered: true, keystroke: keys.join(',') }; }
    if (moves >= MAX_GATE_MOVES) return { answered: false, keystroke: keys.join(','), reason: `cursor did not reach '${rule.select}' in ${MAX_GATE_MOVES} moves` };
    press(at.direction > 0 ? 'down' : 'up');
    sleepSync(300);
    current = terminalRead({ terminal: handle }).screen ?? '';
  }
}

// The prompt glyph alone on its row - or followed by the placeholder hint an
// empty input box shows. Claude Code 2.1.x prints `❯ Try "write a test for
// <filepath>"` in a fresh box: the bare-glyph pattern never matched it and
// three nivo kernel boots (wf-nivo-fe-debt, 2026-09-24) timed out at readiness
// while each sat ready at its prompt from its 6th second. A menu cursor with
// an option label (`❯ 1. Dark mode`) is still not a prompt. Claude separates the
// glyph from the hint with a NO-BREAK SPACE (U+00A0), not a space: the second
// launch after the first fix still timed out on exactly that byte.
export const DEFAULT_READY_PATTERN = String.raw`(?:Ask|Message|Type your message|Enter a prompt|(^|\n)[ \t\u00a0]*[>❯❭](?:[ \t\u00a0]+Try "[^\n]*)?[ \t\u00a0]*(\r?\n|$))`;

// The tail of a terminal frame, kept on a failed launch so its cause is
// visible after the terminal is gone: the last `rows` non-empty rows, capped.
export function lastOutputOf(screen, { rows = 30, chars = 3000 } = {}) {
  const text = String(screen ?? '').split(/\r?\n/).map((row) => row.replace(/\s+$/u, '')).filter((row) => row.trim()).slice(-rows).join('\n');
  return text.length > chars ? text.slice(-chars) : text;
}

// Host CPU times for a busy-share reading (os.loadavg() is all zeros on
// Windows). Null when unreadable.
export function cpuSample() {
  try {
    let idle = 0, total = 0;
    for (const cpu of os.cpus()) { const t = cpu.times; idle += t.idle; total += t.user + t.nice + t.sys + t.idle + t.irq; }
    return total > 0 ? { idle, total } : null;
  } catch { return null; }
}
const busyShare = (from, to) => (from && to && to.total > from.total ? Math.min(1, Math.max(0, 1 - (to.idle - from.idle) / (to.total - from.total))) : null);

// An agent frame row (never a shell prompt row): its input glyph, banner or footer.
const AGENT_FRAME_ROW = /^\s*[›❯❭](?:\s|$)|Claude Code|OpenAI Codex|\bQwen\b|\bDevin\b|bypass permissions|esc to (?:interrupt|cancel)/iu;
const AGENT_LAUNCH_ROW = /^\s*(?:&\s*|command\s+)?["']?[\w:\\/.~-]*?\b(?:claude|codex|qwen|devin)(?:\.exe|\.cmd|\.ps1)?["']?(?:\s|$)/i;
const screenRows = (screen) => String(screen ?? '').split(/\r?\n/).map((row) => row.trim()).filter(Boolean);
// The frame ends in a bare shell prompt: the launched agent command returned.
function bareShellPrompt(screen) {
  const last = screenRows(screen).at(-1);
  if (!last) return null;
  const prefix = shellPromptPrefix(last);
  return prefix && !last.slice(prefix.length).trim() ? last : null;
}

// Card-driven readiness: screen must show the provider's prompt pattern
// (and identity when declared) before anything is sent.
//
// The window is wall-clock. spec.timeoutMs (default 120000) is the base. With
// `adaptive` (the Kernel boot) it stretches with host load - by the CPU busy
// share measured over the wait and by Orca's read latency, up to
// spec.maxLoadFactor (default 2) - and past that deadline it keeps waiting
// while the terminal is alive and still printing (its frame changed within
// spec.quietMs, default 30000), up to spec.maxTimeoutMs (default 360000).
// A launch fails early only on a real exit: Orca reports the terminal exited
// or disconnected, or its frame ends in a bare shell prompt on two reads after
// the agent drew its frame or the launch line was echoed.
// Every failure carries failureKind, transient and lastOutput:
//   agent-exited             the agent or its terminal is gone (transient)
//   readiness-stalled        alive, frame unchanged, window spent (transient)
//   readiness-still-starting alive and still printing at the hard cap:
//                            stillStarting - the caller must not close it
//   interactive-gate, failure-signature: never transient.
// `onWait({step, elapsedMs})` is called on every poll (the Kernel boot renews
// its startup reservation from it). `io` {read, sleep, now, cpu} is the
// Orca/clock seam the specs fake.
export function awaitReadiness(handle, adapter, { cwd = null, delivered = null, adaptive = false, onWait = null, io = null } = {}) {
  const readTerminal = io?.read ?? ((h) => terminalRead({ terminal: h }));
  const sleep = io?.sleep ?? sleepSync;
  const now = io?.now ?? (() => Date.now());
  const cpu = io?.cpu ?? cpuSample;
  const spec = adapter?.readiness && typeof adapter.readiness === 'object' ? adapter.readiness : {};
  // A bare prompt glyph on its own line, wherever that line sits: Claude Code
  // 2.1.280 draws a rule and a status row BELOW its `❯` prompt, so the former
  // end-of-screen anchor never matched and every Claude kernel timed out at
  // readiness while it sat ready at its prompt.
  const ready = regexp(spec.screenPattern, DEFAULT_READY_PATTERN);
  const identity = spec.identityPattern ? regexp(spec.identityPattern, spec.identityPattern) : null;
  const baseMs = Number(spec.timeoutMs) || 120000;
  const intervalMs = Math.max(250, Number(spec.intervalMs) || 1000);
  const maxMs = adaptive ? Math.max(baseMs, Number(spec.maxTimeoutMs) || 360000) : baseMs;
  const quietMs = Math.max(intervalMs, Number(spec.quietMs) || 30000);
  const maxLoadFactor = adaptive ? Math.max(1, Number(spec.maxLoadFactor) || 2) : 1;
  const start = now();
  const cpuStart = adaptive ? cpu() : null;
  let screen = '', lastScreen = '', seen = false, lastChangeAt = start, readMsTotal = 0, reads = 0;
  let agentSeen = false, launchSeen = false, shellPromptReads = 0, loadFactor = 1, busy = null;
  const gateAnswers = [];
  const settle = (state) => {
    for (const a of gateAnswers) if (a.answered) a.cleared = state?.gate !== a.gate;
    return gateAnswers.length ? { gateAnswers } : {};
  };
  const waited = () => ({ waitedMs: now() - start, loadFactor: Math.round(loadFactor * 100) / 100,
    ...(busy != null ? { cpuBusy: Math.round(busy * 100) / 100 } : {}), ...(reads ? { readMs: Math.round(readMsTotal / reads) } : {}) });
  const failed = (failureKind, transient, reason, extra = {}) => ({ ok: false, failureKind, transient, reason, screen,
    lastOutput: lastOutputOf(screen || lastScreen), ...waited(), ...extra, ...settle(null) });
  for (;;) {
    const readAt = now();
    const read = readTerminal(handle);
    readMsTotal += now() - readAt; reads += 1;
    screen = read.screen ?? '';
    const t = read.terminal ?? {};
    // A real exit: Orca says the terminal exited or disconnected.
    if (t.status === 'exited' || t.connected === false || (!read.ok && /terminal_gone|not connected|exited/i.test(String(read.error ?? '')))) {
      const cause = t.exitCause ? (typeof t.exitCause === 'string' ? t.exitCause : (t.exitCause.kind ?? t.exitCause.reason ?? JSON.stringify(t.exitCause))) : null;
      return failed('agent-exited', true, `agent exited before readiness: terminal ${t.status === 'exited' ? 'exited' : 'disconnected'}${cause ? ` (${cause})` : ''}`);
    }
    if (read.ok) {
      // ... or the frame fell back to a bare shell prompt after the agent drew
      // its frame (or its launch line was echoed), on two reads in a row.
      const rows = screenRows(screen);
      if (rows.some((row) => !shellPromptPrefix(row) && AGENT_FRAME_ROW.test(row))) agentSeen = true;
      if (rows.some((row) => { const p = shellPromptPrefix(row); return p && AGENT_LAUNCH_ROW.test(row.slice(p.length)); })) launchSeen = true;
      // A bare prompt before either is the shell the launch has not reached yet.
      const shellRow = (agentSeen || launchSeen) ? (exitedAgentPromptRow(screen) ?? bareShellPrompt(screen)) : null;
      shellPromptReads = shellRow ? shellPromptReads + 1 : 0;
      if (shellPromptReads >= 2) return failed('agent-exited', true, `agent exited before readiness: the frame ends in a bare shell prompt ('${shellRow.slice(0, 80)}')`);
      if (seen && screen !== lastScreen) lastChangeAt = now();
      seen = true;
      lastScreen = screen;
    }
    const failure = failureOnScreen(adapter, screen, delivered);
    if (read.ok && failure) return { ...failed('failure-signature', false, `terminal rejected readiness: ${failure.signal}`), ...failure };
    // A screen waiting on an answer never turns ready by itself. An
    // allowlisted launch gate is answered once by the runtime; any other gate
    // (or one that persists) fails at once and names the gate.
    const screenState = read.ok ? classifyAgentScreen(screen) : null;
    if (screenState?.state === 'interactive-gate') {
      const gate = screenState.gate;
      const rule = gateAutoAnswerRule(adapter, gate);
      const prior = gateAnswers.find((a) => a.gate === gate);
      if (rule && !prior) {
        if (rule.delayMs) {
          // Claude refuses keys for a moment after a dialog opens.
          sleep(rule.delayMs);
          screen = readTerminal(handle).screen ?? screen;
        }
        const answer = answerGate(handle, rule, screen);
        gateAnswers.push({ gate, keystroke: answer.keystroke, answered: answer.answered, at: now(), settleMs: rule.settleMs,
          ...(answer.reason ? { reason: answer.reason } : {}) });
        if (answer.answered) { sleep(intervalMs); continue; }
      } else if (rule && prior?.answered && now() - prior.at < prior.settleMs) {
        sleep(intervalMs);
        continue;
      }
      const remedy = gateRemedy(gate, { cwd });
      const tried = gateAnswers.find((a) => a.gate === gate);
      const why = !rule ? "is not on the agent card's gateAutoAnswer allowlist and needs the owner's answer"
        : tried?.answered ? `persisted after the runtime answered it (${tried.keystroke})`
          : `could not be auto-answered (${tried?.reason ?? 'no answer'})`;
      return { ok: false, failureKind: 'interactive-gate', transient: false, state: 'interactive-gate', signal: 'interactive-gate', gate, remedy,
        reason: `terminal is blocked on interactive gate '${gate}' — it ${why}${remedy ? ` — to clear it once: ${remedy}` : ''}`, screen,
        lastOutput: lastOutputOf(screen), ...waited(), ...settle(screenState) };
    }
    if (read.ok && ready.test(screen) && (!identity || identity.test(screen))) return { ok: true, screen, ...waited(), ...settle(screenState) };
    const at = now();
    const elapsed = at - start;
    if (adaptive) {
      // Host load stretches the base window: the CPU busy share over the wait
      // (70% busy = x1, 100% = x2) and Orca's read latency (1s nominal).
      busy = busyShare(cpuStart, cpu());
      const byCpu = busy == null ? 1 : 1 + Math.max(0, busy - 0.7) / 0.3;
      const byReads = reads ? 1 + Math.max(0, readMsTotal / reads - 1000) / 2000 : 1;
      loadFactor = Math.min(maxLoadFactor, Math.max(1, byCpu, byReads, loadFactor));
    }
    const deadline = Math.min(maxMs, baseMs * loadFactor);
    const printing = at - lastChangeAt < quietMs;
    const window = `window ${Math.round(deadline)}ms, load x${Math.round(loadFactor * 100) / 100}`;
    if (elapsed >= maxMs && adaptive && printing)
      return failed('readiness-still-starting', false, `terminal readiness timeout after ${elapsed}ms: the terminal is alive and still printing at the ${maxMs}ms cap (${window}); it was left open`, { stillStarting: true });
    if (elapsed >= maxMs || (elapsed >= deadline && !(adaptive && printing)))
      return failed('readiness-stalled', true, `terminal readiness timeout after ${elapsed}ms (${window}): no prompt, frame unchanged for ${at - lastChangeAt}ms`);
    if (typeof onWait === 'function') { try { onWait({ step: 'readiness', elapsedMs: elapsed }); } catch { /* a heartbeat never fails the launch */ } }
    sleep(intervalMs);
  }
}

const modelPattern = (model) => {
  const escaped = String(model).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[^A-Za-z0-9._:-])${escaped}(?=$|[^A-Za-z0-9._:-])`, 'i');
};

// A CLI flag is intent, not proof. Kernel boot accepts a pinned model only
// after the provider TUI renders that exact model id on the terminal screen.
function awaitModelAttestation(handle, expectedModel, adapter, initialScreen = '', delivered = null) {
  if (!expectedModel) return { ok: true, screen: initialScreen, model: null };
  const spec = adapter?.modelAttestation && typeof adapter.modelAttestation === 'object' ? adapter.modelAttestation : {};
  // 'launch-flag': the provider TUI never renders the model id on screen, so
  // a screen regex can never attest it. The composed launch command pins the
  // model and the CLI exits before the readiness prompt on an unknown id, so
  // reaching this point (readiness passed) is the attestation.
  if (spec.mode === 'launch-flag')
    return { ok: true, screen: initialScreen ?? '', model: expectedModel, mode: 'launch-flag' };
  const timeoutMs = Number(spec.timeoutMs) || 15000;
  const intervalMs = Math.max(250, Number(spec.intervalMs) || 1000);
  // A TUI that renders the model's display name instead of its id (Claude
  // Code shows "Opus 5.5 with high effort" for claude-opus-5-5) declares that
  // name per id in the card's modelAttestation.displayNames.
  const displayName = spec.displayNames?.[expectedModel] ?? null;
  const byId = modelPattern(expectedModel);
  const byName = displayName ? modelPattern(displayName) : null;
  const expected = { test: (text) => byId.test(text) || Boolean(byName?.test(text)) };
  let screen = initialScreen ?? '';
  for (let elapsed = 0; elapsed <= timeoutMs; elapsed += intervalMs) {
    const failure = failureOnScreen(adapter, screen, delivered);
    if (failure) return { ok: false, screen, reason: `terminal rejected model attestation: ${failure.signal}`, ...failure };
    if (expected.test(screen)) return { ok: true, screen, model: expectedModel };
    if (elapsed >= timeoutMs) break;
    sleepSync(intervalMs);
    const read = terminalRead({ terminal: handle });
    screen = read.screen ?? '';
    if (!read.ok || read.terminal?.connected === false)
      return { ok: false, screen, reason: `terminal became ${read.terminal?.connected === false ? 'disconnected' : 'unreadable'} before model attestation` };
  }
  return { ok: false, screen, reason: `terminal did not render expected model '${expectedModel}' within ${timeoutMs}ms` };
}

// Card-driven submission: the prompt is consumed when the provider shows
// activity; re-enter while it still shows a staged/idle prompt.
// A paste still sitting in the input row (stagedInputRow) with no activity on
// screen is NOT started work: it gets exactly one Enter of its own, then
// must leave the input row within stuckGraceMs or the submission is refused
// with signal 'prompt-stuck' — the caller closes the terminal.
// `sentText` is the exact text deliverPrompt typed. A card whose TUI shows an
// inline paste verbatim (Devin) has no "[Pasted Content]" marker, and the
// contract text itself says "Running"/"Working"/"tokens": read against the
// whole screen that looked like activity and a paste that never left the
// input box passed as submitted (inc-06aeecf432f1). With the sent text the
// input region is found and only the rows above it can prove work began.
export function awaitSubmission(handle, adapter, { sentText = null, onWait = null } = {}) {
  const spec = adapter?.submission && typeof adapter.submission === 'object' ? adapter.submission : {};
  const activity = regexp(spec.activityPattern, 'Thinking|Working|Running|esc to (?:cancel|interrupt)|tokens');
  let staged = DEFAULT_STAGED_PATTERN;
  if (typeof spec.stagedPattern === 'string' && spec.stagedPattern.trim())
    staged = regexp(`${DEFAULT_STAGED_PATTERN.source}|${spec.stagedPattern}`, DEFAULT_STAGED_PATTERN.source);
  const input = regexp(adapter?.readiness?.screenPattern, '(?:Ask|Message|Type your message|Enter a prompt|(^|\\n)\\s*[>❯❭])');
  const timeoutMs = Number(spec.timeoutMs) || 45000;
  const settleMs = Math.max(250, Number(spec.settleMs) || 1000);
  const maxEnter = Math.max(1, Number(spec.maxEnter) || 2);
  const stuckGraceMs = Math.max(settleMs, Number(spec.stuckGraceMs) || 5000);
  let enters = 1, screen = '', stuckEnterAt = null;
  for (let elapsed = 0; elapsed <= timeoutMs; elapsed += settleMs) {
    if (elapsed > 0) {
      if (typeof onWait === 'function') { try { onWait({ step: 'submission', elapsedMs: elapsed }); } catch { /* a heartbeat never fails the launch */ } }
      sleepSync(settleMs);
    }
    const read = terminalRead({ terminal: handle });
    screen = read.screen;
    const failure = failureOnScreen(adapter, screen, sentText);
    if (read.ok && failure) return { ok: false, failureKind: 'failure-signature', transient: false, reason: `prompt submission rejected: ${failure.signal}`, screen, lastOutput: lastOutputOf(screen), enters, ...failure };
    // Work that has begun wins: a staged-looking row under a live spinner is
    // transcript or a queued follow-up, never a stuck first prompt. Activity
    // counts only ABOVE the staged input region - the paste's own words are
    // not a spinner.
    const region = read.ok ? stagedInputRegion(screen, { stagedPattern: staged, sentText }) : null;
    const begun = read.ok && activity.test(region ? region.above.join('\n') : screen);
    const stuckRow = region && !begun ? region.row : null;
    if (stuckRow) {
      if (stuckEnterAt === null) {
        terminalSend({ terminal: handle, text: '', enter: true });
        enters += 1;
        stuckEnterAt = elapsed;
      } else if (elapsed - stuckEnterAt >= stuckGraceMs) {
        return { ok: false, failureKind: 'prompt-stuck', transient: true, signal: 'prompt-stuck', stuckRow, screen, lastOutput: lastOutputOf(screen), enters,
          reason: `dispatch paste stayed in the input box ('${stuckRow.slice(0, 80)}') ${elapsed - stuckEnterAt}ms after one extra Enter` };
      }
      continue;
    }
    if (begun) return { ok: true, screen, enters, ...(stuckEnterAt !== null ? { unstuckByEnter: true } : {}) };
    if (read.ok && enters < maxEnter && (staged.test(screen) || input.test(screen))) {
      terminalSend({ terminal: handle, text: '', enter: true });
      enters += 1;
    }
  }
  return { ok: false, failureKind: 'submission-not-consumed', transient: true, reason: `prompt was not consumed within ${timeoutMs}ms`, screen, lastOutput: lastOutputOf(screen), enters };
}

// Post-submission attestation — submission proves the prompt was consumed, not
// that the agent stays alive; a terminal can still die on auth failure while
// its job shows running. For a bounded window (attestation.timeoutMs, default
// ~20s, card-overridable) the screen is watched for the card's
// knownFailures[].signal patterns PLUS generic auth/crash markers; the first
// signature rejects. A dead or unreadable terminal rejects too.
// Idle-without-failure is NOT a rejection — providers pause between turns;
// submission already proved the prompt was consumed.
export function awaitAttestation(handle, adapter, { delivered = null } = {}) {
  const spec = adapter?.attestation && typeof adapter.attestation === 'object' ? adapter.attestation : {};
  const timeoutMs = Number(spec.timeoutMs) || 20000;
  const intervalMs = Math.max(250, Number(spec.intervalMs) || 1000);
  const activity = regexp(spec.activityPattern ?? adapter?.submission?.activityPattern,
    'Thinking|Working|Running|esc to (?:cancel|interrupt)|tokens');
  let screen = '', activitySeen = false;
  for (let elapsed = 0; elapsed <= timeoutMs; elapsed += intervalMs) {
    if (elapsed > 0) sleepSync(intervalMs);
    const read = terminalRead({ terminal: handle });
    screen = read.screen ?? '';
    if (!read.ok || read.terminal?.connected === false) {
      return {
        ok: false, screen, activitySeen,
        signal: `terminal ${read.terminal?.connected === false ? 'disconnected' : 'unreadable'} during attestation: ${read.error ?? read.terminal?.exitCause ?? 'no receipt'}`,
      };
    }
    const failure = failureOnScreen(adapter, screen, delivered);
    if (failure) return { ok: false, screen, activitySeen, ...failure };
    if (activity.test(screen)) activitySeen = true;
  }
  return { ok: true, screen, activitySeen };
}

// Delivery per card: file-reference-above-inline-limit writes the prompt to a
// file and sends the card's @file prompt template — multi-kilobyte inline
// paste is a known provider crash. The artifact dir defaults to a fresh OS
// temp dir (dispatch artifacts must NOT persist under the worktree's
// .starciwork tree); the card's delivery.fileDirectory stays an
// explicit override (relative resolves under the worktree). The returned
// artifact is deleted by cleanupDeliveryArtifact once submission is attested.
export function deliverPrompt({ handle, adapter, prompt, worktree, dispatchId = 'prompt' }) {
  const d = adapter?.delivery ?? {};
  const limit = Number(d.maxInlineChars) || 0;
  // worktree may be an Orca selector ('active') rather than a filesystem path —
  // file-reference delivery only applies when it resolves to a real directory.
  if (d.mode === 'file-reference-above-inline-limit' && limit && prompt.length > limit && worktree && fs.existsSync(worktree)) {
    const transient = !(typeof d.fileDirectory === 'string' && d.fileDirectory.trim());
    const dir = transient
      ? fs.mkdtempSync(path.join(os.tmpdir(), 'starci-dispatch-'))
      : (path.isAbsolute(d.fileDirectory) ? d.fileDirectory : path.join(worktree, d.fileDirectory));
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, (d.fileName ?? 'orca-dispatch-<dispatch>.md').replace('<dispatch>', dispatchId));
    fs.writeFileSync(file, prompt);
    const sendText = (d.prompt ?? 'Read <file> completely and follow it exactly.')
      .replace('<file>', file.replaceAll('\\', '/'));
    const send = sendLanded(terminalSend({ terminal: handle, text: sendText, enter: true }));
    return { ...send, sentText: sendText, artifact: { file, dir, transient } };
  }
  // sentText is what the terminal was given: awaitSubmission and the api's
  // liveness reads find an unsubmitted paste by it (inc-06aeecf432f1).
  return { ...sendLanded(terminalSend({ terminal: handle, text: prompt, enter: true })), sentText: prompt };
}

// agent_prompt_stalled: Orca typed the text but could not see it submitted
// (calls.yaml terminal-send). That is not a failed send — awaitSubmission
// proves or refuses delivery from the screen.
const sendLanded = (send) => (!send.ok && send.errorCode === 'agent_prompt_stalled'
  ? { ...send, ok: true, stalled: true }
  : send);

// Remove a file-reference delivery artifact. Transient artifacts take their
// private tmpdir with them; a card-declared directory is only emptied of the
// file itself. Best-effort — a leftover temp file never fails the caller.
export function cleanupDeliveryArtifact(artifact) {
  if (!artifact?.file) return { ok: true, removed: false };
  try { fs.rmSync(artifact.file, { force: true }); } catch { /* best-effort */ }
  if (artifact.transient && artifact.dir) {
    try { fs.rmSync(artifact.dir, { recursive: true, force: true }); } catch { /* best-effort */ }
  }
  return { ok: true, removed: true };
}

// ---- create reconciliation ------------------------------------------------
// `terminal create` can fail AFTER Orca made the tab (effectUnknown): the
// renderer-backed path answers "Timed out waiting for terminal handle after
// creation" and the tab still spawns its command. The runtime never leaves
// such a terminal untracked: it lists the worktree, finds the terminals that
// did not exist before this create and carry this create's exact tab title,
// adopts one live match and closes every other match. The tab title is the
// marker because a provider TUI rewrites the pane title (Codex writes the cwd
// name) while the tab keeps --title. The receipt lands in createRecovery on
// the spawn result, and callers write it into their dispatch/kernel events.
const CREATE_RECOVERY_MS = 8000;
const CREATE_RECOVERY_INTERVAL_MS = 1000;

// handle → tab title, from terminal list --include-visual-layouts.
function tabTitles(visualLayouts) {
  const titles = new Map();
  const pending = [];
  const walk = (node, tabTitle) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { for (const item of node) walk(item, tabTitle); return; }
    const title = typeof node.tabId === 'string' && 'panes' in node && typeof node.title === 'string' ? node.title : tabTitle;
    if (node.type === 'terminal') {
      if (typeof node.handle === 'string' && node.handle) titles.set(node.handle, title ?? null);
      else if (title) pending.push({ tabId: node.tabId ?? null, title });
    }
    for (const value of Object.values(node)) if (value && typeof value === 'object') walk(value, title);
  };
  walk(visualLayouts, null);
  return { titles, pending };
}

function listWorktree(worktree) {
  try {
    const listed = terminalList({ worktree, includeVisualLayouts: true });
    if (!listed.ok) return null;
    const { titles, pending } = tabTitles(listed.visualLayouts);
    return {
      terminals: (listed.terminals ?? []).filter((t) => typeof t?.handle === 'string')
        .map((t) => ({ handle: t.handle, title: t.title ?? null, tabTitle: titles.get(t.handle) ?? null,
          connected: t.connected !== false, writable: t.writable !== false })),
      pending,
    };
  } catch { return null; }
}

/** Handles that exist in `worktree` before a create, or null when unreadable. */
export function terminalSnapshot(worktree) {
  const listing = listWorktree(worktree);
  return listing ? new Set(listing.terminals.map((t) => t.handle)) : null;
}

export function recoverCreatedTerminal({ worktree, title, before = null, error = null,
  timeoutMs = CREATE_RECOVERY_MS, intervalMs = CREATE_RECOVERY_INTERVAL_MS } = {}) {
  const receipt = { cause: error ?? null, title, adopted: null, closed: [], pendingTabs: [], listed: false,
    beforeKnown: before instanceof Set };
  let matches = [];
  for (let elapsed = 0; ; elapsed += intervalMs) {
    const listing = listWorktree(worktree);
    if (listing) {
      receipt.listed = true;
      matches = listing.terminals.filter((t) => (!before || !before.has(t.handle)) && (t.tabTitle === title || t.title === title));
      receipt.pendingTabs = listing.pending.filter((p) => p.title === title);
      if (matches.length) break;
    }
    if (elapsed >= timeoutMs) break;
    sleepSync(intervalMs);
  }
  // Without a before-snapshot a title match may be an older terminal this
  // create did not make: it is reported, never adopted or closed.
  if (!(before instanceof Set)) {
    receipt.unowned = matches.map((t) => t.handle);
    receipt.action = matches.length ? 'unowned-matches' : 'not-found';
    return receipt;
  }
  const live = matches.find((t) => t.connected && t.writable) ?? null;
  for (const t of matches) {
    if (t === live) continue;
    let closed;
    try { closed = terminalClose({ terminal: t.handle }); } catch (e) { closed = { ok: false, error: String(e?.message ?? e) }; }
    receipt.closed.push({ handle: t.handle, ok: closed?.ok === true,
      ...(closed?.error ? { error: typeof closed.error === 'string' ? closed.error : JSON.stringify(closed.error) } : {}) });
  }
  receipt.adopted = live?.handle ?? null;
  receipt.action = live ? 'adopted' : (receipt.closed.length ? 'closed' : (receipt.pendingTabs.length ? 'pending-tab' : 'not-found'));
  return receipt;
}

// Full spawn pipeline. Every failure closes the terminal and returns a typed
// step so callers can persist an incident instead of leaking terminals.
// Every failure also carries lastOutput (the tail of the terminal's last frame,
// read before the close when the step had none) and, where the step knows it,
// failureKind and transient (awaitReadiness / awaitSubmission).
// `readiness` {adaptive} stretches the readiness window with host load and
// while the terminal is still printing (the Kernel boot); `onWait` is called on
// every readiness and submission poll. With `keepStartingTerminal`, a terminal
// readiness gave up on while it was still printing (stillStarting) is NOT
// closed: it is reported as terminalLeftOpen for the caller to account for.
// `attest` (default true) adds the post-submission death-watch; a rejection
// comes back as {ok:false, step:'attestation', signal} with the terminal
// already closed — the caller must never mark the job running on it.
// `worktree` is the Orca worktree the terminal is created on (and listed by);
// `cwd`, when set, is the directory the agent runs in (cwdCommand).
export function spawnAgent({ provider, model = null, effort = null, worktree, cwd = null, title, prompt = null, promptFile = null, command = null, kernel = false, dispatchId, attest = true, env = null, pathPrefix = null, readiness = null, onWait = null, keepStartingTerminal = false } = {}) {
  const launchDir = cwd ?? worktree;
  const built = buildSpawnCommand({ provider, kernel, command, model, effort, env, pathPrefix, cwd: cwd && cwd !== worktree ? cwd : null });
  if (built.error) return { ok: false, step: 'command', error: built.error, provider };
  // Pre-trust the launch directory (trust.mjs) so the agent opens at its
  // input box, not at a trust/consent prompt; the receipt joins every result.
  let trust = null;
  try { trust = ensureLaunchTrust({ agent: provider, cwd: launchDir }); }
  catch (e) { trust = { agent: provider, paths: [], status: 'failed', errors: [{ error: String(e?.message ?? e) }] }; }
  let gateAnswers = null;
  const before = terminalSnapshot(worktree);
  const create = terminalCreate({ worktree, title, command: built.command });
  // A handle-less create whose effect is unknown is reconciled before it is
  // called a failure: adopt the terminal it made, or close it.
  const createRecovery = !create.handle && create.effectUnknown
    ? recoverCreatedTerminal({ worktree, title, before, error: create.error })
    : null;
  const handle = create.handle ?? createRecovery?.adopted ?? null;
  let artifact = null;
  const fail = (step, error, signal = null, extra = {}) => {
    cleanupDeliveryArtifact(artifact);
    let terminalClosed = null;
    let terminalLeftOpen = null;
    let lastOutput = typeof extra.lastOutput === 'string' && extra.lastOutput ? extra.lastOutput
      : (extra.screen ? lastOutputOf(extra.screen) : null);
    if (handle && !lastOutput) {
      // The cause must outlive the terminal: its last frame is read before the close.
      try { lastOutput = lastOutputOf(terminalRead({ terminal: handle }).screen); } catch { /* best-effort */ }
    }
    if (handle && keepStartingTerminal && extra.stillStarting === true) {
      terminalLeftOpen = { handle, reason: 'still-starting: the terminal was alive and printing when readiness gave up' };
    } else if (handle) {
      let closed;
      // With its tab when the tab is its own, so Orca cannot resume the refused
      // agent under a new handle (scripts/kernel/close-op-terminal.mjs).
      try { closed = closeOperationTerminal(handle); } catch (e) { closed = { ok: false, error: String(e?.message ?? e) }; }
      terminalClosed = { handle, ok: closed?.ok === true,
        ...(closed?.error ? { error: typeof closed.error === 'string' ? closed.error : JSON.stringify(closed.error) } : {}) };
    }
    return { ok: false, step, error, ...(signal ? { signal } : {}), ...extra, lastOutput: lastOutput ?? '', terminal: handle, provider, command: built.command,
      ...(terminalClosed ? { terminalClosed } : {}), ...(terminalLeftOpen ? { terminalLeftOpen } : {}), ...(createRecovery ? { createRecovery } : {}),
      ...(trust ? { trust } : {}), ...(gateAnswers ? { gateAnswers } : {}) };
  };
  if (!handle) return fail('create', create.error || 'no terminal handle', null, create.errorCode ? { errorCode: create.errorCode } : {});
  const ready = awaitReadiness(handle, built.adapter, { cwd: launchDir, delivered: built.command, adaptive: readiness?.adaptive === true, onWait,
    io: readiness?.io ?? null });
  gateAnswers = ready.gateAnswers ?? null;
  const waitFacts = { waitedMs: ready.waitedMs ?? null, loadFactor: ready.loadFactor ?? 1,
    ...(ready.cpuBusy != null ? { cpuBusy: ready.cpuBusy } : {}), ...(ready.readMs != null ? { readMs: ready.readMs } : {}) };
  if (!ready.ok) return fail('readiness', ready.reason, ready.signal ?? null,
    { screen: ready.screen, lastOutput: ready.lastOutput, matched: ready.matched, failureKind: ready.failureKind ?? null,
      transient: ready.transient === true, readiness: waitFacts, ...(ready.stillStarting ? { stillStarting: true } : {}),
      ...(ready.gate ? { state: ready.state, gate: ready.gate, remedy: ready.remedy ?? null } : {}) });
  const modelAttested = awaitModelAttestation(handle, model, built.adapter, ready.screen, built.command);
  if (!modelAttested.ok) return fail('model-attestation', modelAttested.reason, modelAttested.signal ?? null,
    { requestedModel: model, screen: modelAttested.screen, matched: modelAttested.matched, failureKind: 'model-attestation', transient: false });
  const text = promptFile ? fs.readFileSync(promptFile, 'utf8') : prompt;
  if (text != null) {
    const send = deliverPrompt({ handle, adapter: built.adapter, prompt: text, worktree: launchDir, dispatchId });
    artifact = send.artifact ?? null;
    if (!send.ok) return fail('send', send.error || 'send failed');
    const submitted = awaitSubmission(handle, built.adapter, { sentText: send.sentText ?? text, onWait });
    if (!submitted.ok) return fail('submission', submitted.reason, submitted.signal ?? null,
      { screen: submitted.screen, lastOutput: submitted.lastOutput, matched: submitted.matched,
        failureKind: submitted.failureKind ?? null, transient: submitted.transient === true });
    if (attest) {
      const attested = awaitAttestation(handle, built.adapter, { delivered: [built.command, send.sentText ?? text] });
      if (!attested.ok) return fail('attestation', `attestation rejected: ${attested.signal}`, attested.signal,
        { lastOutput: lastOutputOf(attested.screen), failureKind: 'attestation', transient: false });
    }
    // Attested — the dispatch artifact has been consumed; it must not live on.
    cleanupDeliveryArtifact(artifact);
    artifact = null;
  }
  return { ok: true, terminal: handle, provider, model: model ?? null, effort: effort ?? null,
    modelAttested: modelAttested.model, command: built.command, commandSource: built.commandSource, readiness: waitFacts,
    ...(createRecovery ? { createRecovery } : {}), ...(trust ? { trust } : {}), ...(gateAnswers ? { gateAnswers } : {}) };
}

// Health: terminal identity is the proof — connected + writable, with the
// caller's own freshness check on top via terminalRead.
export function agentHealth(handle) {
  const shown = terminalShow({ terminal: handle });
  return {
    live: shown.ok && shown.connected && shown.writable,
    connected: shown.connected, writable: shown.writable,
    reason: shown.ok ? (shown.connected ? 'terminal connected' : (shown.exitCause ?? 'terminal disconnected')) : (shown.error ?? 'show failed'),
    terminal: shown.terminal,
  };
}
