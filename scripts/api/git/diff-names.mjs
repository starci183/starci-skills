// diff-names.mjs — `git diff --name-only <from>..<to> -- <paths>`: the files a commit range changed under `paths`.
import { gitRunner } from './lib.mjs';

/** The changed paths ([] when none), or null when git does not answer. git: the caller's runner or null. */
export function diffNames(cwd, from, to, { paths = [], git = null } = {}) {
  const r = gitRunner(git)(['diff', '--name-only', `${from}..${to}`, '--', ...paths], { cwd, timeout: 20_000 });
  return r.ok ? r.stdout.split(/\r?\n/).map((l) => l.trim()).filter(Boolean) : null;
}
