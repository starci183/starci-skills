// gate-attribution.mjs — whose change turned a repo-wide gate red.
//
// Several ops share one product working tree, so a repo-wide gate (test:ci, typecheck, lint) run for
// op A reads op B's in-flight or landed change: nivo academy-debt's test:ci went red 812/813 on
// module-studio's commit 9caa2d5c (inc-9474fe9ff445) and on module-studio's uncommitted
// agentos-module-studio spec (inc-36b309cb9138), and academy-debt retried backend.implement for
// breakage it did not cause. The rule (modules/kernel/api.yaml commands.check peerBlocked): a red
// check names the files its failure implicates (`failing`: the failing spec and the source it
// points at); api check attributes each file, and a red check none of whose files is this op's and
// at least one of which a peer changed is `peer`: recorded peerBlocked, counted neither passed nor
// failed, and the settle names the peer instead of spending this op's attempt on it.
//
// Per implicated file, the first that answers wins:
//   own       the file lies under this job's owned paths (its own slice), or a commit since the
//             lineage began that touched it resolves to this job's own workflow
//   peer      the file is uncommitted in the working tree under a path lease another job holds
//             (via lease: the in-flight change of that job), or a commit since this job's retry
//             lineage began touched it and resolves (scripts/kernel/introducer.mjs) to another
//             workflow (via commit)
//   unknown   neither: nothing ties the file to anyone since the work began
// The check is `own` when any file is own, `peer` when none is own and one is peer, else `unknown`.
// A git read that fails leaves its file unknown, never peer. Ledger and git reads only.
import path from 'node:path';
import { findOwnedPathLeaseConflicts, leaseCompareForm, normalizeOwnedPath, ownedPathLeaseRequests, ownedPathsIntersect } from '../../engine/admission.mjs';
import { gitResult } from '../lib/git.mjs';
import { resolveIntroducer } from './introducer.mjs';
import { lineageJobsOf } from './owner-answers.mjs';
import { parseJsonOr } from '../lib/json.mjs';

export const ATTRIBUTION_CLASSES = Object.freeze(['own', 'peer', 'unknown']);
const payloadOf = (row) => parseJsonOr(row?.payload_json ?? '{}') ?? {};
const LEASE_PREFIX = 'path:';
const LOG_DEPTH = 200;

/** A failing file as the gate printed it, repo-relative with forward slashes; null when unusable. */
export function failingPath(value, repo) {
  if (typeof value !== 'string' || !value.trim()) return null;
  let file = value.trim().replace(/\\/g, '/').replace(/:\d+(?::\d+)?$/, '');
  if (path.isAbsolute(file) && repo) file = path.relative(repo, file).replace(/\\/g, '/');
  try { return normalizeOwnedPath(file); } catch { return null; }
}

/**
 * attributeRedGate(db, {repo, job, failing, canon?, git?}) ->
 *   {class, files:[{path, owner, via?, workflowId?, jobId?, commit?}], peers:[{workflowId, via, jobId?, commit?, files[]}]}
 * `canon` is the ledger's lease canonicalizer (scripts/kernel/lease-canon.mjs); `git(args)` returns
 * gitResult's {ok, stdout} and defaults to git in `repo`.
 */
export function attributeRedGate(db, { repo, job, failing = [], canon = null, git = null }) {
  const run = git ?? ((args) => gitResult(args, { dir: repo, timeout: 20_000 }));
  const payload = payloadOf(job);
  const op = job.op_id ?? payload.opId ?? null;
  const canonical = (file) => (canon ? canon.canonical(file, { op, payload }) : file);
  const compare = (value) => leaseCompareForm(value);
  const own = (canon ? canon.requests(payload, op).map((r) => r.resourceKey.slice(LEASE_PREFIX.length))
    : (payload.owned_paths ?? []).map((p) => (typeof p === 'string' ? p : p?.path)).filter(Boolean)).map(compare);
  const lineage = [job, ...lineageJobsOf(db, job)];
  const since = Math.min(...lineage.map((row) => Number(row.created_at)).filter(Number.isFinite));
  const introducers = new Map();
  const introducerOf = (sha) => {
    if (!introducers.has(sha)) introducers.set(sha, resolveIntroducer(db, { commits: [sha], roots: [repo] }));
    return introducers.get(sha);
  };

  const files = [];
  for (const file of [...new Set(failing.map((f) => failingPath(f, repo)).filter(Boolean))]) {
    const key = canonical(file);
    if (own.some((mine) => ownedPathsIntersect(mine, compare(key)))) { files.push({ path: file, owner: 'own', via: 'owned-path' }); continue; }
    const status = run(['status', '--porcelain', '--', file]);
    const dirty = status.ok && status.stdout.trim().length > 0;
    const held = dirty
      ? findOwnedPathLeaseConflicts(db, ownedPathLeaseRequests([key]), { excludeJobId: job.job_id, canonicalOf: canon?.canonicalOf ?? null })
      : [];
    if (held.length) {
      files.push({ path: file, owner: 'peer', via: 'lease', workflowId: held[0].workflow_id, jobId: held[0].job_id });
      continue;
    }
    // Committer times are filtered here, not by --since: git stops its walk at the first older commit.
    const log = Number.isFinite(since) ? run(['log', `-n${LOG_DEPTH}`, '--format=%H %ct', '--', file]) : { ok: false };
    const commits = log.ok ? log.stdout.split(/\r?\n/).map((line) => line.trim().split(' '))
      .filter(([sha, at]) => sha && Number(at) * 1000 >= since).map(([sha]) => sha) : [];
    let entry = { path: file, owner: 'unknown' };
    for (const sha of commits) {
      const found = introducerOf(sha);
      if (found.unresolved) continue;
      if (found.introducedBy === job.workflow_id || found.workflowId === job.workflow_id) { entry = { path: file, owner: 'own', via: 'commit', commit: sha }; break; }
      if (entry.owner === 'unknown') entry = { path: file, owner: 'peer', via: 'commit', workflowId: found.workflowId, commit: sha, introducedBy: found.introducedBy };
    }
    files.push(entry);
  }

  const cls = files.some((f) => f.owner === 'own') ? 'own' : files.some((f) => f.owner === 'peer') ? 'peer' : 'unknown';
  const peers = new Map();
  for (const f of files.filter((x) => x.owner === 'peer')) {
    const id = `${f.workflowId}\0${f.jobId ?? ''}\0${f.commit ?? ''}`;
    const peer = peers.get(id) ?? { workflowId: f.workflowId, via: f.via, ...(f.jobId ? { jobId: f.jobId } : {}), ...(f.commit ? { commit: f.commit } : {}), files: [] };
    peer.files.push(f.path);
    peers.set(id, peer);
  }
  return { class: cls, files, peers: [...peers.values()] };
}

/**
 * The typed way the settling Kernel hands a peer-blocked gate to its peer: an in-flight job is waited
 * on (`--until-job <job>:succeeded`), a landed commit is routed to its introducer as a shared blocker,
 * and a sibling job of the same workflow is the Kernel's own to sequence.
 */
export function peerRouteOf(workflowId, peer, checkName) {
  const detail = `repo-wide ${checkName} is red on ${peer.files.join(', ')}`;
  if (peer.workflowId === workflowId) return `sibling job ${peer.jobId ?? peer.commit} of this workflow owns ${peer.files.join(', ')}: re-run ${checkName} after it settles`;
  return peer.jobId
    ? `api incident --workflow ${workflowId} --kind peer-wait --peer ${peer.workflowId} --until-job ${peer.jobId}:succeeded --detail "${detail} (in-flight change of ${peer.jobId})"`
    : `api incident --workflow ${workflowId} --kind shared-blocker --introduced-by ${peer.commit} --detail "${detail} (commit ${String(peer.commit).slice(0, 12)})"`;
}
