// hfs-tree.mjs - the facts about the work tree that `git ls-files` cannot show: directories with no file below them, sibling
// directories one typo apart (a renamed structure whose old copy was never removed), and entries git neither tracks nor
// ignores. hfs-check.mjs turns these facts into HFS_EMPTY_DIR, HFS_GHOST_TREE and HFS_UNTRACKED_ROOT_ENTRY findings (R03).
// Read-only: it walks the file system and asks git, nothing else.
import fs from 'node:fs';
import path from 'node:path';
import { lsFiles } from '../api/git/ls-files.mjs';
import { gitOutputOf } from '../lib/git.mjs';
import { posixPath } from '../lib/path-key.mjs';

/** Directory names no tree check enters: git's own store and installed packages. */
const NEVER_WALKED = new Set(['.git', 'node_modules']);
/** Two sibling names this close (Levenshtein) are the same name misspelt. */
const GHOST_DISTANCE = 2;

/** Levenshtein distance of two names. */
function editDistance(a, b) {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i];
    for (let j = 1; j <= b.length; j += 1) row[j] = Math.min(previous[j] + 1, row[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    previous = row;
  }
  return previous[b.length];
}

/**
 * The directory tree of `repoRoot` below any `ignored` slot: {name, rel, files, dirs: [node]}. A directory in an
 * ignored slot is not entered and counts as holding a file (its content is build output the repository does not own).
 * Links are not followed.
 */
export function readTree(repoRoot, { isIgnored }) {
  const walk = (abs, rel) => {
    const node = { name: path.basename(abs), rel, files: 0, dirs: [] };
    let entries;
    try { entries = fs.readdirSync(abs, { withFileTypes: true }); } catch { return node; }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const childRel = rel ? `${rel}/${entry.name}` : entry.name;
      if (!entry.isDirectory()) { node.files += 1; continue; }
      if (NEVER_WALKED.has(entry.name)) continue;
      if (isIgnored(childRel)) { node.files += 1; continue; }
      node.dirs.push(walk(path.join(abs, entry.name), childRel));
    }
    return node;
  };
  return walk(repoRoot, '');
}

const holdsNoFile = (node) => node.files === 0 && node.dirs.every(holdsNoFile);
const countDirs = (node) => node.dirs.reduce((sum, child) => sum + 1 + countDirs(child), 0);

/**
 * The tree's own findings: `empty` are the topmost directories with no file anywhere below them (each with the number of
 * directories it holds); `ghosts` are pairs of sibling directories within GHOST_DISTANCE edits where `ghost` has no file
 * below it and `of` is its lookalike.
 */
export function treeFacts(tree) {
  const empty = [];
  const ghosts = [];
  const visit = (node) => {
    for (const child of node.dirs) {
      if (holdsNoFile(child)) empty.push({ path: child.rel, below: countDirs(child) });
      else visit(child);
    }
    for (const [i, a] of node.dirs.entries()) {
      for (const b of node.dirs.slice(i + 1)) {
        if (editDistance(a.name, b.name) > GHOST_DISTANCE) continue;
        if (holdsNoFile(a)) ghosts.push({ path: a.rel, of: b.rel, distance: editDistance(a.name, b.name) });
        if (holdsNoFile(b)) ghosts.push({ path: b.rel, of: a.rel, distance: editDistance(a.name, b.name) });
      }
    }
  };
  visit(tree);
  return { empty, ghosts };
}

/** Entries git neither tracks nor ignores, as it prints them (a wholly untracked directory is one entry ending in '/'). */
export function untrackedEntries(repoRoot) {
  const out = gitOutputOf(lsFiles(['-z', '--others', '--exclude-standard', '--directory', '--no-empty-directory'], { dir: repoRoot, maxBuffer: 256 * 1024 * 1024 }), 'git ls-files');
  return out.split('\0').filter(Boolean).map(posixPath);
}
