// live-fast-forward.mjs — move a live checkout's main from `base` to `head` and update the working tree and index of
// exactly the paths base..head changed (the Supervisor's land gate, scripts/supervisor/land.mjs, and a workflow's finish,
// scripts/kernel/workflow-checkpoint.mjs). A failed tree update rolls the ref and the paths back. Each git command is one
// scripts/api/git/ call file.
import fs from 'node:fs';
import path from 'node:path';
import { posixPath, trimTrailingSlashes } from '../lib/path-key.mjs';
import { withoutGitLocalEnv } from '../lib/git.mjs';
import { configGet } from '../api/git/config-get.mjs';
import { symbolicRef } from '../api/git/symbolic-ref.mjs';
import { revParse } from '../api/git/rev-parse.mjs';
import { porcelainStatus } from '../api/git/porcelain-status.mjs';
import { updateRef } from '../api/git/update-ref.mjs';
import { checkoutPaths } from '../api/git/checkout-paths.mjs';
import { rmCached } from '../api/git/rm-cached.mjs';

const normPath = (p) => trimTrailingSlashes(posixPath(p));

// Windows limits a spawned command line to about 32K characters. A repository move can change hundreds
// of paths, so every live-tree Git operation (including rollback) uses the same bounded argument batches.
const LIVE_PATH_BATCH_CHARS = 8_000;
function livePathBatches(paths) {
  const batches = [];
  let batch = [], chars = 0;
  for (const file of paths) {
    const cost = file.length + 3; // argv quoting/separator allowance; command prefix is far below the cap.
    if (batch.length && chars + cost > LIVE_PATH_BATCH_CHARS) { batches.push(batch); batch = []; chars = 0; }
    batch.push(file);
    chars += cost;
  }
  if (batch.length) batches.push(batch);
  return batches;
}

/** `call(batch)` over the bounded batches of `paths`: {ok, stdout, stderr}, stopping at the first failed batch. */
function inBatches(paths, call) {
  const output = [];
  for (const batch of livePathBatches(paths)) {
    const result = call(batch);
    if (!result.ok) return { ...result, stdout: output.concat(result.stdout).filter(Boolean).join('\n') };
    if (result.stdout) output.push(result.stdout);
  }
  return { ok: true, stdout: output.join('\n'), stderr: '' };
}

// The refusal that stops a fast-forward before anything moves, or null.
function liveRefusal(root, base) {
  // A live repo flipped to core.bare=true fails the status/checkout below with a generic error; name it and the fix.
  const bare = configGet(root, 'core.bare', { env: withoutGitLocalEnv(process.env) }).stdout.toLowerCase();
  if (bare === 'true') return { ok: false, reason: 'live-repo-bare', detail: `${root} has core.bare=true (a git fixture reached the live repo through a leaked GIT_DIR?) - find the writer, then run: git -C "${root}" config core.bare false` };
  const branch = symbolicRef(root);
  if (branch !== 'refs/heads/main') return { ok: false, reason: 'live-not-on-main', detail: branch || 'detached' };
  const live = revParse(root, 'refs/heads/main');
  if (live !== base) return { ok: false, reason: 'main-moved', moved: live };
  return null;
}

// The working tree and index follow the moved ref: written paths checked out from head, gone paths removed; throws on a failed step.
function updateTree(root, head, { written, gone }) {
  if (written.length) { const co = inBatches(written, (batch) => checkoutPaths(root, head, batch)); if (!co.ok) throw new Error(co.stderr || 'checkout failed'); }
  if (!gone.length) return;
  const rm = inBatches(gone, (batch) => rmCached(root, batch));
  if (!rm.ok) throw new Error(rm.stderr || 'git rm --cached failed');
  for (const f of gone) { try { fs.rmSync(path.join(root, f), { force: true }); } catch { /* already gone */ } }
}

// Roll back: the ref first (compare-and-swap on our own head), then the paths to base.
function rollBackTree(root, { base, head, rows }, error) {
  const rollbackErrors = [];
  const restoreRef = updateRef(root, 'refs/heads/main', base, { message: 'supervisor land gate rollback', old: head });
  if (!restoreRef.ok) rollbackErrors.push(restoreRef.stderr || 'ref rollback failed');
  const back = rows.flatMap((r) => (r[0].startsWith('A') ? [] : [normPath(r[1])]));
  if (back.length) {
    const restorePaths = inBatches(back, (batch) => checkoutPaths(root, base, batch));
    if (!restorePaths.ok) rollbackErrors.push(restorePaths.stderr || 'path rollback failed');
  }
  const added = rows.filter((x) => x[0].startsWith('A') || x[0].startsWith('R')).map((r) => normPath(r[r.length - 1]));
  if (added.length) {
    const removeAdded = inBatches(added, (batch) => rmCached(root, batch));
    if (!removeAdded.ok) rollbackErrors.push(removeAdded.stderr || 'added-path rollback failed');
  }
  for (const f of added) {
    try { fs.rmSync(path.join(root, f), { force: true }); } catch { /* best effort */ }
  }
  return { ok: false, reason: 'tree-update-failed', detail: String(error?.message ?? error), rolledBack: rollbackErrors.length === 0,
    ...(rollbackErrors.length ? { rollbackErrors } : {}) };
}

/**
 * Move live main from `base` to `head` and update the working tree and index of exactly `rows`
 * (name-status rows of base..head). Refuses when main moved, HEAD is not main, or a path is dirty.
 * Returns {ok, reason?, dirty?, moved?}.
 */
export function fastForwardLive({ root, base, head, rows }) {
  const refused = liveRefusal(root, base);
  if (refused) return refused;
  const paths = [...new Set(rows.flatMap((r) => r.slice(1)).map(normPath))];
  // No paths, nothing to be dirty: `git status --` with an empty pathspec lists the whole tree.
  const status = inBatches(paths, (batch) => porcelainStatus(root, { pathspecs: batch, untracked: 'all', literal: true }));
  if (!status.ok) return { ok: false, reason: 'live-path-status-failed', detail: status.stderr || 'git status failed' };
  const dirty = status.stdout.split(/\r?\n/).filter(Boolean);
  if (dirty.length) return { ok: false, reason: 'live-paths-dirty', dirty };
  const cas = updateRef(root, 'refs/heads/main', head, { message: 'supervisor land gate', old: base });
  if (!cas.ok) return { ok: false, reason: 'main-moved', detail: cas.stderr };
  const deleted = rows.filter((r) => r[0].startsWith('D')).map((r) => normPath(r[1]));
  const renamedFrom = rows.filter((r) => r[0].startsWith('R')).map((r) => normPath(r[1]));
  const written = rows.filter((r) => !r[0].startsWith('D')).map((r) => normPath(r[r.length - 1]));
  const gone = [...deleted, ...renamedFrom];
  try {
    updateTree(root, head, { written, gone });
    return { ok: true, written, removed: gone };
  } catch (error) {
    return rollBackTree(root, { base, head, rows }, error);
  }
}
