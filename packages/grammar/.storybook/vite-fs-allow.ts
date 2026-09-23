import { existsSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { searchForWorkspaceRoot } from 'vite';

/**
 * Vite's `server.fs.allow` for the Storybook dev server and the vitest browser runs.
 *
 * Vite resolves modules to their real paths, so when `node_modules` is a junction/symlink into
 * another checkout (a git worktree sharing one install) every dependency lives outside the
 * workspace root and Vite refuses to serve it. Setting `allow` replaces Vite's default, so this
 * keeps that default (the workspace root) and adds exactly one more directory: the real location of
 * this package's own `node_modules`. With a real install that is already inside the root and the
 * list is just the default. Nothing else on disk becomes servable.
 */
export function viteFsAllow(packageRoot: string): string[] {
  const allow = [searchForWorkspaceRoot(packageRoot)];
  const modules = path.join(packageRoot, 'node_modules');
  if (existsSync(modules)) {
    const real = realpathSync(modules);
    if (!allow.some((root) => isInside(real, root))) allow.push(real);
  }
  return allow;
}

const isInside = (child: string, parent: string): boolean => {
  const relative = path.relative(parent, child);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
};
