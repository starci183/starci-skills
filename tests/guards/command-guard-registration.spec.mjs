// 3.6 (owner-approved): the command guard is registered as a PreToolUse hook in the TRACKED .claude/settings.json, for both Bash
// and PowerShell, next to the seat-tools entry - through the guard's own entry point, the one trust.mjs writes for workers.
// An owner session carries no Orca guard file, so everyday commands must pass untouched; no command below is ever run.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { TOOL_GUARD_MARKER, TOOL_GUARD_MATCHER, TOOL_GUARD_TIMEOUT_S, toolGuardCommand } from '../../scripts/agent/trust.mjs';
import { commandVerdict } from '../../scripts/guards/command-guard.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const settings = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude', 'settings.json'), 'utf8'));
const groups = settings.hooks.PreToolUse;
const guardGroups = groups.filter((g) => g.hooks.some((h) => h.command.includes(TOOL_GUARD_MARKER)));
const GUARD = path.join(ROOT, 'scripts', 'guards', 'command-guard.mjs');

test('the tracked settings register the command guard once, for Bash and PowerShell, next to seat-tools', () => {
  assert.equal(guardGroups.length, 1, 'exactly one command-guard group');
  const [group] = guardGroups;
  assert.equal(group.matcher, TOOL_GUARD_MATCHER);
  for (const tool of ['Bash', 'PowerShell']) assert.match(tool, new RegExp(`^(?:${group.matcher})$`), `${tool} is matched`);
  for (const tool of ['Read', 'Edit', 'Write', 'Agent']) assert.doesNotMatch(tool, new RegExp(`^(?:${group.matcher})$`), `${tool} is not`);
  assert.equal(group.hooks.length, 1);
  assert.equal(group.hooks[0].type, 'command');
  assert.equal(group.hooks[0].timeout, TOOL_GUARD_TIMEOUT_S);
  assert.ok(groups.some((g) => g.matcher === 'Agent|Task' && g.hooks.some((h) => h.command === 'starci guard seat-tools')), 'the seat-tools entry stays');
});

test('the tracked hook and worker trust use the guard CLI fast path without a script path', () => {
  const { command } = guardGroups[0].hooks[0];
  assert.equal(command, toolGuardCommand(), 'same command as the runtime writes');
  assert.equal(command, 'starci guard command');
  assert.doesNotMatch(command, /[A-Za-z]:[\\/]|\/Users\//, 'no absolute host path in a tracked file');
  assert.equal(toolGuardCommand(GUARD), 'starci guard command', 'the worker registration never persists a runtime script path');
});

// What an owner (or lane) session runs all day. With no guard bound the hook meets one rule only (install through a linked node_modules).
const EVERYDAY = [
  ['git status', 'bash'], ['git diff --stat origin/main', 'bash'], ['npm run check', 'bash'], ['npm test', 'bash'], ['ls -la scripts', 'bash'], ['dir scripts', 'bash'],
  ['node scripts/kernel/cli.mjs status', 'bash'], ['node scripts/lib/spec-deps.mjs . scripts/guards/command-guard.mjs', 'bash'],
  ['echo "$HOME"', 'bash'], ['printenv PATH', 'bash'], ['env FOO=1 node -v', 'bash'], ['set -euo pipefail; echo ok', 'bash'],
  ['kill 4242', 'bash'], ['taskkill /PID 4242 /F', 'bash'], ['sleep 30 & pid=$!; kill $pid', 'bash'],
  ['Get-ChildItem scripts', 'powershell'], ['Get-Content package.json', 'powershell'], ['$env:PATH', 'powershell'], ['Get-Item Env:HOME', 'powershell'],
  ['Stop-Process -Id 4242 -Force', 'powershell'], ['Get-Process -Id 4242', 'powershell'], ['node scripts/kernel/cli.mjs status', 'powershell'],
];

const hook = (input, env) => spawnSync(process.execPath, [GUARD], { input: JSON.stringify(input), encoding: 'utf8', cwd: os.tmpdir(), env });
const bareEnv = () => { const env = { ...process.env }; delete env.ORCA_TERMINAL_HANDLE; return env; };

test('an owner session (no guard bound) passes everyday commands through the registered hook, Bash and PowerShell', () => {
  for (const [command, dialect] of EVERYDAY) {
    const input = { tool_name: dialect === 'powershell' ? 'PowerShell' : 'Bash', tool_input: { command }, cwd: os.tmpdir() };
    const run = hook(input, bareEnv());
    assert.equal(run.status, 0, `${command} (${dialect}): ${run.stderr}`);
  }
});

test('a guarded worker session passes the same everyday commands that touch no forbidden thing, and is refused where the guard refuses', async () => {
  const guard = { owned: null };
  const everyday = EVERYDAY.filter(([command]) => !/^(?:npm|git)\b/.test(command));
  for (const [command, dialect] of everyday) assert.equal(await commandVerdict({ command, cwd: os.tmpdir(), guard, env: process.env, dialect }), null, `${command} (${dialect})`);
  const refused = [['taskkill /F /IM node.exe', 'bash'], ['printenv', 'bash'], ['Stop-Process -Name node', 'powershell']];
  for (const [command, dialect] of refused) assert.ok(await commandVerdict({ command, cwd: os.tmpdir(), guard, env: process.env, dialect }), `${command} (${dialect})`);
});

test('the registered hook refuses for a terminal with a bound guard and passes for an owner session (end to end)', () => {
  const guards = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-guard-reg-'));
  try {
    fs.mkdirSync(path.join(guards, 'terminals'), { recursive: true });
    fs.writeFileSync(path.join(guards, 'terminals', 'term_reg.json'), JSON.stringify({ schema: 'starci/op-guard@1', role: 'op', jobId: 'job_reg', workflowId: 'wf_reg', owned: [], terminal: 'term_reg' }));
    const input = { tool_name: 'Bash', tool_input: { command: 'taskkill /F /IM node.exe' }, cwd: os.tmpdir() };
    const worker = hook(input, { ...bareEnv(), STARCI_GUARDS_ROOT: guards, ORCA_TERMINAL_HANDLE: 'term_reg' });
    assert.equal(worker.status, 2, worker.stderr);
    assert.match(worker.stderr, /PID you started/);
    assert.equal(hook(input, { ...bareEnv(), STARCI_GUARDS_ROOT: guards }).status, 0, 'the owner session has no bound terminal');
  } finally { fs.rmSync(guards, { recursive: true, force: true }); }
});
