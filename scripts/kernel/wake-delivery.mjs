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
//            then the wake is typed as usual; a box that will not empty refuses 'draft-stuck';
//   foreign  words the runtime never typed: nothing is typed onto them - delivery 'foreign-input'.
import { terminalRead } from '../api/orca/terminal-read.mjs';
import { terminalSend } from '../api/orca/terminal-send.mjs';
import { draftText, sleepSync } from '../api/orca/lib.mjs';
import { classifyAgentScreen, wakeDeliveryOf, exitedAgentPromptRow, shellReceivedText, frameWithDraft, draftOwnership, DEFAULT_STAGED_PATTERN } from './terminal-liveness.mjs';
import { clearDraft } from './clear-draft.mjs';

const PROVEN = new Set(['delivered', 'queued']);
const WAITING_FOR_ENTER = new Set(['staged-input', 'queued-input']);
export const WAKE_PROOF_READS = 3;
export const WAKE_PROOF_INTERVAL_MS = 1000;
export const SPLIT_OUTCOMES = Object.freeze({ delivered: 'delivered-after-split', unstaged: 'unstaged', unsubmitted: 'unsubmitted' });

const sendCodeOf = (sent) => sent?.errorCode ?? sent?.enterRetry?.after ?? null;

// One read: {screen, draft, frame} - frame is the screen with the draft back in its input row - or null.
const frameReader = (read, terminal) => () => {
  try {
    const r = read({ terminal, screen: true });
    if (!r?.ok) return null;
    const screen = String(r.screen ?? ''), draft = draftText(r);
    return { screen, draft, frame: draft ? frameWithDraft(screen, draft) : screen };
  } catch { return null; }
};
const oneRow = (text) => String(text ?? '').replace(/\s+/g, ' ').trim();
const clipDraft = (draft) => { const d = oneRow(draft); return d.length > 200 ? `${d.slice(0, 199)}…` : d; };
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
  ...(proof.draft ? { draft: proof.draft } : {}), ...(proof.draftSubmitted ? { draftSubmitted: true } : {}) });

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
 * A draft found before typing can end it early: delivery 'foreign-input' (nothing typed, `draft` says
 * what sits there), 'draft-stuck' (Ctrl+U could not empty the box), or evidence 'draft-submitted'.
 * `deps` ({read, send, sleep}) replaces the Orca wrappers in unit specs.
 */
export function sendWakeWithProof({ terminal, text, before: beforeScreen = null, stagedPattern = DEFAULT_STAGED_PATTERN, ownTexts = [],
  reads = WAKE_PROOF_READS, intervalMs = WAKE_PROOF_INTERVAL_MS, deps = {} }) {
  const readFrame = frameReader(deps.read ?? terminalRead, terminal);
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
  if (freshRead?.draft) {
    const owner = draftOwnership(freshRead.draft, { texts: [text, ...ownTexts], stagedPattern });
    if (owner.kind === 'foreign') return { ok: false, delivery: 'foreign-input', evidence: 'draft', draft: clipDraft(owner.draft), ...NO_SEND,
      screenState: classifyAgentScreen(freshRead.frame, { stagedPattern }).state };
    if (owner.kind === 'own') return submitDraft({ terminal, draft: freshRead.draft, stagedPattern, sentText: text, reads, intervalMs, readFrame, send, sleep });
    const cleared = clearDraft({ terminal, intervalMs: Math.min(intervalMs, 300), deps: { read: deps.read ?? terminalRead, send, sleep } });
    if (!cleared.ok) return { ok: false, delivery: 'draft-stuck', evidence: cleared.reason ?? 'draft-stuck', draft: clipDraft(cleared.draft ?? freshRead.draft),
      draftCleared: { sends: cleared.sends, ok: false }, ...NO_SEND, screenState: null };
    freshRead = readFrame() ?? { screen: freshRead.screen, draft: null, frame: freshRead.screen };
  }
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
    const shell = shellRefusal(after, text, before, { sent, sendErrorCode: sendCodeOf(sent) });
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
      splitOutcome: split.outcome, split: { sends: split.sends } });
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
    screenState: proof?.screenState ?? null };
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
  const was = draft ? oneRow(draft) : null;
  let screenState = null, draftLeft = null;
  for (let i = 0; i < Math.max(1, reads); i += 1) {
    if (i > 0 || draft) sleep(intervalMs);
    const after = readFrame();
    if (after == null) continue;
    screenState = classifyAgentScreen(after.frame, { stagedPattern, sentText }).state;
    draftLeft = was && after.draft && oneRow(after.draft) === was ? after.draft : null;
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
