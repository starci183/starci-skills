// _view.mjs — one progress/RCA view per `starci kernel status` call, shared by the `progress` and `rca` status fields
// (scripts/kernel/progress-rca.mjs workflowView). Not a status field itself (a leading `_` is skipped by the loader).
import path from 'node:path';
import { workflowView } from '../../progress-rca.mjs';
import { ownedPathPlacements } from '../../target-repo.mjs';

const memo = new WeakMap();

/** Absolute owned paths of a job, or null when a path does not resolve into a bound repository (never guessed). */
export const resolverFor = (repo) => (job) => {
  const places = ownedPathPlacements({ op: job.op_id, payload: job.payload ?? {}, ownedPaths: job.payload?.owned_paths ?? [], repo });
  return places.some((p) => p.unresolved || !p.role) ? null : places.map((p) => path.join(p.base, p.path));
};

export function viewOf(ctx) {
  const key = ctx.core ?? ctx;
  if (!memo.has(key)) memo.set(key, workflowView({ db: ctx.db, workflowId: ctx.workflowId, core: ctx.core ?? {}, repo: ctx.repo, now: ctx.now ?? Date.now(), resolve: resolverFor(ctx.repo) }));
  return memo.get(key);
}
