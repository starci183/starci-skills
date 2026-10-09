// The runtime's own rewind of a workflow branch to its last checkpoint (preserveAndReset) is allowed through the append-only history hook,
// and only while the commit it leaves is kept under refs/heads/preserved. Nivo's settle-fail of a failed Critic verdict was refused
// workflow-reset-failed three times because the worktree's garbage collector had committed the op's files on the workflow branch and the hook
// refused the runtime's own `git reset --soft` back to the checkpoint ("not a fast-forward").
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ensureHistoryHook, HOOK_VERSION } from '../../scripts/guards/hook-install.mjs';
import { preserveAndReset } from '../../scripts/kernel/workflow-checkpoint.mjs';

const WF = 'wf-rewind-k1';
const BRANCH = 'wf-branch';
const OP = 'op-be-1';
const run = (cwd, args, env = {}) => spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true, env: { ...process.env, ...env } });
const git = (cwd, ...args) => { const r = run(cwd, args); assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`); return r.stdout.trim(); };
const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'starci-rewind-hook-')));
after(() => fs.rmSync(base, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));

function world() {
  const repo = fs.mkdtempSync(path.join(base, 'repo-'));
  git(repo, 'init', '-q', '-b', 'main');
  for (const [k, v] of [['user.email', 'spec@starci.test'], ['user.name', 'spec'], ['core.autocrlf', 'false']]) git(repo, 'config', k, v);
  fs.mkdirSync(path.join(repo, 'be'));
  fs.writeFileSync(path.join(repo, 'be', 'a.ts'), 'export const a = 1;\n');
  git(repo, 'add', '-A');
  git(repo, 'commit', '-q', '-m', 'init');
  git(repo, 'checkout', '-q', '-b', BRANCH);
  fs.writeFileSync(path.join(repo, 'be', 'b.ts'), 'export const b = 1;\n');
  git(repo, 'add', '-A');
  git(repo, 'commit', '-q', '-m', 'checkpoint');
  const checkpoint = git(repo, 'rev-parse', 'HEAD');
  fs.writeFileSync(path.join(repo, 'be', 'op.ts'), 'export const op = 1;\n');
  git(repo, 'add', '-A');
  git(repo, 'commit', '-q', '-m', 'preserve: uncommitted work of its worktree');
  const head = git(repo, 'rev-parse', 'HEAD');
  assert.equal(ensureHistoryHook(repo).installed, true);
  const registry = { workflowId: WF, orcaWorktreeId: 'wt-1', path: repo, branch: BRANCH, checkpoint };
  const job = { job_id: OP, payload_json: JSON.stringify({ owned_paths: ['be'] }) };
  const worktree = { workflowWorktreeOf: () => ({ ...registry }), workflowWorktreeAt: () => ({ ...registry }), setCheckpoint: () => true, markReleasePending: () => ({ ok: true }), TERMINAL_JOB_STATUSES: ['running'] };
  const ctx = { worktree, db: { prepare: () => ({ get: () => job, all: () => [] }) }, lockWaitMs: 5_000, gate: () => ({ exit: 0 }) };
  return { repo, checkpoint, head, ctx };
}

test('the hook rewinds a protected branch only for the runtime naming its target, and only past a preserved commit', () => {
  const { repo, checkpoint, head } = world();
  assert.match(fs.readFileSync(path.join(repo, '.git', 'hooks', 'reference-transaction'), 'utf8'), new RegExp(`v${HOOK_VERSION}\\b`));
  const plain = run(repo, ['reset', '--soft', checkpoint]);
  assert.notEqual(plain.status, 0, 'a reset nobody named is a rewrite of the shared branch');
  assert.match(plain.stderr, /not a fast-forward/);
  const unkept = run(repo, ['reset', '--soft', checkpoint], { STARCI_BRANCH_REWIND: checkpoint });
  assert.notEqual(unkept.status, 0, 'the commit it leaves is kept nowhere: refused');
  assert.equal(git(repo, 'rev-parse', 'HEAD'), head);
  git(repo, 'update-ref', 'refs/heads/preserved/x', head);
  const wrongTarget = run(repo, ['reset', '--soft', 'HEAD~2'], { STARCI_BRANCH_REWIND: checkpoint });
  assert.notEqual(wrongTarget.status, 0, 'the named target must be the one moved to');
  const kept = run(repo, ['reset', '--soft', checkpoint], { STARCI_BRANCH_REWIND: checkpoint });
  assert.equal(kept.status, 0, kept.stderr);
  assert.equal(git(repo, 'rev-parse', 'HEAD'), checkpoint);
});

test('preserveAndReset puts a branch that a commit past its checkpoint holds back on the checkpoint, the commit kept under preserved/', () => {
  const { repo, checkpoint, head, ctx } = world();
  const out = preserveAndReset(ctx, { workflowId: WF, opId: OP });
  assert.equal(out.resetTo, checkpoint);
  assert.equal(git(repo, 'rev-parse', 'HEAD'), checkpoint, 'the branch is back on its last checkpoint');
  assert.equal(git(repo, 'rev-parse', `refs/heads/preserved/${WF}/${OP}`), head, 'what it held is kept');
  assert.equal(git(repo, 'status', '--porcelain', '--', 'be'), '', 'the op files are gone from the tree and the index');
});
