$ErrorActionPreference = "Continue"
Set-Location "D:\Repositories\starci-academy-backend\.claude"

$f = "examples\todo-app-backend\.starciwork\_derived\frontier.md"
$before = (Get-FileHash -LiteralPath $f -Algorithm SHA256).Hash
"before          : $before"

try {
  Add-Content -LiteralPath $f -Value "`n<!-- v7-8 probe: deliberate corruption of generated output -->"
  $corrupt = (Get-FileHash -LiteralPath $f -Algorithm SHA256).Hash
  "corrupted       : $corrupt"
  "--- gate with corrupted frontier.md ---"
  node scripts\check-example-derived.mjs 2>&1
  "gate exit=$LASTEXITCODE   (0 => the gate does NOT watch frontier.md)"
} finally {
  node scripts\example-derive.mjs --work "examples\todo-app-backend\.starciwork" --write > $null 2>&1
  $restored = (Get-FileHash -LiteralPath $f -Algorithm SHA256).Hash
  "restored        : $restored"
  "restore exact   : {0}" -f ($restored -eq $before)
}
"--- gate after restore ---"
node scripts\check-example-derived.mjs 2>&1
"gate exit=$LASTEXITCODE"
