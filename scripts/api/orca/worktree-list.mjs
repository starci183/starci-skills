#!/usr/bin/env node
// Deep map WRAP WT1: the inventory is Orca's; the registry, cap and owner stay the runtime's.
// worktree-list.mjs — the calls.yaml `worktree-list` call as a callable function.
// Internal entry: spawned by scripts/kernel/launch-smoke.mjs; not invoked directly.
// Args: [--repo <sel>]
// Returns {ok, worktrees: [{id, path, branch, displayName, isMainWorktree}], error}.
import { orcaCall, runAsCli } from './lib.mjs';
import { arg } from '../../lib/cli-arg.mjs';

export function worktreeList({ repo } = {}) {
  const r = orcaCall('worktree-list', { repo });
  const rows = Array.isArray(r.result?.worktrees) ? r.result.worktrees : [];
  return {
    ok: r.outcome === 'ok',
    worktrees: rows.map((w) => ({ id: w.id, path: w.path, branch: w.branch ? String(w.branch).replace(/^refs\/heads\//, '') : null,
      displayName: w.displayName ?? null, isMainWorktree: w.isMainWorktree === true })),
    error: r.error,
    hostUnavailable: r.hostUnavailable === true,
  };
}

runAsCli('worktree-list.mjs', (argv) => worktreeList({ repo: arg(argv, 'repo') }));
