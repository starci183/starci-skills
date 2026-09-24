// settle's landed proof. An op whose manifest policy.commitPolicy commits
// settles pass only when its owned paths are clean in the target checkout and
// the commit its report names (`head`) is in that checkout's history; when
// the policy also pushes, origin/<branch> must contain it too. Contract:
// modules/kernel/api.yaml commands.settle (refuses not-landed /
// landed-unverifiable). Git only — no host calls.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { allocationMs } from '../../engine/config.mjs';
import { ownedPathspec } from '../../engine/admission.mjs';

export const commitPolicyOf = (brief) => brief?.policy?.commitPolicy ?? null;
export const policyCommits = (policy) => !!policy && typeof policy === 'object'
  && typeof policy.mode === 'string' && policy.mode.trim() !== '' && policy.mode !== 'none';
export const policyPushes = (policy) => policyCommits(policy) && policy.push === true;

// The Work-authoring ops gained a committing commitPolicy with this registered change
// (modules/kernel/contract-changes.yaml). A leg of one of its ops admitted before it runs on the
// contract it was admitted under: no head owed at report, no landed proof at settle.
export const WORK_COMMIT_CHANGE = 'authoring-ops-commit-work';
export function admittedCommitPolicy({ policy, op, admittedAt, registry }) {
  const change = registry?.changes?.find((c) => c.id === WORK_COMMIT_CHANGE) ?? null;
  if (!change || change.safetyCritical || !Number.isFinite(admittedAt)) return policy;
  return change.ops.includes(op) && admittedAt < change.effectiveAt ? null : policy;
}

const git = (cwd, args, timeout) => {
  const r = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8', windowsHide: true, timeout });
  return {
    ok: !r.error && r.status === 0,
    stdout: r.stdout ?? '',
    error: (r.stderr ?? '').trim() || String(r.error?.message ?? (r.status == null ? 'timed out' : `exit ${r.status}`)),
  };
};

const nearestExistingDir = (abs) => {
  let dir = abs;
  while (!fs.existsSync(dir)) {
    const up = path.dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
  return fs.statSync(dir).isDirectory() ? dir : path.dirname(dir);
};

// Owned paths grouped by the git checkout that holds each one, as pathspecs
// relative to that checkout's top level. `placements` ({base, path, role} per
// owned path, scripts/kernel/target-repo.mjs ownedPathPlacements) resolve each
// path against its own repository; without them every path resolves against
// `base`. A path in no checkout is left out; no checkout at all means the job
// predates a resolvable target.
export function landingRepos({ base, ownedPaths = [], placements, timeoutMs }) {
  const repos = new Map();
  for (const item of placements ?? ownedPaths.map((owned) => ({ base, path: owned, role: null }))) {
    // A directory grant spelled with a trailing /** is the same prefix (engine/admission.mjs
    // normalizeOwnedPath); git reads every spec literally (ownedPathspec), so the suffix goes here.
    const abs = path.resolve(item.base, String(item.path).replace(/[\\/]\*\*[\\/]?$/, '') || '.');
    const dir = nearestExistingDir(abs);
    if (!dir) continue;
    const top = git(dir, ['rev-parse', '--show-toplevel'], timeoutMs);
    const prefix = git(dir, ['rev-parse', '--show-prefix'], timeoutMs);
    if (!top.ok || !prefix.ok || !top.stdout.trim()) continue;
    const root = path.resolve(top.stdout.trim());
    const rest = path.relative(dir, abs).replaceAll('\\', '/');
    const spec = `${prefix.stdout.trim()}${rest}`.replace(/\/+$/, '') || '.';
    if (!repos.has(root)) repos.set(root, { specs: [], role: item.role ?? null });
    repos.get(root).specs.push(spec);
  }
  return repos;
}

const dirtyOf = (root, specs, timeoutMs, label) => {
  const r = git(root, ['status', '--porcelain', '--untracked-files=all', '--', ...specs.map(ownedPathspec)], timeoutMs);
  if (!r.ok) return { error: r.error };
  return {
    dirty: r.stdout.split('\n').filter((line) => line.trim()).map((line) => `${label}${line.slice(3).trim()}`),
  };
};

// Every uncommitted or untracked file under a job's owned paths, per checkout: {repos:[{repo, role,
// dirty:[path relative to that checkout]}]} listing only checkouts with something dirty, or {error}
// when a path's repository is unresolved or git cannot answer (api reconcile --work-debt).
export function ownedPathsDirty({ base, ownedPaths = [], placements }) {
  const timeoutMs = allocationMs('settleGit.commandMs');
  if ((placements ?? []).some((p) => p.unresolved)) return { error: 'repository-unresolved' };
  const repos = [];
  for (const [root, { specs, role }] of landingRepos({ base, ownedPaths, placements, timeoutMs })) {
    const d = dirtyOf(root, specs, timeoutMs, '');
    if (d.error) return { error: d.error, repo: root };
    if (d.dirty.length) repos.push({ repo: root, role, dirty: d.dirty });
  }
  return { repos };
}

// The owned-path half of a dead worker's no-effect proof (api reconcile
// --dead-worker): every uncommitted change under the job's owned paths, and
// every commit on any ref that touched them since `sinceMs` (the dispatch
// contract's time). {provable:false, why} when the paths cannot be read — an
// unresolved repository, no git checkout holding an owned path, a git error —
// because an unreadable tree is never proof of no effect. With no owned paths
// there is nothing a worker could have changed: {provable:true, clean:true}.
export function ownedPathEffects({ base, ownedPaths = [], placements, sinceMs }) {
  const timeoutMs = allocationMs('settleGit.commandMs');
  if ((placements ?? []).some((p) => p.unresolved)) return { provable: false, why: 'repository-unresolved' };
  const items = placements ?? ownedPaths.map((owned) => ({ base, path: owned, role: null }));
  if (!items.length) return { provable: true, clean: true, repos: [], dirty: [], commits: [] };
  const repos = landingRepos({ base, ownedPaths, placements, timeoutMs });
  if (!repos.size) return { provable: false, why: 'no-checkout' };
  const since = new Date(Number.isFinite(sinceMs) ? sinceMs : 0).toISOString();
  const dirty = [], commits = [], checked = [];
  for (const [root, { specs, role }] of repos) {
    const d = dirtyOf(root, specs, timeoutMs, repos.size > 1 ? `${root}:` : '');
    if (d.error) return { provable: false, why: 'git-status', repo: root, error: d.error };
    const log = git(root, ['log', '--all', `--since=${since}`, '--format=%H', '--', ...specs.map(ownedPathspec)], timeoutMs);
    if (!log.ok) return { provable: false, why: 'git-log', repo: root, error: log.error };
    const shas = log.stdout.split('\n').map((line) => line.trim()).filter(Boolean);
    dirty.push(...d.dirty);
    commits.push(...shas);
    checked.push({ repo: root, role, paths: specs, dirty: d.dirty, commits: shas });
  }
  return { provable: true, clean: !dirty.length && !commits.length, since, repos: checked, dirty, commits };
}

// Returns {checked:false, why} when the job names no resolvable checkout (the
// settle then behaves as it always has), else {checked:true, ok, reason?, detail}.
// A placement with {unresolved} (a repository id the binding cannot resolve)
// is landed-unverifiable before any git read. detail.repos names the checkout,
// binding role and dirty paths of every repository checked.
export function landedProof({ base, ownedPaths, placements, head, branch, pushes }) {
  const timeoutMs = allocationMs('settleGit.commandMs');
  const unresolved = (placements ?? []).filter((p) => p.unresolved);
  if (unresolved.length) {
    return { checked: true, ok: false, reason: 'landed-unverifiable', detail: {
      step: 'repository', error: 'owned path names a repository the project binding cannot resolve',
      unresolved: unresolved.map((p) => ({ path: p.owned, repository: p.repository, via: p.via })),
    } };
  }
  const repos = landingRepos({ base, ownedPaths, placements, timeoutMs });
  if (!repos.size) return { checked: false, why: 'repo-unresolved' };
  const multi = repos.size > 1;
  const dirty = [], missing = [], checked = [];
  for (const [root, { specs, role }] of repos) {
    const d = dirtyOf(root, specs, timeoutMs, multi ? `${root}:` : '');
    if (d.error) return { checked: true, ok: false, reason: 'landed-unverifiable', detail: { repo: root, role, step: 'status', error: d.error } };
    dirty.push(...d.dirty);
    checked.push({ repo: root, role, paths: specs, dirty: d.dirty.map((p) => (multi ? p.slice(root.length + 1) : p)) });
  }
  const claimed = typeof head === 'string' && head.trim() ? head.trim() : null;
  let repo = [...repos.keys()][0];
  // api report requires head from committing ops; a done report filed before
  // that rule carries none, and settles on the clean-paths half alone.
  // A pushing policy has no such legacy and still owes head.
  let headCheck = 'verified';
  if (!claimed) {
    if (pushes) missing.push('head');
    else headCheck = 'skipped-legacy-report';
  } else {
    const holder = [...repos.keys()].find((root) => git(root, ['cat-file', '-e', `${claimed}^{commit}`], timeoutMs).ok);
    if (!holder) missing.push(`commit:${claimed}`);
    else {
      repo = holder;
      if (!git(repo, ['merge-base', '--is-ancestor', claimed, 'HEAD'], timeoutMs).ok) missing.push(`ancestor-of-HEAD:${claimed}`);
    }
  }
  const localHead = git(repo, ['rev-parse', 'HEAD'], timeoutMs);
  const detail = { repo, dirty, repos: checked, head: claimed, headCheck, localHead: localHead.ok ? localHead.stdout.trim() : null, missing };
  if (dirty.length || missing.length || !pushes) {
    return dirty.length || missing.length
      ? { checked: true, ok: false, reason: 'not-landed', detail }
      : { checked: true, ok: true, detail };
  }
  let onBranch = typeof branch === 'string' && branch.trim() ? branch.trim() : null;
  if (!onBranch) {
    const current = git(repo, ['rev-parse', '--abbrev-ref', 'HEAD'], timeoutMs);
    onBranch = current.ok && current.stdout.trim() !== 'HEAD' ? current.stdout.trim() : null;
  }
  detail.branch = onBranch;
  if (!onBranch) return { checked: true, ok: false, reason: 'landed-unverifiable', detail: { ...detail, step: 'branch', error: 'detached HEAD and the report names no branch' } };
  const fetched = git(repo, ['fetch', '--quiet', 'origin', onBranch], allocationMs('settleGit.fetchMs'));
  if (!fetched.ok) return { checked: true, ok: false, reason: 'landed-unverifiable', detail: { ...detail, step: 'fetch', error: fetched.error } };
  const originRef = git(repo, ['rev-parse', '--verify', '--quiet', `refs/remotes/origin/${onBranch}^{commit}`], timeoutMs);
  const originHead = (originRef.ok ? originRef : git(repo, ['rev-parse', 'FETCH_HEAD^{commit}'], timeoutMs)).stdout.trim() || null;
  detail.originHead = originHead;
  if (!originHead || !git(repo, ['merge-base', '--is-ancestor', claimed, originHead], timeoutMs).ok) {
    missing.push(`origin/${onBranch}:${claimed}`);
    return { checked: true, ok: false, reason: 'not-landed', detail };
  }
  return { checked: true, ok: true, detail };
}
