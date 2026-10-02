// repo-identity.mjs - who a repository is, independent of the folder it is checked out in.
// A git worktree (<lanes root>/<lane>/<name>) and the main checkout of the same repository are ONE repository:
// they carry the same README title, the same stack-declaration project name and the same sibling repositories.
import fs from 'node:fs';
import path from 'node:path';
import { revParseQuery } from '../api/git/rev-parse-query.mjs';
import { remote as gitRemote } from '../api/git/remote.mjs';
import { gitOutputOf } from '../lib/git.mjs';

/** One git call (a scripts/api/git call file) in `root`: its trimmed stdout; throws unless git exits 0. */
const git = (call, root, args) => gitOutputOf(call(args, { cwd: root })).trim();
const real = (p) => { try { return fs.realpathSync(p); } catch { return path.resolve(p); } };

/** { repositoryRoot, inWorkTree, home } for `root`: home is the main checkout folder when root is a repository top level. */
function identityOf(root) {
  let inWorkTree = false, repositoryRoot = false, home = null;
  try {
    // Identity comes from Git only when root IS a repository (or worktree) top level, never a folder inside one.
    repositoryRoot = real(git(revParseQuery, root, ['--show-toplevel'])) === real(root);
    inWorkTree = true;
    const common = path.resolve(root, git(revParseQuery, root, ['--git-common-dir']));
    if (repositoryRoot && path.basename(common) === '.git') home = path.dirname(common);
  } catch { /* Not a Git work tree; the caller falls back to the folder and package name. */ }
  return { inWorkTree, repositoryRoot, home };
}

/**
 * The product repository name: the main checkout's folder name (so a worktree and its main checkout agree), else the
 * origin remote's name, else package.json name outside Git, else the folder name. A folder inside a larger repository
 * (a nested product, an example) is named by its own folder.
 */
export function repositoryName(root) {
  const { inWorkTree, repositoryRoot, home } = identityOf(root);
  if (home) return path.basename(home);
  if (repositoryRoot) {
    try {
      const remote = git(gitRemote, root, ['get-url', 'origin']).replace(/[\/]+$/u, '').replace(/\.git$/iu, '');
      const name = remote.split(/[\/:]/u).pop();
      if (name) return name;
    } catch { /* No origin remote. */ }
  }
  if (inWorkTree && !repositoryRoot) return path.basename(root);
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    if (typeof pkg.name === 'string' && pkg.name) return pkg.name.replace(/^@[^/]+\//u, '');
  } catch { /* No readable package.json. */ }
  return path.basename(root);
}

/** The folder whose siblings are this repository's sibling repositories: the main checkout for a worktree, else root. */
export function repositoryHome(root) {
  return identityOf(root).home ?? path.resolve(root);
}
