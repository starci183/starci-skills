#!/usr/bin/env node
// worktree-ps.mjs — the calls.yaml `worktree-ps` call as a callable function.
//   node scripts/api/orca/worktree-ps.mjs [--limit <n>]
// Every worktree Orca knows across its covered hosts, with what the GC judges ownership and liveness by: the comment
// (the runtime's ownership stamp), liveTerminalCount and lastActivityAt. A page that is truncated or omits a host proves
// nothing about a tree it does not list (scripts/lib/orca-orphans.mjs psCoverage).
// Returns {ok, worktrees: [{id, repoId, hostId, path, branch, comment, isMainWorktree, liveTerminalCount, lastActivityAt,
// status}], truncated, omittedHostIds, error, hostUnavailable}.
import { orcaCall, arg } from './lib.mjs';

/** Rows asked per page: above any host's real count, so a page is complete unless Orca says it truncated it. */
export const PS_LIMIT = 10000;

export function worktreePs({ limit = PS_LIMIT } = {}) {
  const r = orcaCall('worktree-ps', { limit });
  const rows = Array.isArray(r.result?.worktrees) ? r.result.worktrees : [];
  return {
    ok: r.outcome === 'ok',
    worktrees: rows.map((w) => ({
      id: w.worktreeId ?? w.id ?? null, repoId: w.repoId ?? null, hostId: w.hostId ?? 'local', path: w.path ?? null,
      branch: w.branch ? String(w.branch).replace(/^refs\/heads\//, '') : null, comment: typeof w.comment === 'string' ? w.comment : '',
      isMainWorktree: w.isMainWorktree === true, liveTerminalCount: Number(w.liveTerminalCount) || 0, lastActivityAt: Number(w.lastActivityAt) || null,
      status: w.status ?? null,
    })),
    truncated: r.result?.truncated === true,
    omittedHostIds: Array.isArray(r.result?.hostScope?.omittedHostIds) ? r.result.hostScope.omittedHostIds.map(String) : [],
    error: r.error,
    hostUnavailable: r.hostUnavailable === true,
  };
}

if (process.argv[1]?.endsWith('worktree-ps.mjs')) {
  const n = Number(arg(process.argv.slice(2), 'limit'));
  const out = worktreePs(Number.isFinite(n) && n > 0 ? { limit: n } : {});
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}
