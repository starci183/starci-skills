// scripts/agent/lib.mjs — semantic agent lifecycle over the Orca API layer.
// Provider differences are DATA (providers/orca/adapters/<name>.yaml); this
// module is the only mechanism. Callers pass --provider and get the card's
// command prefix (credential refresh, env strip), command requirements
// (--yolo, --permission-mode dangerous, …) and readiness/submission patterns
// injected automatically — forgetting a bypass flag is structurally
// impossible because no caller ever assembles a provider command by hand.
//
//   spawnAgent({provider, worktree, title, prompt|promptFile, kernel})
//     → create terminal → awaitReadiness → send → awaitSubmission → receipt
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../core/yaml.mjs';
import { terminalCreate } from '../api/orca/terminal-create.mjs';
import { terminalSend } from '../api/orca/terminal-send.mjs';
import { terminalRead } from '../api/orca/terminal-read.mjs';
import { terminalShow } from '../api/orca/terminal-show.mjs';
import { terminalClose } from '../api/orca/terminal-close.mjs';
import { sleep } from '../api/orca/lib.mjs';

export const skillRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');

export function loadAdapter(provider) {
  const file = path.join(skillRoot, 'providers', 'orca', 'adapters', `${provider}.yaml`);
  if (!fs.existsSync(file)) return { provider, error: `no adapter card providers/orca/adapters/${provider}.yaml` };
  try {
    return { provider, card: parseYaml(fs.readFileSync(file, 'utf8')), file: `providers/orca/adapters/${provider}.yaml` };
  } catch (e) {
    return { provider, error: `adapter card ${provider}.yaml unparsable: ${e.message}` };
  }
}

// Build the terminal command for a provider. Composition:
//   credentialRefresh[plat] + commandPrefix[plat]          ← card-owned env prep (ACP strip, stale-key unset)
//   + explicit `command` (e.g. a model profile's launch.orca.command carrying model+tuning flags)
//   OR the card's own body: commandRequirements (kernel → kernelCommandRequirements)
//     or terminalFallback.command + bypassFlag for native-managed agents.
// Requirements ALWAYS come from the card — that is where --yolo lives.
export function buildSpawnCommand({ provider, kernel = false, command = null } = {}) {
  const { card, error } = loadAdapter(provider);
  if (error) return { provider, error };
  const plat = process.platform === 'win32' ? 'win32' : 'posix';
  const prefix = [card?.credentialRefresh?.[plat], card?.commandPrefix?.[plat]]
    .filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim()).join(' ');
  const reqs = (kernel && Array.isArray(card?.kernelCommandRequirements)
    ? card.kernelCommandRequirements
    : (Array.isArray(card?.commandRequirements) ? card.commandRequirements : [])).join(' ');
  const tf = card?.terminalFallback;
  let body = typeof command === 'string' && command.trim() ? command.trim() : null;
  if (!body && typeof tf?.command === 'string' && tf.command.trim()) {
    // bypassFlag may carry a prose tail ("--full-auto (or …)") — first token only.
    const bypass = String(tf.bypassFlag ?? '').match(/^(--?\S+)/)?.[1] ?? '';
    body = [tf.command.trim(), reqs, bypass].filter(Boolean).join(' ');
  } else if (!body && (prefix || reqs)) {
    body = [card?.agent ?? provider, reqs].filter(Boolean).join(' ');
  }
  if (!body) return { provider, error: `adapter card ${provider}.yaml yields no command (no command, no terminalFallback)` };
  return { provider, command: [prefix, body].filter(Boolean).join(' '), commandSource: `providers/orca/adapters/${provider}.yaml`, adapter: card };
}

const regexp = (source, fallback) => {
  try { return new RegExp(source || fallback, 'i'); } catch { return new RegExp(fallback, 'i'); }
};

// Card-driven readiness: screen must show the provider's prompt pattern
// (and identity when declared) before anything is sent.
export function awaitReadiness(handle, adapter) {
  const spec = adapter?.readiness && typeof adapter.readiness === 'object' ? adapter.readiness : {};
  const ready = regexp(spec.screenPattern, '(?:Ask|Message|Type your message|Enter a prompt|(^|\\n)\\s*[>❯❭]\\s*$)');
  const identity = spec.identityPattern ? regexp(spec.identityPattern, spec.identityPattern) : null;
  const timeoutMs = Number(spec.timeoutMs) || 120000;
  const intervalMs = Math.max(250, Number(spec.intervalMs) || 1000);
  let screen = '';
  for (let elapsed = 0; elapsed <= timeoutMs; elapsed += intervalMs) {
    const read = terminalRead({ terminal: handle });
    screen = read.screen;
    if (read.ok && ready.test(screen) && (!identity || identity.test(screen))) return { ok: true, screen };
    if (elapsed < timeoutMs) sleep(intervalMs);
  }
  return { ok: false, reason: `terminal readiness timeout after ${timeoutMs}ms`, screen };
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
    if (read.ok && activity.test(screen)) return { ok: true, screen, enters };
    if (read.ok && enters < maxEnter && (staged.test(screen) || input.test(screen))) {
      terminalSend({ terminal: handle, text: '', enter: true });
      enters += 1;
    }
  }
  return { ok: false, reason: `prompt was not consumed within ${timeoutMs}ms`, screen, enters };
}

// Delivery per card: file-reference-above-inline-limit writes the prompt to
// fileDirectory/fileName under the worktree and sends the card's @file prompt
// template — multi-kilobyte inline paste is a known provider crash.
export function deliverPrompt({ handle, adapter, prompt, worktree, dispatchId = 'prompt' }) {
  const d = adapter?.delivery ?? {};
  const limit = Number(d.maxInlineChars) || 0;
  // worktree may be an Orca selector ('active') rather than a filesystem path —
  // file-reference delivery only applies when it resolves to a real directory.
  if (d.mode === 'file-reference-above-inline-limit' && limit && prompt.length > limit && worktree && fs.existsSync(worktree)) {
    const dir = path.join(worktree, d.fileDirectory ?? '.starciwork/_local/runtime');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, (d.fileName ?? 'orca-dispatch-<dispatch>.md').replace('<dispatch>', dispatchId));
    fs.writeFileSync(file, prompt);
    const sendText = (d.prompt ?? 'Read <file> completely and follow it exactly.')
      .replace('<file>', file.replaceAll('\\', '/'));
    return terminalSend({ terminal: handle, text: sendText, enter: true });
  }
  return terminalSend({ terminal: handle, text: prompt, enter: true });
}

// Full spawn pipeline. Every failure closes the terminal and returns a typed
// step so callers can persist an incident instead of leaking terminals.
export function spawnAgent({ provider, worktree, title, prompt = null, promptFile = null, command = null, kernel = false, dispatchId } = {}) {
  const built = buildSpawnCommand({ provider, kernel, command });
  if (built.error) return { ok: false, step: 'command', error: built.error, provider };
  const create = terminalCreate({ worktree, title, command: built.command });
  const handle = create.handle;
  const fail = (step, error) => {
    if (handle) terminalClose({ terminal: handle });
    return { ok: false, step, error, terminal: handle, provider, command: built.command };
  };
  if (!handle) return fail('create', create.error || 'no terminal handle');
  const ready = awaitReadiness(handle, built.adapter);
  if (!ready.ok) return fail('readiness', ready.reason);
  const text = promptFile ? fs.readFileSync(promptFile, 'utf8') : prompt;
  if (text != null) {
    const send = deliverPrompt({ handle, adapter: built.adapter, prompt: text, worktree, dispatchId });
    if (!send.ok) return fail('send', send.error || 'send failed');
    const submitted = awaitSubmission(handle, built.adapter);
    if (!submitted.ok) return fail('submission', submitted.reason);
  }
  return { ok: true, terminal: handle, provider, command: built.command, commandSource: built.commandSource };
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
