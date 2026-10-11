// op-write-scope.mjs — where an Op may write: its attempt's owned paths and the runtime temp directory, nothing else. The owned paths
// are the absolute paths its job guard records at launch (scripts/guards/hook-install.mjs writeJobGuard); a file the Op needs outside
// them is reported as owed, never written. The PreToolUse guard applies it to Edit, Write and the shell write targets alike
// (rights.mjs fileWriteVerdict).
import os from 'node:os';
import { tempRoot } from '../../engine/temp-root.mjs';
import { pathKey, sameOrUnder } from '../lib/path-key.mjs';

const inside = (file, dirs) => dirs.some((dir) => sameOrUnder(pathKey(file), pathKey(dir)));

/** Directories every Op may write: the runtime temp root and the OS temp directory. */
const scratchDirs = (env) => [tempRoot({ env }), os.tmpdir(), env?.TEMP, env?.TMP, env?.TMPDIR].filter(Boolean);

/**
 * The refusal fields {code, reason, remedy} for an Op write to `file`, or null when it may write there. An Op with no workflow
 * worktree in its guard (a guard without scope information) is not confined.
 */
export function opWriteScopeRefusal({ file, guard, env = process.env }) {
  if (!guard?.workflowWorktree) return null;
  if (inside(file, guard.owned ?? [])) return null;
  if (!inside(file, [guard.workflowWorktree]) && inside(file, scratchDirs(env))) return null;
  return {
    code: 'RIGHTS_OP_OUTSIDE_OWNED',
    reason: 'an Op writes only inside the paths its attempt owns and the runtime temp directory; this file is outside them',
    remedy: 'put scratch files in the runtime temp directory; a change the work needs outside your owned paths is reported as owed in your report (starci kernel report) for your Kernel to cut',
  };
}
