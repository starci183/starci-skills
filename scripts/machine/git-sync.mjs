// git-sync.mjs - merge a local main ref into a clean lane with rerere enabled.
import path from 'node:path';
import { diff } from '../api/git/diff.mjs';
import { isAncestor } from '../api/git/is-ancestor.mjs';
import { merge } from '../api/git/merge.mjs';
import { mergeTree } from '../api/git/merge-tree.mjs';
import { remote } from '../api/git/remote.mjs';
import { revParse } from '../api/git/rev-parse.mjs';
import { statusQuery } from '../api/git/status-query.mjs';
import { worktreeListPorcelain } from '../api/git/worktree-list-porcelain.mjs';
import { lines, refusal as verbRefusal, resultOk as ok, resultOutput as output } from '../lib/verb-call.mjs';
import { byCodeUnit } from '../lib/list.mjs';

function dirtyPaths(text) {
  const records = String(text ?? '').split('\0').filter(Boolean);
  const paths = [];
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (record.length < 4) continue;
    paths.push(record.slice(3));
    if (/^[RC]/.test(record.slice(0, 2)) || /[RC]$/.test(record.slice(0, 2))) index += 1;
  }
  return [...new Set(paths)].sort(byCodeUnit);
}

function mergeTreeConflicts(text) {
  const found = [];
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const stage = /^\d{6} [0-9a-f]+ [123]\t(.+)$/i.exec(line);
    const conflict = /^CONFLICT \([^)]+\): .*? in (.+)$/.exec(line);
    if (stage) found.push(stage[1]);
    else if (conflict) found.push(conflict[1]);
  }
  return [...new Set(found)].sort(byCodeUnit);
}

function isRemoteTracking(ref, cwd, gitRemote) {
  if (ref.startsWith('refs/remotes/') || ref.startsWith('origin/')) return true;
  const remotes = gitRemote([], { cwd });
  return ok(remotes) && lines(output(remotes)).some((name) => ref.startsWith(`${name}/`));
}

// A dry run: whether `head` and the local main merge cleanly, from the merge tree alone.
function mergePreview({ api, cwd, head, mainSha, mainRef }, refusal) {
  const trial = api.mergeTree(['--write-tree', head, mainSha], { cwd, config: { 'core.quotepath': 'off' } });
  const conflicts = mergeTreeConflicts(`${String(trial.stdout ?? '')}\n${String(trial.stderr ?? '')}`);
  if (!ok(trial)) {
    return refusal(conflicts.length ? `would conflict:\n${conflicts.join('\n')}` : `merge preview failed: ${output(trial, 'stderr') || output(trial) || 'unknown error'}`,
      1, { mainRef, conflicts, dryRun: true });
  }
  return { code: 0, text: `dry run: ${mainRef} merges cleanly`, data: { schema: 'starci/git-sync@1', ok: true, sha: head, mainRef, conflicts: [], dryRun: true } };
}

// The refusal of a merge that did not complete: a failure without conflicts, or the conflicts (aborted on request).
function mergeFailure({ api, cwd, merged, mainRef, abortOnConflict }, refusal) {
  const unresolved = api.diff(['--name-only', '--diff-filter=U', '--'], { cwd, config: { 'core.quotepath': 'off' } });
  const conflicts = ok(unresolved) ? lines(output(unresolved)) : [];
  if (!conflicts.length) return refusal(`merge failed: ${output(merged, 'stderr') || output(merged) || 'unknown error'}`, 1, { mainRef, conflicts: [] });
  let aborted = false;
  if (abortOnConflict) {
    const stopped = api.merge(['--abort'], { cwd });
    if (!ok(stopped)) return refusal(`merge conflicts:\n${conflicts.join('\n')}\ngit merge --abort failed: ${output(stopped, 'stderr') || 'unknown error'}`, 1,
      { mainRef, conflicts, aborted: false });
    aborted = true;
  }
  const next = aborted ? 'merge aborted' : 'resolve, then `starci git commit --type chore --summary ...`';
  return refusal(`merge conflicts:\n${conflicts.join('\n')}\n${next}`, 1, { mainRef, conflicts, aborted });
}

/** Merge local main into the current clean lane, or inspect the merge without changing it. */
export async function gitSync(ctx, deps = {}) {
  const refusal = (text, code = 2, data = {}) => verbRefusal('starci git sync', text, code,
    { schema: 'starci/git-sync@1', ok: false, ...data });
  const api = { diff, isAncestor, merge, mergeTree, remote, revParse, statusQuery, worktreeListPorcelain, ...deps };
  const cwd = path.resolve(ctx?.cwd ?? process.cwd());
  const status = api.statusQuery(['--porcelain=v1', '-z', '--untracked-files=no'], { cwd, config: { 'core.quotepath': 'off' } });
  if (!ok(status)) return refusal(`could not inspect the worktree: ${output(status, 'stderr') || 'git status failed'}`, 1);
  const dirty = dirtyPaths(String(status.stdout ?? ''));
  if (dirty.length) return refusal(`tracked worktree is dirty:\n${dirty.join('\n')}`, 1, { dirty });

  const supplied = String(ctx?.args?.['main-ref'] ?? '').trim();
  const requested = supplied || 'refs/heads/main';
  if (isRemoteTracking(requested, cwd, api.remote)) return refusal('lanes merge the LOCAL main, never origin/main');
  const primary = api.worktreeListPorcelain(cwd)[0]?.path ?? cwd;
  let mainRef = requested;
  if (!requested.startsWith('refs/') && api.revParse(primary, `refs/heads/${requested}`)) mainRef = `refs/heads/${requested}`;
  const mainSha = api.revParse(primary, mainRef);
  if (!mainSha) return refusal(`local main ref does not resolve: ${requested}`);
  const head = api.revParse(cwd, 'HEAD');
  if (!head) return refusal('HEAD does not resolve');
  if (api.isAncestor(cwd, mainSha, head)) {
    return { code: 0, text: 'up to date', data: { schema: 'starci/git-sync@1', ok: true, sha: head, mainRef, conflicts: [] } };
  }

  if (ctx?.args?.['dry-run']) return mergePreview({ api, cwd, head, mainSha, mainRef }, refusal);

  const merged = api.merge(['--no-edit', '--no-ff', mainRef], {
    cwd,
    config: { 'rerere.enabled': 'true', 'rerere.autoUpdate': 'true' }
  });
  if (!ok(merged)) return mergeFailure({ api, cwd, merged, mainRef, abortOnConflict: ctx?.args?.['abort-on-conflict'] }, refusal);
  const sha = api.revParse(cwd, 'HEAD');
  if (!sha) return refusal('merge succeeded but HEAD could not be resolved', 1, { mainRef });
  return { code: 0, text: `synced ${sha.slice(0, 7)} from ${mainRef}`, data: { schema: 'starci/git-sync@1', ok: true, sha, mainRef, conflicts: [] } };
}
