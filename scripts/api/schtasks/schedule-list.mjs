// schedule-list.mjs - return the runtime's registered scheduled tasks as stable JSON in one PowerShell call.
import { scheduleSpawn } from './lib.mjs';

const LIST_SCRIPT = [
  "$ErrorActionPreference = 'Stop'",
  '$rows = @(Get-ScheduledTask -ErrorAction Stop | Where-Object { $Arguments -contains $_.TaskName } | ForEach-Object {',
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

/** List the exact task names supplied by the runtime. */
export const scheduleList = (taskNames, options = {}) => scheduleSpawn(LIST_SCRIPT, taskNames, options);
