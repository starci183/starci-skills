// checkout-paths.mjs — `git --literal-pathspecs checkout <rev> -- <paths>`: the working tree and index of exactly
// `paths` at `rev`, written atomically (land-non-atomic-tree-update).
//
// `git checkout` truncates and rewrites each file in place; a runtime child spawned while the land gate updates the
// live tree (scripts/machine/live-fast-forward.mjs updateTree: reconciler status reads, Kernel CLI calls, watchdog
// passes, op dispatch) can open a truncated or empty module and exit 0 without reaching main(). So the index is
// staged at `rev` first (update-index --index-info), then every regular blob is written by git - filters and mode
// applied - to a temp file on the same volume (checkout-index --temp) and renamed over its target: a reader only
// ever opens the old or the new full file, never a partial write. A path absent at `rev` but indexed is dropped
// from the index and removed from the tree; one absent from both is refused exactly like a checkout pathspec that
// matches nothing. On Windows a file another process still holds open fails the rename/delete with EPERM/EBUSY:
// those calls retry for TREE_MOVE_WAIT_MS, never fall back to an in-place write. Entries git materializes specially
// (symlink, gitlink) keep the plain checkout and are never written as a flat file. {ok, stdout, stderr}: on a
// failure the caller's rollback restores every path at base (live-fast-forward.mjs rollBackTree runs this same
// function, so the restore is atomic too).
import fs from 'node:fs';
import path from 'node:path';
import { gitRunner } from './lib.mjs';
import { sleepSync } from '../../lib/sleep-sync.mjs';

const ZERO_SHA = '0'.repeat(40);
/** Bound on retrying a rename or delete refused while another process holds the file open (Windows EPERM/EBUSY). */
const TREE_MOVE_WAIT_MS = 5_000;
const TREE_MOVE_POLL_MS = 50;
const OPEN_BY_ANOTHER = new Set(['EPERM', 'EBUSY']);
const REGULAR_BLOB = new Set(['100644', '100755']);

/** `op()` once, retried while the target being open elsewhere makes it fail EPERM/EBUSY (Windows). null, or the last error after `waitMs`. */
function whileOpenElsewhere(op, { sleep, now, waitMs, pollMs = TREE_MOVE_POLL_MS }) {
  const start = now();
  for (;;) {
    try { op(); return null; } catch (error) {
      if (!OPEN_BY_ANOTHER.has(error?.code) || now() - start >= waitMs) return error;
      sleep(Math.min(pollMs, Math.max(1, waitMs - (now() - start))));
    }
  }
}

/** One `mode type sha\tfile` record of `ls-tree -z` output. */
const treeEntry = (record) => {
  const tab = record.indexOf('\t');
  const [mode, type, sha] = record.slice(0, tab).split(' ');
  return { mode, type, sha, file: record.slice(tab + 1) };
};

/** One `tmp\tfile` record of `checkout-index --temp -z` output (`tmp` names a file git wrote in `cwd`, same volume). */
const tempMove = (cwd) => (record) => {
  const tab = record.indexOf('\t');
  return { tmp: path.resolve(cwd, record.slice(0, tab)), file: record.slice(tab + 1) };
};

const ok = () => ({ ok: true, stdout: '', stderr: '' });

/** Why `gone` (paths absent at `rev`) cannot be deleted: git failed, or a path is neither in the tree nor indexed; else null. */
function goneProblem(run, cwd, rev, gone) {
  if (!gone.length) return null;
  const indexed = run(['--literal-pathspecs', 'ls-files', '-z', '--', ...gone], { cwd });
  if (!indexed.ok) return indexed.stderr || 'git ls-files failed';
  const deletable = new Set(indexed.stdout.split('\0').filter(Boolean));
  const unknown = gone.filter((p) => !deletable.has(p));
  return unknown.length ? `pathspec(s) match no file at ${rev} nor the index: ${unknown.join(', ')}` : null;
}

/** Each temp renamed over its target (parent directories made first); the first failure's text, else null. */
function moveTemps(cwd, moves, { rename, mkdir, sleep, now, waitMs }) {
  for (const { tmp, file } of moves) {
    const target = path.resolve(cwd, file);
    try { mkdir(path.dirname(target), { recursive: true }); } catch (error) { return `mkdir for ${file}: ${error?.message ?? error}`; }
    const moved = whileOpenElsewhere(() => rename(tmp, target), { sleep, now, waitMs });
    if (moved) return `rename over ${file}: ${moved.code ?? ''} ${moved.message ?? moved}`;
  }
  return null;
}

/** Each of `gone` removed from the worktree; the first failure's text, else null. */
function removeGone(cwd, rev, gone, { rm, sleep, now, waitMs }) {
  for (const p of gone) {
    const err = whileOpenElsewhere(() => rm(path.resolve(cwd, p), { force: true }), { sleep, now, waitMs });
    if (err) return `remove ${p} (gone at ${rev}): ${err.code ?? ''} ${err.message ?? err}`;
  }
  return null;
}

/**
 * The working tree and index of exactly `paths` at `rev`, each regular file swapped in by rename of a fully written
 * temp. git: the caller's runner or null; rename/rm/mkdir/sleep/now/waitMs are spec seams.
 */
export function checkoutPaths(cwd, rev, paths, { git = null, rename = fs.renameSync, rm = fs.rmSync, mkdir = fs.mkdirSync, sleep = sleepSync, now = Date.now, waitMs = TREE_MOVE_WAIT_MS } = {}) {
  const run = gitRunner(git);
  const fail = (stderr) => ({ ok: false, stdout: '', stderr });
  if (!paths.length) return ok();
  // The `paths` at `rev` (ls-tree names only those present); the rest are deletions if indexed, else a bad pathspec.
  const tree = run(['--literal-pathspecs', 'ls-tree', '-z', rev, '--', ...paths], { cwd });
  if (!tree.ok) return fail(tree.stderr || `git ls-tree ${rev} failed`);
  const entries = tree.stdout.split('\0').filter(Boolean).map(treeEntry);
  const atRev = new Set(entries.map((e) => e.file));
  const gone = paths.filter((p) => !atRev.has(p));
  const problem = goneProblem(run, cwd, rev, gone);
  if (problem) return fail(problem);
  // The index names `rev` for these paths before the worktree moves: the ls-tree records verbatim, a mode-0 record per deletion.
  const records = [...entries.map((e) => `${e.mode} ${e.type} ${e.sha}\t${e.file}`), ...gone.map((p) => `0 ${ZERO_SHA}\t${p}`)];
  const staged = run(['--literal-pathspecs', 'update-index', '-z', '--index-info'], { cwd, input: `${records.join('\0')}\0` });
  if (!staged.ok) return fail(staged.stderr || 'git update-index --index-info failed');
  const plain = entries.filter((e) => REGULAR_BLOB.has(e.mode)).map((e) => e.file);
  const exotic = entries.filter((e) => !REGULAR_BLOB.has(e.mode)).map((e) => e.file);
  const co = exotic.length ? run(['--literal-pathspecs', 'checkout', rev, '--', ...exotic], { cwd }) : { ok: true };
  if (!co.ok) return fail(co.stderr || 'checkout failed');
  // Filtered bytes of every regular blob in same-volume temps, each then renamed over its target.
  const temps = plain.length ? run(['--literal-pathspecs', 'checkout-index', '-f', '--temp', '-z', '--', ...plain], { cwd }) : { ok: true, stdout: '' };
  if (!temps.ok) return fail(temps.stderr || 'git checkout-index --temp failed');
  const moves = temps.stdout.split('\0').filter(Boolean).map(tempMove(cwd));
  const seams = { sleep, now, waitMs };
  const failure = moveTemps(cwd, moves, { rename, mkdir, ...seams });
  for (const { tmp } of moves) try { rm(tmp, { force: true }); } catch { /* temp */ }
  if (failure) return fail(failure);
  const removal = removeGone(cwd, rev, gone, { rm, ...seams });
  return removal ? fail(removal) : ok();
}
