import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { commandVerdict } from '../scripts/guards/command-guard.mjs';
import { bindGuardTerminal, writeJobGuard } from '../scripts/guards/install.mjs';

// The command guard refuses a kill that selects processes by image name or pattern: the machine is shared with Orca and
// every other agent, and a lane's `taskkill /F /IM node.exe //FI "WINDOWTITLE eq *"` restarted Orca (2026-10-01). An
// agent ends only the PIDs it started. No command below is ever run: the guard judges the text.
const ROOT = path.resolve(import.meta.dirname, '..');
const cwd = os.tmpdir();
const verdict = (command, dialect = 'bash') => commandVerdict({ command, cwd, guard: { owned: null }, env: process.env, dialect });

test('a kill by image name or pattern is refused in every spelling, wrapper and shell', async () => {
  const refused = [
    ['taskkill /F /IM node.exe', 'bash'],
    ['taskkill //F //IM node.exe //FI "WINDOWTITLE eq *"', 'bash'],
    ['taskkill /FI "IMAGENAME eq node.exe" /F', 'bash'],
    ['taskkill -im Orca.exe', 'bash'],
    ['cmd //c taskkill /IM node.exe /F', 'bash'],
    ['pkill -f jest', 'bash'],
    ['killall node', 'bash'],
    ['sleep 1 && pkill node', 'bash'],
    ['wmic process where name="node.exe" delete', 'bash'],
    ['powershell -NoProfile -Command "Stop-Process -Name node -Force"', 'bash'],
    ['Stop-Process -Name node -Force', 'powershell'],
    ['Stop-Process -ProcessName Orca', 'powershell'],
    ['spps -n node', 'powershell'],
    ['kill -Name node', 'powershell'],
  ];
  for (const [command, dialect] of refused) {
    const v = await verdict(command, dialect);
    assert.equal(v?.code, 'PROCESS_KILL_BY_NAME', `${command} (${dialect})`);
    assert.match(v.remedy, /PID you started/);
  }
});

test('ending a PID you started, and text that only mentions a kill, pass', async () => {
  const passed = [
    ['taskkill /PID 4242 /F', 'bash'],
    ['taskkill //F //T //PID 4242', 'bash'],
    ['kill 4242', 'bash'],
    ['kill -9 4242', 'bash'],
    ['kill -n 9 4242', 'bash'],
    ['Stop-Process -Id 4242 -Force', 'powershell'],
    ['echo "never pkill or taskkill /IM"', 'bash'],
    ['grep -rn killall docs', 'bash'],
    ['tasklist /FI "IMAGENAME eq node.exe"', 'bash'],
  ];
  for (const [command, dialect] of passed) assert.equal(await verdict(command, dialect), null, `${command} (${dialect})`);
});

test('the PreToolUse hook blocks a kill by name before it runs (exit 2) and logs the refusal', (t) => {
  const scratch = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'kill-guard-')));
  t.after(() => fs.rmSync(scratch, { recursive: true, force: true }));
  const jobFile = writeJobGuard({ skillRoot: scratch, jobId: 'op-kill-guard-spec', workflowId: 'wf-kill', ledgerRepo: null, owned: [scratch] });
  const handle = `term_spec-kill-hook-${process.pid}`;
  const bound = bindGuardTerminal({ skillRoot: ROOT, handle, jobFile });
  t.after(() => fs.rmSync(bound, { force: true }));
  const hook = (tool, command) => spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'guards', 'command-guard.mjs')], {
    input: JSON.stringify({ tool_name: tool, tool_input: { command }, cwd: scratch }), encoding: 'utf8', env: { ...process.env, ORCA_TERMINAL_HANDLE: handle },
  });
  for (const [tool, command] of [['Bash', 'taskkill //F //IM node.exe'], ['PowerShell', 'Stop-Process -Name node']]) {
    const r = hook(tool, command);
    assert.equal(r.status, 2, `${command}: ${r.stderr}`);
    assert.match(r.stderr, /starci guard: refused .*\[PROCESS_KILL_BY_NAME\]/);
  }
  assert.equal(hook('Bash', 'taskkill //PID 4242').status, 0);
  const logged = fs.readFileSync(path.join(ROOT, 'runtime', 'guards', 'refusals.jsonl'), 'utf8').trim().split(/\r?\n/).map((line) => JSON.parse(line));
  assert.ok(logged.some((entry) => entry.jobId === 'op-kill-guard-spec' && entry.code === 'PROCESS_KILL_BY_NAME'));
});
