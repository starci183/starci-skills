import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { commandVerdict } from '../../scripts/guards/command-guard.mjs';
import { writeJobGuard } from '../../scripts/guards/hook-install.mjs';

// The uat, workspace and runtime rules are enforced by the command guard (OPS2 3.1, WFWT2), not left to evidence:
//  - workspace.manage / runtime.operate: worktrees only through the runtime API (an agent's own `orca worktree create|rm`
//    is AGENT_ORCA_WORKTREE; `git worktree add|remove` is WORKTREE_NOT_OPS), no recursive delete, no kill by name, agents
//    only through worker-start;
//  - uat.*: the walk runs on the real dev stack, never a test world (UAT_TEST_WORLD).
// No command below is ever run: the guard judges the text.
const cwd = os.tmpdir();
const verdict = (command, guard = { owned: null }, dialect = 'bash') => commandVerdict({ command, cwd, guard, env: process.env, dialect });

test('an agent never creates or removes an Orca worktree itself, in any spelling', async () => {
  for (const command of ['orca worktree rm --worktree id:repo::x --force', 'orca worktree create --repo id:r --name x', 'orca worktree remove x', 'orca --json worktree prune',
    'sleep 1 && orca worktree rm --worktree path:/tmp/x', 'powershell -NoProfile -Command "orca worktree rm --worktree x"']) {
    const v = await verdict(command);
    assert.equal(v?.code, 'AGENT_ORCA_WORKTREE', command);
    assert.match(v.remedy, /runtime worktree API/);
  }
  for (const command of ['orca worktree list --json', 'orca worktree ps', 'echo "orca worktree rm x"']) assert.equal((await verdict(command))?.code ?? null, null, `${command} reads or only mentions`);
});

test('the workspace and runtime rules that already had a guard still refuse (one place to see them all)', async () => {
  const cases = [['git worktree add ../x', 'WORKTREE_NOT_OPS'], ['git worktree remove --force ../x', 'WORKTREE_NOT_OPS'], ['rm -rf be/node_modules', 'RECURSIVE_DELETE'],
    ['taskkill /F /IM node.exe', 'PROCESS_KILL_BY_NAME'], ['orca terminal create --command codex', 'RAW_TERMINAL_CREATE'], ['claude -p "do it"', 'AGENT_HEADLESS_LAUNCH']];
  for (const [command, code] of cases) assert.equal((await verdict(command, { owned: ['be'] }))?.code, code, command);
});

test('a uat op never starts a test world; any other op may', async () => {
  for (const op of ['uat.verify', 'uat.assisted.prepare', 'uat.assisted.verify']) {
    const v = await verdict('node .claude/scripts/gates/test-world-run.mjs --root fe --project e2e', { owned: null, op });
    assert.equal(v?.code, 'UAT_TEST_WORLD', op);
    assert.match(v.reason, new RegExp(op.replace(/\./g, '\\.')));
    assert.match(v.remedy, /real|dev stack/);
  }
  assert.equal((await verdict('node scripts/gates/test-world-run.mjs --root be', { owned: null, op: 'test.author' }))?.code ?? null, null, 'a test op runs its world');
  assert.equal((await verdict('node scripts/gates/env-health.mjs --root be', { owned: null, op: 'uat.verify' }))?.code ?? null, null, 'the dev stack check passes');
  assert.equal((await verdict('node scripts/gates/test-world-run.mjs', { owned: null }))?.code ?? null, null, 'a guard that names no op');
});

test('the job guard file names the op, so the op-family rules can read it', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-guard-op-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const file = writeJobGuard({ skillRoot: root, jobId: 'op-uat-1', workflowId: 'wf-x', ledgerRepo: root, owned: [], op: 'uat.verify' });
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).op, 'uat.verify');
});
