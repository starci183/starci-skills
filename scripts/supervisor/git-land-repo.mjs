// git-land-repo.mjs — link-safe worktree inspection and the local-main-only fast-forward for `starci git land`.
// Verification trailers are stored in refs/notes/land: the lane tip remains byte-for-byte unchanged and nothing is pushed.
import fs from 'node:fs';
import path from 'node:path';
import { isLinkLike } from '../api/fs/is-link-like.mjs';
import { merge as mergeCall } from '../api/git/merge.mjs';
import { notes as notesCall } from '../api/git/notes.mjs';
import { revParseQuery as revParseQueryCall } from '../api/git/rev-parse-query.mjs';

const SKIP = new Set(['.git', 'dist', 'coverage', '.next']);
export const gitCallResult = (r) => ({ ok: !r?.error && r?.status === 0, stdout: String(r?.stdout ?? '').trim(), stderr: String(r?.stderr ?? r?.error?.message ?? '').trim() });

/** Every linked node_modules below root, without ever entering a link or node_modules directory. */
export function linkedNodeModules(root) {
  const found = [];
  const walk = (dir, depth, parentReal = null) => {
    if (depth > 6) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    let real;
    try { real = fs.realpathSync.native(dir); } catch { real = parentReal; }
    for (const entry of entries) {
      const target = path.join(dir, entry.name);
      let stat;
      try { stat = fs.lstatSync(target); } catch { continue; }
      const linked = isLinkLike(target, { parentReal: real, stat });
      if (entry.name === 'node_modules') { if (linked) { found.push(target); } continue; }
      if (SKIP.has(entry.name) || linked || !stat.isDirectory()) continue;
      walk(target, depth + 1, real);
    }
  };
  walk(path.resolve(root), 0);
  return found;
}

/** The primary checkout derived from this worktree's git common directory. */
export function primaryWorktreeOf(worktree, deps = {}) {
  const query = deps.revParseQuery ?? revParseQueryCall;
  const r = gitCallResult(query(['--git-common-dir'], { cwd: worktree }));
  if (!r.ok || !r.stdout) return { ok: false, cause: 'git-common-dir', detail: r.stderr || 'git rev-parse --git-common-dir returned no path' };
  const common = path.resolve(worktree, r.stdout);
  return { ok: true, common, primary: path.dirname(common) };
}

/** Fast-forward primary local main to ref, then write verification trailers as a local git note. */
export function landLocalMain({ worktree, ref, tip, trailers }, deps = {}) {
  const query = deps.revParseQuery ?? revParseQueryCall;
  const merge = deps.merge ?? mergeCall;
  const notes = deps.notes ?? notesCall;
  const located = primaryWorktreeOf(worktree, { revParseQuery: query });
  if (!located.ok) return located;
  const branch = gitCallResult(query(['--abbrev-ref', 'HEAD'], { cwd: located.primary }));
  if (!branch.ok || branch.stdout !== 'main') return { ok: false, cause: 'primary-not-main', detail: branch.stderr || `primary checkout is on ${branch.stdout || 'a detached HEAD'}`, primary: located.primary };
  const merged = gitCallResult(merge(['--ff-only', ref], { cwd: located.primary }));
  if (!merged.ok) return { ok: false, cause: 'fast-forward', detail: merged.stderr || merged.stdout, primary: located.primary };
  const head = gitCallResult(query(['--verify', 'HEAD'], { cwd: located.primary }));
  if (!head.ok || head.stdout !== tip) return { ok: false, cause: 'tip-mismatch', detail: `local main is ${head.stdout || 'unreadable'}, expected ${tip}`, primary: located.primary };
  const noted = gitCallResult(notes(['--ref=land', 'add', '-m', trailers.join('\n'), tip], { cwd: located.primary }));
  if (!noted.ok) return { ok: false, cause: 'note', detail: noted.stderr || noted.stdout, primary: located.primary, landed: true };
  return { ok: true, primary: located.primary, landed: tip };
}
