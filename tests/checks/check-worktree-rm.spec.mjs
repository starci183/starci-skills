// check-worktree-rm: an Orca worktree is removed in one place, and nothing else imports the call file, calls the host call
// or spells `orca worktree rm`.
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { scanWorktreeRm, strayRemovals } from '../../scripts/checks/check-worktree-rm.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');

test('the check fires on a stray import, host call, argument list and shell command, and on nothing else', () => {
  const hit = (text, file = 'scripts/x.mjs') => strayRemovals(text, file).length;
  assert.equal(hit("import { worktreeRm } from '../api/orca/worktree-rm.mjs';\n"), 1);
  assert.equal(hit("const m = await import('../api/orca/worktree-rm.mjs');\n"), 1);
  assert.equal(hit("orcaCall('worktree-rm', { worktree });\n"), 1);
  assert.equal(hit("run(['worktree', 'rm', '--force', id]);\n"), 1);
  assert.equal(hit("execSync(`orca --json worktree rm --worktree ${id}`);\n"), 1);
  assert.equal(hit('orca worktree rm --worktree x\n', 'scripts/clean.sh'), 1);
  assert.equal(hit("git(repoRoot, ['worktree', 'remove', '--force', dir]);\n"), 0, 'git has its own removal');
  assert.equal(hit("// import { worktreeRm } from './worktree-rm.mjs'; orca worktree rm\n"), 0);
  assert.equal(hit("return { error: 'orca worktree rm refused' };\n"), 0);
  assert.equal(hit("import { worktreeRm } from '../api/orca/worktree-rm.mjs';\n", 'scripts/machine/worktree-orca.mjs'), 0, 'the owner');
  assert.equal(hit("const r = orcaCall('worktree-rm', { worktree, force });\n", 'scripts/api/orca/worktree-rm.mjs'), 0, 'the call file');
});

test('the runtime itself is clean', () => {
  const live = scanWorktreeRm(ROOT);
  assert.equal(live.ok, true, JSON.stringify(live.hits.slice(0, 3)));
});
