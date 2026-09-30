// The Kernel's land step (owner 2026-10-01; scripts/kernel/product-worktree.mjs landOp): a green op lands straight into the
// product's main - the merge guard, a rebase onto main when it moved, THE GATE (scripts/checks/gate.mjs) on exactly the tree
// that lands, then main fast-forwarded with the live checkout, pushed, and wf/<wf> following it. A refusal never moves main.
// Right after the settle the op worktree and its branch are removed (junctions first); a failed op's work is kept on
// preserved/<op>, uncommitted changes included.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ensureOpWorktree, landOp, preservedOpRef, removeOpWorktree } from '../scripts/kernel/product-worktree.mjs';

const greenGate = () => ({ exit: 0, counts: { new: 0 }, findings: [], errors: [] });
const git = (cwd, ...args) => {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true });
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};
const has = (cwd, ref) => spawnSync('git', ['rev-parse', '--verify', '--quiet', ref], { cwd, windowsHide: true }).status === 0;
const write = (root, rel, text) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), text); };
const WF = 'wf-land-aaaa1111';

/** A product repository on main with a bare origin it pushes to. */
function fixture(t) {
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'starci-opland-')));
  t.after(() => fs.rmSync(base, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const repo = path.join(base, 'nivo-fe');
  const origin = path.join(base, 'origin.git');
  fs.mkdirSync(repo);
  git(repo, 'init', '-q', '-b', 'main');
  for (const [k, v] of [['user.email', 'spec@starci.test'], ['user.name', 'spec'], ['core.autocrlf', 'false'], ['commit.gpgsign', 'false']]) git(repo, 'config', k, v);
  write(repo, '.gitignore', 'node_modules/\n');
  write(repo, 'tsconfig.json', JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { '@/*': ['./src/*'] } } }));
  write(repo, 'src/x.ts', 'export const x = 1;\n');
  write(repo, 'src/y.ts', 'export const y = 1;\n');
  git(repo, 'add', '-A'); git(repo, 'commit', '-q', '-m', 'init');
  git(base, 'init', '-q', '--bare', origin);
  git(repo, 'remote', 'add', 'origin', origin);
  git(repo, 'push', '-q', 'origin', 'main');
  return { repo, origin };
}
const opOf = (repo, jobId) => { const made = ensureOpWorktree({ repoRoot: repo, workflowId: WF, jobId }); assert.ok(made.ok, JSON.stringify(made)); return made.record; };
const commit = (cwd, rel, text, message) => { write(cwd, rel, text); git(cwd, 'add', '-A'); git(cwd, 'commit', '-q', '-m', message); return git(cwd, 'rev-parse', 'HEAD'); };

test('rebase then fast-forward: main moved under the op, the gate runs on the rebased tree against main, main is pushed, wf follows', (t) => {
  const { repo, origin } = fixture(t);
  const a = opOf(repo, 'op-code.refactor-1111111111');
  commit(a.op.path, 'src/x.ts', 'export const x = 2;\n', 'a: x');
  const moved = commit(repo, 'src/y.ts', 'export const y = 2;\n', 'main moved');
  git(repo, 'push', '-q', 'origin', 'main');
  const seen = [];
  const gate = ({ root, base }) => { seen.push({ root, base, x: fs.readFileSync(path.join(root, 'src/x.ts'), 'utf8'), y: fs.readFileSync(path.join(root, 'src/y.ts'), 'utf8') }); return greenGate(); };
  const landed = landOp({ record: a, gate });
  assert.ok(landed.ok, JSON.stringify(landed));
  assert.deepEqual(seen, [{ root: a.op.path, base: moved, x: 'export const x = 2;\n', y: 'export const y = 2;\n' }], 'the gate saw exactly the tree that lands, against main');
  assert.equal(landed.before, moved);
  assert.equal(git(repo, 'rev-parse', 'main'), landed.after);
  assert.equal(git(repo, 'rev-parse', 'main^'), moved, 'rebased: one commit on top of the new main, no merge commit');
  assert.equal(fs.readFileSync(path.join(repo, 'src/x.ts'), 'utf8'), 'export const x = 2;\n', 'the live checkout moved with main');
  assert.deepEqual(landed.push, { pushed: true, remote: 'origin', detail: null });
  assert.equal(git(origin, 'rev-parse', 'main'), landed.after, 'origin/main carries the land');
  assert.equal(git(repo, 'rev-parse', 'wf/aaaa1111'), landed.after, 'wf/<wf> follows main');
  // Right after the settle: the worktree and op/<op> go; a landed op preserves nothing.
  const removed = removeOpWorktree({ record: a });
  assert.ok(removed.ok, JSON.stringify(removed));
  assert.equal(removed.branch.deleted, true);
  assert.equal(removed.branch.preserved, null);
  assert.ok(!fs.existsSync(a.op.path));
  assert.equal(has(repo, `refs/heads/${a.op.branch}`), false);
  assert.equal(has(repo, `refs/heads/preserved/${a.op.short}`), false);
});

test('a red or unavailable gate refuses the land: main untouched, the op worktree back on its own head', (t) => {
  const { repo, origin } = fixture(t);
  const a = opOf(repo, 'op-code.refactor-2222222222');
  const head = commit(a.op.path, 'src/x.ts', 'export const x = 3;\n', 'a');
  commit(repo, 'src/y.ts', 'export const y = 3;\n', 'main moved');
  const main = git(repo, 'rev-parse', 'main');
  const red = landOp({ record: a, gate: () => ({ exit: 1, counts: { new: 1 }, findings: [{ engine: 'tsc', rule: 'TS2322', path: 'src/x.ts' }], errors: [] }) });
  assert.equal(red.reason, 'land-gate-red');
  assert.equal(red.gate.findings[0].rule, 'TS2322');
  assert.equal(git(repo, 'rev-parse', 'main'), main);
  assert.equal(git(a.op.path, 'rev-parse', 'HEAD'), head, 'the rebase was undone in the op worktree');
  const down = landOp({ record: a, gate: () => ({ exit: 2, errors: ['tsc could not run'], findings: [], counts: { new: 0 } }) });
  assert.equal(down.reason, 'land-gate-unavailable');
  assert.equal(git(repo, 'rev-parse', 'main'), main);
  assert.notEqual(git(origin, 'rev-parse', 'main'), main, 'nothing was pushed');
});

test('MERGE GUARD at landing: an op branch whose merge of main kept the lane side is refused before anything moves', (t) => {
  const { repo } = fixture(t);
  const a = opOf(repo, 'op-code.refactor-3333333333');
  commit(a.op.path, 'src/x.ts', 'export const x = 4;\n', 'a');
  commit(repo, 'src/service-deps.ts', 'export const rule = 1;\n', 'main: a new rule');
  const main = git(repo, 'rev-parse', 'main');
  git(a.op.path, 'merge', '-q', '-s', 'ours', '--no-edit', '-m', 'merge main into op', 'main');
  let gated = false;
  const refused = landOp({ record: a, gate: () => { gated = true; return greenGate(); } });
  assert.equal(refused.reason, 'land-merge-dropped-main', JSON.stringify(refused));
  assert.deepEqual(refused.dropped, ['src/service-deps.ts']);
  assert.equal(gated, false, 'the guard runs before the gate');
  assert.equal(git(repo, 'rev-parse', 'main'), main);
});

test('a live checkout dirty on a path the land writes refuses it; main untouched', (t) => {
  const { repo } = fixture(t);
  const a = opOf(repo, 'op-code.refactor-4444444444');
  commit(a.op.path, 'src/x.ts', 'export const x = 5;\n', 'a');
  const main = git(repo, 'rev-parse', 'main');
  write(repo, 'src/x.ts', 'export const x = "local edit";\n');
  const refused = landOp({ record: a, gate: greenGate });
  assert.equal(refused.reason, 'land-main-refused', JSON.stringify(refused));
  assert.equal(git(repo, 'rev-parse', 'main'), main);
  assert.equal(fs.readFileSync(path.join(repo, 'src/x.ts'), 'utf8'), 'export const x = "local edit";\n', 'the local edit is never overwritten');
});

test('a failed op keeps its work on preserved/<op> - commits and uncommitted changes - and its worktree is removed', (t) => {
  const { repo } = fixture(t);
  const a = opOf(repo, 'op-code.refactor-5555555555');
  const head = commit(a.op.path, 'src/x.ts', 'export const x = 6;\n', 'a: partial');
  write(a.op.path, 'src/y.ts', 'export const y = "uncommitted";\n');
  write(a.op.path, 'src/new.ts', 'export const fresh = 1;\n');
  const removed = removeOpWorktree({ record: a });
  assert.ok(removed.ok, JSON.stringify(removed));
  assert.ok(!fs.existsSync(a.op.path), 'the worktree is removed');
  assert.equal(has(repo, `refs/heads/${a.op.branch}`), false, 'op/<op> is deleted');
  const kept = removed.branch.preserved;
  assert.equal(kept.branch, `preserved/${a.op.short}`);
  assert.equal(kept.uncommitted, true);
  assert.equal(git(repo, 'rev-parse', `${kept.branch}^`), head, 'the preserve commit sits on the op head');
  assert.equal(git(repo, 'show', `${kept.branch}:src/y.ts`), 'export const y = "uncommitted";');
  assert.equal(git(repo, 'show', `${kept.branch}:src/new.ts`), 'export const fresh = 1;');
  assert.equal(preservedOpRef(repo, 'op-code.refactor-5555555555')?.sha, kept.sha);
  assert.equal(git(repo, 'status', '--porcelain'), '', 'the product checkout never saw any of it');
});
