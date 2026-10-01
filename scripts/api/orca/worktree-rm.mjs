#!/usr/bin/env node
// Deep map WRAP WT1, WT6: links are removed as links before the rm, and the git branch -d fallback stays (Orca deletes a branch only when it proves the merge).
// worktree-rm.mjs — the calls.yaml `worktree-rm` call as a callable function.
//   node scripts/api/orca/worktree-rm.mjs --worktree <sel> [--force]
// Removes the worktree from Orca and git. Called only by scripts/machine/worktree-orca.mjs removeOrcaWorktree, after every link
// in the tree was removed as a link. Returns {ok, removed, error}.
import { orcaCall, arg, flag } from './lib.mjs';

export function worktreeRm({ worktree, force = false }) {
  const r = orcaCall('worktree-rm', { worktree, force });
  return {
    ok: r.outcome === 'ok' && r.result?.removed === true,
    outcome: r.outcome,
    removed: r.result?.removed === true,
    errorCode: r.receipt?.error?.code ?? null,
    error: r.error,
    hostUnavailable: r.hostUnavailable === true,
  };
}

if (process.argv[1]?.endsWith('worktree-rm.mjs')) {
  const argv = process.argv.slice(2);
  const out = worktreeRm({ worktree: arg(argv, 'worktree'), force: flag(argv, 'force') });
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}
