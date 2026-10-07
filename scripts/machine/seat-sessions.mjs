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
export function recordedSeatTerminals(m, { limit = 500, eventPrefix = 'supervisor' } = {}) {
  const handles = new Set();
  for (const e of m.supEvents({ kinds: [`${eventPrefix}-booted`, `${eventPrefix}-restarted`], limit })) {
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
 * Every terminal that may send and coordinate a Run the runtime launches without a caller terminal: a connected writable plain
 * terminal (no agent session) of the runtime's own worktree that is neither a recorded seat session nor an open worker.
 * A foreign terminal (the owner's chat, another lane's shell) is never in it.
 */
export function entryTerminalsOf({ listing = null, recorded = new Set(), owned = new Set(), root = SKILL_ROOT } = {}) {
  return (listing?.terminals ?? []).filter((t) => t?.handle && t.connected !== false && t.writable !== false && !t.agentIdentity
    && !recorded.has(t.handle) && !owned.has(t.handle) && t.worktreePath && norm(t.worktreePath) === norm(root)).map((t) => t.handle);
}

/**
 * The sender terminal of the seat's Run: the caller's own ORCA_TERMINAL_HANDLE; else the first of entryTerminalsOf.
 * null = none.
 */
export function entryTerminalOf({ env = process.env, ...options } = {}) {
  return env.ORCA_TERMINAL_HANDLE || entryTerminalsOf(options)[0] || null;
}

export const NO_ENTRY_REMEDY = "no_active_sender_terminal: Orca needs a sender terminal for the seat's Run and none exists in the runtime's own worktree; open a terminal in the runtime's own worktree (its entry terminal) and run start-supervisor again";
