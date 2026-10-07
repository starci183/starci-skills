// schedule-query.mjs - return one scheduled task as stable JSON in one PowerShell call.
import { scheduleSpawn } from './lib.mjs';

const QUERY_SCRIPT = [
  "$ErrorActionPreference = 'Stop'",
  '$task = Get-ScheduledTask -TaskName $Arguments[0] -ErrorAction Stop',
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

/** Query one task by exact Task Scheduler name. */
export const scheduleQuery = (taskName, options = {}) => scheduleSpawn(QUERY_SCRIPT, [taskName], options);
