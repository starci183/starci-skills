// hook-stamp.mjs - which version of a runtime-installed git hook a repository holds, read without writing anything.
// The installed hooks carry `# <marker> v<N>` on their second line (hook-install.mjs); a repository is any checkout or worktree.
import fs from 'node:fs';
import path from 'node:path';
import { revParseQuery } from '../api/git/rev-parse-query.mjs';

/** The hook file `name` of the repository at `repo` (core.hooksPath honoured), or null when git cannot say. */
export function hookFileOf(repo, name) {
  const hooks = revParseQuery(['--git-path', 'hooks'], { dir: repo, timeout: 20_000 });
  if (hooks.status !== 0 || !String(hooks.stdout ?? '').trim()) return null;
  return path.join(path.resolve(repo, String(hooks.stdout).trim()), name);
}

/** {file, state: 'absent' | 'foreign' | 'stamped', version?} of hook `name` carrying `marker`. */
export function hookStamp(repo, name, marker) {
  const file = hookFileOf(repo, name);
  if (!file || !fs.existsSync(file)) return { file, state: 'absent' };
  const text = fs.readFileSync(file, 'utf8');
  const match = new RegExp(String.raw`${marker} v(\d+)`).exec(text);
  return match ? { file, state: 'stamped', version: Number(match[1]) } : { file, state: 'foreign' };
}
