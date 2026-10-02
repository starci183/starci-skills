// log-since.mjs — `git -C <dir> log --since=<iso> --format=<format>`: the commits of a repository's HEAD made after a
// moment, one record per commit in the caller's pretty format.
import { runGit } from './lib.mjs';

/** {ok, stdout}: the log text of the repository at `dir` since `since` (an ISO time), or ok:false when git failed. */
export const logSince = (dir, since, format, { timeout = 30_000 } = {}) => {
  const r = runGit(['log', `--since=${since}`, `--format=${format}`], { dir, timeout, maxBuffer: 64 * 1024 * 1024 });
  return { ok: !r.error && r.status === 0, stdout: String(r.stdout ?? '') };
};
