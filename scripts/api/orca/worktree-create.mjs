#!/usr/bin/env node
// Deep map WRAP WT1: the tree is Orca's; the per-repo cap, the ownership registry and the main-checkout assertion are the runtime's.
// worktree-create.mjs — the calls.yaml `worktree-create` call as a callable function.
// Internal entry: spawned by scripts/machine/worktree-orca.mjs; not invoked directly.
// Args: --repo <sel> --name <n> [--base-branch <ref>] [--setup run|skip|inherit] [--comment <t>]
// Always a top-level row (--no-parent). Orca picks the path and the branch (its name with '/' turned into '-', a -2
// suffix when taken); the receipt's worktree is what the caller records. Returns {ok, worktree: {id, path, branch, head}, error}.
import { orcaCall } from './lib.mjs';
import { arg } from '../../lib/cli-arg.mjs';

const branchOf = (ref) => (ref ? String(ref).replace(/^refs\/heads\//, '') : null);

export function worktreeCreate({ repo, name, baseBranch, setup = 'skip', comment }) {
  const r = orcaCall('worktree-create', { repo, name, 'base-branch': baseBranch, setup, 'no-parent': true, comment });
  const w = r.result?.worktree ?? null;
  return {
    ok: r.outcome === 'ok' && Boolean(w?.id && w?.path),
    outcome: r.outcome,
    worktree: w ? { id: w.id, path: w.path, branch: branchOf(w.branch), head: w.head ?? null } : null,
    errorCode: r.receipt?.error?.code ?? null,
    error: r.error,
    hostUnavailable: r.hostUnavailable === true,
  };
}

if (process.argv[1]?.endsWith('worktree-create.mjs')) {
  const argv = process.argv.slice(2);
  const out = worktreeCreate({ repo: arg(argv, 'repo'), name: arg(argv, 'name'), baseBranch: arg(argv, 'base-branch'), setup: arg(argv, 'setup') ?? 'skip', comment: arg(argv, 'comment') });
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}
