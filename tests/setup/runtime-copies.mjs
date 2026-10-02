// runtime-copies.mjs - the node --test preload that regenerates the packages' git-ignored runtime/ copies before a spec
// links its imports: `node --test` runs every --import in each spec's child process first, so a spec importing package
// sources resolves the copies even in a fresh checkout (or a land scratch worktree) that has none.
import { driftOfRuntime, syncRuntime } from '../../scripts/hfs/sync-runtime.mjs';

if (driftOfRuntime().length) syncRuntime();
