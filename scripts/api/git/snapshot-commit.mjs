// snapshot-commit.mjs — one commit holding everything a worktree has, written through a temporary index.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { gitRunner } from './lib.mjs';
import { WORKTREES_REL } from '../../lib/worktree-exclude.mjs';

const tmpIndex = () => path.join(os.tmpdir(), `starci-preserve-${process.pid}-${crypto.randomBytes(4).toString('hex')}.index`);
const UNSTAGED = [':(exclude,glob)**/node_modules', ':(exclude,glob)**/node_modules/**', `:(exclude)${WORKTREES_REL}`];

/**
 * One commit holding everything a worktree has: `head` plus every tracked and untracked (not ignored) change, written
 * through a temporary index - the worktree's own index, files and hooks are untouched; `head` itself when nothing is
 * dirty. node_modules and the worktrees container are never staged.
 * {ok, sha, dirty} | {ok:false, step, detail}
 */
export function snapshotCommit(worktree, head, message) {
  const plain = gitRunner(null);
  const status = plain(['status', '--porcelain', '--untracked-files=all', '--', '.', ...UNSTAGED], { cwd: worktree });
  if (!status.ok) return { ok: false, step: 'status', detail: status.stderr.slice(0, 200) };
  if (!status.stdout) return { ok: true, sha: head, dirty: false };
  const index = tmpIndex();
  const env = { ...process.env, GIT_INDEX_FILE: index };
  try {
    for (const args of [['read-tree', head], ['add', '-A', '--', '.', ...UNSTAGED]]) {
      const r = plain(args, { cwd: worktree, env });
      if (!r.ok) return { ok: false, step: 'index', detail: `${args.slice(0, 2).join(' ')}: ${r.stderr.slice(0, 200)}` };
    }
    const tree = plain(['write-tree'], { cwd: worktree, env });
    if (!tree.ok || !tree.stdout) return { ok: false, step: 'write-tree', detail: tree.stderr.slice(0, 200) };
    const commit = plain(['-c', 'user.name=starci', '-c', 'user.email=runtime@starci.local', 'commit-tree', tree.stdout, '-p', head, '-m', message], { cwd: worktree, env });
    if (!commit.ok || !commit.stdout) return { ok: false, step: 'commit-tree', detail: commit.stderr.slice(0, 200) };
    return { ok: true, sha: commit.stdout, dirty: true };
  } finally { try { fs.rmSync(index, { force: true }); } catch { /* temp */ } }
}
