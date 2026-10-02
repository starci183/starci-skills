// forbidden-root.mjs — the paths the runtime must never remove whole (safe-remove.mjs safeRemove refuses them before it
// deletes anything; scripts/machine/worktree-git.mjs asks it before a worktree removal).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { samePath } from '../../lib/path-key.mjs';
import { realpathOr } from '../../lib/fs-kind.mjs';

const SKILL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/**
 * True when `p` sits strictly below `root` by real path: no link on the way, not `root` itself. The one place a
 * primary checkout may be removed is a disposable fixture a caller names by its temp root (hk-tmp).
 */
function strictlyInsideReal(p, root) {
  if (!root) return false;
  const rel = path.relative(path.resolve(root), path.resolve(p));
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return false;
  const real = realpathOr(p);
  const rootReal = realpathOr(root);
  // Its real path must be the same relative place under the root's real path: no link between them.
  return Boolean(real && rootReal) && samePath(real, path.join(rootReal, rel));
}

/**
 * A path the runtime must never remove whole: a filesystem root, the home or temp directory, the runtime, the
 * repository that hosts it, the repositories root, or a primary git checkout (its .git is a directory; the
 * scratch trees the runtime removes are temp directories and linked worktrees, whose .git is a file).
 * `checkoutsUnder` names a disposable root (hk-tmp's temp root): a checkout strictly inside it by real path
 * is a spec fixture, not a live repository, and is not refused for its .git. Every other refusal stands.
 * `hold(path)` is the caller's artifact-hold check (scripts/machine/artifact-hold.mjs artifactHoldReason: a tree holding
 * an indexed job artifact, or inside an evidence directory holding one, whatever the workflow's phase), its refusal line
 * or null. It is required: without one every path is refused (fail closed); a caller that removes only a scratch tree
 * it made itself, outside every ledger's repository, says so with `hold: () => null`.
 */
export function forbiddenRoot(p, { checkoutsUnder = null, hold } = {}) {
  const resolved = path.resolve(p);
  if (path.parse(resolved).root === resolved || samePath(path.dirname(resolved), resolved)) return 'a filesystem root';
  for (const [name, dir] of [['the home directory', os.homedir()], ['the temp directory', os.tmpdir()], ['the runtime', SKILL_ROOT],
    ['the repository hosting the runtime', path.dirname(SKILL_ROOT)], ['the repositories root', path.dirname(path.dirname(SKILL_ROOT))]]) {
    if (dir && samePath(path.resolve(dir), resolved)) return name;
  }
  if (typeof hold !== 'function') return 'a tree no artifact-hold check cleared (pass hold)';
  const held = hold(resolved);
  if (held) return held;
  let checkout = false;
  try { checkout = fs.lstatSync(path.join(resolved, '.git')).isDirectory(); } catch { /* no .git directory */ }
  if (checkout && !strictlyInsideReal(resolved, checkoutsUnder)) return 'a git checkout';
  return null;
}
