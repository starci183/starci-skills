// symbolic-ref.mjs — `git symbolic-ref -q <name>`: the branch ref a symbolic ref (HEAD) points at.
import { gitRunner } from './lib.mjs';

/** The full ref name (refs/heads/main), or '' when `name` is detached or not symbolic. git: the caller's runner or null. */
export function symbolicRef(cwd, { name = 'HEAD', git = null } = {}) {
  const r = gitRunner(git)(['symbolic-ref', '-q', name], { cwd });
  return r.ok ? r.stdout : '';
}
