// The repository each owned path of a job lands in — one resolver for api
// enqueue (records payload.repository), api dispatch (names the checkout per
// owned path in the packet) and api settle (runs the landed proof there).
// Repositories come from the project binding whose Work owner is the ledger
// repo (modules/schemas/workspace-routing.yaml registry + bindingShape).
// Contract: modules/kernel/api.yaml commands.enqueue / commands.settle landed.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { readDistJson, skillRoot } from '../../engine/runtime-root.mjs';

// STARCI_SOURCE_ROOT is the same registry seam scripts/goal/define-goal.mjs reads.
export const sourceRootOf = () => (process.env.STARCI_SOURCE_ROOT
  ? path.resolve(process.env.STARCI_SOURCE_ROOT) : path.dirname(skillRoot));

const canonical = (value) => {
  const resolved = path.resolve(value);
  try { return fs.realpathSync.native(resolved); } catch { return resolved; }
};
const key = (value) => (process.platform === 'win32' ? canonical(value).toLowerCase() : canonical(value));
const samePath = (a, b) => key(a) === key(b);
const inside = (root, abs) => {
  const rel = path.relative(key(root), key(abs));
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
};
const isDir = (p) => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };

// The binding (.workspaces/projects/<p>/work.json) whose work.ownerRole
// repository is `repo`, or null — no binding means --repo is authoritative.
export function projectBinding(repo, { sourceRoot = sourceRootOf() } = {}) {
  const projects = path.join(sourceRoot, '.workspaces', 'projects');
  let entries = [];
  try { entries = fs.readdirSync(projects, { withFileTypes: true }); } catch { return null; }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const file = path.join(projects, entry.name, 'work.json');
    let doc;
    try { doc = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { continue; }
    const repos = Object.entries(doc?.repositories ?? {})
      .filter(([, r]) => typeof r?.pathFromSource === 'string' && r.pathFromSource.trim())
      .map(([role, r]) => ({ role, root: path.resolve(sourceRoot, r.pathFromSource), gitRepository: r.gitRepository ?? null }));
    const ownerRole = doc?.work?.ownerRole ?? 'be';
    const owner = repos.find((r) => r.role === ownerRole);
    if (!owner || !samePath(owner.root, repo)) continue;
    const workDir = typeof doc?.work?.pathFromRepository === 'string' && doc.work.pathFromRepository.trim()
      ? doc.work.pathFromRepository.trim().replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '') : '.starciwork';
    return { file, project: doc.project ?? entry.name, ownerRole, workDir, repos };
  }
  return null;
}

const repoName = (url) => (typeof url === 'string' ? url.replace(/[\\/]+$/, '').split(/[\\/:]/).pop().replace(/\.git$/i, '') : null);

// A repo id is a binding role (be, fe, grammar), the repository's name (its
// gitRepository or directory basename), or a path to its root.
export function bindingRepo(binding, id) {
  if (!binding || typeof id !== 'string' || !id.trim()) return null;
  const want = id.trim();
  return binding.repos.find((r) => r.role === want)
    ?? binding.repos.find((r) => repoName(r.gitRepository) === want || path.basename(r.root) === want)
    ?? binding.repos.find((r) => samePath(r.root, path.resolve(sourceRootOf(), want)))
    ?? null;
}

// Ops delivered on the frontend side: every modules/models/kinds.yaml lane
// whose steps name the op matches only role: frontend nodes. The binding role
// of that side is `fe`.
export const FRONTEND_OPS = (() => {
  let doc;
  try { doc = readDistJson('modules', 'models', 'kinds.yaml'); } catch { return new Set(); }
  const sides = new Map();
  for (const lane of doc?.lanes ?? []) {
    const frontend = (lane.match ?? []).length > 0 && lane.match.every((m) => m?.role === 'frontend');
    for (const step of lane.steps ?? []) {
      const op = doc?.kinds?.[step.kind]?.operator ?? step.kind;
      sides.set(op, (sides.get(op) ?? true) && frontend);
    }
  }
  return new Set([...sides].filter(([, frontend]) => frontend).map(([op]) => op));
})();

const REPO_PREFIX = /^repository:([^/\\]+)[/\\]?(.*)$/;
// A repository-relative path without the trailing glob a directory grant is
// sometimes spelled with (miamia-fe/* is the whole miamia-fe checkout).
const tidy = (p) => String(p).replace(/(^|\/)\*{1,2}$/, '').replace(/\/+$/, '') || '.';

// The repository a job's bare owned paths target, or null when nothing
// overrides where dispatch placed the worker: payload.repository when set,
// else the binding's fe root for a frontend op. An unresolvable
// payload.repository is {unresolved}.
export function jobTargetRepository({ op, payload, binding }) {
  const id = typeof payload?.repository === 'string' ? payload.repository.trim() : '';
  if (id) {
    const bound = bindingRepo(binding, id);
    if (bound) return { id, role: bound.role, root: bound.root, via: 'payload.repository' };
    if (path.isAbsolute(id) && isDir(id)) return { id, role: null, root: path.resolve(id), via: 'payload.repository' };
    return { id, unresolved: true, via: 'payload.repository' };
  }
  const fe = FRONTEND_OPS.has(op) ? bindingRepo(binding, 'fe') : null;
  return fe ? { id: 'fe', role: 'fe', root: fe.root, via: 'op-frontend' } : null;
}

// The repository id enqueue records on a new job's payload: an explicit
// --repository (refused when the binding cannot resolve it), else fe for a
// frontend op of a bound project, else none (the job targets where dispatch
// places it). Also refuses a repository:<id>/ owned path the binding lacks.
export function enqueueRepository({ op, repository, ownedPaths, repo }) {
  const binding = projectBinding(repo);
  for (const owned of ownedPaths) {
    const m = REPO_PREFIX.exec(owned);
    if (m && !bindingRepo(binding, m[1])) {
      return { ok: false, reason: 'path-repository-unknown', detail: `owned path ${owned} names repository ${m[1]}, which ${binding ? `${binding.file} does not bind` : 'no project binding for this repo can resolve'}` };
    }
  }
  if (repository != null) {
    const bound = bindingRepo(binding, String(repository));
    if (bound) return { ok: true, repository: bound.role };
    if (path.isAbsolute(String(repository)) && isDir(String(repository))) return { ok: true, repository: path.resolve(String(repository)) };
    return { ok: false, reason: 'repository-unknown', detail: `--repository ${repository} names no repository ${binding ? `bound in ${binding.file}` : 'directory (no project binding for this repo)'}` };
  }
  const target = jobTargetRepository({ op, payload: {}, binding });
  return { ok: true, repository: target?.id ?? null };
}

const gitCommonDir = (dir, timeout) => {
  const r = spawnSync('git', ['-C', dir, 'rev-parse', '--path-format=absolute', '--git-common-dir'], { encoding: 'utf8', windowsHide: true, timeout });
  return !r.error && r.status === 0 && r.stdout.trim() ? key(r.stdout.trim()) : null;
};

// Each owned path as {base, path, role, via}: the directory it resolves
// against and the path relative to it. Order, first match wins:
//   1. a path that names its repository — repository:<id>/<rest>, an absolute
//      path, a relative one that resolves from the ledger repo into a bound
//      repository (../<fe>/src), or one whose first segment is a bound
//      repository's name (<fe-name>/src, <owner-name>/src) — lands there,
//      relative to that repository's root;
//   2. a Work path (<workDir>/…) lands in the Work owner (the ledger repo, or
//      the contract worktree when that is a checkout of it) — in a bound
//      project, whatever checkout the worker was placed in;
//   3. a bare path lands in jobTargetRepository;
//   4. else where dispatch placed the worker: the contract worktree when it
//      is a directory, else the ledger repo.
// A resolved repository root is replaced by the contract worktree when that
// worktree is a checkout of the same repository. An unresolvable repository
// yields {unresolved} entries.
export function ownedPathPlacements({ op, payload, ownedPaths, repo, worktree, timeoutMs }) {
  const binding = projectBinding(repo);
  const placement = worktree && isDir(worktree) ? worktree : repo;
  const wtCommon = worktree && isDir(worktree) ? gitCommonDir(worktree, timeoutMs) : null;
  const common = new Map();
  const commonOf = (root) => {
    if (!common.has(root)) common.set(root, isDir(root) ? gitCommonDir(root, timeoutMs) : null);
    return common.get(root);
  };
  const checkoutFor = (root) => (wtCommon && commonOf(root) === wtCommon ? worktree : root);
  const target = jobTargetRepository({ op, payload, binding });
  const workRoot = checkoutFor(repo);
  const workDir = binding?.workDir ?? '.starciwork';
  const roleOf = (root) => binding?.repos.find((r) => samePath(r.root, root))?.role ?? null;
  const deepest = [...(binding?.repos ?? [])].sort((a, b) => key(b.root).length - key(a.root).length);
  const holderOf = (abs) => deepest.find((r) => inside(r.root, abs)) ?? null;
  const rel = (root, abs) => path.relative(root, abs).replace(/\\/g, '/') || '.';
  const named = (head) => (head && head !== '.' && head !== '..' && head !== workDir
    ? binding?.repos.find((r) => repoName(r.gitRepository) === head || path.basename(r.root) === head) ?? null : null);
  return ownedPaths.map((owned) => {
    const norm = String(owned).replace(/\\/g, '/');
    const m = REPO_PREFIX.exec(norm);
    if (m) {
      const bound = bindingRepo(binding, m[1]);
      return bound
        ? { owned, base: checkoutFor(bound.root), path: tidy(m[2]), role: bound.role, via: 'path-repository' }
        : { owned, unresolved: true, repository: m[1], via: 'path-repository' };
    }
    if (path.isAbsolute(owned)) {
      const bound = holderOf(owned);
      return bound
        ? { owned, base: checkoutFor(bound.root), path: rel(bound.root, owned), role: bound.role, via: 'path-absolute' }
        : { owned, base: path.dirname(owned), path: path.basename(owned), role: null, via: 'path-absolute' };
    }
    if (norm.startsWith('../') && binding) {
      const abs = path.resolve(repo, owned);
      const bound = holderOf(abs);
      if (bound) return { owned, base: checkoutFor(bound.root), path: rel(bound.root, abs), role: bound.role, via: 'path-relative' };
    }
    const [head, ...rest] = norm.split('/');
    const byName = rest.length ? named(head) : null;
    if (byName) return { owned, base: checkoutFor(byName.root), path: tidy(rest.join('/')), role: byName.role, via: 'path-repository-name' };
    if (target?.unresolved) return { owned, unresolved: true, repository: target.id, via: target.via };
    const workPath = norm === workDir || norm.startsWith(`${workDir}/`);
    if (workPath && (target || (binding && path.resolve(workRoot) !== path.resolve(placement)))) return { owned, base: workRoot, path: owned, role: binding?.ownerRole ?? null, via: 'work-owner' };
    if (target) return { owned, base: checkoutFor(target.root), path: owned, role: target.role, via: target.via };
    return { owned, base: placement, path: owned, role: samePath(placement, repo) ? roleOf(repo) : null, via: 'placement' };
  });
}
