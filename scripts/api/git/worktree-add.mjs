// worktree-add.mjs — the only `git worktree add` of the runtime (scripts/checks/check-worktree-add.mjs fails any other,
// in this file outside createScratchWorktree too): a runtime-internal scratch tree no agent ever works in (land/push
// scratch, the verify-proof base tree, the supervisor's revert lane).
// Such a tree is created and removed (worktree-remove.mjs) by the same process; Orca never needs to see it. An agent's
// workspace is an Orca kind: scripts/api/orca/worktree-provision.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { gitRunner } from './lib.mjs';
import { mainRootOf, registeredAt } from './worktree-list.mjs';
import { revParse } from './rev-parse.mjs';
import { SCRATCH_KINDS, withRegistry, claimWorktree } from '../../lib/worktree-registry.mjs';

/**
 * Create one runtime-internal scratch worktree. kind: one of SCRATCH_KINDS - an agent's workspace is an Orca kind and is
 * refused here. Exactly one of `detach` (a detached HEAD at `base`), `newBranch` (branch `branch` created at `base`) or an
 * existing `branch`. owner: {ledgerId, workflowId, jobId, lane}. cap: none unless given. git: the caller's runner (args,
 * {cwd}) -> {ok|status, stdout|out, stderr|err}.
 * {ok, path, created, registered} | {ok:false, reason: 'worktree-cap'|'worktree-path-occupied'|'worktree-add-failed', detail?, live?, cap?}
 */
export function createScratchWorktree({ repoRoot, dir, kind, base = null, branch = null, newBranch = false, detach = false, owner = {}, ownerPid = process.pid,
  cap = null, env = process.env, git = null }) {
  if (!SCRATCH_KINDS.includes(kind)) throw new Error(`createScratchWorktree: ${kind} is not a scratch kind (${SCRATCH_KINDS.join(', ')}); an agent's workspace is created by Orca`);
  const run = gitRunner(git);
  const target = path.resolve(dir);
  const home = mainRootOf(repoRoot, { git });
  const reg = registeredAt(repoRoot, target, { git });
  if (reg && fs.existsSync(target)) return { ok: true, path: target, created: false, registered: registerExisting({ repoRoot: home, dir: target, kind, branch, base, owner, ownerPid, env }) };
  if (fs.existsSync(target)) {
    let entries = [];
    try { entries = fs.readdirSync(target); } catch { /* unreadable */ }
    if (entries.length) return { ok: false, reason: 'worktree-path-occupied', detail: `${target} exists and is not a registered worktree` };
    try { fs.rmdirSync(target); } catch { /* git recreates it */ }
  }
  let registered = false;
  try {
    const r = withRegistry((m) => m.reserveWorktree({ path: target, kind, repoRoot: home, branch: branch ?? null, baseSha: base ? revParse(repoRoot, base) ?? base : null,
      ledgerId: owner.ledgerId ?? null, workflowId: owner.workflowId ?? null, jobId: owner.jobId ?? null, lane: owner.lane ?? null }, { cap }), env);
    if (!r.ok) return { ok: false, reason: r.reason, live: r.live, cap: r.cap, detail: `${home} holds ${r.live} live worktree(s), cap ${r.cap}` };
    registered = true;
  } catch { /* a scratch tree is created and removed by the same process: it is made even while the registry is busy */ }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  run(['worktree', 'prune'], { cwd: repoRoot });
  const args = detach ? ['worktree', 'add', '--detach', target, base]
    : newBranch ? ['worktree', 'add', '-b', branch, target, base]
      : ['worktree', 'add', target, branch];
  const added = run(args, { cwd: repoRoot });
  if (!added.ok) {
    if (registered) { try { withRegistry((m) => m.dropWorktree(target), env); } catch { /* the GC marks it: its dir is gone */ } }
    return { ok: false, reason: 'worktree-add-failed', detail: added.stderr.slice(0, 400) };
  }
  if (registered) claimWorktree({ dir: target, ownerPid, env });
  return { ok: true, path: target, created: true, registered };
}

/** Register a scratch worktree that exists (a requeued attempt reusing its tree): the row is refreshed, never capped. */
function registerExisting({ repoRoot, dir, kind, branch, base, owner, ownerPid, env }) {
  try {
    const row = withRegistry((m) => m.worktreeRow(dir), env);
    if (row && row.removed_at == null) return true;
    withRegistry((m) => m.reserveWorktree({ path: dir, kind, repoRoot, branch: branch ?? null, baseSha: base ?? null, ledgerId: owner.ledgerId ?? null,
      workflowId: owner.workflowId ?? null, jobId: owner.jobId ?? null, lane: owner.lane ?? null }, { cap: null }), env);
    claimWorktree({ dir, ownerPid, env });
    return true;
  } catch { return false; }
}
