// clear-draft.mjs — empty an agent's input box before the runtime types into it, and tell a real
// draft from a stale one.
//
// Orca's `terminal read` answers the text sitting unsubmitted in an agent's input box as `draft` and
// leaves it out of the frame (scripts/lib/orca-terminal.mjs draftText). Anything typed next is appended to
// that text: on a product's collab Kernel (2026-09-25) a dropped Enter left a wake in the box and each
// later wake piled onto it. Ctrl+U deletes one input row back to its start in the Claude, Codex and
// Devin TUIs, so a multi-row draft needs several; the draft is re-read after each and the helper stops
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
import { draftText } from '../lib/orca-terminal.mjs';
import { sleepSync } from '../lib/sleep-sync.mjs';
import { squash } from '../lib/clip.mjs';
import { allocationMs } from '../../engine/config.mjs';

const CTRL_U = '\u0015';
const CLEAR_DRAFT_ATTEMPTS = 8;
// The beat between a Ctrl+U and the re-read (a TUI repaints a beat later) —
// modules/models/runtimes.yaml allocation.draft.intervalMs.
export const CLEAR_DRAFT_INTERVAL_MS = allocationMs('draft.intervalMs');
export const DRAFT_STALE = 'draft-stale';

/** True when two drafts read as the same text (whitespace collapsed). */
export const sameDraft = (a, b) => squash(a) === squash(b);

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

/** Read an unknown draft without sending keys; reported text holds even when Orca may show stale input. */
export function probeDraft({ terminal, deps = {} } = {}) {
  const first = draftReader(deps.read ?? terminalRead, terminal)();
  if (!first) return { verdict: 'unreadable', draft: null, sends: 0 };
  return { verdict: first.draft ? 'real' : 'none', draft: first.draft ?? null, sends: 0 };
}
