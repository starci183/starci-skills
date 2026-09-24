// clear-draft.mjs — empty an agent's input box before the runtime types into it.
//
// Orca's `terminal read` answers the text sitting unsubmitted in an agent's input box as `draft` and
// leaves it out of the frame (scripts/api/orca/lib.mjs draftText). Anything typed next is appended to
// that text: on the nivo collab Kernel (2026-09-25) a dropped Enter left a wake in the box and each
// later wake piled onto it. Ctrl+U deletes one input row back to its start in the Claude, Codex and
// Qwen TUIs, so a multi-row draft needs several; the draft is re-read after each and the helper stops
// the moment it reads empty, after `attempts` Ctrl+U at most.
import { terminalRead } from '../api/orca/terminal-read.mjs';
import { terminalSend } from '../api/orca/terminal-send.mjs';
import { draftText, sleepSync } from '../api/orca/lib.mjs';

export const CTRL_U = '\u0015';
export const CLEAR_DRAFT_ATTEMPTS = 8;
export const CLEAR_DRAFT_INTERVAL_MS = 300;

/**
 * Send Ctrl+U to `terminal` until its draft reads empty, at most `attempts` times. Never throws.
 * Returns {ok, cleared, sends, initial, draft, reason?}: ok when the box ends empty (cleared: it held
 * a draft first), `draft` what is left, reason 'unreadable' when a read failed, 'draft-stuck' when
 * the attempts ran out. `deps` ({read, send, sleep}) replaces the Orca wrappers in specs.
 */
export function clearDraft({ terminal, attempts = CLEAR_DRAFT_ATTEMPTS, intervalMs = CLEAR_DRAFT_INTERVAL_MS, deps = {} } = {}) {
  const read = deps.read ?? terminalRead, send = deps.send ?? terminalSend, sleep = deps.sleep ?? sleepSync;
  const draftNow = () => {
    try { const r = read({ terminal, screen: true }); return r?.ok ? { draft: draftText(r) } : null; } catch { return null; }
  };
  const first = draftNow();
  if (!first) return { ok: false, cleared: false, sends: 0, initial: null, draft: null, reason: 'unreadable' };
  let now = first, sends = 0;
  while (now.draft && sends < attempts) {
    try { send({ terminal, text: CTRL_U, enter: false }); } catch { /* the re-read decides */ }
    sends += 1;
    sleep(intervalMs);
    const next = draftNow();
    if (!next) return { ok: false, cleared: false, sends, initial: first.draft, draft: now.draft, reason: 'unreadable' };
    now = next;
  }
  const ok = !now.draft;
  return { ok, cleared: ok && Boolean(first.draft), sends, initial: first.draft, draft: now.draft, ...(ok ? {} : { reason: 'draft-stuck' }) };
}
