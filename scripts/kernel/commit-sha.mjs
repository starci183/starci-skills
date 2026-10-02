// commit-sha.mjs - a ref resolved to a commit sha through a caller's git runner (workflow checkpoint and settle share it).
import { revParseQuery } from '../api/git/rev-parse-query.mjs';

/**
 * `ref` resolved to a commit sha in `cwd` through the caller's git runner - `git(revParseQuery, cwd, args)`
 * returning {ok, stdout} - via `rev-parse --verify --quiet <ref>^{commit}`; null when unresolvable.
 */
export const commitShaOf = (git, cwd, ref) => {
  const r = git(revParseQuery, cwd, ['--verify', '--quiet', `${ref}^{commit}`]);
  return r.ok && /^[0-9a-f]{40,64}$/.test(r.stdout) ? r.stdout : null;
};
