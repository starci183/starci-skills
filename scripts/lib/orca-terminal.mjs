// orca-terminal.mjs — the pure reads of an Orca terminal answer (scripts/api/orca/terminal-read.mjs and
// terminal-show.mjs return them): the rendered frame, the unsubmitted draft, and the typed refusals that prove a
// handle names no terminal. Pure.

/** The rendered rows of a terminal answer: its screen, its tail lines, else its preview. */
export function frameText(terminal) {
  if (!terminal) return '';
  if (typeof terminal.screen === 'string') return terminal.screen;
  if (Array.isArray(terminal.tail)) return terminal.tail.join('\n');
  if (typeof terminal.tail === 'string') return terminal.tail;
  return terminal.preview ?? '';
}

/**
 * The unsubmitted text an agent's input box holds, or null. Orca's `terminal read` answers it as
 * `draft` beside the frame and leaves it OUT of the rendered rows: a Kernel whose input box held
 * '[watchdog] wake: starci kernel status' (2026-09-25) showed a bare '❯' on every screen read, so a send without
 * Enter, or one whose Enter was dropped, left text no reader saw, and the next send appended to it.
 * Whitespace alone is no draft.
 */
export const draftText = (terminal) => (typeof terminal?.draft === 'string' && terminal.draft.trim() ? terminal.draft : null);

// The typed Orca refusals that prove a handle names no terminal on a running
// host: the terminal is gone, not merely unreadable. Only codes observed from
// a live Orca belong here (terminal_handle_stale, 2026-09-23).
export const TERMINAL_GONE_CODES = new Set(['terminal_handle_stale']);
