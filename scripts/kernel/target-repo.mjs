// The repository each owned path of a job lands in — one resolver for api
// enqueue (records payload.repository), api dispatch (names the checkout per
// owned path in the packet) and api settle (runs the landed proof there).
// Side folders come from the app binding whose repository owns Work and the ledger.
// Contract: modules/kernel/api.yaml commands.enqueue / commands.settle landed.
import fs from 'node:fs';
import path from 'node:path';
import { revParseQuery } from '../api/git/rev-parse-query.mjs';
import { readModuleJson, starciSourceRoot } from '../../engine/runtime-root.mjs';
import { readJsonFile } from '../lib/json.mjs';
import { isDir } from '../lib/fs-kind.mjs';
import { foldCase, realPath } from '../lib/path-key.mjs';

const key = (value) => foldCase(realPath(value));
const samePath = (a, b) => key(a) === key(b);


// The binding (.workspaces/projects/<p>/work.json) whose app repository is
// `repo`, or null — no binding means --repo is authoritative.
export function projectBinding(repo, { sourceRoot = starciSourceRoot() } = {}) {
  const projects = path.join(sourceRoot, '.workspaces', 'projects');
  let entries = [];
  try { entries = fs.readdirSync(projects, { withFileTypes: true }); } catch { return null; }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const file = path.join(projects, entry.name, 'work.json');
    const doc = readJsonFile(file);
    if (doc?.schema !== 'starci/workspace-binding@2'
      || typeof doc?.repository?.pathFromSource !== 'string' || !doc.repository.pathFromSource.trim()
      || typeof doc?.repository?.gitRepository !== 'string' || !doc.repository.gitRepository.trim()
      || doc?.sides?.be !== 'be' || doc?.sides?.fe !== 'fe'
      || doc?.work?.pathFromRepository !== '.starciwork') continue;
    const appRoot = path.resolve(sourceRoot, doc.repository.pathFromSource);
    if (!samePath(appRoot, repo)) continue;
    const repos = ['be', 'fe'].map((role) => ({ role, root: path.join(appRoot, doc.sides[role]), appRoot, gitRepository: doc.repository.gitRepository }));
    const workDir = doc.work.pathFromRepository;
    return { file, project: doc.project ?? entry.name, appRoot, workDir, repos };
  }
  return null;
}

/** Every repository root the given ledger repos are bound to (their own roots included): where product worktrees live. */
export function boundRepoRoots(ledgerRepos) {
  const out = new Map();
  for (const repo of (ledgerRepos ?? []).filter(Boolean)) {
    out.set(path.resolve(repo).toLowerCase(), path.resolve(repo));
    let binding = null;
    try { binding = projectBinding(repo); } catch { binding = null; }
    for (const r of binding?.repos ?? []) if (fs.existsSync(path.join(r.root, '.git'))) out.set(path.resolve(r.root).toLowerCase(), path.resolve(r.root));
  }
  return [...out.values()];
}

const repoName = (url) => (typeof url === 'string' ? url.replace(/[\\/]+$/, '').split(/[\\/:]/).pop().replace(/\.git$/i, '') : null);

// A repo id is a side (be or fe), or the app repository's name or path.
export function bindingRepo(binding, id) {
  if (!binding || typeof id !== 'string' || !id.trim()) return null;
  const want = id.trim();
  return binding.repos.find((r) => r.role === want)
    ?? binding.repos.find((r) => path.basename(r.root) === want)
    ?? (binding.appRoot && (repoName(binding.repos[0]?.gitRepository) === want || path.basename(binding.appRoot) === want || samePath(binding.appRoot, path.resolve(starciSourceRoot(), want)))
      ? { role: 'app', root: binding.appRoot, appRoot: binding.appRoot, gitRepository: binding.repos[0]?.gitRepository ?? null } : null)
    ?? binding.repos.find((r) => samePath(r.root, path.resolve(starciSourceRoot(), want)))
    ?? null;
}

// Ops delivered on the frontend side: every modules/models/kinds.yaml lane
// whose steps name the op matches only role: frontend nodes. The binding role
// of that side is `fe`.
export const FRONTEND_OPS = (() => {
  let doc;
  try { doc = readModuleJson('modules', 'models', 'kinds.yaml'); } catch { return new Set(); }
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
// A path without the trailing glob a directory grant may use.
const tidy = (p) => String(p).replace(/(^|\/)\*{1,2}$/, '').replace(/\/+$/, '') || '.';
const slashed = (p) => String(p).replace(/\\/g, '/');

// In a bound app every owned path is app-relative - the ONE form gate.mjs (--root <app> --changed), the knowledge and every
// finding use: be/<path>, fe/<path>, the Work dir (.starciwork/<path>) or a path of the app root (package.json, hfs.json,
// scripts/...). The side a path lands in is its first segment: be or fe, null for the Work dir, app for the app root.
export const sideOfAppPath = (binding, owned) => {
  const head = tidy(slashed(owned)).split('/')[0];
  if (head === (binding?.workDir ?? '.starciwork')) return null;
  return binding?.repos.find((r) => r.role === head)?.role ?? 'app';
};

/**
 * Why an owned path is not app-relative in a bound app, or null when it is. Refused: a repository:<id>/ prefix, an absolute
 * path, a ../ or ./ path, the app's own name as a prefix, and a side-relative path - one whose first segment is not at the app
 * root but is inside a side (src/main.ts where be/src/main.ts is meant).
 */
export function appRelativeProblem(binding, owned) {
  const norm = slashed(owned);
  const hint = 'an owned path of a bound app is app-relative: be/<path>, fe/<path>, .starciwork/<path> or a path of the app root';
  if (REPO_PREFIX.test(norm)) return `${owned} names a repository; ${hint}`;
  if (path.isAbsolute(owned) || /^[A-Za-z]:/.test(norm)) return `${owned} is absolute; ${hint}`;
  if (norm === '..' || norm.startsWith('../') || norm.startsWith('./')) return `${owned} is relative to another directory; ${hint}`;
  const rel = tidy(norm);
  const [head, ...rest] = rel.split('/');
  if (head === '.' || head === binding.workDir || binding.repos.some((r) => r.role === head)) return null;
  if (fs.existsSync(path.join(binding.appRoot, head))) return null;
  if (rest.length && head === path.basename(binding.appRoot)) return `${owned} starts with the app's name; ${hint}`;
  const sides = binding.repos.filter((r) => fs.existsSync(path.join(r.root, head))).map((r) => `${r.role}/${rel}`);
  return sides.length ? `${owned} is side-relative (it means ${sides.join(' or ')}); ${hint}` : null;
}

// The repository a job's bare owned paths target, or null when nothing
// overrides where dispatch placed the worker: payload.repository when set,
// else the side of a role-specific op. An unresolvable
// payload.repository is {unresolved}.
export function jobTargetRepository({ op, payload, binding }) {
  const id = typeof payload?.repository === 'string' ? payload.repository.trim() : '';
  if (id) {
    const bound = bindingRepo(binding, id);
    if (bound) return { id, role: bound.role, root: bound.root, via: 'payload.repository' };
    if (path.isAbsolute(id) && isDir(id)) return { id, role: null, root: path.resolve(id), via: 'payload.repository' };
    return { id, unresolved: true, via: 'payload.repository' };
  }
  const role = FRONTEND_OPS.has(op) ? 'fe' : String(op ?? '').startsWith('backend.') ? 'be' : null;
  if (!role) return null;
  const side = bindingRepo(binding, role);
  return side ? { id: role, role, root: side.root, via: 'op-side' } : null;
}

// The repository id enqueue records on a new job's payload. In a bound app every owned path must be app-relative
// (path-not-app-relative otherwise) and names its side by its first segment: one side is that role, several (or a
// path of the app root) is `app`; Work paths alone fall back to an explicit --repository or the op's side. An
// explicit --repository is resolved through the binding (refused when it cannot be). Unbound, --repository or
// none (the job targets where dispatch places it).
export function enqueueRepository({ op, repository, ownedPaths, repo }) {
  const binding = projectBinding(repo);
  if (binding) {
    for (const owned of ownedPaths) {
      const problem = appRelativeProblem(binding, owned);
      if (problem) return { ok: false, reason: 'path-not-app-relative', detail: problem };
    }
    const roles = new Set(ownedPaths.map((owned) => sideOfAppPath(binding, owned)).filter(Boolean));
    if (roles.size > 1) return { ok: true, repository: 'app' };
    if (roles.size) return { ok: true, repository: [...roles][0] };
  } else {
    const named = ownedPaths.find((owned) => REPO_PREFIX.test(slashed(owned)));
    if (named) return { ok: false, reason: 'path-repository-unknown', detail: `owned path ${named} names a repository, which no project binding for this repo can resolve` };
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
  const r = revParseQuery(['--path-format=absolute', '--git-common-dir'], { dir, timeout });
  return !r.error && r.status === 0 && r.stdout.trim() ? key(r.stdout.trim()) : null;
};

// Each owned path as {owned, base, path, role, via}: the directory it resolves against and the path relative to it.
// In a bound app every owned path is app-relative (appRelativeProblem): it resolves against the app checkout - the
// contract worktree when that is a checkout of the app, else the app root - and keeps its spelling, so the packet, the
// leases, settle's landed proof and gate.mjs all name the same path. Its role is its side (sideOfAppPath: be, fe, app,
// or null for a Work path, whose via is work-owner). A path that is not app-relative is {unresolved} (enqueue refuses it).
// Unbound: a repository:<id>/ path is {unresolved}; an absolute path lands in its own directory; a bare path in the
// payload's repository (jobTargetRepository), else where dispatch placed the worker - the contract worktree when it is a
// directory, else the ledger repo.
export function ownedPathPlacements({ op, payload, ownedPaths, repo, worktree, timeoutMs }) {
  const binding = projectBinding(repo);
  const placement = worktree && isDir(worktree) ? worktree : repo;
  if (binding) {
    const wtCommon = worktree && isDir(worktree) ? gitCommonDir(worktree, timeoutMs) : null;
    const top = wtCommon && wtCommon === gitCommonDir(binding.appRoot, timeoutMs)
      ? revParseQuery(['--show-toplevel'], { dir: worktree, timeout: timeoutMs }) : null;
    const checkout = top && !top.error && top.status === 0 && top.stdout.trim() ? path.resolve(top.stdout.trim()) : binding.appRoot;
    return ownedPaths.map((owned) => {
      if (appRelativeProblem(binding, owned)) return { owned, unresolved: true, repository: 'not-app-relative', via: 'not-app-relative' };
      const norm = slashed(owned);
      const role = sideOfAppPath(binding, norm);
      return { owned, base: checkout, path: norm, role, via: role === null ? 'work-owner' : 'app-relative' };
    });
  }
  const target = jobTargetRepository({ op, payload, binding: null });
  return ownedPaths.map((owned) => {
    const norm = slashed(owned);
    const m = REPO_PREFIX.exec(norm);
    if (m) return { owned, unresolved: true, repository: m[1], via: 'path-repository' };
    if (path.isAbsolute(owned)) return { owned, base: path.dirname(owned), path: path.basename(owned), role: null, via: 'path-absolute' };
    if (target?.unresolved) return { owned, unresolved: true, repository: target.id, via: target.via };
    if (target) return { owned, base: target.root, path: owned, role: target.role, via: target.via };
    return { owned, base: placement, path: owned, role: null, via: 'placement' };
  });
}
