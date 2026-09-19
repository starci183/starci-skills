param(
  [int]$BudgetSeconds = 5400,
  [int]$PollSeconds = 60,
  [string]$DoneDir = "ex-testing\lint\done",
  [string]$LogFile = "ex-testing\lint\scratch\v76-wait.log"
)

# v7-6 phase-2 gate: wait for v7-1.done, v7-3.done, v7-4.done, v7-5.done (my brief's marker set).
# One line per poll round so the wait is auditable; exits 0 when all four exist, 3 on budget expiry.
$markers = @(1,3,4,5) | ForEach-Object { Join-Path $DoneDir "v7-$_.done" }
$deadline = (Get-Date).AddSeconds($BudgetSeconds)

function State {
  $present = @($markers | Where-Object { Test-Path -LiteralPath $_ })
  $missing = @($markers | Where-Object { -not (Test-Path -LiteralPath $_) } | ForEach-Object { Split-Path $_ -Leaf })
  return [pscustomobject]@{ Count = $present.Count; Missing = ($missing -join ',') }
}

$s = State
"{0}  start  present={1}/4 missing=[{2}]" -f (Get-Date).ToString('HH:mm:ss'), $s.Count, $s.Missing | Add-Content -LiteralPath $LogFile
if ($s.Count -eq 4) { "ALL_PRESENT" | Add-Content -LiteralPath $LogFile; Write-Output "ALL_PRESENT"; exit 0 }

while ((Get-Date) -lt $deadline) {
  $remain = ($deadline - (Get-Date)).TotalSeconds
  if ($remain -lt 1) { break }
  Start-Sleep -Seconds ([Math]::Min($PollSeconds, [Math]::Max(1, [int]$remain)))
  $s = State
  "{0}  present={1}/4 missing=[{2}]" -f (Get-Date).ToString('HH:mm:ss'), $s.Count, $s.Missing | Add-Content -LiteralPath $LogFile
  if ($s.Count -eq 4) { "ALL_PRESENT" | Add-Content -LiteralPath $LogFile; Write-Output "ALL_PRESENT"; exit 0 }
}

"BUDGET_EXPIRED present=$($s.Count)/4 missing=[$($s.Missing)]" | Add-Content -LiteralPath $LogFile
Write-Output "BUDGET_EXPIRED present=$($s.Count)/4 missing=[$($s.Missing)]"
exit 3
