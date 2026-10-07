// seat-env.mjs — the seat identity one Orca terminal's environment claims, and the env a runtime child gets.
//
// Orca exports the terminal's identity into the shell it owns (ORCA_TERMINAL_HANDLE, ORCA_PANE_KEY, ORCA_TAB_ID,
// ORCA_WORKTREE_ID, ORCA_AGENT_* — the agent hook endpoint and token included), and a session can carry the caller
// markers STARCI_ROLE, STARCI_GUARD_FILE and STARCI_CALLER. Caller and guard logic binds a process to a seat by those
// variables (scripts/guards/op-caller.mjs callerOf, scripts/guards/command-policy.mjs shimDecision, the seat bindings of
// scripts/guards/hook-install.mjs), so a child the runtime spawns for its own work — a spec run of the land gate or
// `starci test run`, a staging `npm ci` and its lifecycle scripts, a package proof — that inherits them is admitted as
// the seat: a supervisor seat's `node install.js` reads as a raw supervisor tool call (RIGHTS_RAW_TOOL) and a spec's
// kernel call resolves the seat's custody (kernel-caller-unknown). The seat's own agent tool calls keep the identity;
// every other child of it gets this env.
/** The variables that bind a process to the calling seat or claim a caller identity. */
export const SEAT_ENV_VARS = Object.freeze(['ORCA_TERMINAL_HANDLE', 'ORCA_PANE_KEY', 'ORCA_TAB_ID', 'ORCA_WORKTREE_ID', 'STARCI_ROLE', 'STARCI_GUARD_FILE', 'STARCI_CALLER']);

/** `parent` (the caller's env) without the seat identity: a child that is not the seat's own agent tool call runs unbound. Pure — the caller names the env; the base tier never reads process.env itself (RT_BASE_IMPURE). */
export function withoutSeatEnv(parent) {
  const env = { ...parent };
  for (const key of Object.keys(env)) if (SEAT_ENV_VARS.includes(key) || key.startsWith('ORCA_AGENT_')) delete env[key];
  return env;
}
