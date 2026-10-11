// workflow-purge-refs.mjs - the git refs of one workflow in a product repository, each with the proof that the runtime made it. A branch is
// the workflow's when a registry row names it, or when it carries the name Orca gave a workflow worktree (wf-<id>, then wf-<id>-2, ...)
// AND its tip is either in main (nothing of its own to lose) or sits on a checkpoint chain the runtime committed for this workflow.
// A ref under preserved/<workflow>/ is the runtime's own namespace; a ref the ledger names as a job's preserved work is the workflow's.
// Everything else that matches only by name is listed as unproven and never deleted. Read only.
import { branchList } from '../api/git/branch-list.mjs';
import { revParse } from '../api/git/rev-parse.mjs';
import { isAncestor } from '../api/git/is-ancestor.mjs';
import { log as gitLog } from '../api/git/log.mjs';
import { worktreeListPorcelain } from '../api/git/worktree-list-porcelain.mjs';
import { byCodeUnit } from '../lib/list.mjs';
import { escapeRegExp } from '../lib/regex.mjs';
import { PRESERVED_PREFIX, sameTree } from './worktree-registry.mjs';

const MAIN = 'main';
const CHAIN_DEPTH = 256;

const namesOf = (repoRoot, pattern) => String(branchList(['--format=%(refname:short)', pattern], { cwd: repoRoot }).stdout ?? '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

/** Whether the first-parent history of `tip` holds a checkpoint commit the runtime made for `workflowId`. */
function onCheckpointChain(repoRoot, tip, workflowId) {
  const r = gitLog(['--first-parent', '--format=%s', '-n', String(CHAIN_DEPTH), tip], { cwd: repoRoot, timeout: 30_000 });
  if (r.status !== 0) return false;
  const prefix = `checkpoint ${workflowId}:`;
  return String(r.stdout ?? '').split(/\r?\n/).some((subject) => subject.startsWith(prefix));
}

// The proof of a workflow branch, or null: a registry row, then the grammar with a tip in main, then the grammar with the runtime's checkpoint chain.
function branchProof({ repoRoot, name, tip, workflowId, rowBranches }) {
  if (rowBranches.has(name)) return 'registry-row';
  if (isAncestor(repoRoot, tip, MAIN)) return 'name-grammar, tip in main';
  return onCheckpointChain(repoRoot, tip, workflowId) ? 'name-grammar, checkpoint chain of the workflow' : null;
}

function refRow({ repoRoot, name, kind, tip, proof, held, trees }) {
  const heldElsewhere = held && !trees.some((tree) => sameTree(tree, held)) ? held : null;
  if (!proof) return { repoRoot, name, kind, tip, proof: null, action: 'keep', why: 'only the name matches: no registry row, not in main and no checkpoint of this workflow on its history' };
  if (name === MAIN) return { repoRoot, name, kind, tip, proof, action: 'keep', why: 'the product main branch is never deleted' };
  if (heldElsewhere) return { repoRoot, name, kind, tip, proof, action: 'keep', why: `checked out in ${heldElsewhere}, a tree this purge does not remove` };
  return { repoRoot, name, kind, tip, proof, action: 'delete', why: null };
}

/**
 * The refs of the workflow in `repoRoot`: [{repoRoot, name, kind: 'branch'|'preserved', tip, proof, action: 'delete'|'keep', why}], sorted by name.
 * rowBranches: the branches the workflow's registry rows recorded; jobIds and preservedRefs: what the ledger names; trees: the tree paths this
 * purge removes (a branch checked out in one of them goes with it, one checked out anywhere else is kept).
 */
export function workflowRefsOf({ repoRoot, workflowId, rowBranches = [], jobIds = [], preservedRefs = [], trees = [] }) {
  const rows = new Set(rowBranches);
  const own = new RegExp(String.raw`^(?:.+/)?wf-${escapeRegExp(workflowId)}(?:-\d+)?$`);
  const held = new Map(worktreeListPorcelain(repoRoot).filter((w) => w.branch).map((w) => [w.branch, w.path]));
  const preservedNames = new Set([...namesOf(repoRoot, `${PRESERVED_PREFIX}/${workflowId}/*`), ...jobIds.map((id) => `${PRESERVED_PREFIX}/${id}`),
    ...preservedRefs.map((ref) => ref.replace(/^refs\/heads\//, ''))]);
  const branchNames = new Set([...namesOf(repoRoot, `*wf-${workflowId}*`).filter((name) => own.test(name)), ...rows]);
  const out = [];
  for (const [kind, names] of [['branch', branchNames], ['preserved', preservedNames]]) {
    for (const name of names) {
      const tip = revParse(repoRoot, `refs/heads/${name}`);
      if (!tip) continue;
      const proof = kind === 'preserved' ? 'preserved namespace of the workflow or a job the ledger names' : branchProof({ repoRoot, name, tip, workflowId, rowBranches: rows });
      out.push(refRow({ repoRoot, name, kind, tip, proof, held: held.get(name) ?? null, trees }));
    }
  }
  return out.sort((a, b) => byCodeUnit(a.name, b.name));
}
