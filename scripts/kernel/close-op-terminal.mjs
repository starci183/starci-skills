// close-op-terminal.mjs — close a settled operation's Orca terminal so it stays closed.
import { terminalClose } from '../api/orca/terminal-close.mjs';
import { terminalList } from '../api/orca/terminal-list.mjs';

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
