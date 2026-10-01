// worktree-client.mjs — the Orca worktree calls the runtime makes (the calls.yaml wrappers beside this file), as one
// client object: worktree-provision.mjs and worktree-remove.mjs take it as their `orca` seam, and specs pass a fake with
// the same shape (tests/helpers/fake-orca-worktrees.mjs).
import { worktreeCreate } from './worktree-create.mjs';
import { worktreeRm } from './worktree-rm.mjs';
import { worktreeList } from './worktree-list.mjs';
import { repoAdd } from './repo-add.mjs';

export const orcaWorktreeClient = Object.freeze({ create: worktreeCreate, remove: worktreeRm, list: worktreeList, addRepo: repoAdd });
