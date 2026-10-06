// gate-input.mjs - the one base, Git delta and current-input reader of a code gate and its settle observer.
import fs from 'node:fs';
import path from 'node:path';
import { byCodeUnit } from '../lib/list.mjs';
import { revParseQuery } from '../api/git/rev-parse-query.mjs';
import { diff as gitDiff } from '../api/git/diff.mjs';
import { lsFiles } from '../api/git/ls-files.mjs';
import { mergeBase as mergeBaseOf } from '../api/git/merge-base.mjs';
import { posixPath, underAny } from '../lib/path-key.mjs';
import { sha256File } from '../../engine/digest.mjs';
import { gateBaseAt } from '../machine/workflow-tree.mjs';

/** Run a gate-owned Git query with its existing text/rename output settings and caller options. */
const git = (call, root, args, options = {}) => call(args, { cwd: root, config: { 'core.quotepath': 'off' }, maxBuffer: 256 * 1024 * 1024, ...options });

/** Return a completed query's text, or null when the native child failed; input readers reject missing text. */
const gitText = (call, root, args) => { const r = git(call, root, args); return !r.error && r.status === 0 ? r.stdout : null; };
export { git as gateGit, gitText as gateGitText, gateDelta };

/**
 * The base commit: --base verified as a commit; else, when --root is a workflow worktree (the registry knows it, never a
 * branch-name guess), the workflow's previous checkpoint (workflow-checkpoint.mjs gateBaseAt), so only the op's own new
 * findings block; else the merge-base of HEAD with its upstream, main or master.
 */
export function resolveGateBase(root, base = null, { workflowBase = (dir) => gateBaseAt({ env: process.env }, dir) } = {}) {
  if (base) {
    const sha = gitText(revParseQuery, root, ['--verify', '--quiet', `${base}^{commit}`])?.trim();
    if (!sha) throw Object.assign(new Error(`--base ${base} is not a commit of ${root}`), { code: 'GATE_BASE_UNKNOWN' });
    return sha;
  }
  const checkpoint = workflowBase(root);
  if (checkpoint) return checkpoint;
  for (const ref of ['@{upstream}', 'main', 'master', 'origin/HEAD']) {
    const sha = mergeBaseOf(root, 'HEAD', ref);
    if (sha) return sha;
  }
  throw Object.assign(new Error(`no base: ${root} has no upstream, main or master to measure against; pass --base`), { code: 'GATE_BASE_UNKNOWN' });
}

/**
 * The delta between the base and the working tree, relative to --root: {changed[] (existing files), added Set, deleted Set,
 * renamed Map(new -> old)}. A rename's old path counts as deleted and its new path is measured against the old path's base
 * blob, so the findings a move carries stay preexisting; untracked files are additions.
 */
function gateDelta(root, base) {
  const diff = gitText(gitDiff, root, ['--name-status', '-z', '--find-renames', '--relative', base]);
  const untracked = gitText(lsFiles, root, ['--others', '--exclude-standard', '-z']);
  if (diff === null || untracked === null) throw new Error(`the actual gate delta of ${root} could not be listed`);
  const status = String(diff).split('\0');
  const added = new Set(), deleted = new Set(), changed = new Set(), renamed = new Map();
  for (let i = 0; i < status.length && status[i]; i += 1) {
    const kind = status[i], file = status[++i];
    if (!file) throw new Error('the gate diff has an incomplete path record');
    const rel = posixPath(file);
    if (kind.startsWith('R')) {
      const to = status[++i];
      if (!to) throw new Error('the gate rename has no destination');
      deleted.add(rel); changed.add(posixPath(to)); renamed.set(posixPath(to), rel);
    }
    else if (kind === 'D') deleted.add(rel);
    else { changed.add(rel); if (kind === 'A') added.add(rel); }
  }
  for (const file of String(untracked).split('\0').filter(Boolean)) { const rel = posixPath(file); changed.add(rel); added.add(rel); }
  return { changed: [...changed].filter((file) => fs.existsSync(path.join(root, file))).sort(byCodeUnit), added, deleted, renamed };
}

/**
 * Read the gate's actual base, HEAD and current input bytes without preparing or running a tool. Deleted paths carry null;
 * named files extend the real delta. Settle uses the same reader against persisted placement and ownership, so a report's
 * changed list cannot manufacture an empty slice or hide a later edit.
 */
export function gateInputSnapshot(root, base = null, files = [], owned = null) {
  root = path.resolve(root);
  base = resolveGateBase(root, base);
  const head = gitText(revParseQuery, root, ['--verify', 'HEAD'])?.trim();
  if (!head) throw new Error(`the gate HEAD of ${root} could not be resolved`);
  const delta = gateDelta(root, base);
  const named = files.map((file) => {
    const rel = path.relative(root, path.resolve(root, file));
    if (!rel || rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel))
      throw new Error(`gate input ${file} is not a file inside ${root}`);
    return posixPath(rel);
  });
  if (owned && (!Array.isArray(owned) || !owned.length || named.some((file) => !underAny(file, owned, { dot: true }))))
    throw new Error('the named gate inputs are outside the admitted owned scope');
  const inputs = [...new Set([...delta.changed, ...delta.deleted, ...named])]
    .filter((file) => !owned || underAny(file, owned, { dot: true })).sort(byCodeUnit).map((file) => {
    const absolute = path.join(root, file);
    return { path: file, sha256: fs.existsSync(absolute) ? sha256File(absolute) : null };
  });
  return { root: posixPath(root), base, head, changed: inputs.filter((file) => file.sha256 !== null).map((file) => file.path), inputs };
}
