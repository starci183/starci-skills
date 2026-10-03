// workflow-settle.mjs - what starci kernel settle does in a workflow worktree (WFWT2), on top of the checkpoint primitives of
// scripts/kernel/workflow-checkpoint.mjs:
//   settleCheckpoint  a green op: the Work-record owner rule, then its checkpoint, then the milestone rebase; a failed or
//                     blocked op: preserved and reset.
//   requireWorkOwner  the one rule for Work records (2.8): a record is committed only on its owner workflow's branch.
//   milestoneRebase   the mid-workflow rebase (2.1): scripts/lib/rebase-milestone.mjs decides from the facts read here; a
//                     conflict is preserved to preserved/<wf>/rebase-<onto12> and escalated as one rebase-conflict DI.
import { mergeBaseQuery } from '../api/git/merge-base-query.mjs';
import { revList } from '../api/git/rev-list.mjs';
import { diff as gitDiff } from '../api/git/diff.mjs';
import { updateRef } from '../api/git/update-ref.mjs';
import { revParseQuery } from '../api/git/rev-parse-query.mjs';
import { TERMINAL_JOB_STATUSES, worktreeSettings } from '../machine/worktree-registry.mjs';
import { openDecisionRow } from '../machine/decisions.mjs';
import { rebaseMilestone } from '../lib/rebase-milestone.mjs';
import { commitShaOf } from './commit-sha.mjs';
import { createOwnership } from './work-ownership.mjs';
import { CHECKPOINT_EVENTS, PRESERVED_WORKFLOW_PREFIX, checkpointOp, leasesOf, preserveAndReset, rebaseWorkflow, recoverWorkflowRebase, recordOf, splitChanges, withWorkflowLock } from './workflow-checkpoint.mjs';

const fail = ({ code }, message) => Object.assign(new Error(message), { code });
/** One git call file in `cwd`: {ok, stdout}. */
const git = (call, cwd, args) => { const r = call(args, { cwd, timeout: 600_000, maxBuffer: 64 * 1024 * 1024 }); return { ok: !r.error && r.status === 0, stdout: String(r.stdout ?? '').trim() }; };
const revParse = (cwd, ref) => commitShaOf(git, cwd, ref);
const lines = (text) => String(text ?? '').split(/\r?\n/).filter(Boolean);
const mainOf = (ctx) => ctx?.main ?? 'main';

/** The preserved ref of a milestone rebase that conflicted with main at `onto`: the branch head it could not move. */
export const milestoneRefOf = (workflowId, onto) => `refs/heads/${PRESERVED_WORKFLOW_PREFIX}/${workflowId}/rebase-${String(onto).slice(0, 12)}`;

/** The live ops of the workflow other than `opId` (part A's TERMINAL_JOB_STATUSES); [] without a ledger. */
function liveSiblingsOf(ctx, { workflowId, opId }) {
  if (!ctx?.db?.prepare) return [];
  const statuses = ctx?.worktree?.TERMINAL_JOB_STATUSES ?? TERMINAL_JOB_STATUSES;
  return ctx.db.prepare(`SELECT job_id, payload_json FROM jobs WHERE workflow_id=? AND kind='op' AND job_id<>? AND status IN (${statuses.map(() => '?').join(',')})`).all(workflowId, opId, ...statuses).map((r) => r.job_id);
}

/** A milestone rebase that conflicted, escalated through the Decision Item ladder (scripts/machine/decisions.mjs). */
function escalateRebaseConflict(ctx, { workflowId, onto, head, files, preservedRef }) {
  if (ctx?.escalate) return ctx.escalate({ workflowId, onto, head, files, preservedRef });
  if (!ctx?.ledger) return { ok: false, detail: 'no ledger to open the decision in' };
  const { di, created } = openDecisionRow(ctx.ledger, {
    kind: 'rebase-conflict', decider: 'kernel', workflowId, entity: { type: 'workflow', id: workflowId },
    idempotencyKey: `rebase-conflict:workflow:${workflowId}:${String(onto).slice(0, 12)}`, supersedeEntity: true, code: 'workflow-rebase-conflict',
    summary: `the workflow branch conflicts with main ${String(onto).slice(0, 12)} on ${files.slice(0, 3).join(', ')}${files.length > 3 ? ` (+${files.length - 3})` : ''}: the branch stays at ${String(head).slice(0, 12)}, preserved as ${preservedRef}; route an op that resolves it before the finish`,
    evidence: [`onto ${onto}`, `head ${head}`, `preserved ${preservedRef}`, ...files.slice(0, 20).map((f) => `conflict ${f}`)],
    by: 'runtime:milestone-rebase',
  });
  return { ok: true, decisionId: di.id, created };
}

/**
 * The mid-workflow rebase, called right after a green checkpoint. Due: rebaseWorkflow (the checkpoint follows the new
 * head). A conflict leaves the branch where it was, keeps its head as preserved/<wf>/rebase-<onto12> (the same main tip
 * is never tried twice) and opens one rebase-conflict Decision Item. Never throws: the op is green either way, and the
 * finish's rebase stays the hard stop. {due, why, rebased?, onto?, head?, conflict?, error?}
 */
export function milestoneRebase(ctx, { workflowId, opId }) {
  return withWorkflowLock(ctx, { workflowId }, (locked) => milestoneOwned(locked, { workflowId, opId }));
}
function milestoneOwned(ctx, { workflowId, opId }) {
  try {
    const rec = recordOf(ctx, workflowId);
    const onto = revParse(rec.path, `refs/heads/${mainOf(ctx)}`);
    const head = revParse(rec.path, 'HEAD');
    if (!onto || !head) return { due: false, why: 'up-to-date', error: `${mainOf(ctx)} or HEAD does not resolve in ${rec.path}` };
    const base = git(mergeBaseQuery, rec.path, [onto, head]).stdout;
    const behind = Number(git(revList, rec.path, ['--count', `${base}..${onto}`]).stdout) || 0;
    const names = (from, to) => new Set(lines(git(gitDiff, rec.path, ['--name-only', '--no-renames', `${from}..${to}`]).stdout));
    const ours = behind > 0 ? names(base, head) : new Set();
    const overlap = behind > 0 ? [...names(base, onto)].filter((f) => ours.has(f)).length : 0;
    const conflictedOnto = revParse(rec.path, milestoneRefOf(workflowId, onto)) ? onto : null;
    const idle = liveSiblingsOf(ctx, { workflowId, opId }).length === 0;
    const policy = rebaseMilestone({ idle, behind, overlap, onto, conflictedOnto, behindLimit: ctx?.behindLimit ?? worktreeSettings().rebaseMilestoneBehind });
    if (!policy.due) return { ...policy, onto, behind, overlap };
    const r = rebaseWorkflow(ctx, { workflowId, opId, milestone: policy });
    if (r.ok) return { ...policy, rebased: !r.already, onto: r.onto, head: r.head, behind, overlap };
    if (r.code !== 'workflow-rebase-conflict') return { ...policy, rebased: false, onto, error: r.code, detail: r.detail ?? null, files: r.files ?? [] };
    const preservedRef = milestoneRefOf(workflowId, onto);
    const kept = updateRef(rec.path, preservedRef, head);
    const escalation = escalateRebaseConflict(ctx, { workflowId, onto, head, files: r.files, preservedRef });
    return { ...policy, rebased: false, onto, head, conflict: { files: r.files, preservedRef: kept.ok ? preservedRef : null, escalation } };
  } catch (error) {
    if (error?.effectState === 'unknown') throw error;
    return { due: false, why: 'quiet', error: error?.code ?? 'workflow-rebase-failed', detail: String(error?.message ?? error).slice(0, 300) };
  }
}

/**
 * The one rule for Work records: a record is committed only by the runtime, on the workflow branch of its owner workflow
 * (work-ownership.mjs ownerOf). A green op that changed a .starciwork record another live workflow definitely owns (any
 * rule but the repo-owner fallback) is refused workflow-work-record-not-owner: the owner changes it, peers see it when
 * the owner lands. ctx.ownerOf replaces the ledger's ownership in a spec.
 */
export function requireWorkOwner(ctx, { workflowId, opId }) {
  const rec = recordOf(ctx, workflowId);
  const records = splitChanges(rec.path, leasesOf(ctx, { workflowId, opId })).mine.filter((f) => f.startsWith('.starciwork/'));
  if (!records.length) return;
  const ownerOf = ctx?.ownerOf ?? createOwnership(ctx.db, { repo: ctx.repo });
  const foreign = records.map((file) => ({ file, ...ownerOf(file) })).filter((o) => o.workflowId && o.workflowId !== workflowId && o.by !== 'repo-owner');
  if (foreign.length) throw Object.assign(fail({ code: 'workflow-work-record-not-owner' }, `${opId} changed ${foreign.length} Work record file(s) another workflow owns (${foreign.slice(0, 3).map((o) => `${o.file}: ${o.workflowId} by ${o.by}`).join('; ')}): only the owner's workflow commits a record - ask it (starci kernel notify --kind request)`), { files: foreign.slice(0, 40) });
}

/**
 * What starci kernel settle does in a workflow worktree, as the ledger event it records: a green op is a checkpoint followed by the
 * milestone rebase; a failed or blocked op is preserved and reset. Throws the typed refusal of checkpointOp/preserveAndReset.
 */
export function settleCheckpoint(ctx, { workflowId, opId, pass }) {
  return withWorkflowLock(ctx, { workflowId }, (locked) => settleOwned(locked, { workflowId, opId, pass }));
}
function settleOwned(ctx, { workflowId, opId, pass }) {
  const recovered = recoverWorkflowRebase(ctx, { workflowId, opId });
  if (!pass) return { kind: CHECKPOINT_EVENTS.preserved, ...preserveAndReset(ctx, { workflowId, opId }) };
  requireWorkOwner(ctx, { workflowId, opId });
  const checkpoint = { kind: CHECKPOINT_EVENTS.checkpoint, ...checkpointOp(ctx, { workflowId, opId }) };
  return { ...checkpoint, milestone: recovered?.milestone ? { ...recovered.milestone, rebased: true, onto: recovered.onto, head: recovered.head, recovered: true } : milestoneRebase(ctx, { workflowId, opId }) };
}
