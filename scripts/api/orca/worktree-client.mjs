// worktree-client.mjs — the Orca worktree calls the runtime makes (the calls.yaml wrappers beside this file), as one
// client object: worktree-provision.mjs and worktree-remove.mjs take it as their `orca` seam, and specs pass a fake with
// the same shape (tests/helpers/fake-orca-worktrees.mjs).
import { worktreeCreate } from './worktree-create.mjs';
import { worktreeRm } from './worktree-rm.mjs';
import { worktreePs } from './worktree-ps.mjs';
import { repoAdd } from './repo-add.mjs';

// ps (worktree-ps.mjs) is the worktree GC's source of truth (scripts/lib/worktrees.mjs gcWorktrees).
export const orcaWorktreeClient = Object.freeze({ create: worktreeCreate, remove: worktreeRm, ps: worktreePs, addRepo: repoAdd });
