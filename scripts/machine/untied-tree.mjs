// untied-tree.mjs - the one wording and the one fact line for "a tree the runtime cannot tie to a workflow". The worktree GC (worktrees.mjs reviewUnstamped, surfaced as ONE
// Supervisor item per repository by scripts/reconciler/untied-tree-item.mjs) and `starci workflow purge` (workflow-purge-orca.mjs: "listed, never touched") both list such things
// and say why with this phrase. The runtime removes nothing it did not create: removal of an untied tree is a human act.
import path from 'node:path';
import { machineLog, withMachine } from '../../engine/db/machine.mjs';
import { sameTree } from './worktree-registry.mjs';
import { headTime } from '../api/git/head-time.mjs';
import { porcelainStatus } from '../api/git/porcelain-status.mjs';

/** Why a thing is listed and never touched. */
export const UNTIED = 'the runtime cannot tie it to a workflow';

/** The reason line of a listed thing: the phrase, then what was seen. */
export const untiedWhy = (seen) => `${UNTIED}: ${seen}`;

/** The facts of one untied tree: {path, branch, lastCommitAt (ms or null), dirty (true, false or null when unreadable)}. */
export function untiedTreeFacts({ path: dir, branch = null }) {
  const head = headTime(dir);
  const status = porcelainStatus(dir, { untracked: 'normal' });
  return { path: dir, branch, lastCommitAt: head ? head.time * 1000 : null, dirty: status?.ok === false ? null : String(status?.stdout ?? '').trim() !== '' };
}

/** One tree as a line of the item and of any listing: path, branch, last commit time, dirty or clean. */
const STATE = new Map([[true, 'dirty'], [false, 'clean']]);
export const untiedTreeLine = (tree) => {
  const when = tree.lastCommitAt ? new Date(tree.lastCommitAt).toISOString() : 'unknown';
  return `${tree.path} (branch ${tree.branch ?? 'none'}, last commit ${when}, ${STATE.get(tree.dirty) ?? 'state unreadable'})`;
};

/** The collector's review entry of an unregistered tree: listed on every plan, logged once, never removed. */
export function reviewUnstamped({ dir, repoRoot, home, detail, apply, env }) {
  if (apply) {
    try {
      const seen = withMachine((m) => m.db.prepare("SELECT data_json FROM machine_logs WHERE kind='worktree.orphan-review'").all(), { env })
        .some((r) => { try { return sameTree(JSON.parse(r.data_json)?.path, dir); } catch { return false; } });
      if (!seen) machineLog({ actor: 'gc', kind: 'worktree.orphan-review', level: 'warn',
        msg: untiedWhy(`unstamped ${home} tree ${dir} is listed for review, never removed`).slice(0, 500), data: { path: dir, home, ...detail } }, { env });
    } catch { /* the review entry still reaches the collector and Supervisor */ }
  }
  return { path: dir, repoRoot: repoRoot ? path.resolve(repoRoot) : null, reason: 'unstamped-orphan', action: 'review', home,
    branch: detail?.branch ?? null, why: untiedWhy('unregistered tree under a runtime-managed root'), ok: true };
}
