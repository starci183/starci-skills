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
import { sleep } from '../api/orca/lib.mjs';

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
//   credentialRefresh[plat] + commandPrefix[plat]          ← card-owned env prep (ACP strip, stale-key unset)
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

export function buildSpawnCommand({ provider, kernel = false, command = null, model = null, effort = null } = {}) {
  const { card, error } = loadAdapter(provider);
  if (error) return { provider, error };
  // 'none' is in the config effort vocabulary (engine/config.mjs) and means
  // "no effort pin" — normalize it away before any card asks for effortArgs.
  if (effort === 'none') effort = null;
  const plat = process.platform === 'win32' ? 'win32' : 'posix';
  const prefix = [card?.credentialRefresh?.[plat], card?.commandPrefix?.[plat]]
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
  return { provider, command: [prefix, body].filter(Boolean).join(' '), commandSource: `modules/models/agents/${provider}.yaml`, adapter: card,
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

const failureMatchers = (adapter) => {
  const spec = adapter?.attestation && typeof adapter.attestation === 'object' ? adapter.attestation : {};
  return [
    { signal: 'generic', re: regexp(spec.failurePattern, '401|Invalid API-key|not authenticated|authentication failed|OAuth[^\\n]*(?:expired|invalid|rejected)|token[^\\n]*(?:expired|invalid|rejected)|agent child exited') },
    ...(Array.isArray(adapter?.knownFailures) ? adapter.knownFailures : [])
      .map((f) => f?.signal).filter((s) => typeof s === 'string' && s.trim())
      .map((signal) => ({ signal, re: signalRegexp(signal) })),
  ];
};
const failureOnScreen = (adapter, screen) => {
  for (const failure of failureMatchers(adapter)) {
    const match = failure.re.exec(screen ?? '');
    if (match) return {
      signal: failure.signal === 'generic' ? `generic failure signature '${match[0]}'` : failure.signal,
      matched: match[0],
    };
  }
  return null;
};

// Card-driven readiness: screen must show the provider's prompt pattern
// (and identity when declared) before anything is sent.
function awaitReadiness(handle, adapter) {
  const spec = adapter?.readiness && typeof adapter.readiness === 'object' ? adapter.readiness : {};
  const ready = regexp(spec.screenPattern, '(?:Ask|Message|Type your message|Enter a prompt|(^|\\n)\\s*[>❯❭]\\s*$)');
  const identity = spec.identityPattern ? regexp(spec.identityPattern, spec.identityPattern) : null;
  const timeoutMs = Number(spec.timeoutMs) || 120000;
  const intervalMs = Math.max(250, Number(spec.intervalMs) || 1000);
  let screen = '';
  for (let elapsed = 0; elapsed <= timeoutMs; elapsed += intervalMs) {
    const read = terminalRead({ terminal: handle });
    screen = read.screen;
    const failure = failureOnScreen(adapter, screen);
    if (read.ok && failure) return { ok: false, reason: `terminal rejected readiness: ${failure.signal}`, screen, ...failure };
    if (read.ok && ready.test(screen) && (!identity || identity.test(screen))) return { ok: true, screen };
    if (elapsed < timeoutMs) sleep(intervalMs);
  }
  return { ok: false, reason: `terminal readiness timeout after ${timeoutMs}ms`, screen };
}

const modelPattern = (model) => {
  const escaped = String(model).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[^A-Za-z0-9._:-])${escaped}(?=$|[^A-Za-z0-9._:-])`, 'i');
};

// A CLI flag is intent, not proof. Kernel boot accepts a pinned model only
// after the provider TUI renders that exact model id on the terminal screen.
function awaitModelAttestation(handle, expectedModel, adapter, initialScreen = '') {
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
  const expected = modelPattern(expectedModel);
  let screen = initialScreen ?? '';
  for (let elapsed = 0; elapsed <= timeoutMs; elapsed += intervalMs) {
    const failure = failureOnScreen(adapter, screen);
    if (failure) return { ok: false, screen, reason: `terminal rejected model attestation: ${failure.signal}`, ...failure };
    if (expected.test(screen)) return { ok: true, screen, model: expectedModel };
    if (elapsed >= timeoutMs) break;
    sleep(intervalMs);
    const read = terminalRead({ terminal: handle });
    screen = read.screen ?? '';
    if (!read.ok || read.terminal?.connected === false)
      return { ok: false, screen, reason: `terminal became ${read.terminal?.connected === false ? 'disconnected' : 'unreadable'} before model attestation` };
  }
  return { ok: false, screen, reason: `terminal did not render expected model '${expectedModel}' within ${timeoutMs}ms` };
}

// Card-driven submission: the prompt is consumed when the provider shows
// activity; re-enter while it still shows a staged/idle prompt.
export function awaitSubmission(handle, adapter) {
  const spec = adapter?.submission && typeof adapter.submission === 'object' ? adapter.submission : {};
  const activity = regexp(spec.activityPattern, 'Thinking|Working|Running|esc to (?:cancel|interrupt)|tokens');
  const staged = regexp(spec.stagedPattern, 'Pasted Content|<file>|orca-dispatch-');
  const input = regexp(adapter?.readiness?.screenPattern, '(?:Ask|Message|Type your message|Enter a prompt|(^|\\n)\\s*[>❯❭])');
  const timeoutMs = Number(spec.timeoutMs) || 45000;
  const settleMs = Math.max(250, Number(spec.settleMs) || 1000);
  const maxEnter = Math.max(1, Number(spec.maxEnter) || 2);
  let enters = 1, screen = '';
  for (let elapsed = 0; elapsed <= timeoutMs; elapsed += settleMs) {
    if (elapsed > 0) sleep(settleMs);
    const read = terminalRead({ terminal: handle });
    screen = read.screen;
    const failure = failureOnScreen(adapter, screen);
    if (read.ok && failure) return { ok: false, reason: `prompt submission rejected: ${failure.signal}`, screen, enters, ...failure };
    if (read.ok && activity.test(screen)) return { ok: true, screen, enters };
    if (read.ok && enters < maxEnter && (staged.test(screen) || input.test(screen))) {
      terminalSend({ terminal: handle, text: '', enter: true });
      enters += 1;
    }
  }
  return { ok: false, reason: `prompt was not consumed within ${timeoutMs}ms`, screen, enters };
}

// Post-submission attestation — submission proves the prompt was consumed, not
// that the agent stays alive; a terminal can still die on auth failure while
// its job shows running. For a bounded window (attestation.timeoutMs, default
// ~20s, card-overridable) the screen is watched for the card's
// knownFailures[].signal patterns PLUS generic auth/crash markers; the first
// signature rejects. A dead or unreadable terminal rejects too.
// Idle-without-failure is NOT a rejection — providers pause between turns;
// submission already proved the prompt was consumed.
export function awaitAttestation(handle, adapter) {
  const spec = adapter?.attestation && typeof adapter.attestation === 'object' ? adapter.attestation : {};
  const timeoutMs = Number(spec.timeoutMs) || 20000;
  const intervalMs = Math.max(250, Number(spec.intervalMs) || 1000);
  const activity = regexp(spec.activityPattern ?? adapter?.submission?.activityPattern,
    'Thinking|Working|Running|esc to (?:cancel|interrupt)|tokens');
  let screen = '', activitySeen = false;
  for (let elapsed = 0; elapsed <= timeoutMs; elapsed += intervalMs) {
    if (elapsed > 0) sleep(intervalMs);
    const read = terminalRead({ terminal: handle });
    screen = read.screen ?? '';
    if (!read.ok || read.terminal?.connected === false) {
      return {
        ok: false, screen, activitySeen,
        signal: `terminal ${read.terminal?.connected === false ? 'disconnected' : 'unreadable'} during attestation: ${read.error ?? read.terminal?.exitCause ?? 'no receipt'}`,
      };
    }
    const failure = failureOnScreen(adapter, screen);
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
    const send = terminalSend({ terminal: handle, text: sendText, enter: true });
    return { ...send, artifact: { file, dir, transient } };
  }
  return terminalSend({ terminal: handle, text: prompt, enter: true });
}

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

// Full spawn pipeline. Every failure closes the terminal and returns a typed
// step so callers can persist an incident instead of leaking terminals.
// `attest` (default true) adds the post-submission death-watch; a rejection
// comes back as {ok:false, step:'attestation', signal} with the terminal
// already closed — the caller must never mark the job running on it.
export function spawnAgent({ provider, model = null, effort = null, worktree, title, prompt = null, promptFile = null, command = null, kernel = false, dispatchId, attest = true } = {}) {
  const built = buildSpawnCommand({ provider, kernel, command, model, effort });
  if (built.error) return { ok: false, step: 'command', error: built.error, provider };
  const create = terminalCreate({ worktree, title, command: built.command });
  const handle = create.handle;
  let artifact = null;
  const fail = (step, error, signal = null, extra = {}) => {
    cleanupDeliveryArtifact(artifact);
    if (handle) terminalClose({ terminal: handle });
    return { ok: false, step, error, ...(signal ? { signal } : {}), ...extra, terminal: handle, provider, command: built.command };
  };
  if (!handle) return fail('create', create.error || 'no terminal handle');
  const ready = awaitReadiness(handle, built.adapter);
  if (!ready.ok) return fail('readiness', ready.reason, ready.signal ?? null, { screen: ready.screen, matched: ready.matched });
  const modelAttested = awaitModelAttestation(handle, model, built.adapter, ready.screen);
  if (!modelAttested.ok) return fail('model-attestation', modelAttested.reason, modelAttested.signal ?? null,
    { requestedModel: model, screen: modelAttested.screen, matched: modelAttested.matched });
  const text = promptFile ? fs.readFileSync(promptFile, 'utf8') : prompt;
  if (text != null) {
    const send = deliverPrompt({ handle, adapter: built.adapter, prompt: text, worktree, dispatchId });
    artifact = send.artifact ?? null;
    if (!send.ok) return fail('send', send.error || 'send failed');
    const submitted = awaitSubmission(handle, built.adapter);
    if (!submitted.ok) return fail('submission', submitted.reason, submitted.signal ?? null,
      { screen: submitted.screen, matched: submitted.matched });
    if (attest) {
      const attested = awaitAttestation(handle, built.adapter);
      if (!attested.ok) return fail('attestation', `attestation rejected: ${attested.signal}`, attested.signal);
    }
    // Attested — the dispatch artifact has been consumed; it must not live on.
    cleanupDeliveryArtifact(artifact);
    artifact = null;
  }
  return { ok: true, terminal: handle, provider, model: model ?? null, effort: effort ?? null,
    modelAttested: modelAttested.model, command: built.command, commandSource: built.commandSource };
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
