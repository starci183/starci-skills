// list.mjs - make exactly one PowerShell call and return the runtime's registered scheduled tasks as stable JSON.
import { spawnSync } from 'node:child_process';

const LIST_SCRIPT = [
  'param([Parameter(ValueFromRemainingArguments=$true)][string[]]$TaskNames)',
  "$ErrorActionPreference = 'Stop'",
  '$rows = @(Get-ScheduledTask -ErrorAction Stop | Where-Object { $TaskNames -contains $_.TaskName } | ForEach-Object {',
  '  $task = $_',
  '  $info = Get-ScheduledTaskInfo -TaskName $task.TaskName -TaskPath $task.TaskPath -ErrorAction Stop',
  '  $action = @($task.Actions | ForEach-Object {',
  '    $parts = @($_.Execute, $_.Arguments) | Where-Object { $_ }',
  "    $parts -join ' '",
  "  }) -join ' ; '",
  '  [pscustomobject]@{',
  '    taskName = $task.TaskName',
  '    state = [string]$task.State',
  "    nextRun = if ($info.NextRunTime -and $info.NextRunTime.Year -gt 1900) { $info.NextRunTime.ToString('o') } else { $null }",
  "    lastRun = if ($info.LastRunTime -and $info.LastRunTime.Year -gt 1900) { $info.LastRunTime.ToString('o') } else { $null }",
  '    lastResult = [int64]$info.LastTaskResult',
  '    action = $action',
  '  }',
  '})',
  '$rows | ConvertTo-Json -Compress',
].join('\n');

/** List the exact task names supplied by the runtime without a shell. */
export const listScheduledTasks = (taskNames, { env = process.env, powershell = 'powershell.exe', timeout = 30_000 } = {}) =>
  spawnSync(powershell, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', LIST_SCRIPT, ...taskNames], {
    encoding: 'utf8', env, windowsHide: true, timeout,
  });
