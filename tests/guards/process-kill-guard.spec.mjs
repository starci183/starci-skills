import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { commandVerdict } from '../../scripts/guards/command-guard.mjs';
import { bindGuardTerminal, writeJobGuard } from '../../scripts/guards/hook-install.mjs';
import { guardsRoot } from '../../scripts/guards/guards-root.mjs';

// The command guard refuses a kill that selects processes by image name or pattern: the machine is shared with Orca and
// every other agent, and a lane's `taskkill /F /IM node.exe //FI "WINDOWTITLE eq *"` restarted Orca (2026-10-01). An
// agent ends only the PIDs it started. No command below is ever run: the guard judges the text.
const ROOT = path.resolve(import.meta.dirname, '..', '..');
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

// A kill whose TARGETS come from a process query (2026-10-02: a lane killed other lanes' node runs by matching their
// command line) is refused; a literal PID, a PID from the caller's own start, a read-only query and mere mentions pass.
const CASE_A = "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'size-specs|--test-concurrency=2' -and $_.CommandLine -match 'c0-size|isolated-temp' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force; $_.ProcessId }";
const CASE_B = '$p=Get-CimInstance Win32_Process; $ids=@(103512); $x=$p | Where-Object { $_.ParentProcessId -in $ids }; foreach($i in $x){ Stop-Process -Id $i.ProcessId -Force }; Stop-Process -Id 103512 -Force';

test('a kill fed by a process query is refused in PowerShell and bash, with the PID remedy', async () => {
  const refused = [
    [CASE_A, 'powershell'],
    [CASE_B, 'powershell'],
    [`powershell -NoProfile -Command "${CASE_A.replace(/"/g, '`"')}"`, 'bash'],
    ['Get-Process | Where-Object { $_.Path -like "*lane*" } | Stop-Process -Force', 'powershell'],
    ['Get-Process node | Stop-Process', 'powershell'],
    ['gps node | spps', 'powershell'],
    ['$ids = (Get-Process | Where-Object { $_.CommandLine }).Id; foreach ($i in $ids) { Stop-Process -Id $i }', 'powershell'],
    ['Get-WmiObject Win32_Process -Filter "Name=\'node.exe\'" | ForEach-Object { $_.Terminate() }', 'powershell'],
    ['Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match "x" } | ForEach-Object { Invoke-CimMethod -InputObject $_ -MethodName Terminate }', 'powershell'],
    ['Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match "x" } | ForEach-Object { taskkill /PID $_.ProcessId /F }', 'powershell'],
    ['$p = Get-Process node; $p.Kill()', 'powershell'],
    ['taskkill /FI "PID gt 1000" /F', 'powershell'],
    ['wmic process where "commandline like \'%size-specs%\'" delete', 'bash'],
    ['wmic process where "commandline like \'%x%\'" call terminate', 'bash'],
    ['Stop-Process -Name node', 'powershell'],
    ['pkill -f size-specs', 'bash'],
    ['pkill node', 'bash'],
    ['killall node', 'bash'],
    ['pgrep -f size-specs | xargs kill', 'bash'],
    ['pgrep -f size-specs | xargs kill -9', 'bash'],
    ['kill $(pgrep -f size-specs)', 'bash'],
    ['kill -9 $(pgrep -f vitest)', 'bash'],
    ["ps aux | grep size-specs | awk '{print $2}' | xargs kill", 'bash'],
    ["ps -ef | grep node | grep -v grep | awk '{print $2}' | xargs kill -9", 'bash'],
    ['pids=$(pgrep -f vitest); kill $pids', 'bash'],
    ['taskkill //IM node.exe //F', 'bash'],
    ['taskkill //FI "WINDOWTITLE eq x"', 'bash'],
    ['taskkill /IM node.exe', 'powershell'],
  ];
  for (const [command, dialect] of refused) {
    const v = await verdict(command, dialect);
    assert.equal(v?.code, 'PROCESS_KILL_BY_NAME', `${command} (${dialect}) -> ${v?.code ?? 'passed'}`);
    assert.match(v.remedy, /PID you started/);
    assert.match(v.remedy, /never one found by a query/);
  }
});

test('a literal PID, a PID from your own start, a read-only query and a mere mention pass', async () => {
  const passed = [
    ['Stop-Process -Id 12345', 'powershell'],
    ['Stop-Process -Id 12345 -Force', 'powershell'],
    ['kill 12345', 'bash'],
    ['taskkill /PID 12345 /T /F', 'powershell'],
    ['taskkill //PID 12345 //T //F', 'bash'],
    ['Get-Process -Id 12345; Stop-Process -Id 12345', 'powershell'],
    ['$proc = Start-Process node -ArgumentList x.js -PassThru; Stop-Process -Id $proc.Id', 'powershell'],
    ['$proc = Start-Process node -ArgumentList x.js -PassThru\nGet-Process -Id $proc.Id\nStop-Process -Id $proc.Id -Force', 'powershell'],
    ['$proc = Start-Process node -PassThru; $proc | Stop-Process', 'powershell'],
    ['$proc = Start-Process node -PassThru; $proc.Kill()', 'powershell'],
    ['$proc = Start-Process node -PassThru; taskkill /PID $proc.Id /T /F', 'powershell'],
    ['node server.js & pid=$!; kill $pid', 'bash'],
    ['node server.js & kill $!', 'bash'],
    ['node server.js & pid=$!; ps -p $pid; kill -9 $pid', 'bash'],
    ['Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match "node" } | Select-Object ProcessId, CommandLine', 'powershell'],
    ['Get-Process node | Format-Table Id, Path', 'powershell'],
    ['ps aux | grep node', 'bash'],
    ['pgrep -f vitest', 'bash'],
    ['echo "Get-CimInstance Win32_Process | ForEach-Object { Stop-Process -Id $_.ProcessId }"', 'bash'],
    ['Write-Host "pgrep -f x | xargs kill"', 'powershell'],
    ['git log --grep="never pgrep -f x | xargs kill or Get-Process | Stop-Process"', 'bash'],
    ['git log --grep="$(cat <<\'EOF\'\nguard: refuse ps | grep node | xargs kill\n\nGet-CimInstance Win32_Process | Stop-Process is refused\nEOF\n)"', 'bash'],
    ['cat <<\'EOF\' > note.md\npgrep -f x | xargs kill\nEOF', 'bash'],
    ["# Get-Process | Stop-Process\nGet-Date", 'powershell'],
  ];
  for (const [command, dialect] of passed) {
    const v = await verdict(command, dialect);
    assert.equal(v, null, `${command} (${dialect}) -> ${v?.code}`);
  }
});

test('the PreToolUse hook blocks a kill by name before it runs (exit 2) and logs the refusal', (t) => {
  const scratch = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'starci-kill-guard-')));
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
  const logged = fs.readFileSync(path.join(guardsRoot(ROOT), 'refusals.jsonl'), 'utf8').trim().split(/\r?\n/).map((line) => JSON.parse(line));
  assert.ok(logged.some((entry) => entry.jobId === 'op-kill-guard-spec' && entry.code === 'PROCESS_KILL_BY_NAME'));
});
