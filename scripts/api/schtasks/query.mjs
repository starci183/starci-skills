// query.mjs - make exactly one PowerShell call and return one scheduled task as stable JSON.
import { spawnSync } from 'node:child_process';

const QUERY_SCRIPT = [
  'param([string]$TaskName)',
  "$ErrorActionPreference = 'Stop'",
  '$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction Stop',
  '$info = Get-ScheduledTaskInfo -TaskName $task.TaskName -TaskPath $task.TaskPath -ErrorAction Stop',
  '$action = @($task.Actions | ForEach-Object {',
  '  $parts = @($_.Execute, $_.Arguments) | Where-Object { $_ }',
  "  $parts -join ' '",
  "}) -join ' ; '",
  '[pscustomobject]@{',
  '  taskName = $task.TaskName',
  '  state = [string]$task.State',
  "  nextRun = if ($info.NextRunTime -and $info.NextRunTime.Year -gt 1900) { $info.NextRunTime.ToString('o') } else { $null }",
  "  lastRun = if ($info.LastRunTime -and $info.LastRunTime.Year -gt 1900) { $info.LastRunTime.ToString('o') } else { $null }",
  '  lastResult = [int64]$info.LastTaskResult',
  '  action = $action',
  '} | ConvertTo-Json -Compress',
].join('\n');

/** Query one task by exact Task Scheduler name without a shell. */
export const queryScheduledTask = (taskName, { env = process.env, powershell = 'powershell.exe', timeout = 30_000 } = {}) =>
  spawnSync(powershell, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', QUERY_SCRIPT, taskName], {
    encoding: 'utf8', env, windowsHide: true, timeout,
  });
