// The owned paths of a job, read in the checkouts that hold them: landingRepos groups them per checkout,
// specBatches keeps each git argument list under the Windows command-line limit, and ownedPathEffects is the
// owned-path half of a dead worker's no-effect proof. Git only - no host calls. (No op commits: in a workflow
// worktree the runtime is the only committer, scripts/kernel/workflow-checkpoint.mjs.)
import fs from 'node:fs';
import path from 'node:path';
import { allocationMs } from '../../engine/config.mjs';
import { ownedPathspec } from '../../engine/admission.mjs';
import { revParseQuery } from '../api/git/rev-parse-query.mjs';
import { statusQuery as gitStatus } from '../api/git/status-query.mjs';
import { log as gitLog } from '../api/git/log.mjs';
import { gitResultOf } from '../lib/git.mjs';

/** One git call (a scripts/api/git call file) in the repository at `cwd`, as {ok, stdout, error}. */
const git = (call, cwd, args, timeout) => gitResultOf(call(args, { dir: cwd, timeout }));

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
  const repos = new Map(), probes = new Map();
  for (const item of placements ?? ownedPaths.map((owned) => ({ base, path: owned, role: null }))) {
    // A directory grant spelled with a trailing /** is the same prefix (engine/admission.mjs
    // normalizeOwnedPath); git reads every spec literally (ownedPathspec), so the suffix goes here.
    const abs = path.resolve(item.base, String(item.path).replace(/[\\/]\*\*[\\/]?$/, '') || '.');
    const dir = nearestExistingDir(abs);
    if (!dir) continue;
    if (!probes.has(dir)) probes.set(dir, [git(revParseQuery, dir, ['--show-toplevel'], timeoutMs), git(revParseQuery, dir, ['--show-prefix'], timeoutMs)]);
    const [top, prefix] = probes.get(dir);
    if (!top.ok || !prefix.ok || !top.stdout.trim()) continue;
    const root = path.resolve(top.stdout.trim());
    const rest = path.relative(dir, abs).replaceAll('\\', '/');
    const spec = `${prefix.stdout.trim()}${rest}`.replace(/\/+$/, '') || '.';
    if (!repos.has(root)) repos.set(root, { specs: [], role: item.role ?? null });
    repos.get(root).specs.push(spec);
  }
  return repos;
}

// Pathspecs in batches whose argv stays far below Windows' 32K command-line limit: a leg can own hundreds of
// exact files.
const SPEC_BATCH_CHARS = 12000;
export const specBatches = (specs) => {
  const out = [[]];
  let size = 0;
  for (const spec of specs) {
    if (size + spec.length > SPEC_BATCH_CHARS && out[out.length - 1].length) { out.push([]); size = 0; }
    out[out.length - 1].push(spec);
    size += spec.length + 12;
  }
  return out.filter((batch) => batch.length);
};

// Git for Windows stores a name's Windows-illegal characters ("*:<>?| and controls) as U+F000 + code
// (':' is U+F03A), while an owned path records the ASCII name: a job owning '.../-change:' never matched
// the '.../-change' its own commit deleted, so the file read as foreign (inc-54046f4a4f99). Git reads
// both spellings of a spec, and names are compared in the ASCII form.
const winMapped = (p) => String(p).replace(/[\u0001-\u001f"*:<>?|]/g, (c) => String.fromCharCode(0xf000 + c.charCodeAt(0)));
const bothSpellings = (specs) => [...new Set(specs.flatMap((s) => [s, winMapped(s)]))];

const dirtyOf = (root, specs, timeoutMs, label) => {
  const dirty = [];
  for (const batch of specBatches(bothSpellings(specs))) {
    // -z: NUL-separated records with literal paths — no C-quoting, so a name carrying bytes like the
    // U+F03A a Windows checkout writes for ':' round-trips (inc-e7e54ba0b970). A rename/copy record
    // is `XY <dest>\0<origin>`; the origin is the next record and is not itself evidence.
    const r = git(gitStatus, root, ['--porcelain', '-z', '--untracked-files=all', '--', ...batch.map(ownedPathspec)], timeoutMs);
    if (!r.ok) return { error: r.error };
    const records = r.stdout.split('\0');
    for (let i = 0; i < records.length; i++) {
      if (!records[i]) continue;
      dirty.push(`${label}${records[i].slice(3)}`);
      if (/[RC]/.test(records[i].slice(0, 2))) i++;
    }
  }
  return { dirty: [...new Set(dirty)] };
};

// The owned-path half of a dead worker's no-effect proof (api reconcile
// --dead-worker): every uncommitted change under the job's owned paths, and
// every commit on any ref that touched them since `sinceMs` (the dispatch
// contract's time). {provable:false, why} when the paths cannot be read — an
// unresolved repository, no git checkout holding an owned path, a git error —
// because an unreadable tree is never proof of no effect. With no owned paths
// there is nothing a worker could have changed: {provable:true, clean:true}.
const PREEXISTING_SLACK_MS = 5_000;
export function ownedPathEffects({ base, ownedPaths = [], placements, sinceMs }) {
  const timeoutMs = allocationMs('settleGit.commandMs');
  if ((placements ?? []).some((p) => p.unresolved)) return { provable: false, why: 'repository-unresolved' };
  const items = placements ?? ownedPaths.map((owned) => ({ base, path: owned, role: null }));
  if (!items.length) return { provable: true, clean: true, repos: [], dirty: [], commits: [], preexisting: [] };
  const repos = landingRepos({ base, ownedPaths, placements, timeoutMs });
  if (!repos.size) return { provable: false, why: 'no-checkout' };
  const since = new Date(Number.isFinite(sinceMs) ? sinceMs : 0).toISOString();
  const dirty = [], commits = [], checked = [], preexisting = [];
  for (const [root, { specs, role }] of repos) {
    const label = repos.size > 1 ? `${root}:` : '';
    const d = dirtyOf(root, specs, timeoutMs, label);
    if (d.error) return { provable: false, why: 'git-status', repo: root, error: d.error };
    const shas = new Set();
    for (const batch of specBatches(specs)) {
      const log = git(gitLog, root, ['--all', `--since=${since}`, '--format=%H', '--', ...batch.map(ownedPathspec)], timeoutMs);
      if (!log.ok) return { provable: false, why: 'git-log', repo: root, error: log.error };
      for (const sha of log.stdout.split('\n').map((line) => line.trim()).filter(Boolean)) shas.add(sha);
    }
    // A dirty file last written before the attempt's dispatch (PREEXISTING_SLACK_MS) is debris the
    // attempt found, not its effect: a product's modules-agentos brand.decide a1 never launched (launch-abandoned)
    // yet settled "partial" on brand-check files written 2026-09-21. A deleted file has no mtime and stays.
    const own = [], found = [];
    for (const file of d.dirty) {
      let mtime = null;
      try { mtime = fs.statSync(path.join(root, file.slice(label.length))).mtimeMs; } catch { /* deleted or unreadable: evidence */ }
      (Number.isFinite(sinceMs) && mtime != null && mtime < sinceMs - PREEXISTING_SLACK_MS ? found : own).push(file);
    }
    dirty.push(...own);
    preexisting.push(...found);
    commits.push(...shas);
    checked.push({ repo: root, role, paths: specs, dirty: own, commits: [...shas], ...(found.length ? { preexisting: found.length } : {}) });
  }
  return { provable: true, clean: !dirty.length && !commits.length, since, repos: checked, dirty, commits, preexisting };
}
