#!/usr/bin/env node
// Deep map WRAP WT1: the inventory is Orca's; the registry, cap and owner stay the runtime's.
// worktree-list.mjs — the calls.yaml `worktree-list` call as a callable function.
//   node scripts/api/orca/worktree-list.mjs [--repo <sel>]
// Returns {ok, worktrees: [{id, path, branch, displayName, isMainWorktree}], error}.
import { orcaCall, arg } from './lib.mjs';

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

if (process.argv[1]?.endsWith('worktree-list.mjs')) {
  const out = worktreeList({ repo: arg(process.argv.slice(2), 'repo') });
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}
