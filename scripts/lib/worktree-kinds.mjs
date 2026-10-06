// worktree-kinds.mjs — the kinds of worktree the runtime registers (machine.sqlite worktrees.kind CHECK in
// engine/db/schema/machine.sql), split by the home that makes each: Orca (an agent's workspace) or git (a runtime-internal
// scratch tree). The registry (scripts/machine/worktree-registry.mjs), both homes (scripts/machine/worktree-git.mjs,
// scripts/machine/worktree-orca.mjs), the Orca orphan scan (orca-orphans.mjs) and check-worktree-add read them here.

/** The registry kinds. */
const WORKTREE_KINDS = Object.freeze(['workflow', 'critic', 'land-scratch', 'push-scratch', 'supervisor-staging', 'lane']);
/** The kinds Orca creates and removes: an agent's workspace. */
export const ORCA_KINDS = Object.freeze(['workflow', 'critic', 'supervisor-staging']);
/** The kinds the runtime creates with git: a runtime-internal scratch tree no agent works in. */
export const SCRATCH_KINDS = Object.freeze(WORKTREE_KINDS.filter((k) => !ORCA_KINDS.includes(k)));
