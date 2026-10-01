// seat-sessions.mjs — which Orca terminals are Supervisor SEAT sessions, and which terminal sends the seat's Run.
//
// Ownership, never a title: a terminal is a seat session only when machine.sqlite sup_events records it as one (the
// terminal of a supervisor-booted / supervisor-restarted event, or the `previous` seat a restart retired). A terminal
// that merely carries "[Supervisor]" in its title (a launch smoke, an owner-opened or foreign session) has no record
// and is never a duplicate: it is never quit and never closed.
//
// The sender: run-create / task-create / worker-start need a sender terminal (--from), else Orca refuses
// no_active_sender_terminal. The reconciler has no ORCA_TERMINAL_HANDLE, and the runtime never creates a terminal
// itself (scripts/checks/check-host-boundary.mjs), so `entryTerminalOf` names one that already exists.
import path from 'node:path';
import { SKILL_ROOT } from './home.mjs';

/** Every terminal handle sup_events records as a seat session: Set<string>. */
export function recordedSeatTerminals(m, { limit = 500 } = {}) {
  const handles = new Set();
  for (const e of m.supEvents({ kinds: ['supervisor-booted', 'supervisor-restarted'], limit })) {
    for (const h of [e.payload?.terminal, e.payload?.previous?.terminal]) if (h) handles.add(h);
  }
  return handles;
}

/**
 * The seat sessions among an Orca listing: connected terminals whose handle is recorded. `tabTitlesOf` only labels
 * them. Returns [{handle, tabTitle, paneTitle, agent, worktreePath}].
 */
export function seatSessions(listing, recorded, tabTitlesOf = () => new Map()) {
  const terminals = listing?.terminals ?? [];
  const tabs = tabTitlesOf(listing?.visualLayouts ?? [], terminals);
  return terminals.filter((t) => t?.handle && t.connected !== false && recorded.has(t.handle))
    .map((t) => ({ handle: t.handle, tabTitle: tabs.get(t.handle) ?? null, paneTitle: t.title ?? null, agent: t.agentIdentity ?? null, worktreePath: t.worktreePath ?? null }));
}

const norm = (p) => path.resolve(String(p ?? '')).replaceAll('\\', '/').toLowerCase();

/**
 * The sender terminal of the seat's Run: the caller's own ORCA_TERMINAL_HANDLE; else an existing writable terminal
 * of the runtime's own worktree; else any other writable terminal no seat session or open worker owns. null = none.
 */
export function entryTerminalOf({ env = process.env, listing = null, recorded = new Set(), owned = new Set(), root = SKILL_ROOT } = {}) {
  if (env.ORCA_TERMINAL_HANDLE) return env.ORCA_TERMINAL_HANDLE;
  const free = (listing?.terminals ?? []).filter((t) => t?.handle && t.connected !== false && t.writable !== false && !recorded.has(t.handle) && !owned.has(t.handle));
  return (free.find((t) => t.worktreePath && norm(t.worktreePath) === norm(root)) ?? free[0])?.handle ?? null;
}
