// tree-strays.mjs — the files a workflow tree's ROOT holds that nothing owns: untracked, not ignored, no live job's owned path covers them, old enough that no
// writer is mid-write, small (a shell redirection's leftover, like the file named `0` that blocked a settle on 2026-10-09). The plan is the default; an apply
// removes only those files and never a tracked file, a directory, a dotfile or a path a live job owns.
import fs from 'node:fs';
import path from 'node:path';
import { porcelainStatus } from '../api/git/porcelain-status.mjs';
import { globExpression } from '../lib/glob.mjs';

/** Whether a live job's owned path (`.`, a file, a directory or a glob) covers the root-level file `name`. */
const covers = (owned, name) => {
  const rel = String(owned ?? '').replaceAll(String.fromCodePoint(92), '/').replace(/^\.\//, '').replace(/\/$/, '');
  return rel === '' || rel === '.' || rel === name || name.startsWith(`${rel}/`) || globExpression(rel).test(name);
};

/** The untracked, unignored regular files directly in `tree`: [{name, bytes, mtimeMs}]. */
function rootUntracked(tree) {
  const out = porcelainStatus(tree, { untracked: 'normal', version: 1, literal: true });
  if (!out.ok) return [];
  return String(out.stdout ?? '').split(/\r?\n/).filter((line) => line.startsWith('?? ')).map((line) => line.slice(3).replace(/^"|"$/g, ''))
    .filter((name) => !name.includes('/') && !name.startsWith('.')).flatMap((name) => {
      try {
        const stat = fs.lstatSync(path.join(tree, name));
        return stat.isFile() && !stat.isSymbolicLink() ? [{ name, bytes: stat.size, mtimeMs: stat.mtimeMs }] : [];
      } catch { return []; }
    });
}

/**
 * The strays of one workflow tree: [{name, bytes, ageMs}]. `owned` is the owned paths of the workflow's live jobs; `minAgeMs` and `maxBytes` bound what is a leftover
 * and not work in progress.
 */
export function strayFilesOf({ tree, owned = [], now = Date.now(), minAgeMs, maxBytes }) {
  return rootUntracked(tree).filter((file) => now - file.mtimeMs >= minAgeMs && file.bytes <= maxBytes && !owned.some((p) => covers(p, file.name)))
    .map((file) => ({ name: file.name, bytes: file.bytes, ageMs: Math.round(now - file.mtimeMs) }));
}

/** Removes the strays of `plan` from `tree` (re-checked as untracked just before): [{name, ok, error?}]. */
export function removeStrays(tree, plan) {
  const still = new Set(rootUntracked(tree).map((file) => file.name));
  return plan.map((stray) => {
    if (!still.has(stray.name)) return { name: stray.name, ok: false, error: 'no longer an untracked file of the root' };
    try { fs.rmSync(path.join(tree, stray.name), { force: true }); return { name: stray.name, ok: true }; } catch (error) { return { name: stray.name, ok: false, error: String(error?.message ?? error).slice(0, 160) }; }
  });
}
