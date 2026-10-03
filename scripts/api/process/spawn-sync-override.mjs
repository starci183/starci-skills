// spawn-sync-override.mjs — run a function with node:child_process spawnSync replaced process-wide, then restore it: the
// Kernel's `starci kernel status` answers prefetched Orca reads and memoises read-only git reads this way (scripts/kernel/cli.mjs
// withStatusSpawnMemo), and records the spawns a read would make instead of running them (recordSpawns). Every api
// system's spawnSync - a named import included (syncBuiltinESMExports) - sees the replacement while `fn` runs.
import cp from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';

/**
 * fn() with spawnSync = make(current spawnSync); `make` returning null leaves spawnSync as it is (an override already in
 * place). The original is restored after `fn`, also when it throws. Returns fn's result.
 */
export function spawnSyncOverride(make, fn) {
  const original = cp.spawnSync;
  const replacement = make(original);
  if (!replacement) return fn();
  cp.spawnSync = replacement;
  syncBuiltinESMExports();
  try { return fn(); } finally { cp.spawnSync = original; syncBuiltinESMExports(); }
}
