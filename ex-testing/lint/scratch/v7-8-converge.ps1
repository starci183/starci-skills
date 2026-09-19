param([int]$MaxAttempts = 8, [int]$SleepSeconds = 20)
$ErrorActionPreference = "Continue"
Set-Location "D:\Repositories\starci-academy-backend\.claude"

# Late v8-wave lanes keep editing records while phase 2 rebuilds the derived frontier.
# Converge: rebuild both trees, run the gate, repeat until it is clean; report every attempt.
$trees = [ordered]@{
  "todo-be" = "examples\todo-app-backend\.starciwork"
  "ec-be"   = "examples\ecommerce-app-be\.starciwork"
}

for ($i = 1; $i -le $MaxAttempts; $i++) {
  foreach ($name in $trees.Keys) {
    node scripts\example-derive.mjs --work $trees[$name] --write > $null 2>&1
    node scripts\example-critique.mjs --work $trees[$name] --write > $null 2>&1
  }
  $gate = node scripts\check-example-derived.mjs 2>&1
  $code = $LASTEXITCODE
  $stamp = (Get-Date).ToString('HH:mm:ss')
  "--- attempt $i  ($stamp)  gate exit=$code"
  foreach ($line in $gate) { "    $line" }
  if ($code -eq 0) {
    "CONVERGED at attempt $i ($stamp)"
    foreach ($name in $trees.Keys) {
      foreach ($f in "index.yaml","frontier.md","critique.yaml","critique.md") {
        $p = Join-Path $trees[$name] "_derived\$f"
        "  {0,-8} {1,-14} {2}" -f $name, $f, (Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash
      }
    }
    exit 0
  }
  if ($i -lt $MaxAttempts) { Start-Sleep -Seconds $SleepSeconds }
}
"NOT_CONVERGED after $MaxAttempts attempts; latest refusals quoted above"
exit 3
