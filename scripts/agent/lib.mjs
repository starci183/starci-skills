// scripts/agent/lib.mjs — semantic agent lifecycle over the Orca API layer.
// Provider differences are DATA (modules/models/agents/<name>.yaml); this module is the only mechanism.
//
//   startAgent({provider, model, effort, worktree, title, prompt, objective, entry}) → run-create → task-create → spawnAgent
//   spawnAgent({provider, model, effort, worktree, title, task, run, from})
//     → ensureLaunchTrust → orca orchestration worker-start --agent → dispatch-show (assignee)
//     → terminal rename → worker-show attestation (effective agent/model) → receipt.
//   deliverPrompt / awaitSubmission / awaitAttestation: follow-up input to a LIVE agent (agent/send.mjs, nudge).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../engine/yaml.mjs';
import { terminalSend } from '../api/orca/terminal-send.mjs';
import { terminalRead } from '../api/orca/terminal-read.mjs';
import { sleepSync } from '../api/orca/lib.mjs';
import { classifyAgentScreen, stagedInputRegion, DEFAULT_STAGED_PATTERN, frameWithDraft, wakeDeliveryOf } from '../kernel/terminal-liveness.mjs';
import { INPUT_GLYPH_CHARS, INPUT_GLYPH_CLASS } from '../lib/input-glyph.mjs';
import { WAKE_PROOF_READS, WAKE_PROOF_INTERVAL_MS } from '../kernel/wake-delivery.mjs';
import { ensureLaunchTrust } from './trust.mjs';
import { workerStart } from '../api/orca/worker-start.mjs';
import { workerShow } from '../api/orca/worker-show.mjs';
import { workerStop } from '../api/orca/worker-stop.mjs';
import { workerRelease } from '../api/orca/worker-release.mjs';
import { dispatchShow } from '../api/orca/dispatch-show.mjs';
import { terminalRename } from '../api/orca/terminal-rename.mjs';
import { runCreate } from '../api/orca/run-create.mjs';
import { runShow } from '../api/orca/run-show.mjs';
import { taskCreate } from '../api/orca/task-create.mjs';
import { taskSpecOf } from '../kernel/task-spec.mjs';
import { safeRemoveTree } from '../lib/safe-remove.mjs';

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
    const text = squash(line).replace(new RegExp(`^[${INPUT_GLYPH_CHARS}│|]\\s*`, 'u'), '');
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

/**
 * Answer an allowlisted gate that appears MID-RUN (the Kernel's `api nudge` on an op worker): the card's
 * gateAutoAnswer rule for `gate`, the same walk-and-Enter answerGate does at readiness, then up to settleMs
 * for the gate to leave the screen. A loop-detection dialog can halt a worker turn this way
 * (starci-next inc-af01e1cedbf4). Returns {gate, select, answered, cleared, keystroke, reason?}; a gate the
 * card does not allowlist returns answered:false with no keystroke. `io` {read, sleep, now} is the spec seam.
 */
export function answerAllowlistedGate(handle, adapter, gate, { screen = null, io = null } = {}) {
  const read = io?.read ?? ((h) => terminalRead({ terminal: h }));
  const sleep = io?.sleep ?? sleepSync;
  const now = io?.now ?? (() => Date.now());
  const rule = gateAutoAnswerRule(adapter, gate);
  if (!rule) return { gate, answered: false, cleared: false, keystroke: '', reason: "not on the agent card's gateAutoAnswer allowlist" };
  let current = screen;
  if (rule.delayMs || current == null) {
    if (rule.delayMs) sleep(rule.delayMs);
    current = read(handle)?.screen ?? current ?? '';
  }
  const answer = answerGate(handle, rule, current);
  const out = { gate, select: rule.select, answered: answer.answered, keystroke: answer.keystroke, cleared: false,
    ...(answer.reason ? { reason: answer.reason } : {}) };
  if (!answer.answered) return out;
  const until = now() + rule.settleMs;
  do {
    sleep(500);
    const state = classifyAgentScreen(read(handle)?.screen ?? '');
    if (state.state !== 'interactive-gate' || state.gate !== gate) { out.cleared = true; break; }
  } while (now() < until);
  return out;
}

// The tail of a terminal frame, kept on a failed launch so its cause is
// visible after the terminal is gone: the last `rows` non-empty rows, capped.
export function lastOutputOf(screen, { rows = 30, chars = 3000 } = {}) {
  const text = String(screen ?? '').split(/\r?\n/).map((row) => row.replace(/\s+$/u, '')).filter((row) => row.trim()).slice(-rows).join('\n');
  return text.length > chars ? text.slice(-chars) : text;
}

const submissionTimeoutMs = (adapter) => Number(adapter?.submission?.timeoutMs) || 45000;

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
  const input = regexp(adapter?.readiness?.screenPattern, `(?:Ask|Message|Enter a prompt|(^|\\n)\\s*${INPUT_GLYPH_CLASS})`);
  const timeoutMs = submissionTimeoutMs(adapter);
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
    // Orca lifts the input box text out of the frame as `draft`: a paste whose Enter was dropped reads
    // as an empty prompt unless it is written back (terminal-liveness.mjs frameWithDraft).
    screen = frameWithDraft(read.screen, read.draft);
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
// `io` {send, read, sleep} replaces the Orca wrappers in unit specs.
export function deliverPrompt({ handle, adapter, prompt, worktree, dispatchId = 'prompt', io = null }) {
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
    return { ...sendPrompt(handle, sendText, adapter, io), sentText: sendText, artifact: { file, dir, transient } };
  }
  // sentText is what the terminal was given: awaitSubmission and the api's
  // liveness reads find an unsubmitted paste by it (inc-06aeecf432f1).
  return { ...sendPrompt(handle, prompt, adapter, io), sentText: prompt };
}

// The prompt is sent as one text+Enter agent prompt observed for the card's submission window
// (terminal-send.mjs waitSubmit): a turn_started receipt proves the submit, and awaitSubmission is
// skipped. A send not seen submitted - an old host's agent_prompt_stalled, or a receipt with no turn
// start - is proven from the frame, with the input box's draft written back: the text on screen, in
// the input box, or a turn begun is delivered (awaitSubmission proves the submit); the provider idle
// at an empty prompt is a lost send, sent once more; lost again, the send is refused
// PROMPT_DELIVERY_STALLED, a transient launch fault (never quota, never the model). A terminal whose
// process incarnation the host no longer accepts is refused TERMINAL_INCARNATION_STALE, never transient.
export const PROMPT_DELIVERY_STALLED = 'prompt-delivery-stalled';
export const TERMINAL_INCARNATION_STALE = 'terminal-incarnation-stale';
function sendPrompt(handle, text, adapter, io) {
  const send = io?.send ?? terminalSend, read = io?.read ?? terminalRead, sleep = io?.sleep ?? sleepSync;
  const waitSubmit = Math.ceil(submissionTimeoutMs(adapter) / 1000);
  let screen = null;
  // True only when every readable frame shows the provider idle with no trace of `text`.
  const lost = () => {
    let seen = false;
    for (let i = 0; i < WAKE_PROOF_READS; i += 1) {
      if (i > 0) sleep(WAKE_PROOF_INTERVAL_MS);
      const r = read({ terminal: handle });
      if (!r?.ok) continue;
      screen = frameWithDraft(r.screen ?? '', r.draft);
      const proof = wakeDeliveryOf({ after: screen, text });
      if (proof.delivery !== 'unproven' || proof.screenState !== 'turn-idle') return false;
      seen = true;
    }
    return seen;
  };
  for (let attempt = 1; ; attempt += 1) {
    const sent = send({ terminal: handle, text, enter: true, waitSubmit });
    const redelivered = attempt > 1 ? { redelivered: true } : {};
    if (sent.submitted) return { ...sent, ok: true, ...redelivered };
    if (sent.staleIncarnation || sent.prompt?.observation === 'incarnation_replaced')
      return { ...sent, ok: false, ...redelivered, failureKind: TERMINAL_INCARNATION_STALE, transient: false,
        error: `${TERMINAL_INCARNATION_STALE}: the host no longer accepts input for this terminal's process (${sent.errorCode ?? sent.prompt?.observation})` };
    const unproven = sent.errorCode === 'agent_prompt_stalled' || (sent.ok && sent.prompt?.observation === 'supported');
    if (!unproven) return { ...sent, ...redelivered };
    if (!lost()) return { ...sent, ok: true, stalled: true, ...redelivered };
    if (attempt === 2) return { ...sent, ok: false, ...redelivered, failureKind: PROMPT_DELIVERY_STALLED, transient: true, screen,
      error: `${PROMPT_DELIVERY_STALLED}: neither the send nor its one re-delivery was seen submitted (${sent.errorCode ?? 'no turn start'}), and the frame after each showed the provider idle at an empty input` };
  }
}

// Remove a file-reference delivery artifact. Transient artifacts take their
// private tmpdir with them; a card-declared directory is only emptied of the
// file itself. Best-effort — a leftover temp file never fails the caller.
export function cleanupDeliveryArtifact(artifact) {
  if (!artifact?.file) return { ok: true, removed: false };
  try { fs.rmSync(artifact.file, { force: true }); } catch { /* best-effort */ }
  if (artifact.transient && artifact.dir) {
    try { safeRemoveTree(artifact.dir); } catch { /* best-effort */ }
  }
  return { ok: true, removed: true };
}


// ---- the one agent launch --------------------------------------------------
// Every agent - Kernel, [Supervisor], [Worker], [Op] - starts through `orca orchestration worker-start --agent
// <provider> [--model <id> --effort <level>]` (modules/kernel/contract-changes/launch-through-worker-start.yaml).
// Orca composes the launch (placement, the owner's per-agent default args, readiness, Task injection) and owns the
// worker's lifecycle; the runtime pre-trusts the directory, starts the worker on an existing Task, resolves the
// exact assignee terminal (dispatch-show), gives it its semantic title and attests the EFFECTIVE agent and model
// (worker-show) against what was routed. A card whose `start.modelArgument` is false (devin) takes no model flag
// and is attested on its agent alone.
// Returns {ok:true, terminal, dispatchId, taskId, runId, provider, model, effort, effective, trust, titleApplied} or
// {ok:false, step, error, errorCode, effectState, dispatchId, terminal, observation, cleanup, trust}. A start that left
// an effect is reconciled before the failure returns, so no caller ever owns a half launch.
// `onCreated(handle, dispatchId)` runs the moment the assignee terminal is known, before attestation: the caller
// records it durably (nivo inc-e523617a3c31).
export function spawnAgent({ provider, model = null, effort = null, worktree, title, task, run, from = null, retryOf = null, onCreated = null,
  io = null } = {}) {
  const orca = { start: io?.start ?? workerStart, show: io?.show ?? workerShow, assignee: io?.assignee ?? dispatchShow,
    rename: io?.rename ?? terminalRename, stop: io?.stop ?? workerStop, release: io?.release ?? workerRelease,
    trust: io?.trust ?? ensureLaunchTrust };
  const { card, error: cardError } = loadAdapter(provider);
  if (cardError) return { ok: false, step: 'card', error: cardError, provider };
  const takesModel = card?.start?.modelArgument !== false;
  if (effort === 'none') effort = null;
  let trust = null;
  // A card that takes no model flag (Devin) is pinned by launch trust in the worktree's local Devin config instead.
  try { trust = orca.trust({ agent: provider, cwd: worktree, ...(!takesModel && model ? { model } : {}) }); }
  catch (e) { trust = { agent: provider, paths: [], status: 'failed', errors: [{ error: String(e?.message ?? e) }] }; }
  const started = orca.start({ task, worktree, agent: card?.start?.agentArgument ?? provider,
    ...(takesModel && model ? { model, ...(effort ? { effort } : {}) } : {}), displayName: title, run, from, retryOf });
  const dispatchId = started?.dispatchId ?? null;
  // A failed start is reconciled before it returns (Orca's safety floor: only proof of exit authorizes a stop):
  // no effect -> nothing; unknown -> worker-show first, cleaned only when Orca shows the worker ended; a partial
  // effect -> cleaned. `io.cleanup(dispatchId)` -> {effectState, ...} replaces the default stop + release.
  const cleanupOf = io?.cleanup ?? ((id) => {
    const stop = bestEffortCall(() => orca.stop({ dispatch: id }));
    const release = bestEffortCall(() => orca.release({ dispatch: id }));
    return { effectState: release?.ok === true ? 'none' : 'partial', stop, release };
  });
  const reconcile = (effectState) => {
    if (effectState === 'none' || !dispatchId) return { effectState, observation: null, cleanup: null };
    if (effectState === 'unknown') {
      const observation = bestEffortCall(() => orca.show({ dispatch: dispatchId }));
      if (!observation?.ok || !['failed', 'stopped', 'released'].includes(observation.state)) return { effectState: 'unknown', observation, cleanup: null };
      const cleanup = cleanupOf(dispatchId);
      return { effectState: cleanup.effectState, observation, cleanup };
    }
    const cleanup = cleanupOf(dispatchId);
    return { effectState: cleanup.effectState, observation: null, cleanup };
  };
  const fail = (step, error, { effectState = 'partial', ...extra } = {}) => {
    const reconciled = reconcile(effectState);
    return { ok: false, step, error, provider, dispatchId, taskId: task ?? null, runId: run ?? null, ...extra, ...(trust ? { trust } : {}),
      effectState: reconciled.effectState, ...(reconciled.observation ? { observation: reconciled.observation } : {}),
      ...(reconciled.cleanup ? { cleanup: reconciled.cleanup } : {}) };
  };
  if (started?.ok !== true || (started.outcome != null && started.outcome !== 'ok') || !dispatchId) {
    return fail('worker-start', started?.error ?? `worker-start outcome=${started?.outcome ?? 'none'} state=${started?.state ?? 'none'} effect=${started?.effectState ?? 'none'}`,
      { effectState: started?.effectState ?? 'unknown', errorCode: started?.errorCode ?? null, details: started ?? null,
        ...(started?.hostUnavailable ? { hostUnavailable: true } : {}) });
  }
  const shown = orca.assignee({ task, from });
  const terminal = shown?.ok ? shown.assigneeHandle : null;
  if (!terminal) return fail('dispatch-show', shown?.error ?? 'dispatch-show returned no assignee', { details: shown ?? null,
    ...(shown?.hostUnavailable ? { hostUnavailable: true } : {}) });
  if (onCreated) { try { onCreated(terminal, dispatchId); } catch { /* the receipt still names the handle */ } }
  // A worker in an existing worktree gets Orca's default tab title; the semantic title is presentation only.
  const renamed = title ? bestEffortCall(() => orca.rename({ terminal, title })) : null;
  const attest = orca.show({ dispatch: dispatchId });
  const eff = attest?.effective ?? {};
  const effAgent = eff.agent ?? eff.provider ?? null;
  const effModel = eff.model ?? eff.modelId ?? null;
  const agentOk = effAgent === (card?.start?.agentArgument ?? provider);
  const modelOk = !takesModel || !model || effModel === model;
  if (attest?.ok !== true || !agentOk || !modelOk) {
    return fail('attestation', `worker attest failed: expected agent=${provider} model=${takesModel ? model : '(agent default)'}, got agent=${effAgent} model=${effModel} state=${attest?.state ?? 'none'}`,
      { terminal, incident: true, details: attest ?? null });
  }
  return { ok: true, terminal, dispatchId, taskId: task ?? null, runId: run ?? null, provider, model: takesModel ? model : null,
    effort: takesModel && model ? effort : null, effective: { agent: effAgent, model: effModel }, titleApplied: renamed?.ok === true,
    ...(trust ? { trust } : {}) };
}

const bestEffortCall = (fn) => { try { return fn(); } catch (e) { return { ok: false, error: String(e?.message ?? e) }; } };

// An agent that is not an operation - the Kernel, the [Supervisor], a [Worker] - is a worker of its own Run: the
// entry terminal (the owner's chat, the Supervisor, whoever ran the launcher; `entry`, Orca's ORCA_TERMINAL_HANDLE)
// is that Run's coordinator. `priorRunId` is reused while Orca still knows it and accepts the Task; otherwise a fresh
// Run is created (a Run's coordinator is the terminal that created it, so a relaunch from another entry cannot add
// a Task to it). The Task spec is the prompt, spilled to `specFile` past the host's argv (task-spec.mjs).
// Returns spawnAgent's receipt (runId/taskId on it), or {ok:false, step:'run-create'|'task-create', effectState:'none'}.
export function startAgent({ provider, model = null, effort = null, worktree, title, prompt, specFile = null, heading = null, objective,
  entry = null, priorRunId = null, onCreated = null, io = null } = {}) {
  const orca = { runShow: io?.runShow ?? runShow, runCreate: io?.runCreate ?? runCreate, taskCreate: io?.taskCreate ?? taskCreate };
  const spec = taskSpecOf({ prompt, file: specFile, heading: heading ?? title }).spec;
  const from = entry ? { from: entry } : {};
  const newRun = () => {
    const created = orca.runCreate({ objective, ...from });
    return created?.ok && created.runId ? { runId: created.runId } : { error: created?.error ?? 'run-create returned no runId', hostUnavailable: created?.hostUnavailable === true };
  };
  const newTask = (runId) => orca.taskCreate({ run: runId, spec, taskTitle: title, displayName: title, ...from });
  let runId = null;
  if (priorRunId && orca.runShow({ id: priorRunId })?.ok) runId = priorRunId;
  let task = runId ? newTask(runId) : null;
  if (!task?.ok || !task.taskId) {
    const made = newRun();
    if (made.error) return { ok: false, step: 'run-create', error: made.error, provider, effectState: 'none', ...(made.hostUnavailable ? { hostUnavailable: true } : {}) };
    runId = made.runId;
    task = newTask(runId);
  }
  if (!task?.ok || !task.taskId) return { ok: false, step: 'task-create', error: task?.error ?? 'task-create returned no taskId', provider, runId, effectState: 'none',
    ...(task?.hostUnavailable ? { hostUnavailable: true } : {}) };
  return spawnAgent({ provider, model, effort, worktree, title, task: task.taskId, run: runId, from: entry, onCreated, io: io?.spawn ?? null });
}
