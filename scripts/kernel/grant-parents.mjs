// A write grant must be satisfiable: the directory the worker writes into has to exist in the target repository.
// `starci kernel enqueue` and `starci kernel dispatch` refuse (reason grant-parent-missing) an owned path whose directory - the
// path itself for a directory/glob grant, its parent for a file grant - is absent, and name the missing
// directory and the closest one that exists (a grant under my-app/src/app when my-app keeps its router at
// apps/app/src/app could never be met). A create-new-module grant is explicit: `--new-module <repo-relative
// dir,...>` on enqueue (payload.new_modules) exempts the grants under that module root, provided the module
// root's own parent directory exists. Work paths (.starciwork/...) are authored by Work ops and are not checked.
import path from 'node:path';
import { ownedPathPlacements, projectBinding } from './target-repo.mjs';
import { isDir } from '../lib/fs-kind.mjs';

const slash = (p) => String(p).replaceAll('\\', '/');
const GLOB_OR_DIR = new RegExp(String.raw`(^|\/)\*{1,2}$`);
const isGlobOrDir = (p) => GLOB_OR_DIR.test(p) || p.endsWith('/');
const tidy = (p) => slash(p).replace(/(^|\/)\*{1,2}$/, '').replace(/\/+$/, '').replace(/^\.\//, '') || '.';

const newModulesOf = (payload) => (Array.isArray(payload?.new_modules) ? payload.new_modules : []);

/** The closest existing directory at or above `rel` inside `base`, as a repo-relative path ('.' is the repo root). */
function closestExisting(base, rel) {
  let cur = rel;
  while (cur && cur !== '.' && !isDir(path.join(base, cur))) cur = path.posix.dirname(cur);
  return cur || '.';
}

/**
 * Violations of the grant-parent rule for placed owned paths (target-repo.mjs ownedPathPlacements output).
 * Each is {owned, base, dir, closest, atRoot, newModule?} - `dir` the repo-relative directory that must exist.
 */
function grantParentViolations({ placements, newModules = [], workDir = '.starciwork' }) {
  const modules = newModules.map(tidy).filter((m) => m !== '.');
  const out = [];
  for (const place of placements) {
    if (place.unresolved || !place.base) continue;
    const rel = tidy(place.path);
    if (rel === '.' || rel === workDir || rel.startsWith(`${workDir}/`) || place.via === 'work-owner') continue;
    const dir = isGlobOrDir(slash(place.path)) ? rel : path.posix.dirname(rel);
    const declared = modules.find((m) => rel === m || rel.startsWith(`${m}/`));
    if (declared) {
      const parent = path.posix.dirname(declared);
      if (parent === '.' || isDir(path.join(place.base, parent))) continue;
      const closest = closestExisting(place.base, parent);
      out.push({ owned: place.owned, base: place.base, dir: parent, closest, atRoot: closest === '.', newModule: declared });
      continue;
    }
    if (dir === '.' || isDir(path.join(place.base, dir))) continue;
    const closest = closestExisting(place.base, dir);
    out.push({ owned: place.owned, base: place.base, dir, closest, atRoot: closest === '.' });
  }
  return out;
}

const violationDetail = (v) => {
  const need = v.newModule
    ? `the new module ${v.newModule} needs its parent directory ${v.dir}, which does not exist`
    : `directory ${v.dir} does not exist`;
  const closest = v.closest === '.' ? 'the repository root' : v.closest;
  const atRoot = v.atRoot ? ' (only the repository root exists on that path)' : '';
  return `${v.owned}: ${need}; closest existing directory is ${closest}${atRoot}`;
};

/** One refusal detail naming each missing directory and the closest existing one. */
function grantParentDetail(violations) {
  const shown = violations.slice(0, 4).map(violationDetail);
  return `${violations.length} owned path(s) could never be satisfied: ${shown.join('; ')}. Fix the path to the real directory, or declare a new module with --new-module <repository-relative dir>`;
}

/** Check the owned paths of a job; {ok:true} or {ok:false, reason, violations, detail}. */
export function checkGrantParents({ op, payload, ownedPaths, repo, timeoutMs }) {
  const workDir = projectBinding(repo)?.workDir ?? '.starciwork';
  const placements = ownedPathPlacements({ op, payload, ownedPaths, repo, worktree: null, timeoutMs });
  const violations = grantParentViolations({ placements, newModules: newModulesOf(payload), workDir });
  return violations.length ? { ok: false, reason: 'grant-parent-missing', violations, detail: grantParentDetail(violations) } : { ok: true };
}
