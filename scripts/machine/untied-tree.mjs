// untied-tree.mjs - the one wording and the one fact line for "a tree the runtime cannot tie to a workflow". The worktree GC (worktrees.mjs reviewUnstamped, surfaced as ONE
// Supervisor item per repository by scripts/reconciler/untied-tree-item.mjs) and `starci workflow purge` (workflow-purge-orca.mjs: "listed, never touched") both list such things
// and say why with this phrase. The runtime removes nothing it did not create: removal of an untied tree is a human act.
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
