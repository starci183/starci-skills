// installed-artefacts.mjs - the artefacts the runtime installs outside its own source files, and their migration to the revision that runs.
// modules/kernel/installed-artefacts.yaml declares each artefact; this module holds the handler of every `migrate: rewrite` row: how its stamp is read,
// what the revision under `root` stamps, how it is rewritten, and how the rewrite is verified. The migration touches only the runtime's own artefacts
// (hooks, generated copies), never a product file. It is idempotent: a current artefact is left as it is, and it runs from the NEW tree (a deploy
// starts it as a child of the host tree after the fast-forward) so the stamps written are the new revision's.
import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from '../../engine/yaml.mjs';
import { byCodeUnit } from '../lib/list.mjs';
import { ensureHistoryHook, ensureWorkHook, HOOK_VERSION, WORK_HOOK_VERSION } from '../guards/hook-install.mjs';
import { installGitHooks } from '../guards/git-hooks.mjs';
import { hookStamp } from '../guards/hook-stamp.mjs';
import { driftOfRuntime, syncRuntime } from '../hfs/sync-runtime.mjs';

export const ARTEFACTS_FILE = 'modules/kernel/installed-artefacts.yaml';
const FAILED = Object.freeze({ code: 'installed-artefact-failed' });
const UNVERIFIED = Object.freeze({ code: 'installed-artefact-unverified' });

/** The declared rows of the tree at `root`. */
export const loadArtefacts = (root) => parseYaml(fs.readFileSync(path.join(root, ARTEFACTS_FILE), 'utf8'));

const hookHandler = ({ name, marker, current, ensure }) => ({
  scope: 'repo',
  read: (repo) => {
    const found = hookStamp(repo, name, marker);
    return found.state === 'stamped' ? { state: 'stamped', stamp: found.version } : { state: found.state };
  },
  current: () => current,
  apply: (repo, { root }) => {
    const done = ensure(repo, { skillRoot: root });
    return done?.installed === false ? { skipped: done.reason ?? 'not-installed' } : { changed: done?.changed !== false };
  },
});

const gitHooksFresh = (root) => installGitHooks({ root, templateRoot: root }).hooks.every((hook) => hook.state === 'current' || hook.state === 'foreign');

/** Handlers by artefact id. `read(target)` -> {state, stamp?}; `apply(target, {root})` rewrites; `current()` is the stamp the revision carries. */
export const HANDLERS = Object.freeze({
  'history-hook': hookHandler({ name: 'reference-transaction', marker: 'starci-history-guard', current: HOOK_VERSION, ensure: ensureHistoryHook }),
  'work-hook': hookHandler({ name: 'pre-commit', marker: 'starci-work-guard', current: WORK_HOOK_VERSION, ensure: ensureWorkHook }),
  'runtime-git-hooks': {
    scope: 'host',
    read: (root) => ({ state: installGitHooks({ root, templateRoot: root, fs: dryFs() }).hooks.every((hook) => hook.state !== 'updated') ? 'current' : 'stale' }),
    current: () => 'current',
    apply: (root) => ({ changed: !gitHooksFresh(root) }),
  },
  'runtime-copies': {
    scope: 'host',
    read: (root) => ({ state: driftOfRuntime(root).length ? 'stale' : 'current' }),
    current: () => 'current',
    apply: (root) => ({ changed: syncRuntime(root) >= 0 }),
  },
});

// A read-only view of the filesystem for installGitHooks: reads pass, writes are counted as "would update" by leaving the file as it is.
function dryFs() {
  return { ...fs, mkdirSync: () => undefined, writeFileSync: () => undefined, renameSync: () => undefined, chmodSync: () => undefined };
}

const isStale = (handler, read) => (read.state === 'stamped' ? read.stamp !== handler.current() : read.state === 'stale');

/** Migrates one target of one artefact: {artefact, target, state: 'current' | 'migrated' | 'absent' | 'skipped' | 'refused', before, after, code?, detail?}. */
export function migrateTarget(id, target, { root, apply = true }) {
  const handler = HANDLERS[id];
  const base = { artefact: id, target };
  let before;
  try { before = handler.read(target); } catch (error) { return { ...base, state: 'refused', code: FAILED.code, detail: String(error?.message ?? error).slice(0, 200) }; }
  if (before.state === 'absent' || before.state === 'foreign') return { ...base, state: before.state === 'absent' ? 'absent' : 'skipped', before: before.state };
  const stale = isStale(handler, before);
  if (!stale) return { ...base, state: 'current', before: before.stamp ?? before.state };
  if (!apply) return { ...base, state: 'stale', before: before.stamp ?? before.state };
  try {
    const done = handler.apply(target, { root });
    if (done.skipped) return { ...base, state: 'skipped', before: before.stamp ?? before.state, detail: done.skipped };
  } catch (error) { return { ...base, state: 'refused', code: FAILED.code, before: before.stamp ?? before.state, detail: String(error?.message ?? error).slice(0, 200) }; }
  const after = handler.read(target);
  if (isStale(handler, after)) return { ...base, state: 'refused', code: UNVERIFIED.code, before: before.stamp ?? before.state, after: after.stamp ?? after.state, detail: 'the rewrite did not leave the stamp of this revision' };
  return { ...base, state: 'migrated', before: before.stamp ?? before.state, after: after.stamp ?? after.state };
}

/**
 * The repositories and worktrees of the live workflows: every unremoved worktree row that belongs to a workflow, and its repository, that exist on disk.
 * `machine` is an open machine store. Every live workflow is covered, running or about to wake.
 */
export function workflowTargets(machine) {
  const rows = machine.liveWorktrees().filter((row) => row.workflow_id);
  const paths = rows.flatMap((row) => [row.path, row.repo_root]).filter(Boolean).map((p) => path.resolve(p));
  return [...new Set(paths)].filter((p) => fs.existsSync(p)).sort(byCodeUnit);
}

/**
 * Migrates every installed artefact of the live workflows and of the host tree to the revision under `root`.
 * Returns {ok, results, counts: {current, migrated, absent, skipped, refused, stale}, refused: [...]}; `apply: false` only reports.
 */
export function migrateInstalledArtefacts({ root, machine, apply = true, targets = null, include = ['repo', 'host'] }) {
  const declared = loadArtefacts(root).artefacts.filter((row) => row.migrate === 'rewrite' && include.includes(HANDLERS[row.id].scope));
  const repos = targets ?? workflowTargets(machine);
  const results = declared.flatMap((row) => {
    const handler = HANDLERS[row.id];
    const where = handler.scope === 'host' ? [root] : repos;
    return where.map((target) => migrateTarget(row.id, target, { root, apply }));
  });
  const counts = { current: 0, migrated: 0, absent: 0, skipped: 0, refused: 0, stale: 0 };
  for (const result of results) counts[result.state] += 1;
  return { ok: counts.refused === 0 && counts.stale === 0, results, counts, refused: results.filter((r) => r.state === 'refused') };
}
