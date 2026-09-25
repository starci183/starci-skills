// lease-canon.mjs — one spelling per owned path for the durable `path:` leases.
//
// nivo wf-nivo-fe-debt-mug06w7h inc-52a4a5ee5b12: Modules enqueued `apps/app/src/messages/vi.json`
// (bare, --repository fe) while fe-debt enqueued `nivo-fe/apps/app/src/messages` (prefixed with the
// repository's name). Leases compared the strings, so the two workflows were admitted onto the same
// catalog at once. In a bound project (.workspaces/projects/<p>/work.json) every owned path now resolves
// through the same resolver dispatch places workers with (scripts/kernel/target-repo.mjs
// ownedPathPlacements: repository:<id>/, a bound repository's name, an absolute or ../ path, a Work
// path, the job's payload.repository or a frontend op's fe side) to `repository:<role>/<path>`, the
// form its lease key is taken in. A path no binding resolves keeps its own spelling (an unbound
// repository behaves exactly as before). engine/admission.mjs compares both sides in that form,
// case-insensitively on Windows.
//
// Transition: a lease taken before this change is stored in whatever spelling its job used. The
// held row is canonicalized through its holder job's payload (op, repository) at comparison time, so
// an old bare lease still conflicts with a new prefixed request and vice versa.
import { normalizeOwnedPath, ownedPathLeaseRequests } from '../../engine/admission.mjs';
import { ownedPathPlacements, projectBinding } from './target-repo.mjs';
import { parseJson } from '../lib/json.mjs';

const REPOSITORY_QUALIFIED = /^repository:[^/]+(?:\/|$)/;
const parse = (text) => parseJson(text) ?? {};

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
      if (!placement || placement.unresolved || !placement.role) return value;
      const rel = String(placement.path ?? '').replace(/\\/g, '/').replace(/\/\*\*$/, '');
      const inside = rel && rel !== '.' ? normalizeOwnedPath(rel) : null;
      return inside ? `repository:${placement.role}/${inside}` : `repository:${placement.role}`;
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
    if (!binding) return leasePath;
    // A request (no row) was spelled by requests() already; a repository:<id>/ form still maps its id
    // (a role, a repository name or a path) to the role.
    if (!row?.job_id) return REPOSITORY_QUALIFIED.test(leasePath) ? canonical(leasePath) : leasePath;
    return canonical(leasePath, holderOf(row.job_id));
  };
  return { binding, canonical, requests, canonicalOf };
}
