// wake-bound.mjs — a wake typed into a Kernel's input box stays under the size Claude Code folds into a pasted_content block.
//
// Claude Code folds a paste of about 800 characters or more into a block the model reads as untrusted pasted data. On 2026-10-07
// the Kernel of a real workflow received twelve wakes of 1218 to 1242 characters as pasted blocks and refused three of them,
// while all sixteen wakes of 730 characters or fewer arrived as the user's message. The cap is allocation.wake.maxChars
// (modules/models/runtimes.yaml). A wake over it keeps its opener and the seat identity and points at `starci kernel status` for
// the rest, the runtime-rev sentence first kept when it still fits.
import { allocationSettings } from '../../engine/config.mjs';

const POINTER = 'The rest is in starci kernel status.';
const OPENER_FALLBACK_CHARS = 200;

/** The declared cap on one typed wake; refuses when the contract omits it. */
export function wakeMaxChars() {
  const max = Number(allocationSettings()?.wake?.maxChars);
  if (!Number.isInteger(max) || max <= 0) throw new Error('modules/models/runtimes.yaml allocation.wake.maxChars must declare a positive number of characters');
  return max;
}

const openerOf = (text) => {
  const end = text.indexOf('. ');
  return end > 0 ? text.slice(0, end + 1) : text.slice(0, OPENER_FALLBACK_CHARS);
};

/**
 * The text of one wake: `compose(text, workflowId, attempt, revLine)` (withWakeIdentity) when it fits the cap, else the opener of
 * `text` and the pointer composed the same way with the rev line, else without it, else with the opener cut to the room left.
 */
export function boundedWake({ text, workflowId, attempt, revLine = null, compose }) {
  const max = wakeMaxChars();
  const full = compose(text, workflowId, attempt, revLine);
  if (full.length <= max) return full;
  const short = `${openerOf(text)} ${POINTER}`;
  const withRev = compose(short, workflowId, attempt, revLine);
  if (withRev.length <= max) return withRev;
  const bare = compose(short, workflowId, attempt, null);
  if (bare.length <= max) return bare;
  const room = Math.max(0, short.length - (bare.length - max));
  return compose(short.slice(0, room), workflowId, attempt, null);
}
