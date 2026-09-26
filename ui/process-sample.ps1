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

$processors = @(Get-CimInstance Win32_Processor)
$system = Get-CimInstance Win32_OperatingSystem
$totalMemory = [int64]$system.TotalVisibleMemorySize * 1024
$freeMemory = [int64]$system.FreePhysicalMemory * 1024
$machine = @{
  cpu = @{
    name = [string]$processors[0].Name
    cores = [int](($processors | Measure-Object -Property NumberOfCores -Sum).Sum)
    threads = [int](($processors | Measure-Object -Property NumberOfLogicalProcessors -Sum).Sum)
    percent = [Math]::Round([double](($processors | Measure-Object -Property LoadPercentage -Average).Average), 1)
  }
  memory = @{ totalBytes = $totalMemory; usedBytes = $totalMemory - $freeMemory; percent = [Math]::Round((($totalMemory - $freeMemory) * 100.0 / [Math]::Max(1.0, [double]$totalMemory)), 1) }
  gpu = @()
}
try {
  $gpuLines = & nvidia-smi --query-gpu=name,utilization.gpu,memory.total,memory.used,temperature.gpu,power.draw --format=csv,noheader,nounits 2>$null
  if ($LASTEXITCODE -eq 0) {
    $machine.gpu = @($gpuLines | ForEach-Object {
      $parts = $_ -split ',\s*'
      if ($parts.Count -lt 6) { return }
      @{
        name = [string]$parts[0]
        percent = [double]$parts[1]
        totalBytes = [int64]([double]$parts[2] * 1MB)
        usedBytes = [int64]([double]$parts[3] * 1MB)
        temperatureC = [double]$parts[4]
        powerW = [double]$parts[5]
      }
    })
  }
} catch {}
if ($machine.gpu.Count -eq 0) {
  $machine.gpu = @(Get-CimInstance Win32_VideoController | Where-Object { $_.Name -notmatch 'Duet Display|Microsoft Basic' } | ForEach-Object {
    @{ name = [string]$_.Name; percent = $null; totalBytes = $null; usedBytes = $null; temperatureC = $null; powerW = $null }
  })
}
@{ groups = $groups; machine = $machine } | ConvertTo-Json -Compress -Depth 6
