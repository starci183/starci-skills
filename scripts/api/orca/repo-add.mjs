#!/usr/bin/env node
// Deep map WRAP P2: registration is Orca's; it runs only on repo_not_found inside the runtime's create.
// repo-add.mjs — the calls.yaml `repo-add` call as a callable function.
// Internal entry: spawned by scripts/machine/worktree-orca.mjs; not invoked directly.
// Args: --path <repo>
// Registers a git repository with Orca (idempotent). Returns {ok, repoId, error}.
import { orcaCall } from './lib.mjs';
import { arg } from '../../lib/cli-arg.mjs';

export function repoAdd({ path }) {
  const r = orcaCall('repo-add', { path });
  return { ok: r.outcome === 'ok' && Boolean(r.result?.repo?.id), repoId: r.result?.repo?.id ?? null, errorCode: r.receipt?.error?.code ?? null, error: r.error,
    hostUnavailable: r.hostUnavailable === true };
}

if (process.argv[1]?.endsWith('repo-add.mjs')) {
  const out = repoAdd({ path: arg(process.argv.slice(2), 'path') });
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}
