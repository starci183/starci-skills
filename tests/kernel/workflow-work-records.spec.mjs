// The one rule for Work records in workflow worktrees (WFWT2 2.8, ruled B): a record is committed only by the runtime,
// on the workflow branch of its owner workflow (work-ownership.mjs ownerOf). A green op that changed a record another live
// workflow owns is refused at settle (workflow-work-record-not-owner); the owner's own later settles read its records at
// its workflow branch; a peer reads main, so it sees a record when the owner lands.
// Temp git repos and a fake part-A registry: no live Orca call.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { settleCheckpoint } from '../../scripts/kernel/workflow-settle.mjs';
import { workflowCommittedReader } from '../../scripts/kernel/work-ownership.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OWNER = 'wf-owner-k1', PEER = 'wf-peer-k2';
const RECORD = '.starciwork/features/billing/index.yaml';
const OCCUPYING = ['leased', 'running', 'answering', 'reported', 'deciding', 'effect_unknown'];
const git = (cwd, ...args) => {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true });
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};
const write = (root, rel, text) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), text); };

/** The app repo on main with one Work record, and the OWNER workflow's worktree on its branch. */
function fixture(t, ownerOfFile) {
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'starci-wf-work-')));
  t.after(() => fs.rmSync(base, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const repo = path.join(base, 'app'), dir = path.join(base, 'wf');
  fs.mkdirSync(repo);
  git(repo, 'init', '-q', '-b', 'main');
  for (const [k, v] of [['user.email', 'spec@starci.test'], ['user.name', 'spec'], ['core.autocrlf', 'false']]) git(repo, 'config', k, v);
  write(repo, RECORD, 'title: billing v1\n');
  write(repo, 'be/a.ts', 'export const a = 1;\n');
  git(repo, 'add', '-A');
  git(repo, 'commit', '-q', '-m', 'init');
  git(repo, 'worktree', 'add', '-q', '-b', `wf-${OWNER}`, dir, 'main');
  const registry = new Map([[OWNER, { workflowId: OWNER, orcaWorktreeId: 'orca-wt-1', path: dir, branch: `wf-${OWNER}`, checkpoint: null }]]);
  const db = { prepare: () => ({ get: () => null, all: () => [] }) };
  const worktree = {
    workflowWorktreeOf: (_ctx, id) => (registry.has(id) ? { ...registry.get(id) } : null),
    workflowWorktreeAt: () => null,
    setCheckpoint: (_ctx, id, sha) => { registry.get(id).checkpoint = sha; },
    TERMINAL_JOB_STATUSES: OCCUPYING,
  };
  const ctx = { worktree, db, behindLimit: 1000, ownerOf: ownerOfFile, escalate: () => ({ ok: true }) };
  return { repo, dir, ctx, registry };
}

test('settle refuses a green op that changed a Work record another live workflow owns; the owner and the repo-owner fallback pass', (t) => {
  const peerOwns = () => ({ workflowId: PEER, by: 'scope-record', detail: 'features/billing' });
  const fx = fixture(t, peerOwns);
  write(fx.dir, RECORD, 'title: billing v2 by a non-owner\n');
  const before = git(fx.dir, 'rev-parse', 'HEAD');
  assert.throws(() => settleCheckpoint(fx.ctx, { workflowId: OWNER, opId: 'op-scope-1', pass: true }),
    (e) => e.code === 'workflow-work-record-not-owner' && e.files[0].file === RECORD && e.files[0].workflowId === PEER);
  assert.equal(git(fx.dir, 'rev-parse', 'HEAD'), before, 'nothing is committed on a refusal');
  // The repo-owner fallback names no definite owner: a new record nobody claims is the writer's.
  const fallback = fixture(t, () => ({ workflowId: PEER, by: 'repo-owner', detail: 'oldest live workflow of the ledger' }));
  write(fallback.dir, RECORD, 'title: billing v2\n');
  assert.equal(settleCheckpoint(fallback.ctx, { workflowId: OWNER, opId: 'op-scope-1', pass: true }).committed, true);
  // The owner commits its own record as its checkpoint.
  const own = fixture(t, () => ({ workflowId: OWNER, by: 'scope-record', detail: 'features/billing' }));
  write(own.dir, RECORD, 'title: billing v2\n');
  const cp = settleCheckpoint(own.ctx, { workflowId: OWNER, opId: 'op-scope-1', pass: true });
  assert.deepEqual([cp.committed, cp.files], [true, [RECORD]]);
  // A code-only change never asks who owns a record.
  const code = fixture(t, () => { throw new Error('ownership is not read for code'); });
  write(code.dir, 'be/a.ts', 'export const a = 2;\n');
  assert.equal(settleCheckpoint(code.ctx, { workflowId: OWNER, opId: 'op-be-1', pass: true }).committed, true);
});

test('the owner reads its own records at its workflow branch; a peer reads main until the owner lands', (t) => {
  const ownerOf = (rel) => ({ workflowId: rel === RECORD ? OWNER : PEER, by: 'scope-record' });
  const fx = fixture(t, ownerOf);
  write(fx.dir, RECORD, 'title: billing v2\n');
  settleCheckpoint(fx.ctx, { workflowId: OWNER, opId: 'op-scope-1', pass: true });
  const other = '.starciwork/features/other/index.yaml';
  const owner = workflowCommittedReader({ repo: fx.repo, workflowId: OWNER, ownerOf, worktree: fx.dir })([RECORD, other]);
  assert.equal(owner.get(RECORD).toString('utf8'), 'title: billing v2\n', 'the owner sees its checkpointed record before it lands');
  assert.equal(owner.get(other), null, 'a record the owner does not own is read at main');
  const peer = workflowCommittedReader({ repo: fx.repo, workflowId: PEER, ownerOf, worktree: null })([RECORD]);
  assert.equal(peer.get(RECORD).toString('utf8'), 'title: billing v1\n', 'a peer reads main: the record is v1 until the owner lands');
  git(fx.repo, 'merge', '-q', '--ff-only', `wf-${OWNER}`);
  const landed = workflowCommittedReader({ repo: fx.repo, workflowId: PEER, ownerOf, worktree: null })([RECORD]);
  assert.equal(landed.get(RECORD).toString('utf8'), 'title: billing v2\n', 'once the owner lands, the peer sees it');
});

test('the rule is written once in docs/workflow-kernel.md', () => {
  const doc = fs.readFileSync(path.join(ROOT, 'docs', 'workflow-kernel.md'), 'utf8').replace(/\s+/g, ' ');
  assert.match(doc, /\*\*Work records\.\*\* A Work record is committed only by the runtime, on the workflow branch of its owner workflow/);
  assert.match(doc, /workflow-work-record-not-owner/);
});
