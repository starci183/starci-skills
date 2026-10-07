// rebase-milestone.mjs - the milestone policy of a workflow worktree (WFWT2 2.1): whether main has moved enough that the
// workflow branch is rebased onto it now, mid-workflow, instead of only at the finish. Pure: the facts are read by
// scripts/kernel/workflow-settle.mjs milestoneRebase, the one caller (starci kernel settle, after a green checkpoint).
//   not-idle        another op of the workflow is live in the worktree: a rebase needs a clean tracked tree and would move
//                   the checkpoint its gate is measured against. Never due.
//   up-to-date      main's tip is already in the branch. Not due.
//   conflict-known  the last milestone attempt at this exact main tip conflicted: it is preserved and escalated already.
//                   A main that moves further is a new attempt.
//   overlap         main changed a path the branch also changed since their merge-base: a conflict can start here, so it
//                   surfaces at the op that caused it, not at the finish. Due.
//   behind          main is `behindLimit` or more commits past the merge-base. Due.
//   quiet           otherwise. Not due.

/** {due, why} for the facts {idle, behind, overlap, onto, conflictedOnto, behindLimit}. */
export function rebaseMilestone({ idle, behind, overlap, onto, conflictedOnto = null, behindLimit }) {
  if (!idle) return { due: false, why: 'not-idle' };
  const isBehind = behind > 0;
  if (!isBehind) return { due: false, why: 'up-to-date' };
  if (conflictedOnto && conflictedOnto === onto) return { due: false, why: 'conflict-known' };
  if (overlap > 0) return { due: true, why: 'overlap' };
  if (behind >= behindLimit) return { due: true, why: 'behind' };
  return { due: false, why: 'quiet' };
}
