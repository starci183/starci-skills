// clear-draft.mjs — empty an agent's input box before the runtime types into it, and tell a real
// draft from a stale one.
//
// Orca's `terminal read` answers the text sitting unsubmitted in an agent's input box as `draft` and
// leaves it out of the frame (scripts/api/orca/lib.mjs draftText). Anything typed next is appended to
// that text: on the nivo collab Kernel (2026-09-25) a dropped Enter left a wake in the box and each
// later wake piled onto it. Ctrl+U deletes one input row back to its start in the Claude, Codex and
// Qwen TUIs, so a multi-row draft needs several; the draft is re-read after each and the helper stops
// the moment it reads empty, after `attempts` Ctrl+U at most.
//
// A draft can also be STALE on Orca's side. Orca blanks the input row of every screen read that
// carries a draft (its screen read writes the bare prompt glyph over the row the draft came from), so
// the screen cannot tell a real draft from a stale one. Orca's draft is the text after the cursor too,
// and a Claude Code prompt suggestion, drawn grey in the empty box, reads the same. On the sn-foundation
// Kernel (term_da5f72b3, 2026-09-25) Orca reported 'check status' that 8×Ctrl+U, Ctrl+E+Ctrl+U and
// Ctrl+C never changed while the box was empty on screen; a fresh send landed cleanly and the draft
// then read empty. Every wake had been refused foreign-input / draft-stuck and the Kernel looked
// unreachable. What decides is the box's answer to one Ctrl+U: typed text loses a row (or the part
// before the cursor), a stale draft does not change at all. A draft the FIRST Ctrl+U leaves unchanged
// (read twice) is `draft-stale`: recorded as a note, never a refusal, and the caller types as if the
// box were empty; the delivery proof after the send stays the backstop. A draft that changes is real
// and keeps every protection (foreign-input, draft-stuck).
import { terminalRead } from '../api/orca/terminal-read.mjs';
import { terminalSend } from '../api/orca/terminal-send.mjs';
import { draftText, sleepSync } from '../api/orca/lib.mjs';
import { collapse } from './terminal-liveness.mjs';

export const CTRL_U = '\u0015';
export const CLEAR_DRAFT_ATTEMPTS = 8;
export const CLEAR_DRAFT_INTERVAL_MS = 300;
export const DRAFT_STALE = 'draft-stale';

/** True when two drafts read as the same text (whitespace collapsed). */
export const sameDraft = (a, b) => collapse(a) === collapse(b);

const depsOf = (deps) => ({ read: deps.read ?? terminalRead, send: deps.send ?? terminalSend, sleep: deps.sleep ?? sleepSync });
const draftReader = (read, terminal) => () => {
  try { const r = read({ terminal, screen: true }); return r?.ok ? { draft: draftText(r) } : null; } catch { return null; }
};

// One Ctrl+U and the box's answer: {sends, now, unchanged} (now null: unreadable). A draft that reads
// the same after it is read once more before it is called unchanged: a TUI repaints a beat later.
function ctrlUProbe({ terminal, draft, intervalMs, read, send, sleep }) {
  try { send({ terminal, text: CTRL_U, enter: false }); } catch { /* the re-read decides */ }
  sleep(intervalMs);
  let now = read();
  if (now && sameDraft(now.draft, draft)) { sleep(intervalMs); now = read() ?? now; }
  return { sends: 1, now, unchanged: Boolean(now) && sameDraft(now.draft, draft) };
}

/**
 * Send Ctrl+U to `terminal` until its draft reads empty, at most `attempts` times. Never throws.
 * Returns {ok, cleared, sends, initial, draft, stale?, note?, reason?}: ok when the box ends empty
 * (cleared: it held a draft first), `draft` what is left, reason 'unreadable' when a read failed,
 * 'draft-stuck' when a draft that shrank ran out of attempts. A draft the first Ctrl+U leaves
 * unchanged is stale on Orca's side: ok, stale:true, note 'draft-stale', `draft` the stale text.
 * `deps` ({read, send, sleep}) replaces the Orca wrappers in specs.
 */
export function clearDraft({ terminal, attempts = CLEAR_DRAFT_ATTEMPTS, intervalMs = CLEAR_DRAFT_INTERVAL_MS, deps = {} } = {}) {
  const { read: readRaw, send, sleep } = depsOf(deps);
  const read = draftReader(readRaw, terminal);
  const first = read();
  if (!first) return { ok: false, cleared: false, sends: 0, initial: null, draft: null, reason: 'unreadable' };
  if (!first.draft) return { ok: true, cleared: false, sends: 0, initial: null, draft: null };
  const probe = ctrlUProbe({ terminal, draft: first.draft, intervalMs, read, send, sleep });
  if (!probe.now) return { ok: false, cleared: false, sends: probe.sends, initial: first.draft, draft: first.draft, reason: 'unreadable' };
  if (probe.unchanged) return { ok: true, cleared: false, stale: true, note: DRAFT_STALE, sends: probe.sends, initial: first.draft, draft: probe.now.draft };
  let now = probe.now, sends = probe.sends;
  while (now.draft && sends < attempts) {
    try { send({ terminal, text: CTRL_U, enter: false }); } catch { /* the re-read decides */ }
    sends += 1;
    sleep(intervalMs);
    const next = read();
    if (!next) return { ok: false, cleared: false, sends, initial: first.draft, draft: now.draft, reason: 'unreadable' };
    now = next;
  }
  const ok = !now.draft;
  return { ok, cleared: ok, sends, initial: first.draft, draft: now.draft, ...(ok ? {} : { reason: 'draft-stuck' }) };
}

/**
 * Is the draft in `terminal`'s input box real? For a draft the runtime will NOT clear (foreign text):
 * one Ctrl+U, and the box's answer decides. Never throws. Returns {verdict, draft, sends, ...}:
 *  - 'none'        no draft (anymore);
 *  - 'stale'       the Ctrl+U left it unchanged: note 'draft-stale', type as if the box were empty;
 *  - 'real'        it changed: typed text. `removed` is the text the Ctrl+U deleted (null when the
 *                  change is not a plain cut). With `restore`, what it deleted from a one-row draft is
 *                  typed back (enter:false) and `restored` says whether the box reads the original
 *                  again; a row cut from a multi-row draft is not retyped (a newline typed into an agent
 *                  box can submit it): restored:false, and the caller reports `removed`;
 *  - 'unreadable'  a read failed: treat as real.
 */
export function probeDraft({ terminal, restore = true, intervalMs = CLEAR_DRAFT_INTERVAL_MS, deps = {} } = {}) {
  const { read: readRaw, send, sleep } = depsOf(deps);
  const read = draftReader(readRaw, terminal);
  const first = read();
  if (!first) return { verdict: 'unreadable', draft: null, sends: 0 };
  if (!first.draft) return { verdict: 'none', draft: null, sends: 0 };
  const probe = ctrlUProbe({ terminal, draft: first.draft, intervalMs, read, send, sleep });
  if (!probe.now) return { verdict: 'unreadable', draft: first.draft, sends: probe.sends };
  if (probe.unchanged) return { verdict: 'stale', note: DRAFT_STALE, draft: first.draft, sends: probe.sends };
  const initial = String(first.draft).trim(), after = String(probe.now.draft ?? '').trim();
  // Ctrl+U deleted from the cursor back to the row start: on one row, what is left is the draft's tail;
  // on the last of several rows, its head.
  const removed = !after ? initial
    : initial.endsWith(after) ? initial.slice(0, initial.length - after.length)
    : initial.startsWith(after) ? initial.slice(after.length).replace(/^\n/, '')
    : null;
  const retype = restore && removed && !/\n/.test(initial) && initial.endsWith(after);
  let restored = false, sends = probe.sends;
  if (retype) {
    try { send({ terminal, text: removed, enter: false }); } catch { /* the re-read decides */ }
    sends += 1;
    sleep(intervalMs);
    restored = sameDraft(read()?.draft, initial);
  }
  return { verdict: 'real', draft: first.draft, after: probe.now.draft ?? null, removed, restored, sends };
}
