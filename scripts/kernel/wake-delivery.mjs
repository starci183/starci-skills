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
import { terminalRead } from '../api/orca/terminal-read.mjs';
import { terminalSend } from '../api/orca/terminal-send.mjs';
import { sleepSync } from '../api/orca/lib.mjs';
import { classifyAgentScreen, wakeDeliveryOf, DEFAULT_STAGED_PATTERN } from './terminal-liveness.mjs';

const PROVEN = new Set(['delivered', 'queued']);
const WAITING_FOR_ENTER = new Set(['staged-input', 'queued-input']);
export const WAKE_PROOF_READS = 3;
export const WAKE_PROOF_INTERVAL_MS = 1000;

const sendCodeOf = (sent) => sent?.errorCode ?? sent?.enterRetry?.after ?? null;

const screenReader = (read, terminal) => () => {
  try {
    const r = read({ terminal, screen: true });
    return r?.ok ? String(r.screen ?? '') : null;
  } catch { return null; }
};

/**
 * Type `text` into `terminal` with Enter and prove from the screen what happened.
 * Returns {ok, delivery, evidence, sent, sendErrorCode, enterRetried, screenState}.
 * `deps` ({read, send, sleep}) replaces the Orca wrappers in unit specs.
 */
export function sendWakeWithProof({ terminal, text, stagedPattern = DEFAULT_STAGED_PATTERN, reads = WAKE_PROOF_READS,
  intervalMs = WAKE_PROOF_INTERVAL_MS, deps = {} }) {
  const read = screenReader(deps.read ?? terminalRead, terminal);
  const send = deps.send ?? terminalSend, sleep = deps.sleep ?? sleepSync;
  const before = read() ?? '';
  const sent = send({ terminal, text, enter: true });
  let proof = null, enterRetried = false;
  // A confirmed send needs one look (queued vs delivered); an unconfirmed one
  // gets a few, because a TUI repaints the queued text a beat later.
  const attempts = sent?.ok ? 1 : Math.max(1, reads);
  for (let i = 0; i < attempts + (enterRetried ? 1 : 0); i += 1) {
    if (i > 0) sleep(intervalMs);
    const after = read();
    if (after == null) continue;
    proof = wakeDeliveryOf({ before, after, text, stagedPattern });
    if (PROVEN.has(proof.delivery) && !WAITING_FOR_ENTER.has(proof.screenState)) break;
    if (WAITING_FOR_ENTER.has(proof.screenState) && !enterRetried) {
      enterRetried = true;
      send({ terminal, text: '', enter: true });
    }
  }
  const screenDelivery = proof?.delivery ?? 'unreadable';
  const waiting = WAITING_FOR_ENTER.has(proof?.screenState);
  const delivery = PROVEN.has(screenDelivery) && !waiting ? screenDelivery
    : sent?.ok && !waiting ? 'delivered'
    : 'failed';
  const evidence = PROVEN.has(screenDelivery) && !waiting ? (screenDelivery === 'queued' ? 'queued-marker' : 'wake-text')
    : delivery === 'delivered' ? 'receipt'
    : screenDelivery;
  return { ok: delivery !== 'failed', delivery, evidence, sent, sendErrorCode: sendCodeOf(sent), enterRetried,
    screenState: proof?.screenState ?? null };
}

/**
 * One Enter-only send that submits text already staged in the input row, proven
 * the same way: the frame no longer reads staged-input for `sentText`.
 * Returns {ok, delivery, evidence, sent, sendErrorCode, screenState}.
 */
export function sendEnterWithProof({ terminal, sentText = null, stagedPattern = DEFAULT_STAGED_PATTERN,
  reads = WAKE_PROOF_READS, intervalMs = WAKE_PROOF_INTERVAL_MS, deps = {} }) {
  const read = screenReader(deps.read ?? terminalRead, terminal);
  const send = deps.send ?? terminalSend, sleep = deps.sleep ?? sleepSync;
  const sent = send({ terminal, text: '', enter: true });
  if (sent?.ok) return { ok: true, delivery: 'delivered', evidence: 'receipt', sent, sendErrorCode: null, screenState: null };
  let screenState = null;
  for (let i = 0; i < Math.max(1, reads); i += 1) {
    if (i > 0) sleep(intervalMs);
    const after = read();
    if (after == null) continue;
    screenState = classifyAgentScreen(after, { stagedPattern, sentText }).state;
    if (!WAITING_FOR_ENTER.has(screenState)) break;
  }
  const submitted = screenState != null && !WAITING_FOR_ENTER.has(screenState);
  return { ok: submitted, delivery: submitted ? 'delivered' : 'failed', evidence: submitted ? 'screen' : (screenState ?? 'unreadable'),
    sent, sendErrorCode: sendCodeOf(sent), screenState };
}
