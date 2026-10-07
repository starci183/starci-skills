// launch-smoke-verdict.mjs - the launch smoke's verdict: each path's problems, from what the run recorded.
import { byCodeUnit } from '../lib/list.mjs';
import { ownedFileOf } from './launch-smoke-state.mjs';

const resetProblems = (r, p) => {
  if (!r) { p.push('opFail was never preserved and reset'); return; }
  if (!r.preservedRef || !r.preservedHasFile) p.push(`opFail's work is not on its preserved ref (${r.preservedRef})`);
  if (!r.fileGone || !r.clean) p.push('the workflow worktree is not clean after the reset');
  if (!r.head || r.head !== r.resetTo || (r.lastCheckpoint && r.head !== r.lastCheckpoint)) p.push(`the reset left HEAD at ${r.head}, not the last checkpoint ${r.lastCheckpoint ?? r.resetTo}`);
};
/** The main-manifest comparison's problems (wf.main). */
const mainProblems = (wf, m, p) => {
  if (!m) { p.push('main was not compared'); return; }
  const expected = ['op', 'opFe'].map((role) => ownedFileOf(role, wf.workflowId, wf.feApp)).sort(byCodeUnit);
  if (JSON.stringify(m.added) !== JSON.stringify(expected)) p.push(`main gained ${JSON.stringify(m.added)}, not exactly ${JSON.stringify(expected)}`);
  if (m.changed.length || m.removed.length) p.push(`main is not intact: changed ${JSON.stringify(m.changed)}, removed ${JSON.stringify(m.removed)}`);
  if (!m.nodeModulesSame) p.push("main's node_modules listing changed");
  if (!m.addedBytesOk) p.push("a green op's file on main does not hold the bytes it wrote");
  if (!m.ancestor) p.push(`main ${m.after} does not descend from ${m.before}`);
};
/** The checkpoint and gate-base problems of the two green ops (wf.checkpoints, wf.gateBases). */
const checkpointProblems = (wf, p) => {
  for (const role of ['op', 'opFe']) if (!wf.checkpoints[role]) p.push(`${role}: no checkpoint`);
  const first = Object.values(wf.gateBases)[0];
  if (first && first.before !== wf.baseHead) p.push(`the first op's gate base ${first.before} is not the merge-base with main ${wf.baseHead}`);
  for (const role of ['op', 'opFe']) { const g = wf.gateBases[role]; if (g && wf.checkpoints[role] && g.after !== wf.checkpoints[role]) p.push(`${role}: the gate base after its checkpoint is ${g.after}, not ${wf.checkpoints[role]}`); }
};
/** The dispatcher's same-side-serial and cross-side-parallel answers (wf.concurrency). */
const concurrencyProblems = (wf, p) => {
  if (wf.concurrency.beBeside !== false) p.push('the dispatcher admits a be op beside a running be op (same side must be serial)');
  if (wf.concurrency.feBeside !== true) p.push('the dispatcher refuses a be op beside a running fe op (sides must run in parallel)');
};
/** The finish's refusal, when it did not succeed (wf.finish). */
const finishProblems = (wf, p) => {
  if (wf.finish?.ok) return;
  const f = wf.finish;
  const why = f?.refusal && typeof f.refusal === 'object' ? `${f.refusal.step ?? '-'} ${f.refusal.code ?? ''}: ${f.refusal.detail ?? ''}`.trim() : f?.refusal ?? f?.error ?? 'not run';
  p.push(`finishWorkflow: ${why}`);
};
/** The release-pending mark and the host-side removal of the workflow worktree after the finish. */
const releaseProblems = (wf, p) => {
  if (wf.finish?.ok && !wf.releasePending) p.push('the finish did not mark the workflow worktree release-pending');
  if (wf.removed?.listed !== false || wf.removed?.pathExists !== false) p.push('the host-side controller did not remove the workflow worktree after the finish');
  else if (wf.removed?.branchGone === false) p.push(`the host-side controller removed the worktree but kept ${wf.branch}`);
};
/** The workflow leg's problems, from what driveWorkflow and the finish recorded. */
function workflowProblems(wf, spec) {
  const p = [...wf.problems];
  if (!wf.listed) p.push(`the workflow worktree ${spec.name} never appeared in orca worktree list${wf.listError ? ' (' + wf.listError + ')' : ''}`);
  if (!wf.parallel) p.push('the be op and the fe op did not run in parallel in the workflow worktree');
  checkpointProblems(wf, p);
  concurrencyProblems(wf, p);
  resetProblems(wf.reset, p);
  finishProblems(wf, p);
  mainProblems(wf, wf.main, p);
  releaseProblems(wf, p);
  return p;
}
/** One role's launch, depth, creator, result, worker_done and worker-read problems. */
const roleProblems = (role, out) => {
  const a = out.agents[role] ?? {};
  if (!a.launched) return [`${role}: not started (${a.error ?? 'unknown'})`];
  const problems = [];
  if (a.depth !== a.expectedDepth) problems.push(`${role}: depth ${a.depth} != ${a.expectedDepth}`);
  if (a.expectedCreatorDispatchId && a.creatorDispatchId !== a.expectedCreatorDispatchId) problems.push(`${role}: creator ${a.creatorDispatchId} != ${a.expectedCreatorDispatchId}`);
  if (!a.result) problems.push(`${role}: no result line`);
  if (!a.workerDone) problems.push(`${role}: no worker_done (status ${a.status}, state ${a.state})`);
  if (!a.read?.ok) problems.push(`${role}: worker-read failed`);
  return problems;
};
/** One PATHS entry's verdict: its roles' launch/depth/creator/result/worker_done/read and release problems. */
export const pathVerdict = (name, roles, { out, wf, spec }) => {
  const problems = roles.flatMap((role) => roleProblems(role, out));
  for (const role of roles) { const c = out.cleanup.find((x) => x.role === role); if (out.agents[role]?.dispatchId && !c?.released) problems.push(`${role}: not released`); }
  if (name === 'workflow-worktree') problems.push(...workflowProblems(wf, spec));
  return { status: problems.length ? 'failed' : 'ok', depths: Object.fromEntries(roles.map((r) => [r, out.agents[r]?.depth ?? null])), ...(problems.length ? { problems } : undefined) };
};
