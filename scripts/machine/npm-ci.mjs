// npm-ci.mjs - install exactly one checkout's lockfile under the shared host lock.
//
// The verb owns the safety policy around the existing npm call file: a worker never installs in the primary checkout,
// package manifests must be clean, and node_modules must be a real directory local to this checkout.
import fs from 'node:fs';
import path from 'node:path';
import { porcelainStatus } from '../api/git/porcelain-status.mjs';
import { revParseQuery } from '../api/git/rev-parse-query.mjs';
import { ci } from '../api/npm/ci.mjs';
import { asList } from '../lib/list.mjs';
import { refusal as verbRefusal, resultOk as success, resultOutput as output } from '../lib/verb-call.mjs';
import { underHostLock, hostLockRetryBudget } from './verb-lock.mjs';
import { installStateOf, writeInstallMarker, clearInstallMarker } from './npm-install-state.mjs';
import { installFailureOf, treeHolders } from './npm-install-failure.mjs';

const comparablePath = (value) => {
  const resolved = path.resolve(value);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
};

/** Whether `cwd` is the primary checkout identified by Git's common directory. */
export function primaryWorktree(cwd, revParse = revParseQuery) {
  const top = revParse(['--show-toplevel'], { cwd });
  const common = revParse(['--git-common-dir'], { cwd });
  if (!success(top) || !success(common)) {
    return { ok: false, error: output(top, 'stderr') || output(common, 'stderr') || 'Git could not identify this checkout' };
  }
  const root = output(top);
  const commonName = output(common);
  if (!root || !commonName) return { ok: false, error: 'Git returned an empty checkout path' };
  const commonDir = path.isAbsolute(commonName) ? commonName : path.resolve(root, commonName);
  const primary = path.dirname(commonDir);
  return { ok: true, root, primary, isPrimary: comparablePath(root) === comparablePath(primary) };
}

/** Refuse a node_modules junction or symbolic link; a missing directory is safe for a real install. */
export function linkedNodeModules(cwd, lstat = fs.lstatSync) {
  const target = path.join(cwd, 'node_modules');
  try {
    return { ok: true, linked: lstat(target).isSymbolicLink(), target };
  } catch (error) {
    if (error?.code === 'ENOENT') return { ok: true, linked: false, target };
    return { ok: false, linked: false, target, error: String(error?.message ?? error) };
  }
}

/** Unwrap verb-lock's metadata while still accepting a direct injected lock seam. */
export function lockedValue(result) {
  if (result?.ok === false && !Object.hasOwn(result, 'code')) {
    const waited = result.retries?.length ? ` after ${result.retries.length} attempts (${result.retries[0].reason}, retry budget ${result.exhausted ?? 'open'})` : '';
    throw new Error(result.reason ? `host lock refused the run: ${result.reason}${waited}` : 'host lock refused the run');
  }
  return result && Object.hasOwn(result, 'value') ? result.value : result;
}

/** Run a real npm ci for this checkout, never an install or a borrowed node_modules. */
export async function npmCi(ctx, deps = {}) {
  const cwd = path.resolve(ctx?.cwd ?? process.cwd());
  const refusal = (location, text, code = 2, extra = {}) => verbRefusal('starci npm ci', text, code,
    { schema: 'starci/npm-ci@1', ok: false, cwd: location, ms: 0, ...extra });
  const api = {
    ci: deps.ci ?? ci,
    lstat: deps.lstat ?? fs.lstatSync,
    revParse: deps.revParse ?? revParseQuery,
    status: deps.status ?? porcelainStatus,
    lock: deps.underHostLock ?? underHostLock,
    now: deps.now ?? Date.now,
    installState: deps.installState ?? installStateOf,
    markInstalled: deps.markInstalled ?? writeInstallMarker,
    clearMarker: deps.clearMarker ?? clearInstallMarker,
    holders: deps.holders ?? treeHolders
  };
  const role = ctx?.role ?? 'owner';

  if (!['owner', 'release'].includes(role)) {
    const primary = primaryWorktree(cwd, api.revParse);
    if (!primary.ok) return refusal(cwd, `cannot prove this is an owned worktree: ${primary.error}`);
    if (primary.isPrimary) return refusal(cwd, 'the primary main worktree is reserved for the owner or release role');
  }

  const dirty = api.status(cwd, { pathspecs: ['package.json', 'package-lock.json'], untracked: 'all', literal: true });
  if (!dirty?.ok) return refusal(cwd, `cannot inspect package.json and package-lock.json: ${dirty?.stderr || 'git status failed'}`);
  if (String(dirty.stdout ?? '').trim()) {
    return refusal(cwd, 'package.json or package-lock.json has uncommitted changes; commit or revert it before npm ci');
  }

  const link = linkedNodeModules(cwd, api.lstat);
  if (!link.ok) return refusal(cwd, `cannot inspect node_modules: ${link.error}`);
  if (link.linked) return refusal(cwd, 'node_modules is a junction or symbolic link; remove it before npm ci');

  const workspaces = asList(ctx?.args?.workspace).map((item) => String(item ?? '').trim());
  if (workspaces.some((item) => !item)) return refusal(cwd, '--workspace values may not be empty');

  try {
    const locked = await api.lock({ role, purpose: 'npm-ci', env: ctx?.env, retry: hostLockRetryBudget() }, async () => {
      // A start-up install runs only for a tree that is not already a finished install of the current lockfile (ctx.ifNeeded).
      const present = ctx?.ifNeeded === true && !workspaces.length ? api.installState(cwd) : null;
      if (present?.state === 'installed') return { code: 0, text: `npm ci skipped in ${cwd}: node_modules is a finished install of the current lockfile`,
        data: { schema: 'starci/npm-ci@1', ok: true, cwd, ms: 0, skipped: 'installed', digest: present.digest } };
      api.clearMarker(cwd);
      const started = api.now();
      const result = await api.ci(cwd, { workspaces });
      const ms = Math.max(0, api.now() - started);
      if (!result?.ok) {
        const detail = String(result?.stderr ?? '').trim() || `npm exited ${String(result?.status ?? 'without a status')}`;
        const failure = installFailureOf(result?.stderr);
        if (failure.cause !== 'file-locked') return refusal(cwd, `failed: ${detail}`, 1, { ms, ...failure });
        const holders = api.holders(cwd);
        return refusal(cwd, `failed: file-locked (${failure.code} ${failure.syscall ?? 'access'} ${failure.path ?? cwd}); a running process holds a file of this tree: ${detail}`, 1, { ms, ...failure, holders });
      }
      if (!workspaces.length) api.markInstalled(cwd, { at: api.now() });
      return {
        code: 0,
        text: `npm ci completed in ${cwd} (${ms} ms)`,
        data: { schema: 'starci/npm-ci@1', ok: true, cwd, ms }
      };
    }, deps);
    return lockedValue(locked);
  } catch (error) {
    return refusal(cwd, `host lock failed: ${String(error?.message ?? error)}`, 1);
  }
}
