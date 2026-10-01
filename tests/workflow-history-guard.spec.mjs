import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { commandVerdict, workflowHistoryChange } from '../scripts/guards/command-guard.mjs';
import { writeJobGuard } from '../scripts/guards/install.mjs';

// Ops never commit (contract change workflow-worktree): inside the workflow worktree its op guard names
// (guard.workflowWorktree), the command guard refuses every git command that changes history or a ref, or discards
// tracked work (WORKFLOW_HISTORY_CHANGE); the runtime checkpoints a green op at settle. Reads pass inside it, and nothing
// changes outside it. No command below is ever run: the guard judges the text (cwd and -C directories included).
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-wf-history-guard-'));
test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
const worktree = path.join(tmp, 'wf-smoke');
const outside = path.join(tmp, 'elsewhere');
for (const d of [path.join(worktree, 'be', 'src'), outside]) fs.mkdirSync(d, { recursive: true });
const guard = { owned: null, workflowWorktree: worktree };
const verdict = (command, cwd = worktree, g = guard, dialect = 'bash') => commandVerdict({ command, cwd, guard: g, env: process.env, dialect });

const REFUSED = [
  'git commit -m "slice done"',
  'git commit --amend --no-edit',
  'git commit -m wip -- be/src/a.ts',
  'git merge origin/main',
  'git rebase main',
  'git push origin HEAD',
  'git pull',
  'git reset --hard',
  'git reset --soft HEAD~1',
  'git reset HEAD~1',
  'git checkout -- be/src/a.ts',
  'git checkout main',
  'git checkout -b other',
  'git switch main',
  'git restore be/src/a.ts',
  'git restore --staged --worktree be/src/a.ts',
  'git stash',
  'git stash push -m x',
  'git cherry-pick abc123',
  'git revert HEAD',
  'git tag v1',
  'git branch -D wf/smoke',
  'git branch feature',
  'git update-ref refs/heads/wf/smoke HEAD~1',
  'git reflog expire --all',
  'npm test && git commit -am done',
];

test('inside the workflow worktree every history or ref change is refused, pointing at the settle checkpoint', async () => {
  for (const command of REFUSED) {
    const v = await verdict(command);
    assert.equal(v?.code, 'WORKFLOW_HISTORY_CHANGE', command);
    assert.match(v.remedy, /the runtime checkpoints your work at settle/);
  }
  const sub = await verdict('git commit -m x', path.join(worktree, 'be', 'src'));
  assert.equal(sub?.code, 'WORKFLOW_HISTORY_CHANGE', 'a subdirectory of the worktree is inside it');
  const viaC = await verdict(`git -C "${worktree}" commit -m x`, outside);
  assert.equal(viaC?.code, 'WORKFLOW_HISTORY_CHANGE', 'git -C into the worktree is inside it');
  const ps = await verdict('git commit -m x', worktree, guard, 'powershell');
  assert.equal(ps?.code, 'WORKFLOW_HISTORY_CHANGE', 'the PowerShell tool too');
});

test('inside the workflow worktree reads pass: status, diff, log, show, branch listing, stash list', async () => {
  for (const command of ['git status', 'git status --porcelain', 'git diff', 'git diff --stat HEAD', 'git log --oneline -5', 'git show HEAD',
    'git rev-parse HEAD', 'git ls-files', 'git branch', 'git branch --show-current', 'git stash list', 'git restore --staged be/src/a.ts',
    'git reset', 'git reset -- be/src/a.ts', 'git tag --list', 'git blame be/src/a.ts', 'git grep foo', 'echo "git commit -m x"']) {
    const v = await verdict(command);
    assert.notEqual(v?.code, 'WORKFLOW_HISTORY_CHANGE', command);
  }
});

test('outside the workflow worktree, and for a guard with no workflow worktree, nothing changes', async () => {
  for (const command of ['git commit -m x', 'git checkout -- a.ts', 'git push origin HEAD']) {
    assert.notEqual((await verdict(command, outside))?.code, 'WORKFLOW_HISTORY_CHANGE', `${command} outside`);
    assert.notEqual((await verdict(command, worktree, { owned: null }))?.code, 'WORKFLOW_HISTORY_CHANGE', `${command} with no workflow worktree`);
  }
  const sibling = path.join(tmp, 'wf-smoke-2');
  fs.mkdirSync(sibling, { recursive: true });
  assert.notEqual((await verdict('git commit -m x', sibling))?.code, 'WORKFLOW_HISTORY_CHANGE', 'a sibling whose name only starts like the worktree is outside');
});

test('the op guard file records the workflow worktree; an op outside one records null', () => {
  const root = path.join(tmp, 'skill');
  const file = writeJobGuard({ skillRoot: root, jobId: 'job-wf', workflowId: 'wf', ledgerRepo: tmp, owned: [], workflowWorktree: worktree });
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).workflowWorktree, path.resolve(worktree));
  const plain = writeJobGuard({ skillRoot: root, jobId: 'job-plain', workflowId: 'wf', ledgerRepo: tmp, owned: [] });
  assert.equal(JSON.parse(fs.readFileSync(plain, 'utf8')).workflowWorktree, null);
});

test('workflowHistoryChange names the change, and null for a read', () => {
  assert.match(workflowHistoryChange('commit', ['-m', 'x']), /writes history/);
  assert.match(workflowHistoryChange('checkout', ['--', 'a.ts']), /discards tracked work/);
  assert.equal(workflowHistoryChange('status', []), null);
  assert.equal(workflowHistoryChange('diff', ['HEAD']), null);
});
