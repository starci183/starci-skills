// command-policy-shim.spec.mjs - the PreToolUse hook and PATH shim consume one R223 policy and return identical refusals.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { hookDecision } from '../../scripts/guards/command-guard.mjs';
import { shimDecision, shimRefusalLines } from '../../scripts/guards/command-policy.mjs';
import { mkdtemp } from '../helpers/tmpdir.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const HANDLE = 'term-command-policy-shim';
const OP = { schema: 'starci/op-guard@1', role: 'op', workflowId: 'wf-shim', jobId: 'job-shim', op: 'backend.implement', workflowWorktree: null, owned: [] };

const bind = (handle, body) => {
  const dir = path.join(process.env.STARCI_GUARDS_ROOT, 'terminals');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${handle}.json`), JSON.stringify(body));
};
const hookCall = (text, cwd) => ({ tool_name: 'Bash', cwd, tool_input: { command: text } });

test('the hook and shim return identical policy codes and uses for the same command table', async (t) => {
  const cwd = mkdtemp(t, 'policy-shared-');
  const lockRoot = mkdtemp(t, 'policy-lock-');
  bind(HANDLE, OP);
  const env = { ...process.env, ORCA_TERMINAL_HANDLE: HANDLE, STARCI_ROLE: '', STARCI_HOST_LOCK_DIR: path.join(lockRoot, 'lock') };
  const cases = [
    { text: 'git push origin main', program: 'git', args: ['push', 'origin', 'main'], code: 'RIGHTS_GIT_PUSH' },
    { text: 'npm ci', program: 'npm', args: ['ci'], code: 'RIGHTS_NPM_CI_UNLOCKED' },
    { text: 'npm publish', program: 'npm', args: ['publish'], code: 'RIGHTS_NPM_PUBLISH' },
    { text: 'npm test', program: 'npm', args: ['test'], code: 'RIGHTS_SUITE_RUN' },
    { text: 'docker compose up -d', program: 'docker', args: ['compose', 'up', '-d'], code: 'RIGHTS_RAW_TOOL' },
    { text: 'supabase start', program: 'supabase', args: ['start'], code: 'RIGHTS_RAW_TOOL' },
    { text: 'gh pr create', program: 'gh', args: ['pr', 'create'], code: 'RIGHTS_RAW_TOOL' },
    { text: 'node scripts/x.mjs', program: 'node', args: ['scripts/x.mjs'], code: 'RIGHTS_RAW_TOOL' },
    { text: 'git status', program: 'git', args: ['status'], code: null },
    { text: 'git log --oneline', program: 'git', args: ['log', '--oneline'], code: null },
    { text: 'npm view yaml version', program: 'npm', args: ['view', 'yaml', 'version'], code: null },
    { text: 'node --check scripts/x.mjs', program: 'node', args: ['--check', 'scripts/x.mjs'], code: null },
    { text: 'starci gate unit', program: 'starci', args: ['gate', 'unit'], code: null },
  ];
  for (const row of cases) {
    const hook = await hookDecision(hookCall(row.text, cwd), { env });
    const shim = await shimDecision({ program: row.program, args: row.args, cwd, env, root: ROOT });
    assert.equal(hook?.verdict?.code ?? null, row.code, `hook: ${row.text}`);
    assert.equal(shim.verdict?.code ?? null, row.code, `shim: ${row.text}`);
    assert.equal(shim.verdict?.code ?? null, hook?.verdict?.code ?? null, `code parity: ${row.text}`);
    assert.equal(shim.verdict?.use ?? null, hook?.verdict?.use ?? null, `use parity: ${row.text}`);
  }
});

test('a Codex-style worker with no PreToolUse hook is refused by the shim and each use names the allowed path', async (t) => {
  const cwd = mkdtemp(t, 'policy-codex-');
  const lockRoot = mkdtemp(t, 'policy-codex-lock-');
  bind(HANDLE, OP);
  const env = { ...process.env, ORCA_TERMINAL_HANDLE: HANDLE, STARCI_ROLE: '', STARCI_HOST_LOCK_DIR: path.join(lockRoot, 'lock') };
  for (const [program, args, code] of [
    ['git', ['push', 'origin', 'main'], 'RIGHTS_GIT_PUSH'],
    ['npm', ['ci'], 'RIGHTS_NPM_CI_UNLOCKED'],
    ['docker', ['compose', 'up', '-d'], 'RIGHTS_RAW_TOOL'],
    ['supabase', ['start'], 'RIGHTS_RAW_TOOL'],
    ['gh', ['pr', 'create'], 'RIGHTS_RAW_TOOL'],
  ]) {
    const { verdict } = await shimDecision({ program, args, cwd, env, root: ROOT });
    assert.equal(verdict.code, code, `${program} ${args.join(' ')}`);
    assert.match(verdict.use, /starci|host lock/, `${program} names the allowed path`);
    assert.ok(shimRefusalLines(verdict).some((line) => line.includes(`[${code}]`)));
  }
  for (const [program, args] of [['git', ['status']], ['git', ['log']], ['npm', ['view', 'yaml']], ['node', ['--version']], ['rg', ['policy', 'scripts']]]) {
    assert.equal((await shimDecision({ program, args, cwd, env, root: ROOT })).verdict, null, `${program} ${args.join(' ')}`);
  }
});

test('an unbound handle is the owner and an unreadable policy fails open without throwing', async (t) => {
  const cwd = mkdtemp(t, 'policy-owner-');
  const missingRoot = mkdtemp(t, 'policy-missing-');
  const owner = await shimDecision({ program: 'git', args: ['push', 'origin', 'main'], cwd,
    env: { ...process.env, ORCA_TERMINAL_HANDLE: 'term-with-no-binding', STARCI_ROLE: '' }, root: ROOT });
  assert.equal(owner.role, null);
  assert.equal(owner.verdict, null);
  const failOpen = await shimDecision({ program: 'docker', args: ['compose', 'up'], cwd,
    env: { ...process.env, ORCA_TERMINAL_HANDLE: '', STARCI_ROLE: 'lead' }, root: missingRoot });
  assert.equal(failOpen.role, 'lead');
  assert.equal(failOpen.verdict, null);
});
