$ErrorActionPreference = 'Stop'

# Only emit aggregate numbers. Command lines are inspected locally to identify Qwen's
# node processes, and are never returned to the browser.
$processes = Get-CimInstance Win32_Process
$perfByPid = @{}
Get-CimInstance Win32_PerfFormattedData_PerfProc_Process | ForEach-Object {
  if ($_.IDProcess -gt 0) { $perfByPid[[int]$_.IDProcess] = $_ }
}
$cores = [Math]::Max(1, [Environment]::ProcessorCount)
$groups = @{}
foreach ($name in @('qwen', 'devin', 'claude', 'codex')) {
  $groups[$name] = @{ processCount = 0; cpuPercent = 0.0; ramBytes = [int64]0 }
}

foreach ($process in $processes) {
  $name = [string]$process.Name
  $provider = switch ($name.ToLowerInvariant()) {
    'devin.exe' { 'devin' }
    'claude.exe' { 'claude' }
    'codex.exe' { 'codex' }
    'node.exe' {
      if ([string]$process.CommandLine -match '(?i)qwen-code') { 'qwen' }
    }
  }
  if (-not $provider) { continue }
  $group = $groups[$provider]
  $group.processCount++
  $perf = $perfByPid[[int]$process.ProcessId]
  if ($null -ne $perf) {
    $group.cpuPercent += [double]$perf.PercentProcessorTime / $cores
    $group.ramBytes += [int64]$perf.PrivateBytes
  } else {
    $group.ramBytes += [int64]$process.WorkingSetSize
  }
}

foreach ($name in $groups.Keys) {
  $groups[$name].cpuPercent = [Math]::Round($groups[$name].cpuPercent, 1)
}
$groups | ConvertTo-Json -Compress -Depth 3
