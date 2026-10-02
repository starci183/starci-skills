// lane-owner.mjs — the ONE rule for whether a lane worktree may be removed (coordinator 2026-09-28: GC removed the
// rc-job and rc-cleanup worktrees right after they landed, while their agents still worked in them). Both removers
// use it: the Supervisor GC (scripts/supervisor/gc.mjs collectLanes) and housekeeping (scripts/housekeeping/hk-lanes.mjs
// sweepLanes). A lane worktree qualifies only when it is merged, clean, had no git activity for LANE_IDLE_MS (60 min)
// AND has no live owner (laneOwnerOf):
//   - an active Orca worker whose worktree is the lane (orchestration worker-list, resource.worktreeId): every agent
//     is launched through worker-start, so Orca's worker accounting is the one source for who works in a lane;
//   - a Supervisor job that is not final registered for it (its staging branch or path).
// When Orca does not answer, or answers for one bound Run instead of every Run, nobody can rule an owner out: nothing
// is removed.
import { pathKey, sameOrUnder } from '../lib/path-key.mjs';
import { activeWorkerOn, terminalHandleOf } from '../lib/worker-accounting.mjs';
import { activeWorkersAllRuns } from './worker-list-all.mjs';
import { readSupervisor, FIX_KIND } from './home.mjs';

export const LANE_IDLE_MS = 3_600_000;
const SUP_FINAL = new Set(['succeeded', 'failed', 'cancelled']);
const under = (child, root) => sameOrUnder(pathKey(child), pathKey(root));

/**
 * The live owner of a lane worktree (a reason string), or null. Pure. `workers`: Orca's active worker-list rows over
 * every Run, or null when that listing is unavailable; `sup`: {jobs: [{jobId, status, branch, stagingPath}]}.
 */
export function laneOwnerOf({ lanePath, branch = null, workers, sup = { jobs: [] } }) {
  if (!Array.isArray(workers)) return 'Orca\'s worker list over every Run is unavailable: a live owner cannot be ruled out';
  const worker = activeWorkerOn(workers, lanePath);
  if (worker) return `active worker ${worker.dispatchId ?? '?'} (terminal ${terminalHandleOf(worker) ?? '?'}) works in it`;
  const short = String(branch ?? '').replace(/^refs\/heads\//, '');
  for (const j of sup?.jobs ?? []) {
    if (SUP_FINAL.has(j.status)) continue;
    if ((short && j.branch === short) || (j.stagingPath && under(j.stagingPath, lanePath))) return `Supervisor job ${j.jobId} (${j.status}) is registered for it`;
  }
  return null;
}

/**
 * The live owner evidence, read once: {workers (null when Orca did not answer for every Run or machine.sqlite is
 * unreadable), sup}. Synchronous, as sweepLanes is.
 */
export function liveLaneOwners({ env = process.env, list } = {}) {
  let workers = activeWorkersAllRuns(list ? { list } : {});
  let sup = { jobs: [] };
  try {
    // machine.sqlite sup_jobs (the Supervisor's runtime.fix jobs); null when the store cannot be read.
    sup = { jobs: readSupervisor((m) => m.listSupJobs({ kind: FIX_KIND }).map((r) => {
      const p = r.payload ?? {};
      return { jobId: r.job_id, status: r.status, branch: p.staging?.branch ?? null, stagingPath: p.staging?.path ?? null };
    }), null, { env }) };
    if (!Array.isArray(sup.jobs)) sup = null;
  } catch { sup = null; }
  // An unreadable machine.sqlite is an owner nobody can rule out either.
  if (!sup) workers = null;
  return { workers, sup: sup ?? { jobs: [] } };
}
