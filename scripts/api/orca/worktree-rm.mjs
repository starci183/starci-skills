#!/usr/bin/env node
// Deep map WRAP WT1, WT6: links are removed as links before the rm, and the git branch -d fallback stays (Orca deletes a branch only when it proves the merge).
// worktree-rm.mjs — the calls.yaml `worktree-rm` call as a callable function.
// Internal entry: spawned by scripts/machine/worktree-orca.mjs; not invoked directly.
// Args: --worktree <sel> [--force]
// Removes the worktree from Orca and git. Called only by scripts/machine/worktree-orca.mjs removeOrcaWorktree, after every link
// in the tree was removed as a link. Returns {ok, removed, error}.
import { orcaCall } from './lib.mjs';
import { arg, flag } from '../../lib/cli-arg.mjs';

/**
 * Ask Orca to remove the exact caller-admitted worktree and its Git registration.
 * removeOrcaWorktree owns preservation, link removal, main-checkout protection, and readback; this
 * wrapper does not establish those preconditions. force forwards a host option, not new authority.
 * ok requires both a classified successful outcome and removed true; an unknown receipt keeps custody.
 * @param {object} input - Required worktree selector and optional force.
 * @returns {object} Outcome, confirmed removal, typed error, and hostUnavailable.
 */
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
