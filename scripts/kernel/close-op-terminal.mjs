// close-op-terminal.mjs — close a settled operation's Orca terminal so it stays closed.
import { terminalClose } from '../api/orca/terminal-close.mjs';
import { terminalList } from '../api/orca/terminal-list.mjs';
import { terminalShow, TERMINAL_GONE_CODES } from '../api/orca/terminal-show.mjs';
import { terminalRead } from '../api/orca/terminal-read.mjs';
import { exitedAgentPromptRow } from './terminal-liveness.mjs';

// An operation terminal is closed with its tab when nothing else lives in
// that tab. A pane close left the tab in Orca's persisted layout, and Orca
// brought the agent session back in a fresh tab under a new handle: five
// settled nivo op sessions (Codex and Claude) sat live as STRAY_TERMINAL, each
// resuming its finished transcript. `terminal close --tab` waits until the tab
// is durably removed. A terminal that shares its tab (or whose tab the listing
// does not name) keeps the pane close.
export const closeOperationTerminal = (handle, { tabOnly = false } = {}) => {
  let tabId = null, shared = true;
  try {
    const listed = terminalList();
    const rows = listed?.ok ? listed.terminals : [];
    tabId = rows.find((t) => t?.handle === handle)?.tabId ?? null;
    shared = !tabId || rows.some((t) => t?.handle !== handle && t?.tabId === tabId && t?.connected !== false);
  } catch { /* an unreadable listing keeps the pane close */ }
  if (!shared) {
    const byTab = terminalClose({ terminal: handle, tab: true });
    if (byTab.ok || tabOnly) return { ...byTab, tab: tabId };
  }
  if (tabOnly) return null;
  return terminalClose({ terminal: handle });
};

// A terminal whose agent is gone is closed only on proof: a responding Orca
// shows it disconnected/unwritable, or its frame ENDS in a bare shell prompt
// (terminal-liveness.mjs exitedAgentPromptRow - the agent exited and left its
// host shell). Anything else - an agent screen, an unreadable frame, an Orca
// that does not answer - is left open and says why. A handle a running Orca
// no longer knows is gone: nothing to close. Used for a dead worker's shell
// (api reconcile --dead-worker) and an exited kernel's shell (start-workflow).
// Returns {handle, closed, proof: disconnected|shell-prompt|gone|null, shellPrompt?, tab?, reason?, error?}.
export const closeExitedTerminal = (handle, { show = terminalShow, read = terminalRead, close = closeOperationTerminal } = {}) => {
  if (!handle) return null;
  let shown;
  try { shown = show({ terminal: handle }); } catch (error) { shown = { ok: false, error: String(error?.message ?? error) }; }
  if (!shown?.ok) {
    if (!shown?.hostUnavailable && TERMINAL_GONE_CODES.has(shown?.errorCode)) return { handle, closed: false, proof: 'gone' };
    return { handle, closed: false, proof: null, reason: shown?.hostUnavailable ? 'host-unavailable' : 'unverified',
      ...(shown?.error || shown?.errorCode ? { error: String(shown.error || shown.errorCode) } : {}) };
  }
  let proof = 'disconnected', shellPrompt = null;
  if (shown.connected === true && shown.writable === true) {
    let screen = null;
    try { const frame = read({ terminal: handle, screen: true }); if (frame?.ok) screen = String(frame.screen ?? ''); } catch { /* unreadable proves nothing */ }
    shellPrompt = screen == null ? null : exitedAgentPromptRow(screen);
    if (!shellPrompt) return { handle, closed: false, proof: null, reason: screen == null ? 'unreadable' : 'agent-screen' };
    proof = 'shell-prompt';
  }
  let closed;
  try { closed = close(handle); } catch (error) { closed = { ok: false, error: String(error?.message ?? error) }; }
  return { handle, closed: closed?.ok === true, proof, ...(shellPrompt ? { shellPrompt } : {}),
    ...(closed?.tab ? { tab: closed.tab } : {}), ...(closed?.error ? { error: String(closed.error) } : {}) };
};
