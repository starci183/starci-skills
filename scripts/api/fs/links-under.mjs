// links-under.mjs — every link (symlink, junction, other reparse point) under a root, found with lstat; the walk never
// enters one (is-link-like.mjs isLinkLike). remove-links-under.mjs removes what it finds; scripts/machine/worktree-git.mjs
// asserts a worktree holds none before git touches it.
import fs from 'node:fs';
import path from 'node:path';
import { isLinkLike } from './is-link-like.mjs';

/** Every link (symlink, junction, other reparse point) under root, found with lstat; the walk never enters one. */
export function linksUnder(root) {
  const found = [];
  const visit = (p, parentReal) => {
    let stat;
    try { stat = fs.lstatSync(p); } catch { return; }
    if (isLinkLike(p, { parentReal, stat })) { found.push(p); return; }
    if (!stat.isDirectory()) return;
    let real, names;
    try { real = fs.realpathSync.native(p); names = fs.readdirSync(p); } catch { return; }
    for (const name of names) visit(path.join(p, name), real);
  };
  visit(path.resolve(root), null);
  return found;
}
