// head-time.mjs — `git log -1 --format=%ct %h`: the committer time (seconds) and short sha of HEAD, or null.
import { runGit } from './lib.mjs';

/** {time, sha} of HEAD in the repository at `cwd` (time in seconds); null when `cwd` is not a checkout. */
export const headTime = (cwd) => {
  const r = runGit(['log', '-1', '--format=%ct %h'], { cwd, timeout: 5000 });
  if (r.error || r.status !== 0) return null;
  const [ct, sha] = String(r.stdout ?? '').trim().split(' ');
  return /^\d+$/.test(ct) && sha ? { time: Number(ct), sha } : null;
};
