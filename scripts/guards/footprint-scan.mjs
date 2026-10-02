#!/usr/bin/env node
// footprint-scan.mjs — the worktree/link footprint watch, independent of every guard hook.
//
// A worker's command may slip past the command guard (a script, a tool that is not a shell), `git worktree remove` cannot be
// hooked, and a link can be made by any tool. So the runtime also LOOKS: under the repositories root (the parent of
// the source host repository) it lists
//   - every linked git worktree of a repository there that lives under the root (kernel and supervisor scratch lives
//     under the user's .starci home or the temp directory, never there), and
//   - every link (symlink, junction, other reparse point) to depth --depth whose target is in ANOTHER top-level
//     directory of the root than the link itself (a scratch tree's node_modules junctioned into a live checkout); a
//     workspace link inside its own repository and a link out of the root are not flagged.
// A worktree or link not seen by an earlier scan is FRESH. Every scan is one machine.sqlite host_samples row (kind
// worker-footprint, subject the root, detail {state, fresh}); the newest row's state is what the next scan compares
// against. Nothing is removed or changed - the Supervisor decides.
//
//   node scripts/guards/footprint-scan.mjs [--root <dir>] [--depth <n>] [--json]      one scan
//   The reconciler Host controller runs it every host.yaml footprintEveryMs (scripts/reconciler/controllers/host.mjs).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isLinkLike } from '../api/fs/is-link-like.mjs';
import { foldCase } from '../lib/path-key.mjs';
import { worktreeListQuery } from '../api/git/worktree-list-query.mjs';
import { allocationMs } from '../../engine/config.mjs';
import { isMain } from '../lib/is-main.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
export const SKILL_ROOT = path.resolve(here, '..', '..');
export const FOOTPRINT_EVERY_MS = allocationMs('footprint.everyMs');
export const FOOTPRINT_LOCK_STALE_MS = allocationMs('footprint.lockStaleMs');
const DEFAULT_DEPTH = 4;
const fold = foldCase;
/** The repositories root: the directory that holds the source host repository (its .claude is the runtime). */
export const defaultRoot = (skillRoot = SKILL_ROOT) => path.resolve(skillRoot, '..', '..');
const topOf = (root, p) => { const relative = path.relative(root, p); return relative && !relative.startsWith('..') && !path.isAbsolute(relative) ? relative.split(path.sep)[0] : null; };

/** Links under root to depth, never entered; inside node_modules only lstat is asked (a package dir is not walked). */
function linksUnderRoot(root, { depth = DEFAULT_DEPTH } = {}) {
  const found = [];
  const record = (p, stat) => {
    let target = null, real = null;
    try { target = fs.readlinkSync(p); } catch { /* not readable as a link */ }
    try { real = fs.realpathSync.native(p); } catch { /* dangling */ }
    found.push({ link: p, target, real, mtime: stat.mtime.toISOString() });
  };
  const visit = (dir, level, parentReal, inModules) => {
    let names; try { names = fs.readdirSync(dir); } catch { return; }
    for (const name of names) {
      if (name === '.git') continue;
      const p = path.join(dir, name); let stat; try { stat = fs.lstatSync(p); } catch { continue; }
      if (inModules ? stat.isSymbolicLink() : isLinkLike(p, { parentReal, stat })) { record(p, stat); continue; }
      if (!stat.isDirectory() || level >= depth) continue;
      let real; try { real = fs.realpathSync.native(p); } catch { continue; }
      visit(p, level + 1, real, inModules || name === 'node_modules');
    }
  };
  visit(path.resolve(root), 1, fs.realpathSync.native(root), false);
  return found;
}

/** Linked worktrees (not the main checkout) of every repository directly under root, that live under root. */
function worktreesUnderRoot(root, { git = (cwd, args) => worktreeListQuery(args, { cwd, timeout: 20_000 }) } = {}) {
  const found = [];
  let names; try { names = fs.readdirSync(root); } catch { return found; }
  for (const name of names) {
    const repo = path.join(root, name);
    try { if (!fs.statSync(path.join(repo, '.git')).isDirectory()) continue; } catch { continue; }
    const listed = git(repo, ['--porcelain']);
    if (listed.status !== 0) continue;
    const trees = String(listed.stdout).split(/\r?\n/).filter((line) => line.startsWith('worktree ')).map((line) => path.resolve(line.slice('worktree '.length)));
    for (const tree of trees.slice(1)) if (topOf(root, tree) !== null) found.push({ repo, worktree: tree });
  }
  return found;
}

/** One scan: {links, worktrees, fresh}. `state` is the previous scan's (keys seen); `now` stamps first sightings. */
export function scanFootprint({ root = defaultRoot(), depth = DEFAULT_DEPTH, state = null, now = new Date().toISOString(), git, listLinks = linksUnderRoot } = {}) {
  const resolvedRoot = path.resolve(root);
  const links = listLinks(resolvedRoot, { depth }).map((entry) => {
    const into = entry.real ?? entry.target ?? '';
    const from = topOf(resolvedRoot, entry.link), to = into ? topOf(resolvedRoot, path.resolve(path.dirname(entry.link), into)) : null;
    return { ...entry, kind: !into ? 'dangling' : to === null ? 'outside-root' : fold(to) === fold(from) ? 'same-repo' : 'cross-repo' };
  }).filter((entry) => entry.kind === 'cross-repo');
  const worktrees = worktreesUnderRoot(resolvedRoot, git ? { git } : {});
  // seen holds what this scan saw (with its first sighting): a link or worktree gone since is dropped, and one
  // made again at the same place later is fresh again.
  const before = state?.seen ?? {}, seen = {}, fresh = [];
  const note = (key, entry) => { seen[key] = before[key] ?? now; if (!before[key] && state) fresh.push(entry); };
  for (const entry of links) note(`link:${fold(entry.link)}`, { type: 'link', ...entry });
  for (const entry of worktrees) note(`worktree:${fold(entry.worktree)}`, { type: 'worktree', ...entry });
  return { root: resolvedRoot, depth, at: now, links, worktrees, fresh, state: { schema: 'starci/worker-footprint@1', lastScanAt: now, seen } };
}

/** Scan and record it (machine.sqlite host_samples kind worker-footprint). The first scan only records a baseline. */
async function runFootprintScan({ skillRoot = SKILL_ROOT, root = defaultRoot(skillRoot), depth = DEFAULT_DEPTH, env = process.env } = {}) {
  const { withMachine } = await import('../../engine/db/machine.mjs');
  return withMachine((m) => {
    const last = m.db.prepare("SELECT detail_json FROM host_samples WHERE kind='worker-footprint' AND subject=? ORDER BY seq DESC LIMIT 1").get(path.resolve(root));
    let state = null; try { state = JSON.parse(last?.detail_json ?? 'null')?.state ?? null; } catch { state = null; }
    const result = scanFootprint({ root, depth, state });
    m.recordHostSample({ kind: 'worker-footprint', subject: result.root, detailJson: { state: result.state, fresh: result.fresh } });
    return result;
  }, { env });
}

if (isMain(import.meta.url)) {
  const argv = process.argv.slice(2);
  const value = (name) => { const index = argv.indexOf(`--${name}`); return index >= 0 ? argv[index + 1] : null; };
  const result = await runFootprintScan({ ...(value('root') ? { root: value('root') } : {}), ...(value('depth') ? { depth: Number(value('depth')) } : {}) });
  if (argv.includes('--json')) process.stdout.write(`${JSON.stringify({ root: result.root, at: result.at, links: result.links, worktrees: result.worktrees, fresh: result.fresh }, null, 1)}\n`);
  else if (!argv.includes('--quiet')) process.stdout.write(`footprint: ${result.links.length} cross-repo link(s), ${result.worktrees.length} worktree(s) under ${result.root}; ${result.fresh.length} fresh\n`);
}
