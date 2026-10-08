// runtime-host.mjs - the repository that hosts this runtime and how a stack declaration's `repository` names resolve on
// this machine. One home for scripts/gates/starcistacks.mjs (the services contract) and scripts/gates/sonar-local.mjs
// (the Sonar helper), so both read a declaration's `{repository, path}` the same way.
//
// The runtime host is the repository whose checkout holds the runtime's MAIN checkout (`<host>/.claude`), found from git
// identity, never from the folder this runtime tree happens to sit in: a lane worktree of the runtime
// (<lanes root>/<lane>/<name>) resolves to the same host as the main checkout. STARCI_SOURCE_ROOT overrides it.
import fs from 'node:fs';
import path from 'node:path';
import { skillRoot, starciSourceRoot } from '../../engine/runtime-root.mjs';
import { isDir } from '../lib/fs-kind.mjs';
import { repositoryHome, repositoryName } from '../hfs/repo-identity.mjs';
import { secretEnv } from '../../engine/secrets.mjs';
import { revParseQuery } from '../api/git/rev-parse-query.mjs';
import { gitOutputOf } from '../lib/git.mjs';

/** The repository hosting this runtime: STARCI_SOURCE_ROOT, else the folder holding the runtime's main checkout. */
export function runtimeHostRoot(env = process.env) {
  if (env.STARCI_SOURCE_ROOT) return starciSourceRoot(env);
  return path.dirname(repositoryHome(skillRoot));
}

/** The canonical runtime main root of a runtime checkout or lane (its secret.env lives there); throws when the root is not a verified Git top level. */
export function verifiedRuntimeMain(runtimeRoot, env) {
  if (typeof runtimeRoot !== 'string' || !path.isAbsolute(runtimeRoot))
    throw new TypeError('runtimeSecretEnv requires an absolute runtime root');
  const stat = fs.lstatSync(runtimeRoot);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('runtime root must be a regular directory');
  const root = fs.realpathSync.native(runtimeRoot), marker = path.join(root, '.git');
  let gitMarker;
  try { gitMarker = fs.lstatSync(marker); } catch (error) {
    if (error?.code === 'ENOENT') return root;
    throw error;
  }
  if (gitMarker.isSymbolicLink() || (!gitMarker.isFile() && !gitMarker.isDirectory()))
    throw new Error('runtime Git identity is unavailable');
  const topLevel = cwd => fs.realpathSync.native(path.resolve(cwd,
    gitOutputOf(revParseQuery(['--show-toplevel'], { cwd, env })).trim()));
  if (!same(topLevel(root), root)) throw new Error('runtime must be its Git top level');
  const main = fs.realpathSync.native(repositoryHome(root)), mainMarker = fs.lstatSync(path.join(main, '.git'));
  if (!mainMarker.isDirectory() || mainMarker.isSymbolicLink() || !same(topLevel(main), main))
    throw new Error('runtime main Git identity is unavailable');
  return main;
}

/**
 * Load host-local credentials from this runtime's verified main tree, or its installed physical tree.
 * A lane never reads its own alternate file. The actual environment wins; no process state is mutated.
 */
export function runtimeSecretEnv(env = process.env, runtimeRoot = skillRoot) {
  return secretEnv(verifiedRuntimeMain(runtimeRoot, env), env);
}

const same = (a, b) => (process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b);

/**
 * The checkout of the repository a declaration names: the declaring repository itself, the runtime host, or a sibling
 * checkout of either (by repository identity, so a worktree and its main checkout are one repository). Null when the
 * repository is not checked out on this machine.
 */
export function resolveDeclaredRepository(name, { fromRepo } = {}) {
  const wanted = typeof name === 'string' && name.trim() ? name.trim() : null;
  if (!wanted) return null;
  const candidates = [...(fromRepo ? [path.resolve(fromRepo)] : []), runtimeHostRoot()];
  for (const dir of candidates) if (same(repositoryName(dir), wanted) && isDir(dir)) return dir;
  for (const dir of candidates) {
    const sibling = path.join(path.dirname(repositoryHome(dir)), wanted);
    if (isDir(sibling)) return sibling;
  }
  return null;
}

/**
 * A custody path of a declared repository as a file on this machine. A path under `.claude/` of the runtime host is a member of
 * the runtime tree in use (this checkout, a lane worktree included), the same rule a host-owned stack root `.claude/ext/<service>`
 * follows; any other path is joined to the repository's checkout. A path with a `..` segment is refused (null).
 */
export function resolveCustodyFile(repo, rel) {
  if (!repo || !rel || String(rel).split(/[\\/]/).includes('..')) return null;
  const posix = String(rel).replaceAll('\\', '/');
  if (posix.startsWith('.claude/') && same(path.resolve(repo), path.resolve(runtimeHostRoot()))) return path.join(skillRoot, posix.slice('.claude/'.length));
  return path.join(repo, rel);
}
