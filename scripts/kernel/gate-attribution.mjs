// gate-attribution.mjs — whose change turned a repo-wide gate red.
//
// Several ops share one product working tree, so a repo-wide gate (test:ci, typecheck, lint) run for
// op A reads op B's in-flight or landed change: one workflow's test:ci went red 812/813 on a peer
// workflow's commit 9caa2d5c and on that peer's uncommitted spec, and the first retried
// backend.implement for breakage it did not cause. The rule (modules/kernel/api.yaml commands.check peerBlocked): a red
// check names the files its failure implicates (`failing`: the failing spec and the source it
// points at); starci kernel record-checks attributes each file, and a red check none of whose files is this op's and
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
//   peer      (via preexisting) none of the above, the file is clean, outside this job's owned paths,
//             imports nothing under them, and its last commit - older than the lineage - resolves to
//             another workflow: the gate was already red on that workflow's change when this op
//             started (a collab workflow's inc-72edd7aa6741: typecheck red on workspace-provision's
//             c0e7552d, committed 04:08Z, before collab's lineage began 07:55Z; it read unknown, the
//             attempt was spent and backend.implement re-ran for hours on a file it may not touch)
//   foreign   a Work record file (under .starciwork/) outside this job's owned paths that nobody changed since the
//             lineage began (clean, no commit): a record this job may not write and did not touch - its refusal is
//             debt the job inherits, never its own failure (a product's app-auth op-interface.draw a4-a6
//             spent three attempts on DATA_STATUS_DRAWN in ui/session-ending records outside owned_paths). Code and
//             test files are never foreign: a change of this job can break a spec it does not own.
//   unknown   neither: nothing ties the file to anyone since the work began
// The check is `own` when any file is own, `peer` when none is own and one is peer, `foreign` when every file is
// foreign (starci kernel record-checks then records it advisory: counted neither passed nor failed), else `unknown`.
// A git read that fails leaves its file unknown, never peer. Ledger and git reads only.
//
// A failing file may live in another repository of the project binding (a backend op whose slice spans
// the frontend: a foundation leg's fe typecheck red on a component spec of the
// frontend repository): an absolute path under a bound root, or a path whose first
// segment names a bound repository holding it, is read with git in that repository.
import fs from 'node:fs';
import path from 'node:path';
import { findOwnedPathLeaseConflicts, leaseCompareForm, normalizeOwnedPath, ownedPathLeaseRequests, ownedPathsIntersect } from '../../engine/admission.mjs';
import { statusQuery as gitStatus } from '../api/git/status-query.mjs';
import { log as gitLog } from '../api/git/log.mjs';
import { gitResultOf } from '../lib/git.mjs';

// The git calls of the attribution, by verb (the `git` seam takes the whole argv): each through its scripts/api/git call file.
const ATTRIBUTION_CALLS = { status: gitStatus, log: gitLog };
import { resolveIntroducer } from './introducer.mjs';
import { lineageJobsOf } from '../machine/owner-answers.mjs';
import { parseJsonOr } from '../lib/json.mjs';
import { insidePath, sameResolvedPath } from '../lib/path-key.mjs';

/** The Work tree: a record file there is judged by the record alone, so an untouched one outside the slice is foreign. */
const WORK_RECORD_PREFIX = '.starciwork/';
const isWorkRecord = (file) => String(file).replaceAll('\\', '/').replace(/^\.\//, '').startsWith(WORK_RECORD_PREFIX);
const payloadOf = (row) => parseJsonOr(row?.payload_json ?? '{}') ?? {};
const LEASE_PREFIX = 'path:';
const LOG_DEPTH = 200;
// A gate's position suffix: tsc `file(12,5)`, jest/eslint `file:12:5` or `file:12`.
const POSITION = /(?:\(\d+,\d+\)|:\d+(?::\d+)?)$/;

/** A failing file as the gate printed it, repo-relative with forward slashes; null when unusable. */
export function failingPath(value, repo) {
  if (typeof value !== 'string' || !value.trim()) return null;
  let file = value.trim().replaceAll('\\', '/').replace(POSITION, '');
  if (path.isAbsolute(file) && repo) file = path.relative(repo, file).replaceAll('\\', '/');
  try { return normalizeOwnedPath(file); } catch { return null; }
}

// A source path the way a gate prints it (tsc `file(12,5)`, jest/eslint `file:12:5`, a bare path).
const SOURCE_PATH_PREFIX = String.raw`(?:^|[\s'"\x60([,])`;
const SOURCE_PATH_NAME = String.raw`((?:[A-Za-z]:)?[\w.@~-]*(?:[\\/][\w.@~\[\]()-]+)+\.(?:[mc]?ts|tsx|[mc]?js|jsx))`;
const SOURCE_PATH_POSITION = String.raw`(?:\((\d+),\d+\)|:(\d+)(?::\d+)?)?`;
const SOURCE_PATH = new RegExp(`${SOURCE_PATH_PREFIX}${SOURCE_PATH_NAME}${SOURCE_PATH_POSITION}`, 'g');
const FAILING_CAP = 20;
/**
 * The failing files a red check's own text names, for a check that carries no `failing` list: a Kernel
 * that re-ran `npm run typecheck` and wrote the tsc line into its evidence (a collab
 * op-backend.implement-bd2609ff17, check peer-typecheck-failure-confirmed) is still attributed.
 * node_modules paths and URLs never count; at most FAILING_CAP distinct files, in order, `path[:line]`.
 */
export function failingFromText(text) {
  const out = [];
  for (const match of String(text ?? '').matchAll(SOURCE_PATH)) {
    const file = match[1];
    if (/node_modules/.test(file) || /:\/\//.test(match[0])) continue;
    const line = match[2] ?? match[3] ?? null;
    if (out.some((seen) => seen.replace(/:\d+$/, '') === file)) continue;
    out.push(line ? `${file}:${line}` : file);
    if (out.length >= FAILING_CAP) break;
  }
  return out;
}

const IMPORT_SPEC_PATTERN = String.raw`(?:\bfrom\s*|\b(?:import|require)\s*\(\s*|^[^\S\r\n  ]*import\s+)['"]([^'"]+)['"]`;
const IMPORT_SPEC = new RegExp(IMPORT_SPEC_PATTERN, 'gm');
const dropFirst = (value) => value.split('/').slice(1).join('/');
/**
 * Whether `file` (repo-relative in `root`) imports anything under `owned` (plain repo-relative paths):
 * a relative specifier resolved against the file; an alias one (`@/x`, `~/x`, `src/x`) as written and
 * without its first segment; a barrel above an owned path counts. A file that cannot be read imports
 * everything - never a peer on a guess.
 */
function importsOwned(root, file, owned) {
  let body;
  try { body = fs.readFileSync(path.join(root, file), 'utf8'); } catch { return true; }
  const forms = [...new Set(owned.flatMap((p) => [p, dropFirst(p)]).filter(Boolean))];
  const hits = (candidate) => forms.some((form) => candidate === form || candidate.startsWith(`${form}/`) || form.startsWith(`${candidate}/`));
  for (const match of body.matchAll(IMPORT_SPEC)) {
    const spec = match[1].replaceAll('\\', '/').replace(/\.(?:[cm]?[jt]sx?)$/, '').replace(/\/index$/, '');
    const candidates = spec.startsWith('.')
      ? [path.posix.normalize(path.posix.join(path.posix.dirname(file), spec))]
      : [spec, ...(/^[@~]/.test(spec) ? [dropFirst(spec)] : [])];
    if (candidates.some((candidate) => candidate && !candidate.startsWith('..') && hits(candidate))) return true;
  }
  return false;
}

/**
 * Where one failing entry lives: {root, rel (repo-relative in root), key (the spelling the owned-path
 * canon compares)} - the ledger repository, unless the entry is absolute under another bound root or its
 * first segment names another bound repository that holds it. null when unusable.
 */
function locateFailing(value, { repo, roots }) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const raw = value.trim().replaceAll('\\', '/').replace(POSITION, '');
  if (path.isAbsolute(raw)) {
    const other = roots.find((r) => !sameResolvedPath(r.root, repo) && insidePath(r.root, raw));
    if (other) {
      const rel = failingPath(path.relative(other.root, raw), null);
      return rel ? { root: other.root, rel, key: `${other.name}/${rel}` } : null;
    }
  }
  const file = failingPath(raw, repo);
  if (!file) return null;
  const [head, ...rest] = file.split('/');
  const other = rest.length ? roots.find((r) => !sameResolvedPath(r.root, repo) && r.name.toLowerCase() === head.toLowerCase()) : null;
  if (other && fs.existsSync(path.join(other.root, ...rest)) && !fs.existsSync(path.join(repo, file))) {
    return { root: other.root, rel: rest.join('/'), key: file };
  }
  // A path printed relative to another repository's root (its own `npm run typecheck`): the one bound
  // repository that holds it, when the ledger repository does not.
  if (!fs.existsSync(path.join(repo, file))) {
    const holders = roots.filter((r) => !sameResolvedPath(r.root, repo) && fs.existsSync(path.join(r.root, file)));
    if (holders.length === 1) return { root: holders[0].root, rel: file, key: `${holders[0].name}/${file}` };
  }
  return { root: repo, rel: file, key: file };
}

/**
 * attributeRedGate(db, {repo, job, failing, canon?, git?}) ->
 *   {class, files:[{path, owner, via?, workflowId?, jobId?, commit?}], peers:[{workflowId, via, jobId?, commit?, files[]}]}
 * `canon` is the ledger's lease canonicalizer (scripts/kernel/lease-canon.mjs; its `binding` names the
 * project's other repositories); `git(args, dir)` returns {ok, stdout} (scripts/lib/git.mjs gitResultOf) and defaults to git
 * in `dir` (the repository holding the file).
 */
// The owner the file's post-lineage commits name: 'own' on this workflow's commit, else 'peer' on the
// first resolvable commit of another workflow; 'unknown' while every commit is unresolved.
const committedOwner = (file, commits, root, ctx) => {
  let entry = { path: file, owner: 'unknown' };
  for (const sha of commits) {
    const found = ctx.introducerOf(sha, root);
    if (found.unresolved) continue;
    if (ctx.ownWorkflow(found)) return { path: file, owner: 'own', via: 'commit', commit: sha };
    if (entry.owner === 'unknown') entry = { path: file, owner: 'peer', via: 'commit', workflowId: found.workflowId, commit: sha, introducedBy: found.introducedBy };
  }
  return entry;
};

// Red before this lineage began: nothing touched the file since, the tree holds its last commit's
// bytes, that commit is another workflow's, and nothing the file imports is this job's to change.
const preexistingOwner = (file, rel, history, root, ctx) => {
  const [sha] = history[0];
  const found = ctx.introducerOf(sha, root);
  return !found.unresolved && found.workflowId && !ctx.ownWorkflow(found) && !importsOwned(root, rel, ctx.ownedPlain)
    ? { path: file, owner: 'peer', via: 'preexisting', workflowId: found.workflowId, commit: sha, introducedBy: found.introducedBy }
    : null;
};

// One failing file's owner: this job's owned path, a peer lease on the dirty file, the commit history
// since the lineage began, a preexisting red, or untouched foreign work-record debt.
const attributeFile = ({ key: file, rel, root }, ctx) => {
  const key = ctx.canonical(file);
  if (ctx.own.some((mine) => ownedPathsIntersect(mine, ctx.compare(key)))) return { path: file, owner: 'own', via: 'owned-path' };
  const at = (args) => ctx.run(args, root);
  const status = at(['status', '--porcelain', '--', rel]);
  const dirty = status.ok && status.stdout.trim().length > 0;
  const held = dirty
    ? findOwnedPathLeaseConflicts(ctx.db, ownedPathLeaseRequests([key]), { excludeJobId: ctx.job.job_id, canonicalOf: ctx.canon?.canonicalOf ?? null })
    : [];
  if (held.length) {
    return { path: file, owner: 'peer', via: 'lease', workflowId: held[0].workflow_id, jobId: held[0].job_id };
  }
  // Committer times are filtered here, not by --since: git stops its walk at the first older commit.
  const log = Number.isFinite(ctx.since) ? at(['log', `-n${LOG_DEPTH}`, '--format=%H %ct', '--', rel]) : { ok: false };
  const history = log.ok ? log.stdout.split(/\r?\n/).map((line) => line.trim().split(' ')).filter(([sha]) => sha) : [];
  const commits = history.filter(([, when]) => Number(when) * 1000 >= ctx.since).map(([sha]) => sha);
  let entry = committedOwner(file, commits, root, ctx);
  if (entry.owner === 'unknown' && !isWorkRecord(rel) && !commits.length && status.ok && !dirty && history.length) {
    entry = preexistingOwner(file, rel, history, root, ctx) ?? entry;
  }
  // Untouched since the lineage began (clean and no commit) and a Work record: foreign debt, not this job's.
  if (entry.owner === 'unknown' && isWorkRecord(rel) && status.ok && !dirty && log.ok && !commits.length) entry = { path: file, owner: 'foreign', via: 'outside-owned-untouched' };
  return entry;
};

export function attributeRedGate(db, { repo, job, failing = [], canon = null, git = null }) {
  const run = git ?? (([verb, ...rest], dir = repo) => gitResultOf(ATTRIBUTION_CALLS[verb](rest, { dir, timeout: 20_000 })));
  const payload = payloadOf(job);
  const op = job.op_id ?? payload.opId ?? null;
  const canonical = (file) => (canon ? canon.canonical(file, { op, payload }) : file);
  const compare = (value) => leaseCompareForm(value);
  const own = (canon ? canon.requests(payload, op).map((r) => r.resourceKey.slice(LEASE_PREFIX.length))
    : (payload.owned_paths ?? []).map((p) => (typeof p === 'string' ? p : p?.path)).filter(Boolean)).map(compare);
  const roots = [{ root: repo, name: path.basename(repo) },
    ...(canon?.binding?.repos ?? []).filter((r) => r?.root && !sameResolvedPath(r.root, repo)).map((r) => ({ root: r.root, name: path.basename(r.root) }))];
  // The owned paths as plain prefixes (app-relative in a bound app): the import guard of a preexisting peer compares
  // against every one of them (importsOwned also tries each without its first segment, the side-relative spelling).
  const ownedPlain = [...new Set((payload.owned_paths ?? []).map((p) => (typeof p === 'string' ? p : p?.path)).filter(Boolean).map((p) => {
    try { return normalizeOwnedPath(String(p)); } catch { return null; }
  }).filter(Boolean))];
  const lineage = [job, ...lineageJobsOf(db, job)];
  const since = Math.min(...lineage.map((row) => Number(row.created_at)).filter(Number.isFinite));
  const introducers = new Map();
  const introducerOf = (sha, root) => {
    if (!introducers.has(sha)) introducers.set(sha, resolveIntroducer(db, { commits: [sha], roots: [root, ...roots.map((r) => r.root).filter((r) => !sameResolvedPath(r, root))] }));
    return introducers.get(sha);
  };
  const ownWorkflow = (found) => found.introducedBy === job.workflow_id || found.workflowId === job.workflow_id;

  const located = new Map();
  for (const entry of failing.map((f) => locateFailing(f, { repo, roots })).filter(Boolean)) if (!located.has(entry.key)) located.set(entry.key, entry);
  const ctx = { canonical, own, compare, run, since, job, db, canon, introducerOf, ownWorkflow, ownedPlain };
  const files = [...located.values()].map((entry) => attributeFile(entry, ctx));

  let cls = 'unknown';
  if (files.some((f) => f.owner === 'own')) cls = 'own';
  else if (files.some((f) => f.owner === 'peer')) cls = 'peer';
  else if (files.length && files.every((f) => f.owner === 'foreign')) cls = 'foreign';
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
    ? `starci kernel incident --workflow ${workflowId} --kind peer-wait --peer ${peer.workflowId} --until-job ${peer.jobId}:succeeded --detail "${detail} (in-flight change of ${peer.jobId})"`
    : `starci kernel incident --workflow ${workflowId} --kind shared-blocker --introduced-by ${peer.commit} --detail "${detail} (commit ${String(peer.commit).slice(0, 12)})"`;
}
