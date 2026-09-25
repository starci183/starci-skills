// quit-agent.mjs — ask a settled op's agent CLI to exit on its own before its
// terminal is released or closed.
//
// Closing an agent's pane from outside left its Claude/Codex process running
// hidden (Orca: stop_unverified, no renderer pane). Matching the orphan back to
// a pid by start time failed whenever ops launched together: three Mia Mia
// architecture.decide workers started inside one window and the reaper, rightly,
// refused to guess. An agent that quits itself leaves no process behind, so
// settle first types the CLI's own quit command and waits briefly for the
// terminal to disconnect; the release/close that follows then finds nothing
// running. A busy agent queues the command and quits when its turn ends.
import { terminalSend } from '../api/orca/terminal-send.mjs';
import { terminalShow } from '../api/orca/terminal-show.mjs';
import { terminalRead } from '../api/orca/terminal-read.mjs';
import { exitedAgentPromptRow, clipDraft } from './terminal-liveness.mjs';
import { clearDraft } from './clear-draft.mjs';
import { draftText, sleepSync } from '../api/orca/lib.mjs';
import { allocationMs } from '../../engine/config.mjs';

// The quit input each agent CLI understands at its prompt. Claude gets two
// Ctrl+C in one write, no Enter: Orca delivers `/exit` as pasted text, which
// Claude answers as a chat message instead of running the command — and where a
// prompt sat staged in the input box, `/exit` + Enter submitted that prompt and
// restarted a settled op (three leaked op terminals, 2026-09-24). The first
// Ctrl+C clears the input box, the second exits.
export const QUIT_COMMAND = { claude: '\u0003\u0003', codex: '/quit', qwen: '/quit' };
const QUIT_ENTER = { claude: false };
// modules/models/runtimes.yaml allocation.quitAgent.waitMs.
export const QUIT_WAIT_MS = allocationMs('quitAgent.waitMs');

/**
 * Type the agent's quit command into `handle` and wait up to `waitMs` for the
 * terminal to disconnect. Never throws. Returns {sent, exited, command} or null
 * when the agent has no known quit command or the terminal is not live; a
 * draft that Ctrl+U shrank but could not clear returns {sent:false, reason:'draft-stuck', draft}; a
 * stale draft (the first Ctrl+U left it unchanged) adds {draftNote:'draft-stale', staleDraft}.
 */
export function quitAgent({ handle, agent, waitMs = QUIT_WAIT_MS, intervalMs = 500,
  show = terminalShow, send = terminalSend, read = terminalRead, sleep = sleepSync } = {}) {
  const command = QUIT_COMMAND[agent];
  if (!handle || !command) return null;
  const connected = () => { try { const s = show({ terminal: handle }); return s?.ok === true ? s.connected === true : null; } catch { return null; } };
  if (connected() !== true) return null;
  // An agent that already exited left a bare shell: typing the quit input there would run it as a
  // shell command (a /quit or a Ctrl+C sent to PowerShell). Nothing is typed; the close follows.
  let draft = null;
  try {
    const r = read({ terminal: handle, screen: true });
    if (r?.ok && exitedAgentPromptRow(r.screen)) return { sent: false, exited: true, command, agentExited: true };
    draft = r?.ok ? draftText(r) : null;
  } catch { /* unreadable: fall through */ }
  // Text left unsubmitted in the input box (Orca's `draft`, invisible in the frame) would take the
  // quit command as its tail: '<draft>/quit' + Enter submits the draft and restarts a settled op.
  // The box is emptied with Ctrl+U first; one that shrank but will not empty gets no quit input at all.
  // A draft the first Ctrl+U leaves unchanged is stale on Orca's side (clear-draft.mjs): the quit
  // command is typed as into an empty box, and the result carries draftNote 'draft-stale'.
  let note = {};
  if (draft) {
    const cleared = clearDraft({ terminal: handle, deps: { read, send, sleep } });
    if (!cleared.ok) return { sent: false, exited: false, command, reason: 'draft-stuck', draft: clipDraft(cleared.draft ?? draft) };
    if (cleared.stale) note = { draftNote: cleared.note, staleDraft: clipDraft(cleared.draft ?? draft) };
  }
  let sent = false;
  try { const r = send({ terminal: handle, text: command, enter: QUIT_ENTER[agent] ?? true }); sent = r?.ok === true || r?.errorCode === 'agent_prompt_stalled'; } catch { sent = false; }
  for (let waited = 0; waited < waitMs; waited += intervalMs) {
    sleep(intervalMs);
    if (connected() === false) return { sent, exited: true, command, ...note };
  }
  return { sent, exited: false, command, ...note };
}
