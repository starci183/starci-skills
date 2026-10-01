// fake-orca-worktrees.mjs — a fake Orca worktree client (scripts/lib/worktrees.mjs orcaWorktreeClient's shape: create,
// remove, list) that behaves as the real `orca worktree create/rm/list` was measured to (lane ORCAWT, 2026-10-01): the tree
// goes under its own workspace root `<root>/<repo name>/<name>`, the branch is the name with '/' turned into '-' and a
// -2, -3 suffix when taken, the id is `<repo-id>::<path>`; rm removes the tree and its registration (a spec's git does it
// here) and deletes the branch only when it is merged into main. Every call is recorded. `failCreate` / `failRemove`
// make the next calls refuse before any effect; `unknownRepo` answers repo_not_found until addRepo registers it.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const git = (cwd, ...args) => {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true });
  return { ok: r.status === 0, stdout: String(r.stdout ?? '').trim(), stderr: String(r.stderr ?? '').trim() };
};
const posix = (p) => String(p).replace(/\\/g, '/');

export function fakeOrcaWorktrees({ root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-fake-orca-')), failCreate = false, failRemove = false, unknownRepo = false } = {}) {
  let known = !unknownRepo;
  const calls = [];
  const trees = new Map(); // id -> {id, path, branch, repo}
  const repoOf = (selector) => path.resolve(String(selector).replace(/^path:/, ''));
  const client = {
    root,
    calls,
    trees,
    names: () => calls.map((c) => c[0]),
    create(args) {
      calls.push(['create', args]);
      if (failCreate || !known) return { ok: false, outcome: 'failed', worktree: null, errorCode: 'repo_not_found', error: 'repo_not_found' };
      const repo = repoOf(args.repo);
      let branch = String(args.name).replace(/\//g, '-');
      for (let n = 2; git(repo, 'rev-parse', '--verify', '--quiet', `refs/heads/${branch}`).ok; n += 1) branch = `${String(args.name).replace(/\//g, '-')}-${n}`;
      const dir = path.join(root, path.basename(repo), branch);
      fs.mkdirSync(path.dirname(dir), { recursive: true });
      const added = git(repo, 'worktree', 'add', '-b', branch, dir, args.baseBranch ?? 'main');
      if (!added.ok) return { ok: false, outcome: 'failed', worktree: null, error: added.stderr };
      const id = `repo-${path.basename(repo)}::${posix(dir)}`;
      const w = { id, path: posix(dir), branch, head: git(dir, 'rev-parse', 'HEAD').stdout };
      trees.set(id, { ...w, repo });
      return { ok: true, outcome: 'ok', worktree: w };
    },
    remove(args) {
      calls.push(['remove', args]);
      if (failRemove) return { ok: false, outcome: 'failed', removed: false, errorCode: 'worktree_not_found', error: 'worktree_not_found' };
      const id = String(args.worktree).replace(/^id:/, '');
      const t = trees.get(id);
      if (!t) return { ok: false, outcome: 'failed', removed: false, errorCode: 'worktree_not_found', error: 'worktree_not_found' };
      const rm = git(t.repo, 'worktree', 'remove', '--force', t.path);
      if (!rm.ok) return { ok: false, outcome: 'failed', removed: false, error: rm.stderr };
      const tip = git(t.repo, 'rev-parse', '--verify', '--quiet', `refs/heads/${t.branch}`);
      if (tip.ok && git(t.repo, 'merge-base', '--is-ancestor', tip.stdout, 'main').ok) git(t.repo, 'branch', '-D', t.branch);
      trees.delete(id);
      return { ok: true, outcome: 'ok', removed: true };
    },
    addRepo(args) {
      calls.push(['addRepo', args]);
      known = true;
      return { ok: true, repoId: `repo-${path.basename(String(args.path))}` };
    },
    list(args = {}) {
      calls.push(['list', args]);
      const repo = args.repo ? repoOf(args.repo) : null;
      return { ok: true, worktrees: [...trees.values()].filter((t) => !repo || t.repo === repo).map((t) => ({ id: t.id, path: t.path, branch: t.branch, displayName: path.basename(t.path), isMainWorktree: false })) };
    },
  };
  return client;
}
