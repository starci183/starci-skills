#requires -Version 5.1
<#
Decrypts every DEMO-ONLY .enc secret this example ships under .starcistacks/dev/runtime/**, then runs the
given command. The decrypted files are never committed (see the backend's .gitignore); the identity they
are encrypted to is itself committed and documented as demo-only in runtime/env/KEYS.md.

Usage: .\scripts\with-dev-secrets.ps1 <command> [args...]
  e.g. .\scripts\with-dev-secrets.ps1 docker compose -f .starcistacks/dev/infra/compose/compose.yaml up -d
#>
param(
  [Parameter(Mandatory = $true, ValueFromRemainingArguments = $true)]
  [string[]]$Command
)
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$envDir = Join-Path $root '.starcistacks/dev/runtime/env'
$filesDir = Join-Path $root '.starcistacks/dev/runtime/files'
$env:SOPS_AGE_KEY_FILE = Join-Path $envDir 'demo.agekey'

function Invoke-Sops {
  param([string[]]$SopsArgs)
  if (Get-Command sops -ErrorAction SilentlyContinue) {
    & sops @SopsArgs
  } else {
    docker run --rm -e SOPS_AGE_KEY_FILE=/keys/key.txt `
      -v "${env:SOPS_AGE_KEY_FILE}:/keys/key.txt:ro" -v "${root}:/work" -w /work `
      ghcr.io/getsops/sops:v3.10.2 @SopsArgs
  }
}

# app.env.enc is a SOPS dotenv document: decrypt it back to dotenv shape.
Invoke-Sops @('-d', '--input-type', 'dotenv', '--output-type', 'dotenv', (Join-Path $envDir 'app.env.enc')) |
  Set-Content -LiteralPath (Join-Path $envDir 'app.env') -Encoding utf8

# Every *.key.enc is a single value wrapped as {"data": "..."} so SOPS has a document to encrypt; unwrap it
# back to the raw value the compose secret/file expects.
Get-ChildItem -LiteralPath $filesDir -Filter '*.key.enc' | ForEach-Object {
  $plain = $_.FullName.Substring(0, $_.FullName.Length - 4)
  $decrypted = Invoke-Sops @('-d', '--input-type', 'json', '--output-type', 'json', $_.FullName) -join "`n"
  ($decrypted | ConvertFrom-Json).data | Set-Content -LiteralPath $plain -Encoding utf8 -NoNewline
}

Write-Host "Decrypted dev secrets under .starcistacks/dev/runtime/**; running: $($Command -join ' ')"
& $Command[0] $Command[1..($Command.Length - 1)]
exit $LASTEXITCODE
