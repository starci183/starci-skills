// turn-start.mjs - a worker-start whose turn start Orca could not observe (outcome_unknown, stage turn_start_unobserved).
//
// Orca types the Task spec into the agent's TUI and presses Enter. A TUI that folds a large paste into a chip ("[Pasted Content N chars]",
// Codex 0.160) can swallow that Enter: the terminal then shows the idle agent with the prompt sitting UNSUBMITTED in the input box, and
// Orca answers outcome_unknown. That frame is a known state, not a mystery: the runtime launched the terminal, so it may press Enter once
// itself. When the frame then shows the turn begun (or the chip gone), the start stands. Anything else is a launch that is not proven
// started: it is refused TURN_START_UNOBSERVED with the terminal named, and the caller closes the worker and its terminal before any
// next try - never a terminal left alive and unowned, never `terminal: null`.
import { terminalSend } from '../api/orca/terminal-send.mjs';
import { terminalRead } from '../api/orca/terminal-read.mjs';
import { sleepSync } from '../lib/sleep-sync.mjs';
import { frameWithDraft, WAKE_PROOF_INTERVAL_MS, WAKE_PROOF_READS } from '../lib/terminal-liveness.mjs';

/** A prompt the runtime sent was not seen submitted, twice: a transient launch fault (never quota, never the model). */
export const PROMPT_DELIVERY_STALLED = 'prompt-delivery-stalled';
/** The catalogued code of a worker-start whose turn start stayed unobserved after the one lawful re-submit. */
export const TURN_START_UNOBSERVED = 'TURN_START_UNOBSERVED';

const UNOBSERVED = /turn_start_unobserved/;
const PASTE_CHIP = /\[Pasted (?:Content|text)[^\]]*\]/i;
const ACTIVITY = /esc to (?:interrupt|cancel)|Working|Thinking|tokens \d+/i;

/** True when a worker-start receipt says the turn start could not be observed. */
export const turnStartUnobserved = (started) => UNOBSERVED.test(JSON.stringify([started?.result ?? null, started?.errorReceipt ?? null, started?.error ?? null]));

/** The frame of a terminal with the input box's draft written back: {ok, screen}. */
function frameOf(terminal, read) {
  const r = read({ terminal });
  return r?.ok ? { ok: true, screen: frameWithDraft(r.screen ?? '', r.draft) } : { ok: false, screen: '' };
}

/**
 * Proves or repairs one unobserved turn start on `terminal`. Returns {state: 'submitted'|'resubmitted'|'unsubmitted'|'unreadable', screen}:
 * the turn already runs (submitted), the chip was there and one Enter started the turn (resubmitted), the chip is still in the input box or the
 * frame shows no turn (unsubmitted), the frame cannot be read (unreadable). `io` {read, send, sleep} replaces the Orca wrappers in unit specs.
 */
export function resubmitUnobservedTurn({ terminal, io = null }) {
  const read = io?.read ?? terminalRead, send = io?.send ?? terminalSend, sleep = io?.sleep ?? sleepSync;
  const first = frameOf(terminal, read);
  if (!first.ok) return { state: 'unreadable', screen: first.screen };
  if (ACTIVITY.test(first.screen) && !PASTE_CHIP.test(first.screen)) return { state: 'submitted', screen: first.screen };
  if (!PASTE_CHIP.test(first.screen)) return { state: 'unsubmitted', screen: first.screen };
  send({ terminal, text: '', enter: true });
  let screen = first.screen;
  for (let i = 0; i < WAKE_PROOF_READS; i += 1) {
    sleep(WAKE_PROOF_INTERVAL_MS);
    const next = frameOf(terminal, read);
    if (!next.ok) continue;
    screen = next.screen;
    if (!PASTE_CHIP.test(screen)) return { state: 'resubmitted', screen };
  }
  return { state: 'unsubmitted', screen };
}
