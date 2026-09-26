// wake-delivery.mjs — a terminal wake whose delivery is proven from the screen.
//
// Orca's terminal-send receipt is not proof either way: a provider that is
// running a turn queues the typed text and Orca answers agent_prompt_stalled
// (calls.yaml terminal-send), and agent_prompt_blocked is followed by one
// Enter-only send (scripts/api/orca/terminal-send.mjs enterRetry). `api nudge`
// reported terminal-send-failed for wakes that sat on the worker's screen
// (inc-b87a42ec8690, inc-e4f69f9ef061, inc-13ab4be5059f part 2). The frame
// read before the send and the frames read after it decide:
//   delivered — the wake text is on the exact terminal (or Orca confirmed it
//               and the screen does not contradict it);
//   queued    — the provider shows the text held behind its running turn;
//   failed    — neither the receipt nor the screen shows it landed.
// A wake left unsubmitted in the input row (staged-input, or Devin's idle
// "Press Enter to send queued messages") gets one Enter-only send.
//
// A lost wake gets one split retry. On 2026-09-24 the Codex Kernel
// term_28a694d9 (TUI prompt "› Ask Codex to do anything") took a text+Enter
// send, Orca answered ok:true with no error code, and nothing reached the
// screen - twice; on the receipt alone every watchdog wake from 19:59 to 01:45
// read delivered. The same text sent with enter:false appeared in the input
// row and an Enter-only send submitted it. So a frame that still reads
// turn-idle with no wake text, no queued marker and no staged input is lost
// whatever the receipt said, and the wake is retried once as two sends: the
// text with enter:false, proven staged in the input row, then Enter-only,
// proven from the screen again. The receipt fields say so: splitRetried:true,
// splitOutcome 'delivered-after-split' | 'unstaged' | 'unsubmitted'. A receipt
// that already carries terminal-send's own Orca-confirmed Enter-only retry
// (agent_prompt_blocked) is that same split and is not repeated.
//
// Every frame here carries the input box's draft. Orca lifts the text of an agent's input box out of
// the frame and answers it as `draft` (scripts/api/orca/lib.mjs draftText); read without it, a wake
// whose Enter was dropped sat invisible in the box and the next wake was appended to it (nivo collab
// Kernel, 2026-09-25). So the draft is written back into the input row before any proof
// (terminal-liveness.mjs frameWithDraft), and a draft found BEFORE typing decides first
// (terminal-liveness.mjs draftOwnership):
//   own      this wake (or another text the caller names) already waits there: one Enter submits it,
//            nothing is typed again - evidence 'draft-submitted';
//   runtime  runtime wakes piled up or cut short: the box is emptied with Ctrl+U (clear-draft.mjs),
//            then the wake is typed as usual; a box that shrank but will not empty refuses 'draft-stuck';
//   foreign  words the runtime never typed: one Ctrl+U probes them (clear-draft.mjs probeDraft); text
//            that changed is real, the part deleted is typed back and nothing else is typed -
//            delivery 'foreign-input'.
// A draft the first Ctrl+U leaves unchanged is stale on Orca's side (sn-foundation term_da5f72b3,
// 2026-09-25: 'check status' no key could clear, an empty box on screen): it is recorded as the note
// draftNote 'draft-stale' (staleDraft: its text), never refused, and the wake is typed as if the box
// were empty; the frames read after the send ignore that same stale text, and the delivery proof
// stays the backstop. `staleDrafts` names drafts a caller already probed stale (api nudge).
import { terminalRead } from '../api/orca/terminal-read.mjs';
import { terminalSend } from '../api/orca/terminal-send.mjs';
import { terminalShow } from '../api/orca/terminal-show.mjs';
import { draftText, sleepSync } from '../api/orca/lib.mjs';
import { allocationMs } from '../../engine/config.mjs';
import { classifyAgentScreen, staleAwareState, outputAgeOf, wakeDeliveryOf, exitedAgentPromptRow, shellReceivedText, frameWithDraft, draftOwnership,
  collapse, clipDraft, DEFAULT_STAGED_PATTERN } from './terminal-liveness.mjs';
import { clearDraft, probeDraft, sameDraft, DRAFT_STALE, CLEAR_DRAFT_INTERVAL_MS } from './clear-draft.mjs';
import { parseJson } from '../lib/json.mjs';

const PROVEN = new Set(['delivered', 'queued']);
const WAITING_FOR_ENTER = new Set(['staged-input', 'queued-input']);
export const WAKE_PROOF_READS = 3;
export const WAKE_PROOF_INTERVAL_MS = 1000;
export const SPLIT_OUTCOMES = Object.freeze({ delivered: 'delivered-after-split', unstaged: 'unstaged', unsubmitted: 'unsubmitted' });

const sendCodeOf = (sent) => sent?.errorCode ?? sent?.enterRetry?.after ?? null;

// One read: {screen, draft, frame} - frame is the screen with the draft back in its input row - or null.
// `staleOf()` names a draft proven stale (clear-draft.mjs): the same text read again is no draft.
const frameReader = (read, terminal, staleOf = () => null) => () => {
  try {
    const r = read({ terminal, screen: true });
    if (!r?.ok) return null;
    const screen = String(r.screen ?? ''), raw = draftText(r), stale = staleOf();
    const draft = raw && stale && sameDraft(raw, stale) ? null : raw;
    return { screen, draft, frame: draft ? frameWithDraft(screen, draft) : screen };
  } catch { return null; }
};
const NO_SEND = Object.freeze({ sent: null, sendErrorCode: null, enterRetried: false, splitRetried: false, splitOutcome: null, split: null });

// A frame that ends in a bare shell prompt has no agent left to read a wake: the
// shell would run the text as a command (term_8a556567, 2026-09-24 02:23). Nothing
// is sent; the refusal says so with delivery 'agent-exited'.
const exitedRefusal = (screen) => {
  const row = exitedAgentPromptRow(screen);
  return row ? { ok: false, delivery: 'agent-exited', evidence: 'shell-prompt', shellPrompt: row, sent: null, sendErrorCode: null,
    enterRetried: false, splitRetried: false, splitOutcome: null, split: null, screenState: 'agent-exited' } : null;
};

// The wake reached a host shell, not an agent: the text follows a shell prompt, a
// shell error appeared, or the frame now ends in a bare prompt. nivo term_8f9e0611
// (2026-09-24 03:56): PowerShell echoed and ran a nudge, and the echoed text was
// read as the wake landing - delivery 'delivered'. It is never delivered.
const shellRefusal = (after, text, before, extra) => {
  const shell = shellReceivedText(after, text, before);
  const row = shell ? null : exitedAgentPromptRow(after);
  if (!shell && !row) return null;
  return { ok: false, delivery: 'agent-exited', evidence: shell ? shell.evidence : 'shell-prompt', shellPrompt: shell?.row ?? row,
    sendErrorCode: null, enterRetried: false, splitRetried: false, splitOutcome: null, split: null, screenState: 'agent-exited', ...extra };
};

// No trace of the wake and the provider still at its prompt: the send was dropped.
const isLost = (proof) => proof?.delivery === 'unproven' && proof.screenState === 'turn-idle';

/**
 * The receipt/event fields a proven wake adds (api nudge, the transition wake,
 * the watchdog, the ask-answered wake):
 * {delivery, evidence, sendErrorCode?, enterRetried?, splitRetried?, splitOutcome?}.
 */
export const deliveryFieldsOf = (proof) => ({ delivery: proof.delivery, evidence: proof.evidence,
  ...(proof.sendErrorCode ? { sendErrorCode: proof.sendErrorCode } : {}), ...(proof.enterRetried ? { enterRetried: true } : {}),
  ...(proof.splitRetried ? { splitRetried: true, splitOutcome: proof.splitOutcome } : {}),
  ...(proof.draft ? { draft: proof.draft } : {}), ...(proof.draftSubmitted ? { draftSubmitted: true } : {}),
  ...(proof.draftNote ? { draftNote: proof.draftNote, staleDraft: proof.staleDraft ?? null } : {}),
  ...(proof.draftProbe ? { draftProbe: proof.draftProbe } : {}) });

// The split retry of a lost wake: `text` with enter:false, proven staged in the
// input row, then one Enter-only send, proven from the screen.
function splitRetry({ terminal, text, before, stagedPattern, reads, intervalMs, read, send, sleep }) {
  const sends = [send({ terminal, text, enter: false })];
  let staged = null;
  for (let i = 0; i < Math.max(1, reads) && !staged; i += 1) {
    sleep(intervalMs);
    const after = read();
    if (after == null) continue;
    // Text staged at a shell prompt is not an agent's input row: never press Enter on it.
    if (shellReceivedText(after, text, before) || exitedAgentPromptRow(after)) return { ok: false, outcome: SPLIT_OUTCOMES.unstaged, proof: null, sends, shell: after };
    const proof = wakeDeliveryOf({ before, after, text, stagedPattern });
    if (WAITING_FOR_ENTER.has(proof.screenState)) staged = proof;
  }
  if (!staged) return { ok: false, outcome: SPLIT_OUTCOMES.unstaged, proof: null, sends };
  sends.push(send({ terminal, text: '', enter: true }));
  let proof = staged;
  for (let i = 0; i < Math.max(1, reads); i += 1) {
    sleep(intervalMs);
    const after = read();
    if (after == null) continue;
    proof = wakeDeliveryOf({ before, after, text, stagedPattern });
    if (!WAITING_FOR_ENTER.has(proof.screenState)) break;
  }
  // The text left the input row: submitted.
  const submitted = !WAITING_FOR_ENTER.has(proof.screenState);
  return { ok: submitted, outcome: submitted ? SPLIT_OUTCOMES.delivered : SPLIT_OUTCOMES.unsubmitted, proof, sends };
}

/**
 * Type `text` into `terminal` with Enter and prove from the screen what happened.
 * Returns {ok, delivery, evidence, sent, sendErrorCode, enterRetried, splitRetried, splitOutcome, split, screenState};
 * `sent` is the first (text+Enter) receipt, `split.sends` the split retry's receipts.
 * `before` is a frame the caller just read (it saves one terminal read).
 * `ownTexts` are other texts the runtime typed into this terminal (a worker's dispatched contract): a
 * draft that is exactly one of them is submitted with one Enter like this wake's own.
 * A draft found before typing can end it early: delivery 'foreign-input' (only the Ctrl+U probe and
 * its restore were typed, `draft` says what sits there, `draftProbe` what the probe did), 'draft-stuck'
 * (Ctrl+U could not empty the box), or evidence 'draft-submitted'. A stale draft (the first Ctrl+U left
 * it unchanged, or it is one of `staleDrafts`) adds draftNote 'draft-stale' and staleDraft, and the
 * wake is typed.
 * `deps` ({read, send, sleep}) replaces the Orca wrappers in unit specs.
 */
export function sendWakeWithProof({ terminal, text, before: beforeScreen = null, stagedPattern = DEFAULT_STAGED_PATTERN, ownTexts = [],
  staleDrafts = [], reads = WAKE_PROOF_READS, intervalMs = WAKE_PROOF_INTERVAL_MS, deps = {} }) {
  let staleDraft = null;
  const readFrame = frameReader(deps.read ?? terminalRead, terminal, () => staleDraft);
  const read = () => readFrame()?.frame ?? null;
  const send = deps.send ?? terminalSend, sleep = deps.sleep ?? sleepSync;
  // The frame read immediately before typing decides, however recent the
  // caller's own read was: an agent can exit between an observation and the
  // send (nivo term_8f9e0611). A caller's frame that already shows a shell
  // refuses too, and with no frame at all nothing is typed blind.
  const callerBefore = typeof beforeScreen === 'string' ? beforeScreen : null;
  const exitedEarlier = callerBefore != null ? exitedRefusal(callerBefore) : null;
  if (exitedEarlier) return exitedEarlier;
  let freshRead = readFrame();
  const exited = exitedRefusal(freshRead?.screen ?? null);
  if (exited) return exited;
  // A draft already in the input box decides before anything is typed onto it.
  const draftDeps = { read: deps.read ?? terminalRead, send, sleep }, probeMs = Math.min(intervalMs, CLEAR_DRAFT_INTERVAL_MS);
  const known = freshRead?.draft ? staleDrafts.find((stale) => typeof stale === 'string' && sameDraft(stale, freshRead.draft)) : null;
  if (known) { staleDraft = freshRead.draft; freshRead = { ...freshRead, draft: null, frame: freshRead.screen }; }
  if (freshRead?.draft) {
    const owner = draftOwnership(freshRead.draft, { texts: [text, ...ownTexts], stagedPattern });
    if (owner.kind === 'own') return submitDraft({ terminal, draft: freshRead.draft, stagedPattern, sentText: text, reads, intervalMs, readFrame, send, sleep });
    if (owner.kind === 'foreign') {
      // Foreign text is never cleared: one Ctrl+U tells a real draft (it changes; the deleted part is
      // typed back) from a stale one (it does not).
      const probe = probeDraft({ terminal, intervalMs: probeMs, deps: draftDeps });
      const draftProbe = { verdict: probe.verdict, sends: probe.sends, ...(probe.verdict === 'real' ? { restored: probe.restored, ...(probe.restored ? {} : { removed: probe.removed }) } : {}) };
      if (probe.verdict === 'real' || probe.verdict === 'unreadable') return { ok: false, delivery: 'foreign-input', evidence: 'draft', draft: clipDraft(probe.draft ?? owner.draft),
        draftProbe, ...NO_SEND, screenState: classifyAgentScreen(freshRead.frame, { stagedPattern }).state };
      if (probe.verdict === 'stale') staleDraft = probe.draft;
    } else {
      const cleared = clearDraft({ terminal, intervalMs: probeMs, deps: draftDeps });
      if (!cleared.ok) return { ok: false, delivery: 'draft-stuck', evidence: cleared.reason ?? 'draft-stuck', draft: clipDraft(cleared.draft ?? freshRead.draft),
        draftCleared: { sends: cleared.sends, ok: false }, ...NO_SEND, screenState: null };
      if (cleared.stale) staleDraft = cleared.draft ?? cleared.initial;
    }
    freshRead = readFrame() ?? { screen: freshRead.screen, draft: null, frame: freshRead.screen };
  }
  const staleNote = staleDraft ? { draftNote: DRAFT_STALE, staleDraft: clipDraft(staleDraft) } : {};
  const fresh = freshRead?.frame ?? null;
  const before = fresh ?? callerBefore;
  if (before == null) return { ok: false, delivery: 'unreadable', evidence: 'unreadable', sent: null, sendErrorCode: null,
    enterRetried: false, splitRetried: false, splitOutcome: null, split: null, screenState: null };
  const sent = send({ terminal, text, enter: true });
  let proof = null, enterRetried = false;
  // A confirmed send the frame agrees with (proven, or no longer idle) needs
  // one look; an unconfirmed one, or a confirmed one the frame calls lost,
  // gets a few, because a TUI repaints the typed text a beat later.
  for (let i = 0; i < Math.max(1, reads) + (enterRetried ? 1 : 0); i += 1) {
    if (i > 0) sleep(intervalMs);
    const after = read();
    if (after == null) continue;
    const shell = shellRefusal(after, text, before, { sent, sendErrorCode: sendCodeOf(sent), ...staleNote });
    if (shell) return shell;
    proof = wakeDeliveryOf({ before, after, text, stagedPattern });
    if (PROVEN.has(proof.delivery) && !WAITING_FOR_ENTER.has(proof.screenState)) break;
    if (WAITING_FOR_ENTER.has(proof.screenState)) {
      if (!enterRetried) { enterRetried = true; send({ terminal, text: '', enter: true }); }
      continue;
    }
    if (sent?.ok && !isLost(proof)) break;
  }
  let split = null;
  if (isLost(proof) && !enterRetried && !sent?.enterRetry?.ok) {
    split = splitRetry({ terminal, text, before, stagedPattern, reads, intervalMs, read, send, sleep });
    if (split.shell) return shellRefusal(split.shell, text, before, { sent, sendErrorCode: sendCodeOf(sent), splitRetried: true,
      splitOutcome: split.outcome, split: { sends: split.sends }, ...staleNote });
    if (split.proof) proof = split.proof;
  }
  const screenDelivery = proof?.delivery ?? 'unreadable';
  const waiting = WAITING_FOR_ENTER.has(proof?.screenState);
  const delivery = PROVEN.has(screenDelivery) && !waiting ? screenDelivery
    : split ? (split.ok ? 'delivered' : 'failed')
    : sent?.ok && !waiting ? 'delivered'
    : 'failed';
  const evidence = PROVEN.has(screenDelivery) && !waiting ? (screenDelivery === 'queued' ? 'queued-marker' : 'wake-text')
    : split?.ok ? 'screen'
    : delivery === 'delivered' ? 'receipt'
    : screenDelivery;
  return { ok: delivery !== 'failed', delivery, evidence, sent, sendErrorCode: sendCodeOf(sent), enterRetried,
    splitRetried: Boolean(split), splitOutcome: split?.outcome ?? null, split: split ? { sends: split.sends } : null,
    screenState: proof?.screenState ?? null, ...staleNote };
}

/**
 * One Enter-only send that submits text already staged in the input row, proven
 * the same way: the frame no longer reads staged-input for `sentText`.
 * Returns {ok, delivery, evidence, sent, sendErrorCode, screenState}.
 */
export function sendEnterWithProof({ terminal, sentText = null, stagedPattern = DEFAULT_STAGED_PATTERN,
  reads = WAKE_PROOF_READS, intervalMs = WAKE_PROOF_INTERVAL_MS, deps = {} }) {
  const readFrame = frameReader(deps.read ?? terminalRead, terminal);
  const send = deps.send ?? terminalSend, sleep = deps.sleep ?? sleepSync;
  const first = readFrame();
  const exited = exitedRefusal(first?.screen ?? null);
  if (exited) return exited;
  const sent = send({ terminal, text: '', enter: true });
  // A receipt says nothing about a draft: with text in the input box, the box itself proves the submit.
  if (sent?.ok && !first?.draft) return { ok: true, delivery: 'delivered', evidence: 'receipt', sent, sendErrorCode: null, screenState: null };
  const proof = draftSubmitProof({ draft: first?.draft ?? null, stagedPattern, sentText, reads, intervalMs, readFrame, sleep });
  return { ok: proof.submitted, delivery: proof.submitted ? 'delivered' : 'failed',
    evidence: proof.submitted ? (first?.draft ? 'draft-submitted' : 'screen') : (proof.draftLeft ? 'draft-unsubmitted' : proof.screenState ?? 'unreadable'),
    sent, sendErrorCode: sendCodeOf(sent), screenState: proof.screenState, ...(proof.draftLeft ? { draft: clipDraft(proof.draftLeft) } : {}) };
}

// Frames read after an Enter: submitted once the frame no longer waits for Enter and the draft that
// was in the box (if any) has left it. Returns {submitted, screenState, draftLeft}.
function draftSubmitProof({ draft, stagedPattern, sentText, reads, intervalMs, readFrame, sleep }) {
  const was = draft ? collapse(draft) : null;
  let screenState = null, draftLeft = null;
  for (let i = 0; i < Math.max(1, reads); i += 1) {
    if (i > 0 || draft) sleep(intervalMs);
    const after = readFrame();
    if (after == null) continue;
    screenState = classifyAgentScreen(after.frame, { stagedPattern, sentText }).state;
    draftLeft = was && after.draft && collapse(after.draft) === was ? after.draft : null;
    if (!WAITING_FOR_ENTER.has(screenState) && !draftLeft) break;
  }
  return { submitted: screenState != null && !WAITING_FOR_ENTER.has(screenState) && !draftLeft, screenState, draftLeft };
}

// The runtime's own text already waits in the input box: one Enter submits it; typing the wake
// again would only append to it.
function submitDraft({ terminal, draft, stagedPattern, sentText, reads, intervalMs, readFrame, send, sleep }) {
  const sent = send({ terminal, text: '', enter: true });
  const proof = draftSubmitProof({ draft, stagedPattern, sentText, reads, intervalMs, readFrame, sleep });
  return { ok: proof.submitted, delivery: proof.submitted ? 'delivered' : 'failed', evidence: proof.submitted ? 'draft-submitted' : 'draft-unsubmitted',
    draftSubmitted: true, ...(proof.draftLeft ? { draft: clipDraft(proof.draftLeft) } : {}),
    sent, sendErrorCode: sendCodeOf(sent), enterRetried: true, splitRetried: false, splitOutcome: null, split: null, screenState: proof.screenState };
}

/* ------------------------------------------------------------ the Kernel wake */

// Orca 1.4.209 binds a send to the terminal's process incarnation: a terminal created before an
// Orca update shows writable on `terminal show` yet refuses every write terminal_not_writable
// (nivo inc-f1b576fb6006; the worker side records the same refusal op-worker-unwritable,
// scripts/kernel/api.mjs). A kernel wake send refused that way is the one writability judgement:
// it is recorded kernel-wake-unwritable, and on a stale-active frame (a frozen spinner whose
// lastOutputAt is older than activeStaleMs) the watchdog never types into it again - the terminal
// is closed directly (a typed quit and an Orca interrupt are refused the same way) and
// start-workflow replaces the seat.
export const KERNEL_WAKE_UNWRITABLE_EVENT = 'kernel-wake-unwritable';
export const KERNEL_WAKE_NOT_WRITABLE = 'terminal_not_writable';
// A wake send Orca refused terminal_not_writable: the refusal is read off the receipt's error code,
// its typed error, or the proof's sendErrorCode.
export const wakeSendRefused = (proof) => [proof?.sendErrorCode, proof?.sent?.errorCode, proof?.sent?.error]
  .some((value) => String(value ?? '').includes(KERNEL_WAKE_NOT_WRITABLE));

const GATED = new Set(['interactive-gate', 'failed', 'wedged']);
const configuredActiveStaleMs = () => { try { return allocationMs('liveness.activeStaleMs'); } catch { return null; } };
const kernelTerminalOf = (db, workflowId) => {
  const row = db.prepare("SELECT value_json FROM signals WHERE scope='kernel' AND key=?").get(workflowId);
  return parseJson(row?.value_json)?.terminal ?? null;
};
const failedError = (proof) => proof.sent?.error || proof.sendErrorCode || null;
const kernelAttemptOf = (db, workflowId) => {
  const attempt = db.prepare("SELECT attempt FROM jobs WHERE job_id=? AND kind='kernel'").get(`kernel-${workflowId}`)?.attempt;
  return Number.isInteger(attempt) ? attempt : null;
};
/** The sentence every Kernel wake ends with: the seat it is for, which the Kernel checks against `api status` (kernel.attempt, kernel.you). */
export const wakeIdentity = (workflowId, attempt) =>
  `Runtime wake for Kernel attempt ${attempt} of ${workflowId}: api status --workflow ${workflowId} shows kernel.attempt ${attempt} and kernel.you true on your terminal.`;
/** `text` with the seat's wakeIdentity appended; unchanged when the ledger holds no kernel attempt. */
export const withWakeIdentity = (text, workflowId, attempt) => (attempt == null ? text : `${text} ${wakeIdentity(workflowId, attempt)}`);

/**
 * Wake one workflow's Kernel with `text` plus its wakeIdentity - the one wake path of the transition,
 * ask-answered, stall and supervisor wakes. The Kernel signal names the terminal; a terminal Orca does not show connected and
 * writable, an unreadable frame or a bare shell is refused. The frame, with its input-box draft, decides;
 * an `active` frame older than `activeStaleMs` is turn-idle (staleAwareState).
 *   turn-idle                     the wake is typed and proven (sendWakeWithProof): kernel-woken;
 *   queued-input / staged-input   `pending` 'enter': one proven Enter submits it (kernel-<state>-sent),
 *                                 never a second wake on top; 'hold': kernel-busy, the Kernel watchdog
 *                                 owns that Enter;
 *   interactive-gate/failed/wedged  kernel-gated; any other state: kernel-busy.
 * Returns {action, terminal, delivered, state?, receipt?, error?, ...deliveryFieldsOf}; a proof that
 * reached a shell is kernel-exited, any other miss kernel-wake-failed.
 * `deps` ({show, read, send, sleep}) replaces the Orca wrappers in specs.
 */
export function wakeKernel({ db, workflowId, text, pending = 'hold', activeStaleMs = configuredActiveStaleMs(), deps = {} }) {
  const show = deps.show ?? terminalShow, read = deps.read ?? terminalRead;
  const sendDeps = { read: deps.read, send: deps.send, sleep: deps.sleep };
  const terminal = kernelTerminalOf(db, workflowId);
  if (!terminal) return { action: 'kernel-signal-absent', terminal: null, delivered: false };
  try {
    text = withWakeIdentity(text, workflowId, kernelAttemptOf(db, workflowId));
    const shown = show({ terminal });
    if (!shown?.ok || shown.connected !== true || shown.writable !== true) {
      return { action: 'kernel-unavailable', terminal, delivered: false, error: shown?.error ?? shown?.exitCause ?? null };
    }
    const frame = read({ terminal, screen: true });
    if (!frame?.ok) return { action: 'kernel-unreadable', terminal, delivered: false, error: frame?.error ?? null };
    const shellPrompt = exitedAgentPromptRow(frame.screen);
    if (shellPrompt) return { action: 'kernel-exited', terminal, delivered: false, state: 'agent-exited', shellPrompt };
    const { outputAgeMs } = outputAgeOf(shown?.terminal?.lastOutputAt);
    const liveness = staleAwareState(classifyAgentScreen(frame.screen, { draft: draftText(frame) }).state, outputAgeMs, activeStaleMs);
    const state = liveness.state;
    const staleActive = liveness.staleActive === true;
    if (WAITING_FOR_ENTER.has(state) && pending === 'enter') {
      const proof = sendEnterWithProof({ terminal, deps: sendDeps });
      return { action: proof.ok ? `kernel-${state}-sent` : 'kernel-wake-failed', terminal, delivered: proof.ok, state, ...deliveryFieldsOf(proof),
        ...(!proof.ok && wakeSendRefused(proof) ? { sendRefused: true } : {}),
        ...(proof.ok ? {} : { error: failedError(proof) }) };
    }
    if (GATED.has(state)) return { action: 'kernel-gated', terminal, delivered: false, state };
    if (state !== 'turn-idle') return { action: 'kernel-busy', terminal, delivered: false, state };
    const proof = sendWakeWithProof({ terminal, text, before: String(frame.screen ?? ''), deps: sendDeps });
    const delivered = deliveryFieldsOf(proof);
    if (proof.delivery === 'agent-exited') return { action: 'kernel-exited', terminal, delivered: false, state, ...delivered };
    if (!proof.ok) {
      const sendRefused = wakeSendRefused(proof);
      // Frozen spinner + lastOutputAt older than activeStaleMs + a refused send: the kernel's
      // terminal-incarnation-stale. The watchdog closes the terminal (a quit or an Orca interrupt
      // is refused the same way) and start-workflow replaces the seat.
      return { action: sendRefused && staleActive ? 'kernel-unwritable' : 'kernel-wake-failed', terminal, delivered: false, state,
        error: failedError(proof), ...delivered, ...(sendRefused ? { sendRefused: true } : {}) };
    }
    return { action: 'kernel-woken', terminal, delivered: true, state, receipt: proof.sent?.receipt ?? null, ...delivered };
  } catch (error) {
    return { action: 'kernel-wake-error', terminal, delivered: false, error: String(error?.message ?? error).slice(0, 200) };
  }
}

/** The line every durable transition wake ends with. */
export const WAKE_BOUNDS = 'No new scope, path, retry or authority; never duplicate a job or bypass an effect fence.';
/** A durable transition wake: opener, the transition's own `lines`, WAKE_BOUNDS. */
export const transitionWakeText = (workflowId, transition, lines) =>
  [`Durable transition wake for workflow ${workflowId}: ${transition}.`, ...lines, WAKE_BOUNDS].join(' ');

/**
 * wakeKernel for a durable transition (a filed report, an answered ask, a peer message, a landed
 * foundation): pending input is submitted with one Enter, and a woken Kernel gets the event
 * `kernel-transition-woken` {transition, ...ids, terminal, priorState, ...delivery}. Best effort: a
 * terminal or event failure is the answer, never thrown into the caller's committed transaction.
 */
export function wakeKernelForTransition(ledger, { workflowId, transition, ids = {}, lines, deps = {} }) {
  const woke = wakeKernel({ db: ledger.db, workflowId, text: transitionWakeText(workflowId, transition, lines), pending: 'enter', deps });
  if (woke.action !== 'kernel-woken') {
    // A refused wake send is recorded kernel-wake-unwritable (the kernel-side op-worker-unwritable),
    // so the watchdog's next tick closes the stale incarnation instead of typing into it again.
    if (woke.sendRefused) {
      try {
        ledger.transaction(() => ledger.appendEvent({
          workflowId, entityType: 'kernel', entityId: workflowId, kind: KERNEL_WAKE_UNWRITABLE_EVENT,
          payload: { transition, ...ids, terminal: woke.terminal, priorState: woke.state ?? null,
            errorCode: KERNEL_WAKE_NOT_WRITABLE, ...(woke.sendErrorCode ? { sendErrorCode: woke.sendErrorCode } : {}) },
        }));
      } catch { /* the wake's own answer is returned either way */ }
    }
    return woke;
  }
  const { action: _action, delivered: _delivered, state, receipt: _receipt, terminal, ...fields } = woke;
  try {
    ledger.transaction(() => ledger.appendEvent({
      workflowId, entityType: 'workflow', entityId: workflowId, kind: 'kernel-transition-woken',
      payload: { transition, ...ids, terminal, priorState: state, ...fields },
    }));
  } catch (error) {
    return { action: 'kernel-wake-error', terminal, delivered: true, error: String(error?.message ?? error).slice(0, 200) };
  }
  return woke;
}
