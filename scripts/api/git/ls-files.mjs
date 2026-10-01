// ls-files.mjs — `git -C <dir> ls-files -z --cached`: every path the index of a repository tracks (repository-relative,
// forward slashes, NUL-separated so any file name survives).
import { runGit } from './lib.mjs';

/** {ok, files, error}: the tracked paths of the repository at `dir`, or why git could not list them. */
export const lsFiles = (dir) => {
  const r = runGit(['ls-files', '-z', '--cached'], { dir, maxBuffer: 256 * 1024 * 1024 });
  const ok = !r.error && r.status === 0;
  return { ok, files: ok ? String(r.stdout).split('\0').filter(Boolean) : [], error: ok ? null : String(r.stderr ?? r.error?.message ?? '').trim() };
};
