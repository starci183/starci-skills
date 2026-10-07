// land-conflicts.mjs - the conflicts of a land (scripts/supervisor/land.mjs): the marker hunks of a merged text, the lock-free
// preflight of a pick onto main, the unmerged files of a stopped cherry-pick, and the one instruction a lane gets.
import fs from 'node:fs';
import path from 'node:path';
import { git } from './workers.mjs';
import { SKILL_ROOT } from '../machine/home.mjs';

const HUNK_LINES = 40, HUNKS_PER_FILE = 4, CONFLICT_FILES = 20;
/** The conflict-marker regions of a merged text, each with 2 lines of context, capped. */
export function conflictHunks(text) {
  const lines = String(text ?? '').split(/\r?\n/);
  const hunks = [];
  let i = 0;
  while (i < lines.length && hunks.length < HUNKS_PER_FILE) {
    if (!lines[i].startsWith('<<<<<<< ')) { i += 1; continue; }
    let end = i + 1;
    while (end < lines.length && !lines[end].startsWith('>>>>>>> ')) end += 1;
    const body = lines.slice(Math.max(0, i - 2), Math.min(lines.length, end + 3)).map((l) => (l.length > 300 ? `${l.slice(0, 300)}...` : l));
    hunks.push({ line: i + 1, text: (body.length > HUNK_LINES ? [...body.slice(0, HUNK_LINES), `... (${body.length - HUNK_LINES} more lines)`] : body).join('\n') });
    i = end + 1;
  }
  return hunks;
}

/** What a lane does about a conflict: one instruction, never a blind retry. */
export const conflictHint = (conflicts, commit = null) => 'rebase the lane onto current main (git rebase main in its worktree), resolve ' + (conflicts.map((c) => c.file).join(', ') || 'the conflicting files') + (commit ? ' in ' + String(commit).slice(0, 9) : '') + ', run its specs, then land the new sha; the same sha on the same main conflicts again';

/**
 * Lock-free preflight: apply `commits` in order onto `onto` with `git merge-tree --write-tree` (no worktree, no
 * lock), chaining through throwaway commit objects. {ok, conflicts:[{commit, file, hunks[]}], onto}. A git that
 * cannot run merge-tree reads as ok (the gate's own cherry-pick still decides).
 */
export function conflictPreflight({ root = SKILL_ROOT, commits, onto = 'refs/heads/main' }) {
  let head = git(['rev-parse', onto], { cwd: root }).stdout;
  if (!head) return { ok: true, conflicts: [], skipped: 'no main' };
  for (const c of commits) {
    const parent = git(['rev-parse', '--verify', '--quiet', `${c}^`], { cwd: root }).stdout;
    if (!parent) return { ok: true, conflicts: [], skipped: `no parent of ${c}` };
    const r = git(['merge-tree', '--write-tree', '--merge-base', parent, head, c], { cwd: root });
    const tree = r.stdout.split(/\r?\n/)[0]?.trim();
    if (r.status === 1 && /^[0-9a-f]{40,64}$/.test(tree ?? '')) {
      const files = [...new Set(r.stdout.split(/\r?\n\r?\n/)[0].split(/\r?\n/).slice(1).map((l) => l.split('\t')[1]).filter(Boolean))].slice(0, CONFLICT_FILES);
      const conflicts = files.map((file) => ({ commit: c, file, hunks: conflictHunks(git(['cat-file', '-p', `${tree}:${file}`], { cwd: root }).stdout) }));
      return { ok: false, conflicts, onto: head };
    }
    if (!r.ok || !/^[0-9a-f]{40,64}$/.test(tree ?? '')) return { ok: true, conflicts: [], skipped: (r.stderr || 'merge-tree failed').slice(0, 200) };
    const next = git(['commit-tree', tree, '-p', head, '-m', `land preflight ${c}`], { cwd: root }).stdout;
    if (!next) return { ok: true, conflicts: [], skipped: 'commit-tree failed' };
    head = next;
  }
  return { ok: true, conflicts: [], onto: head };
}

/** The conflicts of a stopped cherry-pick in worktree `dir`: every unmerged file with its marker hunks. */
export function pickConflicts(dir, commit = null) {
  const files = git(['diff', '--name-only', '--diff-filter=U'], { cwd: dir }).stdout.split(/\r?\n/).filter(Boolean).slice(0, CONFLICT_FILES);
  return files.map((file) => {
    let text = '';
    try { text = fs.readFileSync(path.join(dir, file), 'utf8'); } catch { /* deleted on one side */ }
    return { commit, file, hunks: conflictHunks(text) };
  });
}
