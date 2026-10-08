// The scratch a dispatched op owns, obtained the way dispatch obtains it (ensureJobScratch): `starci kernel report`
// admits only the directory the runtime allocator binds to repository, workflow and job, so a hand-made temp
// directory is refused. Tests of one file may run concurrently under one temp root, so each repository removes only
// the directories it allocated, and the allocator's root goes when the last one is released.
import fs from 'node:fs';
import path from 'node:path';
import { tempRoot } from '../../engine/temp-root.mjs';
import { JOB_SCRATCH_ROOT, ensureJobScratch } from '../../scripts/kernel/op-prompt.mjs';

const live = new Map();
const rm = (target, options = {}) => fs.rmSync(target, { recursive: true, force: true, maxRetries: 20, retryDelay: 25, ...options });

/** Removes every scratch allocated for `repo` when test `t` ends, and the allocator's root once none is left. */
export function releaseDispatchedScratchAfter(t, repo) {
  const root = path.join(tempRoot(), JOB_SCRATCH_ROOT);
  t.after(() => {
    for (const [dir, owner] of live) if (owner === path.resolve(repo)) { rm(dir); live.delete(dir); }
    if (!live.size) rm(root);
  });
}

/** The job's scratch as dispatch allocates it for `repo`; the caller releases it with releaseDispatchedScratchAfter. */
export function allocateDispatchedScratch({ repo, workflowId, jobId }) {
  const dir = ensureJobScratch({ repo, workflowId, jobId });
  live.set(dir, path.resolve(repo));
  return dir;
}

/** allocateDispatchedScratch, released when test `t` ends. */
export function dispatchedScratch(t, args) {
  releaseDispatchedScratchAfter(t, args.repo);
  return allocateDispatchedScratch(args);
}
