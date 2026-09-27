# install-tick-task.ps1 - registers the Windows task that runs the supervisor tick with no chat
# (modules/supervisor/supervise.yaml scheduledTick). Run it from the live .claude checkout:
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/supervisor/install-tick-task.ps1 [-RunNow]
#
# The name, the interval (allocation.supervisorTick.everyMs) and the command come from
# `node scripts/supervisor/tick.mjs --task-spec`. The task runs at logon and every interval, hidden
# (conhost --headless, the way StarCi-Resume-Every10m runs), at below-normal priority, restarted on failure,
# and never twice at once (IgnoreNew; tick.mjs also holds the host lock supervisor-tick).
# -RunNow starts it once and waits for the run to finish.
param([switch]$RunNow)
$ErrorActionPreference = 'Stop'

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$node = (Get-Command node.exe -ErrorAction Stop).Source
$specJson = & $node (Join-Path $here 'tick.mjs') --task-spec
if ($LASTEXITCODE -ne 0 -or -not $specJson) { throw "tick.mjs --task-spec failed (exit $LASTEXITCODE)" }
$spec = $specJson | ConvertFrom-Json

$conhost = Join-Path $env:SystemRoot 'System32\conhost.exe'
$argLine = '--headless "{0}" "{1}" {2}' -f $spec.node, $spec.script, ($spec.args -join ' ')
$action = New-ScheduledTaskAction -Execute $conhost -Argument $argLine -WorkingDirectory $spec.workdir

$user = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$interval = New-TimeSpan -Minutes $spec.everyMinutes
$every = New-ScheduledTaskTrigger -Once -At (Get-Date).Date -RepetitionInterval $interval
$logon = New-ScheduledTaskTrigger -AtLogOn -User $user
$logon.Repetition = $every.Repetition

# A run never outlives its interval, so a hung tick cannot hold the next one off.
$limit = New-TimeSpan -Minutes ([Math]::Max(5, $spec.everyMinutes - 5))
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -Priority 7 -RestartCount 3 `
  -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit $limit -StartWhenAvailable `
  -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -Hidden
$principal = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited

$task = Register-ScheduledTask -TaskName $spec.name -Action $action -Trigger @($logon, $every) -Settings $settings `
  -Principal $principal -Description 'StarCi supervisor tick (modules/supervisor/supervise.yaml scheduledTick)' -Force
Write-Output ("registered {0}: at logon and every {1} minutes -> {2} {3}" -f $task.TaskName, $spec.everyMinutes, $conhost, $argLine)

if ($RunNow) {
  Start-ScheduledTask -TaskName $spec.name
  $deadline = (Get-Date).Add($limit)
  do { Start-Sleep -Seconds 5; $state = (Get-ScheduledTask -TaskName $spec.name).State } while ($state -eq 'Running' -and (Get-Date) -lt $deadline)
  $info = Get-ScheduledTaskInfo -TaskName $spec.name
  Write-Output ("run finished: state {0}, last result {1}, last run {2}" -f $state, $info.LastTaskResult, $info.LastRunTime)
  if ($info.LastTaskResult -ne 0) { exit 1 }
}
