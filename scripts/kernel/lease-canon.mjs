// lease-canon.mjs — one spelling per owned path for the durable `path:` leases.
//
// In a bound app (.workspaces/projects/<p>/work.json) every owned path is app-relative (scripts/kernel/target-repo.mjs
// appRelativeProblem: be/<path>, fe/<path>, .starciwork/<path> or a path of the app root), so the app-relative path IS the
// lease spelling: be/apps/app/src/messages/vi.json and fe/apps/app/src/messages/vi.json are two files, and one file has one
// key. engine/admission.mjs compares both sides in that form, case-insensitively on Windows. A path no binding resolves
// keeps its own spelling (an unbound repository behaves exactly as before).
import { normalizeOwnedPath, ownedPathLeaseRequests } from '../../engine/admission.mjs';
import { ownedPathPlacements, projectBinding } from './target-repo.mjs';
import { parseJsonOr } from '../lib/json.mjs';

const parse = parseJsonOr;

/**
 * The canonicalizer for one ledger repository. `canonical(owned, {op, payload})` is the lease
 * spelling of one owned path; `requests(payload, op)` the capacity-1 lease requests of a job;
 * `canonicalOf(leasePath, row)` the findOwnedPathLeaseConflicts hook (a held row resolves through
 * its holder job, a request is already canonical).
 */
export function leaseCanonicalizer({ repo, db = null, binding: given } = {}) {
  let binding = given;
  if (binding === undefined) { try { binding = repo ? projectBinding(repo) : null; } catch { binding = null; } }
  // One resolver call per job: ownedPathPlacements reads the binding once for all of its paths.
  const canonicalAll = (owned, { op = null, payload = {} } = {}) => {
    const plain = owned.map((value) => normalizeOwnedPath(value));
    if (!binding) return plain;
    let placements = [];
    try { placements = ownedPathPlacements({ op, payload, ownedPaths: plain, repo, worktree: null }); }
    catch { placements = []; }
    return plain.map((value, index) => {
      const placement = placements[index];
      if (!placement || placement.unresolved) return value;
      return normalizeOwnedPath(String(placement.path ?? value));
    });
  };
  const canonical = (owned, context = {}) => canonicalAll([owned], context)[0];
  const requests = (payload = {}, op = payload?.opId ?? null) =>
    ownedPathLeaseRequests(canonicalAll((payload?.owned_paths ?? []).filter(Boolean), { op, payload }));
  const holders = new Map();
  const holderOf = (jobId) => {
    if (!holders.has(jobId)) {
      const row = db && jobId ? db.prepare('SELECT op_id,payload_json FROM jobs WHERE job_id=?').get(jobId) : null;
      const payload = parse(row?.payload_json);
      holders.set(jobId, { op: row?.op_id ?? payload.opId ?? null, payload });
    }
    return holders.get(jobId);
  };
  const canonicalOf = (leasePath, row) => {
    // A request (no row) was spelled by requests() already; a held row resolves through its holder job.
    if (!binding || !row?.job_id) return leasePath;
    return canonical(leasePath, holderOf(row.job_id));
  };
  return { binding, canonical, requests, canonicalOf };
}
